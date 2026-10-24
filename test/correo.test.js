'use strict';
const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { hayDB, iniciar, eventoWompi, PRODUCTOS_BASE, CLIENTE_OK, ENV_PRUEBA } = require('./helpers/backend');
const crearPedido = require('../lib/crear-pedido');
const webhook = require('../lib/webhook-wompi');
const adminPedidos = require('../lib/admin-pedidos');

const admin = (body) => adminPedidos({ method: 'POST', headers: { Authorization: 'Bearer ' + ENV_PRUEBA.ADMIN_TOKEN }, query: {}, body });

describe('correos', { skip: !hayDB && 'Falta TEST_DATABASE_URL' }, () => {
  let b;
  beforeEach(async () => { b = await iniciar(); await b.sembrar(PRODUCTOS_BASE); process.env.RESEND_API_KEY = 're_prueba'; process.env.MAIL_FROM = 'Tienda de prueba <correos@tienda-prueba.test>'; process.env.OWNER_EMAIL = 'duena@tienda-prueba.test'; });
  afterEach(() => b.terminar());
  async function pedido() {
    const r = await crearPedido({ method: 'POST', headers: {}, query: {}, body: { items: [{ id: 'plataforma-luna', talla: '36', cant: 2 }], cliente: { ...CLIENTE_OK, nombre: 'Ana <b>Pérez</b>' }, consent_wa: true } });
    assert.equal(r.status, 200);
    return { ref: r.json.referencia, monto: Number((await b.pedido(r.json.referencia)).monto_centavos) };
  }
  const pagar = ({ ref, monto }, id = 'tx-1') => {
    b.wompi.txs.set(id, { id, status: 'APPROVED', reference: ref, amount_in_cents: monto, currency: 'COP', payment_method_type: 'CARD' });
    return webhook({ method: 'POST', headers: {}, query: {}, body: eventoWompi({ id, status: 'APPROVED', reference: ref, monto }) });
  };

  it('envía la confirmación al aprobarse el pago, con copia a la dueña y datos escapados', async () => {
    const p = await pedido();
    assert.equal((await pagar(p)).status, 200);
    assert.equal(b.resend.enviados.length, 2);
    const [c, d] = b.resend.enviados;
    assert.equal(c.auth, 'Bearer re_prueba');
    assert.deepEqual(c.to, [CLIENTE_OK.email]);
    assert.match(c.subject, new RegExp(p.ref));
    assert.match(c.html, /Plataforma Luna/);
    assert.ok(!c.html.includes('<b>Pérez'), 'debe escapar HTML del cliente');
    assert.match(c.html, new RegExp('https://tienda.test/gracias.html\\?t='));
    assert.deepEqual(d.to, ['duena@tienda-prueba.test']);
    assert.ok((await b.pedido(p.ref)).notificado.pago_correo);
  });
  it('un evento repetido no duplica el correo', async () => {
    const p = await pedido();
    await pagar(p); await pagar(p);
    assert.equal(b.resend.enviados.length, 2); // cliente + dueña, una sola vez
  });
  it('si Resend falla, el pago queda aprobado, responde 200 y el aviso se puede reintentar', async () => {
    const p = await pedido();
    b.resend.falla = true;
    assert.equal((await pagar(p)).status, 200);
    assert.equal((await b.pedido(p.ref)).estado_pago, 'APPROVED');
    assert.equal((await b.filas("select * from eventos where tipo='correo_fallo'")).length, 1);
    assert.equal((await b.pedido(p.ref)).notificado.pago_correo, undefined);
    b.resend.falla = false;
    assert.equal((await pagar(p)).status, 200); // Wompi reintenta
    assert.equal(b.resend.enviados.length, 2);
  });
  it('sin configurar Resend no envía nada y el pago funciona', async () => {
    delete process.env.RESEND_API_KEY;
    const p = await pedido();
    assert.equal((await pagar(p)).status, 200);
    assert.equal(b.resend.enviados.length, 0);
    assert.equal((await b.pedido(p.ref)).estado_pago, 'APPROVED');
  });
  it('no envía nada si el pago no está aprobado', async () => {
    const p = await pedido();
    const correo = require('../lib/correo');
    assert.equal(await correo.avisar({ db: 'https://supa.test', key: 'sb_secret_prueba' }, p.ref, 'pago'), 'no_aplica');
    assert.equal(b.resend.enviados.length, 0);
  });
  it('al marcar En camino con guía envía el aviso de envío una sola vez; reenviar_correo lo repite', async () => {
    const p = await pedido(); await pagar(p);
    const id = (await b.pedido(p.ref)).id;
    b.resend.enviados.length = 0;
    const r = await admin({ id, estado_envio: 'EN_CAMINO', transportadora: 'Servientrega', guia: 'GU123', link_rastreo: 'https://rastreo.test/GU123' });
    assert.equal(r.status, 200); assert.equal(r.json.correo, 'enviado');
    assert.equal(b.resend.enviados.length, 1);
    assert.match(b.resend.enviados[0].html, /GU123/);
    assert.match(b.resend.enviados[0].html, /https:\/\/rastreo\.test\/GU123/);
    assert.equal((await admin({ id, estado_envio: 'EN_CAMINO', transportadora: 'Servientrega', guia: 'GU123' })).json.correo, 'ya_enviado');
    assert.equal(b.resend.enviados.length, 1);
    assert.equal((await admin({ id, estado_envio: 'EN_CAMINO', transportadora: 'Servientrega', guia: 'GU999', reenviar_correo: true })).json.correo, 'enviado');
    assert.equal(b.resend.enviados.length, 2);
  });
  it('En camino sin ninguna guía ni transportadora no envía correo', async () => {
    const p = await pedido(); await pagar(p);
    const id = (await b.pedido(p.ref)).id; b.resend.enviados.length = 0;
    const r = await admin({ id, estado_envio: 'EN_CAMINO' });
    assert.equal(r.status, 200); assert.equal(r.json.correo, undefined);
    assert.equal(b.resend.enviados.length, 0);
  });
});
