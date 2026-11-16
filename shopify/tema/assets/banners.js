/* Banners del inicio. Si la dueña creó banners en el panel ("Diseñador de inicio"), reemplazan la portada de siempre;
   si no hay ninguno (o algo falla) la tienda se ve exactamente como antes.
   Expone window.mfBanners { card, ok, html, init } (el panel usa card() para la vista previa: lo que ves es lo que sale). */
(function () {
  'use strict';
  var E = function (t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (m) { return '&#' + m.charCodeAt(0) + ';'; }); };
  var N = function (v, a, b, d) { v = Number(v); return isFinite(v) ? Math.min(b, Math.max(a, v)) : d; };
  var HEX = /^#[0-9a-fA-F]{6}$/, IMG = /^(https:\/\/[^\s"'<>]{4,480}|assets\/[\w.\/-]{1,200})$/, URL_OK = /^https:\/\/[^\s"'<>]{4,300}$/;
  var ID = /^[\w.-]{1,64}$/;

  function lista() { var c = window.MF_CONTENIDO; return c && Array.isArray(c.banners) ? c.banners.filter(function (b) { return b && b.visible !== false; }) : []; }
  function ok() { try { return lista().length > 0; } catch (e) { return false; } }

  function boton(b, i) {
    var t = b && b.boton; if (!t || !t.texto || !t.destino) return '';
    var d = t.destino, est = ['claro', 'oscuro', 'borde'].indexOf(t.estilo) >= 0 ? t.estilo : 'claro';
    var st = ' style="--x:' + N(t.x, 0, 100, 50) + '%;--y:' + N(t.y, 0, 100, 85) + '%;--i:' + i + '"', cl = 'bn-b ' + est, tx = E(t.texto);
    if (d.tipo === 'url' && URL_OK.test(d.url || '')) return '<a class="' + cl + '"' + st + ' href="' + E(d.url) + '" target="_blank" rel="noopener noreferrer">' + tx + '</a>';
    if (d.tipo === 'prod' && ID.test(d.id || '')) return '<button type="button" class="' + cl + '"' + st + ' data-n="prod" data-id="' + E(d.id) + '">' + tx + '</button>';
    if (d.tipo === 'col' && (d.id === '' || d.id == null || ID.test(d.id))) return '<button type="button" class="' + cl + '"' + st + ' data-ver="' + E(d.id || '') + '">' + tx + '</button>';
    if (d.tipo === 'go') return '<button type="button" class="' + cl + '"' + st + ' data-r="go">' + tx + '</button>';
    return '';
  }

  /* Un banner. opts.vista = true → sin botones reales (vista previa del panel) */
  function card(b, opts) {
    opts = opts || {};
    var foto = typeof b.foto === 'string' && IMG.test(b.foto) ? '<div class="bn-ph"><img src="' + E(b.foto) + '" alt="" style="object-position:' + N(b.fx, 0, 100, 50) + '% ' + N(b.fy, 0, 100, 50) + '%"' + (opts.first ? '' : ' loading="lazy"') + '></div>' : '';
    var bg = HEX.test(b.fondo || '') ? b.fondo : '#111111';
    var capas = (Array.isArray(b.capas) ? b.capas : []).map(function (k, i) {
      if (!k || !k.t) return '';
      var cl = 'bn-l' + (k.fuente === 'sans' ? ' sans' : '') + (k.cursiva ? ' it' : '') + (k.grueso ? ' gr' : '') + (k.mayus ? ' mx' : '');
      var al = k.alinea === 'left' || k.alinea === 'right' ? k.alinea : 'center';
      return '<p class="' + cl + '" data-capa="' + i + '" style="--x:' + N(k.x, 0, 100, 50) + '%;--y:' + N(k.y, 0, 100, 50) + '%;--s:' + N(k.tam, 2, 16, 6) + ';--w:' + N(k.ancho, 20, 100, 80) + '%;--c:' + (HEX.test(k.color || '') ? k.color : '#ffffff') + ';--a:' + al + ';--i:' + i + '">' + E(k.t) + '</p>';
    }).join('');
    return '<div class="bnw"><div class="mfb" style="--bg:' + bg + ';--ov:' + (N(b.oscuro, 0, 70, 25) / 100) + '">' + foto + '<div class="bn-ov"></div>' + capas + (opts.sinBoton ? '' : boton(b, 6)) + '</div></div>';
  }

  function html() {
    var L = lista(); if (!L.length) return '';
    var slides = L.map(function (b, k) { return '<div class="bn-s' + (k ? '' : ' on') + '" data-k="' + k + '"' + (k ? ' aria-hidden="true"' : '') + '>' + card(b, { first: k === 0 }) + '</div>'; }).join('');
    var dots = L.length > 1 ? '<div class="bns-d">' + L.map(function (b, k) { return '<button type="button" class="' + (k ? '' : 'on') + '" data-bd="' + k + '" aria-label="Ver banner ' + (k + 1) + '"></button>'; }).join('') + '</div>' : '';
    return '<section class="bns" id="bns" data-bn="' + L.length + '"><div class="bns-t">' + slides + '</div>' + dots + '</section>';
  }

  var timer = 0;
  function init() {
    clearInterval(timer);
    var r = document.getElementById('bns'); if (!r) return;
    r.classList.add('js');
    var t = r.querySelector('.bns-t'), S = [].slice.call(r.querySelectorAll('.bn-s')), D = [].slice.call(r.querySelectorAll('.bns-d button'));
    var cur = 0, pausa = 0, reduce = false;
    try { reduce = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { /* */ }
    function marca(i) {
      cur = i;
      S.forEach(function (s, k) { s.classList.toggle('on', k === i); s.setAttribute('aria-hidden', k === i ? 'false' : 'true'); });
      D.forEach(function (d, k) { d.classList.toggle('on', k === i); });
    }
    function ir(i) { i = (i + S.length) % S.length; t.scrollTo({ left: i * t.clientWidth, behavior: reduce ? 'auto' : 'smooth' }); marca(i); }
    var raf = 0;
    t.addEventListener('scroll', function () {
      if (raf) return;
      raf = requestAnimationFrame(function () { raf = 0; var i = Math.round(t.scrollLeft / Math.max(1, t.clientWidth)); if (i !== cur && S[i]) marca(i); });
    }, { passive: true });
    D.forEach(function (d) { d.addEventListener('click', function () { pausa = Date.now() + 12000; ir(+d.getAttribute('data-bd')); }); });
    ['pointerdown', 'touchstart', 'wheel'].forEach(function (ev) { t.addEventListener(ev, function () { pausa = Date.now() + 12000; }, { passive: true }); });
    if (S.length > 1 && !reduce) {
      timer = setInterval(function () {
        if (!document.body.contains(r)) { clearInterval(timer); return; }
        if (document.hidden || Date.now() < pausa) return;
        ir(cur + 1);
      }, 6500);
    }
  }

  window.mfBanners = { card: card, ok: ok, html: html, init: init };

  /* Se engancha a la tienda sin tocar sus archivos: cambia solo la portada del inicio y arranca el carrusel después de dibujar */
  function engancha() {
    var R = window.mfRef; if (!R || !R.home || R.__bn) return;
    var h0 = R.home;
    R.home = function () {
      var s = h0();
      try { if (ok()) { var b = html(); if (b) return s.replace(/<section class="rh" id="rh">[\s\S]*?<\/section>/, function () { return b; }); } } catch (e) { /* se queda la portada de siempre */ }
      return s;
    };
    R.__bn = 1;
    var i0 = window.mfCatInit;
    window.mfCatInit = function () { if (i0) i0.apply(this, arguments); try { init(); } catch (e) { /* nada */ } };
  }
  engancha();
})();
