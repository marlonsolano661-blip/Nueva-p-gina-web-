'use strict';
// Pruebas de la validación de outfits (no necesitan base de datos).
const test = require('node:test');
const assert = require('node:assert/strict');
const { validar, paraTienda } = require('../lib/outfits');

const foto = 'https://x.supabase.co/storage/v1/object/public/productos/a.jpg';
const look = (o) => ({ id: 'o1', nombre: 'Jean clásico', producto: 'sandalia-miel-elite-mf', color: 'Negro', fotos: [{ e: 'Frente', url: foto }], piezas: [{ n: 'Camisa blanca' }], ...o });

test('acepta un look completo y limpia los textos', () => {
  const v = validar([look({ nombre: '  Noche <b>glam</b> ', piezas: [{ n: 'Vestido', foto }, { n: '' }] })]);
  assert.equal(v.error, undefined);
  assert.equal(v.valor[0].nombre, 'Noche bglam/b');
  assert.deepEqual(v.valor[0].piezas, [{ n: 'Vestido', foto }]);
  assert.equal(v.valor[0].visible, true);
});

test('exige nombre, tacón y al menos una foto', () => {
  assert.match(validar([look({ nombre: '' })]).error, /nombre/);
  assert.match(validar([look({ producto: '' })]).error, /tacón/);
  assert.match(validar([look({ fotos: [] })]).error, /foto/);
});

test('rechaza fotos que no son https ni del sitio', () => {
  assert.match(validar([look({ fotos: [{ url: 'javascript:alert(1)' }] })]).error, /inválida/);
  assert.match(validar([look({ fotos: [{ url: 'outfits-img/../index.html' }] })]).error, /inválida/);
  assert.equal(validar([look({ fotos: [{ url: 'outfits-img/negro-jean-frente.jpg' }] })]).error, undefined);
});

test('ids repetidos se renuevan y la tienda solo ve los visibles', () => {
  const v = validar([look(), look({ visible: false })]).valor;
  assert.notEqual(v[0].id, v[1].id);
  assert.equal(paraTienda(v).length, 1);
  assert.deepEqual(paraTienda(null), []);
});

test('prendas con punto de compra: link https, producto, precio y posición', () => {
  const v = validar([look({ piezas: [
    { n: 'Blusa negra', link: 'https://wa.me/573001234567?text=Blusa', precio: '89900', x: 48.26, y: '31' },
    { n: 'Falda', producto: 'falda-volantes', x: 150, y: 20 },
    { n: 'Bolso', precio: 'gratis', x: '', y: 5 },
  ] })]);
  assert.equal(v.error, undefined);
  assert.deepEqual(v.valor[0].piezas, [
    { n: 'Blusa negra', link: 'https://wa.me/573001234567?text=Blusa', precio: 89900, x: 48.3, y: 31 },
    { n: 'Falda', producto: 'falda-volantes' },
    { n: 'Bolso' },
  ]);
});

test('rechaza links que no son https', () => {
  assert.match(validar([look({ piezas: [{ n: 'Blusa', link: 'javascript:alert(1)' }] })]).error, /https/);
  assert.match(validar([look({ piezas: [{ n: 'Blusa', link: 'http://x.co' }] })]).error, /https/);
});
