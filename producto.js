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
