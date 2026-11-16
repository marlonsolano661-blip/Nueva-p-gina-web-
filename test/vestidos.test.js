'use strict';
// Pruebas de la validación de Vestidos (no necesitan base de datos).
const test = require('node:test');
const assert = require('node:assert/strict');
const { validar, paraTienda } = require('../lib/vestidos');

const U = 'https://x.supabase.co/storage/v1/object/public/productos/vestidos/';
const look = (o) => ({
  id: 'v1', nombre: 'Noche en negro', grupo: 'noche-glam', color: { n: 'Negro', h: '#151515' },
  prenda: { n: 'Noche glam', frente: U + 'f.webp', espalda: U + 'e.webp', w: 776, h: 1071, gancho: [388, 92],
    venta: { id: 'noche-glam', n: 'Noche glam', p: 169900, color: 'Negro', colores: ['Negro'], tallas: ['S', 'M'], agotadas: [], fotos: [{ u: U + 'f.webp', fit: 'contain' }] } },
  foto: { inicio: U + 'i.jpg', w: 1080, h: 1920, video: U + 'v.mp4', velocidad: 0.75, fin: 6.2, disparos: [3, 1] },
  encaje: { x: 46, y: 308, w: 996 }, puntoPrenda: [525, 770],
  tacon: { id: 'tacones-alessia-noir', n: 'Alessia', p: 210000, punto: [583, 1636], fotos: [{ v: U + 't.mp4' }, U + 'a.jpg'] },
  ...o,
});

test('acepta un look completo en el formato de la página', () => {
  const v = validar([look()]);
  assert.equal(v.error, undefined);
  const L = v.valor[0];
  assert.equal(L.foto.src, U + 'i.jpg');
  assert.deepEqual(L.foto.disparos, [1, 3]);
  assert.equal(L.foto.fin, 6.2);
  assert.deepEqual(L.tacon.fotos, [{ v: U + 't.mp4' }, U + 'a.jpg']);
  assert.equal(L.prenda.venta.id, 'noche-glam');
});

test('exige prenda, video, encaje y puntos', () => {
  assert.match(validar([look({ prenda: { w: 10 } })]).error, /frente/);
  assert.match(validar([look({ foto: { inicio: U + 'i.jpg', w: 1080, h: 1920 } })]).error, /video/);
  assert.match(validar([look({ encaje: {} })]).error, /Ubica/);
  assert.match(validar([look({ puntoPrenda: null })]).error, /punto del vestido/);
  assert.match(validar([look({ tacon: { id: 'x', punto: null } })]).error, /punto del tacón/);
});

test('rechaza enlaces peligrosos', () => {
  assert.match(validar([look({ foto: { inicio: 'javascript:alert(1)', w: 1080, h: 1920, video: U + 'v.mp4' } })]).error, /primer cuadro/);
  assert.match(validar([look({ foto: { inicio: U + 'i.jpg', w: 1080, h: 1920, video: 'vestidos/../x.mp4' } })]).error, /video/);
});

test('la tienda solo ve los visibles', () => {
  const v = validar([look(), look({ id: 'v2', visible: false })]).valor;
  assert.equal(paraTienda(v).length, 1);
});

test('guarda la cabina de tacones y descarta pruebas inválidas', () => {
  const v = validar([look({ pruebas: [{ id: 'sandalia-miel', n: 'Miel', p: 199900, img: U + 'p1.jpg' }, { id: 'x', img: 'javascript:1' }, { img: U + 'p2.jpg' }] })]);
  assert.equal(v.error, undefined);
  assert.equal(v.valor[0].pruebas.length, 1);
  assert.equal(v.valor[0].pruebas[0].img, U + 'p1.jpg');
});
