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
  var enviando = false, ultimo = null;

  // Clave de idempotencia: misma compra (mismo carrito y datos) = misma clave, así un reintento no crea otro pedido
  function clave(items, c) {
    var h = JSON.stringify([items, c.tel, c.dir, c.ciudad, window.mfCodigo ? window.mfCodigo() : '']);
    try {
      var g = JSON.parse(sessionStorage.getItem('mf_clave') || 'null');
      if (g && g.h === h) return g.k;
      var k = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2);
      sessionStorage.setItem('mf_clave', JSON.stringify({ h: h, k: k }));
      return k;
    } catch (e) { return ''; }
  }

  function aviso(m) { if (typeof toast === 'function') toast(m); else alert(m); }
  function cookie(n) { var m = document.cookie.match('(?:^|; )' + n + '=([^;]*)'); return (m && m[1]) || ''; }

  // Casilla de permiso de WhatsApp (se reinserta cada vez que la tienda redibuja la página)
  function casilla() {
    var b = document.querySelector('[data-n="topay"]');
    if (!b || document.getElementById('mf-wa')) return;
    var l = document.createElement('label');
    l.id = 'mf-wa';
    l.className = 'ck'; // clase de tu tienda; si no existe, el estilo en línea de respaldo la deja legible
    l.style.cssText = 'display:flex;gap:.7rem;align-items:flex-start;font-size:.95rem;margin:1.1rem 0;cursor:pointer';
    var i = document.createElement('input');
    i.type = 'checkbox'; i.checked = WA_OK;
    i.style.cssText = 'margin-top:.3rem;flex:none;accent-color:#1d5c45';
    i.onchange = function (e) { WA_OK = e.target.checked; };
    var s = document.createElement('span');
    s.textContent = 'Quiero recibir actualizaciones de mi pedido por WhatsApp. Puedes dejar de recibirlas cuando quieras.';
    l.appendChild(i); l.appendChild(s);
    b.parentNode.insertBefore(l, b);
  }
  if (document.body) { new MutationObserver(casilla).observe(document.body, { childList: true, subtree: true }); casilla(); }

  // Si la clienta vuelve atrás desde Wompi, el navegador puede restaurar la página con el botón bloqueado
  window.addEventListener('pageshow', function (e) {
    if (!e.persisted) return;
    enviando = false;
    if (ultimo) { ultimo.b.disabled = false; ultimo.b.innerHTML = ultimo.html; }
  });

  document.addEventListener('click', function (e) {
    var b = e.target && e.target.closest ? e.target.closest('[data-n="topay"]') : null;
    if (!b) return;
    // Si la página no tiene lo que necesitamos, no interceptamos el clic
    if (typeof FRM === 'undefined' || typeof CART === 'undefined') return;
    e.stopImmediatePropagation(); e.preventDefault();
    if (enviando || b.disabled) return;

    var c = FRM;
    var completo = [c.nombre, c.doc, c.email, c.tel, c.ciudad, c.dir].every(function (v) { return String(v == null ? '' : v).trim(); });
    if (!completo) return aviso('Completa tus datos de entrega');
    if (!/^\d{5,12}$/.test(String(c.doc).replace(/[\s.\-]/g, ''))) return aviso('Escribe el documento del titular (solo números)');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(c.email).trim())) return aviso('Escribe el correo del titular');
    if (!CART.length) return aviso('Tu carrito está vacío');

    enviando = true;
    var textoOriginal = b.innerHTML; // conserva la flecha del botón
    ultimo = { b: b, html: textoOriginal };
    b.disabled = true; b.textContent = 'Un momento…';
    var ctl = new AbortController();
    var corte = setTimeout(function () { ctl.abort(); }, 20000);

    var lineas = CART.map(function (l) { var x = { id: l.id, talla: l.talla, cant: l.q != null ? l.q : l.cant }; if (l.color) x.color = l.color; return x; });
    // total que la clienta vio (productos + envío); el servidor lo recalcula y avisa si cambió
    var esperado = (typeof total === 'function' && typeof window.MF_ENVIO === 'number') ? total() - (window.mfDescuento ? window.mfDescuento() : 0) + window.MF_ENVIO : undefined;
    fetch(API + '/api/crear-pedido', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: ctl.signal,
      body: JSON.stringify({
        items: lineas, clave: clave(lineas, c) || undefined, total_esperado: esperado, codigo: (window.mfCodigo && window.mfCodigo()) || undefined,
        consent_wa: WA_OK,
        meta: { fbp: cookie('_fbp'), fbc: cookie('_fbc') },
        cliente: { nombre: c.nombre, documento: c.doc || '', tel: c.tel, email: c.email || '', ciudad: c.ciudad, direccion: c.dir + ', ' + c.ciudad, nota: c.nota || '' },
      }),
    })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { if (!r.ok) throw new Error(d.error || 'No pudimos iniciar el pago. Intenta de nuevo.'); return d; }); })
      .then(function (d) {
        // Solo se redirige al checkout oficial de Wompi
        if (typeof d.url !== 'string' || d.url.indexOf('https://checkout.wompi.co/') !== 0) throw new Error('Respuesta inesperada. Intenta de nuevo.');
        if (window.MF_REDIRECT) return window.MF_REDIRECT(d.url);
        // El pago se abre encima de la tienda (widget oficial de Wompi) y el cliente no sale de tu dominio.
        // Si el widget no carga, se usa el checkout de siempre (misma URL firmada por el servidor).
        abrirWidget(d.url, function () { location.href = d.url; }, function () { enviando = false; b.disabled = false; b.innerHTML = textoOriginal; });
      })
      .catch(function (x) {
        aviso(x && x.name === 'AbortError' ? 'Tardó demasiado. Revisa tu conexión e intenta de nuevo.' : (x && x.message) || 'No pudimos iniciar el pago. Intenta de nuevo.');
        enviando = false; b.disabled = false; b.innerHTML = textoOriginal;
      })
      .then(function () { clearTimeout(corte); });
  }, true);
  // Abre el widget de Wompi con los mismos datos firmados que trae la URL del checkout (el servidor sigue siendo quien firma y fija el monto).
  function abrirWidget(url, alFallar, alCerrar) {
    var q, cfg;
    try {
      q = new URL(url).searchParams;
      cfg = { currency: q.get('currency'), amountInCents: Number(q.get('amount-in-cents')), reference: q.get('reference'), publicKey: q.get('public-key'),
        signature: { integrity: q.get('signature:integrity') }, redirectUrl: q.get('redirect-url') };
      var cd = { fullName: q.get('customer-data:full-name') || undefined, email: q.get('customer-data:email') || undefined };
      var tel = String(q.get('customer-data:phone-number') || '').replace(/\D/g, '');
      if (/^\d{10}$/.test(tel)) { cd.phoneNumber = tel; cd.phoneNumberPrefix = '+57'; }
      if (q.get('customer-data:legal-id')) { cd.legalId = q.get('customer-data:legal-id'); cd.legalIdType = q.get('customer-data:legal-id-type') || 'CC'; }
      cfg.customerData = cd;
      if (!cfg.reference || !cfg.publicKey || !cfg.signature.integrity || !cfg.amountInCents) throw new Error('datos');
    } catch (e) { return alFallar(); }
    var listo = false;
    function abrir() {
      if (listo) return; listo = true;
      try {
        new window.WidgetCheckout(cfg).open(function (res) {
          var t = res && res.transaction;
          // Con transacción: se vuelve a gracias.html?id=… igual que con el checkout normal. Sin ella (cerró el pago), se puede reintentar.
          if (t && t.id) location.href = cfg.redirectUrl + (cfg.redirectUrl.indexOf('?') < 0 ? '?' : '&') + 'id=' + encodeURIComponent(t.id);
          else alCerrar();
        });
      } catch (e) { alFallar(); }
    }
    if (window.WidgetCheckout) return abrir();
    var sc = document.createElement('script');
    sc.src = 'https://checkout.wompi.co/widget.js'; sc.async = true;
    var tope = setTimeout(function () { if (!listo) { listo = true; alFallar(); } }, 8000);
    sc.onload = function () { clearTimeout(tope); if (window.WidgetCheckout) abrir(); else if (!listo) { listo = true; alFallar(); } };
    sc.onerror = function () { clearTimeout(tope); if (!listo) { listo = true; alFallar(); } };
    document.head.appendChild(sc);
  }
})();
