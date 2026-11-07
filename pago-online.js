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
    var mp = document.querySelector('input[name="ck-mp"]:checked');
    var conTarjeta = mp && mp.value === 'tarjeta';
    var tj = null;
    if (conTarjeta) { tj = leerTarjeta(); if (typeof tj === 'string') return aviso(tj); }

    enviando = true;
    var textoOriginal = b.innerHTML; // conserva la flecha del botón
    ultimo = { b: b, html: textoOriginal };
    b.disabled = true; b.textContent = 'Un momento…';
    var ctl = new AbortController();
    var corte = setTimeout(function () { ctl.abort(); }, 20000);

    var lineas = CART.map(function (l) { var x = { id: l.id, talla: l.talla, cant: l.q != null ? l.q : l.cant }; if (l.color) x.color = l.color; return x; });
    // total que la clienta vio (productos + envío); el servidor lo recalcula y avisa si cambió
    var esperado = (typeof total === 'function' && typeof window.MF_ENVIO === 'number') ? total() - (window.mfDescuento ? window.mfDescuento() : 0) + window.MF_ENVIO : undefined;
    if (conTarjeta) {
      b.textContent = 'Procesando pago…';
      return pagarConTarjeta(tj, lineas, esperado, c).catch(function (x) {
        aviso((x && x.message) || 'No pudimos procesar la tarjeta. Inténtalo de nuevo.');
        try { sessionStorage.removeItem('mf_clave'); } catch (e2) { /* nada */ }
        enviando = false; b.disabled = false; b.innerHTML = textoOriginal;
      }).then(function () { clearTimeout(corte); });
    }
    fetch(API + '/api/crear-pedido', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: ctl.signal,
      body: JSON.stringify({
        items: lineas, clave: clave(lineas, c) || undefined, total_esperado: esperado, codigo: (window.mfCodigo && window.mfCodigo()) || undefined,
        consent_wa: WA_OK, novedades: !!c.news,
        meta: { fbp: cookie('_fbp'), fbc: cookie('_fbc') },
        cliente: { nombre: c.nombre, documento: c.doc || '', tel: c.tel, email: c.email || '', ciudad: c.ciudad, direccion: c.dir + ', ' + c.ciudad, nota: c.nota || '' },
      }),
    })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { if (!r.ok) throw new Error(d.error || 'No pudimos iniciar el pago. Intenta de nuevo.'); return d; }); })
      .then(function (d) {
        // Solo se redirige al checkout oficial de Wompi
        if (typeof d.url !== 'string' || d.url.indexOf('https://checkout.wompi.co/') !== 0) throw new Error('Respuesta inesperada. Intenta de nuevo.');
        if (window.MF_REDIRECT) return window.MF_REDIRECT(d.url);
        // Interruptor de emergencia: si el widget diera problemas en celulares, cambia WIDGET_EN_CELULAR a false y en celular se usa la página de pago de Wompi (sale del dominio).
        if (!WIDGET_EN_CELULAR && ES_CELULAR) { location.href = d.url; return; }
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

  /* ---------- Pago con tarjeta dentro de la tienda (como un checkout de Shopify) ----------
     1) El navegador manda la tarjeta DIRECTO a Wompi (llave pública) y recibe un token.
     2) El servidor crea el pedido con el monto real y cobra ese token (firma de integridad).
     3) Se consulta el estado; aprobado → gracias.html, rechazado → se avisa aquí mismo y se puede reintentar. */
  var CONF = null, confProm = null, sinConf = false;
  function config() {
    if (CONF) return Promise.resolve(CONF);
    if (!confProm) confProm = fetch(API + '/api/pago-config').then(function (r) { if (!r.ok) throw new Error('config'); return r.json(); })
      .then(function (d) { CONF = d; enlaces(); return d; }).catch(function (e) { confProm = null; throw e; });
    return confProm;
  }
  function enlaces() {
    if (!CONF) return;
    var a = document.getElementById('tj-l1'), d = document.getElementById('tj-l2');
    if (a && CONF.terminos && CONF.terminos.url) a.href = CONF.terminos.url;
    if (d && CONF.datos && CONF.datos.url) d.href = CONF.datos.url;
  }
  function digitos(v) { return String(v || '').replace(/\D/g, ''); }
  function luhn(n) { var s = 0, alt = false; for (var i = n.length - 1; i >= 0; i--) { var d = +n[i]; if (alt) { d *= 2; if (d > 9) d -= 9; } s += d; alt = !alt; } return s % 10 === 0; }
  function val(id) { var e = document.getElementById(id); return e ? e.value : ''; }
  function leerTarjeta() {
    var num = digitos(val('tj-num')), exp = digitos(val('tj-exp')), cvc = digitos(val('tj-cvc')), nom = String(val('tj-nom') || (typeof FRM !== 'undefined' ? FRM.nombre : '')).trim();
    if (num.length < 13 || num.length > 19 || !luhn(num)) return 'Revisa el número de la tarjeta';
    if (exp.length !== 4) return 'Escribe la fecha de vencimiento como MM / AA';
    var mm = +exp.slice(0, 2), aa = +exp.slice(2), hoy = new Date(), ya = hoy.getFullYear() % 100;
    if (mm < 1 || mm > 12 || aa < ya || (aa === ya && mm < hoy.getMonth() + 1)) return 'La fecha de vencimiento no es válida';
    if (!/^\d{3,4}$/.test(cvc)) return 'Revisa el código de seguridad';
    if (nom.length < 3) return 'Escribe el nombre del titular como aparece en la tarjeta';
    var acp = document.getElementById('tj-acp');
    if (!acp || !acp.checked) return 'Acepta el reglamento de Wompi y el tratamiento de datos para pagar';
    return { number: num, exp_month: exp.slice(0, 2), exp_year: exp.slice(2), cvc: cvc, card_holder: nom.slice(0, 60), cuotas: +(val('tj-cuo') || 1) };
  }
  function limpiarTarjeta() { ['tj-num', 'tj-exp', 'tj-cvc'].forEach(function (id) { var e = document.getElementById(id); if (e) e.value = ''; }); }
  function json(r) { return r.json().catch(function () { return {}; }); }
  function pagarConTarjeta(t, lineas, esperado, c) {
    var conf;
    return config().catch(function () { throw new Error('El pago con tarjeta no está disponible ahora. Elige Wompi para pagar.'); })
      .then(function (d) {
        conf = d;
        return fetch(d.api + '/tokens/cards', {
          method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + d.pub },
          body: JSON.stringify({ number: t.number, exp_month: t.exp_month, exp_year: t.exp_year, cvc: t.cvc, card_holder: t.card_holder }),
        });
      })
      .then(function (r) { return json(r).then(function (j) { if (!r.ok || !j.data || !j.data.id) throw new Error('Revisa los datos de la tarjeta: Wompi no la aceptó.'); return j.data.id; }); })
      .then(function (token) {
        t.number = t.cvc = ''; // no se guardan en memoria más de lo necesario
        return fetch(API + '/api/crear-pedido', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: lineas, clave: nuevaClave(), total_esperado: esperado, codigo: (window.mfCodigo && window.mfCodigo()) || undefined,
            consent_wa: WA_OK, novedades: !!c.news, meta: { fbp: cookie('_fbp'), fbc: cookie('_fbc') },
            cliente: { nombre: c.nombre, documento: c.doc || '', tel: c.tel, email: c.email || '', ciudad: c.ciudad, direccion: c.dir + ', ' + c.ciudad, nota: c.nota || '' },
            tarjeta: { token: token, cuotas: t.cuotas, aceptacion: conf.terminos.token, datos: conf.datos ? conf.datos.token : '' },
          }),
        });
      })
      .then(function (r) { return json(r).then(function (d) { if (!r.ok || !d.transaccion) throw new Error(d.error || 'No pudimos procesar la tarjeta. Inténtalo de nuevo.'); return d; }); })
      .then(function (d) { return esperar(conf, d.transaccion, 0); });
  }
  // Clave nueva en cada intento con tarjeta: cada intento es un cobro distinto en Wompi
  function nuevaClave() { return (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2); }
  function irAGracias(id) { location.href = 'gracias.html?id=' + encodeURIComponent(id); }
  function esperar(conf, id, n) {
    return fetch(conf.api + '/transactions/' + encodeURIComponent(id)).then(json).catch(function () { return {}; }).then(function (j) {
      var t = j.data || {};
      if (t.status === 'APPROVED') return irAGracias(id);
      if (t.status === 'DECLINED' || t.status === 'ERROR' || t.status === 'VOIDED') {
        limpiarTarjeta();
        throw new Error('Tu banco rechazó el pago' + (t.status_message ? ': ' + t.status_message : '') + '. Prueba con otra tarjeta o elige Wompi.');
      }
      // Sigue pendiente (p. ej. validación del banco): la página de confirmación sigue consultando sola
      if (n >= 15) return irAGracias(id);
      return new Promise(function (ok) { setTimeout(ok, 2000); }).then(function () { return esperar(conf, id, n + 1); });
    });
  }

  // Cambiar de medio de pago muestra su panel; el formato de los campos ayuda a escribir la tarjeta
  document.addEventListener('change', function (e) {
    if (!e.target || e.target.name !== 'ck-mp') return;
    window.MF_MP = e.target.value;
    document.querySelectorAll('.ck-pn').forEach(function (p) { p.hidden = p.getAttribute('data-mp') !== e.target.value; });
  });
  document.addEventListener('input', function (e) {
    var id = e.target && e.target.id, v;
    if (id === 'tj-num') { v = digitos(e.target.value).slice(0, 19); e.target.value = v.replace(/(\d{4})(?=\d)/g, '$1 '); }
    else if (id === 'tj-exp') { v = digitos(e.target.value).slice(0, 4); e.target.value = v.length > 2 ? v.slice(0, 2) + ' / ' + v.slice(2) : v; }
    else if (id === 'tj-cvc') { e.target.value = digitos(e.target.value).slice(0, 4); }
    else if (id === 'tj-nom') { e.target.dataset.propio = '1'; }
    else if (id === 'f-nombre') { var n = document.getElementById('tj-nom'); if (n && !n.dataset.propio) n.value = e.target.value; }
  });
  // Al llegar al pago se cargan los contratos de Wompi (enlaces vigentes) sin esperar al clic
  if (document.body) new MutationObserver(function () { if (document.getElementById('tj-acp')) { if (CONF) enlaces(); else if (!sinConf) config().catch(function () { sinConf = true; }); } }).observe(document.body, { childList: true, subtree: true });

  var WIDGET_EN_CELULAR = false;
  var ES_CELULAR = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
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
