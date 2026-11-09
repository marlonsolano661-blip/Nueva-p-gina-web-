/* Vitrina + movimiento de la tienda (inspirado en las tiendas "perchero" de moda):
   1) VITRINA en el inicio: los zapatos en fila sobre una repisa. Salen los productos de la lista MF_VITRINA
      (DATA/recortes.js), usando de cada uno su foto con FONDO BLANCO (se revisa el borde en el navegador). El riel se desliza con la
      física nativa del teléfono; el zapato del centro crece un poco al llegar. Abajo, una cinta que se desplaza.
   2) TRANSICIÓN: al tocar un zapato (vitrina o catálogo), su foto viaja hasta la ficha del producto mientras el
      resto de la página se desenfoca. Al volver ("← Colección"), hace el camino de regreso.
   3) CATÁLOGO en PC: al pasar el mouse por un modelo, ese se acerca y los demás se desenfocan.
   No cambia datos, precios, ids, carrito ni pagos: solo agrega una sección visual y envuelve la navegación existente.
   Si este archivo falla o no carga, la tienda funciona igual que antes. */
(function () {
  'use strict';
  if (window.__mfVitrina) return; window.__mfVitrina = 1;
  var app = document.getElementById('app');
  if (!app) return;

  var reduce = false, canHover = false;
  try { reduce = matchMedia('(prefers-reduced-motion: reduce)').matches; canHover = matchMedia('(hover: hover) and (pointer: fine)').matches; } catch (e) { /* sin matchMedia */ }
  var VT = !reduce && typeof document.startViewTransition === 'function';
  var E = function (t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (m) { return '&#' + m.charCodeAt(0) + ';'; }); };
  var money = function (n) { return '$' + Math.round(Number(n) || 0).toLocaleString('es-CO'); };
  var EASE = 'cubic-bezier(.22,.9,.24,1)';

  var css = [
    /* ---------- Vitrina: riel que se desliza de forma natural (inercia propia del teléfono) ---------- */
    '.vt{position:relative;padding:3.4rem 0 0;background:#fff;overflow:hidden}',
    '.vt-hd{max-width:1240px;margin:0 auto .6rem;padding:0 1.25rem;display:flex;align-items:flex-end;justify-content:space-between;gap:1rem}',
    '.vt-k{display:block;font:500 .66rem/1 Jost,system-ui,sans-serif;letter-spacing:.3em;text-transform:uppercase;color:#767672;margin:0 0 .7rem}',
    '.vt-hd h2{font:500 clamp(2.1rem,7vw,3.4rem)/.95 "Cormorant Garamond",Georgia,serif;letter-spacing:-.02em;margin:0;color:#0a0a0a}',
    '.vt-hint{font:400 .78rem/1.3 Jost,system-ui,sans-serif;color:#767672;margin:0;text-align:right;max-width:11rem}',
    '.vt-stage{position:relative}',
    '.vt-rail{--w:64vw;position:relative;z-index:1;display:flex;align-items:flex-end;gap:.6rem;overflow-x:auto;overflow-y:hidden;scroll-snap-type:x mandatory;scrollbar-width:none;-webkit-overflow-scrolling:touch;overscroll-behavior-x:contain;padding:1.6rem calc(50% - var(--w) / 2) 0}',
    '.vt-rail::-webkit-scrollbar{display:none}',
    '.vt-it{position:relative;flex:0 0 var(--w);scroll-snap-align:center;display:block;border:0;margin:0;padding:0 0 1.1rem;background:none;cursor:pointer;color:inherit;outline:none;-webkit-tap-highlight-color:transparent;user-select:none;-webkit-user-select:none}',
    '.vt *:focus:not(:focus-visible){outline:none}',
    /* la repisa: una línea continua bajo todos los zapatos */
    '.vt-stage::after{content:"";position:absolute;left:0;right:0;bottom:0;height:1px;background:#0a0a0a;pointer-events:none}',
    '.vt-in{display:block}',
    '.vt-fig{position:relative;display:block;aspect-ratio:1/1;transform-origin:50% 100%;will-change:transform,opacity}',
    /* fotos con fondo blanco: se funden con la página y el zapato queda "flotando" */
    '.vt-fig img{display:block;width:100%;height:100%;object-fit:contain;object-position:50% 100%;mix-blend-mode:multiply;pointer-events:none;-webkit-user-drag:none}',
    '.vt-tag{position:absolute;left:0;top:0;z-index:1;font:500 .58rem/1 Jost,system-ui,sans-serif;letter-spacing:.18em;text-transform:uppercase;background:#0a0a0a;color:#fff;padding:.38rem .5rem}',
    '.vt-ar{display:none}',
    /* nombre y precio del zapato del centro */
    '.vt-now{max-width:1240px;margin:0 auto;padding:1.3rem 1.25rem 0;min-height:7.2rem;text-align:center}',
    '.vt-now-in{display:flex;flex-direction:column;align-items:center;width:100%;text-align:center}',
    '.vt-now-in>b{display:block;width:100%;font:500 clamp(1.3rem,4.8vw,1.8rem)/1.15 "Cormorant Garamond",Georgia,serif;color:#0a0a0a;text-transform:none;text-align:center}',
    '.vt-now-in>i{display:block;width:100%;font:normal 400 .9rem/1.4 Jost,system-ui,sans-serif;color:#0a0a0a;margin:.35rem 0 .8rem;letter-spacing:.04em;text-align:center}',
    '.vt-go{display:inline-flex;align-items:center;gap:.5rem;min-height:2.75rem;padding:0 1.5rem;border:1px solid #0a0a0a;border-radius:999px;background:#0a0a0a;color:#fff;font:500 .7rem/1 Jost,system-ui,sans-serif;letter-spacing:.2em;text-transform:uppercase;cursor:pointer;-webkit-tap-highlight-color:transparent}',
    '.vt-go:hover{background:#fff;color:#0a0a0a}',
    /* cinta que se desplaza */
    '.vt-mq{margin-top:1.6rem;background:#0a0a0a;color:#fff;overflow:hidden;white-space:nowrap;padding:.9rem 0;border-top:3px solid #f7b6d2}',
    '.vt-mq-t{display:inline-flex;animation:vtMq 30s linear infinite;will-change:transform}',
    '.vt-mq span{font:500 .68rem/1 Jost,system-ui,sans-serif;letter-spacing:.32em;text-transform:uppercase;padding:0 1.4rem}',
    '.vt-mq i{font-style:normal;color:#f7b6d2}',
    '@keyframes vtMq{to{transform:translateX(-50%)}}',
    /* entrada suave al aparecer */
    '.vt.ready .vt-in{opacity:0;transform:translateY(1.2rem)}',
    '.vt.ready.in .vt-in{animation:vtUp .8s ' + EASE + ' both;animation-delay:calc(var(--i) * 60ms)}',
    '.vt.ready .vt-hd>*{opacity:0;transform:translateY(1rem)}',
    '.vt.ready.in .vt-hd>*{animation:vtUp .8s ' + EASE + ' both}.vt.ready.in .vt-hd>:nth-child(2){animation-delay:.12s}',
    '@keyframes vtUp{to{opacity:1;transform:none}}',
    '@media(min-width:800px){',
    '  .vt{padding-top:5rem}',
    '  .vt-hd{padding:0 2rem}',
    '  .vt-rail{--w:clamp(220px,22vw,300px);gap:1.2rem;scroll-snap-type:none;cursor:grab}',
    '  .vt-rail.drag{cursor:grabbing}',
    '  .vt-ar{display:grid;place-items:center;position:absolute;top:50%;z-index:3;width:3rem;height:3rem;margin-top:-1.5rem;border:1px solid #0a0a0a;border-radius:50%;background:#fff;color:#0a0a0a;cursor:pointer;transition:background .2s,color .2s}',
    '  .vt-ar:hover{background:#0a0a0a;color:#fff}',
    '  .vt-ar svg{width:1.1rem;height:1.1rem;fill:none;stroke:currentColor;stroke-width:1.6}',
    '  .vt-ar.p{left:max(1.5rem,calc(50vw - 600px))}.vt-ar.n{right:max(1.5rem,calc(50vw - 600px))}',
    '  .vt-it:focus-visible .vt-fig{outline:1px solid #0a0a0a;outline-offset:4px}',
    '}',
    '@media(prefers-reduced-motion:reduce){.vt-mq-t,.vt.ready.in .vt-in,.vt.ready.in .vt-hd>*{animation:none}.vt.ready .vt-in,.vt.ready .vt-hd>*{opacity:1;transform:none}}',

    /* ---------- Catálogo en PC: enfoque al pasar el mouse ---------- */
    '@media(hover:hover) and (pointer:fine) and (min-width:800px) and (prefers-reduced-motion:no-preference){',
    '  html body #gr .pc .im,html body #app .grid .pc .im{transition:filter .5s ease,opacity .5s ease,transform .8s ' + EASE + '}',
    '  html body #gr .pc .im img,html body #app .grid .pc .im img{transition:transform 1.1s ' + EASE + '}',
    '  html body #gr:has(.pc:hover) .pc:not(:hover) .im,html body #app .grid:has(.pc:hover) .pc:not(:hover) .im{filter:blur(2.5px) saturate(.6);opacity:.45;transform:scale(.97)}',
    '  html body #gr .pc:hover .im img,html body #app .grid .pc:hover .im img{transform:scale(1.07)}',
    '  html body #gr:has(.pc:hover) .pc:not(:hover) h3,html body #gr:has(.pc:hover) .pc:not(:hover) .pr{opacity:.45;transition:opacity .5s}',
    '}',

    /* ---------- Transición tarjeta → producto ---------- */
    'html.vt-morph header.bar{view-transition-name:vt-bar}',
    'html.vt-morph #app.pgin{animation:none}',
    'html.vt-morph .pd.fresh .im.big,html.vt-morph .pd.fresh .im.big img{animation:none}',
    '::view-transition-group(vt-bar){animation:none}',
    '::view-transition-group(vt-hero){animation-duration:.72s;animation-timing-function:' + EASE + ';z-index:5}',
    '::view-transition-old(vt-hero),::view-transition-new(vt-hero){height:100%;width:100%;object-fit:cover;animation-duration:.72s;animation-timing-function:' + EASE + '}',
    '::view-transition-old(root){animation:vtOut .5s ease both}',
    '::view-transition-new(root){animation:vtIn .6s .12s ' + EASE + ' both}',
    '@keyframes vtOut{to{opacity:0;filter:blur(10px);transform:scale(.985)}}',
    '@keyframes vtIn{from{opacity:0;filter:blur(10px)}}'
  ].join('\n');
  var st = document.createElement('style'); st.setAttribute('data-vitrina', '1'); st.textContent = css; document.head.appendChild(st);

  /* ================= Datos: solo fotos con fondo blanco ================= */
  function productos() {
    try { if (typeof catalog === 'function') return catalog() || []; } catch (e) { /* sin catálogo */ }
    return Array.isArray(window.MF_CATALOGO_PRODUCTOS) ? window.MF_CATALOGO_PRODUCTOS : [];
  }
  function recorte(p) { var R = window.MF_RECORTES || {}; return (p && (p.recorte || R[p.id])) || ''; }
  function agotado(p) { return Array.isArray(p.tallas) && !p.tallas.length; }
  function fotos(p) { var L = (p && p.imgs && p.imgs.length ? p.imgs : [p && p.img]).filter(Boolean); return L.slice(0, 5); }
  // Shopify entrega la foto al tamaño pedido: miniatura para revisar el fondo, mediana para mostrar.
  function tam(u, w) { return /cdn\.shopify\.com/.test(u) ? u + (u.indexOf('?') < 0 ? '?' : '&') + 'width=' + w : u; }

  // ¿La foto tiene fondo blanco? Se mira el borde de una miniatura: casi todo debe ser blanco (claro y sin color).
  var CK = 'mf_fondo_v1', memo = {};
  try { memo = JSON.parse(localStorage.getItem(CK)) || {}; } catch (e) { memo = {}; }
  function guardarMemo() { try { localStorage.setItem(CK, JSON.stringify(memo)); } catch (e) { /* sin espacio */ } }
  function esBlanca(u) {
    return new Promise(function (ok) {
      if (u in memo) { ok(memo[u]); return; }
      var im = new Image(); im.crossOrigin = 'anonymous'; im.decoding = 'async';
      var listo = false, t = setTimeout(function () { if (!listo) { listo = true; ok(false); } }, 6000);
      im.onload = function () {
        if (listo) return; listo = true; clearTimeout(t);
        try {
          var W = 48, H = Math.max(1, Math.round(48 * im.naturalHeight / im.naturalWidth));
          var c = document.createElement('canvas'); c.width = W; c.height = H;
          var x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(im, 0, 0, W, H);
          var px = x.getImageData(0, 0, W, H).data, n = 0, b = 0;
          var mira = function (i, j) { var o = (j * W + i) * 4, r = px[o], g = px[o + 1], bl = px[o + 2]; n++; if (Math.min(r, g, bl) >= 228 && Math.max(r, g, bl) - Math.min(r, g, bl) <= 18) b++; };
          for (var i = 0; i < W; i++) { mira(i, 0); mira(i, 1); mira(i, H - 1); mira(i, H - 2); }
          for (var j = 2; j < H - 2; j++) { mira(0, j); mira(1, j); mira(W - 1, j); mira(W - 2, j); }
          var si = b / n >= 0.86;
          memo[u] = si; ok(si);
        } catch (e) { ok(false); } // la foto no se pudo revisar: no entra
      };
      im.onerror = function () { if (!listo) { listo = true; clearTimeout(t); ok(false); } };
      im.src = tam(u, 96);
    });
  }

  // Lista elegida en el panel (Vitrina) si existe; si no, la de DATA/recortes.js (MF_VITRINA).
  function listaFija() {
    var c = window.MF_CONTENIDO && window.MF_CONTENIDO.vitrina;
    if (Array.isArray(c) && c.length) return c.map(String);
    return Array.isArray(window.MF_VITRINA) ? window.MF_VITRINA.map(String) : [];
  }
  // Arma la lista. Si el panel (o DATA/recortes.js) trae una lista, salen exactamente esos productos en ese orden
  // (de cada uno se usa el recorte sin fondo o su primera foto con fondo blanco; si no tiene, su primera foto).
  // Si no hay lista, la vitrina elige sola los productos con foto de fondo blanco.
  function elegir() {
    var P = productos(), fija = listaFija();
    var orden, max;
    if (fija.length) {
      orden = fija.map(function (id) { return P.filter(function (p) { return p && String(p.id) === id; })[0]; }).filter(Boolean);
      max = orden.length;
    } else {
      var all = P.filter(function (p) { return p && p.id != null && !agotado(p); });
      orden = all.filter(function (p) { return p.destacado; }).concat(all.filter(function (p) { return !p.destacado; })).slice(0, 40);
      max = 14;
    }
    return Promise.all(orden.map(function (p) {
      if (recorte(p)) return Promise.resolve({ p: p, src: recorte(p) });
      var L = fotos(p), k = 0;
      var prueba = function () {
        if (k >= L.length) return fija.length && L.length ? { p: p, src: tam(L[0], 700) } : null;
        var u = L[k++]; return esBlanca(u).then(function (si) { return si ? { p: p, src: tam(u, 700) } : prueba(); });
      };
      return Promise.resolve(prueba());
    })).then(function (r) { guardarMemo(); return r.filter(Boolean).slice(0, max); });
  }

  /* ================= Vitrina ================= */
  var MQ = ['Marlon Footwear', 'Ediciones limitadas', 'Envíos a toda Colombia', 'Pocas unidades por modelo', 'Nueva temporada'];
  var FL = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>', FR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>';
  function html(L) {
    var items = L.map(function (x, i) {
      var p = x.p;
      return '<button class="vt-it" type="button" role="listitem" style="--i:' + i + '" data-vt="' + E(p.id) + '" aria-label="' + E(p.name + ', ' + money(p.price)) + '">' +
        '<span class="vt-in"><span class="vt-fig"><img src="' + E(x.src) + '" alt="" draggable="false" ' + (i > 3 ? 'loading="lazy" ' : '') + 'decoding="async"></span></span></button>';
    }).join('');
    var t = MQ.map(function (x) { return '<span>' + E(x) + '</span><i aria-hidden="true">✦</i>'; }).join('');
    return '<section class="vt' + (reduce ? '' : ' ready') + '" id="vitrina" aria-label="La vitrina">' +
      '<div class="vt-hd"><div><span class="vt-k">Edición limitada</span><h2>La vitrina</h2></div>' +
      '<p class="vt-hint">' + (canHover ? 'Arrastra o usa las flechas' : 'Desliza para ver cada modelo') + '</p></div>' +
      '<div class="vt-stage"><button class="vt-ar p" type="button" aria-label="Modelo anterior">' + FL + '</button>' +
      '<div class="vt-rail" role="list">' + items + '</div>' +
      '<button class="vt-ar n" type="button" aria-label="Modelo siguiente">' + FR + '</button></div>' +
      '<div class="vt-now" aria-live="polite"><div class="vt-now-in"></div></div>' +
      '<div class="vt-mq" aria-hidden="true"><div class="vt-mq-t">' + t + t + '</div></div></section>';
  }

  function porId(id) { return productos().filter(function (p) { return String(p.id) === String(id); })[0] || null; }
  function cl(v, a, b) { return v < a ? a : v > b ? b : v; }

  // Movimiento: el riel se desliza con la física nativa del teléfono. Al moverse, cada zapato solo
  // cambia un poco de tamaño y de opacidad según su distancia al centro (sin giros ni desenfoques).
  function motor(sec) {
    var rail = sec.querySelector('.vt-rail'), box = sec.querySelector('.vt-now-in');
    var parts = [].map.call(rail.querySelectorAll('.vt-it'), function (it) { return { it: it, fig: it.querySelector('.vt-fig'), c: 0, w: 1, last: '' }; });
    var activo = -1, pend = false;

    function medir() { parts.forEach(function (o) { o.w = o.it.offsetWidth || 1; o.c = o.it.offsetLeft + o.w / 2; }); }
    function poner(i) {
      if (i === activo) return; activo = i;
      parts.forEach(function (o, k) { o.it.classList.toggle('on', k === i); });
      var p = porId(parts[i].it.getAttribute('data-vt'));
      box.innerHTML = p ? '<b>' + E(p.name) + '</b><i>' + money(p.price) + '</i><button class="vt-go" type="button" data-vt-go="' + E(p.id) + '">Ver modelo <span aria-hidden="true">→</span></button>' : '';
    }
    function cuadro() {
      pend = false;
      var mid = rail.scrollLeft + rail.clientWidth / 2, best = 0, bd = 1e9;
      parts.forEach(function (o, k) {
        var d = (o.c - mid) / o.w, a = Math.abs(d);
        if (a < bd) { bd = a; best = k; }
        var e = 1 - Math.min(a, 1); e = e * e * (3 - 2 * e);
        var tr = 'translate3d(0,' + (-8 * e).toFixed(1) + 'px,0) scale(' + (0.86 + 0.14 * e).toFixed(3) + ')', op = (0.5 + 0.5 * e).toFixed(3);
        if (tr + op !== o.last) { o.fig.style.transform = tr; o.fig.style.opacity = op; o.last = tr + op; }
      });
      poner(best);
    }
    function pedir() { if (!pend) { pend = true; requestAnimationFrame(cuadro); } }

    medir();
    var ini = parts[1] || parts[0];
    rail.scrollLeft = ini.c - rail.clientWidth / 2;
    cuadro();
    rail.addEventListener('scroll', pedir, { passive: true });
    addEventListener('resize', function () { medir(); pedir(); });

    function ir(i) { i = cl(i, 0, parts.length - 1); rail.scrollTo({ left: parts[i].c - rail.clientWidth / 2, behavior: reduce ? 'auto' : 'smooth' }); }
    sec.querySelector('.vt-ar.p').addEventListener('click', function () { ir(activo - 1); });
    sec.querySelector('.vt-ar.n').addEventListener('click', function () { ir(activo + 1); });
    rail.addEventListener('keydown', function (e) { if (e.key === 'ArrowLeft') { e.preventDefault(); ir(activo - 1); } else if (e.key === 'ArrowRight') { e.preventDefault(); ir(activo + 1); } });

    // PC: arrastrar con el mouse, con inercia al soltar
    var drag = null, movido = false, fin = 0;
    rail.addEventListener('pointerdown', function (e) {
      if (e.pointerType !== 'mouse' || e.button) return;
      drag = { x: e.clientX, s: rail.scrollLeft, v: 0, t: performance.now(), lx: e.clientX }; movido = false;
    });
    addEventListener('pointermove', function (e) {
      if (!drag) return;
      var dx = e.clientX - drag.x; if (Math.abs(dx) > 4) { movido = true; rail.classList.add('drag'); }
      rail.scrollLeft = drag.s - dx;
      var now = performance.now(); drag.v = (e.clientX - drag.lx) / Math.max(1, now - drag.t); drag.lx = e.clientX; drag.t = now;
    });
    addEventListener('pointerup', function () {
      if (!drag) return; var v = drag.v; drag = null; rail.classList.remove('drag');
      if (!movido) return;
      var dest = rail.scrollLeft - v * 260, mid = dest + rail.clientWidth / 2, bi = 0, bdd = 1e9;
      parts.forEach(function (o, k) { var q = Math.abs(o.c - mid); if (q < bdd) { bdd = q; bi = k; } });
      ir(bi); fin = performance.now();
    });
    if (canHover) {
      var to = 0;
      rail.addEventListener('scroll', function () { if (drag) return; clearTimeout(to); to = setTimeout(function () { if (!drag && performance.now() - fin > 500) ir(activo); }, 160); }, { passive: true });
    }
    sec._vt = { ir: ir, movido: function () { return movido && performance.now() - fin < 250; } };
  }

  var io = null, armando = false, LISTA = null;
  function montar() {
    var home = app.querySelector('[data-rnew="home"]');
    if (!home || home.querySelector('.vt')) return;
    if (!LISTA) {
      if (armando) return; armando = true;
      elegir().then(function (L) { LISTA = L; armando = false; montar(); }, function () { armando = false; LISTA = []; });
      return;
    }
    if (LISTA.length < 3) return;
    // Va justo debajo de la portada: la de siempre (#rh) o el carrusel de banners del panel (#bns), el que exista.
    var hero = home.querySelector('#bns') || home.querySelector('#rh');
    var tmp = document.createElement('div'); tmp.innerHTML = html(LISTA);
    var sec = tmp.firstChild;
    if (hero && hero.nextSibling) home.insertBefore(sec, hero.nextSibling); else home.appendChild(sec);
    motor(sec);

    if (sec.classList.contains('ready')) {
      if ('IntersectionObserver' in window) {
        if (io) io.disconnect();
        io = new IntersectionObserver(function (en) { en.forEach(function (x) { if (x.isIntersecting) { x.target.classList.add('in'); io.unobserve(x.target); fin(x.target); } }); }, { threshold: 0.2 });
        io.observe(sec);
      } else { sec.classList.add('in'); fin(sec); }
    }
  }
  function fin(sec) { setTimeout(function () { sec.classList.remove('ready', 'in'); }, 2000); }
  // Si el catálogo del servidor llega después, se vuelve a revisar con los productos definitivos
  var nProd = -1;
  setInterval(function () {
    var n = productos().length + '|' + listaFija().join(',');
    if (nProd !== -1 && n !== nProd && !armando) {
      LISTA = null;
      // si la vitrina ya estaba en pantalla con datos viejos, se rehace con los definitivos
      var vieja = app.querySelector('[data-rnew="home"] .vt'); if (vieja) { vieja.parentNode.removeChild(vieja); programar(); }
    }
    nProd = n;
  }, 1500);

  /* ================= Transición con la foto viajando ================= */
  var LAST = null; // id del último producto abierto (para el regreso)
  function limpiar() { [].forEach.call(document.querySelectorAll('[data-vt-n]'), function (el) { el.style.viewTransitionName = ''; el.removeAttribute('data-vt-n'); }); }
  function nombrar(el) { if (el) { el.style.viewTransitionName = 'vt-hero'; el.setAttribute('data-vt-n', '1'); } }
  function destinoProducto() {
    var g = app.querySelector('.pd .gal'); if (!g) return null;
    var big = g.querySelector('.gsl-s') || g.querySelector('.im.big');
    return big && big.offsetWidth ? big : g;
  }
  function destinoTarjeta(id) {
    if (id == null) return null;
    var q = '[data-id="' + String(id).replace(/"/g, '') + '"]';
    var c = app.querySelector('#gr .pc' + q + ' .im') || app.querySelector('.vt-it[data-vt="' + String(id).replace(/"/g, '') + '"] .vt-fig') || app.querySelector('.pc' + q + ' .im');
    if (!c) return null;
    var r = c.getBoundingClientRect();
    return r.bottom > 0 && r.top < innerHeight ? c : null; // solo si queda a la vista
  }

  function viajar(desde, cambiar, hasta) {
    if (!VT || window.__vtEnCurso) { cambiar(); return; }
    window.__vtEnCurso = true;
    nombrar(desde);
    document.documentElement.classList.add('vt-morph');
    var tr;
    try {
      tr = document.startViewTransition(function () {
        limpiar();
        cambiar();
        // galeria.js arma el carrusel justo después: se espera un instante para que la foto destino ya exista
        return new Promise(function (ok) { setTimeout(function () { nombrar(hasta()); ok(); }, 40); });
      });
    } catch (e) { window.__vtEnCurso = false; document.documentElement.classList.remove('vt-morph'); limpiar(); cambiar(); return; }
    var listo = function () { limpiar(); document.documentElement.classList.remove('vt-morph'); window.__vtEnCurso = false; };
    tr.finished.then(listo, listo);
  }

  function abrirProducto(id, desde) {
    if (typeof window.nav !== 'function') return false;
    LAST = id;
    viajar(desde, function () { window.nav('prod', id); }, destinoProducto);
    return true;
  }

  // Vitrina: si el zapato tocado no está en el centro, primero viaja al centro; si ya está, abre el producto.
  document.addEventListener('click', function (e) {
    var t = e.target; if (!t || !t.closest) return;
    var go = t.closest('[data-vt-go]');
    if (go) {
      var id = go.getAttribute('data-vt-go'), sec = go.closest('.vt');
      var it = sec && sec.querySelector('.vt-it[data-vt="' + id.replace(/"/g, '') + '"] .vt-fig');
      abrirProducto(id, it);
      return;
    }
    var it2 = t.closest('.vt-it');
    if (!it2) return;
    var sec2 = it2.closest('.vt'), m = sec2 && sec2._vt;
    if (m && m.movido()) return; // fue un arrastre, no un clic
    if (m && !it2.classList.contains('on')) { m.ir([].indexOf.call(it2.parentNode.children, it2)); return; }
    abrirProducto(it2.getAttribute('data-vt'), it2.querySelector('.vt-fig'));
  });

  // Catálogo y "También te puede gustar": se envuelve el clic original de la tienda (se vuelve a lanzar tal cual dentro de la transición).
  var paso = false;
  document.addEventListener('click', function (e) {
    if (!VT || paso || window.__vtEnCurso || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var t = e.target; if (!t || !t.closest) return;
    var a = t.closest('[data-n]'); if (!a) return;
    if (t.closest('.cv-bag,.cv-fav,.vt')) return;
    var n = a.getAttribute('data-n');
    var desde = null, hasta = null;
    if (n === 'prod') {
      var pc = a.closest('.pc');
      desde = (pc && pc.querySelector('.im')) || a.querySelector('img');
      var id = a.getAttribute('data-id'); LAST = id;
      hasta = destinoProducto;
    } else if (n === 'go' && (a.getAttribute('data-p') === 'col' || a.getAttribute('data-p') === 'home') && app.querySelector('.pd')) {
      desde = destinoProducto();
      var back = LAST || (new URLSearchParams(location.search).get('producto'));
      hasta = function () { return destinoTarjeta(back); };
    } else return;
    if (!desde) return;
    e.preventDefault(); e.stopImmediatePropagation();
    viajar(desde, function () { paso = true; try { a.click(); } finally { paso = false; } }, hasta);
  }, true);

  /* ================= Arranque ================= */
  var pend = false;
  function programar() { if (pend) return; pend = true; requestAnimationFrame(function () { pend = false; try { montar(); } catch (e) { /* la tienda sigue igual */ } }); }
  new MutationObserver(programar).observe(app, { childList: true, subtree: true });
  // Montaje inmediato también (por si el inicio ya está dibujado), sin esperar al siguiente cuadro
  try { montar(); } catch (e) { /* nada */ }
})();
