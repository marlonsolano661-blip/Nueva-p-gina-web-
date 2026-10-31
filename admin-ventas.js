/* Pedidos por WhatsApp y Finanzas (panel). Todo se guarda en el servidor y exige la clave del panel.
   - WhatsApp: tabla para anotar a mano los pedidos que llegan por WhatsApp. El total lo calcula el servidor.
   - Finanzas: resumen de lo vendido (tienda online + WhatsApp pagados) y el detalle de cada compra.
   Los textos se pintan con textContent (nada de HTML de la clienta se interpreta). */
(function () {
  'use strict';
  var A = window.mfAdmin, el = function () { return A.el.apply(null, arguments); };
  var peso = function (n) { return '$' + Number(n || 0).toLocaleString('es-CO'); };
  var TALLAS = ['34', '35', '36', '37', '38', '39', '40'];
  var METODOS = ['Transferencia', 'Nequi', 'Daviplata', 'Efectivo', 'Otro'];
  var PAGO = { PAGADO: 'Pagado', PENDIENTE: 'Por cobrar', CANCELADO: 'Cancelado' };
  var ENVIO = { PREPARANDO: 'Preparando', EN_CAMINO: 'En camino', ENTREGADO: 'Entregado', DEVUELTO: 'Devuelto' };
  var MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  var fechaCorta = function (f) { var p = String(f).split('-'); return p.length === 3 ? Number(p[2]) + ' ' + MESES[Number(p[1]) - 1].slice(0, 3) + ' ' + p[0] : String(f); };
  var nombreMes = function (m) { var p = String(m).split('-'); return MESES[Number(p[1]) - 1] + ' ' + p[0]; };
  var mesCorto = function (m) { var p = String(m).split('-'); return MESES[Number(p[1]) - 1].slice(0, 3) + ' ' + p[0]; };
  var hoy = function () { return new Date(Date.now() - 5 * 3600 * 1000).toISOString().slice(0, 10); }; // hoy en Colombia
  var opciones = function (obj, sel) { return Object.keys(obj).map(function (k) { var o = el('option', { value: k, text: obj[k] }); if (k === sel) o.selected = true; return o; }); };

  // ================= Pedidos por WhatsApp =================
  var W = { ventas: [], filtro: 'todos', prods: [], tarifa: 0 };
  var rootW = function () { return document.getElementById('p-whatsapp'); };

  function cuerpoDe(v, cambios) {
    var b = { fecha: v.fecha, cliente: v.cliente, telefono: v.telefono || '', ciudad: v.ciudad || '', items: v.items, envio: v.envio, descuento: v.descuento, metodo_pago: v.metodo_pago, estado_pago: v.estado_pago, estado_envio: v.estado_envio, guia: v.guia || '', nota: v.nota || '' };
    Object.keys(cambios || {}).forEach(function (k) { b[k] = cambios[k]; });
    return b;
  }

  function abrirWhatsapp() {
    var c = rootW(); c.textContent = '';
    c.appendChild(el('p', { class: 'nota', text: 'Anota aquí los pedidos que te llegan por WhatsApp. Los que estén "Pagado" se suman solos en Finanzas junto con los de la tienda online.' }));
    c.appendChild(el('button', { type: 'button', text: '+ Registrar pedido', onclick: function () { formulario(null); } }));
    c.appendChild(el('div', { id: 'wa-form' }));
    c.appendChild(el('div', { class: 'wa-filtros', id: 'wa-filtros' }));
    c.appendChild(el('div', { id: 'wa-tabla' }));
    // Catálogo y tarifa solo para ayudar a llenar el formulario más rápido; si fallan, el formulario igual se puede escribir a mano.
    A.api('admin-tienda?recurso=productos').then(function (d) { W.prods = d.productos || []; }).catch(function () {});
    A.api('admin-tienda?recurso=envio').then(function (d) { W.tarifa = Number(d.tarifa) || 0; }).catch(function () {});
    return recargarW();
  }

  function recargarW() {
    return A.api('admin-tienda?recurso=ventas_wa').then(function (d) { W.ventas = d.ventas || []; pintarW(); });
  }

  function pintarW() {
    var f = document.getElementById('wa-filtros'); f.textContent = '';
    [['todos', 'Todos'], ['por_cobrar', 'Por cobrar'], ['pagados', 'Pagados']].forEach(function (x) {
      f.appendChild(el('button', { type: 'button', class: 'chip' + (W.filtro === x[0] ? ' on' : ' claro'), text: x[1], onclick: function () { W.filtro = x[0]; pintarW(); } }));
    });
    var lista = W.ventas.filter(function (v) { return W.filtro === 'todos' || (W.filtro === 'por_cobrar' ? v.estado_pago === 'PENDIENTE' : v.estado_pago === 'PAGADO'); });
    var pagado = 0, porCobrar = 0;
    W.ventas.forEach(function (v) { if (v.estado_pago === 'PAGADO') pagado += Number(v.total); else if (v.estado_pago === 'PENDIENTE') porCobrar += Number(v.total); });
    var t = document.getElementById('wa-tabla'); t.textContent = '';
    t.appendChild(el('p', { class: 'wa-resumen', text: W.ventas.length + ' pedido' + (W.ventas.length === 1 ? '' : 's') + ' · Pagado ' + peso(pagado) + ' · Por cobrar ' + peso(porCobrar) }));
    if (!lista.length) { t.appendChild(el('p', { class: 'nota', text: W.ventas.length ? 'No hay pedidos en esta vista.' : 'Todavía no hay pedidos de WhatsApp. Toca "Registrar pedido" para anotar el primero.' })); return; }
    var tb = el('tbody');
    lista.forEach(function (v) { tb.appendChild(filaW(v)); });
    t.appendChild(el('p', { class: 'nota wa-hint', text: 'Desliza la tabla hacia el lado para ver Pago y Envío.' }));
    t.appendChild(el('div', { class: 'wa-scroll' }, [el('table', { class: 'tabla-wa' }, [el('thead', {}, [el('tr', {}, ['Fecha', 'Clienta', 'Productos', 'Total', 'Pago', 'Envío', ''].map(function (x) { return el('th', { text: x }); }))]), tb])]));
  }

  function filaW(v) {
    var prods = (v.items || []).map(function (i) { return i.cant + '× ' + i.nombre + (i.talla ? ' (' + i.talla + ')' : ''); }).join(', ');
    var pago = el('select', { 'aria-label': 'Estado del pago' }, opciones(PAGO, v.estado_pago));
    var env = el('select', { 'aria-label': 'Estado del envío' }, opciones(ENVIO, v.estado_envio));
    var rapido = function (campo, sel) { return function () {
      A.msg('Guardando…');
      A.api('admin-tienda', { method: 'POST', body: { recurso: 'venta_wa', accion: 'actualizar', id: v.id, venta: cuerpoDe(v, (function (o) { o[campo] = sel.value; return o; })({})) } })
        .then(function () { A.msg('Guardado ✓'); return recargarW(); }).catch(function (e) { A.falla(e); return recargarW().catch(function () {}); });
    }; };
    pago.addEventListener('change', rapido('estado_pago', pago));
    env.addEventListener('change', rapido('estado_envio', env));
    pago.className = 'pg-' + v.estado_pago;
    var quitar = el('button', { type: 'button', class: 'claro', text: 'Quitar', onclick: function () {
      if (!window.confirm('¿Quitar el pedido de ' + v.cliente + ' por ' + peso(v.total) + '? No se puede deshacer.')) return;
      A.msg('Quitando…');
      A.api('admin-tienda', { method: 'POST', body: { recurso: 'venta_wa', accion: 'eliminar', id: v.id } }).then(function () { A.msg('Pedido quitado'); return recargarW(); }).catch(A.falla);
    } });
    var datos = [v.telefono, v.ciudad, v.metodo_pago, v.guia ? 'Guía ' + v.guia : '', v.nota].filter(Boolean).join(' · ');
    return el('tr', {}, [
      el('td', { text: fechaCorta(v.fecha) }),
      el('td', {}, [el('strong', { text: v.cliente }), el('div', { class: 'nota', text: datos })]),
      el('td', { text: prods }),
      el('td', { class: 'num', text: peso(v.total) }),
      el('td', {}, [pago]), el('td', {}, [env]),
      el('td', { class: 'acc-wa' }, [el('button', { type: 'button', class: 'claro', text: 'Editar', onclick: function () { formulario(v); } }), quitar]),
    ]);
  }

  function formulario(v) {
    var cont = document.getElementById('wa-form'); cont.textContent = '';
    var nuevo = !v;
    v = v || { fecha: hoy(), cliente: '', telefono: '', ciudad: '', items: [{ nombre: '', talla: '', color: '', cant: 1, precio: '' }], envio: W.tarifa, descuento: 0, metodo_pago: 'Transferencia', estado_pago: 'PAGADO', estado_envio: 'PREPARANDO', guia: '', nota: '' };
    var inp = function (attrs) { return el('input', attrs); };
    var fecha = inp({ type: 'date', value: v.fecha, max: hoy() });
    var cliente = inp({ type: 'text', maxlength: '80', value: v.cliente, placeholder: 'Nombre de la clienta', autocomplete: 'off' });
    var tel = inp({ type: 'tel', maxlength: '20', value: v.telefono || '', placeholder: '311 575 2334', inputmode: 'tel' });
    var ciudad = inp({ type: 'text', maxlength: '60', value: v.ciudad || '', placeholder: 'Ciudad' });
    var envio = inp({ type: 'number', min: '0', step: '500', inputmode: 'numeric', value: String(v.envio || 0) });
    var desc = inp({ type: 'number', min: '0', step: '500', inputmode: 'numeric', value: String(v.descuento || 0) });
    var metodo = el('select', {}, METODOS.map(function (m) { var o = el('option', { value: m, text: m }); if (m === v.metodo_pago) o.selected = true; return o; }));
    var pago = el('select', {}, opciones(PAGO, v.estado_pago));
    var estEnv = el('select', {}, opciones(ENVIO, v.estado_envio));
    var guia = inp({ type: 'text', maxlength: '60', value: v.guia || '', placeholder: 'N.º de guía (opcional)' });
    var nota = inp({ type: 'text', maxlength: '300', value: v.nota || '', placeholder: 'Nota (opcional)' });
    var total = el('div', { class: 'wa-total' });
    var lineas = el('div', { class: 'wa-lineas' });
    var filas = [];
    var datalistTallas = el('datalist', { id: 'wa-tallas' }, TALLAS.map(function (t) { return el('option', { value: t }); }));

    function recalcular() {
      var sub = 0;
      filas.forEach(function (f) { sub += (parseInt(f.cant.value, 10) || 0) * (parseInt(f.precio.value, 10) || 0); });
      var e = parseInt(envio.value, 10) || 0, d = parseInt(desc.value, 10) || 0;
      total.textContent = '';
      [['Productos', sub], ['Envío', e], ['Descuento', -d]].forEach(function (x) { total.appendChild(el('div', { class: 'linea suave' }, [el('span', { text: x[0] }), el('span', { text: (x[1] < 0 ? '−' : '') + peso(Math.abs(x[1])) })])); });
      total.appendChild(el('div', { class: 'linea tot' }, [el('span', { text: 'Total del pedido' }), el('span', { text: peso(sub + e - d) })]));
    }
    function lineaNueva(i) {
      var elegir = el('select', { 'aria-label': 'Elegir del catálogo' }, [el('option', { value: '', text: 'Elegir del catálogo…' })].concat(W.prods.map(function (p) { return el('option', { value: p.id, text: p.nombre + ' · ' + peso(p.precio) }); })));
      var nombre = inp({ type: 'text', maxlength: '120', value: i.nombre || '', placeholder: 'Producto', 'aria-label': 'Producto' });
      var talla = inp({ type: 'text', maxlength: '10', value: i.talla || '', placeholder: 'Talla', list: 'wa-tallas', 'aria-label': 'Talla' });
      var color = inp({ type: 'text', maxlength: '40', value: i.color || '', placeholder: 'Color', 'aria-label': 'Color' });
      var cant = inp({ type: 'number', min: '1', max: '100', inputmode: 'numeric', value: String(i.cant || 1), 'aria-label': 'Cantidad' });
      var precio = inp({ type: 'number', min: '1', step: '100', inputmode: 'numeric', value: i.precio === '' ? '' : String(i.precio), placeholder: 'Precio', 'aria-label': 'Precio de cada par' });
      var f = { nombre: nombre, talla: talla, color: color, cant: cant, precio: precio };
      var caja = el('div', { class: 'wa-linea' });
      var quitar = el('button', { type: 'button', class: 'claro', text: 'Quitar', onclick: function () { if (filas.length < 2) return A.msg('El pedido necesita al menos un producto', true); filas.splice(filas.indexOf(f), 1); caja.remove(); recalcular(); } });
      if (W.prods.length) caja.appendChild(elegir);
      [nombre, el('div', { class: 'wa-mini' }, [talla, color, cant, precio]), quitar].forEach(function (x) { caja.appendChild(x); });
      elegir.addEventListener('change', function () {
        var p = W.prods.filter(function (x) { return x.id === elegir.value; })[0]; if (!p) return;
        nombre.value = p.nombre; precio.value = String(p.precio); recalcular();
      });
      [cant, precio].forEach(function (x) { x.addEventListener('input', recalcular); });
      filas.push(f); lineas.appendChild(caja);
    }
    v.items.forEach(lineaNueva);
    [envio, desc].forEach(function (x) { x.addEventListener('input', recalcular); });

    var guardar = el('button', { type: 'button', text: nuevo ? 'Guardar pedido' : 'Guardar cambios' });
    guardar.addEventListener('click', function () {
      var venta = {
        fecha: fecha.value, cliente: cliente.value, telefono: tel.value, ciudad: ciudad.value,
        items: filas.map(function (f) { return { nombre: f.nombre.value, talla: f.talla.value, color: f.color.value, cant: parseInt(f.cant.value, 10), precio: parseInt(f.precio.value, 10) }; }),
        envio: parseInt(envio.value, 10) || 0, descuento: parseInt(desc.value, 10) || 0, metodo_pago: metodo.value, estado_pago: pago.value, estado_envio: estEnv.value, guia: guia.value, nota: nota.value,
      };
      guardar.disabled = true; A.msg('Guardando…');
      A.api('admin-tienda', { method: 'POST', body: { recurso: 'venta_wa', accion: nuevo ? 'crear' : 'actualizar', id: nuevo ? undefined : v.id, venta: venta } })
        .then(function () { A.msg('Pedido guardado ✓'); cont.textContent = ''; return recargarW(); })
        .catch(function (e) { guardar.disabled = false; A.falla(e); });
    });
    var form = el('div', { class: 'form wa-form' }, [
      el('h3', { text: nuevo ? 'Nuevo pedido por WhatsApp' : 'Editar pedido' }),
      el('div', { class: 'wa-grid' }, [el('label', {}, ['Fecha', fecha]), el('label', {}, ['Clienta', cliente]), el('label', {}, ['Teléfono', tel]), el('label', {}, ['Ciudad', ciudad])]),
      el('h4', { text: 'Productos' }), lineas, datalistTallas,
      el('button', { type: 'button', class: 'claro', text: '+ Agregar otro producto', onclick: function () { lineaNueva({ cant: 1, precio: '' }); } }),
      el('div', { class: 'wa-grid' }, [el('label', {}, ['Envío cobrado ($)', envio]), el('label', {}, ['Descuento ($)', desc])]),
      total,
      el('div', { class: 'wa-grid' }, [el('label', {}, ['Cómo pagó', metodo]), el('label', {}, ['Pago', pago]), el('label', {}, ['Envío', estEnv]), el('label', {}, ['Guía', guia])]),
      el('label', {}, ['Nota', nota]),
      el('div', { class: 'acc2' }, [guardar, el('button', { type: 'button', class: 'claro', text: 'Cancelar', onclick: function () { cont.textContent = ''; } })]),
    ]);
    cont.appendChild(form); recalcular();
    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  window.mfAdminVentas = { abrir: abrirWhatsapp };

  // ================= Finanzas =================
  var F = { mes: 'todos', datos: null };
  var rootF = function () { return document.getElementById('p-finanzas'); };

  function abrirFinanzas() { return cargarF(F.mes); }
  function cargarF(mes) {
    return A.api('admin-tienda?recurso=finanzas&mes=' + encodeURIComponent(mes)).then(function (d) { F.mes = d.mes; F.datos = d; pintarF(); });
  }

  function tarjetaF(titulo, valor, sub, extra) { return el('div', { class: 'fin-card' + (extra ? ' ' + extra : '') }, [el('span', { class: 'fin-t', text: titulo }), el('strong', { text: valor }), sub ? el('span', { class: 'nota', text: sub }) : null]); }

  function pintarF() {
    var d = F.datos, r = d.resumen, c = rootF(); c.textContent = '';
    var sel = el('select', { id: 'fin-mes', 'aria-label': 'Mes' }, [el('option', { value: 'todos', text: 'Todos los meses' })].concat(d.meses.map(function (m) { return el('option', { value: m.mes, text: nombreMes(m.mes) }); })));
    sel.value = d.mes;
    sel.addEventListener('change', function () { cargarF(sel.value).catch(A.falla); });
    c.appendChild(el('div', { class: 'barra' }, [el('label', {}, ['Ver ', sel]), el('button', { type: 'button', class: 'claro', text: 'Actualizar', onclick: function () { cargarF(F.mes).catch(A.falla); } }), el('button', { type: 'button', class: 'claro', text: 'Descargar para Excel', onclick: function () { descargar(d); } })]));
    c.appendChild(el('div', { class: 'fin-cards' }, [
      tarjetaF('Vendiste', peso(r.total), r.n + ' compra' + (r.n === 1 ? '' : 's'), 'grande'),
      tarjetaF('Venta promedio', peso(r.ticket), 'por compra'),
      tarjetaF('Pares vendidos', String(r.pares), ''),
      tarjetaF('Tienda online', peso(r.online.total), r.online.n + ' compra' + (r.online.n === 1 ? '' : 's')),
      tarjetaF('WhatsApp', peso(r.whatsapp.total), r.whatsapp.n + ' compra' + (r.whatsapp.n === 1 ? '' : 's')),
      tarjetaF('Envíos cobrados', peso(r.envios_cobrados), 'ya incluidos en lo vendido'),
      r.descuentos ? tarjetaF('Descuentos dados', peso(r.descuentos), 'en pedidos de WhatsApp') : null,
      tarjetaF('Por cobrar', peso(r.por_cobrar.total), r.por_cobrar.n + ' pedido' + (r.por_cobrar.n === 1 ? '' : 's') + ' de WhatsApp sin pagar', r.por_cobrar.n ? 'aviso' : ''),
    ]));
    c.appendChild(el('p', { class: 'nota', text: 'Son los valores cobrados a las clientas. No se restan comisiones de Wompi, costos de los productos ni gastos. Solo cuentan las compras pagadas.' }));

    c.appendChild(el('h3', { class: 'fin-h', text: 'Mes a mes' }));
    if (!d.meses.length) c.appendChild(el('p', { class: 'nota', text: 'Todavía no hay ventas pagadas.' }));
    else {
      var tb = el('tbody');
      d.meses.forEach(function (m) { tb.appendChild(el('tr', {}, [el('td', { text: mesCorto(m.mes) }), el('td', { class: 'num', text: String(m.n) }), el('td', { class: 'num', text: peso(m.online) }), el('td', { class: 'num', text: peso(m.whatsapp) }), el('td', { class: 'num', text: peso(m.total) })])); });
      c.appendChild(el('table', {}, [el('thead', {}, [el('tr', {}, ['Mes', 'N.º', 'Tienda', 'WhatsApp', 'Total'].map(function (x) { return el('th', { text: x }); }))]), tb]));
    }
    if (d.top.length) {
      c.appendChild(el('h3', { class: 'fin-h', text: 'Lo más vendido' }));
      c.appendChild(el('ol', { class: 'fin-top' }, d.top.map(function (t) { return el('li', {}, [el('span', { text: t.nombre }), el('span', { class: 'nota', text: t.cant + ' par' + (t.cant === 1 ? '' : 'es') + ' · ' + peso(t.total) })]); })));
    }

    c.appendChild(el('h3', { class: 'fin-h', text: 'Cada compra' }));
    if (!d.detalle.length) c.appendChild(el('p', { class: 'nota', text: 'No hay compras en este periodo.' }));
    d.detalle.forEach(function (v) { c.appendChild(compra(v)); });
  }

  function compra(v) {
    var lin = v.items.map(function (i) { return el('div', { class: 'linea' }, [el('span', { text: i.cant + '× ' + i.nombre + (i.color ? ' · ' + i.color : '') + (i.talla ? ' · talla ' + i.talla : '') }), el('span', { text: peso(i.cant * i.precio) })]); });
    lin.push(el('div', { class: 'linea suave' }, [el('span', { text: 'Productos' }), el('span', { text: peso(v.subtotal) })]));
    lin.push(el('div', { class: 'linea suave' }, [el('span', { text: 'Envío' }), el('span', { text: peso(v.envio) })]));
    if (v.descuento) lin.push(el('div', { class: 'linea suave' }, [el('span', { text: 'Descuento' }), el('span', { text: '−' + peso(v.descuento) })]));
    lin.push(el('div', { class: 'linea tot' }, [el('span', { text: 'Total' }), el('span', { text: peso(v.total) })]));
    lin.push(el('p', { class: 'nota', text: [v.ciudad, 'Pagó con ' + v.metodo, ENVIO[v.envio_estado] ? 'Envío: ' + ENVIO[v.envio_estado].toLowerCase() : '', v.referencia].filter(Boolean).join(' · ') }));
    return el('details', { class: 'compra' }, [
      el('summary', {}, [el('span', { class: 'cm' }, [el('span', { class: 'cf', text: fechaCorta(v.fecha) }), el('span', { class: 'canal ' + (v.canal === 'WhatsApp' ? 'wa' : 'on'), text: v.canal === 'WhatsApp' ? 'WhatsApp' : 'Tienda' })]), el('span', { class: 'cn', text: v.cliente || 'Sin nombre' }), el('strong', { class: 'ct', text: peso(v.total) })]),
      el('div', { class: 'compra-det' }, lin),
    ]);
  }

  // CSV para Excel: UTF-8 con BOM y punto y coma (Excel en español). Las celdas que empiezan por = + - @ se neutralizan.
  function celda(x) { var s = String(x == null ? '' : x); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; }
  function descargar(d) {
    var filas = [['Fecha', 'Canal', 'Referencia', 'Clienta', 'Ciudad', 'Productos', 'Subtotal', 'Envío', 'Descuento', 'Total', 'Cómo pagó', 'Envío (estado)']];
    d.detalle.forEach(function (v) {
      filas.push([v.fecha, v.canal, v.referencia, v.cliente, v.ciudad, v.items.map(function (i) { return i.cant + 'x ' + i.nombre + (i.talla ? ' (' + i.talla + ')' : ''); }).join(' | '), v.subtotal, v.envio, v.descuento, v.total, v.metodo, ENVIO[v.envio_estado] || v.envio_estado || '']);
    });
    var txt = '﻿' + filas.map(function (f) { return f.map(celda).join(';'); }).join('\r\n');
    var url = URL.createObjectURL(new Blob([txt], { type: 'text/csv;charset=utf-8' }));
    var a = el('a', { href: url, download: 'ventas-' + d.mes + '.csv' });
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
    A.msg('Archivo descargado ✓');
  }

  window.mfAdminFinanzas = { abrir: abrirFinanzas };
})();
