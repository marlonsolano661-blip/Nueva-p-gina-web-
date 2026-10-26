'use strict';
const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { hayDB, iniciar, eventoWompi, PRODUCTOS_BASE, CLIENTE_OK, ENV_PRUEBA } = require('./helpers/backend');
const crearPedido = require('../lib/crear-pedido');
const validar = require('../lib/validar-descuento');
const adminTienda = require('../lib/admin-tienda');
const catalogo = require('../lib/catalogo');
const webhook = require('../lib/webhook-wompi');
const descuentos = require('../lib/descuentos');

const post = (body, ip = '1.1.1.1') => crearPedido({ method: 'POST', headers: { 'x-forwarded-for': ip }, query: {}, body });
const prev = (body, ip = '2.2.2.2') => validar({ method: 'POST', headers: { 'x-forwarded-for': ip }, query: {}, body });
const admin = (body) => adminTienda({ method: 'POST', headers: { Authorization: 'Bearer ' + ENV_PRUEBA.ADMIN_TOKEN }, query: {}, body });
const items = [{ id: 'plataforma-luna', talla: '36', cant: 2 }];
const SUB = 189900 * 2, ENVIO = 17500;
const carrito = (extra = {}, email = 'ana@correo.com') => ({ items, cliente: { ...CLIENTE_OK, email }, consent_wa: false, meta: {}, ...extra });

