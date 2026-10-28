'use strict';
const { describe, it, before, after, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { hayDB, iniciar, PRODUCTOS_BASE, CLIENTE_OK, ENV_PRUEBA } = require('./helpers/backend');
const crearPedido = require('../lib/crear-pedido');

const post = (body, headers = {}) => crearPedido({ method: 'POST', headers, query: {}, body });
const carritoOk = () => ({ items: [{ id: 'plataforma-luna', talla: '36', cant: 2 }, { id: 'tacon-aurora', talla: '38', cant: 1 }], cliente: { ...CLIENTE_OK }, consent_wa: true, meta: { fbp: 'fb.1.x', fbc: '' } });

describe('crear-pedido', { skip: !hayDB && 'Falta TEST_DATABASE_URL' }, () => {
  let b;
  beforeEach(async () => { b = await iniciar(); await b.sembrar(PRODUCTOS_BASE); });
  afterEach(() => b.terminar());

  it('crea el pedido, calcula el total en el servidor y firma el checkout', async () => {
    const r = await post(carritoOk(), { 'user-agent': 'prueba', 'x-forwarded-for': '9.9.9.9' });
    assert.equal(r.status, 200);
    const url = new URL(r.json.url);
    assert.equal(url.origin + url.pathname, 'https://checkout.wompi.co/p/');
    const esperado = (189900 * 2 + 169900 + 17500) * 100; // productos + envío fijo de $17.500
    assert.equal(url.searchParams.get('amount-in-cents'), String(esperado));
    assert.equal(url.searchParams.get('currency'), 'COP');
    assert.equal(url.searchParams.get('public-key'), ENV_PRUEBA.WOMPI_PUBLIC_KEY);
    const ref = url.searchParams.get('reference');
    assert.equal(ref, r.json.referencia);
    assert.equal(url.searchParams.get('signature:integrity'), crypto.createHash('sha256').update(`${ref}${esperado}COP${ENV_PRUEBA.WOMPI_INTEGRITY_SECRET}`).digest('hex'));
    assert.equal(url.searchParams.get('redirect-url'), 'https://tienda.test/gracias.html');
    assert.equal(url.searchParams.get('customer-data:phone-number'), '3115752334');
    assert.equal(url.searchParams.get('customer-data:email'), 'ana@correo.com');

    const p = await b.pedido(ref);
    assert.equal(p.estado_pago, 'PENDING');
    assert.equal(Number(p.monto_centavos), esperado);
    assert.equal(p.consent_wa, true);
    assert.equal(p.meta.ip, '9.9.9.9');
    assert.equal(p.meta.event_id, ref);
    assert.deepEqual(p.items.map((i) => [i.id, i.talla, i.cant, i.precio]), [['plataforma-luna', '36', 2, 189900], ['tacon-aurora', '38', 1, 169900]]);
    assert.match(p.token, /^[a-f0-9]{32}$/);
    assert.equal(Number(p.subtotal_centavos), (189900 * 2 + 169900) * 100);
    assert.equal(Number(p.envio_centavos), 17500 * 100);
    assert.deepEqual([r.json.subtotal, r.json.envio, r.json.total], [189900 * 2 + 169900, 17500, esperado / 100]);
  });

  it('ignora precios o totales enviados por el navegador', async () => {
    const c = carritoOk();
    c.items[0].precio = 1; c.total = 1; c.precio = 1;
    const r = await post(c);
    assert.equal(r.status, 200);
    assert.equal(new URL(r.json.url).searchParams.get('amount-in-cents'), String((189900 * 2 + 169900 + 17500) * 100));
  });

  it('el permiso de WhatsApp solo es true si llega exactamente true', async () => {
    for (const v of [undefined, false, 'true', 1, 'on']) {
      const c = carritoOk(); c.consent_wa = v;
      const r = await post(c);
      assert.equal((await b.pedido(r.json.referencia)).consent_wa, false, 'valor ' + String(v));
    }
  });

  it('rechaza si no hay stock suficiente (409) y no crea pedido', async () => {
    const c = carritoOk(); c.items = [{ id: 'plataforma-luna', talla: '37', cant: 3 }];
    const r = await post(c);
    assert.equal(r.status, 409);
    assert.match(r.json.error, /Sin stock/);
    assert.equal((await b.filas('select * from pedidos')).length, 0);
  });

  it('una talla que no existe cuenta como sin stock', async () => {
    const c = carritoOk(); c.items = [{ id: 'plataforma-luna', talla: '40', cant: 1 }];
    assert.equal((await post(c)).status, 409);
  });

  it('fusiona líneas repetidas antes de comparar contra el stock', async () => {
    const c = carritoOk();
    c.items = [{ id: 'plataforma-luna', talla: '37', cant: 1 }, { id: 'plataforma-luna', talla: '37', cant: 2 }]; // 3 > stock 2
    assert.equal((await post(c)).status, 409);
    const ok = carritoOk();
    ok.items = [{ id: 'plataforma-luna', talla: '37', cant: 1 }, { id: 'plataforma-luna', talla: '37', cant: 1 }];
    const r = await post(ok);
    assert.equal(r.status, 200);
    const p = await b.pedido(r.json.referencia);
    assert.equal(p.items.length, 1);
    assert.equal(p.items[0].cant, 2);
  });

  it('rechaza productos inexistentes y productos ocultos', async () => {
    for (const id of ['no-existe', 'oculto']) {
      const c = carritoOk(); c.items = [{ id, talla: '36', cant: 1 }];
      assert.equal((await post(c)).status, 400, id);
    }
  });

  it('valida el carrito: vacío, cantidades raras, ids con caracteres peligrosos', async () => {
    const malos = [
      [], null, 'x', Array.from({ length: 21 }, () => ({ id: 'plataforma-luna', talla: '36', cant: 1 })),
      [{ id: 'plataforma-luna', talla: '36', cant: 0 }], [{ id: 'plataforma-luna', talla: '36', cant: 11 }],
      [{ id: 'plataforma-luna', talla: '36', cant: 1.5 }], [{ id: 'plataforma-luna', talla: '36', cant: -1 }],
      [{ id: 'plataforma-luna', talla: '36', cant: 'abc' }], [{ id: "x'; drop table pedidos;--", talla: '36', cant: 1 }],
      [{ id: 'a),(select', talla: '36', cant: 1 }], [{ id: 'plataforma-luna', talla: "36'", cant: 1 }],
      [null], [{ id: { a: 1 }, talla: '36', cant: 1 }],
      [{ id: 'plataforma-luna', talla: '36', cant: 6 }, { id: 'plataforma-luna', talla: '36', cant: 6 }],
    ];
    for (const items of malos) {
      const c = carritoOk(); c.items = items;
      const r = await post(c);
      assert.equal(r.status, 400, JSON.stringify(items).slice(0, 60));
    }
    assert.equal((await b.filas('select * from pedidos')).length, 0);
    assert.equal((await b.filas('select * from productos')).length, 3, 'la tabla productos sigue intacta');
  });

  it('valida los datos del cliente', async () => {
    const casos = [
      { tel: '12345' }, { tel: '2115752334' }, { tel: 'abc' }, { tel: '' }, { nombre: '' }, { nombre: '   ' },
      { direccion: '' }, { email: 'no-es-correo' },
    ];
    for (const parche of casos) {
      const c = carritoOk(); c.cliente = { ...CLIENTE_OK, ...parche };
      assert.equal((await post(c)).status, 400, JSON.stringify(parche));
    }
  });

  it('acepta celular con +57, espacios y guiones, y el correo es opcional', async () => {
    for (const tel of ['+57 311 575 2334', '57-3115752334', '311-575-2334']) {
      const c = carritoOk(); c.cliente = { ...CLIENTE_OK, tel, email: '' };
      const r = await post(c);
      assert.equal(r.status, 200, tel);
      const url = new URL(r.json.url);
      assert.equal(url.searchParams.get('customer-data:phone-number'), '3115752334');
      assert.equal(url.searchParams.has('customer-data:email'), false);
    }
  });

  it('recorta textos largos', async () => {
    const c = carritoOk(); c.cliente = { ...CLIENTE_OK, nombre: 'N'.repeat(500), nota: 'x'.repeat(5000) };
    const r = await post(c);
    const p = await b.pedido(r.json.referencia);
    assert.equal(p.cliente.nombre.length, 80);
    assert.equal(p.cliente.nota.length, 300);
  });

  it('solo acepta POST y cuerpo JSON válido', async () => {
    assert.equal((await crearPedido({ method: 'GET', headers: {}, query: {} })).status, 405);
    assert.equal((await crearPedido({ method: 'PUT', headers: {}, query: {}, body: {} })).status, 405);
    assert.equal((await crearPedido({ method: 'POST', headers: {}, query: {}, body: '{no es json' })).status, 400);
    assert.equal((await crearPedido({ method: 'POST', headers: {}, query: {}, body: JSON.stringify(carritoOk()) })).status, 200, 'cuerpo como texto JSON');
  });

  it('frena a una misma IP que crea demasiados pedidos seguidos (429)', async () => {
    const h = { 'x-forwarded-for': '7.7.7.7' };
    for (let i = 0; i < 8; i++) assert.equal((await post(carritoOk(), h)).status, 200, 'intento ' + (i + 1));
    assert.equal((await post(carritoOk(), h)).status, 429);
    assert.equal((await post(carritoOk(), { 'x-forwarded-for': '8.8.8.8' })).status, 200, 'otra IP no se ve afectada');
  });

  it('si falta una variable de entorno responde 500 genérico, sin filtrar detalles', async () => {
    delete process.env.WOMPI_INTEGRITY_SECRET;
    const r = await post(carritoOk());
    assert.equal(r.status, 500);
    assert.equal(JSON.stringify(r.json).includes('WOMPI'), false);
    assert.equal((await b.filas('select * from pedidos')).length, 0);
  });

  it('si Supabase falla responde 500 genérico', async () => {
    const f = globalThis.fetch;
    globalThis.fetch = async () => new Response('boom secreto', { status: 500 });
    const r = await post(carritoOk());
    globalThis.fetch = f;
    assert.equal(r.status, 500);
    assert.equal(JSON.stringify(r.json).includes('secreto'), false);
  });

  it('CORS: solo responde al origen permitido y a OPTIONS', async () => {
    process.env.ALLOWED_ORIGIN = 'https://otro.com';
    const ok = await crearPedido({ method: 'OPTIONS', headers: { Origin: 'https://otro.com' }, query: {} });
    assert.equal(ok.status, 204);
    assert.equal(ok.headers['Access-Control-Allow-Origin'], 'https://otro.com');
    const no = await crearPedido({ method: 'OPTIONS', headers: { Origin: 'https://malo.com' }, query: {} });
    assert.equal(no.headers['Access-Control-Allow-Origin'], undefined);
  });
});
