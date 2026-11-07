/* Código de descuento en la tienda: caja en la bolsa y en el pago, y aviso flotante que pide el correo (si el panel anuncia un código).
   El descuento que se ve aquí es solo informativo: el servidor lo calcula y lo valida de nuevo al crear el pedido. */
(function () {
  'use strict';
  var API = window.MF_API_BASE || '';
  var RE = /^[A-Z0-9_-]{3,20}$/;
  var S = { codigo: '', pct: 0, texto: '', msg: '', espera: false };
  var E = function (t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (m) { return '&#' + m.charCodeAt(0) + ';'; }); };
  var fmt = function (n) { return typeof window.fmt === 'function' ? window.fmt(n) : '$' + Number(n).toLocaleString('es-CO'); };
  var subtotal = function () { try { return typeof total === 'function' ? total() : 0; } catch (e) { return 0; } };
  var wa = function () { try { return pg === 'out' && mode === 'wa'; } catch (e) { return false; } };

  try { var g = JSON.parse(sessionStorage.getItem('mf_desc') || 'null'); if (g && RE.test(g.codigo) && g.pct >= 1 && g.pct <= 90) { S.codigo = g.codigo; S.pct = g.pct; } } catch (e) { /* sin almacenamiento */ }
  function guardar() { try { sessionStorage.setItem('mf_desc', JSON.stringify(S.codigo ? { codigo: S.codigo, pct: S.pct } : null)); } catch (e) { /* nada */ } }
  function repintar() { try { if (typeof draw === 'function') draw(); } catch (e) { /* nada */ } }

  window.mfCodigo = function () { return S.codigo; };
  window.mfPctDescuento = function () { return S.pct; };
  window.mfDescuento = function () { return S.codigo && !wa() ? Math.floor(subtotal() * S.pct / 100) : 0; };
  window.mfDescBox = function () {
    if (wa() || !subtotal()) return '';
    if (S.codigo) return '<div class="dcb on"><span>Código <b>' + E(S.codigo) + '</b> aplicado · −' + S.pct + '%</span><button type="button" class="lk" data-dq="1">Quitar</button></div>';
    return '<form class="dcb" data-dform autocomplete="off"><input data-dcode type="text" maxlength="20" placeholder="Código de descuento" aria-label="Código de descuento" autocapitalize="characters" spellcheck="false" value="' + E(S.texto) + '"><button type="submit" class="btn o s"' + (S.espera ? ' disabled' : '') + '>' + (S.espera ? '…' : 'Aplicar') + '</button></form>' + (S.msg ? '<p class="dcm" role="status">' + E(S.msg) + '</p>' : '');
  };

  function aplicar(codigo) {
    codigo = String(codigo || '').trim().toUpperCase();
    if (!RE.test(codigo)) { S.msg = 'Escribe un código válido'; return repintar(); }
    var items = (typeof CART !== 'undefined' ? CART : []).map(function (l) { return { id: l.id, talla: l.talla, cant: l.q != null ? l.q : l.cant }; });
    if (!items.length) { S.msg = 'Agrega un producto a tu bolsa primero'; return repintar(); }
    S.espera = true; S.msg = ''; S.texto = codigo; repintar();
    fetch(API + '/api/descuento', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ codigo: codigo, items: items }) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { if (!r.ok) throw new Error(d.error || 'No pudimos validar el código'); return d; }); })
      .then(function (d) {
        if (d.ok) { S.codigo = d.codigo; S.pct = d.pct; S.texto = ''; S.msg = ''; guardar(); if (typeof toast === 'function') toast('Descuento del ' + d.pct + '% aplicado'); }
        else S.msg = d.error || 'Ese código no es válido';
      })
      .catch(function (e) { S.msg = (e && e.message) || 'No pudimos validar el código'; })
      .then(function () { S.espera = false; repintar(); });
  }

  document.addEventListener('input', function (e) { if (e.target && e.target.matches && e.target.matches('[data-dcode]')) { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ''); S.texto = e.target.value; } });
  document.addEventListener('submit', function (e) { var f = e.target && e.target.closest ? e.target.closest('[data-dform]') : null; if (!f) return; e.preventDefault(); aplicar(S.texto); });
  document.addEventListener('click', function (e) {
    var q = e.target && e.target.closest ? e.target.closest('[data-dq]') : null;
    if (q) { S.codigo = ''; S.pct = 0; S.msg = ''; guardar(); repintar(); return; }
    var a = e.target && e.target.closest ? e.target.closest('[data-dapply]') : null;
    if (a) { aplicar(a.getAttribute('data-dapply')); if (typeof openBag === 'function') openBag(); return; }
    var c = e.target && e.target.closest ? e.target.closest('[data-dcopy]') : null;
    if (c) { var cod = c.getAttribute('data-dcopy'); try { navigator.clipboard.writeText(cod).then(function () { if (typeof toast === 'function') toast('Código ' + cod + ' copiado'); }); } catch (x) { if (typeof toast === 'function') toast('Tu código: ' + cod); } }
  });

  /* Aviso flotante de bienvenida (diseño Marlon Footwear): tarjeta fija abajo, estilo aviso de cookies.
     Pide el correo y, solo después, el servidor entrega el código (/api/bienvenida).
     Si la clienta lo cierra, queda una pestaña pequeña "−X %" para volver a abrirlo. No se muestra en el pago ni si ya hay un código aplicado.
     Vista previa desde el panel: index.html?verpromo=1 lo abre siempre. */
  var CERRADO = 'mf_promo_cerrado', OK = 'mf_promo_ok', TABX = 'mf_promo_tab_x', fl = null, tab = null, RE_MAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, enviando = false, P = null;
  var PREVIA = /[?&]verpromo=1\b/.test(location.search);
  function ses(k) { try { return sessionStorage.getItem(k) === '1'; } catch (e) { return false; } }
  function setSes(k) { try { sessionStorage.setItem(k, '1'); } catch (e) { /* nada */ } }
  function enPago() { try { return pg === 'out'; } catch (e) { return false; } }
  function pintar(h) { if (fl) fl.querySelector('.mfp-c').innerHTML = h; }
  var LOGO = '<svg class="mfp-logo" viewBox="240 254 581 508" fill="currentColor" aria-hidden="true"><polygon points="246,260 426,548 606,260 607,756 570,756 570,388 426,617 283,388 283,756 246,756"/><rect x="606" y="323" width="209" height="37"/><rect x="606" y="521" width="161" height="37"/></svg>';
  function paso1(pct, msg) {
    pintar('<p class="mfp-ey">' + LOGO + '<span>Bienvenida</span></p>' +
      '<h2><b>' + pct + ' % OFF</b> en tu primer par</h2>' +
      '<p class="mfp-tx">Déjanos tu correo y recibe tu código al instante.</p>' +
      '<form class="mfp-f" novalidate><input type="email" name="email" inputmode="email" autocomplete="email" autocapitalize="off" placeholder="Tu correo electrónico" aria-label="Tu correo electrónico"><button type="submit" class="mfp-go">Obtener</button></form>' +
      '<p class="mfp-e" role="status">' + E(msg || '') + '</p>' +
      '<p class="mfp-n"><span>Un uso por correo · El envío se cobra completo.</span><button type="button" class="mfp-no" data-mfx>No, gracias</button></p>');
  }
  function paso2(d, email) {
    var c = E(d.codigo);
    pintar('<p class="mfp-ey">' + LOGO + '<span>Tu código</span></p>' +
      '<h2><b>' + Number(d.pct) + ' % OFF</b> listo para usar</h2>' + (d.enviado ? '<p class="mfp-tx">También lo enviamos a ' + E(email) + '.</p>' : '<p class="mfp-tx">Escríbelo al pagar o aplícalo de una vez.</p>') +
      '<div class="mfp-cb"><strong class="mfp-cod">' + c + '</strong><button type="button" class="mfp-cp" data-dcopy="' + c + '">Copiar</button></div>' +
      '<button type="button" class="mfp-go mfp-full" data-dapply="' + c + '">Aplicar en mi bolsa</button>' +
      '<p class="mfp-n"><span>Válido una sola vez con este correo. Aplica sobre productos.</span></p>');
  }
  function quitarTab() { var t = tab; tab = null; if (t && t.parentNode) t.parentNode.removeChild(t); }
  function ponerTab() {
    if (tab || !P || ses(OK) || ses(TABX) || S.codigo || enPago()) return;
    tab = document.createElement('div'); tab.className = 'mfp-tab';
    tab.innerHTML = '<button type="button" class="mfp-tab-a" data-mfabrir>−' + P.pct + ' %</button><button type="button" class="mfp-tab-x" data-mftabx aria-label="Ocultar descuento">×</button>';
    tab.addEventListener('click', function (e) {
      if (e.target.closest('[data-mftabx]')) { setSes(TABX); quitarTab(); return; }
      if (e.target.closest('[data-mfabrir]')) { quitarTab(); mostrar(P.pct, P.foto, true); }
    });
    document.body.appendChild(tab);
    requestAnimationFrame(function () { if (tab) tab.classList.add('on'); });
  }
  function cerrar(conTab) {
    var f = fl; fl = null; setSes(CERRADO); if (!f) return;
    f.classList.remove('on'); setTimeout(function () { if (f.parentNode) f.parentNode.removeChild(f); }, 450);
    if (conTab) setTimeout(ponerTab, 500);
  }
  function pedir(pct, email) {
    if (enviando) return; enviando = true;
    var b = fl && fl.querySelector('.mfp-go'); if (b) { b.disabled = true; b.textContent = 'Enviando…'; }
    fetch(API + '/api/bienvenida', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email }) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { if (!r.ok) throw new Error(d.error || 'No pudimos enviar tu código. Intenta de nuevo.'); return d; }); })
      .then(function (d) { if (d.ok && d.codigo) { setSes(CERRADO); setSes(OK); paso2(d, email); } else paso1(pct, d.error || 'Ese descuento no está disponible'); })
      .catch(function (e) { paso1(pct, (e && e.message) || 'No pudimos enviar tu código. Intenta de nuevo.'); })
      .then(function () { enviando = false; });
  }
  var RE_FOTO = /^(https:\/\/[^\s"'<>]{4,480}|assets\/[\w./-]{1,200})$/;
  function mostrar(pct, foto, forzar) {
    if (fl || S.codigo || enPago() || (!forzar && ses(CERRADO))) return;
    quitarTab();
    fl = document.createElement('aside'); fl.className = 'mfp'; fl.setAttribute('role', 'dialog'); fl.setAttribute('aria-label', 'Descuento de bienvenida');
    var conFoto = typeof foto === 'string' && RE_FOTO.test(foto);
    if (conFoto) fl.classList.add('fo');
    fl.innerHTML = '<button type="button" class="mfp-x" data-mfx aria-label="Cerrar">×</button>' + (conFoto ? '<div class="mfp-ph"><img src="' + E(foto) + '" alt="" decoding="async"></div>' : '') + '<div class="mfp-c"></div>';
    fl.addEventListener('click', function (e) {
      var t = e.target && e.target.closest ? e.target : null; if (!t) return;
      if (t.closest('[data-dapply]')) return cerrar(false);
      if (t.closest('[data-mfx]')) cerrar(!ses(OK));
    });
    fl.addEventListener('submit', function (e) {
      e.preventDefault(); var m = String((fl.querySelector('input[name=email]') || {}).value || '').trim().toLowerCase();
      if (!RE_MAIL.test(m)) return paso1(pct, 'Escribe un correo válido, por ejemplo nombre@correo.com.');
      pedir(pct, m);
    });
    document.body.appendChild(fl); paso1(pct);
    requestAnimationFrame(function () { requestAnimationFrame(function () { if (fl) fl.classList.add('on'); }); });
  }
  function esperar(n) {
    var p = window.MF_CONTENIDO && window.MF_CONTENIDO.promo;
    if (p && p.correo === true && p.pct >= 1 && p.pct <= 90) {
      P = { pct: p.pct, foto: p.foto };
      if (PREVIA) { setTimeout(function () { mostrar(p.pct, p.foto, true); }, 400); return; }
      if (ses(CERRADO)) { setTimeout(ponerTab, 1200); return; }
      setTimeout(function () { mostrar(p.pct, p.foto); }, 2500); return;
    }
    if (n < 20) setTimeout(function () { esperar(n + 1); }, 500);
  }
  /* En el pago o con un código aplicado, se esconden el aviso y la pestaña */
  setInterval(function () { if (enPago() || S.codigo) { if (tab) quitarTab(); } else if (!tab && !fl && P && ses(CERRADO)) ponerTab(); }, 1500);
  esperar(0);
})();