describe('descuentos', { skip: !hayDB && 'Falta TEST_DATABASE_URL' }, () => {
  let b;
  beforeEach(async () => { b = await iniciar(); await b.sembrar(PRODUCTOS_BASE); });
  afterEach(() => b.terminar());
  const crear = (lista) => admin({ recurso: 'descuentos', descuentos: lista });

  it('el panel valida y guarda los códigos (mayúsculas, porcentaje 1–90, sin repetidos)', async () => {
    assert.equal((await crear([{ codigo: 'a b', pct: 10 }])).status, 400);
    assert.equal((await crear([{ codigo: 'BIEN', pct: 0 }])).status, 400);
    assert.equal((await crear([{ codigo: 'BIEN', pct: 91 }])).status, 400);
    assert.equal((await crear([{ codigo: 'BIEN', pct: 10 }, { codigo: 'bien', pct: 20 }])).status, 400);
    const r = await crear([{ codigo: ' bienvenida ', pct: 10, anuncio: true, nota: 'Primera compra' }]);
    assert.equal(r.status, 200);
    assert.deepEqual(r.json.descuentos[0], { codigo: 'BIENVENIDA', pct: 10, activo: true, anuncio: true, nota: 'Primera compra' });
    const sinClave = await adminTienda({ method: 'POST', headers: {}, query: {}, body: { recurso: 'descuentos', descuentos: [] } });
    assert.equal(sinClave.status, 401);
  });

  it('el pedido con código cobra el descuento solo sobre los productos y el envío completo', async () => {
    await crear([{ codigo: 'BIENVENIDA', pct: 10 }]);
    const d = Math.floor(SUB * 0.1), total = SUB - d + ENVIO;
    const r = await post(carrito({ codigo: 'bienvenida', total_esperado: total }));
    assert.equal(r.status, 200); assert.equal(r.json.descuento, d); assert.equal(r.json.total, total);
    assert.equal(new URL(r.json.url).searchParams.get('amount-in-cents'), String(total * 100));
    const p = await b.pedido(r.json.referencia);
    assert.equal(Number(p.monto_centavos), total * 100); assert.equal(Number(p.subtotal_centavos), (SUB - d) * 100); assert.equal(Number(p.envio_centavos), ENVIO * 100);
    assert.equal(p.meta.descuento_codigo, 'BIENVENIDA'); assert.equal(p.meta.descuento_pct, 10);
  });

  it('sin código el total no cambia; con total_esperado equivocado (sin descuento) avisa', async () => {
    await crear([{ codigo: 'BIENVENIDA', pct: 10 }]);
    const r = await post(carrito({ total_esperado: SUB - Math.floor(SUB * 0.1) + ENVIO }));
    assert.equal(r.status, 409);
    const ok = await post(carrito({ total_esperado: SUB + ENVIO }, 'otra@correo.com'));
    assert.equal(ok.status, 200); assert.equal(ok.json.descuento, 0); assert.equal(ok.json.total, SUB + ENVIO);
  });

  it('código inventado, apagado o mal escrito: se rechaza y no se crea pedido', async () => {
    await crear([{ codigo: 'APAGADO', pct: 20, activo: false }, { codigo: 'BIENVENIDA', pct: 10 }]);
    for (const codigo of ['NOEXISTE', 'APAGADO', "A';DROP", 'x']) {
      const r = await post(carrito({ codigo }));
      assert.equal(r.status, 400, codigo);
    }
    assert.equal((await b.filas('select count(*)::int n from pedidos'))[0].n, 0);
  });

  it('un uso por correo: un pedido pendiente reciente o aprobado bloquea; otro correo sí puede', async () => {
    await crear([{ codigo: 'BIENVENIDA', pct: 10 }]);
    const a = await post(carrito({ codigo: 'BIENVENIDA' }), '3.3.3.3');
    assert.equal(a.status, 200);
    const otra = await post(carrito({ codigo: 'BIENVENIDA', clave: 'clave-de-prueba-2' }, 'ANA@correo.com'), '3.3.3.4');
    assert.equal(otra.status, 400); assert.match(otra.json.error, /Ya usaste/);
    const distinto = await post(carrito({ codigo: 'BIENVENIDA', clave: 'clave-de-prueba-3' }, 'sofia@correo.com'), '3.3.3.5');
    assert.equal(distinto.status, 200);
    // un pedido pendiente de hace más de una hora ya no bloquea
    await b.psql(`update pedidos set creado_en = now() - interval '2 hours' where referencia = '${a.json.referencia}'`);
    const de_nuevo = await post(carrito({ codigo: 'BIENVENIDA', clave: 'clave-de-prueba-4' }), '3.3.3.6');
    assert.equal(de_nuevo.status, 200);
  });

  it('/api/descuento calcula con los precios de la base, no con lo que diga el navegador', async () => {
    await crear([{ codigo: 'BIENVENIDA', pct: 10 }]);
    const r = await prev({ codigo: 'bienvenida', items, subtotal: 1 });
    assert.equal(r.status, 200); assert.equal(r.json.ok, true); assert.equal(r.json.subtotal, SUB); assert.equal(r.json.descuento, Math.floor(SUB * 0.1));
    const malo = await prev({ codigo: 'nada', items });
    assert.equal(malo.json.ok, false);
    assert.equal((await prev({ codigo: 'BIENVENIDA', items: [] })).status, 400);
    assert.equal((await validar({ method: 'GET', headers: {}, query: {} })).status, 405);
  });

  it('/api/descuento frena los intentos repetidos de una misma IP', async () => {
    let ultimo;
    for (let i = 0; i < 25; i++) ultimo = await prev({ codigo: 'ADIVINA' + i, items }, '8.8.8.8');
    assert.equal(ultimo.status, 429);
  });

  it('el catálogo público solo publica el código marcado para anunciar', async () => {
    await crear([{ codigo: 'SECRETO', pct: 30 }, { codigo: 'VISIBLE', pct: 15, anuncio: true }]);
    const r = await catalogo({ method: 'GET', headers: {}, query: {} });
    assert.deepEqual(r.json.contenido.promo, { codigo: 'VISIBLE', pct: 15 });
    assert.ok(!JSON.stringify(r.json).includes('SECRETO'));
    await crear([{ codigo: 'SECRETO', pct: 30 }]);
    assert.equal((await catalogo({ method: 'GET', headers: {}, query: {} })).json.contenido.promo, undefined);
  });

  it('al pagar, el correo de confirmación muestra el descuento y el total cobrado', async () => {
    process.env.RESEND_API_KEY = 're_prueba'; process.env.MAIL_FROM = 'Tienda de prueba <correos@tienda-prueba.test>';
    await crear([{ codigo: 'BIENVENIDA', pct: 10 }]);
    const d = Math.floor(SUB * 0.1), total = SUB - d + ENVIO;
    const r = await post(carrito({ codigo: 'BIENVENIDA' }));
    const ref = r.json.referencia, monto = total * 100;
    b.wompi.txs.set('tx-d', { id: 'tx-d', status: 'APPROVED', reference: ref, amount_in_cents: monto, currency: 'COP', payment_method_type: 'CARD' });
    b.resend.enviados.length = 0;
    await webhook({ method: 'POST', headers: {}, query: {}, body: eventoWompi({ id: 'tx-d', status: 'APPROVED', reference: ref, monto }) });
    assert.equal((await b.pedido(ref)).estado_pago, 'APPROVED');
    const m = b.resend.enviados.find((x) => /Descuento/.test(x.html));
    assert.ok(m, 'el correo debe mostrar el descuento');
    assert.match(m.text, /Descuento: −\$/);
    assert.match(m.html, /Total pagado/);
  });

  it('calcular redondea hacia abajo en pesos enteros', () => {
    assert.equal(descuentos.calcular(333, 10), 33);
    assert.equal(descuentos.calcular(379800, 15), 56970);
  });
});
