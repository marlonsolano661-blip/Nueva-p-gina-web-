/* Franja debajo del logo (solo en el inicio): la foto principal difuminada de fondo y dos mensajes,
   "Paga como quieras" y el descuento de bienvenida del panel (al tocarlo se abre la ventana para dejar el correo).
   Si no hay descuento activo, el segundo mensaje es la garantía. Si este archivo falla, la tienda funciona igual. */
(function () {
  'use strict';
  var app = document.getElementById('app'), bar = document.querySelector('header.bar');
  if (!app || !bar || window.__mfTira) return;
  window.__mfTira = 1;
  var E = function (t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (m) { return '&#' + m.charCodeAt(0) + ';'; }); };
  var t = document.createElement('div');
  t.className = 'mf-tira'; t.hidden = true;
  t.innerHTML = '<div class="mf-tira-bg" aria-hidden="true"></div><div class="mf-tira-in"></div>';
  bar.insertAdjacentElement('afterend', t);
  var bg = t.querySelector('.mf-tira-bg'), inn = t.querySelector('.mf-tira-in'), ultimo = '';

  function textos() {
    var p = window.MF_CONTENIDO && window.MF_CONTENIDO.promo, der;
    if (p && p.correo === true && p.pct >= 1 && p.pct <= 90 && typeof window.mfAbrirBienvenida === 'function') {
      der = '<button type="button" class="mf-tira-c" data-tira-desc><b>' + E(p.pct) + '% OFF primer par</b><small>Déjanos tu correo →</small></button>';
    } else {
      der = '<div class="mf-tira-c"><b>Garantía de 3 meses</b><small>Por defectos de fabricación</small></div>';
    }
    var h = '<div class="mf-tira-c"><b>Paga como quieras</b><small>Nequi · PSE · Tarjetas</small></div><span class="mf-tira-l" aria-hidden="true"></span>' + der;
    if (h !== ultimo) { inn.innerHTML = h; ultimo = h; }
  }
  function foto() {
    var im = app.querySelector('.bn-ph img, .rh-ph img');
    var src = im && (im.currentSrc || im.getAttribute('src'));
    if (src && bg.getAttribute('data-src') !== src) { bg.setAttribute('data-src', src); bg.style.backgroundImage = 'url("' + src.replace(/"/g, '%22') + '")'; document.documentElement.style.setProperty('--mf-tira-foto', bg.style.backgroundImage); }
  }
  function revisar() {
    var enInicio = false; try { enInicio = pg === 'home'; } catch (e) { enInicio = false; }
    t.hidden = !enInicio;
    if (enInicio) { textos(); foto(); }
  }
  t.addEventListener('click', function (e) {
    if (e.target.closest && e.target.closest('[data-tira-desc]') && typeof window.mfAbrirBienvenida === 'function') window.mfAbrirBienvenida();
  });
  new MutationObserver(function () { try { revisar(); } catch (e) { /* nada */ } }).observe(app, { childList: true, subtree: true });
  addEventListener('popstate', function () { setTimeout(revisar, 0); });
  revisar(); setTimeout(revisar, 1500); setTimeout(revisar, 4000);
})();
