/* Encabezado de Marlon Footwear: buscador desplegable y menú a pantalla completa con submenú de colecciones.
   Usa las colecciones reales del panel (MF_CONTENIDO.colecciones) y la navegación de la tienda (nav, Q, MF_COL). */
(function () {
  'use strict';
  var E = function (t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (m) { return '&#' + m.charCodeAt(0) + ';'; }); };
  var X = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  var ORDEN = ['tacones', 'plataformas', 'sandalias'];

  function colecciones() {
    var c = ((window.MF_CONTENIDO && window.MF_CONTENIDO.colecciones) || []).filter(function (k) { return k && k.visible !== false && k.id && k.nombre; });
    var pos = function (k) { var i = ORDEN.indexOf(k.id); return i < 0 ? ORDEN.length : i; };
    return c.slice().sort(function (a, b) { return pos(a) - pos(b); });
  }

  /* Carrusel del menú: primero los marcados "Destacado en el inicio" en el panel, luego otros con tallas disponibles */
  function destacados() {
    var L = []; try { L = (typeof catalog === 'function' ? catalog() : []) || []; } catch (e) { L = []; }
    var hay = function (p) { return p && p.id != null && p.price > 0 && p.tallas && p.tallas.length; };
    var d = L.filter(function (p) { return hay(p) && p.destacado; }), o = L.filter(function (p) { return hay(p) && !p.destacado; });
    return { titulo: d.length ? 'Destacados' : 'Te puede gustar', items: d.concat(o).slice(0, 8) };
  }
  function precio(n) { try { return typeof fmt === 'function' ? fmt(n) : '$' + Number(n).toLocaleString('es-CO'); } catch (e) { return '$' + n; } }
  function carrusel() {
    var D = destacados(); if (!D.items.length) return '';
    return '<section class="hd-car" aria-label="' + E(D.titulo) + '"><h3>' + E(D.titulo) + '</h3><div class="hd-row">' + D.items.map(function (p) {
      return '<button type="button" class="hd-pc" data-hd-prod="' + E(p.id) + '"><span class="hd-im">' + (p.img ? '<img src="' + E(p.img) + '" alt="" loading="lazy" decoding="async" onerror="this.remove()">' : '') + '</span>' +
        '<span class="hd-pn">' + E(p.name) + '</span><span class="hd-pp">' + E(precio(p.price)) + '</span></button>';
    }).join('') + '</div></section>';
  }
  var IC = {
    fav: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
    bag: '<path d="M5 8h14l-1 12H6L5 8z"/><path d="M9 8V6.5a3 3 0 0 1 6 0V8"/>',
    share: '<circle cx="12" cy="9" r="3.2"/><path d="M5.5 20c.8-3.4 3.4-5.2 6.5-5.2s5.7 1.8 6.5 5.2"/>',
    wa: '<path d="M4.5 19.5l1.2-3.6A7.8 7.8 0 1 1 8.4 18.4z"/><path d="M9.3 9.2c.2 2.3 1.8 4.4 4.6 5.4l1-1.1-1.6-.9-.7.6c-.9-.4-1.6-1.1-2-2l.6-.7-.8-1.6z"/>'
  };
  function ico(k) { return '<svg viewBox="0 0 24 24" aria-hidden="true">' + IC[k] + '</svg>'; }
  function nivel1() {
    var f = favN();
    return '<div class="hd-mh"><span class="hd-kk">Menú</span><button type="button" data-hd="cerrar" aria-label="Cerrar menú">' + X + '</button></div>' +
      '<ul class="hd-l1 hd-big">' +
      '<li><button type="button" data-hd="col" class="hd-sub"><span class="hd-n">01</span><span class="hd-t">Colección</span></button></li>' +
      '<li><button type="button" data-mn="home"><span class="hd-n">02</span><span class="hd-t">Inicio</span></button></li>' +
      '<li><button type="button" data-mn="com"><span class="hd-n">03</span><span class="hd-t">Comunidad Marlon</span></button></li>' +
      '</ul><ul class="hd-l2 hd-tiles">' +
      '<li><button type="button" data-hd="favs">' + ico('fav') + '<span>Mis favoritos</span>' + (f ? '<i class="hd-bd">' + f + '</i>' : '') + '</button></li>' +
      '<li><button type="button" data-mn="bag">' + ico('bag') + '<span>Mi bolsa</span></button></li>' +
      '<li><button type="button" data-mn="share">' + ico('share') + '<span>Comparte tus MF</span></button></li>' +
      '<li><button type="button" data-mn="wa">' + ico('wa') + '<span>Pedir por WhatsApp</span></button></li></ul>' + carrusel();
  }
  function nivel2() {
    return '<div class="hd-mh"><button type="button" data-hd="atras" class="hd-back">Colección</button><button type="button" data-hd="cerrar" aria-label="Cerrar menú">' + X + '</button></div>' +
      '<ul class="hd-l1 hd-ls">' + '<li><button type="button" data-hd-col="">Ver todo</button></li>' +
      colecciones().map(function (k) { return '<li><button type="button" data-hd-col="' + E(k.id) + '">' + E(k.nombre) + '</button></li>'; }).join('') + '</ul>';
  }
  function favN() { return window.mfFavs ? window.mfFavs.lista().length : 0; }
  function nivelFavs() {
    var ids = window.mfFavs ? window.mfFavs.lista() : [], L = []; try { L = (typeof catalog === 'function' ? catalog() : []) || []; } catch (e) { L = []; }
    var prods = ids.map(function (id) { return L.filter(function (p) { return String(p.id) === String(id); })[0]; }).filter(Boolean);
    return '<div class="hd-mh"><button type="button" data-hd="atras" class="hd-back">Mis favoritos</button><button type="button" data-hd="cerrar" aria-label="Cerrar menú">' + X + '</button></div>' +
      (prods.length ? '<ul class="hd-fv">' + prods.map(function (p) {
        return '<li><button type="button" class="hd-fvp" data-hd-prod="' + E(p.id) + '"><span class="hd-fvi">' + (p.img ? '<img src="' + E(p.img) + '" alt="" loading="lazy" decoding="async" onerror="this.remove()">' : '') + '</span>' +
          '<span class="hd-fvt"><b>' + E(p.name) + '</b><small>' + E(precio(p.price)) + (p.tallas && p.tallas.length ? '' : ' · Agotado') + '</small></span></button>' +
          '<button type="button" class="hd-fvx" data-hd-unfav="' + E(p.id) + '" aria-label="Quitar ' + E(p.name) + ' de favoritos">Quitar</button></li>';
      }).join('') + '</ul>' : '<p class="hd-fv0">Aún no tienes favoritos. Toca el corazón de cualquier modelo para guardarlo aquí.</p><ul class="hd-l1"><li><button type="button" data-hd-col="">Ver la colección</button></li></ul>');
  }
  window.mfVerFavs = function () { var t = document.getElementById('toast'); if (t) t.classList.remove('on'); pintar(nivelFavs()); document.body.classList.add('mnopen'); };
  function menu() { return document.getElementById('mn'); }
  function pintar(h) { var m = menu(); if (m) { m.innerHTML = h; m.scrollTop = 0; } }
  function cerrarMenu() { document.body.classList.remove('mnopen'); }

  /* Buscador */
  var bx = null;
  function buscador(abrir) {
    var b = document.querySelector('[data-hd="buscar"]');
    if (!bx) {
      bx = document.createElement('form'); bx.className = 'hd-bx'; bx.setAttribute('role', 'search');
      bx.innerHTML = '<input type="search" placeholder="Buscar modelos" aria-label="Buscar modelos" enterkeyhint="search"><button type="button" data-hd="buscar-x" aria-label="Cerrar búsqueda">' + X + '</button>';
      bx.addEventListener('submit', function (e) {
        e.preventDefault(); var q = String(bx.querySelector('input').value || '').trim(); if (!q) return;
        try { Q = q; } catch (er) { /* nada */ } window.MF_COL = ''; buscador(false); bx.querySelector('input').value = '';
        if (typeof nav === 'function') nav('col');
      });
      var bar = document.querySelector('header.bar'); if (bar) bar.insertAdjacentElement('afterend', bx);
    }
    document.body.classList.toggle('hd-busca', abrir);
    if (b) b.setAttribute('aria-expanded', abrir ? 'true' : 'false');
    if (abrir) setTimeout(function () { var i = bx.querySelector('input'); if (i) i.focus(); }, 30);
  }

  document.addEventListener('click', function (e) {
    var t = e.target && e.target.closest ? e.target : null; if (!t) return;
    if (t.closest('[data-mn="o"]')) { pintar(nivel1()); buscador(false); return; } // el menú se abre con la lógica existente
    var h = t.closest('[data-hd]');
    if (h) {
      var a = h.getAttribute('data-hd');
      if (a === 'col') pintar(nivel2());
      else if (a === 'favs') pintar(nivelFavs());
      else if (a === 'atras') pintar(nivel1());
      else if (a === 'cerrar') cerrarMenu();
      else if (a === 'buscar') buscador(!document.body.classList.contains('hd-busca'));
      else if (a === 'buscar-x') buscador(false);
      return;
    }
    var uf = t.closest('[data-hd-unfav]');
    if (uf) { if (window.mfFavs) window.mfFavs.quitar(uf.getAttribute('data-hd-unfav')); pintar(nivelFavs()); return; }
    var pr = t.closest('[data-hd-prod]');
    if (pr) { cerrarMenu(); if (typeof nav === 'function') nav('prod', pr.getAttribute('data-hd-prod')); return; }
    var c = t.closest('[data-hd-col]');
    if (c) {
      var id = c.getAttribute('data-hd-col'); cerrarMenu();
      window.MF_COL = id; try { Q = ''; } catch (er) { /* nada */ }
      try { history.replaceState(history.state, '', id ? '#' + id : location.pathname + location.search); } catch (er) { /* nada */ }
      if (typeof nav === 'function') nav('col');
    }
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { cerrarMenu(); buscador(false); } });
  if (menu()) pintar(nivel1());
})();
