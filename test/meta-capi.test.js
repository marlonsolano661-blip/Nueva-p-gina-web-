'use strict';
const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { hayDB, iniciar, eventoWompi, PRODUCTOS_BASE, CLIENTE_OK } = require('./helpers/backend');
const crearPedido = require('../lib/crear-pedido');
const webhook = require('../lib/webhook-wompi');
const capi = require('../lib/meta-capi');

const sha = (v) => crypto.createHash('sha256').update(v).digest('hex');
const CFG = { metaPixelId: '123', metaCapiToken: 'tok', metaTestEventCode: '', site: 'https://tienda.test' };
const PEDIDO = { cliente: { email: ' Ana@Correo.com ', tel: '311 575 2334' }, items: [{ id: 'plataforma-luna', cant: 2, precio: 189900 }] };

describe('meta-capi (unidad)', () => {
  let original, envios;
  beforeEach(() => { original = globalThis.fetch; envios = []; globalThis.fetch = async (url, o) => { envios.push({ url: String(url), o, body: JSON.parse(o.body) }); return { ok: true, status: 200, json: async () => ({ events_received: 1 }) }; }; });
  afterEach(() => { globalThis.fetch = original; });

  it('normaliza el teléfono a 57 + 10 dígitos y el correo en minúsculas, ambos en hash', async () => {
    assert.equal(capi.telefono('311 575 2334'), '573115752334');
    assert.equal(capi.telefono('+57 311 575 2334'), '573115752334');
    assert.equal(capi.telefono('123'), '');
    await capi.enviarCompra({ config: CFG, referencia: 'MF-1', montoCentavos: 37980000, pedido: PEDIDO, meta: {} });
    const u = envios[0].body.data[0].user_data;
    assert.deepEqual(u.ph, [sha('573115752334')]); assert.deepEqual(u.em, [sha('ana@correo.com')]);
    assert.equal(JSON.stringify(envios[0].body).includes('Ana@'), false);
  });
  it('usa los datos de navegación del pedido y deduplica con el event_id del Pixel', async () => {
    await capi.enviarCompra({ config: CFG, referencia: 'MF-1', montoCentavos: 37980000, pedido: PEDIDO, meta: { ua: 'Mozilla/5.0', ip: '1.2.3.4', fbp: 'fb.1.2.3', fbc: 'fb.1.2.4' } });
    const e = envios[0].body.data[0];
    assert.equal(e.event_id, 'MF-1'); assert.equal(e.action_source, 'website');
    assert.equal(e.user_data.client_user_agent, 'Mozilla/5.0'); assert.equal(e.user_data.fbp, 'fb.1.2.3');
    assert.equal(e.custom_data.value, 379800); assert.equal(e.custom_data.currency, 'COP');
    assert.deepEqual(e.custom_data.contents, [{ id: 'plataforma-luna', quantity: 2, item_price: 189900 }]);
    assert.equal(envios[0].o.headers.Authorization, 'Bearer tok');
  });
  it('sin user agent no se declara "website"; sin credenciales no envía nada', async () => {
    await capi.enviarCompra({ config: CFG, referencia: 'MF-2', montoCentavos: 100, pedido: PEDIDO, meta: {} });
    assert.equal(envios[0].body.data[0].action_source, 'system_generated');
    envios.length = 0;
    assert.equal(await capi.enviarCompra({ config: { ...CFG, metaCapiToken: '' }, referencia: 'MF-3', montoCentavos: 100, pedido: PEDIDO }), false);
    assert.equal(envios.length, 0);
  });
});

describe('webhook + Meta CAPI', { skip: !hayDB && 'Falta TEST_DATABASE_URL' }, () => {
  let b;
  beforeEach(async () => { b = await iniciar(); await b.sembrar(PRODUCTOS_BASE); process.env.META_PIXEL_ID = '123'; process.env.META_CAPI_ACCESS_TOKEN = 'tok'; });
  afterEach(() => { delete process.env.META_PIXEL_ID; delete process.env.META_CAPI_ACCESS_TOKEN; b.terminar(); });

  async function pagar() {
    const r = await crearPedido({ method: 'POST', headers: { 'user-agent': 'UA-prueba', 'x-forwarded-for': '8.8.8.8' }, query: {}, body: { items: [{ id: 'plataforma-luna', talla: '36', cant: 1 }], cliente: CLIENTE_OK, consent_wa: true, meta: { fbp: 'fb.1.9.9' } } });
    assert.equal(r.status, 200);
    const ref = r.json.referencia, monto = Number((await b.pedido(ref)).monto_centavos);
    b.wompi.txs.set('tx-1', { id: 'tx-1', status: 'APPROVED', reference: ref, amount_in_cents: monto, currency: 'COP', payment_method_type: 'CARD' });
    return { ref, monto, res: await webhook({ method: 'POST', headers: {}, query: {}, body: eventoWompi({ id: 'tx-1', status: 'APPROVED', reference: ref, monto }) }) };
  }

  it('si Meta falla, el pago igual queda aprobado y el webhook responde 200', async () => {
    const { ref, res } = await pagar(); // el fetch de prueba lanza error para graph.facebook.com
    assert.equal(res.status, 200);
    assert.equal((await b.pedido(ref)).estado_pago, 'APPROVED');
    assert.equal((await b.filas(`select tipo from eventos where referencia='${ref}' and tipo='meta_purchase_error'`)).length, 1);
  });
  it('si Meta responde bien, envía la compra una vez con los datos guardados del pedido', async () => {
    const previo = globalThis.fetch, envios = [];
    globalThis.fetch = async (url, o) => { if (String(url).includes('graph.facebook.com')) { envios.push(JSON.parse(o.body)); return { ok: true, status: 200, json: async () => ({ events_received: 1 }) }; } return previo(url, o); };
    const { ref, res } = await pagar();
    globalThis.fetch = previo;
    assert.equal(res.status, 200); assert.equal(envios.length, 1);
    const e = envios[0].data[0];
    assert.equal(e.event_id, ref); assert.equal(e.user_data.client_user_agent, 'UA-prueba'); assert.equal(e.user_data.fbp, 'fb.1.9.9');
    assert.equal((await b.filas(`select tipo from eventos where referencia='${ref}' and tipo='meta_purchase_enviado'`)).length, 1);
    // El Registro del panel muestra con qué datos salió (sin datos personales ni credenciales)
    const det = (await b.filas(`select detalle from eventos where referencia='${ref}' and tipo='meta_purchase_enviado'`))[0].detalle;
    assert.equal(det.action_source, 'website'); assert.equal(det.con_agente_usuario, true); assert.equal(det.con_fbp, true);
    assert.ok(!JSON.stringify(det).includes('tok'));
  });
  it('sin credenciales de Meta, el pago queda aprobado y el Registro anota que se omitió', async () => {
    delete process.env.META_CAPI_ACCESS_TOKEN;
    const { ref, res } = await pagar();
    assert.equal(res.status, 200);
    assert.equal((await b.pedido(ref)).estado_pago, 'APPROVED');
    assert.equal((await b.filas(`select tipo from eventos where referencia='${ref}' and tipo='meta_purchase_omitido'`)).length, 1);
  });
});
