/* Favoritos de la clienta: el corazón de cada tarjeta guarda el modelo en este teléfono (localStorage).
   La lista se ve en el menú, en "Mis favoritos". No se envía a ningún servidor. */
(function () {
  'use strict';
  var K = 'mf_favs';
  function leer() { try { var v = JSON.parse(localStorage.getItem(K)); return Array.isArray(v) ? v.map(String).slice(0, 100) : []; } catch (e) { return []; } }
  var F = leer();
  function guardar() { try { localStorage.setItem(K, JSON.stringify(F)); } catch (e) { /* sin espacio o modo privado: dura esta visita */ } }
  function marcar(id, on) {
    Array.prototype.forEach.call(document.querySelectorAll('[data-fav]'), function (b) { if (b.getAttribute('data-fav') === String(id)) b.setAttribute('aria-pressed', String(on)); });
  }
  window.mfFavs = {
    lista: function () { return F.slice(); },
    tiene: function (id) { return F.indexOf(String(id)) >= 0; },
    poner: function (id) { id = String(id); if (F.indexOf(id) < 0) { F.unshift(id); guardar(); } marcar(id, true); },
    quitar: function (id) { id = String(id); F = F.filter(function (x) { return x !== id; }); guardar(); marcar(id, false); }
  };
  /* En fase de captura para que tocar el corazón no abra el producto */
  window.addEventListener('click', function (e) {
    var b = e.target && e.target.closest ? e.target.closest('[data-fav]') : null; if (!b) return;
    e.preventDefault(); e.stopPropagation();
    var id = b.getAttribute('data-fav'), on = !window.mfFavs.tiene(id);
    if (on) window.mfFavs.poner(id); else window.mfFavs.quitar(id);
    if (typeof toast === 'function') {
      if (on) toast('Guardado en tus favoritos', 'Ver', function () { if (window.mfVerFavs) window.mfVerFavs(); });
      else toast('Quitado de tus favoritos');
    }
  }, true);
  window.addEventListener('storage', function (e) { if (e.key === K) { F = leer(); } });
})();

/* Carga "La vitrina" y las animaciones de navegación (vitrina.js), su lista de fotos sin fondo (DATA/recortes.js)
   y "El perchero" del inicio (perchero.js), que usa la misma lista y reemplaza a La vitrina cuando carga.
   Se cargan en orden y sin bloquear la página. Si no cargan, la tienda funciona igual. */
(function () {
  if (window.__mfVitrinaCarga || !document.getElementById('app')) return; window.__mfVitrinaCarga = 1;
  ['DATA/recortes.js', 'DATA/vestidos-demo.js', 'vitrina.js', 'perchero.js'].forEach(function (src) { var s = document.createElement('script'); s.src = src; s.async = false; document.body.appendChild(s); });
})();
