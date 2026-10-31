/* Resumen de la pantalla de inicio del panel: números reales + "¿Qué hago ahora?".
   Cada dato se pide por separado: si uno falla, ese cuadro muestra "—" y el resto sigue funcionando. */
(function () {
  'use strict';
  var POCO_STOCK = 3; // un producto cuenta como "poco stock" si le quedan 3 pares o menos en total
  var MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  var cargando = 0;

  function A() { return window.mfAdmin; }
  function peso(n) { return '$' + Math.round(Number(n) || 0).toLocaleString('es-CO'); }
  function bogota() { // fecha de hoy en Colombia (UTC-5, sin horario de verano)
    var d = new Date(Date.now() - 5 * 3600 * 1000);
    return { y: d.getUTCFullYear(), m: d.getUTCMonth(), d: d.getUTCDate(), dia: d.getUTCDay() };
  }
  function pide(ruta) { return A().api(ruta).catch(function () { return null; }); }

  function tarjeta(ir, titulo, grande, pie, aviso) {
    var el = A().el;
    return el('div', { class: 'rc' + (aviso ? ' aviso' : ''), role: 'button', tabindex: '0', 'data-ir': ir, 'aria-label': titulo + ': ' + grande + '. ' + pie }, [
      el('span', { class: 'rc-t', text: titulo }),
      el('span', { class: 'rc-n', text: grande }),
      el('span', { class: 'rc-p', text: pie }),
    ]);
  }

  function pintar(c, r) {
    var el = A().el, hoy = bogota();
    var mesNombre = MESES[hoy.m];
    c.textContent = '';
    c.appendChild(el('p', { class: 'rs-saludo', text: 'Hoy, ' + hoy.d + ' de ' + mesNombre + ' de ' + hoy.y }));
    c.appendChild(el('h2', { class: 'rs-tit', text: 'Así va tu tienda' }));

    var f = r.fin && r.fin.resumen, pend = r.pedidos ? r.pedidos.length : null, looks = r.looks ? r.looks.length : null;
    var cobrar = f ? f.por_cobrar : null;
    var pocos = r.prods ? r.prods.filter(function (p) {
      var t = Object.keys(p.stock || {}).reduce(function (s, k) { return s + (+p.stock[k] || 0); }, 0);
      return p.visible !== false && t <= POCO_STOCK;
    }) : null;

    var grid = el('div', { class: 'rs-grid' }, [
      tarjeta('finanzas', 'Vendiste en ' + mesNombre, f ? peso(f.total) : '—', f ? (f.n === 1 ? '1 compra' : f.n + ' compras') + ' · toca para ver el detalle' : 'No se pudo cargar'),
      tarjeta('pedidos', 'Por preparar', pend == null ? '—' : (pend >= 100 ? '100+' : String(pend)), pend == null ? 'No se pudo cargar' : 'pagados que aún no despachas', pend > 0),
      tarjeta('whatsapp', 'Por cobrar (WhatsApp)', cobrar ? String(cobrar.n) : '—', cobrar ? (cobrar.n ? peso(cobrar.total) + ' pendientes' : 'nada pendiente') : 'No se pudo cargar', cobrar && cobrar.n > 0),
      tarjeta('inventario', 'Poco stock', pocos ? String(pocos.length) : '—', pocos ? 'productos con ' + POCO_STOCK + ' pares o menos' : 'No se pudo cargar', pocos && pocos.length > 0),
    ]);
    c.appendChild(grid);

    // ¿Qué hago ahora? Solo lo que realmente está pendiente, en orden de importancia.
    var tareas = [];
    if (pend > 0) tareas.push(['pedidos', pend + (pend === 1 ? ' pedido pagado espera' : ' pedidos pagados esperan') + ' despacho', 'Anota transportadora y guía']);
    if (cobrar && cobrar.n > 0) tareas.push(['whatsapp', cobrar.n + (cobrar.n === 1 ? ' pedido de WhatsApp sin cobrar' : ' pedidos de WhatsApp sin cobrar') + ' (' + peso(cobrar.total) + ')', 'Cámbialo a Pagado cuando te paguen']);
    if (looks > 0) tareas.push(['comunidad', looks + (looks === 1 ? ' foto de clienta por revisar' : ' fotos de clientas por revisar'), 'Nada se publica sin tu aprobación']);
    if (pocos && pocos.length) tareas.push(['inventario', pocos.length + (pocos.length === 1 ? ' producto casi agotado' : ' productos casi agotados'), 'Revisa las tallas: ' + pocos.slice(0, 3).map(function (p) { return p.nombre; }).join(', ') + (pocos.length > 3 ? '…' : '')]);

    var caja = el('div', { class: 'rs-hacer' });
    caja.appendChild(el('h3', { text: '¿Qué hago ahora?' }));
    var algunoFallo = !r.fin || !r.pedidos || !r.prods;
    if (tareas.length) {
      tareas.forEach(function (t) {
        caja.appendChild(el('div', { class: 'rs-tarea', role: 'button', tabindex: '0', 'data-ir': t[0] }, [
          el('span', { class: 'rs-punto', 'aria-hidden': 'true' }),
          el('span', { class: 'rs-tx' }, [el('b', { text: t[1] }), el('small', { text: t[2] })]),
          el('i', { class: 'fl', 'aria-hidden': 'true', text: '›' }),
        ]));
      });
    } else if (algunoFallo) {
      caja.appendChild(el('p', { class: 'suave', text: 'No pude revisar todo ahora. Abre cada sección para ver lo pendiente.' }));
    } else {
      caja.appendChild(el('p', { class: 'rs-ok', text: 'Todo al día: no tienes pedidos por despachar ni cobros pendientes.' }));
    }
    c.appendChild(caja);
  }

  function cargar() {
    var c = document.getElementById('resumen'); if (!c || !A()) return Promise.resolve();
    var turno = ++cargando, hoy = bogota();
    var mes = hoy.y + '-' + String(hoy.m + 1).padStart(2, '0');
    if (!c.firstChild) c.appendChild(A().el('p', { class: 'suave', text: 'Cargando tu resumen…' }));
    return Promise.all([
      pide('admin-tienda?recurso=finanzas&mes=' + mes),
      pide('admin-pedidos?preparacion=pendiente&limite=100'),
      pide('admin-tienda?recurso=looks'),
      pide('admin-tienda?recurso=productos'),
    ]).then(function (v) {
      if (turno !== cargando) return; // llegó una carga más nueva
      pintar(c, { fin: v[0], pedidos: v[1] && v[1].pedidos, looks: v[2] && v[2].pendientes, prods: v[3] && v[3].productos });
    });
  }

  function ir(e) {
    var t = e.target.closest && e.target.closest('[data-ir]'); if (!t) return;
    if (e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    var b = document.querySelector('#tabs button[data-t="' + t.getAttribute('data-ir') + '"]'); if (b) b.click();
  }
  document.addEventListener('click', function (e) { if (e.target.closest && e.target.closest('#resumen')) ir(e); });
  document.addEventListener('keydown', function (e) { if (e.target.closest && e.target.closest('#resumen')) ir(e); });

  window.mfAdminResumen = { cargar: cargar };
})();
