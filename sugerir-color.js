/* Sugerencia de foto para cada color de un producto (solo propone; la persona revisa y guarda).
   Cálculo puro sobre píxeles: sirve en el navegador (panel) y en Node (pruebas). No inventa nada:
   si una foto no se parece claramente a ningún color, no sugiere. */
(function (raiz) {
  'use strict';
  function hexARgb(h) { var m = /^#?([0-9a-f]{6})$/i.exec(String(h || '')); if (!m) return null; var n = parseInt(m[1], 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
  function lab(rgb) {
    var c = rgb.map(function (v) { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    var x = (c[0] * 0.4124 + c[1] * 0.3576 + c[2] * 0.1805) / 0.95047, y = c[0] * 0.2126 + c[1] * 0.7152 + c[2] * 0.0722, z = (c[0] * 0.0193 + c[1] * 0.1192 + c[2] * 0.9505) / 1.08883;
    var f = function (t) { return t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116; };
    return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
  }
  function distancia(a, b) { var p = lab(a), q = lab(b); return Math.sqrt(Math.pow(p[0] - q[0], 2) + Math.pow(p[1] - q[1], 2) + Math.pow(p[2] - q[2], 2)); }
  // rgba: arreglo plano RGBA de una imagen w×h. Devuelve hasta 3 colores dominantes [{rgb, peso}] de la zona central, sin el fondo
  function dominantes(rgba, w, h) {
    var borde = [0, 0, 0], nb = 0, i, x, y, anillo = Math.max(1, Math.round(Math.min(w, h) * 0.08));
    for (y = 0; y < h; y++) for (x = 0; x < w; x++) {
      if (x >= anillo && x < w - anillo && y >= anillo && y < h - anillo) continue;
      i = (y * w + x) * 4; borde[0] += rgba[i]; borde[1] += rgba[i + 1]; borde[2] += rgba[i + 2]; nb++;
    }
    var fondo = nb ? [borde[0] / nb, borde[1] / nb, borde[2] / nb] : null, bins = {}, total = 0;
    var x0 = Math.round(w * 0.15), x1 = Math.round(w * 0.85), y0 = Math.round(h * 0.15), y1 = Math.round(h * 0.9);
    for (y = y0; y < y1; y++) for (x = x0; x < x1; x++) {
      i = (y * w + x) * 4; if (rgba[i + 3] < 128) continue;
      var r = rgba[i], g = rgba[i + 1], b = rgba[i + 2];
      if (fondo && Math.sqrt(Math.pow(r - fondo[0], 2) + Math.pow(g - fondo[1], 2) + Math.pow(b - fondo[2], 2)) < 32) continue;
      var k = (r >> 4) + ',' + (g >> 4) + ',' + (b >> 4);
      var e = bins[k] || (bins[k] = { n: 0, r: 0, g: 0, b: 0 }); e.n++; e.r += r; e.g += g; e.b += b; total++;
    }
    if (total < 20) return [];
    return Object.keys(bins).map(function (k) { var e = bins[k]; return { rgb: [e.r / e.n, e.g / e.n, e.b / e.n], peso: e.n / total }; })
      .sort(function (a, b) { return b.peso - a.peso; }).slice(0, 3).filter(function (d, j) { return j === 0 || d.peso >= 0.12; });
  }
  // colores: ['#RRGGBB', …]; fotos: [dominantes(...), …]; libres: índices de color a resolver. Devuelve {indiceColor: indiceFoto}
  function asignar(colores, fotos, opciones) {
    var umbral = (opciones && opciones.umbral) || 38, pares = [];
    colores.forEach(function (hx, ci) {
      var rgb = hexARgb(hx); if (!rgb) return;
      fotos.forEach(function (dom, fi) {
        if (!dom || !dom.length) return;
        var mejor = Infinity;
        dom.forEach(function (d, rango) { mejor = Math.min(mejor, distancia(rgb, d.rgb) + rango * 6); });
        if (mejor <= umbral) pares.push({ ci: ci, fi: fi, d: mejor });
      });
    });
    pares.sort(function (a, b) { return a.d - b.d; });
    var usadoC = {}, usadoF = {}, out = {};
    pares.forEach(function (p) { if (usadoC[p.ci] || usadoF[p.fi]) return; usadoC[p.ci] = usadoF[p.fi] = true; out[p.ci] = p.fi; });
    return out;
  }
  var api = { hexARgb: hexARgb, distancia: distancia, dominantes: dominantes, asignar: asignar };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else raiz.MFSugerirColor = api;
})(typeof window !== 'undefined' ? window : this);
