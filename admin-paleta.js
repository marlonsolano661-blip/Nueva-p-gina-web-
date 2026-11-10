/* Colores extra en la paleta de Productos: se agregan junto a los de admin-tienda.js y funcionan igual
   (un toque agrega el color con su nombre y su código). Para sumar otro, agrégalo a EXTRA. */
(function () {
  'use strict';
  if (window.__mfPaletaExtra) return; window.__mfPaletaExtra = 1;
  var EXTRA = [['Rojo charol', '#C8303A', 'Rojo']]; // nombre, código, va después de este color
  function enLista(filas, n) {
    return Array.prototype.some.call(filas.querySelectorAll('input.cnom'), function (i) { return i.value.trim().toLowerCase() === n.toLowerCase(); });
  }
  function agregar(paleta) {
    var cont = paleta.parentNode, filas = cont && cont.querySelector('#f-cols');
    if (!filas) return;
    EXTRA.forEach(function (x) {
      if (paleta.querySelector('button.pal[data-n="' + x[0] + '"]')) return;
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'pal'; b.title = x[0] + ' ' + x[1];
      b.setAttribute('data-n', x[0]); b.setAttribute('data-h', x[1]);
      var i = document.createElement('i'); i.style.background = x[1];
      var s = document.createElement('span'); s.textContent = x[0];
      var m = document.createElement('small'); m.textContent = x[1];
      b.appendChild(i); b.appendChild(s); b.appendChild(m);
      b.addEventListener('click', function () {
        if (enLista(filas, x[0])) { if (window.mfAdmin) window.mfAdmin.msg('"' + x[0] + '" ya está en la lista', true); return; }
        var otro = Array.prototype.filter.call(cont.querySelectorAll('button'), function (k) { return /Otro color/.test(k.textContent); })[0];
        if (!otro) return;
        otro.click();
        var fila = filas.lastElementChild; if (!fila) return;
        var nom = fila.querySelector('input.cnom'), hex = fila.querySelector('input.chex');
        nom.value = x[0]; hex.value = x[1];
        hex.dispatchEvent(new Event('input')); nom.dispatchEvent(new Event('input'));
        nom.blur();
      });
      var antes = paleta.querySelector('button.pal[data-n="' + x[2] + '"]');
      if (antes && antes.nextSibling) paleta.insertBefore(b, antes.nextSibling); else paleta.appendChild(b);
      b.classList.toggle('on', Array.prototype.some.call(filas.querySelectorAll('.color'), function (f) {
        return f.querySelector('input.cnom').value.trim().toLowerCase() === x[0].toLowerCase() && f.querySelector('input.chex').value.trim().toLowerCase() === x[1].toLowerCase();
      }));
    });
  }
  function revisar() { document.querySelectorAll('.paleta').forEach(agregar); }
  new MutationObserver(revisar).observe(document.body, { childList: true, subtree: true });
  revisar();
})();
