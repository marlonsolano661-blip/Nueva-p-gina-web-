'use strict';
const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { hayDB, iniciar, ENV_PRUEBA } = require('./helpers/backend');
const adminTienda = require('../lib/admin-tienda');
const ventas = require('../lib/ventas');

const AHORA = Date.parse('2026-10-30T15:00:00Z'); // 10:00 en Colombia
const BASE = { fecha: '2026-10-30', cliente: 'Laura Gómez', telefono: '+57 311 575 2334', ciudad: 'Cúcuta', items: [{ nombre: 'Plataforma Luna', talla: '37', color: 'Negro', cant: 2, precio: 189900 }], envio: 17500, descuento: 10000, metodo_pago: 'Nequi', estado_pago: 'PAGADO', estado_envio: 'PREPARANDO' };

describe('pedidos por WhatsApp: validación', () => {
  it('calcula el total en el servidor (productos + envío - descuento) e ignora el total que mande el navegador', () => {
    const v = ventas.validarVenta({ ...BASE, total: 1 }, AHORA);
    assert.equal(v.error, undefined);
    assert.equal(v.fila.total, 2 * 189900 + 17500 - 10000);
    assert.equal(v.fila.items[0].talla, '37');
  });
  it('usa valores por defecto razonables', () => {
    const v = ventas.validarVenta({ cliente: 'Ana', items: [{ nombre: 'Tacón', cant: 1, precio: 100000 }] }, AHORA);
    assert.deepEqual([v.fila.fecha, v.fila.envio, v.fila.descuento, v.fila.total, v.fila.metodo_pago, v.fila.estado_pago, v.fila.estado_envio], ['2026-10-30', 0, 0, 100000, 'Transferencia', 'PAGADO', 'PREPARANDO']);
  });
  it('rechaza datos inválidos con un mensaje claro', () => {
    const e = (x) => ventas.validarVenta({ ...BASE, ...x }, AHORA).error;
    assert.match(e({ cliente: ' ' }), /nombre/);
    assert.match(e({ items: [] }), /productos/);
    assert.match(e({ items: [{ nombre: 'X', cant: 0, precio: 1000 }] }), /Cantidad/);
    assert.match(e({ items: [{ nombre: 'X', cant: 1, precio: 0 }] }), /Precio/);
    assert.match(e({ items: [{ nombre: 'X', cant: 1, precio: 1000.5 }] }), /Precio/);
    assert.match(e({ items: [{ nombre: '', cant: 1, precio: 1000 }] }), /nombre/);
    assert.match(e({ descuento: 999999999 }), /Descuento/);
    assert.match(e({ envio: -1 }), /Envío/);
    assert.match(e({ fecha: '2026-02-31' }), /Fecha/);
    assert.match(e({ fecha: '2026-12-01' }), /futura/);
    assert.match(e({ metodo_pago: 'Bitcoin' }), /Método/);
    assert.match(e({ estado_pago: 'LISTO' }), /pago/);
    assert.match(e({ estado_envio: 'VOLANDO' }), /envío/);
    assert.match(e({ telefono: 'abc' }), /Teléfono/);
    assert.match(e({ guia: '<script>' }), /Guía/);
  });
});

