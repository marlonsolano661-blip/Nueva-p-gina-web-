/* Vitrina + movimiento de la tienda (inspirado en las tiendas "perchero" de moda):
   1) VITRINA en el inicio: los zapatos en fila sobre una repisa. El que se enfoca crece y el resto se desenfoca
      (en PC al pasar el mouse; en celular, el que queda en el centro al deslizar). Abajo, una cinta que se desplaza.
      Si hay fotos SIN FONDO (PNG) en DATA/recortes.js, la vitrina las usa y los zapatos "flotan" sobre la repisa.
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
    /* ---------- Vitrina ---------- */
    '.vt{position:relative;padding:3.4rem 0 0;background:#fff;overflow:hidden}',
    '.vt-hd{max-width:1240px;margin:0 auto 1.2rem;padding:0 1.25rem;display:flex;align-items:flex-end;justify-content:space-between;gap:1rem}',
    '.vt-k{display:block;font:500 .66rem/1 Jost,system-ui,sans-serif;letter-spacing:.3em;text-transform:uppercase;color:#767672;margin:0 0 .7rem}',
    '.vt-hd h2{font:500 clamp(2.1rem,7vw,3.4rem)/.95 "Cormorant Garamond",Georgia,serif;letter-spacing:-.02em;margin:0;color:#0a0a0a}',
    '.vt-hint{font:400 .78rem/1.3 Jost,system-ui,sans-serif;color:#767672;margin:0;text-align:right;max-width:11rem}',
    '.vt-rail{position:relative;display:flex;align-items:flex-end;overflow-x:auto;overflow-y:visible;scroll-snap-type:x mandatory;scrollbar-width:none;-webkit-overflow-scrolling:touch;overscroll-behavior-x:contain;padding:2.6rem calc(50vw - 25vw) 0}',
    '.vt-rail::-webkit-scrollbar{display:none}',
    '.vt-it{--i:0;position:relative;flex:0 0 50vw;scroll-snap-align:center;display:block;border:0;margin:0;padding:0 .55rem 1.3rem;background:none;cursor:pointer;color:inherit;-webkit-tap-highlight-color:transparent;text-align:center}',
    /* la repisa: una línea continua bajo todos los zapatos */
    '.vt-it::after{content:"";position:absolute;left:0;right:0;bottom:0;height:1px;background:#0a0a0a}',
    '.vt-it:first-child::after{left:.55rem}.vt-it:last-child::after{right:.55rem}',
    '.vt-in{display:block}',
    '.vt-fig{position:relative;display:block;aspect-ratio:3/4;overflow:hidden;background:#f3f3f1;transform-origin:50% 100%;transition:transform .8s ' + EASE + ',filter .55s ease,opacity .55s ease}',
    '.vt-fig img{display:block;width:100%;height:100%;object-fit:cover}',
    '.vt-fig.nf{background:#f3f3f1}',
    /* modo PNG sin fondo: el zapato flota sobre la repisa con su sombra */
    '.vt.png .vt-fig{aspect-ratio:1/1;background:none;overflow:visible}',
    '.vt.png .vt-fig img{object-fit:contain;object-position:50% 100%}',
    '.vt-sh{display:none}',
    '.vt.png .vt-sh{display:block;position:absolute;left:18%;right:18%;bottom:1.05rem;height:.7rem;border-radius:50%;background:radial-gradient(closest-side,rgba(0,0,0,.22),transparent);transition:transform .8s ' + EASE + ',opacity .55s}',
    /* enfoque: el elegido crece, los demás se desenfocan */
    '.vt-rail.f .vt-it:not(.on) .vt-fig{filter:blur(3px) saturate(.7);opacity:.42;transform:scale(.88)}',
    '.vt-rail.f .vt-it:not(.on) .vt-sh{opacity:.3}',
    '.vt-it.on .vt-fig{transform:translateY(-.6rem) scale(1.1)}',
    '.vt.png .vt-it.on .vt-fig{transform:translateY(-1.3rem) scale(1.18)}',
    '.vt-it.on .vt-sh{transform:scale(.78);opacity:.65}',
    '.vt-tag{position:absolute;left:.55rem;top:.55rem;z-index:1;font:500 .58rem/1 Jost,system-ui,sans-serif;letter-spacing:.18em;text-transform:uppercase;background:#fff;color:#0a0a0a;padding:.38rem .5rem}',
    /* nombre y precio del zapato enfocado */
    '.vt-now{max-width:1240px;margin:0 auto;padding:1.3rem 1.25rem 0;min-height:7.2rem;text-align:center}',
    '.vt-now-in{display:block;transition:opacity .35s ease,transform .45s ' + EASE + ',filter .35s ease}',
    '.vt-now-in.sw{opacity:0;transform:translateY(.5rem);filter:blur(4px)}',
    '.vt-now b{display:block;font:500 clamp(1.25rem,4.6vw,1.7rem)/1.1 "Cormorant Garamond",Georgia,serif;color:#0a0a0a;text-transform:none}',
    '.vt-now span{display:block;font:400 .9rem/1.4 Jost,system-ui,sans-serif;color:#0a0a0a;margin:.35rem 0 .8rem;letter-spacing:.04em}',
    '.vt-now small{display:block;font:400 .78rem/1.4 Jost,system-ui,sans-serif;color:#767672}',
    '.vt-go{display:inline-flex;align-items:center;gap:.5rem;min-height:2.75rem;padding:0 1.5rem;border:1px solid #0a0a0a;border-radius:999px;background:#0a0a0a;color:#fff;font:500 .7rem/1 Jost,system-ui,sans-serif;letter-spacing:.2em;text-transform:uppercase;cursor:pointer}',
    '.vt-go:hover{background:#fff;color:#0a0a0a}',
    /* cinta que se desplaza */
    '.vt-mq{margin-top:2.2rem;background:#0a0a0a;color:#fff;overflow:hidden;white-space:nowrap;padding:.9rem 0;border-top:3px solid #f7b6d2}',
    '.vt-mq-t{display:inline-flex;animation:vtMq 30s linear infinite;will-change:transform}',
    '.vt-mq span{font:500 .68rem/1 Jost,system-ui,sans-serif;letter-spacing:.32em;text-transform:uppercase;padding:0 1.4rem}',
    '.vt-mq i{font-style:normal;color:#f7b6d2}',
    '@keyframes vtMq{to{transform:translateX(-50%)}}',
    /* entrada: los zapatos "caen" a la repisa uno tras otro */
    '.vt.ready .vt-in{opacity:0;transform:translateY(-2.2rem) rotate(-3deg)}',
    '.vt.ready.in .vt-in{animation:vtDrop .95s ' + EASE + ' both;animation-delay:calc(var(--i) * 70ms + .1s)}',
    '@keyframes vtDrop{0%{opacity:0;transform:translateY(-2.2rem) rotate(-3deg)}60%{opacity:1;transform:translateY(.25rem) rotate(.6deg)}100%{opacity:1;transform:none}}',
    '.vt.ready .vt-hd>*{opacity:0;transform:translateY(1rem)}',
    '.vt.ready.in .vt-hd>*{animation:vtUp .8s ' + EASE + ' both}.vt.ready.in .vt-hd>:nth-child(2){animation-delay:.12s}',
    '@keyframes vtUp{to{opacity:1;transform:none}}',
    '@media(min-width:800px){',
    '  .vt{padding-top:5rem}',
    '  .vt-hd{padding:0 2rem;margin-bottom:.6rem}',
    '  .vt-rail{padding:3.4rem max(2rem,calc(50vw - 600px)) 0;scroll-snap-type:none}',
    '  .vt-it{flex:0 0 clamp(150px,15vw,230px);padding:0 .8rem 1.5rem}',
    '  .vt-it:first-child::after{left:.8rem}.vt-it:last-child::after{right:.8rem}',
    '  .vt-it:focus-visible{outline:none}.vt-it:focus-visible .vt-fig{outline:1px solid #0a0a0a;outline-offset:4px}',
    '  .vt-now{padding-top:1.6rem}',
    '}',
    '@media(prefers-reduced-motion:reduce){.vt-fig,.vt-sh,.vt-now-in{transition:none}.vt-mq-t,.vt.ready.in .vt-in,.vt.ready.in .vt-hd>*{animation:none}.vt.ready .vt-in,.vt.ready .vt-hd>*{opacity:1;transform:none}}',

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

  /* ================= Datos ================= */
  function productos() {
    try { if (typeof catalog === 'function') return catalog() || []; } catch (e) { /* sin catálogo */ }
    return Array.isArray(window.MF_CATALOGO_PRODUCTOS) ? window.MF_CATALOGO_PRODUCTOS : [];
  }
  function recorte(p) { var R = window.MF_RECORTES || {}; return (p && (p.recorte || R[p.id])) || ''; }
  function foto(p) { return (p && (p.img || (p.imgs && p.imgs[0]))) || ''; }
  function agotado(p) { return Array.isArray(p.tallas) && !p.tallas.length; }

  // Con 3 o más PNG sin fondo, la vitrina usa solo esos (modo "flotando"). Si no, usa las fotos normales.
  function elegir() {
    var all = productos().filter(function (p) { return p && p.id != null && (foto(p) || recorte(p)); });
    var png = all.filter(function (p) { return recorte(p); });
    if (png.length >= 3) return { png: true, L: png.slice(0, 14) };
    var dest = all.filter(function (p) { return p.destacado && !agotado(p); });
    var resto = all.filter(function (p) { return !p.destacado && !agotado(p); });
    return { png: false, L: dest.concat(resto).slice(0, 12) };
  }

  /* ================= Vitrina ================= */
  var MQ = ['Marlon Footwear', 'Ediciones limitadas', 'Envíos a toda Colombia', 'Pocas unidades por modelo', 'Nueva temporada'];
  function html(sel) {
    var items = sel.L.map(function (p, i) {
      var src = sel.png ? recorte(p) : foto(p);
      return '<button class="vt-it" type="button" role="listitem" style="--i:' + i + '" data-vt="' + E(p.id) + '" aria-label="' + E(p.name + ', ' + money(p.price)) + '">' +
        '<span class="vt-in"><span class="vt-fig">' + (agotado(p) ? '<span class="vt-tag">Agotado</span>' : '') +
        '<img src="' + E(src) + '" alt="" ' + (i > 3 ? 'loading="lazy" ' : '') + 'decoding="async" onerror="this.parentNode.classList.add(\'nf\');this.remove()"></span></span>' +
        '<span class="vt-sh" aria-hidden="true"></span></button>';
    }).join('');
    var t = MQ.map(function (x) { return '<span>' + E(x) + '</span><i aria-hidden="true">✦</i>'; }).join('');
    return '<section class="vt' + (sel.png ? ' png' : '') + (reduce ? '' : ' ready') + '" id="vitrina" aria-label="La vitrina">' +
      '<div class="vt-hd"><div><span class="vt-k">Edición limitada</span><h2>La vitrina</h2></div>' +
      '<p class="vt-hint">' + (canHover ? 'Pasa el cursor por cada modelo' : 'Desliza para ver cada modelo') + '</p></div>' +
      '<div class="vt-rail" role="list">' + items + '</div>' +
      '<div class="vt-now" aria-live="polite"><span class="vt-now-in"></span></div>' +
      '<div class="vt-mq" aria-hidden="true"><div class="vt-mq-t">' + t + t + '</div></div></section>';
  }

  var cur = null, io = null;
  function porId(id) { return productos().filter(function (p) { return String(p.id) === String(id); })[0] || null; }

  function etiqueta(sec, id) {
    var box = sec.querySelector('.vt-now-in'); if (!box) return;
    var p = id != null ? porId(id) : null;
    var nuevo = p ? '<b>' + E(p.name) + '</b><span>' + money(p.price) + '</span><button class="vt-go" type="button" data-vt-go="' + E(p.id) + '">' + (agotado(p) ? 'Ver modelo' : 'Ver modelo') + ' <span aria-hidden="true">→</span></button>'
      : '<small>' + (canHover ? 'Elige un modelo de la repisa' : 'Toca un modelo para verlo de cerca') + '</small>';
    if (box.getAttribute('data-k') === String(id)) return;
    box.setAttribute('data-k', String(id));
    if (reduce) { box.innerHTML = nuevo; return; }
    box.classList.add('sw');
    clearTimeout(box._t);
    box._t = setTimeout(function () { box.innerHTML = nuevo; box.classList.remove('sw'); }, 180);
  }

  function enfocar(sec, it) {
    var rail = sec.querySelector('.vt-rail');
    [].forEach.call(rail.querySelectorAll('.vt-it.on'), function (x) { if (x !== it) x.classList.remove('on'); });
    if (it) { it.classList.add('on'); rail.classList.add('f'); cur = it.getAttribute('data-vt'); }
    else { rail.classList.remove('f'); cur = null; }
    etiqueta(sec, it ? cur : null);
  }

  // En celular: el zapato que queda en el centro es el enfocado.
  function alCentro(sec) {
    var rail = sec.querySelector('.vt-rail'), r = rail.getBoundingClientRect(), mid = r.left + r.width / 2, best = null, bd = 1e9;
    [].forEach.call(rail.querySelectorAll('.vt-it'), function (it) {
      var b = it.getBoundingClientRect(), d = Math.abs(b.left + b.width / 2 - mid);
      if (d < bd) { bd = d; best = it; }
    });
    return best;
  }

  function montar() {
    var home = app.querySelector('[data-rnew="home"]');
    if (!home || home.querySelector('.vt')) return;
    var sel = elegir(); if (sel.L.length < 3) return;
    // Va justo debajo de la portada: la de siempre (#rh) o el carrusel de banners del panel (#bns), el que exista.
    var hero = home.querySelector('#bns') || home.querySelector('#rh');
    var tmp = document.createElement('div'); tmp.innerHTML = html(sel);
    var sec = tmp.firstChild;
    if (hero && hero.nextSibling) home.insertBefore(sec, hero.nextSibling); else home.appendChild(sec);
    var rail = sec.querySelector('.vt-rail');

    if (canHover) {
      rail.addEventListener('mouseover', function (e) { var it = e.target.closest('.vt-it'); if (it && !it.classList.contains('on')) enfocar(sec, it); });
      rail.addEventListener('mouseleave', function () { enfocar(sec, null); });
      rail.addEventListener('focusin', function (e) { var it = e.target.closest('.vt-it'); if (it) enfocar(sec, it); });
      etiqueta(sec, null);
    } else {
      var pend = false;
      var marcar = function () { pend = false; var it = alCentro(sec); if (it && !it.classList.contains('on')) enfocar(sec, it); };
      rail.addEventListener('scroll', function () { if (!pend) { pend = true; requestAnimationFrame(marcar); } }, { passive: true });
      // empieza en el segundo modelo para que se vea que hay más a los lados
      var dos = rail.children[1];
      if (dos) rail.scrollLeft = dos.offsetLeft + dos.offsetWidth / 2 - rail.clientWidth / 2;
      requestAnimationFrame(marcar);
    }

    // Entrada al aparecer en pantalla
    if (sec.classList.contains('ready')) {
      if ('IntersectionObserver' in window) {
        if (io) io.disconnect();
        io = new IntersectionObserver(function (en) { en.forEach(function (x) { if (x.isIntersecting) { x.target.classList.add('in'); io.unobserve(x.target); fin(x.target); } }); }, { threshold: 0.2 });
        io.observe(sec);
      } else { sec.classList.add('in'); fin(sec); }
    }
  }
  // Al terminar la entrada se quita la clase para que no se repita al redibujar estilos
  function fin(sec) { setTimeout(function () { sec.classList.remove('ready', 'in'); }, 2200); }

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

  // Vitrina: en PC un clic abre; en celular, si el zapato no está en el centro, primero lo centra.
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
    if (!canHover && !it2.classList.contains('on')) {
      var rail = it2.parentNode;
      rail.scrollTo({ left: it2.offsetLeft + it2.offsetWidth / 2 - rail.clientWidth / 2, behavior: reduce ? 'auto' : 'smooth' });
      return;
    }
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
