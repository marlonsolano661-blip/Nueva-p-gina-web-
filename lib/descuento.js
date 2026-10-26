/* Código de descuento en la tienda: caja en la bolsa y en el pago, y aviso con foto en el inicio (si el panel anuncia un código).
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

  /* Aviso en el inicio (solo si el panel anuncia un código) */
  function promo() {
    var p = window.MF_CONTENIDO && window.MF_CONTENIDO.promo;
    if (!p || !RE.test(String(p.codigo || '')) || !(p.pct >= 1 && p.pct <= 90)) return '';
    return '<section class="dpr" aria-label="Descuento"><img src="assets/promo-descuento.jpg" alt="" loading="lazy" decoding="async"><div class="dpr-v"></div><div class="dpr-t"><small>Para ti</small><h2>' + p.pct + '% de descuento</h2><p>en tu compra con el código</p><b class="dpr-c">' + E(p.codigo) + '</b><div class="dpr-b"><button type="button" class="btn inv" data-dapply="' + E(p.codigo) + '">Aplicar en mi bolsa</button><button type="button" class="btn o inv" data-dcopy="' + E(p.codigo) + '">Copiar código</button></div></div></section>';
  }
  function engancha() {
    var R = window.mfRef; if (!R || !R.home || R.__dc) return;
    var h0 = R.home;
    R.home = function () {
      var s = h0();
      try { var h = promo(); if (h) { var i = s.indexOf('</section>'); if (i >= 0) return s.slice(0, i + 10) + h + s.slice(i + 10); } } catch (e) { /* sin aviso */ }
      return s;
    };
    R.__dc = 1;
  }
  engancha();
})();
