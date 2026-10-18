/* Checkout aislado. No contiene credenciales y exige consentimiento explícito de WhatsApp. */
(function () {
  'use strict';
  var consent = false;
  var observer = new MutationObserver(function () {
    var button = document.querySelector('[data-n="topay"]');
    if (!button) return;
    var label = document.getElementById('mf-wa');
    if (!label) {
      label = document.createElement('label');
      label.id = 'mf-wa';
      label.style.cssText = 'display:flex;gap:.6rem;align-items:flex-start;margin:.9rem 0;font-size:.92rem;line-height:1.45;cursor:pointer';
      label.innerHTML = '<input type="checkbox" style="margin-top:.2rem;width:1.1rem;height:1.1rem;flex:none"><span>Quiero recibir actualizaciones de mi pedido por WhatsApp. Puedes retirar tu autorización cuando quieras.</span>';
      label.querySelector('input').addEventListener('change', function (e) { consent = e.target.checked; });
    }
    button.before(label);
  });
  if (document.body) observer.observe(document.body, { childList: true, subtree: true });
  function cookie(name) {
    var match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
    return match ? decodeURIComponent(match[1]) : '';
  }
  document.addEventListener('click', async function (event) {
    var button = event.target.closest('[data-n="topay"]');
    if (!button) return;
    event.preventDefault(); event.stopImmediatePropagation();
    var notify = function (message) { if (typeof window.toast === 'function') window.toast(message); else window.alert(message); };
    var form = typeof FRM !== 'undefined' ? FRM : {};
    var cart = typeof CART !== 'undefined' && Array.isArray(CART) ? CART : [];
    if (!cart.length) return notify('Tu carrito está vacío.');
    if (![form.nombre, form.tel, form.ciudad, form.dir].every(function (v) { return String(v || '').trim(); })) return notify('Completa tus datos de entrega.');
    if (button.disabled) return;
    var oldText = button.textContent; button.disabled = true; button.textContent = 'Preparando pedido…';
    try {
      var response = await fetch('/api/crear-pedido', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: cart.map(function (line) { return { id: String(line.id), talla: String(line.talla || ''), cant: Number(line.q || line.cant || 0) }; }),
          consent_wa: consent, meta: { fbp: cookie('_fbp'), fbc: cookie('_fbc') },
          cliente: { nombre: form.nombre, tel: form.tel, ciudad: form.ciudad, direccion: String(form.dir) + ', ' + String(form.ciudad), nota: form.nota || '' } }) });
      var data = await response.json().catch(function () { return {}; });
      if (!response.ok) throw new Error(data.error || 'No pudimos preparar tu pedido. Intenta de nuevo.');
      if (!data.url || !/^https:\/\/checkout\.wompi\.co\//.test(data.url)) throw new Error('El checkout no devolvió una dirección válida.');
      window.location.assign(data.url);
    } catch (error) { notify(error.message || 'No pudimos preparar tu pedido.'); button.disabled = false; button.textContent = oldText; }
  }, true);
})();