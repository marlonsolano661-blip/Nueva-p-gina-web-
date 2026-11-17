/* Fondo que se acomoda solo al video de cada look (copia de Shopify).
   Los videos traen su propio fondo de estudio (blanco, gris claro o rosado). Al abrir un look, la página
   toma ese mismo color y los bordes del video se difuminan, así el video se funde con la página.
   El color de cada video ya está medido (GUARDADO); para un video nuevo se mide del primer cuadro. */
(function () {
  var GUARDADO = { 'look-1': '#fefaff', 'verde': '#fbf4fc', 'celeste-tacon': '#f7ecf3', 'celeste': '#fbf9fb', 'beige': '#e7e6e4' };
  var css = document.createElement('style');
  css.textContent =
    'html,body,#lookView{transition:background-color .6s ease}' +
    '#photo{-webkit-mask-image:linear-gradient(to right,transparent,#000 7%,#000 93%,transparent),linear-gradient(to bottom,transparent,#000 6%,#000 98%,transparent);' +
    '-webkit-mask-composite:source-in;mask-image:linear-gradient(to right,transparent,#000 7%,#000 93%,transparent),linear-gradient(to bottom,transparent,#000 6%,#000 98%,transparent);mask-composite:intersect}';
  css.textContent += '.lhead{position:relative;z-index:3}#lstage{z-index:1}.lfoot{position:relative;z-index:4}';
  document.head.appendChild(css);

  function clave(src) {
    src = String(src || '');
    var ks = Object.keys(GUARDADO).sort(function (a, b) { return b.length - a.length; });
    for (var i = 0; i < ks.length; i++) if (new RegExp('vestidos[-/]' + ks[i] + '[.-]').test(src)) return ks[i];
    return '';
  }
  function medir(el) {
    try {
      var w = el.videoWidth || el.naturalWidth, h = el.videoHeight || el.naturalHeight;
      if (!w || !h) return '';
      var c = document.createElement('canvas'); c.width = 40; c.height = 40;
      var x = c.getContext('2d'); x.drawImage(el, 0, 0, 40, 40);
      var d = x.getImageData(0, 0, 40, 40).data, r = 0, g = 0, b = 0, n = 0;
      [[20, 1], [10, 1], [30, 1], [1, 12], [38, 12]].forEach(function (p) { var k = (p[1] * 40 + p[0]) * 4; r += d[k]; g += d[k + 1]; b += d[k + 2]; n++; });
      return 'rgb(' + Math.round(r / n) + ',' + Math.round(g / n) + ',' + Math.round(b / n) + ')';
    } catch (e) { return ''; } // imagen de otro dominio: no se puede medir
  }
  /* Color elegido en el panel (Look de MF Clóset → color de fondo). Se busca por el nombre del archivo del video:
     la dirección cambia según el dominio (dominio de la tienda o CDN de Shopify) pero el nombre no. */
  function nombre(u) { return String(u || '').split('?')[0].split('#')[0].split('/').pop(); }
  function deFondos(src) {
    var F = window.MF_FONDOS || {}, n = nombre(src);
    if (!n) return '';
    for (var k in F) if (nombre(k) === n) return F[k];
    return '';
  }
  function pintar(color) {
    document.documentElement.style.backgroundColor = color;
    document.body.style.backgroundColor = color;
    var lv = document.getElementById('lookView'); if (lv) lv.style.backgroundColor = color === '#fff' ? '' : color;
  }
  function revisar() {
    var lv = document.getElementById('lookView');
    if (!lv || !lv.classList.contains('on')) { pintar('#fff'); return; }
    var v = document.getElementById('lvideo'), im = document.getElementById('lphoto');
    var src = (v && (v.currentSrc || v.src)) || (im && im.src) || '';
    var color = deFondos(src) || GUARDADO[clave(src)] || (v && v.readyState >= 2 && medir(v)) || (im && im.complete && medir(im)) || '';
    if (color) pintar(color);
  }
  function iniciar() {
    var lv = document.getElementById('lookView'); if (!lv) return;
    new MutationObserver(revisar).observe(lv, { attributes: true, attributeFilter: ['class'] });
    var v = document.getElementById('lvideo'); if (v) { v.addEventListener('loadeddata', revisar); v.addEventListener('play', revisar); }
    var im = document.getElementById('lphoto'); if (im) im.addEventListener('load', revisar);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();
