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
    if (window.mfRef && window.mfRef.chip && document.getElementById('lista')) { window.mfRef.chip(b.getAttribute('data-cf') || '', b); return; }
    window.MF_COL = b.getAttribute('data-cf') || '';
    try { Q = ''; } catch (e) { /* sin buscador */ }
    if (typeof draw === 'function') draw();
  });

  function aplicar(d, sinDibujar) {
    if (!d || !Array.isArray(d.productos)) throw new Error('Respuesta inesperada');
    window.MF_API_FIN = true; document.documentElement.classList.remove('mf-espera'); // ya respondió el servidor: se muestra la portada definitiva
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
    if (typeof draw === 'function' && !sinDibujar) draw();
    abrirEnlace(d.productos);
  }

  // Enlace directo a un producto (/?producto=<id>): lo usan los anuncios y el catálogo de Meta. Solo si el producto existe; se abre una sola vez.
  var enlaceUsado = false;
  function abrirEnlace(productos) {
    if (enlaceUsado) return; enlaceUsado = true;
    try {
      var m = /[?&]producto=([^&#]+)/.exec(location.search); if (!m) return;
      var id = decodeURIComponent(m[1]);
      var p = productos.filter(function (x) { return String(x.id) === id; })[0];
      if (p && typeof nav === 'function') nav('prod', p.id);
    } catch (e) { /* enlace inválido: se queda en la portada */ }
  }

  // Copia del último catálogo en el navegador: en las visitas siguientes la tienda se pinta al instante con esa copia
  // y se actualiza en segundo plano con lo que responda el servidor (nunca se inventan datos: es lo último que mandó el servidor).
  var CLAVE = 'mf_cat_v1', VIDA = 7 * 24 * 3600 * 1000, textoGuardado = '', yaMostrado = false;
  function guardarCopia(txt) { try { localStorage.setItem(CLAVE, JSON.stringify({ t: Date.now(), d: txt })); } catch (e) { /* sin espacio o sin almacenamiento */ } }
  try {
    var g = JSON.parse(localStorage.getItem(CLAVE) || 'null');
    if (g && typeof g.d === 'string' && Date.now() - g.t < VIDA) { aplicar(JSON.parse(g.d)); textoGuardado = g.d; yaMostrado = true; }
  } catch (e) { /* copia dañada: se ignora */ }

  var ctl = new AbortController(), t = setTimeout(function () { ctl.abort(); }, 8000);
  fetch(API + '/api/catalogo', { signal: ctl.signal, headers: { Accept: 'application/json' } })
    .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .then(function (d) {
      if (!d || !Array.isArray(d.productos)) throw new Error('Respuesta inesperada');
      var txt = JSON.stringify(d);
      if (txt === textoGuardado) { clearTimeout(t); return; } // igual a lo que ya se mostró: no se redibuja nada
      guardarCopia(txt);
      // Si la persona está pagando, los datos se actualizan sin redibujar (no se pierde lo que está escribiendo)
      aplicar(d, yaMostrado && typeof pg !== 'undefined' && pg === 'out');
    })
    .catch(function (e) {
      if (window.console) console.warn('[tienda] catálogo del servidor no disponible; se usa el estático', e && e.message);
      window.MF_API_FIN = true; document.documentElement.classList.remove('mf-espera'); // sin servidor: se muestra la portada de siempre
      if (typeof draw === 'function') draw();
    })
    .then(function () { clearTimeout(t); });
})();
