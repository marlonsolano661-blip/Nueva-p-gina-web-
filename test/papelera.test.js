'use strict';
// Papelera del panel: lo reemplazado o eliminado se guarda y se puede restaurar; lo nuevo no queda "encima" de lo viejo.
const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { hayDB, iniciar, PRODUCTOS_BASE, ENV_PRUEBA } = require('./helpers/backend');
const adminTienda = require('../lib/admin-tienda');

const H = { Authorization: 'Bearer ' + ENV_PRUEBA.ADMIN_TOKEN };
const post = (body, headers = H) => adminTienda({ method: 'POST', headers, query: {}, body });
const get = (recurso) => adminTienda({ method: 'GET', headers: H, query: { recurso } });
const cuerpo = (r) => r.json;
const items = async () => cuerpo(await get('papelera')).papelera;
const prod = (extra = {}) => ({ id: 'plataforma-luna', nombre: 'Plataforma Luna', precio: 189900, stock: { 36: 3, 37: 2 }, ...extra });
const guardar = (p) => post({ recurso: 'producto', producto: p });

describe('papelera', { skip: !hayDB && 'Falta TEST_DATABASE_URL' }, () => {
  let b;
  beforeEach(async () => {
    b = await iniciar(); await b.sembrar(PRODUCTOS_BASE);
    for (const f of ['migracion-ventas-whatsapp.sql', 'migracion-gastos.sql']) await b.psql(fs.readFileSync(path.join(__dirname, '../supabase', f), 'utf8'));
  });
  afterEach(() => b.terminar());

  it('exige la clave del panel', async () => {
    assert.equal((await adminTienda({ method: 'GET', headers: {}, query: { recurso: 'papelera' } })).status, 401);
    assert.equal((await post({ recurso: 'papelera', accion: 'vaciar' }, {})).status, 401);
  });

  it('al editar un producto, la versión anterior queda en la papelera y la nueva queda activa', async () => {
    assert.equal((await guardar(prod({ precio: 250000 }))).status, 200);
    assert.equal(Number((await b.producto('plataforma-luna')).precio), 250000);
    const l = await items();
    assert.equal(l.length, 1);
    assert.deepEqual([l[0].tipo, l[0].motivo, l[0].ref], ['producto', 'reemplazado', 'plataforma-luna']);
    assert.equal(l[0].datos, undefined, 'la lista no manda los datos completos');
  });

  it('guardar sin cambiar nada no ensucia la papelera', async () => {
    await guardar(prod({ precio: 250000 }));
    await guardar(prod({ precio: 250000 }));
    assert.equal((await items()).length, 1);
  });

  it('restaurar devuelve la versión anterior y manda la actual a la papelera (se puede deshacer)', async () => {
    await guardar(prod({ precio: 250000 }));
    const id = (await items())[0].id;
    const r = await post({ recurso: 'papelera', accion: 'restaurar', id });
    assert.equal(r.status, 200);
    assert.equal(Number((await b.producto('plataforma-luna')).precio), 189900);
    const l = cuerpo(r).papelera;
    assert.equal(l.length, 1, 'la versión de 250.000 pasó a la papelera');
    await post({ recurso: 'papelera', accion: 'restaurar', id: l[0].id });
    assert.equal(Number((await b.producto('plataforma-luna')).precio), 250000);
  });

  it('eliminar un producto lo manda a la papelera y se puede restaurar completo', async () => {
    await guardar(prod({ descripcion: 'Con detalle', colores: [{ n: 'Negro', h: '#111111' }], imagenes: ['https://cdn.test/a.jpg'] }));
    await adminTienda({ method: 'POST', headers: H, query: {}, body: { recurso: 'producto', accion: 'eliminar', id: 'plataforma-luna' } });
    assert.equal(await b.producto('plataforma-luna'), undefined);
    const id = (await items()).find((e) => e.motivo === 'eliminado').id;
    assert.equal((await post({ recurso: 'papelera', accion: 'restaurar', id })).status, 200);
    const p = await b.producto('plataforma-luna');
    assert.equal(p.descripcion, 'Con detalle');
    assert.deepEqual(p.colores, [{ n: 'Negro', h: '#111111' }]);
  });

  it('eliminar un producto que no existe responde 404', async () => {
    assert.equal((await post({ recurso: 'producto', accion: 'eliminar', id: 'no-existe' })).status, 404);
  });

  it('envío, descuentos y banners también guardan lo anterior', async () => {
    await post({ recurso: 'envio', tarifa: 20000 });
    await post({ recurso: 'descuentos', descuentos: [{ codigo: 'AMIGA10', pct: 10, activo: true }] });
    await post({ recurso: 'descuentos', descuentos: [{ codigo: 'AMIGA20', pct: 20, activo: true }] });
    const l = await items();
    assert.deepEqual(l.map((e) => e.tipo).sort(), ['descuentos', 'envio']);
    const envio = l.find((e) => e.tipo === 'envio');
    assert.match(envio.nombre, /17\.500|17,500|17500/);
    await post({ recurso: 'papelera', accion: 'restaurar', id: envio.id });
    assert.equal(cuerpo(await get('envio')).tarifa, 17500);
  });

  it('un pedido de WhatsApp eliminado se puede restaurar', async () => {
    const v = { fecha: '2026-10-30', cliente: 'Laura', items: [{ nombre: 'Plataforma Luna', talla: '37', cant: 1, precio: 100000 }], envio: 0, descuento: 0, metodo_pago: 'Transferencia', estado_pago: 'PAGADO', estado_envio: 'PREPARANDO' };
    const c = cuerpo(await post({ recurso: 'venta_wa', accion: 'crear', venta: v }));
    await post({ recurso: 'venta_wa', accion: 'eliminar', id: c.venta.id });
    assert.equal((await b.filas('select * from ventas_whatsapp')).length, 0);
    const e = (await items()).find((x) => x.tipo === 'venta_wa');
    assert.ok(e);
    await post({ recurso: 'papelera', accion: 'restaurar', id: e.id });
    const f = await b.filas('select cliente, total from ventas_whatsapp');
    assert.deepEqual([f.length, f[0].cliente, Number(f[0].total)], [1, 'Laura', 100000]);
  });

  it('borrar definitivamente y vaciar', async () => {
    await guardar(prod({ precio: 1000 })); await guardar(prod({ precio: 2000 }));
    const l = await items(); assert.equal(l.length, 2);
    assert.equal(cuerpo(await post({ recurso: 'papelera', accion: 'eliminar', id: l[0].id })).papelera.length, 1);
    assert.equal(cuerpo(await post({ recurso: 'papelera', accion: 'vaciar' })).papelera.length, 0);
    assert.equal((await post({ recurso: 'papelera', accion: 'restaurar', id: 'zzz' })).status, 404);
  });

  it('guarda como máximo 60 elementos (los más viejos se descartan)', async () => {
    for (let i = 1; i <= 63; i++) await guardar(prod({ precio: 1000 + i }));
    assert.equal((await items()).length, 60);
  });
});