describe('finanzas: resumen', () => {
  const pedidos = [
    { referencia: 'MF-1', estado_envio: 'ENTREGADO', monto_centavos: 20740000, subtotal_centavos: 18990000, envio_centavos: 1750000, metodo: 'CARD', items: [{ nombre: 'Plataforma Luna', talla: '36', cant: 1, precio: 189900 }], cliente: { nombre: 'Ana Pérez', ciudad: 'Cali' }, creado_en: '2026-10-29T12:00:00Z', pagado_en: '2026-10-29T12:05:00Z' },
    // pagado el 1 de noviembre a las 02:00 en Colombia = 07:00 UTC; creado antes de la medianoche de Colombia
    { referencia: 'MF-2', estado_envio: 'PREPARANDO', monto_centavos: 18650000, subtotal_centavos: null, envio_centavos: 0, metodo: 'NEQUI', items: [{ nombre: 'Tacón Aurora', talla: '38', cant: 1, precio: 186500 }], cliente: { nombre: 'Sara' }, creado_en: '2026-10-31T23:00:00Z', pagado_en: '2026-11-01T02:00:00Z' },
    // 31 de octubre 23:30 en Colombia = 1 de noviembre 04:30 UTC → sigue siendo octubre
    { referencia: 'MF-3', estado_envio: 'PREPARANDO', monto_centavos: 10000000, subtotal_centavos: 8250000, envio_centavos: 1750000, metodo: 'CARD', items: [{ nombre: 'Tacón Aurora', talla: '36', cant: 1, precio: 82500 }], cliente: { nombre: 'Luz' }, creado_en: '2026-11-01T04:00:00Z', pagado_en: '2026-11-01T04:30:00Z' },
  ];
  const wa = [
    { id: 1, fecha: '2026-10-30', cliente: 'Laura', items: [{ nombre: 'Plataforma Luna', cant: 2, precio: 189900 }], envio: 17500, descuento: 10000, total: 387300, metodo_pago: 'Nequi', estado_pago: 'PAGADO', estado_envio: 'EN_CAMINO' },
    { id: 2, fecha: '2026-10-30', cliente: 'Marta', items: [{ nombre: 'Tacón Aurora', cant: 1, precio: 169900 }], envio: 0, descuento: 0, total: 169900, metodo_pago: 'Efectivo', estado_pago: 'PENDIENTE', estado_envio: 'PREPARANDO' },
    { id: 3, fecha: '2026-10-30', cliente: 'Eva', items: [{ nombre: 'Tacón Aurora', cant: 1, precio: 169900 }], envio: 0, descuento: 0, total: 169900, metodo_pago: 'Efectivo', estado_pago: 'CANCELADO', estado_envio: 'PREPARANDO' },
  ];

  it('suma tienda + WhatsApp pagados; lo pendiente va aparte y lo cancelado no cuenta', () => {
    const f = ventas.armarFinanzas(pedidos, wa, 'todos');
    assert.equal(f.resumen.n, 4);
    assert.equal(f.resumen.total, 207400 + 186500 + 100000 + 387300);
    assert.deepEqual(f.resumen.online, { n: 3, total: 207400 + 186500 + 100000 });
    assert.deepEqual(f.resumen.whatsapp, { n: 1, total: 387300 });
    assert.equal(f.resumen.pares, 1 + 1 + 1 + 2);
    assert.equal(f.resumen.envios_cobrados, 17500 + 0 + 17500 + 17500);
    assert.equal(f.resumen.descuentos, 10000);
    assert.deepEqual(f.resumen.por_cobrar, { n: 1, total: 169900 });
    assert.equal(f.resumen.ticket, Math.round((207400 + 186500 + 100000 + 387300) / 4));
  });
  it('el mes se cuenta con la fecha de Colombia, no la de UTC', () => {
    const f = ventas.armarFinanzas(pedidos, wa, 'todos');
    const m = Object.fromEntries(f.meses.map((x) => [x.mes, x]));
    assert.equal(m['2026-10'].n, 4); assert.equal(m['2026-11'], undefined);
    const oct = ventas.armarFinanzas(pedidos, wa, '2026-10');
    assert.deepEqual(oct.detalle.map((v) => v.referencia).sort(), ['MF-1', 'MF-2', 'MF-3', 'WA-1']);
    assert.equal(ventas.armarFinanzas(pedidos, wa, '2026-11').resumen.n, 0);
  });
  it('un pedido anterior sin subtotal guardado se muestra con su total y sin inventar envío', () => {
    const v = ventas.armarFinanzas(pedidos, [], 'todos').detalle.find((x) => x.referencia === 'MF-2');
    assert.deepEqual([v.subtotal, v.envio, v.total], [186500, 0, 186500]);
  });
  it('lista los productos más vendidos y un mes inválido equivale a todos', () => {
    const f = ventas.armarFinanzas(pedidos, wa, 'cualquier-cosa');
    assert.equal(f.mes, 'todos');
    assert.deepEqual(f.top[0], { nombre: 'Plataforma Luna', cant: 3, total: 189900 * 3 });
  });
  it('sin ventas no divide por cero', () => {
    const f = ventas.armarFinanzas([], [], 'todos');
    assert.deepEqual([f.resumen.n, f.resumen.total, f.resumen.ticket], [0, 0, 0]);
  });
});

