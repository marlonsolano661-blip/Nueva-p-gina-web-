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
    if (tl && !pi.querySelector(':scope > .eg-dd')) {
      var lb = tl.previousElementSibling, gl = pi.querySelector(':scope > .gl');
      if (!pi.querySelector(':scope > .eg-sh')) {
        var fila = document.createElement('div'); fila.className = 'eg-sh';
        if (lb && lb.classList.contains('lb')) fila.appendChild(lb);
        if (gl) fila.appendChild(gl);
        pi.insertBefore(fila, tl);
      }
      var bs = tl.querySelectorAll('.sz');
      if (bs.length) {
        // Lista de tallas estilo EGO: un recuadro "Elige tu talla" que al tocarlo despliega una talla por renglón
        var dd = document.createElement('div'); dd.className = 'eg-dd';
        var on = tl.querySelector('.sz.on');
        var hb = document.createElement('button'); hb.type = 'button'; hb.className = 'eg-sel'; hb.setAttribute('aria-expanded', 'false');
        hb.textContent = on ? 'Talla ' + on.getAttribute('data-t') : 'Elige tu talla';
        var ls = document.createElement('div'); ls.className = 'eg-dd-l'; ls.hidden = true; ls.setAttribute('role', 'listbox');
        Array.prototype.forEach.call(bs, function (x) {
          var t = x.getAttribute('data-t'), o = document.createElement('button'); o.type = 'button'; o.className = 'eg-dd-o' + (x.classList.contains('on') ? ' on' : ''); o.setAttribute('role', 'option'); o.textContent = 'Talla ' + t;
          o.addEventListener('click', function () { document.body.classList.remove('eg-dd-ab'); Array.prototype.forEach.call(tl.querySelectorAll('.sz'), function (z) { if (z.getAttribute('data-t') === t && !z.classList.contains('on')) z.click(); }); });
          ls.appendChild(o);
        });
        dd.abrir = function (si) { var ab = si == null ? ls.hidden : si; ls.hidden = !ab; dd.classList.toggle('ab', ab); hb.setAttribute('aria-expanded', ab ? 'true' : 'false'); document.body.classList.toggle('eg-dd-ab', ab); };
        hb.addEventListener('click', function () { dd.abrir(); });
        dd.appendChild(hb); dd.appendChild(ls);
        tl.insertAdjacentElement('afterend', dd); tl.classList.add('eg-oculto');
      }
    }
    if (!pi.querySelector('.eg-dd.ab')) document.body.classList.remove('eg-dd-ab');
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
  /* Barra de abajo del producto (móvil) estilo EGO: blanca, nombre + precio + color, botón a todo lo ancho.
     Botones de compra en el verde de EGO (#02836f) con letra blanca. */
  var egCss = [
    'html body #app .stk.eg-stk{display:block;padding:1.05rem 1.25rem calc(1rem + env(safe-area-inset-bottom,0px));background:#fff;color:#111;border-top:1px solid #e6e6e6;box-shadow:0 -8px 28px rgba(0,0,0,.08);-webkit-backdrop-filter:none;backdrop-filter:none}',
    'html body #app .stk.eg-stk>div{margin:0 0 .85rem}',
    'html body #app .stk.eg-stk .eg-nm{display:block;margin:0 0 .35rem;font:700 1.08rem/1.25 Figtree,system-ui,sans-serif;color:#111;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    'html body #app .stk.eg-stk b{display:block;font:700 1.2rem/1.2 Figtree,system-ui,sans-serif;letter-spacing:0;color:#111}',
    'html body #app .stk.eg-stk small{display:block;margin-top:.55rem;font:400 .98rem/1.3 Figtree,system-ui,sans-serif;letter-spacing:0;color:#555}',
    'html body #app .stk.eg-stk .btn{display:block;width:100%;max-width:none;min-height:3.5rem;margin:0;border:0;border-radius:0;background:#02836f;color:#fff;font:700 1rem Figtree,system-ui,sans-serif;letter-spacing:.14em;text-transform:uppercase}',
    'html body #app .stk.eg-stk .btn:active{background:#016a5a}',
    // Verde EGO en "Elige tu talla / Agregar a la bolsa" (ficha y barra de abajo), PAGAR y APLICAR de la bolsa
    'html body .btn[data-n="add"],html body .dr .drf .ml-par .btn,html body .dr .dcb .btn{background:#02836f!important;color:#fff!important;border:2px solid #02836f!important}',
    'html body .btn[data-n="add"]:hover,html body .dr .drf .ml-par .btn:hover,html body .dr .dcb .btn:hover,html body .btn[data-n="add"]:active,html body .dr .drf .ml-par .btn:active{background:#016a5a!important;border-color:#016a5a!important}',
    'html body #app .stk.eg-stk .btn{border:0!important}',
    'html body .btn.eg-carga[data-n="add"],html body .btn.eg-carga[data-n="add"]:active,html body .btn.eg-carga[data-n="add"]:hover{position:relative;color:transparent!important;background:#cdc7c8!important;border-color:#cdc7c8!important;pointer-events:none}',
    "html body .btn.eg-carga[data-n='add']::after{content:'';position:absolute;left:50%;top:50%;width:1.35rem;height:1.35rem;margin:-.7rem 0 0 -.7rem;border:2px solid #3a3a3a;border-top-color:transparent;border-radius:50%;animation:egGira .7s linear infinite}",
    '@keyframes egGira{to{transform:rotate(360deg)}}',
    'html body .eg-sel.eg-aviso{animation:egAviso 1.6s ease-out}',
    'html body .eg-dd .eg-sel{text-align:left;cursor:pointer}',
    "html body .eg-dd.ab .eg-sel{border-color:#111;background-image:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23111' stroke-width='1.8'%3E%3Cpath d='M6 15l6-6 6 6'/%3E%3C/svg%3E\")}",
    'html body .eg-dd-l{border:1px solid #cfcfcf;border-top:0;background:#fff}',
    'html body .eg-dd-o{display:flex;align-items:center;width:100%;height:3.4rem;padding:0 1.2rem;margin:0;border:0;border-bottom:1px solid #e3e3e3;border-radius:0;background:#fff;font:400 1.05rem Figtree,system-ui,sans-serif;color:#222;text-align:left;cursor:pointer}',
    'html body .eg-dd-o:last-child{border-bottom:0}',
    'html body .eg-dd-o.on{font-weight:600;color:#111}',
    'html body .eg-dd-o:active,html body .eg-dd-o:hover{background:#eef7f5}',
    'html body.eg-dd-ab #app .stk{transform:translateY(105%)!important}',
    '@keyframes egAviso{0%,40%{border-color:#02836f;box-shadow:0 0 0 4px rgba(2,131,111,.22)}100%{box-shadow:0 0 0 0 rgba(2,131,111,0)}}',
    '@media(max-width:799px){html body main:has(.stk.eg-stk){padding-bottom:12rem}}'
  ].join('\n');
  var egSt = document.createElement('style'); egSt.setAttribute('data-eg-barra', '1'); egSt.textContent = egCss; document.head.appendChild(egSt);
  // Botón "Elige tu talla / Agregar a la bolsa" como EGO: sin talla baja hasta las tallas y abre la lista; con talla, círculo cargando y se abre la bolsa.
  window.addEventListener('click', function (e) {
    var b = e.target && e.target.closest ? e.target.closest('.btn[data-n="add"]') : null; if (!b) return;
    var pi = document.querySelector('#app .pd .pi'); if (!pi) return;
    if (pi.querySelector('.tl .sz.on')) {
      // Con talla: como EGO, el botón muestra un círculo cargando y luego se abre la ventana de la bolsa
      e.preventDefault(); e.stopPropagation();
      if (b.classList.contains('eg-carga')) return;
      b.classList.add('eg-carga'); b.setAttribute('aria-busy', 'true');
      var pid = b.getAttribute('data-id');
      setTimeout(function () {
        var ok = false;
        try { ok = add(pid); } catch (x) { ok = false; }
        b.classList.remove('eg-carga'); b.removeAttribute('aria-busy');
        if (!ok) return;
        try { draw(); } catch (x) { /* nada */ }
        try { bagBump(); } catch (x) { /* nada */ }
        try { openBag(); } catch (x) { /* nada */ }
      }, 750);
      return;
    }
    var dd = pi.querySelector('.eg-dd'), sel = dd ? dd.querySelector('.eg-sel') : pi.querySelector('.tl'); if (!sel) return;
    e.preventDefault(); e.stopPropagation();
    if (dd && dd.abrir) dd.abrir(true);
    var hd = document.querySelector('header'), alto = hd ? hd.getBoundingClientRect().height : 0;
    var lbl = pi.querySelector('.eg-sh') || sel;
    window.scrollTo({ top: Math.max(0, lbl.getBoundingClientRect().top + window.pageYOffset - alto - 16), behavior: 'smooth' });
    sel.classList.remove('eg-aviso'); void sel.offsetWidth; sel.classList.add('eg-aviso');
  }, true);
  var pend = false;
  function prog() { if (pend) return; pend = true; requestAnimationFrame(function () { pend = false; try { renglon(); } catch (e) { /* se deja la descripción original */ } try { ego(); } catch (e) { /* queda la ficha original */ } }); }
  function iniciar() { new MutationObserver(prog).observe(document.getElementById('app') || document.body, { childList: true, subtree: true }); prog(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();

/* Bolsa estilo EGO: la cantidad en una lista "Cant. 1", el corazón (favoritos) y la caneca para quitar el producto.
   Reemplaza los botones − / + y el texto "Quitar"; usa la misma bolsa de la tienda (CART, saveCart y draw). */
(function () {
  'use strict';
  var IC_C = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" aria-hidden="true"><path d="M12 20.3s-7.6-4.5-7.6-10.2A4.3 4.3 0 0 1 12 7.5a4.3 4.3 0 0 1 7.6 2.6c0 5.7-7.6 10.2-7.6 10.2z"/></svg>';
  var IC_T = '<svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M9.5 7V4.6h5V7M6.4 7l1 13h9.2l1-13M10 11v5.5M14 11v5.5"/></svg>';
  var css = [
    'html body .bl .qs{display:none!important}',
    'html body .bl .bi>.rm{display:none!important}',
    'html body .eg-bq{margin-top:.15rem}',
    "html body .eg-cant{height:2.6rem;min-width:6.4rem;padding:0 2.3rem 0 .85rem;border:1px solid #cfcfcf;border-radius:0;background:#fff url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23111' stroke-width='1.8'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E\") no-repeat right .65rem center/1.05rem;font:400 .95rem Figtree,system-ui,sans-serif;color:#222;-webkit-appearance:none;appearance:none;cursor:pointer}",
    'html body .eg-cant:focus{outline:0;border-color:#111}',
    'html body .eg-acc{display:flex;gap:1rem;margin-top:.8rem}',
    'html body .eg-ic{display:inline-flex;align-items:center;justify-content:center;width:2.2rem;height:2.2rem;padding:0;border:0;border-radius:0;background:none;color:#111;cursor:pointer}',
    'html body .eg-ic:hover{color:#02836f}',
    'html body .eg-ic[aria-pressed="true"] svg{fill:#111}'
  ].join('\n');
  var st = document.createElement('style'); st.setAttribute('data-eg-bolsa', '1'); st.textContent = css; document.head.appendChild(st);
  function mejorar() {
    var cart; try { cart = CART; } catch (e) { return; }
    Array.prototype.forEach.call(document.querySelectorAll('.bl'), function (bl) {
      if (bl.querySelector('.eg-bq')) return;
      var rm = bl.querySelector('.bi>[data-n="rm"]'); if (!rm) return;
      var i = +rm.getAttribute('data-i'), l = cart[i]; if (!l) return;
      var box = document.createElement('div'); box.className = 'eg-bq';
      var sel = document.createElement('select'); sel.className = 'eg-cant'; sel.setAttribute('aria-label', 'Cantidad');
      for (var n = 1, max = Math.max(10, l.q); n <= max; n++) { var o = document.createElement('option'); o.value = String(n); o.textContent = 'Cant. ' + n; if (n === l.q) o.selected = true; sel.appendChild(o); }
      sel.addEventListener('change', function () { var x = CART[i]; if (!x) return; x.q = Math.max(1, parseInt(sel.value, 10) || 1); saveCart(); draw(); });
      var acc = document.createElement('div'); acc.className = 'eg-acc';
      var fav = document.createElement('button'); fav.type = 'button'; fav.className = 'eg-ic'; fav.setAttribute('data-fav', String(l.id)); fav.setAttribute('aria-label', 'Guardar en favoritos');
      fav.setAttribute('aria-pressed', String(!!(window.mfFavs && window.mfFavs.tiene(l.id)))); fav.innerHTML = IC_C;
      var tr = document.createElement('button'); tr.type = 'button'; tr.className = 'eg-ic'; tr.setAttribute('data-n', 'rm'); tr.setAttribute('data-i', String(i)); tr.setAttribute('aria-label', 'Quitar de la bolsa'); tr.innerHTML = IC_T;
      acc.appendChild(fav); acc.appendChild(tr); box.appendChild(sel); box.appendChild(acc);
      rm.insertAdjacentElement('beforebegin', box);
    });
  }
  var pend = false;
  function prog() { if (pend) return; pend = true; requestAnimationFrame(function () { pend = false; try { mejorar(); } catch (e) { /* queda la bolsa original */ } }); }
  function iniciar() { new MutationObserver(prog).observe(document.body, { childList: true, subtree: true }); prog(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();

/* Sin zoom en el celular: el iPhone amplía la página al tocar un campo con letra menor a 16 px (ej. "Código de descuento")
   y con doble toque. Se fija la escala, los campos van a 16 px y el doble toque ya no amplía. Pellizcar con dos dedos sigue igual. */
(function () {
  'use strict';
  try {
    var v = document.querySelector('meta[name="viewport"]');
    if (!v) { v = document.createElement('meta'); v.name = 'viewport'; document.head.appendChild(v); }
    var c = v.getAttribute('content') || 'width=device-width,initial-scale=1';
    if (!/maximum-scale/.test(c)) v.setAttribute('content', c + ',maximum-scale=1');
  } catch (e) { /* nada */ }
  var st = document.createElement('style'); st.setAttribute('data-sin-zoom', '1');
  st.textContent = 'html,body{touch-action:manipulation;-webkit-text-size-adjust:100%;text-size-adjust:100%}' +
    '@media(max-width:799px){html body input,html body select,html body textarea,html body .dr .drf .dcb input,html body .ck-sum .dcb input{font-size:16px!important}}';
  document.head.appendChild(st);
})();
