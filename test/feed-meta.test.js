'use strict';
const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { hayDB, iniciar, PRODUCTOS_BASE } = require('./helpers/backend');
const feed = require('../lib/feed-meta');

const SITE = 'https://tienda.test';
const P = (o) => ({ id: 'a-1', nombre: 'Sandalia "Luna"', precio: 189900, stock: { 36: 2 }, descripcion: '<b>Hola</b>\nmundo', imagen: 'https://img.test/a.jpg', imagenes: [], coleccion: 'Tacones', ...o });

describe('feed de catálogo para Meta (construcción)', () => {
  it('genera el CSV con los ids de la tienda, precio en COP y enlace directo', () => {
    const r = feed.construir([P()], SITE);
    const l = r.csv.trim().split('\r\n');
    assert.equal(l[0], feed.COLUMNAS.map((c) => '"' + c + '"').join(','));
    assert.equal(l[1], '"a-1","Sandalia ""Luna""","Hola mundo","in stock","new","189900 COP","https://tienda.test/?producto=a-1","https://img.test/a.jpg","Marlon Footwear","Tacones"');
    assert.equal(r.publicados, 1); assert.deepEqual(r.omitidos, []);
  });
  it('marca agotado sin exponer cantidades y completa fotos relativas con el sitio', () => {
    const r = feed.construir([P({ stock: { 36: 0 }, imagen: 'assets/x.jpg' })], SITE);
    assert.match(r.csv, /"out of stock"/); assert.match(r.csv, /"https:\/\/tienda\.test\/assets\/x\.jpg"/);
  });
  it('omite (sin inventar) los productos sin precio, sin foto o sin nombre, y lo informa', () => {
    const r = feed.construir([P({ id: 'sin-precio', precio: 0 }), P({ id: 'sin-foto', imagen: '', imagenes: [] }), P({ id: 'sin-nombre', nombre: ' ' }), P({ id: 'ok' })], SITE);
    assert.equal(r.publicados, 1);
    assert.deepEqual(r.omitidos.map((o) => o.id + ':' + o.motivo), ['sin-precio:sin precio', 'sin-foto:sin foto válida', 'sin-nombre:sin nombre']);
  });
});

describe('feed de catálogo para Meta (endpoint)', { skip: !hayDB && 'Falta TEST_DATABASE_URL' }, () => {
  let b;
  beforeEach(async () => { b = await iniciar(); await b.sembrar(PRODUCTOS_BASE); await b.psql("update productos set imagen='https://img.test/p.jpg'"); });
  afterEach(() => b.terminar());
  const get = (query = {}, method = 'GET') => feed({ method, headers: {}, query });

  it('entrega solo productos visibles, como CSV', async () => {
    const r = await get();
    assert.equal(r.status, 200); assert.match(r.tipo, /^text\/csv/);
    assert.match(r.text, /"plataforma-luna"/); assert.match(r.text, /"tacon-aurora"/);
    assert.doesNotMatch(r.text, /oculto/);
    assert.equal(r.headers['X-Productos'], '2');
  });
  it('?omitidos=1 lista lo que no se pudo publicar; solo acepta GET', async () => {
    await b.psql("update productos set imagen='' where id='tacon-aurora'");
    const r = await get({ omitidos: '1' });
    assert.deepEqual(JSON.parse(r.text).omitidos, [{ id: 'tacon-aurora', motivo: 'sin foto válida' }]);
    assert.equal((await get({}, 'POST')).status, 405);
  });
  it('sin SITE_URL responde 500 genérico', async () => {
    delete process.env.SITE_URL;
    const r = await get();
    assert.equal(r.status, 500); assert.doesNotMatch(r.text, /SITE_URL/);
  });
});
