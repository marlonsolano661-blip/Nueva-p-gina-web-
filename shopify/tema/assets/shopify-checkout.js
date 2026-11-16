/* Pago con Shopify desde la tienda de Netlify.
   El diseño y la bolsa siguen siendo los de esta página; al tocar "Pagar en línea" (o "Pagar ahora")
   la clienta pasa al checkout de Shopify con los mismos productos y tallas.

   Necesita DATA/shopify-variantes.js (id de producto → talla[|color] → variante de Shopify).
   Para volver al pago con Wompi sin borrar nada: poner MF_SHOPIFY.activo = false. */
(function () {
  'use strict';
  var CFG = window.MF_SHOPIFY = Object.assign({ tienda: 'npckie-04.myshopify.com', activo: true }, window.MF_SHOPIFY || {});

  function aviso(m) { if (typeof toast === 'function') toast(m); else alert(m); }
  function bolsa() { try { return typeof CART !== 'undefined' ? CART : []; } catch (e) { return []; } }

  // Busca la variante: talla + color exacto, luego solo talla, luego la primera de esa talla con cualquier color
  function variante(l) {
    var m = (window.MF_SHOPIFY_VARIANTES || {})[String(l.id)];
    if (!m) return null;
    var t = String(l.talla || ''), c = String(l.color || '');
    if (c && m[t + '|' + c]) return m[t + '|' + c];
    if (m[t]) return m[t];
    for (var k in m) if (k.split('|')[0] === t) return m[k];
    return null;
  }

  function urlCheckout(items) {
    var u = 'https://' + CFG.tienda + '/cart/' + items.map(function (x) { return x.v + ':' + x.q; }).join(',');
    var q = ['ref=mfcol'];
    var cod = '';
    try { cod = window.mfCodigo ? String(window.mfCodigo() || '') : ''; } catch (e) {}
    if (cod) q.push('discount=' + encodeURIComponent(cod));
    return u + '?' + q.join('&');
  }

  document.addEventListener('click', function (e) {
    if (!CFG.activo) return;
    var b = e.target && e.target.closest ? e.target.closest('[data-n="go"][data-p="out"],[data-n="topay"]') : null;
    if (!b || b.disabled) return;
    var C = bolsa();
    if (!C.length) return;
    // Si hay algo agotado, dejamos que la tienda muestre su aviso
    try { if (typeof agotada === 'function' && C.some(agotada)) return; } catch (err) {}

    var items = [], faltan = [];
    C.forEach(function (l) {
      var v = variante(l);
      if (v) items.push({ v: v, q: Math.max(1, +l.q || 1) });
      else faltan.push(l.name || l.id);
    });
    // Si un producto no está en Shopify, seguimos con el pago de siempre para no perder la venta
    if (faltan.length) { console.warn('[MF] Sin variante en Shopify:', faltan); return; }

    e.stopImmediatePropagation(); e.preventDefault();
    try { if (window.fbq) fbq('track', 'InitiateCheckout', { currency: 'COP', num_items: items.length }); } catch (err) {}
    b.disabled = true;
    aviso('Te llevamos al pago seguro…');
    location.href = urlCheckout(items);
  }, true);

  // Si vuelve atrás desde el checkout, el botón queda activo otra vez
  window.addEventListener('pageshow', function () {
    document.querySelectorAll('[data-n="go"][data-p="out"],[data-n="topay"]').forEach(function (b) { b.disabled = false; });
  });
})();
