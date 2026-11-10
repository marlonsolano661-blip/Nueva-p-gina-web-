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

/* Descripción corta del producto (se escribe en el panel): detalle del modelo y, en la segunda línea, la altura.
   Si un producto no tiene descripción, se muestra un renglón con las tallas y colores reales. */
(function () {
  'use strict';
  function tallasTxt(t) {
    var n = t.map(Number);
    if (n.length > 2 && n.every(function (x) { return isFinite(x); }) && n.every(function (x, i) { return !i || x === n[i - 1] + 1; })) return n[0] + ' a ' + n[n.length - 1];
    return t.join(' · ');
  }
  function renglon() {
    var pi = document.querySelector('#app .pd .pi'); if (!pi || pi.querySelector('.ds1')) return;
    var id = null; try { if (pg === 'prod') id = arg; } catch (e) { return; }
    if (id == null) return;
    var p = null; try { p = (catalog() || []).filter(function (x) { return String(x.id) === String(id); })[0]; } catch (e) { return; }
    if (!p) return;
    var el = document.createElement('p'); el.className = 'ds ds1';
    var lineas = String(p.desc || '').split(/\n+/).map(function (x) { return x.trim(); }).filter(Boolean);
    if (lineas.length) {
      // Descripción corta del panel: 1.ª línea = detalle del modelo, 2.ª línea = altura
      var d1 = document.createElement('span'); d1.textContent = lineas[0]; el.appendChild(d1);
      if (lineas[1]) { var d2 = document.createElement('b'); d2.textContent = lineas[1]; el.appendChild(d2); }
    } else {
      var t = p.tallas || [], c = (p.colors || []).map(function (k) { return k && k.n; }).filter(Boolean);
      el.textContent = [t.length ? 'Tallas ' + tallasTxt(t) : 'Agotado por ahora', c.join(', ')].filter(Boolean).join(' · ');
    }
    var viejo = pi.querySelector(':scope > p.ds'), precio = pi.querySelector(':scope > .pr');
    if (viejo) pi.replaceChild(el, viejo); else if (precio) precio.insertAdjacentElement('afterend', el);
  }
  // Ficha estilo EGO: color, "Talla" con la guía a la derecha, lista desplegable de tallas, un botón principal y formas de pago.
  function ego() {
    var pi = document.querySelector('#app .pd .pi'); if (!pi) return;
    var id = null; try { if (pg === 'prod') id = arg; } catch (e) { return; }
    if (id == null) return;
    var tl = pi.querySelector(':scope > .tl');
    if (tl && !pi.querySelector(':scope > .eg-sel')) {
      var lb = tl.previousElementSibling, gl = pi.querySelector(':scope > .gl');
      var fila = document.createElement('div'); fila.className = 'eg-sh';
      if (lb && lb.classList.contains('lb')) fila.appendChild(lb);
      if (gl) fila.appendChild(gl);
      pi.insertBefore(fila, tl);
      var bs = tl.querySelectorAll('.sz');
      if (bs.length) {
        var sel = document.createElement('select'); sel.className = 'eg-sel'; sel.setAttribute('aria-label', 'Elige tu talla');
        var o0 = document.createElement('option'); o0.value = ''; o0.textContent = 'Elige tu talla'; sel.appendChild(o0);
        Array.prototype.forEach.call(bs, function (x) { var o = document.createElement('option'); o.value = x.getAttribute('data-t'); o.textContent = 'Talla ' + x.getAttribute('data-t'); if (x.classList.contains('on')) o.selected = true; sel.appendChild(o); });
        sel.addEventListener('change', function () { var t = sel.value; Array.prototype.forEach.call(tl.querySelectorAll('.sz'), function (x) { if (x.getAttribute('data-t') === t && !x.classList.contains('on')) x.click(); }); });
        tl.insertAdjacentElement('afterend', sel); tl.classList.add('eg-oculto');
      }
    }
    var add = pi.querySelector(':scope > .row [data-n="add"]');
    if (add) { var ya = !!pi.querySelector('.tl .sz.on'), txt = ya ? 'Agregar a la bolsa' : 'Elige tu talla'; if (add.textContent !== txt) add.textContent = txt; add.classList.toggle('eg-falta', !ya); }
    // Barra de abajo (móvil) estilo EGO: nombre, precio, color (y talla elegida) y un botón grande a todo lo ancho.
    var stk = document.querySelector('#app .stk'), caja = stk && stk.firstElementChild;
    if (caja && caja.tagName === 'DIV') {
      stk.classList.add('eg-stk');
      var nm = ((pi.querySelector('h1') || {}).textContent || '').trim();
      var col = pi.querySelector(':scope > .lb .cn'); col = col && /^Color/.test(col.parentNode.textContent) ? col.textContent.trim() : '';
      var tSel = pi.querySelector('.tl .sz.on'); tSel = tSel ? tSel.getAttribute('data-t') : '';
      var tn = caja.querySelector('.eg-nm'); if (!tn) { tn = document.createElement('strong'); tn.className = 'eg-nm'; caja.insertBefore(tn, caja.firstChild); }
      if (tn.textContent !== nm) tn.textContent = nm;
      var sm = caja.querySelector('small');
      if (sm) {
        var linea = (col ? 'Color: ' + col : '') + (tSel ? (col ? '  ·  ' : '') + 'Talla ' + tSel : '');
        if (!linea) linea = 'Elige tu talla';
        if (sm.textContent !== linea) sm.textContent = linea;
      }
      var bb = stk.querySelector('[data-n="add"]');
      if (bb) { var tb = tSel ? 'Agregar a la bolsa' : 'Elige tu talla'; if (bb.textContent !== tb) bb.textContent = tb; }
    }
    var row = pi.querySelector(':scope > .row');
    if (row && !pi.querySelector(':scope > .eg-pay')) {
      var pay = document.createElement('div'); pay.className = 'eg-pay';
      pay.innerHTML = '<p>Formas de pago:</p><div><span class="eg-lg eg-nq" role="img" aria-label="Nequi"></span><span class="eg-lg eg-bc" role="img" aria-label="Bancolombia"></span><span class="eg-lg eg-vi" role="img" aria-label="Visa"></span><span class="eg-lg eg-mc" role="img" aria-label="Mastercard"></span><span class="eg-lg eg-ax" role="img" aria-label="American Express"></span></div>';
      row.insertAdjacentElement('afterend', pay);
    }
  }
  /* Barra de abajo del producto (móvil) estilo EGO: blanca, nombre + precio + color, botón verde del carrito a todo lo ancho */
  var egCss = [
    'html body #app .stk.eg-stk{display:block;padding:1.05rem 1.25rem calc(1rem + env(safe-area-inset-bottom,0px));background:#fff;color:#111;border-top:1px solid #e6e6e6;box-shadow:0 -8px 28px rgba(0,0,0,.08);-webkit-backdrop-filter:none;backdrop-filter:none}',
    'html body #app .stk.eg-stk>div{margin:0 0 .85rem}',
    'html body #app .stk.eg-stk .eg-nm{display:block;margin:0 0 .35rem;font:700 1.08rem/1.25 Figtree,system-ui,sans-serif;color:#111;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    'html body #app .stk.eg-stk b{display:block;font:700 1.2rem/1.2 Figtree,system-ui,sans-serif;letter-spacing:0;color:#111}',
    'html body #app .stk.eg-stk small{display:block;margin-top:.55rem;font:400 .98rem/1.3 Figtree,system-ui,sans-serif;letter-spacing:0;color:#555}',
    'html body #app .stk.eg-stk .btn{display:block;width:100%;max-width:none;min-height:3.5rem;margin:0;border:0;border-radius:0;background:#3a8273;color:#fff;font:700 1rem Figtree,system-ui,sans-serif;letter-spacing:.14em;text-transform:uppercase}',
    'html body #app .stk.eg-stk .btn:active{background:#2f6b5e}',
    '@media(max-width:799px){html body main:has(.stk.eg-stk){padding-bottom:12rem}}'
  ].join('\n');
  var egSt = document.createElement('style'); egSt.setAttribute('data-eg-barra', '1'); egSt.textContent = egCss; document.head.appendChild(egSt);
  var pend = false;
  function prog() { if (pend) return; pend = true; requestAnimationFrame(function () { pend = false; try { renglon(); } catch (e) { /* se deja la descripción original */ } try { ego(); } catch (e) { /* queda la ficha original */ } }); }
  function iniciar() { new MutationObserver(prog).observe(document.getElementById('app') || document.body, { childList: true, subtree: true }); prog(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();
