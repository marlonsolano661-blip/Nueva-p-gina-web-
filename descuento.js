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

  /* Aviso flotante: pide el correo y, solo después, el servidor entrega el código (/api/bienvenida).
     Aparece si el panel anuncia un código. No se muestra en el pago, si ya hay un código aplicado o si la clienta lo cerró en esta visita. */
  var CERRADO = 'mf_promo_cerrado', fl = null, RE_MAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, enviando = false;
  function visto() { try { return sessionStorage.getItem(CERRADO) === '1'; } catch (e) { return false; } }
  function marcar() { try { sessionStorage.setItem(CERRADO, '1'); } catch (e) { /* nada */ } }
  function enPago() { try { return pg === 'out'; } catch (e) { return false; } }
  function cerrar() { var f = fl; fl = null; marcar(); if (!f) return; f.classList.remove('on'); setTimeout(function () { if (f.parentNode) f.parentNode.removeChild(f); }, 500); }
  function pintar(h) { if (fl) fl.querySelector('.mfb-c').innerHTML = h; }
  function paso1(pct, msg) {
    pintar('<h2>' + pct + ' % menos en tu primer par.</h2><p>Déjanos tu correo y te enviamos el código de bienvenida.</p>' +
      '<form class="mfb-f" novalidate><input type="email" name="email" inputmode="email" autocomplete="email" placeholder="Tu correo electrónico" aria-label="Tu correo electrónico"><button type="submit" class="btn">Recibir mi código</button></form>' +
      '<p class="mfb-e" role="status">' + E(msg || '') + '</p><p class="mfb-n">Un uso por correo. El envío se cobra completo.</p>');
  }
  function paso2(d, email) {
    var c = E(d.codigo);
    pintar('<h2>Tu código está listo.</h2>' + (d.enviado ? '<p class="mfb-ok">También lo enviamos a ' + E(email) + '.</p>' : '') +
      '<strong class="mfb-cod">' + c + '</strong><div class="mfb-a"><button type="button" class="btn" data-dcopy="' + c + '">Copiar código</button><button type="button" class="btn o" data-dapply="' + c + '">Aplicar en mi bolsa</button></div>' +
      '<p class="mfb-n">' + Number(d.pct) + ' % de descuento en productos. Válido una sola vez con este correo.</p>');
  }
  function pedir(pct, email) {
    if (enviando) return; enviando = true;
    fetch(API + '/api/bienvenida', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email }) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { if (!r.ok) throw new Error(d.error || 'No pudimos enviar tu código. Intenta de nuevo.'); return d; }); })
      .then(function (d) { if (d.ok) { marcar(); paso2(d, email); } else paso1(pct, d.error || 'Ese descuento no está disponible'); })
      .catch(function (e) { paso1(pct, (e && e.message) || 'No pudimos enviar tu código. Intenta de nuevo.'); })
      .then(function () { enviando = false; });
  }
  var RE_FOTO = /^(https:\/\/[^\s"'<>]{4,480}|assets\/[\w./-]{1,200})$/;
  function mostrar(pct, foto) {
    if (fl || visto() || S.codigo || enPago()) return;
    fl = document.createElement('aside'); fl.className = 'mfb'; fl.setAttribute('role', 'dialog'); fl.setAttribute('aria-label', 'Descuento de bienvenida');
    var conFoto = typeof foto === 'string' && RE_FOTO.test(foto);
    if (conFoto) fl.classList.add('fo');
    fl.innerHTML = '<button type="button" class="mfb-x" data-mfx aria-label="Cerrar">×</button>' + (conFoto ? '<img class="mfb-img" src="' + E(foto) + '" alt="" decoding="async">' : '') + '<div class="mfb-c"></div>';
    fl.addEventListener('click', function (e) { var t = e.target && e.target.closest ? e.target : null; if (!t) return; if (t.closest('[data-mfx]') || t.closest('[data-dapply]')) cerrar(); });
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
    if (p && p.correo === true && p.pct >= 1 && p.pct <= 90) { setTimeout(function () { mostrar(p.pct, p.foto); }, 2500); return; }
    if (n < 20) setTimeout(function () { esperar(n + 1); }, 500);
  }
  esperar(0);
})();
