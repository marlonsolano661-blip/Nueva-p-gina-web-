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

  // Cinta con texto que se desplaza (decorativa; solo frases que ya están en la tienda).
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
    cinta(pd); foto(pd); barra(pd);
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
