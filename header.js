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
  function nivel1() {
    return '<div class="hd-mh"><span></span><button type="button" data-hd="cerrar" aria-label="Cerrar menú">' + X + '</button></div>' +
      '<ul class="hd-l1">' +
      '<li><button type="button" data-hd="col" class="hd-sub">Colección</button></li>' +
      '<li><button type="button" data-mn="home">Inicio</button></li>' +
      '<li><button type="button" data-mn="com">Comunidad Marlon</button></li>' +
      '<li><button type="button" data-hd-ir="outfits.html">Ideas de outfits</button></li>' +
      '</ul><ul class="hd-l2">' +
      '<li><button type="button" data-hd="favs">Mis favoritos' + (favN() ? ' (' + favN() + ')' : '') + '</button></li>' +
      '<li><button type="button" data-mn="bag">Mi bolsa</button></li>' +
      '<li><button type="button" data-mn="share">Comparte tus MF</button></li>' +
      '<li><button type="button" data-mn="wa">Pedir por WhatsApp</button></li></ul>' + redes() + carrusel();
  }
  /* Redes sociales en el menú (con color). Para cambiar los enlaces, edita REDES. Si un enlace está vacío, ese ícono no se muestra. */
  var REDES = { instagram: 'https://www.instagram.com/marlonfootwear', facebook: 'https://www.facebook.com/share/1CXYsBtK9Z/' };
  function redes() {
    var h = '';
    if (REDES.instagram) h += '<a class="hd-red hd-ig" href="' + E(REDES.instagram) + '" target="_blank" rel="noopener noreferrer" aria-label="Instagram de Marlon Footwear"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r="1.1" class="hd-pt"/></svg></a>';
    if (REDES.facebook) h += '<a class="hd-red hd-fb" href="' + E(REDES.facebook) + '" target="_blank" rel="noopener noreferrer" aria-label="Facebook de Marlon Footwear"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13.4 21v-7.6h2.6l.4-3h-3V8.5c0-.9.3-1.5 1.5-1.5h1.6V4.3c-.3 0-1.2-.1-2.3-.1-2.3 0-3.9 1.4-3.9 4v2.2H7.7v3h2.6V21z"/></svg></a>';
    return h ? '<div class="hd-redes">' + h + '</div>' : '';
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

/* Bolsa estilo Miss Lola: solo ordena y renombra lo que ya dibuja la tienda (no cambia el carrito ni el pago). */
(function () {
  'use strict';
  function ajustar() {
    var d = document.getElementById('dr'); if (!d) return;
    var h2 = d.querySelector('.drh h2'); if (h2 && h2.textContent !== 'Bolsa de compras') h2.textContent = 'Bolsa de compras';
    var p = d.querySelector('.drh p'); if (p) p.remove();
    Array.prototype.forEach.call(d.querySelectorAll('.bl'), function (l) {
      var bi = l.querySelector('.bi'), lp = l.querySelector('.lp'), info = bi && bi.querySelector('p');
      if (bi && lp && info && lp.parentNode !== bi) bi.insertBefore(lp, info.nextSibling);
    });
    // Pie de la bolsa estilo EGO: TOTAL y dos botones lado a lado (Seguir comprando | Pagar)
    var pay = d.querySelector('.drf .cta .btn:not(.wa)');
    if (pay && pay.textContent !== 'Pagar') pay.textContent = 'Pagar';
    var tt = d.querySelector('.drf .tt span'); if (tt && tt.textContent !== 'Total:') tt.textContent = 'Total:';
    var cta = d.querySelector('.drf .cta'), sigue = d.querySelector('.drf > .lk[data-n="bagclose"]');
    if (cta && sigue) {
      sigue.classList.add('ml-sigue');
      var par = cta.querySelector('.ml-par');
      if (!par) { par = document.createElement('div'); par.className = 'ml-par'; cta.insertBefore(par, cta.firstChild); }
      par.appendChild(sigue);
      if (pay) par.appendChild(pay);
    }
  }
  function iniciar() { var d = document.getElementById('dr'); if (!d) return; new MutationObserver(function () { ajustar(); }).observe(d, { childList: true }); ajustar(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();

/* Encabezado estilo Wild Diva: franja negra con el nombre de la tienda, barra negra con MENÚ, buscar y MI BOLSA, y el logo MF en el centro de la barra. */
(function () {
  'use strict';
  function armar() {
    var bar = document.querySelector('header.bar'); if (!bar || bar.classList.contains('wd')) return;
    var ann = document.querySelector('.hd-ann'); if (ann) ann.textContent = 'Marlon Footwear Colombia';
    var mb = bar.querySelector('.mb'), bag = bar.querySelector('.bag'), logo = bar.querySelector('.logo'), wm = bar.querySelector('.wm'), sp = bar.querySelector('.sp');
    if (mb && !mb.querySelector('.wd-t')) { var t = document.createElement('span'); t.className = 'wd-t'; t.textContent = 'Menú'; mb.appendChild(t); }
    if (mb) bar.insertBefore(mb, bar.firstChild);
    var bus = bar.querySelector('.hd-s'); if (bus && mb) mb.insertAdjacentElement('afterend', bus);
    if (sp && bus) bus.insertAdjacentElement('afterend', sp);
    if (bag && !bag.querySelector('.wd-t')) { var b = document.createElement('span'); b.className = 'wd-t'; b.textContent = 'Mi bolsa'; bag.insertBefore(b, bag.firstChild); bar.appendChild(bag); }
    if (wm) wm.remove(); // solo el logo MF, centrado dentro de la barra negra
    if (logo) { logo.classList.add('wd-logo'); bar.appendChild(logo); }
    bar.classList.add('wd'); document.body.classList.add('wd-on');
    // Bolsa: parpadea suave mientras tenga productos; el destello de "agregado" se quita al terminar para que siga el parpadeo
    var cnt = document.getElementById('cnt');
    function lleno() { if (bag && cnt) bag.classList.toggle('wd-lleno', (parseInt(cnt.textContent, 10) || 0) > 0); }
    if (cnt) { new MutationObserver(lleno).observe(cnt, { childList: true, characterData: true, subtree: true }); lleno(); }
    if (bag) bag.addEventListener('animationend', function (e) { if (e.animationName === 'mfBolsa') bag.classList.remove('bump'); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', armar); else armar();
  /* Enlaces del menú a otras páginas de la tienda (por ejemplo, Ideas de outfits) */
  document.addEventListener('click', function (e) {
    var b = e.target && e.target.closest ? e.target.closest('[data-hd-ir]') : null;
    if (b) location.href = b.getAttribute('data-hd-ir');
  });
})();
