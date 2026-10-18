/* Centro de control de MF Colombia. Todo se guarda en el servidor (Supabase) y exige la clave del panel
   (ADMIN_TOKEN) en cada operación: la autorización se valida en el servidor, no aquí.
   Cada acción se confirma SOLO cuando el servidor responde que quedó guardada. */
(function () {
  'use strict';
  var API = window.MF_API_BASE || '';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var token = '';
  try { token = sessionStorage.getItem('mf_admin_token') || ''; } catch (e) {}
  var CONT = {}, PRODS = [];
  var TALLAS = ['34', '35', '36', '37', '38', '39', '40'];

  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === 'text') n.textContent = attrs[k];
      else if (k === 'class') n.className = attrs[k];
      else if (k.slice(0, 2) === 'on') n.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] !== false && attrs[k] != null) n.setAttribute(k, attrs[k] === true ? '' : attrs[k]);
    });
    (kids || []).forEach(function (c) { n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return n;
  }
  var peso = function (n) { return '$' + Number(n).toLocaleString('es-CO'); };
  var msg = function (t, mal) { var m = $('#msg'); m.textContent = t || ''; m.className = mal ? 'mal' : (t ? 'ok' : ''); };

  function api(ruta, opt) {
    opt = opt || {};
    return fetch(API + '/api/' + ruta, {
      method: opt.method || 'GET',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: opt.body ? JSON.stringify(opt.body) : undefined,
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) {
        if (r.status === 401) { salir(); throw new Error('Clave incorrecta o sesión vencida'); }
        if (!r.ok) throw new Error(d.error || 'No se pudo completar (' + r.status + ')');
        return d;
      });
    });
  }
  var falla = function (e) { msg(e.message || 'Error de conexión', true); };

  function campo(etq, input, cls) { return el('label', { class: cls || '' }, [etq, input]); }
  function chk(etq, id, on) { var i = el('input', { type: 'checkbox', id: id }); i.checked = !!on; return el('label', { class: 'ck' }, [i, etq]); }

  // ---------- Productos ----------
  function pintarProductos() {
    var cont = $('#p-productos'); cont.textContent = '';
    cont.appendChild(el('div', { class: 'barra' }, [el('button', { type: 'button', text: 'Nuevo producto', onclick: function () { formProducto(null); } })]));
    var tb = el('tbody');
    PRODS.forEach(function (p) {
      var u = Object.keys(p.stock || {}).reduce(function (s, k) { return s + (+p.stock[k] || 0); }, 0);
      tb.appendChild(el('tr', {}, [
        el('td', { text: p.nombre }), el('td', { text: peso(p.precio) }), el('td', { text: String(u) + ' u.' }),
        el('td', { text: p.visible ? 'Publicado' : 'Oculto' }), el('td', { text: p.coleccion || '—' }),
        el('td', {}, [el('button', { type: 'button', class: 'claro', text: 'Editar', onclick: function () { formProducto(p); } })]),
      ]));
    });
    cont.appendChild(el('table', {}, [el('thead', {}, [el('tr', {}, ['Producto', 'Precio', 'Inventario', 'Estado', 'Colección', ''].map(function (t) { return el('th', { text: t }); }))]), tb]));
    cont.appendChild(el('div', { id: 'form-prod' }));
  }
  function formProducto(p) {
    var nuevo = !p; p = p || { stock: {}, imagenes: [], colores: [], visible: true, orden: 0 };
    var f = $('#form-prod'); f.textContent = '';
    var tallas = el('div', { class: 'tallas' }, TALLAS.map(function (t) { return el('label', {}, ['Talla ' + t, el('input', { type: 'number', min: '0', max: '9999', 'data-t': t, value: p.stock && p.stock[t] != null ? p.stock[t] : 0 })]); }));
    var cols = (CONT.colecciones || []).map(function (c) { return el('option', { value: c.id, text: c.nombre }); });
    var sel = el('select', { id: 'f-col' }, [el('option', { value: '', text: '— sin colección —' })].concat(cols));
    sel.value = p.coleccion || '';
    var form = el('form', { class: 'form' }, [
      campo('Identificador (único, sin espacios)', el('input', { id: 'f-id', value: p.id || '', maxlength: '64', required: true, readonly: !nuevo })),
      campo('Nombre', el('input', { id: 'f-nombre', value: p.nombre || '', maxlength: '120', required: true })),
      campo('Precio (COP, entero)', el('input', { id: 'f-precio', type: 'number', min: '1', step: '1', value: p.precio || '', required: true })),
      campo('Colección', sel),
      campo('Orden en la tienda (menor primero)', el('input', { id: 'f-orden', type: 'number', step: '1', value: p.orden || 0 })),
      campo('Descripción', el('textarea', { id: 'f-desc', maxlength: '1500', text: p.descripcion || '' }), 'ancho'),
      campo('Imágenes (una URL https:// o assets/... por línea; la primera es la principal)', el('textarea', { id: 'f-imgs', text: (p.imagenes || []).join('\n') }), 'ancho'),
      campo('Colores (uno por línea: Nombre #RRGGBB)', el('textarea', { id: 'f-cols', text: (p.colores || []).map(function (c) { return c.n + ' ' + c.h; }).join('\n') }), 'ancho'),
      el('div', { class: 'ancho' }, [el('p', { class: 'nota', text: 'Inventario por talla' }), tallas]),
      chk('Publicado (visible en la tienda)', 'f-vis', p.visible !== false), chk('Destacado en el inicio', 'f-dest', p.destacado),
      el('div', { class: 'ancho barra' }, [el('button', { type: 'submit', text: nuevo ? 'Crear producto' : 'Guardar cambios' }), el('button', { type: 'button', class: 'claro', text: 'Cancelar', onclick: function () { f.textContent = ''; } })]),
    ]);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var stock = {}; form.querySelectorAll('[data-t]').forEach(function (i) { stock[i.getAttribute('data-t')] = parseInt(i.value || '0', 10) || 0; });
      var colores = [];
      var okColores = $('#f-cols').value.split('\n').map(function (l) { return l.trim(); }).filter(Boolean).every(function (l) {
        var m = /^(.+?)\s+(#[0-9a-fA-F]{6})$/.exec(l); if (!m) return false; colores.push({ n: m[1], h: m[2] }); return true;
      });
      if (!okColores) return msg('Cada color va como: Nombre #RRGGBB (ej. Negro #111111)', true);
      var imgs = $('#f-imgs').value.split('\n').map(function (l) { return l.trim(); }).filter(Boolean);
      var prod = { id: $('#f-id').value.trim(), nombre: $('#f-nombre').value, precio: Number($('#f-precio').value), descripcion: $('#f-desc').value,
        imagenes: imgs, imagen: imgs[0] || '', colores: colores, stock: stock, coleccion: $('#f-col').value, orden: parseInt($('#f-orden').value || '0', 10) || 0,
        visible: $('#f-vis').checked, destacado: $('#f-dest').checked };
      msg('Guardando…');
      api('admin-tienda', { method: 'POST', body: { recurso: 'producto', producto: prod } })
        .then(function () { msg('Producto guardado en el servidor ✓'); return cargarProductos(); }).catch(falla);
    });
    f.appendChild(form); form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function cargarProductos() { return api('admin-tienda?recurso=productos').then(function (d) { PRODS = d.productos || []; pintarProductos(); }); }

  // ---------- Envío ----------
  function cargarEnvio() {
    return api('admin-tienda?recurso=envio').then(function (d) {
      var c = $('#p-envio'); c.textContent = '';
      var i = el('input', { id: 'f-tarifa', type: 'number', min: '0', step: '1', value: d.tarifa });
      var form = el('form', { class: 'form' }, [
        campo('Tarifa de envío (COP) — se suma al subtotal en cada compra online', i),
        el('p', { class: 'nota ancho', text: 'Total a pagar = subtotal de productos + esta tarifa. El servidor la guarda en cada pedido: cambiarla no altera pedidos ya creados.' }),
        el('div', { class: 'ancho' }, [el('button', { type: 'submit', text: 'Guardar tarifa' })]),
      ]);
      form.addEventListener('submit', function (e) {
        e.preventDefault(); msg('Guardando…');
        api('admin-tienda', { method: 'POST', body: { recurso: 'envio', tarifa: Number(i.value) } }).then(function (r) { msg('Tarifa guardada: ' + peso(r.tarifa) + ' ✓'); }).catch(falla);
      });
      c.appendChild(form);
    });
  }

  // ---------- Contenido ----------
  var ETQ = { hero_kicker: 'Inicio · texto pequeño sobre el título', hero_titulo: 'Inicio · título principal', boton_coleccion: 'Texto de los botones "Ver colección"', band_titulo: 'Banda · título', band_texto: 'Banda · texto', band_boton: 'Banda · texto del botón' };
  function cargarContenido() {
    return api('admin-tienda?recurso=contenido').then(function (d) {
      CONT = d.contenido || {}; var t = CONT.textos || {}, s = CONT.secciones || {};
      var c = $('#p-contenido'); c.textContent = '';
      var campos = Object.keys(ETQ).map(function (k) { return campo(ETQ[k], el('input', { 'data-x': k, value: t[k] || '', maxlength: '200', placeholder: 'Vacío = texto original de la tienda' })); });
      var secs = [['band', 'Mostrar la banda "Pocas unidades por modelo"'], ['comunidad', 'Mostrar Comunidad Marlon'], ['valores', 'Mostrar los 3 valores (Alta calidad…)']].map(function (x) { return chk(x[1], 's-' + x[0], s[x[0]] !== false); });
      var ta = el('textarea', { id: 'f-colecciones', text: (CONT.colecciones || []).map(function (k) { return k.id + ' | ' + k.nombre + (k.visible === false ? ' | oculta' : ''); }).join('\n') });
      var form = el('form', { class: 'form' }, campos.concat(secs, [
        campo('Colecciones (una por línea: id | Nombre | oculta). Asigna cada producto a una colección en la pestaña Productos.', ta, 'ancho'),
        el('p', { class: 'nota ancho', text: 'Los botones siguen haciendo su función (abrir la colección, comprar, agregar al carrito); aquí solo cambia lo comercial: textos, visibilidad y colecciones.' }),
        el('div', { class: 'ancho' }, [el('button', { type: 'submit', text: 'Guardar contenido' })]),
      ]));
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var textos = {}; form.querySelectorAll('[data-x]').forEach(function (i) { if (i.value.trim()) textos[i.getAttribute('data-x')] = i.value.trim(); });
        var secciones = { band: $('#s-band').checked, comunidad: $('#s-comunidad').checked, valores: $('#s-valores').checked };
        var colecciones = ta.value.split('\n').map(function (l) { return l.trim(); }).filter(Boolean).map(function (l) { var p = l.split('|').map(function (x) { return x.trim(); }); return { id: p[0], nombre: p[1] || '', visible: p[2] !== 'oculta' }; });
        msg('Guardando…');
        api('admin-tienda', { method: 'POST', body: { recurso: 'contenido', contenido: { textos: textos, secciones: secciones, colecciones: colecciones } } })
          .then(function (r) { CONT = r.contenido; msg('Contenido guardado ✓ (la tienda lo muestra al recargar)'); }).catch(falla);
      });
      c.appendChild(form);
    });
  }

  // ---------- Pedidos y despachos ----------
  var ENVIOS = [['PREPARANDO', 'Preparando'], ['EN_CAMINO', 'En camino'], ['ENTREGADO', 'Entregado'], ['DEVUELTO', 'Devuelto']];
  function cargarPedidos() {
    var c = $('#p-pedidos'); c.textContent = '';
    var f = el('select', { id: 'f-ped' }, [el('option', { value: 'preparacion=pendiente', text: 'Pagados por preparar' }), el('option', { value: 'pago=APPROVED', text: 'Todos los pagados' }), el('option', { value: 'pago=PENDING', text: 'Pago pendiente' }), el('option', { value: '', text: 'Todos' })]);
    f.addEventListener('change', listar);
    c.appendChild(el('div', { class: 'barra' }, [campo('Ver ', f), el('button', { type: 'button', class: 'claro', text: 'Actualizar', onclick: listar })]));
    c.appendChild(el('div', { id: 'lista-ped' }));
    return listar();
  }
  function listar() {
    return api('admin-pedidos?' + $('#f-ped').value + '&limite=100').then(function (d) {
      var l = $('#lista-ped'); l.textContent = '';
      if (!d.pedidos.length) l.appendChild(el('p', { class: 'suave', text: 'No hay pedidos en esta vista.' }));
      d.pedidos.forEach(function (p) { l.appendChild(tarjeta(p)); });
    }).catch(falla);
  }
  function tarjeta(p) {
    var cl = p.cliente || {}, it = Array.isArray(p.items) ? p.items : [];
    var sub = p.subtotal_centavos == null ? null : Number(p.subtotal_centavos) / 100, env = Number(p.envio_centavos || 0) / 100, tot = Number(p.monto_centavos) / 100;
    var det = it.map(function (i) { return el('div', { class: 'linea' }, [el('span', { text: i.nombre + (i.color ? ' · ' + i.color : '') + ' · talla ' + i.talla + ' · x' + i.cant }), el('span', { text: peso(i.precio * i.cant) })]); });
    if (sub != null) { det.push(el('div', { class: 'linea suave' }, [el('span', { text: 'Subtotal' }), el('span', { text: peso(sub) })])); det.push(el('div', { class: 'linea suave' }, [el('span', { text: 'Envío aplicado' }), el('span', { text: peso(env) })])); }
    else det.push(el('div', { class: 'linea suave' }, [el('span', { text: 'Pedido anterior: el total ya incluía su envío' }), el('span')]));
    det.push(el('div', { class: 'linea tot' }, [el('span', { text: 'Total cobrado' }), el('span', { text: peso(tot) })]));
    var kids = [
      el('div', { class: 'fila' }, [el('span', { class: 'ref', text: p.referencia }), el('span', { class: 'etiqueta ' + p.estado_pago, text: ({ APPROVED: 'Pagado', PENDING: 'Pago pendiente', DECLINED: 'Rechazado', VOIDED: 'Anulado', ERROR: 'Error' })[p.estado_pago] || p.estado_pago })]),
      el('p', { text: (cl.nombre || '') + ' · ' + (cl.tel || '') + ' · ' + (cl.direccion || '') }),
    ].concat(det);
    if (p.alerta) kids.push(el('div', { class: 'alerta', text: 'Revisar: ' + p.alerta }));
    if (p.estado_pago === 'APPROVED') {
      var prep = el('input', { type: 'checkbox' }); prep.checked = !!p.preparado_en;
      var est = el('select', {}, ENVIOS.map(function (x) { return el('option', { value: x[0], text: x[1] }); })); est.value = p.estado_envio;
      var tr = el('input', { placeholder: 'Transportadora', value: p.transportadora || '', maxlength: '40' });
      var gu = el('input', { placeholder: 'N.º de guía', value: p.guia || '', maxlength: '60' });
      var inc = el('input', { placeholder: 'Incidencia (opcional)', value: p.incidencia || '', maxlength: '200' });
      var nota = el('input', { placeholder: 'Nota interna (opcional)', value: p.nota_despacho || '', maxlength: '300' });
      var b = el('button', { type: 'button', text: 'Guardar despacho', onclick: function () {
        msg('Guardando…');
        api('admin-pedidos', { method: 'POST', body: { id: p.id, estado_envio: est.value, transportadora: tr.value, guia: gu.value, preparado: prep.checked, incidencia: inc.value, nota_despacho: nota.value } })
          .then(function () { msg('Despacho guardado ✓'); return listar(); }).catch(falla);
      } });
      kids.push(el('div', { class: 'envio' }, [el('label', { class: 'ck' }, [prep, ' Preparado']), est, tr, gu, inc, nota, b]));
      kids.push(el('p', { class: 'nota', text: 'Las guías y transportadoras las escribes tú; no hay consulta automática a la transportadora. Pagado no significa despachado.' + (p.enviado_en ? ' Despachado: ' + new Date(p.enviado_en).toLocaleString('es-CO') : '') }));
    }
    return el('article', { class: 'pedido' }, kids);
  }

  // ---------- Registro ----------
  function cargarRegistro() {
    return api('admin-tienda?recurso=eventos&limite=100').then(function (d) {
      var c = $('#p-registro'); c.textContent = '';
      var tb = el('tbody');
      d.eventos.forEach(function (e) { tb.appendChild(el('tr', {}, [el('td', { text: new Date(e.creado_en).toLocaleString('es-CO') }), el('td', { text: e.tipo }), el('td', { class: 'ref', text: e.referencia || '' }), el('td', { class: 'nota', text: JSON.stringify(e.detalle) })])); });
      c.appendChild(el('table', {}, [el('thead', {}, [el('tr', {}, ['Fecha', 'Evento', 'Referencia', 'Detalle'].map(function (t) { return el('th', { text: t }); }))]), tb]));
    });
  }

  // ---------- Sesión ----------
  var CARGA = { productos: cargarProductos, envio: cargarEnvio, contenido: cargarContenido, pedidos: cargarPedidos, registro: cargarRegistro };
  function abrir(t) {
    document.querySelectorAll('#tabs button').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-t') === t); });
    document.querySelectorAll('.panel').forEach(function (p) { p.classList.toggle('on', p.id === 'p-' + t); });
    msg(''); CARGA[t]().catch(falla);
  }
  function entrar() {
    token = $('#token').value.trim() || token;
    if (!token) return msg('Escribe la clave del panel', true);
    msg('Verificando…');
    api('admin-tienda?recurso=contenido').then(function (d) {
      CONT = d.contenido || {};
      try { sessionStorage.setItem('mf_admin_token', token); } catch (e) {}
      $('#app').hidden = false; $('#salir').hidden = false; $('#entrar').hidden = true; $('#token').hidden = true; $('#token').value = '';
      abrir('productos');
    }).catch(falla);
  }
  function salir() {
    token = ''; try { sessionStorage.removeItem('mf_admin_token'); } catch (e) {}
    $('#app').hidden = true; $('#salir').hidden = true; $('#entrar').hidden = false; $('#token').hidden = false;
  }
  $('#entrar').addEventListener('click', entrar);
  $('#token').addEventListener('keydown', function (e) { if (e.key === 'Enter') entrar(); });
  $('#salir').addEventListener('click', function () { salir(); msg('Sesión cerrada'); });
  $('#tabs').addEventListener('click', function (e) { var b = e.target.closest('button[data-t]'); if (b) abrir(b.getAttribute('data-t')); });
  if (token) entrar();
})();
