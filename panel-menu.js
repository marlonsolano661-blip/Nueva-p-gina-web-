/* Menú lateral, búsqueda y rutas del panel. Cada pantalla tiene su dirección (#/pedidos, #/productos…):
   el botón «atrás» del navegador funciona y un enlace abre directamente esa pantalla. */
(function () {
  'use strict';
  var $ = function (s) { return document.querySelector(s); };
  var P = window.mfPanel;
  var I = {
    casa: '<path d="M4 11 12 4l8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z"/>',
    bolsa: '<path d="M5 8h14l-1 12H6z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
    caja: '<path d="m12 3 8 4.5v9L12 21l-8-4.5v-9z"/><path d="m4 7.5 8 4.5 8-4.5M12 12v9"/>',
    tag: '<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.3"/>',
    pagina: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>',
    ajustes: '<circle cx="12" cy="12" r="3"/><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8"/>',
    flecha: '<path d="m9 6 6 6-6 6"/>',
    nube: '<path d="M7 18a4 4 0 0 1-.5-7.97A5.5 5.5 0 0 1 17 8.5a4.5 4.5 0 0 1 0 9.5z"/>',
  };
  var svg = function (d, c) { return '<svg viewBox="0 0 24 24" aria-hidden="true"' + (c ? ' class="' + c + '"' : '') + '>' + d + '</svg>'; };

  // Árbol del menú. «claves»: palabras extra para que la búsqueda encuentre cada pantalla.
  var MENU = [
    { t: 'resumen', n: 'Inicio', i: I.casa, claves: 'resumen panel qué hago ahora' },
    { n: 'Pedidos', i: I.bolsa, hijos: [
      { t: 'pedidos', n: 'Pedidos de la tienda', claves: 'compras pagos despacho guía envío wompi' },
      { t: 'whatsapp', n: 'Pedidos WhatsApp', claves: 'chat ventas manuales' },
      { t: 'facturas', n: 'Facturas', claves: 'comprobante pdf recibo' },
      { t: 'finanzas', n: 'Finanzas', claves: 'ventas ganancias gastos dinero excel' } ] },
    { n: 'Productos', i: I.caja, hijos: [
      { t: 'productos', n: 'Todos los productos', claves: 'crear editar precio fotos colores tallas eliminar' },
      { t: 'inventario', n: 'Inventario', claves: 'stock pares unidades agotado' },
      { t: 'colecciones', n: 'Colecciones', claves: 'categorías tacones sandalias' },
      { t: 'perchero', n: 'Perchero', claves: 'orden catálogo acomodar subir bajar primero' } ] },
    { t: 'descuentos', n: 'Descuentos', i: I.tag, claves: 'códigos cupones porcentaje' },
    { n: 'Contenido', i: I.pagina, hijos: [
      { t: 'inicio', n: 'Diseño del inicio', claves: 'banners portada' },
      { t: 'lookbook', n: 'Lookbook', claves: 'looks fotos editorial productos galería' },
      { t: 'vitrina', n: 'La vitrina', claves: 'riel favoritos recortes' },
      { t: 'comunidad', n: 'Comunidad', claves: 'fotos clientas comparte tus mf aprobar' },
      { t: 'contenido', n: 'Textos de la tienda', claves: 'mensajes frases' } ] },
  ];
  var CONFIG = [
    { t: 'envio', n: 'Tarifa de envío', claves: 'flete costo' },
    { t: 'registro', n: 'Registro', claves: 'historial eventos' },
    { t: 'papelera', n: 'Papelera', claves: 'recuperar restaurar eliminado versión anterior deshacer' },
  ];
  var PLANO = []; // todas las pantallas con su grupo
  MENU.forEach(function (g) { if (g.t) PLANO.push({ t: g.t, n: g.n, grupo: '', claves: g.claves }); (g.hijos || []).forEach(function (h) { PLANO.push({ t: h.t, n: h.n, grupo: g.n, claves: h.claves }); }); });
  CONFIG.forEach(function (h) { PLANO.push({ t: h.t, n: h.n, grupo: 'Configuración', claves: h.claves }); });
  var porT = {}; PLANO.forEach(function (x) { porT[x.t] = x; });
  var sinTilde = function (s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); };

  function fila(x, cls) {
    var b = document.createElement('button'); b.type = 'button'; b.className = 'it' + (cls ? ' ' + cls : ''); b.setAttribute('data-t', x.t);
    b.innerHTML = (x.i ? svg(x.i) : '') + '<span class="tx"></span>'; b.querySelector('.tx').textContent = x.n; return b;
  }
  function pintarMenu(q) {
    var m = $('#menu'), badge = m.querySelector('[data-t="pedidos"] .bd'); var tb = badge && badge.textContent; m.textContent = '';
    q = sinTilde(q).trim();
    if (q) {
      var res = PLANO.filter(function (x) { return sinTilde(x.n + ' ' + x.grupo + ' ' + x.claves).indexOf(q) > -1; });
      if (!res.length) { var p = document.createElement('p'); p.className = 'nada'; p.textContent = 'No hay resultados para «' + q + '».'; m.appendChild(p); return; }
      res.forEach(function (x) { var b = fila(x); if (x.grupo) b.querySelector('.tx').textContent = x.grupo + ' › ' + x.n; m.appendChild(b); });
    } else {
      MENU.forEach(function (g) {
        if (g.t) { m.appendChild(fila(g)); return; }
        var cont = document.createElement('div'); cont.className = 'gr'; if (g.hijos.some(function (h) { return h.t === P.actual(); })) cont.className += ' abierto';
        var cab = document.createElement('button'); cab.type = 'button'; cab.className = 'it'; cab.setAttribute('aria-expanded', cont.classList.contains('abierto'));
        cab.innerHTML = svg(g.i) + '<span class="tx"></span>' + svg(I.flecha, 'fl'); cab.querySelector('.tx').textContent = g.n;
        cab.addEventListener('click', function () { var o = cont.classList.toggle('abierto'); cab.setAttribute('aria-expanded', o); });
        var sub = document.createElement('div'); sub.className = 'sub'; g.hijos.forEach(function (h) { sub.appendChild(fila(h)); });
        cont.appendChild(cab); cont.appendChild(sub); m.appendChild(cont);
      });
    }
    if (tb) { var tx = m.querySelector('[data-t="pedidos"] .tx'); if (tx) { var s = document.createElement('span'); s.className = 'bd'; s.textContent = tb; tx.appendChild(s); } }
    marcar();
  }
  function marcar() {
    var a = P.actual();
    document.querySelectorAll('#menu .it[data-t], #cfg .it[data-t]').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-t') === a); if (b.classList.contains('on')) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
  }
  function abrirMenu(si) {
    document.body.classList.toggle('menu-abierto', si); $('#abrir-menu').setAttribute('aria-expanded', si);
    if (si) setTimeout(function () { var f = $('#buscar'); if (f && matchMedia('(min-width:960px)').matches) f.focus(); }, 50);
  }
  function configAbrir(si) { $('#cfg').hidden = !si; $('#cfg-btn').setAttribute('aria-expanded', si); }

  // Ruta ↔ pantalla
  function claveHash() { var h = location.hash.replace(/^#\/?/, '').split('?')[0]; return h || 'resumen'; }
  function ruta() {
    var t = claveHash(); if (t !== 'resumen' && !porT[t]) { location.replace('#/'); return; }
    if (!P.mostrar(t)) return;
    var x = porT[t], mig = $('#ruta'), h1 = $('#h1');
    h1.textContent = $('#ttl').textContent = x.n;
    mig.textContent = '';
    if (t === 'resumen') { mig.hidden = true; h1.textContent = 'Centro de control'; $('#ttl').textContent = 'Inicio'; }
    else {
      mig.hidden = false;
      var a = document.createElement('a'); a.href = '#/'; a.textContent = 'Inicio'; mig.appendChild(a);
      if (x.grupo) { var i = document.createElement('i'); i.textContent = '›'; var s = document.createElement('span'); s.textContent = x.grupo; mig.appendChild(i); mig.appendChild(s); }
    }
    document.title = (document.title.match(/^\(\d+\+?\) /) || [''])[0] + x.n + ' · MF Colombia';
    var g = document.querySelector('#menu .gr'); document.querySelectorAll('#menu .gr').forEach(function (c) { if (c.querySelector('[data-t="' + t + '"]')) { c.classList.add('abierto'); c.querySelector('.it').setAttribute('aria-expanded', 'true'); } });
    marcar(); abrirMenu(false); configAbrir(false);
  }
  function ir(t) { var h = '#/' + (t === 'resumen' ? '' : t); if (location.hash === h || (t === 'resumen' && (location.hash === '' || location.hash === '#/'))) { ruta(); abrirMenu(false); } else location.hash = h; }

  // Inicio: botones anchos (los dos grandes primero, luego todo el panel por grupos)
  var DESC = { lookbook: 'Looks con foto y sus productos', perchero: 'Ordena a mano todo el catálogo', pedidos: 'Pagos, guías y envíos', whatsapp: 'Anota los pedidos del chat', facturas: 'Comprobantes en PDF', finanzas: 'Ventas, gastos y ganancias',
    productos: 'Crear, editar y subir fotos', inventario: 'Pares por talla', colecciones: 'Agrupa tus productos', descuentos: 'Códigos de descuento', inicio: 'Banners con fotos y botón', vitrina: 'El riel de fotos del inicio', comunidad: 'Aprobar fotos de clientas', contenido: 'Textos de la tienda' };
  var GRUPOS = [['Ventas y dinero', ['pedidos', 'whatsapp', 'facturas', 'finanzas']], ['Catálogo', ['productos', 'inventario', 'colecciones', 'descuentos']], ['Tienda online', ['inicio', 'vitrina', 'comunidad', 'contenido']]];
  function ancho(t, grande) {
    var x = porT[t], b = document.createElement('button'); b.type = 'button'; b.className = 'wide' + (grande ? ' grande' : ''); b.setAttribute('data-t', t);
    b.innerHTML = '<span class="tx"><b></b><small></small></span>' + svg(I.flecha, 'fl'); b.querySelector('b').textContent = x.n; b.querySelector('small').textContent = DESC[t] || ''; return b;
  }
  function atajos() {
    var a = $('#atajos'), g = document.createElement('div'); g.className = 'wide-fila'; g.appendChild(ancho('lookbook', true)); g.appendChild(ancho('perchero', true)); a.appendChild(g);
    GRUPOS.forEach(function (gr) {
      var h = document.createElement('h2'); h.className = 'wide-h'; h.textContent = gr[0]; a.appendChild(h);
      var l = document.createElement('div'); l.className = 'wide-lista'; gr[1].forEach(function (t) { l.appendChild(ancho(t)); }); a.appendChild(l);
    });
    a.addEventListener('click', function (e) { var b = e.target.closest('.wide[data-t]'); if (b) ir(b.getAttribute('data-t')); });
  }

  function montar() {
    atajos();
    var cfg = $('#cfg');
    CONFIG.forEach(function (x) { cfg.appendChild(fila(x)); });
    var ver = document.createElement('a'); ver.className = 'it'; ver.href = '/'; ver.target = '_blank'; ver.rel = 'noopener'; ver.innerHTML = '<span class="tx">Ver la tienda</span>'; cfg.appendChild(ver);
    var sal = document.createElement('button'); sal.type = 'button'; sal.className = 'it'; sal.innerHTML = '<span class="tx">Cerrar sesión</span>'; sal.addEventListener('click', function () { P.salir(); }); cfg.appendChild(sal);
    $('#cfg-btn').innerHTML = svg(I.ajustes) + '<span class="tx">Configuración</span>';
    $('#cfg-btn').addEventListener('click', function () { configAbrir($('#cfg').hidden); });
    pintarMenu('');
    document.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('.lado .it[data-t]'); if (b) { ir(b.getAttribute('data-t')); return; }
      if (e.target.closest && e.target.closest('.lado .cab .logo')) { e.preventDefault(); ir('resumen'); }
    });
    var buscar = $('#buscar');
    buscar.addEventListener('input', function () { pintarMenu(buscar.value); });
    buscar.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { var b = $('#menu .it[data-t]'); if (b) { buscar.value = ''; var t = b.getAttribute('data-t'); pintarMenu(''); ir(t); } }
      if (e.key === 'Escape') { buscar.value = ''; pintarMenu(''); }
    });
    $('#abrir-menu').addEventListener('click', function () { abrirMenu(true); });
    ['#cerrar-menu', '#cerrar-menu2', '#velo'].forEach(function (s) { $(s).addEventListener('click', function () { abrirMenu(false); }); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && document.body.classList.contains('menu-abierto')) abrirMenu(false); });
    window.addEventListener('hashchange', function () { if (!$('#app').hidden) ruta(); });
  }
  montar();
  P.alEntrar = function () { ruta(); }; // se llama al abrir sesión: muestra la pantalla de la dirección actual
  if (!$('#app').hidden) ruta();
})();
