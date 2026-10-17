/* Conecta "Pagar en línea" con el checkout de Wompi.
   Flujo: Pagar en línea → Datos de entrega → botón "Pagar $…" → checkout de Wompi.
   Agregar en index.html, justo antes de </body>:  <script src="pago-online.js"></script>

   Requiere que index.html tenga (como ya lo tiene tu tienda): el botón [data-n="topay"],
   el objeto FRM {nombre, tel, ciudad, dir, nota} y el arreglo CART [{id, talla, q}].
   Todo va dentro de una función para no chocar con nombres de variables de index.html. */
(function () {
  'use strict';
  var WA_OK = false; // el permiso de WhatsApp debe darlo la clienta: la casilla empieza SIN marcar
  var API = window.MF_API_BASE || ''; // vacío = mismo dominio
  var enviando = false;

  function aviso(m) { if (typeof toast === 'function') toast(m); else alert(m); }
  function cookie(n) { var m = document.cookie.match('(?:^|; )' + n + '=([^;]*)'); return (m && m[1]) || ''; }

  // Casilla de permiso de WhatsApp (se reinserta cada vez que la tienda redibuja la página)
  function casilla() {
    var b = document.querySelector('[data-n="topay"]');
    if (!b || document.getElementById('mf-wa')) return;
    var l = document.createElement('label');
    l.id = 'mf-wa';
    l.style.cssText = 'display:flex;gap:.6rem;align-items:flex-start;margin:.9rem 0;font-size:.92rem;line-height:1.45;cursor:pointer';
    var i = document.createElement('input');
    i.type = 'checkbox'; i.checked = WA_OK;
    i.style.cssText = 'margin-top:.2rem;width:1.1rem;height:1.1rem;flex:none';
    i.onchange = function (e) { WA_OK = e.target.checked; };
    var s = document.createElement('span');
    s.textContent = 'Quiero recibir actualizaciones de mi pedido por WhatsApp. Puedes dejar de recibirlas cuando quieras.';
    l.appendChild(i); l.appendChild(s);
    b.parentNode.insertBefore(l, b);
  }
  if (document.body) { new MutationObserver(casilla).observe(document.body, { childList: true, subtree: true }); casilla(); }

  document.addEventListener('click', function (e) {
    var b = e.target && e.target.closest ? e.target.closest('[data-n="topay"]') : null;
    if (!b) return;
    // Si la página no tiene lo que necesitamos, no interceptamos el clic
    if (typeof FRM === 'undefined' || typeof CART === 'undefined') return;
    e.stopImmediatePropagation(); e.preventDefault();
    if (enviando || b.disabled) return;

    var c = FRM;
    var completo = [c.nombre, c.tel, c.ciudad, c.dir].every(function (v) { return String(v == null ? '' : v).trim(); });
    if (!completo) return aviso('Completa tus datos de entrega');
    if (!CART.length) return aviso('Tu carrito está vacío');

    enviando = true;
    var textoOriginal = b.textContent;
    b.disabled = true; b.textContent = 'Un momento…';
    var ctl = new AbortController();
    var corte = setTimeout(function () { ctl.abort(); }, 20000);

    fetch(API + '/api/crear-pedido', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: ctl.signal,
      body: JSON.stringify({
        items: CART.map(function (l) { return { id: l.id, talla: l.talla, cant: l.q != null ? l.q : l.cant }; }),
        consent_wa: WA_OK,
        meta: { fbp: cookie('_fbp'), fbc: cookie('_fbc') },
        cliente: { nombre: c.nombre, tel: c.tel, email: c.email || '', ciudad: c.ciudad, direccion: c.dir + ', ' + c.ciudad, nota: c.nota || '' },
      }),
    })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { if (!r.ok) throw new Error(d.error || 'No pudimos iniciar el pago. Intenta de nuevo.'); return d; }); })
      .then(function (d) {
        // Solo se redirige al checkout oficial de Wompi
        if (typeof d.url !== 'string' || d.url.indexOf('https://checkout.wompi.co/') !== 0) throw new Error('Respuesta inesperada. Intenta de nuevo.');
        (window.MF_REDIRECT || function (u) { location.href = u; })(d.url);
      })
      .catch(function (x) {
        aviso(x && x.name === 'AbortError' ? 'Tardó demasiado. Revisa tu conexión e intenta de nuevo.' : (x && x.message) || 'No pudimos iniciar el pago. Intenta de nuevo.');
        enviando = false; b.disabled = false; b.textContent = textoOriginal;
      })
      .then(function () { clearTimeout(corte); });
  }, true);
})();
