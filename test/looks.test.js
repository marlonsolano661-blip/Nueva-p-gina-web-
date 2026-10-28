'use strict';
const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { hayDB, iniciar, PRODUCTOS_BASE, ENV_PRUEBA } = require('./helpers/backend');
const look = require('../lib/look');
const adminTienda = require('../lib/admin-tienda');
const catalogo = require('../lib/catalogo');

const JPG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(300, 7)]).toString('base64');
let n = 0;
const envio = (extra = {}) => look({ method: 'POST', headers: { 'x-forwarded-for': '9.9.' + (++n) + '.1' }, query: {}, body: { nombre: 'Ana M.', mensaje: 'Me encantaron', instagram: 'ana_m', autoriza: true, foto: 'data:image/jpeg;base64,' + JPG, web: '', ...extra } });
const H = { Authorization: 'Bearer ' + ENV_PRUEBA.ADMIN_TOKEN };
const adm = (body) => adminTienda({ method: 'POST', headers: H, query: {}, body });
const estado = () => adminTienda({ method: 'GET', headers: H, query: { recurso: 'looks' } });
const cat = () => catalogo({ method: 'GET', headers: {}, query: {} });

describe('comunidad (fotos de clientas)', { skip: !hayDB && 'Falta TEST_DATABASE_URL' }, () => {
  let b;
  beforeEach(async () => { b = await iniciar(); await b.sembrar(PRODUCTOS_BASE); });
  afterEach(() => b.terminar());

  it('valida el envío: autorización, nombre, foto JPG, Instagram y trampa de robots', async () => {
    assert.equal((await envio({ autoriza: false })).status, 400);
    assert.equal((await envio({ nombre: '  ' })).status, 400);
    assert.equal((await envio({ foto: '' })).status, 400);
    assert.equal((await envio({ foto: Buffer.from('no soy una foto').toString('base64') })).status, 400);
    assert.equal((await envio({ instagram: 'mal instagram!' })).status, 400);
    assert.equal((await envio({ web: 'http://spam' })).status, 400);
    assert.equal((await look({ method: 'GET', headers: {}, query: {} })).status, 405);
  });

  it('una foto enviada queda pendiente, no se publica, y el panel la ve', async () => {
    const r = await envio();
    assert.equal(r.status, 200);
    assert.equal(b.storage.objetos.size, 1);
    const e = await estado();
    assert.equal(e.status, 200);
    assert.equal(e.json.pendientes.length, 1);
    assert.equal(e.json.pendientes[0].n, 'Ana M.'); assert.equal(e.json.pendientes[0].ig, '@ana_m');
    assert.equal(e.json.publicados.length, 0);
    assert.equal((await cat()).json.contenido.looks, undefined);
  });

  it('aprobar publica en el catálogo (con correcciones) y ya no queda pendiente', async () => {
    await envio();
    const id = (await estado()).json.pendientes[0].id;
    const a = await adm({ recurso: 'look', accion: 'aprobar', id, n: 'Ana', t: 'Lindos', ig: '@ana' });
    assert.equal(a.status, 200); assert.equal(a.json.pendientes.length, 0); assert.equal(a.json.publicados.length, 1);
    const looks = (await cat()).json.contenido.looks;
    assert.equal(looks.length, 1); assert.equal(looks[0].n, 'Ana'); assert.equal(looks[0].t, 'Lindos'); assert.equal(looks[0].ig, '@ana');
    assert.ok(/^https:\/\//.test(looks[0].img) || /^http:\/\/127/.test(looks[0].img) || looks[0].img);
    assert.equal(looks[0].id, undefined);
    assert.equal((await adm({ recurso: 'look', accion: 'aprobar', id })).status, 400); // ya revisada
  });

  it('rechazar la quita de pendientes sin publicarla; quitar la retira de la tienda', async () => {
    await envio(); await envio({ nombre: 'Luz' });
    const p = (await estado()).json.pendientes;
    assert.equal(p.length, 2);
    assert.equal((await adm({ recurso: 'look', accion: 'rechazar', id: p[0].id })).json.publicados.length, 0);
    const ap = await adm({ recurso: 'look', accion: 'aprobar', id: p[1].id });
    assert.equal(ap.json.pendientes.length, 0); assert.equal(ap.json.publicados.length, 1);
    const q = await adm({ recurso: 'look', accion: 'quitar', id: p[1].id });
    assert.equal(q.json.publicados.length, 0);
    assert.equal((await cat()).json.contenido.looks, undefined);
  });

  it('sin la clave del panel no se puede ver ni decidir; ids y acciones inválidas se rechazan', async () => {
    await envio();
    assert.equal((await adminTienda({ method: 'GET', headers: {}, query: { recurso: 'looks' } })).status, 401);
    assert.equal((await adminTienda({ method: 'POST', headers: {}, query: {}, body: { recurso: 'look', accion: 'aprobar', id: 'x' } })).status, 401);
    assert.equal((await adm({ recurso: 'look', accion: 'aprobar', id: '../../etc' })).status, 400);
    const id = (await estado()).json.pendientes[0].id;
    assert.equal((await adm({ recurso: 'look', accion: 'borrar-todo', id })).status, 400);
  });

  it('frena envíos repetidos desde la misma IP', async () => {
    const mismo = () => look({ method: 'POST', headers: { 'x-forwarded-for': '7.7.7.7' }, query: {}, body: { nombre: 'A', autoriza: true, foto: JPG, web: '' } });
    const codigos = []; for (let i = 0; i < 5; i++) codigos.push((await mismo()).status);
    assert.deepEqual(codigos, [200, 200, 200, 429, 429]);
  });
});
