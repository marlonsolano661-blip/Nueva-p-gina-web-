/* Página de producto: animaciones y detalles visuales. NO toca la lógica de compra:
   no cambia datos, ids ni eventos; solo agrega clases y un par de elementos decorativos.
   Si este archivo falla o no carga, la página funciona igual (producto.css se ve sin animaciones). */
(function () {
  'use strict';
  var app = document.getElementById('app');
  if (!app || window.__mfProducto) return;
  window.__mfProducto = 1;

  var reduce = false, canHover = false;
  try { reduce = matchMedia('(prefers-reduced-motion: reduce)').matches; canHover = matchMedia('(hover: hover)').matches; } catch (e) { /* sin matchMedia */ }
  var last = { key: '', src: '' }, ioBar = null, scrollHandler = null, busy = false;

  function cleanup() {
    if (ioBar) { ioBar.disconnect(); ioBar = null; }
    if (scrollHandler) { removeEventListener('scroll', scrollHandler); scrollHandler = null; }
    document.body.classList.remove('pdp-io');
  }

  // Precio: cuenta hasta el valor real y termina dejando el texto original intacto.
  function countUp(pd) {
    var el = pd.querySelector('.pr.big');
    if (!el || reduce) return;
    var txt = el.textContent, n = parseInt(txt.replace(/\D/g, ''), 10);
    if (!n) return;
    var t0 = performance.now(), D = 1000;
    (function f(t) {
      if (!el.isConnected) return;
      var k = Math.min(1, (t - t0) / D), e = 1 - Math.pow(1 - k, 3);
      el.textContent = k < 1 ? '$' + Math.round(n * e).toLocaleString('es-CO') : txt;
      if (k < 1) requestAnimationFrame(f);
    })(t0);
  }

  // Cinta con texto que se desplaza: quitada de la página del producto (ya no se llama).
  function cinta(pd) {
    var sec = pd.closest('section');
    if (!sec || document.querySelector('#app .mfmq')) return;
    var f = ['Marlon Footwear', 'Pocas unidades por modelo', 'Paga online o por WhatsApp', 'Marlon Footwear', 'Pocas unidades por modelo', 'Paga online o por WhatsApp'];
    var d = document.createElement('div');
    d.className = 'mfmq'; d.setAttribute('aria-hidden', 'true');
    var t = document.createElement('div'); t.className = 'mfmq-t';
    for (var r = 0; r < 2; r++) f.forEach(function (x) { var s = document.createElement('span'); s.textContent = x + ' ✦'; t.appendChild(s); });
    d.appendChild(t);
    sec.insertAdjacentElement('afterend', d);
  }

  // Zoom con el mouse (solo escritorio) y movimiento suave de la foto al hacer scroll (móvil).
  function foto(pd) {
    var im = pd.querySelector('.im.big'), img = im && im.querySelector('img');
    if (!im || !img) return;
    if (canHover) {
      im.addEventListener('pointermove', function (e) {
        var r = im.getBoundingClientRect();
        im.style.setProperty('--zx', ((e.clientX - r.left) / r.width * 100).toFixed(1) + '%');
        im.style.setProperty('--zy', ((e.clientY - r.top) / r.height * 100).toFixed(1) + '%');
        im.classList.add('zm');
      });
      im.addEventListener('pointerleave', function () { im.classList.remove('zm'); });
    } else if (!reduce) {
      var tick = false;
      scrollHandler = function () {
        if (tick) return; tick = true;
        requestAnimationFrame(function () {
          tick = false;
          if (!im.isConnected) return;
          var r = im.getBoundingClientRect(), y = Math.max(-1, Math.min(1, r.top / innerHeight));
          img.style.translate = '0 ' + (y * -14).toFixed(1) + 'px';
        });
      };
      addEventListener('scroll', scrollHandler, { passive: true });
    }
  }

  // Barra inferior (móvil): aparece solo cuando los botones principales salen de la pantalla.
  function barra(pd) {
    var row = pd.querySelector('.pi .row'), bar = document.querySelector('#app .stk');
    if (!row || !bar || !('IntersectionObserver' in window)) return;
    document.body.classList.add('pdp-io');
    ioBar = new IntersectionObserver(function (es) {
      bar.classList.toggle('on', !es[0].isIntersecting);
    }, { threshold: 0.2 });
    ioBar.observe(row);
  }

  function mejorar() {
    cleanup();
    var pd = app.querySelector('.pd');
    if (!pd) { last.key = ''; last.src = ''; return; }
    var h1 = pd.querySelector('.pi h1'), img = pd.querySelector('.im.big img');
    var key = h1 ? h1.textContent : '', src = img ? img.getAttribute('src') : '';
    if (key !== last.key) {
      if (!reduce) pd.classList.add('fresh');
      countUp(pd);
    } else if (src !== last.src && !reduce) {
      pd.classList.add('swap');
    }
    last.key = key; last.src = src;
    foto(pd); barra(pd);
  }

  // Se ejecuta cada vez que la tienda vuelve a dibujar #app. Los cambios que hace este mismo script se descartan.
  var obs = new MutationObserver(function () {
    if (busy) return;
    busy = true;
    requestAnimationFrame(function () {
      try { mejorar(); } catch (e) { /* nunca debe romper la tienda */ }
      obs.takeRecords();
      busy = false;
    });
  });
  obs.observe(app, { childList: true });
  try { mejorar(); } catch (e) { /* nada */ }
})();

