/* Galería del producto estilo Miss Lola: las fotos se deslizan con el dedo y abajo van puntitos.
   Usa las mismas fotos de las miniaturas (no cambia datos ni la lógica de la tienda). Si el producto tiene una sola foto, no hace nada. */
(function () {
  'use strict';
  var E = function (t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (m) { return '&#' + m.charCodeAt(0) + ';'; }); };
  var css = [
    '#app .gal.gsl-on>.im.big,#app .gal.gsl-on>.th{display:none!important}',
    '#app .gal.gsl-on{display:block}',
    '.gsl{position:relative;margin:0 auto}',
    '.gsl-t{display:flex;overflow-x:auto;scroll-snap-type:x mandatory;scrollbar-width:none;-webkit-overflow-scrolling:touch;overscroll-behavior-x:contain}',
    '.gsl-t::-webkit-scrollbar{display:none}',
    '.gsl-s{flex:0 0 100%;scroll-snap-align:center;aspect-ratio:4/5;background:#f6f6f6;overflow:hidden}',
    '.gsl-s img{display:block;width:100%;height:100%;object-fit:cover}',
    '.gsl-d{display:flex;justify-content:center;gap:.7rem;padding:1.1rem 0 .4rem}',
    '.gsl-d button{width:.62rem;height:.62rem;padding:0;border:0;border-radius:50%;background:#cfcfcf;cursor:pointer;transition:background .2s,transform .2s}',
    '.gsl-d button.on{background:#111;transform:scale(1.1)}',
    '.gsl-n{position:absolute;right:.8rem;top:.8rem;padding:.25rem .6rem;border-radius:999px;background:rgba(255,255,255,.85);font-size:.72rem;letter-spacing:.08em;color:#111}',
    '@media(min-width:900px){.gsl-s{aspect-ratio:1/1}}'
  ].join('\n');
  var st = document.createElement('style'); st.setAttribute('data-galeria', '1'); st.textContent = css; document.head.appendChild(st);

  function mejorar() {
    var gal = document.querySelector('#app .pd .gal'); if (!gal || gal.querySelector('.gsl')) return;
    var th = gal.querySelectorAll('.th img'); if (th.length < 2) return;
    var srcs = Array.prototype.map.call(th, function (i) { return i.getAttribute('src'); }).filter(Boolean);
    var nombre = ((document.querySelector('#app .pi h1') || {}).textContent || '').trim();
    var ini = 0; Array.prototype.forEach.call(gal.querySelectorAll('.th button'), function (b, i) { if (b.classList.contains('on')) ini = i; });
    var w = document.createElement('div'); w.className = 'gsl';
    w.innerHTML = '<div class="gsl-t">' + srcs.map(function (s, i) {
      return '<div class="gsl-s"><img src="' + E(s) + '" alt="' + E(nombre + ' · foto ' + (i + 1)) + '"' + (i ? ' loading="lazy"' : '') + ' decoding="async"></div>';
    }).join('') + '</div><span class="gsl-n" aria-hidden="true">1 / ' + srcs.length + '</span><div class="gsl-d">' + srcs.map(function (s, i) {
      return '<button type="button" aria-label="Ver foto ' + (i + 1) + '"></button>';
    }).join('') + '</div>';
    gal.insertBefore(w, gal.firstChild); gal.classList.add('gsl-on');
    var t = w.querySelector('.gsl-t'), d = w.querySelectorAll('.gsl-d button'), n = w.querySelector('.gsl-n');
    function marcar() {
      var i = Math.round(t.scrollLeft / Math.max(1, t.clientWidth));
      Array.prototype.forEach.call(d, function (b, k) { b.classList.toggle('on', k === i); b.setAttribute('aria-current', k === i ? 'true' : 'false'); });
      n.textContent = (i + 1) + ' / ' + srcs.length;
    }
    t.addEventListener('scroll', function () { window.requestAnimationFrame(marcar); }, { passive: true });
    Array.prototype.forEach.call(d, function (b, k) { b.addEventListener('click', function () { t.scrollTo({ left: k * t.clientWidth, behavior: 'smooth' }); }); });
    if (ini) t.scrollLeft = ini * t.clientWidth;
    marcar();
  }
  var pend = false;
  function programar() { if (pend) return; pend = true; requestAnimationFrame(function () { pend = false; try { mejorar(); } catch (e) { /* la galería original sigue */ } }); }
  function iniciar() { var app = document.getElementById('app') || document.body; new MutationObserver(programar).observe(app, { childList: true, subtree: true }); programar(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();
