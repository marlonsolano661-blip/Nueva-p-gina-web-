'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const S = require('../sugerir-color.js');

// Foto sintética w×h: fondo uniforme y un "zapato" de un color en el centro
function foto(fondo, zapato, w = 40, h = 40) {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const c = x > 10 && x < 30 && y > 12 && y < 34 ? zapato : fondo, i = (y * w + x) * 4;
    d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255;
  }
  return S.dominantes(d, w, h);
}
const BLANCO = [245, 245, 245];

describe('sugerencia de foto por color', () => {
  it('encuentra el color del producto ignorando el fondo', () => {
    const d = foto(BLANCO, [190, 20, 25]);
    assert.ok(S.distancia([192, 0, 0], d[0].rgb) < 15, JSON.stringify(d[0]));
  });
  it('asigna cada color a la foto que se le parece (sin repetir fotos)', () => {
    const fotos = [foto(BLANCO, [20, 20, 22]), foto(BLANCO, [190, 20, 25]), foto(BLANCO, [215, 195, 165])];
    const r = S.asignar(['#C00000', '#111111', '#D8C3A5'], fotos);
    assert.deepEqual(r, { 0: 1, 1: 0, 2: 2 });
  });
  it('no inventa: un color sin foto parecida queda sin sugerencia', () => {
    const fotos = [foto(BLANCO, [20, 20, 22]), foto(BLANCO, [190, 20, 25])];
    const r = S.asignar(['#111111', '#1F4FA3'], fotos); // el azul no se parece a ninguna foto
    assert.deepEqual(r, { 0: 0 });
  });
  it('una foto solo se usa una vez aunque dos colores se le parezcan', () => {
    const r = S.asignar(['#111111', '#14213D'], [foto(BLANCO, [20, 20, 22])]);
    assert.equal(Object.keys(r).length, 1);
  });
  it('fotos casi vacías o códigos inválidos no rompen nada', () => {
    assert.deepEqual(S.dominantes(new Uint8ClampedArray(4 * 4), 2, 2), []);
    assert.deepEqual(S.asignar(['no-es-color'], [foto(BLANCO, [20, 20, 22])]), {});
  });
});