describe('pedidos por WhatsApp y finanzas en el servidor', { skip: !hayDB && 'Falta TEST_DATABASE_URL' }, () => {
  let b;
  beforeEach(async () => { b = await iniciar(); });
  afterEach(() => b.terminar());
  const H = { Authorization: 'Bearer ' + ENV_PRUEBA.ADMIN_TOKEN };
  const post = (body) => adminTienda({ method: 'POST', headers: H, query: {}, body });
  const get = (q) => adminTienda({ method: 'GET', headers: H, query: q });

  it('exige la clave del panel', async () => {
    assert.equal((await adminTienda({ method: 'GET', headers: {}, query: { recurso: 'ventas_wa' } })).status, 401);
    assert.equal((await adminTienda({ method: 'GET', headers: {}, query: { recurso: 'finanzas' } })).status, 401);
    assert.equal((await adminTienda({ method: 'POST', headers: {}, query: {}, body: { recurso: 'venta_wa', accion: 'crear', venta: BASE } })).status, 401);
  });

  it('crea, lista, edita y elimina un pedido de WhatsApp; guarda el total calculado y registra el evento', async () => {
    const r = await post({ recurso: 'venta_wa', accion: 'crear', venta: { ...BASE, fecha: ventas.hoyBogota() } });
    assert.equal(r.status, 200);
    assert.equal(Number(r.json.venta.total), 387300);
    const id = r.json.venta.id;
    assert.equal((await post({ recurso: 'venta_wa', accion: 'crear', venta: { ...BASE, cliente: '' } })).status, 400);

    let l = (await get({ recurso: 'ventas_wa' })).json.ventas;
    assert.equal(l.length, 1); assert.equal(l[0].cliente, 'Laura Gómez');
    assert.equal((await get({ recurso: 'ventas_wa', estado: 'por_cobrar' })).json.ventas.length, 0);

    const e = await post({ recurso: 'venta_wa', accion: 'actualizar', id, venta: { ...BASE, fecha: ventas.hoyBogota(), estado_pago: 'PENDIENTE', descuento: 0 } });
    assert.equal(e.status, 200); assert.equal(Number(e.json.venta.total), 397300);
    assert.equal((await get({ recurso: 'ventas_wa', estado: 'por_cobrar' })).json.ventas.length, 1);
    assert.equal((await post({ recurso: 'venta_wa', accion: 'actualizar', id: 9999, venta: BASE })).status, 404);

    const ev = await b.filas("select tipo, referencia from eventos where referencia = 'WA-" + id + "' order by id");
    assert.deepEqual(ev.map((x) => x.tipo), ['venta_wa_creada', 'venta_wa_actualizada']);

    assert.equal((await post({ recurso: 'venta_wa', accion: 'eliminar', id })).status, 200);
    assert.equal((await post({ recurso: 'venta_wa', accion: 'eliminar', id })).status, 404);
    assert.equal((await get({ recurso: 'ventas_wa' })).json.ventas.length, 0);
  });

  it('Finanzas junta los pedidos pagados de la tienda con los de WhatsApp pagados', async () => {
    await b.psql(`insert into pedidos (referencia, estado_pago, monto_centavos, subtotal_centavos, envio_centavos, items, cliente, pagado_en)
      values ('MF-PRUEBA-1', 'APPROVED', 20740000, 18990000, 1750000, '[{"nombre":"Plataforma Luna","talla":"36","cant":1,"precio":189900}]', '{"nombre":"Ana Pérez","ciudad":"Cali"}', now()),
             ('MF-PRUEBA-2', 'PENDING', 10000000, 8250000, 1750000, '[{"nombre":"X","talla":"36","cant":1,"precio":82500}]', '{"nombre":"No pagó"}', null)`);
    await post({ recurso: 'venta_wa', accion: 'crear', venta: { ...BASE, fecha: ventas.hoyBogota() } });
    const f = (await get({ recurso: 'finanzas' })).json;
    assert.equal(f.resumen.n, 2);
    assert.equal(f.resumen.total, 207400 + 387300);
    assert.deepEqual(f.detalle.map((v) => v.canal).sort(), ['Tienda online', 'WhatsApp']);
    assert.ok(!f.detalle.some((v) => v.referencia === 'MF-PRUEBA-2'));
  });

  it('si falta la tabla de WhatsApp lo dice claro; Finanzas sigue mostrando la tienda', async () => {
    await b.psql('drop table ventas_whatsapp');
    const l = await get({ recurso: 'ventas_wa' });
    assert.equal(l.status, 503); assert.match(l.json.error, /migracion-ventas-whatsapp\.sql/);
    assert.equal((await post({ recurso: 'venta_wa', accion: 'crear', venta: BASE })).status, 503);
    assert.equal((await get({ recurso: 'finanzas' })).status, 200);
  });

  it('la tabla no es accesible para el público (RLS)', async () => {
    const r = await b.psql("select has_table_privilege('anon', 'ventas_whatsapp', 'select')");
    assert.equal(r, 'f');
  });
});
