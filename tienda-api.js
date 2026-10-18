/* Conecta la tienda con el servidor: catálogo, tarifa de envío y contenido administrables.
   Fuente única: /api/catalogo (Supabase). Si no responde, la tienda sigue con el catálogo estático de DATA/.
   Se carga en index.html después del script principal (usa su función draw()). */
(function () {
  'use strict';
  var API = window.MF_API_BASE || '';

  // Botones de colección (solo si el administrador creó colecciones visibles)
  window.mfChips = function () {
    var c = window.MF_CONTENIDO && window.MF_CONTENIDO.colecciones;
    if (!c || !c.length) return '';
    var esc = function (t) { return String(t).replace(/[&<>"']/g, function (m) { return '&#' + m.charCodeAt(0) + ';'; }); };
    var chip = function (id, nombre) {
      var on = (window.MF_COL || '') === id;
      return '<button class="btn s' + (on ? '' : ' o') + '" data-cf="' + esc(id) + '" aria-pressed="' + on + '" style="margin:.2rem">' + esc(nombre) + '</button>';
    };
    return '<div class="ctr" style="margin-bottom:1.2rem">' + chip('', 'Todas') + c.filter(function (x) { return x.visible !== false; }).map(function (x) { return chip(x.id, x.nombre); }).join('') + '</div>';
  };
  document.addEventListener('click', function (e) {
    var b = e.target && e.target.closest ? e.target.closest('[data-cf]') : null;
    if (!b) return;
    window.MF_COL = b.getAttribute('data-cf') || '';
    if (typeof draw === 'function') draw();
  });

  function aplicar(d) {
    if (!d || !Array.isArray(d.productos)) throw new Error('Respuesta inesperada');
    window.MF_CATALOGO_PRODUCTOS = d.productos;
    window.MF_ENVIO = d.envio && Number.isInteger(d.envio.tarifa) ? d.envio.tarifa : undefined;
    window.MF_CONTENIDO = d.contenido || {};
    window.MF_API_OK = true;
    // El carrito guardado puede traer precios viejos: se actualizan con los del servidor (el servidor igual recalcula)
    try {
      if (typeof CART !== 'undefined') {
        CART.forEach(function (l) { var p = d.productos.filter(function (x) { return String(x.id) === String(l.id); })[0]; if (p) { l.price = p.price; l.name = p.name; } });
        if (typeof saveCart === 'function') saveCart();
      }
    } catch (e) { /* sin carrito */ }
    if (typeof draw === 'function') draw();
  }

  var ctl = new AbortController(), t = setTimeout(function () { ctl.abort(); }, 8000);
  fetch(API + '/api/catalogo', { signal: ctl.signal, headers: { Accept: 'application/json' } })
    .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .then(aplicar)
    .catch(function (e) { if (window.console) console.warn('[tienda] catálogo del servidor no disponible; se usa el estático', e && e.message); })
    .then(function () { clearTimeout(t); });
})();
