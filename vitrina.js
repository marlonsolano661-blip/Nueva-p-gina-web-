/* Vitrina + movimiento de la tienda (inspirado en las tiendas "perchero" de moda):
   1) VITRINA en el inicio: los zapatos en fila sobre una repisa, con movimiento EN TIEMPO REAL: mientras se desliza
      (dedo, mouse, trackpad o flechas), cada zapato crece, gira en 3D, se eleva y se enfoca según qué tan cerca esté
      del centro, cuadro por cuadro. El nombre aparece y desaparece al mismo ritmo. Abajo, una cinta que se desplaza.
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
    /* ---------- Vitrina (movimiento en tiempo real: cada cuadro según la distancia al centro) ---------- */
    '.vt{position:relative;padding:3.4rem 0 0;background:#fff;overflow:hidden}',
    '.vt-hd{max-width:1240px;margin:0 auto .4rem;padding:0 1.25rem;display:flex;align-items:flex-end;justify-content:space-between;gap:1rem}',
    '.vt-k{display:block;font:500 .66rem/1 Jost,system-ui,sans-serif;letter-spacing:.3em;text-transform:uppercase;color:#767672;margin:0 0 .7rem}',
    '.vt-hd h2{font:500 clamp(2.1rem,7vw,3.4rem)/.95 "Cormorant Garamond",Georgia,serif;letter-spacing:-.02em;margin:0;color:#0a0a0a}',
    '.vt-hint{font:400 .78rem/1.3 Jost,system-ui,sans-serif;color:#767672;margin:0;text-align:right;max-width:11rem}',
    '.vt-stage{position:relative}',
    '.vt-rail{--w:58vw;position:relative;z-index:1;display:flex;align-items:flex-end;overflow-x:auto;overflow-y:hidden;scroll-snap-type:x mandatory;scrollbar-width:none;-webkit-overflow-scrolling:touch;overscroll-behavior-x:contain;padding:3.2rem calc(50% - var(--w) / 2) 0;touch-action:pan-x pan-y}',
    '.vt-rail::-webkit-scrollbar{display:none}',
    '.vt-it{position:relative;flex:0 0 var(--w);margin:0 calc(var(--w) * -.07);scroll-snap-align:center;display:block;border:0;padding:0 0 1.4rem;background:none;cursor:pointer;color:inherit;-webkit-tap-highlight-color:transparent;perspective:1100px;user-select:none;-webkit-user-select:none}',
    /* la repisa: una línea continua bajo todos los zapatos */
    '.vt-stage::after{content:"";position:absolute;left:0;right:0;bottom:0;height:1px;background:#0a0a0a;pointer-events:none}',
    '.vt-in{display:block;transform-style:preserve-3d}',
    '.vt-fig{position:relative;display:block;aspect-ratio:3/4;overflow:hidden;background:#f3f3f1;transform-origin:50% 92%;will-change:transform,filter,opacity;backface-visibility:hidden}',
    '.vt-fig img{display:block;width:100%;height:100%;object-fit:cover;pointer-events:none;-webkit-user-drag:none}',
    '.vt-fig.nf{background:#f3f3f1}',
    /* brillo que recorre la foto mientras se desliza */
    '.vt-gl{position:absolute;inset:-20% -60%;background:linear-gradient(105deg,transparent 40%,rgba(255,255,255,.38) 50%,transparent 60%);pointer-events:none;mix-blend-mode:soft-light;will-change:transform,opacity}',
    '.vt.png .vt-gl{display:none}',
    /* modo PNG sin fondo: el zapato flota sobre la repisa */
    '.vt.png .vt-fig{aspect-ratio:1/1;background:none;overflow:visible}',
    '.vt.png .vt-fig img{object-fit:contain;object-position:50% 100%}',
    '.vt-sh{position:absolute;left:16%;right:16%;bottom:.95rem;height:.8rem;border-radius:50%;background:radial-gradient(closest-side,rgba(0,0,0,.28),transparent);pointer-events:none;will-change:transform,opacity}',
    '.vt-tag{position:absolute;left:.55rem;top:.55rem;z-index:1;font:500 .58rem/1 Jost,system-ui,sans-serif;letter-spacing:.18em;text-transform:uppercase;background:#fff;color:#0a0a0a;padding:.38rem .5rem}',
    /* flechas (PC) */
    '.vt-ar{display:none}',
    /* nombre y precio del zapato del centro: su opacidad sigue al dedo */
    '.vt-now{max-width:1240px;margin:0 auto;padding:1.4rem 1.25rem 0;min-height:7.4rem;text-align:center}',
    '.vt-now-in{display:flex;flex-direction:column;align-items:center;width:100%;text-align:center;will-change:opacity,transform}',
    '.vt-now-in>b{display:block;width:100%;font:500 clamp(1.3rem,4.8vw,1.8rem)/1.15 "Cormorant Garamond",Georgia,serif;color:#0a0a0a;text-transform:none;text-align:center}',
    '.vt-now-in>i{display:block;width:100%;font:normal 400 .9rem/1.4 Jost,system-ui,sans-serif;color:#0a0a0a;margin:.35rem 0 .8rem;letter-spacing:.04em;text-align:center}',
    '.vt-go{display:inline-flex;align-items:center;gap:.5rem;min-height:2.75rem;padding:0 1.5rem;border:1px solid #0a0a0a;border-radius:999px;background:#0a0a0a;color:#fff;font:500 .7rem/1 Jost,system-ui,sans-serif;letter-spacing:.2em;text-transform:uppercase;cursor:pointer}',
    '.vt-go:hover{background:#fff;color:#0a0a0a}',
    /* puntos de avance */
    '.vt-dots{display:flex;justify-content:center;gap:.35rem;padding:.9rem 0 0}',
    '.vt-dots i{display:block;width:.32rem;height:.32rem;border-radius:999px;background:#0a0a0a;opacity:.18;will-change:width,opacity;transition:none}',
    /* cinta que se desplaza */
    '.vt-mq{margin-top:1.8rem;background:#0a0a0a;color:#fff;overflow:hidden;white-space:nowrap;padding:.9rem 0;border-top:3px solid #f7b6d2}',
    '.vt-mq-t{display:inline-flex;animation:vtMq 30s linear infinite;will-change:transform}',
    '.vt-mq span{font:500 .68rem/1 Jost,system-ui,sans-serif;letter-spacing:.32em;text-transform:uppercase;padding:0 1.4rem}',
    '.vt-mq i{font-style:normal;color:#f7b6d2}',
    '@keyframes vtMq{to{transform:translateX(-50%)}}',
    /* entrada: los zapatos "caen" a la repisa uno tras otro */
    '.vt.ready .vt-in{opacity:0;transform:translateY(-2.4rem)}',
    '.vt.ready.in .vt-in{animation:vtDrop 1s ' + EASE + ' both;animation-delay:calc(var(--i) * 80ms + .1s)}',
    '@keyframes vtDrop{0%{opacity:0;transform:translateY(-2.4rem)}60%{opacity:1;transform:translateY(.3rem)}100%{opacity:1;transform:none}}',
    '.vt.ready .vt-hd>*{opacity:0;transform:translateY(1rem)}',
    '.vt.ready.in .vt-hd>*{animation:vtUp .8s ' + EASE + ' both}.vt.ready.in .vt-hd>:nth-child(2){animation-delay:.12s}',
    '@keyframes vtUp{to{opacity:1;transform:none}}',
    '@media(min-width:800px){',
    '  .vt{padding-top:5rem}',
    '  .vt-hd{padding:0 2rem}',
    '  .vt-rail{--w:clamp(210px,21vw,300px);scroll-snap-type:none;cursor:grab}',
    '  .vt-rail.drag{cursor:grabbing}',
    '  .vt-ar{display:grid;place-items:center;position:absolute;top:50%;z-index:3;width:3rem;height:3rem;margin-top:-1.5rem;border:1px solid #0a0a0a;border-radius:50%;background:#fff;color:#0a0a0a;cursor:pointer;transition:background .2s,color .2s}',
    '  .vt-ar:hover{background:#0a0a0a;color:#fff}',
    '  .vt-ar svg{width:1.1rem;height:1.1rem;fill:none;stroke:currentColor;stroke-width:1.6}',
    '  .vt-ar.p{left:max(1.5rem,calc(50vw - 600px))}.vt-ar.n{right:max(1.5rem,calc(50vw - 600px))}',
    '  .vt-it:focus-visible{outline:none}.vt-it:focus-visible .vt-fig{outline:1px solid #0a0a0a;outline-offset:4px}',
    '}',
    '@media(prefers-reduced-motion:reduce){.vt-mq-t,.vt.ready.in .vt-in,.vt.ready.in .vt-hd>*{animation:none}.vt.ready .vt-in,.vt.ready .vt-hd>*{opacity:1;transform:none}.vt-gl{display:none}}',

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
  var FL = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>', FR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>';
  function html(sel) {
    var items = sel.L.map(function (p, i) {
      var src = sel.png ? recorte(p) : foto(p);
      return '<button class="vt-it" type="button" role="listitem" style="--i:' + i + '" data-vt="' + E(p.id) + '" aria-label="' + E(p.name + ', ' + money(p.price)) + '">' +
        '<span class="vt-in"><span class="vt-fig">' + (agotado(p) ? '<span class="vt-tag">Agotado</span>' : '') +
        '<img src="' + E(src) + '" alt="" draggable="false" ' + (i > 3 ? 'loading="lazy" ' : '') + 'decoding="async" onerror="this.parentNode.classList.add(\'nf\');this.remove()">' +
        '<span class="vt-gl" aria-hidden="true"></span></span></span>' +
        '<span class="vt-sh" aria-hidden="true"></span></button>';
    }).join('');
    var t = MQ.map(function (x) { return '<span>' + E(x) + '</span><i aria-hidden="true">✦</i>'; }).join('');
    return '<section class="vt' + (sel.png ? ' png' : '') + (reduce ? '' : ' ready') + '" id="vitrina" aria-label="La vitrina">' +
      '<div class="vt-hd"><div><span class="vt-k">Edición limitada</span><h2>La vitrina</h2></div>' +
      '<p class="vt-hint">' + (canHover ? 'Arrastra o usa las flechas' : 'Desliza para ver cada modelo') + '</p></div>' +
      '<div class="vt-stage"><button class="vt-ar p" type="button" aria-label="Modelo anterior">' + FL + '</button>' +
      '<div class="vt-rail" role="list">' + items + '</div>' +
      '<button class="vt-ar n" type="button" aria-label="Modelo siguiente">' + FR + '</button></div>' +
      '<div class="vt-dots" aria-hidden="true">' + sel.L.map(function () { return '<i></i>'; }).join('') + '</div>' +
      '<div class="vt-now" aria-live="polite"><div class="vt-now-in"></div></div>' +
      '<div class="vt-mq" aria-hidden="true"><div class="vt-mq-t">' + t + t + '</div></div></section>';
  }

  function porId(id) { return productos().filter(function (p) { return String(p.id) === String(id); })[0] || null; }
  function cl(v, a, b) { return v < a ? a : v > b ? b : v; }

  // Motor: en cada cuadro calcula, para cada zapato, qué tan lejos está del centro (d) y de ahí
  // su tamaño, giro 3D, elevación, desenfoque, opacidad, brillo y sombra. Nada de "estados": sigue al dedo.
  function motor(sec) {
    var rail = sec.querySelector('.vt-rail'), box = sec.querySelector('.vt-now-in');
    var its = [].slice.call(rail.querySelectorAll('.vt-it'));
    var dots = [].slice.call(sec.querySelectorAll('.vt-dots i'));
    var parts = its.map(function (it) { return { it: it, fig: it.querySelector('.vt-fig'), gl: it.querySelector('.vt-gl'), sh: it.querySelector('.vt-sh'), c: 0, w: 1, last: '' }; });
    var activo = -1, vivo = false, raf = 0, t0 = performance.now();
    var tilt = { x: 0, y: 0, tx: 0, ty: 0 };

    function medir() { parts.forEach(function (o) { o.w = o.it.offsetWidth || 1; o.c = o.it.offsetLeft + o.w / 2; }); }
    function poner(i) {
      if (i === activo) return; activo = i;
      parts.forEach(function (o, k) { o.it.classList.toggle('on', k === i); });
      var p = porId(parts[i].it.getAttribute('data-vt'));
      box.innerHTML = p ? '<b>' + E(p.name) + '</b><i>' + money(p.price) + '</i><button class="vt-go" type="button" data-vt-go="' + E(p.id) + '">Ver modelo <span aria-hidden="true">→</span></button>' : '';
    }
    function cuadro(now) {
      var mid = rail.scrollLeft + rail.clientWidth / 2, best = 0, bd = 1e9;
      var reads = parts.map(function (o, k) { var d = (o.c - mid) / o.w; var a = Math.abs(d); if (a < bd) { bd = a; best = k; } return d; });
      poner(best);
      tilt.x += (tilt.tx - tilt.x) * 0.12; tilt.y += (tilt.ty - tilt.y) * 0.12;
      var flo = reduce ? 0 : Math.sin((now - t0) / 650) * 4;
      parts.forEach(function (o, k) {
        var d = reads[k], a = Math.abs(d);
        if (a > 3.2) { if (o.last !== 'far') { o.fig.style.transform = 'scale(.7)'; o.fig.style.opacity = '.2'; o.fig.style.filter = 'blur(5px)'; o.last = 'far'; } return; }
        var k1 = Math.min(a, 1), cen = 1 - k1, e = cen * cen * (3 - 2 * cen); // suavizado
        var s = 0.74 + 0.44 * e;
        var ry = cl(d, -1.4, 1.4) * -38;
        var ty = -22 * e + flo * e;
        var tx = -cl(d, -2, 2) * o.w * 0.06;
        var rx = tilt.y * 9 * e, ry2 = tilt.x * 12 * e;
        var tr = 'translate3d(' + tx.toFixed(1) + 'px,' + ty.toFixed(1) + 'px,' + (-140 * k1).toFixed(0) + 'px) rotateY(' + (ry + ry2).toFixed(2) + 'deg) rotateX(' + rx.toFixed(2) + 'deg) scale(' + s.toFixed(3) + ')';
        var bl = (k1 * 5).toFixed(2), op = (0.28 + 0.72 * e).toFixed(3);
        var key = tr + bl + op;
        if (key !== o.last) {
          o.fig.style.transform = tr;
          o.fig.style.filter = k1 < 0.02 ? 'none' : 'blur(' + bl + 'px) saturate(' + (1 - 0.4 * k1).toFixed(2) + ')';
          o.fig.style.opacity = op;
          o.it.style.zIndex = String(100 - Math.round(a * 10));
          if (o.gl) { o.gl.style.transform = 'translateX(' + (d * -70 + tilt.x * 30).toFixed(1) + '%)'; o.gl.style.opacity = (0.15 + 0.85 * e).toFixed(2); }
          if (o.sh) { o.sh.style.transform = 'scaleX(' + (1 - 0.3 * e + flo * e * 0.01).toFixed(3) + ')'; o.sh.style.opacity = (0.25 + 0.5 * e).toFixed(2); }
          o.last = key;
        }
        if (dots[k]) { dots[k].style.width = (0.32 + 1.1 * e).toFixed(2) + 'rem'; dots[k].style.opacity = (0.18 + 0.82 * e).toFixed(2); }
      });
      // el nombre se desvanece entre modelos y aparece cuando uno llega al centro
      var lo = cl(1 - bd * 2.6, 0, 1);
      box.style.opacity = lo.toFixed(3);
      box.style.transform = 'translateY(' + ((1 - lo) * 10).toFixed(1) + 'px)';
      box.style.pointerEvents = lo > 0.6 ? '' : 'none';
      if (vivo) raf = requestAnimationFrame(cuadro);
    }
    function arrancar() { if (vivo) return; vivo = true; raf = requestAnimationFrame(cuadro); }
    function parar() { vivo = false; cancelAnimationFrame(raf); }

    medir();
    // empieza en el segundo modelo para que se vea que hay más a los lados
    var ini = parts[1] || parts[0];
    rail.scrollLeft = ini.c - rail.clientWidth / 2;
    cuadro(performance.now());
    addEventListener('resize', function () { medir(); cuadro(performance.now()); });
    [].forEach.call(rail.querySelectorAll('img'), function (im) { im.addEventListener('load', medir); });

    // solo trabaja mientras la vitrina está en pantalla
    if ('IntersectionObserver' in window) new IntersectionObserver(function (en) { en.forEach(function (x) { if (x.isIntersecting) arrancar(); else parar(); }); }).observe(sec);
    else arrancar();
    if (reduce) rail.addEventListener('scroll', function () { requestAnimationFrame(cuadro); }, { passive: true });

    function ir(i) { i = cl(i, 0, parts.length - 1); rail.scrollTo({ left: parts[i].c - rail.clientWidth / 2, behavior: reduce ? 'auto' : 'smooth' }); }
    sec.querySelector('.vt-ar.p').addEventListener('click', function () { ir(activo - 1); });
    sec.querySelector('.vt-ar.n').addEventListener('click', function () { ir(activo + 1); });
    rail.addEventListener('keydown', function (e) { if (e.key === 'ArrowLeft') { e.preventDefault(); ir(activo - 1); } else if (e.key === 'ArrowRight') { e.preventDefault(); ir(activo + 1); } });

    // PC: arrastrar con el mouse (con inercia) y el zapato del centro se inclina hacia el cursor
    var drag = null, movido = false, fin = 0;
    rail.addEventListener('pointerdown', function (e) {
      if (e.pointerType !== 'mouse' || e.button) return;
      drag = { x: e.clientX, s: rail.scrollLeft, v: 0, t: performance.now(), lx: e.clientX }; movido = false;
    });
    addEventListener('pointermove', function (e) {
      if (e.pointerType === 'mouse') {
        var r = rail.getBoundingClientRect();
        if (e.clientY > r.top && e.clientY < r.bottom) { tilt.tx = cl((e.clientX - (r.left + r.width / 2)) / (r.width / 2), -1, 1); tilt.ty = cl(((r.top + r.height / 2) - e.clientY) / (r.height / 2), -1, 1); }
        else { tilt.tx = 0; tilt.ty = 0; }
      }
      if (!drag) return;
      var dx = e.clientX - drag.x; if (Math.abs(dx) > 4) { movido = true; rail.classList.add('drag'); }
      rail.scrollLeft = drag.s - dx;
      var now = performance.now(); drag.v = (e.clientX - drag.lx) / Math.max(1, now - drag.t); drag.lx = e.clientX; drag.t = now;
    });
    addEventListener('pointerup', function () {
      if (!drag) return; var v = drag.v; drag = null; rail.classList.remove('drag');
      if (!movido) return;
      // inercia: proyecta el impulso y se detiene en el modelo más cercano a donde caería
      var dest = rail.scrollLeft - v * 260, mid = dest + rail.clientWidth / 2, bi = 0, bdd = 1e9;
      parts.forEach(function (o, k) { var q = Math.abs(o.c - mid); if (q < bdd) { bdd = q; bi = k; } });
      ir(bi); fin = performance.now();
    });
    rail.addEventListener('mouseleave', function () { tilt.tx = 0; tilt.ty = 0; });
    // PC con trackpad: al soltar el desplazamiento, se acomoda en el modelo más cercano
    if (canHover) {
      var to = 0;
      rail.addEventListener('scroll', function () { if (drag) return; clearTimeout(to); to = setTimeout(function () { if (!drag && performance.now() - fin > 500) ir(activo); }, 140); }, { passive: true });
    }
    sec._vt = { ir: ir, activo: function () { return activo; }, movido: function () { return movido && performance.now() - fin < 250; } };
  }

  var io = null;
  function montar() {
    var home = app.querySelector('[data-rnew="home"]');
    if (!home || home.querySelector('.vt')) return;
    var sel = elegir(); if (sel.L.length < 3) return;
    // Va justo debajo de la portada: la de siempre (#rh) o el carrusel de banners del panel (#bns), el que exista.
    var hero = home.querySelector('#bns') || home.querySelector('#rh');
    var tmp = document.createElement('div'); tmp.innerHTML = html(sel);
    var sec = tmp.firstChild;
    if (hero && hero.nextSibling) home.insertBefore(sec, hero.nextSibling); else home.appendChild(sec);
    motor(sec);

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
  function fin(sec) { setTimeout(function () { sec.classList.remove('ready', 'in'); }, 2400); }

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
