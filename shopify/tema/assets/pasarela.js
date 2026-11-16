/* Pasarela de looks en el inicio (solo en la copia de Shopify).
   Las modelos de cuerpo entero, una al lado de la otra: la del centro grande y las de los lados atenuadas.
   Al deslizar cambia el look; abajo salen las prendas de ese look (vestido + tacón MF) con precio, corazón y "+".
   El "+" abre la talla y agrega a la misma bolsa de la tienda (CART). Los looks salen de MF_VESTIDOS (vestidos/looks.js)
   y el precio, las tallas y las fotos se toman EN VIVO del catálogo (Shopify). Si algo falla, la tienda sigue igual. */
(function () {
  'use strict';
  if (window.__mfPasarela) return; window.__mfPasarela = 1;
  var app = document.getElementById('app');
  if (!app) return;

  var E = function (t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (m) { return '&#' + m.charCodeAt(0) + ';'; }); };
  var precio = function (n) { n = Number(n) || 0; return '$' + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.'); };
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var src = function (f) { return typeof f === 'string' ? f : (f && f.u) || ''; };

  function cat() { try { if (typeof catalog === 'function') return catalog() || []; } catch (e) { /* sin catálogo */ } return window.MF_CATALOGO_PRODUCTOS || []; }
  function prod(id) { return cat().filter(function (p) { return String(p.id) === String(id); })[0] || null; }

  /* Cada look: la modelo y sus prendas para comprar (solo las que existen en la tienda) */
  function looks() {
    var L = Array.isArray(window.MF_VESTIDOS) ? window.MF_VESTIDOS : [];
    return L.map(function (k, i) {
      var items = [];
      var v = k.prenda && k.prenda.venta;
      if (v) items.push({ id: v.id, n: v.n, color: v.color, img: k.prenda.frente, fondo: true, p: v.p });
      var t = k.tacon;
      if (t) {
        var pt = prod(t.id);
        items.push({ id: t.id, n: t.n, color: t.color, img: (pt && (pt.img || (pt.imgs || [])[0])) || src((t.fotos || [])[0]) || t.mini, p: t.p });
      }
      return { n: k.nombre, num: i + 1, foto: k.foto && (k.foto.src || k.foto.inicio), color: k.color, items: items };
    }).filter(function (k) { return k.foto; });
  }

  /* Mismo diseño de la tienda: blanco, Jost/Figtree, títulos en Cormorant, tarjetas y botones del catálogo; solo cambia la distribución */
  var css = [
    '.ps{background:#fff;margin:0 0 2.4rem;padding:1.6rem 0 1.2rem;overflow:hidden;color:#0a0a0a}',
    '.ps-hd{display:flex;align-items:flex-end;justify-content:space-between;gap:1rem;padding:0 1.1rem 1rem}',
    '.ps-k{display:block;font:500 .66rem/1 Jost,system-ui,sans-serif;letter-spacing:.3em;text-transform:uppercase;color:#767672;margin:0 0 .7rem}',
    '.ps-t{font:500 clamp(2.1rem,7vw,3.4rem)/.95 "Cormorant Garamond",Georgia,serif;letter-spacing:-.02em;margin:0;color:#0a0a0a}',
    '.ps-ar{display:flex;gap:.5rem;flex:none}.ps-ar button{width:2.6rem;height:2.6rem;border:1px solid #0a0a0a;border-radius:50%;background:#fff;color:#0a0a0a;display:grid;place-items:center;cursor:pointer;padding:0;transition:background .2s,color .2s}',
    '.ps-ar button:hover{background:#0a0a0a;color:#fff}.ps-ar svg{width:1.05rem;height:1.05rem;fill:none;stroke:currentColor;stroke-width:1.6}',
    '.ps-rail{display:flex;overflow-x:auto;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch;scrollbar-width:none;padding:0 21vw}',
    '.ps-rail::-webkit-scrollbar{display:none}',
    '.ps-lk{flex:0 0 58vw;max-width:360px;scroll-snap-align:center;border:0;background:none;padding:0 .25rem;cursor:pointer;transition:transform .45s cubic-bezier(.2,.8,.2,1),opacity .45s;transform:scale(.82);opacity:.4;transform-origin:50% 100%}',
    '.ps-lk.on{transform:scale(1);opacity:1}',
    '.ps-lk img{display:block;width:100%;aspect-ratio:9/16;object-fit:cover;background:#f4f4f2}',
    '.ps-cap{display:flex;justify-content:space-between;align-items:baseline;gap:1rem;padding:.9rem 1.1rem 0}',
    '.ps-nm{font:500 1.6rem/1 "Cormorant Garamond",Georgia,serif;font-style:italic;color:#0a0a0a}',
    '.ps-no{font:500 .66rem/1 Jost,system-ui,sans-serif;letter-spacing:.3em;text-transform:uppercase;color:#767672}',
    '.ps-bar{height:1px;background:#e6e6e3;margin:.7rem 1.1rem 0;position:relative}.ps-bar i{position:absolute;left:0;top:-1px;height:3px;background:#0a0a0a;transition:width .4s,left .4s}',
    '.ps-its{display:flex;gap:.7rem;overflow-x:auto;scrollbar-width:none;padding:1.2rem 1.1rem 0}.ps-its::-webkit-scrollbar{display:none}',
    '.ps-it{flex:0 0 44%;max-width:210px;animation:psIn .45s both}',
    '.ps-it .im{position:relative;display:block;width:100%;aspect-ratio:3/4;background:#fff;border:1px solid #efefef;overflow:hidden;padding:0;cursor:pointer}',
    '.ps-it .im img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;padding:6%}',
    '.ps-it .im img.cov{object-fit:cover;padding:0}',
    '.ps-it .cv-fav{position:absolute;right:.3rem;top:.3rem;width:2.3rem;height:2.3rem;display:grid;place-items:center;border:0;background:none;color:#111;cursor:pointer;padding:0;z-index:2}',
    '.ps-it .cv-fav svg{width:1.4rem;height:1.4rem;fill:none;stroke:currentColor;stroke-width:1.6;stroke-linejoin:round;filter:drop-shadow(0 0 2px #fff)}',
    '.ps-it .cv-fav[aria-pressed="true"] svg{fill:#111}',
    '.ps-it .cv-bag{position:absolute;right:.5rem;bottom:.5rem;width:2.4rem;height:2.4rem;display:grid;place-items:center;border:0;border-radius:50%;background:#fff;color:#000;box-shadow:0 1px 6px #0003;cursor:pointer;padding:0;z-index:2}',
    '.ps-it .cv-bag svg{width:1.1rem;height:1.1rem;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}',
    '.ps-it h3{font:600 .72rem/1.35 Figtree,Jost,system-ui,sans-serif;letter-spacing:.06em;text-transform:uppercase;color:#000;margin:.65rem 0 .2rem}',
    '.ps-it .pr{font:500 .9rem Figtree,Jost,system-ui,sans-serif;color:#000;margin:0}',
    '.ps-it .pr.no{font:500 .62rem Jost,sans-serif;letter-spacing:.2em;text-transform:uppercase;color:#767672}',
    '@keyframes psIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}',
    '.ps-sh{position:fixed;inset:0;z-index:300;display:flex;align-items:flex-end;background:rgba(10,10,10,.4);opacity:0;pointer-events:none;transition:opacity .25s}',
    '.ps-sh.on{opacity:1;pointer-events:auto}',
    '.ps-pn{width:100%;background:#fff;padding:1.4rem 1.2rem calc(1.3rem + env(safe-area-inset-bottom));transform:translateY(100%);transition:transform .3s cubic-bezier(.2,.8,.2,1)}',
    '.ps-sh.on .ps-pn{transform:none}',
    '.ps-pn .r{display:flex;justify-content:space-between;align-items:flex-start;gap:1rem}',
    '.ps-pn h3{margin:0;font:600 .85rem/1.35 Figtree,Jost,system-ui,sans-serif;letter-spacing:.06em;text-transform:uppercase}.ps-pn .p{font:500 .95rem Figtree,Jost,sans-serif;margin-top:.3rem}',
    '.ps-pn .x{border:0;background:none;font-size:1.6rem;line-height:1;cursor:pointer;padding:0 .2rem;color:#0a0a0a}',
    '.ps-pn .lb{font:500 .66rem/1 Jost,system-ui,sans-serif;letter-spacing:.3em;text-transform:uppercase;color:#767672;margin:1.2rem 0 .7rem}',
    '.ps-tl{display:flex;flex-wrap:wrap;gap:.45rem}.ps-tl button{min-width:2.9rem;height:2.9rem;border:1px solid #d9d9d6;background:#fff;font:500 .85rem Figtree,Jost,sans-serif;cursor:pointer;color:#0a0a0a}',
    '.ps-tl button[aria-pressed="true"]{border-color:#0a0a0a;background:#0a0a0a;color:#fff}.ps-tl button:disabled{color:#bbb;text-decoration:line-through;cursor:default}',
    '.ps-go{display:flex;align-items:center;justify-content:center;width:100%;margin-top:1.3rem;min-height:3.4rem;background:var(--mv,#0a0a0a);color:#fff;border:1px solid var(--mv,#0a0a0a);border-radius:0;font:400 .78rem Jost,sans-serif;letter-spacing:.3em;text-transform:uppercase;cursor:pointer}',
    '.ps-go:disabled{opacity:.35;cursor:default}',
    '@media(min-width:900px){.ps-rail{padding:0 calc(50% - 180px)}.ps-lk{flex-basis:360px}.ps-it{flex-basis:210px}.ps-hd,.ps-cap,.ps-its{padding-left:6vw;padding-right:6vw}.ps-bar{margin-left:6vw;margin-right:6vw}}',
    '[data-rnew="home"].ps-on #bns,[data-rnew="home"].ps-on #rh{display:none}',
    reduce ? '.ps-lk,.ps-it{transition:none;animation:none}' : ''
  ].join('\n');
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  var FL = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>', FR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>';
  var HEART = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.3s-7.6-4.6-9.2-9.4C1.7 7.5 3.9 4.6 7.1 4.6c2 0 3.6 1.1 4.9 2.9 1.3-1.8 2.9-2.9 4.9-2.9 3.2 0 5.4 2.9 4.3 6.3-1.6 4.8-9.2 9.4-9.2 9.4z"/></svg>';
  var BOLSA = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8h14l-1 12H6L5 8z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></svg>';
  var LK = [], cur = 0;

  function itemsHtml(k) {
    return k.items.map(function (it, i) {
      var p = prod(it.id), venta = !!(p && Number(p.price) > 0);
      var fav = window.mfFavs && window.mfFavs.tiene(it.id);
      return '<div class="ps-it" style="animation-delay:' + (i * 70) + 'ms">' +
        '<div class="im"><button type="button" data-ps-it="' + i + '" aria-label="' + E(it.n) + '" style="position:absolute;inset:0;border:0;background:none;padding:0;cursor:pointer"><img src="' + E(it.img) + '" alt="" loading="lazy" decoding="async"' + (it.fondo ? '' : ' class="cov"') + '></button>' +
        (venta ? '<button type="button" class="cv-fav" data-fav="' + E(it.id) + '" aria-pressed="' + !!fav + '" aria-label="Guardar en favoritos">' + HEART + '</button>' +
          '<button type="button" class="cv-bag" data-ps-it="' + i + '" aria-label="Agregar ' + E(it.n) + ' a la bolsa">' + BOLSA + '</button>' : '') + '</div>' +
        '<h3>' + E((p && p.name) || it.n) + '</h3>' + (venta ? '<p class="pr">' + precio(p.price) + '</p>' : '<p class="pr no">Muy pronto</p>') + '</div>';
    }).join('');
  }

  function html() {
    var looksH = LK.map(function (k, i) {
      return '<button type="button" class="ps-lk' + (i === cur ? ' on' : '') + '" data-ps-lk="' + i + '" aria-label="Look ' + k.num + ': ' + E(k.n) + '"><img src="' + E(k.foto) + '" alt="' + E(k.n) + '"' + (i > 1 ? ' loading="lazy"' : '') + ' decoding="async"></button>';
    }).join('');
    return '<section class="ps" id="pasarela" aria-label="Lookbook">' +
      '<div class="ps-hd"><div><span class="ps-k">Lookbook</span><h2 class="ps-t">Noche &amp; Día</h2></div>' +
      '<div class="ps-ar"><button type="button" data-ps-mv="-1" aria-label="Look anterior">' + FL + '</button><button type="button" data-ps-mv="1" aria-label="Look siguiente">' + FR + '</button></div></div>' +
      '<div class="ps-rail">' + looksH + '</div>' +
      '<div class="ps-cap"><span class="ps-nm"></span><span class="ps-no"></span></div><div class="ps-bar"><i></i></div>' +
      '<div class="ps-its"></div></section>';
  }

  function pintar(sec) {
    var k = LK[cur]; if (!k) return;
    [].forEach.call(sec.querySelectorAll('.ps-lk'), function (b, i) { b.classList.toggle('on', i === cur); });
    sec.querySelector('.ps-nm').textContent = k.n;
    sec.querySelector('.ps-no').textContent = 'Look ' + (k.num < 10 ? '0' : '') + k.num;
    var bar = sec.querySelector('.ps-bar i'); bar.style.width = (100 / LK.length) + '%'; bar.style.left = (cur * 100 / LK.length) + '%';
    sec.querySelector('.ps-its').innerHTML = itemsHtml(k);
  }

  function ir(sec, i, suave) {
    i = Math.max(0, Math.min(LK.length - 1, i));
    var rail = sec.querySelector('.ps-rail'), b = rail.children[i]; if (!b) return;
    rail.scrollTo({ left: b.offsetLeft - (rail.clientWidth - b.offsetWidth) / 2, behavior: suave && !reduce ? 'smooth' : 'auto' });
    if (i !== cur) { cur = i; pintar(sec); }
  }

  function motor(sec) {
    var rail = sec.querySelector('.ps-rail'), t = null;
    rail.addEventListener('scroll', function () {
      clearTimeout(t);
      t = setTimeout(function () {
        var c = rail.scrollLeft + rail.clientWidth / 2, best = 0, d = 1e9;
        [].forEach.call(rail.children, function (b, i) { var m = Math.abs(b.offsetLeft + b.offsetWidth / 2 - c); if (m < d) { d = m; best = i; } });
        if (best !== cur) { cur = best; pintar(sec); }
      }, 60);
    }, { passive: true });
    pintar(sec);
    requestAnimationFrame(function () { ir(sec, cur, false); });
  }

  /* ---- Hoja de talla ---- */
  var sh = null, sel = null, talla = '';
  function hoja(it) {
    var p = prod(it.id); if (!p) return;
    sel = { it: it, p: p }; talla = '';
    if (!sh) {
      sh = document.createElement('div'); sh.className = 'ps-sh'; sh.setAttribute('aria-hidden', 'true');
      sh.innerHTML = '<div class="ps-pn" role="dialog" aria-modal="true" aria-label="Elige tu talla"></div>';
      document.body.appendChild(sh);
      sh.addEventListener('click', function (e) {
        if (e.target === sh || e.target.closest('.x')) { cerrar(); return; }
        var tb = e.target.closest('[data-ps-t]');
        if (tb && !tb.disabled) { talla = tb.getAttribute('data-ps-t'); [].forEach.call(sh.querySelectorAll('[data-ps-t]'), function (x) { x.setAttribute('aria-pressed', String(x === tb)); }); sh.querySelector('.ps-go').disabled = false; return; }
        if (e.target.closest('.ps-go')) agregar();
      });
    }
    var stock = p.stock || {}, tallas = Object.keys(stock).length ? Object.keys(stock) : (p.tallas || []);
    var orden = function (a, b) { var x = parseFloat(a), y = parseFloat(b); return isNaN(x) || isNaN(y) ? 0 : x - y; };
    tallas = tallas.slice().sort(orden);
    var hay = function (t) { return Object.keys(stock).length ? Number(stock[t]) > 0 : (p.tallas || []).indexOf(t) >= 0; };
    sh.querySelector('.ps-pn').innerHTML = '<div class="r"><div><h3>' + E(p.name) + '</h3><div class="p">' + precio(p.price) + (it.color ? ' · ' + E(it.color) : '') + '</div></div><button type="button" class="x" aria-label="Cerrar">×</button></div>' +
      '<div class="lb">Talla</div><div class="ps-tl">' + tallas.map(function (t) { return '<button type="button" data-ps-t="' + E(t) + '" aria-pressed="false"' + (hay(t) ? '' : ' disabled') + '>' + E(t) + '</button>'; }).join('') + '</div>' +
      '<button type="button" class="ps-go" disabled>Agregar a la bolsa</button>';
    sh.classList.add('on'); sh.setAttribute('aria-hidden', 'false');
  }
  function cerrar() { if (sh) { sh.classList.remove('on'); sh.setAttribute('aria-hidden', 'true'); } }
  function agregar() {
    if (!sel || !talla) return;
    var p = sel.p, it = sel.it, color = '';
    var cs = Array.isArray(p.colors) ? p.colors : [];
    var c = it.color ? cs.filter(function (x) { return x && x.n && x.n.toLowerCase() === String(it.color).toLowerCase(); })[0] : null;
    if (c) color = c.n; else if (cs[0] && cs[0].n) color = cs[0].n;
    try {
      var ya = CART.filter(function (l) { return String(l.id) === String(p.id) && l.talla === talla && (l.color || '') === color; })[0];
      if (ya) ya.q += 1;
      else CART.push({ id: p.id, name: p.name, price: p.price, img: (c && c.img) || p.img, talla: talla, color: color, q: 1 });
      saveCart();
      var cnt = document.getElementById('cnt'); if (cnt) cnt.textContent = CART.reduce(function (s, l) { return s + l.q; }, 0);
      if (typeof renderBag === 'function') renderBag();
      if (typeof bagBump === 'function') bagBump();
      cerrar();
      if (typeof openBag === 'function') setTimeout(openBag, 250);
    } catch (e) { if (typeof toast === 'function') toast('No se pudo agregar, intenta de nuevo'); }
  }

  /* ---- Clics ---- */
  document.addEventListener('click', function (e) {
    var sec = document.getElementById('pasarela'); if (!sec || !sec.contains(e.target)) return;
    var mv = e.target.closest('[data-ps-mv]'); if (mv) { ir(sec, cur + Number(mv.getAttribute('data-ps-mv')), true); return; }
    var lk = e.target.closest('[data-ps-lk]'); if (lk) { ir(sec, Number(lk.getAttribute('data-ps-lk')), true); return; }
    var it = e.target.closest('[data-ps-it]');
    if (it) { var x = LK[cur] && LK[cur].items[Number(it.getAttribute('data-ps-it'))]; if (x) hoja(x); }
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') cerrar(); });

  /* ---- Montaje: arriba de todo en el inicio ---- */
  function montar() {
    var home = app.querySelector('[data-rnew="home"]');
    if (!home || home.querySelector('#pasarela')) return;
    if (!window.MF_API_OK) return; // espera el catálogo (precios y tallas reales)
    LK = looks(); if (!LK.length) return;
    if (cur >= LK.length) cur = 0;
    var tmp = document.createElement('div'); tmp.innerHTML = html();
    var sec = tmp.firstChild;
    home.insertBefore(sec, home.firstChild);
    home.classList.add('ps-on');
    motor(sec);
  }
  var pend = false;
  function programar() { if (pend) return; pend = true; requestAnimationFrame(function () { pend = false; try { montar(); } catch (e) { /* la tienda sigue igual */ } }); }
  new MutationObserver(programar).observe(app, { childList: true, subtree: true });
  try { montar(); } catch (e) { /* nada */ }
})();
