/* Píxel de Meta (el mismo píxel "mfcolweb" de la tienda anterior, para conservar historial y audiencias).
   - Solo se activa en el dominio real de la tienda (DOMINIOS). En las direcciones de prueba (netlify.app) NO envía nada,
     para no ensuciar las estadísticas de Meta con visitas y compras de prueba.
   - Para probar en una dirección de prueba con "Probar eventos" de Meta: abre la tienda con ?mfpixel=1 (queda activo en esa pestaña).
   - Eventos: PageView, ViewContent, AddToCart, InitiateCheckout y Purchase (Purchase está APAGADO hasta que COMPRA = true). */
(function () {
  'use strict';
  var ID = '1092821839891082';
  var DOMINIOS = ['tienda.mfcol.com', 'mfcol.com', 'www.mfcol.com'];
  var COMPRA = true; // Purchase se envía solo tras APPROVED; en Preview el Pixel requiere ?mfpixel=1.

  var host = String(location.hostname || '').toLowerCase();
  var activo = DOMINIOS.indexOf(host) >= 0;
  try {
    if (/[?&]mfpixel=1(&|$)/.test(location.search)) sessionStorage.setItem('mf_px', '1');
    if (sessionStorage.getItem('mf_px') === '1') activo = true;
  } catch (e) { /* sin almacenamiento */ }

  var px = window.mfPx = { activo: activo, compraActiva: COMPRA };
  function ev(nombre, datos, id) { try { if (activo && window.fbq) { if (id) window.fbq('track', nombre, datos || {}, { eventID: id }); else window.fbq('track', nombre, datos || {}); } } catch (e) { /* nunca rompe la tienda */ } }
  px.evento = ev;
  if (!activo) { px.compra = function () {}; return; }

  /* Código base oficial del píxel */
  !function (f, b, e, v, n, t, s) { if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); }; if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0'; n.queue = []; t = b.createElement(e); t.async = !0; t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s); }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
  window.fbq('init', ID);
  window.fbq('track', 'PageView');

  var MON = 'COP';
  function prod(id) { try { return (typeof catalog === 'function' ? catalog() : []).find(function (x) { return String(x.id) === String(id); }) || null; } catch (e) { return null; } }
  function lineas() { try { return (typeof CART !== 'undefined' ? CART : []).map(function (l) { return { id: String(l.id), quantity: l.q || 1, item_price: l.price }; }); } catch (e) { return []; } }

  /* Tienda (index.html): se envuelven las funciones existentes sin cambiar su comportamiento */
  if (typeof window.add === 'function') {
    var add0 = window.add;
    window.add = function (id) {
      var r = add0.apply(this, arguments);
      if (r) { var p = prod(id); if (p) ev('AddToCart', { content_ids: [String(p.id)], content_name: p.name, content_type: 'product', value: p.price, currency: MON }); }
      return r;
    };
  }
  if (typeof window.nav === 'function') {
    var nav0 = window.nav;
    window.nav = function (p, a) {
      var r = nav0.apply(this, arguments);
      try {
        if (p === 'prod') { var q = prod(a); if (q) ev('ViewContent', { content_ids: [String(q.id)], content_name: q.name, content_type: 'product', value: q.price, currency: MON }); }
        else if (p === 'out') { var L = lineas(); if (L.length) ev('InitiateCheckout', { content_ids: L.map(function (x) { return x.id; }), contents: L, content_type: 'product', num_items: L.reduce(function (t, x) { return t + x.quantity; }, 0), value: typeof total === 'function' ? total() : 0, currency: MON }); }
      } catch (e) { /* nada */ }
      return r;
    };
  }

  /* Página de gracias: una sola vez por pedido y solo con pago aprobado */
  px.compra = function (p) {
    if (!COMPRA || !p || p.estado_pago !== 'APPROVED' || !p.reference) return;
    var clave = 'mf_px_p_' + p.reference;
    try { if (localStorage.getItem(clave)) return; localStorage.setItem(clave, '1'); } catch (e) { /* si no hay almacenamiento, igual se envía una vez por carga */ }
    var n = (p.items || []).reduce(function (t, i) { return t + (Number(i.cant) || 0); }, 0);
    ev('Purchase', { value: Number(p.amount_in_cents) / 100, currency: MON, content_type: 'product', num_items: n }, String(p.reference));
  };
})();