/* Línea rosa brillante de carga: al tocar un producto (data-n="prod") o una colección del inicio (data-ver).
   No sale al deslizar fotos ni en otros cambios de página. Si falla, la tienda navega igual. */
(function () {
  'use strict';
  if (window.__mfBarra || typeof window.nav !== 'function') return;
  window.__mfBarra = 1;
  var reduce = false;
  try { reduce = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { /* nada */ }
  var css = document.createElement('style');
  css.textContent = '#mf-bar{position:fixed;top:0;left:0;height:2px;width:0;z-index:2147483000;pointer-events:none;opacity:0;border-radius:0 2px 2px 0;' +
    'background:linear-gradient(90deg,#ff5fa2,#ff9ccb 40%,#fff0f7 50%,#ff9ccb 60%,#ff3d8e);background-size:220% 100%;' +
    'box-shadow:0 0 6px rgba(255,79,154,.8),0 0 12px rgba(255,120,180,.45);animation:mfBrillo 1.1s linear infinite}' +
    '#mf-bar.on{opacity:1}@keyframes mfBrillo{from{background-position:120% 0}to{background-position:-100% 0}}' +
    '@media (prefers-reduced-motion:reduce){#mf-bar{animation:none}}';
  document.head.appendChild(css);
  var bar = document.createElement('div');
  bar.id = 'mf-bar'; bar.setAttribute('aria-hidden', 'true');
  document.body.appendChild(bar);

  var clic = 0, on = false, minFin = 0, t1, t2;
  // Marca solo los toques reales sobre un producto o sobre una colección
  document.addEventListener('click', function (e) {
    if (e.target.closest && e.target.closest('[data-n="prod"],[data-ver]')) clic = Date.now();
  }, true);

  function ini() {
    clearTimeout(t1); clearTimeout(t2); on = true;
    bar.style.transition = 'none'; bar.style.width = '0'; bar.classList.add('on');
    void bar.offsetWidth;
    bar.style.transition = 'width 1.1s cubic-bezier(.22,.7,.3,1),opacity .35s ease';
    bar.style.width = '82%';
    minFin = Date.now() + 900;
    t1 = setTimeout(fin, 6000);
  }
  function fin() {
    if (!on) return;
    var w = minFin - Date.now();
    if (w > 0) { clearTimeout(t1); t1 = setTimeout(fin, w); return; }
    on = false; clearTimeout(t1);
    bar.style.transition = 'width .45s ease,opacity .45s ease';
    bar.style.width = '100%';
    t2 = setTimeout(function () {
      bar.classList.remove('on');
      setTimeout(function () { if (!on) { bar.style.transition = 'none'; bar.style.width = '0'; } }, 450);
    }, 300);
  }
  function esperarFoto() {
    var img = document.querySelector('#app .pd .gsl-s img') || document.querySelector('#app .pd .im.big img') || document.querySelector('#app #gr .pc img');
    if (!img || img.complete || img.naturalWidth) return fin();
    img.addEventListener('load', fin, { once: true });
    img.addEventListener('error', fin, { once: true });
    clearTimeout(t1); t1 = setTimeout(fin, 2500);   // nunca se queda pegada
  }

  var nav0 = window.nav;
  window.nav = function (p) {
    var self = this, args = arguments;
    if ((p === 'prod' || p === 'col') && Date.now() - clic < 800) {
      clic = 0;
      ini();
      setTimeout(function () {
        try { nav0.apply(self, args); } finally { setTimeout(esperarFoto, 120); }
      }, reduce ? 0 : 550);
      return;
    }
    return nav0.apply(this, arguments);
  };
})();

/* Tarjeta "¡Listo! Ya está en tu bolsa": reemplaza el aviso "Agregado a tu bolsa / Ver bolsa".
   Muestra arriba la foto, nombre, color, talla, precio y cuántos productos lleva la bolsa.
   Se cierra sola a los 3,5 s o al tocarla. Si algo falla, se usa el aviso normal. */
(function () {
  'use strict';
  if (window.__mfTarjeta || typeof toast !== 'function') return;
  window.__mfTarjeta = 1;
  var css = '#addc{position:fixed;left:50%;top:calc(env(safe-area-inset-top,0px) + .75rem);z-index:95;width:min(92vw,25rem);display:flex;gap:.85rem;align-items:center;padding:.65rem .9rem .65rem .65rem;background:var(--w);color:var(--k);border-radius:1.1rem;box-shadow:0 14px 40px rgba(0,0,0,.16),0 2px 6px rgba(0,0,0,.06);transform:translate(-50%,-140%) scale(.96);opacity:0;transition:transform .5s var(--ease),opacity .3s;pointer-events:none;cursor:pointer}'
    + '#addc.on{transform:translate(-50%,0) scale(1);opacity:1;pointer-events:auto}'
    + '#addc .ac-im{position:relative;flex:0 0 3.8rem;height:3.8rem;border-radius:.8rem;background:var(--gs)}'
    + '#addc .ac-im img{width:100%;height:100%;object-fit:cover;display:block;border-radius:.8rem}#addc .ac-im svg{width:100%;height:100%}'
    + '#addc .ac-im i{position:absolute;right:-.35rem;bottom:-.35rem;width:1.35rem;height:1.35rem;border-radius:50%;background:var(--gr);color:var(--w);font:600 .72rem/1.35rem Figtree,system-ui,sans-serif;text-align:center;font-style:normal;border:2px solid var(--w)}'
    + '#addc.on .ac-im i{animation:acpop .5s .25s both}@keyframes acpop{from{transform:scale(0)}60%{transform:scale(1.25)}}'
    + '#addc .ac-tx{flex:1;display:flex;flex-direction:column;min-width:0;line-height:1.3}'
    + '#addc .ac-tx small{font-size:.75rem;font-weight:600;color:var(--gr)}'
    + "#addc .ac-tx b{font-family:'Cormorant Garamond',Georgia,serif;font-size:1.2rem;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}"
    + '#addc .ac-tx span{font-size:.8rem;color:var(--g3)}'
    + '#addc .ac-n{flex:none;display:flex;flex-direction:column;align-items:center;justify-content:center;min-width:3.2rem;padding:.4rem .5rem;border-radius:.8rem;background:var(--gs);line-height:1.1}'
    + '#addc .ac-n b{font-size:1.15rem}#addc .ac-n small{font-size:.62rem;color:var(--g3)}'
    + '@media (prefers-reduced-motion:reduce){#addc{transition:opacity .2s}#addc.on .ac-im i{animation:none}}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  var c = document.createElement('div'); c.id = 'addc'; c.setAttribute('role', 'status'); c.setAttribute('aria-live', 'polite'); document.body.appendChild(c);
  var timer, antes = {};
  function clave(l) { return l.id + '|' + l.talla + '|' + (l.color || ''); }
  function foto() { var m = {}; CART.forEach(function (l) { m[clave(l)] = l.q; }); return m; }
  /* Justo antes de agregar, guarda cómo estaba la bolsa para saber qué producto entró. */
  document.addEventListener('click', function (e) { if (e.target.closest('[data-n="add"]')) antes = foto(); }, true);
  function tarjeta(l) {
    var n = CART.reduce(function (a, x) { return a + x.q; }, 0);
    var t = document.getElementById('toast'); if (t) t.classList.remove('on');
    c.innerHTML = '<div class="ac-im">' + imgH(l) + '<i>✓</i></div><div class="ac-tx"><small>¡Listo! Ya está en tu bolsa</small><b>' + esc(l.name) + '</b><span>' + (l.color ? esc(l.color) + ' · ' : '') + 'Talla ' + esc(l.talla) + ' · ' + fmt(l.price) + '</span></div><div class="ac-n"><b>' + n + '</b><small>' + (n === 1 ? 'producto' : 'productos') + '</small></div>';
    c.classList.remove('on'); void c.offsetWidth; c.classList.add('on');
    clearTimeout(timer); timer = setTimeout(function () { c.classList.remove('on'); }, 3500);
  }
  c.onclick = function () { c.classList.remove('on'); clearTimeout(timer); };
  var base = toast;
  toast = function (m) {
    if (m === 'Agregado a tu bolsa') {
      try {
        var l = CART.filter(function (x) { return (antes[clave(x)] || 0) < x.q; })[0] || CART[CART.length - 1];
        if (l) { tarjeta(l); return; }
      } catch (e) { /* si algo falla, aviso normal */ }
    }
    return base.apply(this, arguments);
  };
})();
