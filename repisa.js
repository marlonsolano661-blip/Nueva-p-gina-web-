/* Repisa de productos: vista tipo vitrina. Página nueva y aparte; solo LEE el catálogo, no toca carrito, pagos ni otros scripts.
   Compra: el botón lleva a la ficha de siempre (/?producto=<id>), que ya tiene carrito y pago. */
(function () {
  'use strict';
  var WA = '573115752334', TALLAS = [34, 35, 36, 37, 38, 39, 40];
  var $ = function (s) { return document.querySelector(s); };
  var money = function (n) { return '$' + Number(n || 0).toLocaleString('es-CO'); };
  var esc = function (t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (m) { return '&#' + m.charCodeAt(0) + ';'; }); };

  var productos = Array.isArray(window.MF_CATALOGO_PRODUCTOS) ? window.MF_CATALOGO_PRODUCTOS : [];
  var cur = null, size = null, foto = '', openEl = null, closeTimer = null;

  function stockDe(p, t) {
    if (!p.stock || typeof p.stock !== 'object') return true;
    var v = p.stock[String(t)];
    return v === undefined ? true : Number(v) > 0;
  }

  function pintar() {
    var sh = $('#shelf');
    $('#n').textContent = productos.length + (productos.length === 1 ? ' modelo' : ' modelos');
    if (!productos.length) { sh.innerHTML = '<p class="rp-empty">No hay productos para mostrar por ahora.</p>'; return; }
    sh.innerHTML = productos.map(function (p, i) {
      return '<button class="rp-item" type="button" data-i="' + i + '" aria-label="' + esc(p.name) + ', ' + money(p.price) + '">' +
        '<span class="rp-im"><img src="' + esc(p.img) + '" alt="" loading="lazy" decoding="async"></span>' +
        '<span class="rp-cap"><b>' + esc(p.name) + '</b><span>' + money(p.price) + '</span></span></button>';
    }).join('');
  }

  function info() {
    var p = cur;
    $('#fname').textContent = p.name;
    $('#fprice').textContent = money(p.price);
    $('#fdesc').textContent = p.desc || '';
    $('#fdesc').hidden = !p.desc;
    var cols = (p.colors || []).filter(function (c) { return c && c.n; });
    $('#fcolors').innerHTML = cols.map(function (c) { return '<span class="rp-dot"><i style="--c:' + esc(c.h || '#ccc') + '"></i>' + esc(c.n) + '</span>'; }).join('');
    $('#flc').hidden = $('#fcolors').hidden = !cols.length;
    var imgs = (p.imgs && p.imgs.length ? p.imgs : [p.img]).slice(0, 6);
    $('#fthumbs').innerHTML = imgs.length > 1 ? imgs.map(function (u) {
      return '<button class="rp-th" type="button" data-u="' + esc(u) + '" aria-pressed="' + (u === foto) + '" aria-label="Ver foto"><img src="' + esc(u) + '" alt="" loading="lazy"></button>';
    }).join('') : '';
    $('#fsizes').innerHTML = TALLAS.map(function (t) {
      return '<button class="rp-sz" type="button" data-s="' + t + '" aria-pressed="' + (t === size) + '"' + (stockDe(p, t) ? '' : ' disabled aria-label="Talla ' + t + ' agotada"') + '>' + t + '</button>';
    }).join('');
    $('#fbuy').href = './?producto=' + encodeURIComponent(p.id);
    var msg = 'Hola, me interesa: ' + p.name + (size ? ', talla ' + size : '') + ' (' + money(p.price) + ').';
    $('#fwa').href = 'https://wa.me/' + WA + '?text=' + encodeURIComponent(msg);
  }

  function abrir(el) {
    clearTimeout(closeTimer);
    cur = productos[+el.dataset.i]; if (!cur) return;
    size = null; foto = cur.img; openEl = el;
    var f = $('#focus'), big = $('#big');
    f.hidden = false; f.classList.remove('on');
    big.style.transition = 'none'; big.style.transform = 'none';
    $('#bigimg').src = foto;
    info();
    var a = el.querySelector('.rp-im').getBoundingClientRect(), b = big.getBoundingClientRect();
    big.style.transform = 'translate(' + (a.left - b.left) + 'px,' + (a.top - b.top) + 'px) scale(' + (a.width / b.width) + ')';
    el.classList.add('ghost');
    void big.offsetWidth;
    big.style.transition = ''; big.style.transform = 'none';
    f.classList.add('on');
    $('#close').focus({ preventScroll: true });
  }

  function cerrar() {
    var f = $('#focus'); if (f.hidden) return;
    var big = $('#big');
    if (openEl) {
      var a = openEl.querySelector('.rp-im').getBoundingClientRect(), b = big.getBoundingClientRect();
      big.style.transform = 'translate(' + (a.left - b.left) + 'px,' + (a.top - b.top) + 'px) scale(' + (a.width / b.width) + ')';
    }
    f.classList.remove('on');
    closeTimer = setTimeout(function () {
      f.hidden = true;
      if (openEl) { openEl.classList.remove('ghost'); try { openEl.focus({ preventScroll: true }); } catch (e) { /* nada */ } }
      openEl = null;
    }, 480);
  }

  $('#shelf').addEventListener('click', function (e) { var it = e.target.closest('.rp-item'); if (it) abrir(it); });
  $('#close').addEventListener('click', cerrar);
  $('#focus').addEventListener('click', function (e) { if (e.target.id === 'focus' || e.target.classList.contains('rp-sheet')) cerrar(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') cerrar(); });
  $('#fsizes').addEventListener('click', function (e) { var b = e.target.closest('.rp-sz'); if (!b || b.disabled) return; size = +b.dataset.s; info(); });
  $('#fthumbs').addEventListener('click', function (e) { var b = e.target.closest('.rp-th'); if (!b) return; foto = b.dataset.u; $('#bigimg').src = foto; info(); });

  pintar();

  // Catálogo vivo del servidor (misma fuente que la tienda). Si no responde, se queda con el estático de DATA/.
  try {
    var ctl = new AbortController(), t = setTimeout(function () { ctl.abort(); }, 8000);
    fetch('/api/catalogo', { signal: ctl.signal, headers: { Accept: 'application/json' } })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (d) {
        clearTimeout(t);
        if (!d || !Array.isArray(d.productos) || !d.productos.length) return;
        productos = d.productos;
        if ($('#focus').hidden) pintar();
      })
      .catch(function () { /* se usa el catálogo estático */ });
  } catch (e) { /* sin fetch */ }
})();
