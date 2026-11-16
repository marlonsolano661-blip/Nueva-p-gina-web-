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

  var css = [
    '.ps{--ps-bg:#efede9;background:var(--ps-bg);margin:0 0 2.2rem;padding:1.1rem 0 1.4rem;overflow:hidden;font-family:Jost,system-ui,sans-serif;color:#141414}',
    '.ps-hd{display:flex;align-items:flex-end;justify-content:space-between;padding:0 1.1rem .6rem}',
    '.ps-k{display:block;font-size:.62rem;letter-spacing:.22em;text-transform:uppercase;color:#6d6a64}',
    '.ps-t{margin:.25rem 0 0;font:400 1.35rem/1.1 Georgia,"Times New Roman",serif;letter-spacing:.06em;text-transform:uppercase}',
    '.ps-ar{display:flex;gap:.4rem}.ps-ar button{width:2rem;height:2rem;border-radius:50%;border:1px solid #cfccc5;background:transparent;display:grid;place-items:center;cursor:pointer;color:#141414}',
    '.ps-ar svg{width:.9rem;height:.9rem;fill:none;stroke:currentColor;stroke-width:1.6}',
    '.ps-rail{display:flex;gap:0;overflow-x:auto;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch;scrollbar-width:none;padding:0 21vw}',
    '.ps-rail::-webkit-scrollbar{display:none}',
    '.ps-lk{flex:0 0 58vw;max-width:340px;scroll-snap-align:center;border:0;background:none;padding:0 .2rem;cursor:pointer;transition:transform .45s cubic-bezier(.2,.8,.2,1),opacity .45s;transform:scale(.8);opacity:.45;transform-origin:50% 100%}',
    '.ps-lk.on{transform:scale(1);opacity:1}',
    '.ps-lk img{display:block;width:100%;aspect-ratio:9/16;object-fit:cover;border-radius:2px;background:#e3e0da}',
    '.ps-cap{display:flex;justify-content:space-between;align-items:baseline;padding:.7rem 1.1rem 0}',
    '.ps-nm{font:italic 400 1.05rem Georgia,"Times New Roman",serif}.ps-no{font-size:.66rem;letter-spacing:.22em;text-transform:uppercase}',
    '.ps-bar{height:1px;background:#d6d3cc;margin:.55rem 1.1rem 0;position:relative}.ps-bar i{position:absolute;left:0;top:-.5px;height:2px;background:#141414;transition:width .4s,left .4s}',
    '.ps-its{display:flex;gap:.6rem;overflow-x:auto;scrollbar-width:none;padding:1rem 1.1rem 0}.ps-its::-webkit-scrollbar{display:none}',
    '.ps-it{flex:0 0 42%;max-width:190px;background:#fff;position:relative;text-align:left;animation:psIn .45s both}',
    '.ps-it .im{display:block;aspect-ratio:4/5;background:#f6f5f2;border:0;padding:0;width:100%;cursor:pointer}',
    '.ps-it .im img{width:100%;height:100%;object-fit:contain;mix-blend-mode:multiply;padding:8%}',
    '.ps-it .im img.cov{object-fit:cover;padding:0;mix-blend-mode:normal}',
    '.ps-it .fv{position:absolute;top:.35rem;right:.35rem;width:1.8rem;height:1.8rem;border:0;background:transparent;display:grid;place-items:center;cursor:pointer}',
    '.ps-it .fv svg{width:1.05rem;height:1.05rem;fill:none;stroke:#141414;stroke-width:1.5}.ps-it .fv[aria-pressed="true"] svg{fill:#141414}',
    '.ps-it .tx{display:flex;align-items:flex-end;justify-content:space-between;gap:.3rem;padding:.5rem .55rem .6rem}',
    '.ps-it .tx b{display:block;font-weight:400;font-size:.62rem;letter-spacing:.12em;text-transform:uppercase;line-height:1.3}',
    '.ps-it .tx span{display:block;font-size:.72rem;color:#55524c;margin-top:.15rem}',
    '.ps-it .mas{flex:none;width:1.7rem;height:1.7rem;border:1px solid #141414;border-radius:50%;background:#fff;font-size:1.05rem;line-height:1;cursor:pointer;display:grid;place-items:center}',
    '.ps-it .pr{font-size:.6rem;letter-spacing:.12em;text-transform:uppercase;color:#8a867e}',
    '@keyframes psIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}',
    '.ps-sh{position:fixed;inset:0;z-index:300;display:flex;align-items:flex-end;background:rgba(20,20,20,.35);opacity:0;pointer-events:none;transition:opacity .25s}',
    '.ps-sh.on{opacity:1;pointer-events:auto}',
    '.ps-pn{width:100%;background:#fff;padding:1.2rem 1.1rem calc(1.2rem + env(safe-area-inset-bottom));transform:translateY(100%);transition:transform .3s cubic-bezier(.2,.8,.2,1);font-family:Jost,system-ui,sans-serif}',
    '.ps-sh.on .ps-pn{transform:none}',
    '.ps-pn .r{display:flex;justify-content:space-between;align-items:flex-start;gap:1rem}',
    '.ps-pn h3{margin:0;font:400 1rem Georgia,serif}.ps-pn .p{font-size:.85rem;color:#55524c;margin-top:.2rem}',
    '.ps-pn .x{border:0;background:none;font-size:1.4rem;line-height:1;cursor:pointer;padding:0 .2rem}',
    '.ps-pn .lb{font-size:.62rem;letter-spacing:.2em;text-transform:uppercase;color:#6d6a64;margin:1rem 0 .5rem}',
    '.ps-tl{display:flex;flex-wrap:wrap;gap:.4rem}.ps-tl button{min-width:2.6rem;height:2.4rem;border:1px solid #d6d3cc;background:#fff;font:inherit;font-size:.85rem;cursor:pointer}',
    '.ps-tl button[aria-pressed="true"]{border-color:#141414;background:#141414;color:#fff}.ps-tl button:disabled{color:#bbb;text-decoration:line-through;cursor:default}',
    '.ps-go{display:block;width:100%;margin-top:1.1rem;height:3rem;border:0;background:#141414;color:#fff;font:inherit;font-size:.72rem;letter-spacing:.2em;text-transform:uppercase;cursor:pointer}',
    '.ps-go:disabled{background:#bdbab3}',
    '@media(min-width:900px){.ps-rail{padding:0 calc(50% - 170px)}.ps-lk{flex-basis:340px}.ps-it{flex-basis:200px}}',
    '[data-rnew="home"].ps-on #bns,[data-rnew="home"].ps-on #rh{display:none}',
    reduce ? '.ps-lk,.ps-it{transition:none;animation:none}' : ''
  ].join('\n');
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  var FL = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>', FR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>';
  var HEART = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>';
  var LK = [], cur = 0;

  function itemsHtml(k) {
    return k.items.map(function (it, i) {
      var p = prod(it.id), venta = !!(p && Number(p.price) > 0);
      var fav = window.mfFavs && window.mfFavs.tiene(it.id);
      return '<div class="ps-it" style="animation-delay:' + (i * 70) + 'ms">' +
        '<button type="button" class="im" data-ps-it="' + i + '" aria-label="' + E(it.n) + '"><img src="' + E(it.img) + '" alt="" loading="lazy" decoding="async"' + (it.fondo ? '' : ' class="cov"') + '></button>' +
        (venta ? '<button type="button" class="fv" data-fav="' + E(it.id) + '" aria-pressed="' + !!fav + '" aria-label="Guardar en favoritos">' + HEART + '</button>' : '') +
        '<div class="tx"><div><b>' + E((p && p.name) || it.n) + '</b>' + (venta ? '<span>' + precio(p.price) + '</span>' : '<span class="pr">Muy pronto</span>') + '</div>' +
        (venta ? '<button type="button" class="mas" data-ps-it="' + i + '" aria-label="Agregar ' + E(it.n) + '">+</button>' : '') + '</div></div>';
    }).join('');
  }

  function html() {
    var looksH = LK.map(function (k, i) {
      return '<button type="button" class="ps-lk' + (i === cur ? ' on' : '') + '" data-ps-lk="' + i + '" aria-label="Look ' + k.num + ': ' + E(k.n) + '"><img src="' + E(k.foto) + '" alt="' + E(k.n) + '"' + (i > 1 ? ' loading="lazy"' : '') + ' decoding="async"></button>';
    }).join('');
    return '<section class="ps" id="pasarela" aria-label="Lookbook">' +
      '<div class="ps-hd"><div><span class="ps-k">Marlon Footwear · Lookbook</span><h2 class="ps-t">Noche &amp; Día</h2></div>' +
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
