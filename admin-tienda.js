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
    (kids || []).forEach(function (c) { if (c == null || c === false) return; n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return n;
  }
  var peso = function (n) { return '$' + Number(n).toLocaleString('es-CO'); };
  // Aviso flotante: se ve aunque la pantalla esté desplazada. Los de éxito se ocultan solos; los errores esperan un toque.
  var msgT = 0;
  var msg = function (t, mal) {
    var m = $('#msg'); m.textContent = t || ''; m.className = mal ? 'mal' : (t ? 'ok' : '');
    clearTimeout(msgT);
    if (t && !mal && !/…$/.test(t)) msgT = setTimeout(function () { if (m.textContent === t) { m.textContent = ''; m.className = ''; } }, 6000);
  };
  document.addEventListener('DOMContentLoaded', function () { var m = $('#msg'); if (m) m.addEventListener('click', function () { m.textContent = ''; m.className = ''; }); });

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
  function totalU(p) { return Object.keys(p.stock || {}).reduce(function (t, k) { return t + (+p.stock[k] || 0); }, 0); }
  function pintarProductos() {
    var cont = $('#p-productos'); cont.textContent = '';
    cont.appendChild(el('button', { type: 'button', text: '+ Nuevo producto', onclick: function () { formProducto(null); } }));
    cont.appendChild(el('div', { id: 'form-prod' }));
    if (!PRODS.length) cont.appendChild(el('p', { class: 'nota', text: 'Todavía no hay productos. Toca "Nuevo producto".' }));
    PRODS.forEach(function (p) {
      var u = totalU(p), foto = (p.imagenes && p.imagenes[0]) || p.imagen;
      cont.appendChild(el('article', { class: 'pcard' }, [
        foto ? el('img', { src: foto, alt: '', loading: 'lazy' }) : el('div', { class: 'sinfoto', text: 'Sin foto' }),
        el('div', {}, [el('b', { text: p.nombre }), el('div', { class: 'meta' }, [peso(p.precio) + ' · ', el('span', { class: u ? 'est-ok' : 'est-no', text: u ? u + ' pares' : 'Agotado' }), ' · ' + (p.visible ? 'Publicado' : 'Oculto')])]),
        el('div', { class: 'acc' }, [el('button', { type: 'button', text: 'Editar', onclick: function () { formProducto(p); } })]),
      ]));
    });
  }

  // ---------- Fotos: se eligen desde el teléfono, se reducen y se suben solas ----------
  function reducirFoto(file) {
    return new Promise(function (ok, mal) {
      var url = URL.createObjectURL(file), im = new Image();
      im.onload = function () {
        var M = 1400, k = Math.min(1, M / Math.max(im.naturalWidth, im.naturalHeight));
        var w = Math.max(1, Math.round(im.naturalWidth * k)), h = Math.max(1, Math.round(im.naturalHeight * k));
        var cv = document.createElement('canvas'); cv.width = w; cv.height = h;
        var cx = cv.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, w, h); cx.drawImage(im, 0, 0, w, h);
        URL.revokeObjectURL(url);
        cv.toBlob(function (bl) {
          if (!bl) return mal(new Error('No se pudo preparar la foto'));
          var fr = new FileReader();
          fr.onload = function () { ok(String(fr.result).split(',')[1] || ''); };
          fr.onerror = function () { mal(new Error('No se pudo leer la foto')); };
          fr.readAsDataURL(bl);
        }, 'image/jpeg', 0.85);
      };
      im.onerror = function () { URL.revokeObjectURL(url); mal(new Error('No se pudo abrir la foto (usa JPG, PNG o WEBP)')); };
      im.src = url;
    });
  }
  function subirFoto(file) {
    return reducirFoto(file).then(function (datos) {
      return api('admin-tienda', { method: 'POST', body: { recurso: 'foto', datos: datos } });
    }).then(function (r) { return r.url; });
  }
  function galeria(imgs) {
    var g = el('div', { class: 'ancho' }), ocupado = false;
    var rejilla = el('div', { class: 'fotos' });
    var entrada = el('input', { type: 'file', accept: 'image/*', multiple: true, id: 'f-file', hidden: true });
    var boton = el('button', { type: 'button', class: 'claro', text: '+ Agregar fotos', onclick: function () { entrada.click(); } });
    function pintar() {
      rejilla.textContent = '';
      imgs.forEach(function (u, i) {
        var t = el('div', { class: 'foto' }, [
          el('img', { src: u, alt: 'Foto ' + (i + 1), loading: 'lazy' }),
          i === 0 ? el('span', { class: 'prin', text: 'Principal' }) : el('button', { type: 'button', class: 'claro', text: 'Hacer principal', onclick: function () { imgs.unshift(imgs.splice(i, 1)[0]); pintar(); } }),
          el('button', { type: 'button', class: 'claro quitar', text: 'Quitar', onclick: function () { imgs.splice(i, 1); pintar(); } }),
        ]);
        rejilla.appendChild(t);
      });
      if (!imgs.length) rejilla.appendChild(el('p', { class: 'nota', text: 'Todavía no hay fotos. La primera que agregues será la principal.' }));
    }
    entrada.addEventListener('change', function () {
      var archivos = Array.prototype.slice.call(entrada.files || []);
      entrada.value = '';
      if (!archivos.length || ocupado) return;
      if (imgs.length + archivos.length > 30) return msg('Máximo 30 fotos por producto', true);
      ocupado = true; boton.disabled = true;
      var seguir = function (i) {
        if (i >= archivos.length) { ocupado = false; boton.disabled = false; return msg('Fotos listas ✓ Recuerda tocar "Guardar" abajo.'); }
        msg('Subiendo foto ' + (i + 1) + ' de ' + archivos.length + '…');
        return subirFoto(archivos[i]).then(function (u) { imgs.push(u); pintar(); return seguir(i + 1); });
      };
      seguir(0).catch(function (e) { ocupado = false; boton.disabled = false; falla(e); });
    });
    pintar();
    g.appendChild(el('p', { class: 'nota', text: 'Fotos del producto (la primera es la principal)' }));
    g.appendChild(boton); g.appendChild(entrada); g.appendChild(rejilla);
    return g;
  }
  var slug = function (t) { return String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50); };
  // Colores: se elige tocando el cuadrito y escribiendo solo el nombre
  function selectorColores(lista) {
    var cont = el('div', { class: 'ancho' }), filas = el('div', { id: 'f-cols', class: 'colores' });
    function fila(c) {
      var sel = el('input', { type: 'color', value: /^#[0-9a-fA-F]{6}$/.test(c.h) ? c.h.toLowerCase() : '#111111', 'aria-label': 'Elegir color' });
      var nom = el('input', { type: 'text', value: c.n || '', maxlength: '30', placeholder: 'Nombre (ej. Negro)', 'aria-label': 'Nombre del color' });
      var f = el('div', { class: 'color' }, [sel, nom, el('button', { type: 'button', class: 'claro', text: 'Quitar', onclick: function () { f.remove(); } })]);
      return f;
    }
    (lista || []).forEach(function (c) { filas.appendChild(fila(c)); });
    cont.appendChild(el('p', { class: 'nota', text: 'Colores disponibles (opcional). Toca el cuadrito para elegir el color y escribe su nombre.' }));
    cont.appendChild(filas);
    cont.appendChild(el('button', { type: 'button', class: 'claro', text: '+ Agregar color', onclick: function () { var f = fila({}); filas.appendChild(f); f.querySelector('input[type=text]').focus(); } }));
    return cont;
  }
  function leerColores() {
    var out = [], mal = false;
    document.querySelectorAll('#f-cols .color').forEach(function (f) {
      var n = f.querySelector('input[type=text]').value.trim(), h = f.querySelector('input[type=color]').value;
      if (!n) { mal = true; return; } out.push({ n: n, h: h });
    });
    return mal ? null : out;
  }
  function formProducto(p) {
    var nuevo = !p; p = p || { stock: {}, imagenes: [], colores: [], visible: true, orden: 0 };
    var IMGS = (p.imagenes || []).slice();
    var f = $('#form-prod'); f.textContent = '';
    var tallas = el('div', { class: 'tallas' }, TALLAS.map(function (t) { return el('label', {}, ['Talla ' + t, el('input', { type: 'number', min: '0', max: '9999', 'data-t': t, value: p.stock && p.stock[t] != null ? p.stock[t] : 0 })]); }));
    var cols = (CONT.colecciones || []).map(function (c) { return el('option', { value: c.id, text: c.nombre }); });
    var sel = el('select', { id: 'f-col' }, [el('option', { value: '', text: '— sin colección —' })].concat(cols));
    sel.value = p.coleccion || '';
    var form = el('form', { class: 'form' }, [
      campo('Nombre', el('input', { id: 'f-nombre', value: p.nombre || '', maxlength: '120', required: true })),
      campo('Precio (COP, entero)', el('input', { id: 'f-precio', type: 'number', min: '1', step: '1', value: p.precio || '', required: true })),
      campo('Colección', sel),
      campo('Orden en la tienda (menor primero)', el('input', { id: 'f-orden', type: 'number', step: '1', value: p.orden || 0 })),
      campo('Descripción', el('textarea', { id: 'f-desc', maxlength: '1500', text: p.descripcion || '' }), 'ancho'),
      galeria(IMGS),
      selectorColores(p.colores),
      el('div', { class: 'ancho' }, [el('p', { class: 'nota', text: 'Inventario por talla' }), tallas]),
      chk('Publicado (visible en la tienda)', 'f-vis', p.visible !== false), chk('Destacado en el inicio', 'f-dest', p.destacado),
      el('div', { class: 'ancho barra' }, [el('button', { type: 'submit', text: nuevo ? 'Crear producto' : 'Guardar cambios' }), el('button', { type: 'button', class: 'claro', text: 'Cancelar', onclick: function () { f.textContent = ''; } })]),
    ]);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var stock = {}; form.querySelectorAll('[data-t]').forEach(function (i) { stock[i.getAttribute('data-t')] = parseInt(i.value || '0', 10) || 0; });
      var colores = leerColores();
      if (!colores) return msg('Escribe el nombre de cada color o toca "Quitar"', true);
      var imgs = IMGS.slice();
      var id = p.id || slug($('#f-nombre').value);
      if (!id) return msg('Escribe el nombre del producto', true);
      if (nuevo && PRODS.some(function (x) { return x.id === id; })) id = id + '-' + Date.now().toString(36).slice(-4);
      var prod = { id: id, nombre: $('#f-nombre').value, precio: Number($('#f-precio').value), descripcion: $('#f-desc').value,
        imagenes: imgs, imagen: imgs[0] || '', colores: colores, stock: stock, coleccion: $('#f-col').value, orden: parseInt($('#f-orden').value || '0', 10) || 0,
        visible: $('#f-vis').checked, destacado: $('#f-dest').checked };
      msg('Guardando…');
      api('admin-tienda', { method: 'POST', body: { recurso: 'producto', producto: prod } })
        .then(function () { msg('Producto guardado en el servidor ✓'); return cargarProductos(); }).catch(falla);
    });
    f.appendChild(form); form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function cargarProductos() { return api('admin-tienda?recurso=productos').then(function (d) { PRODS = d.productos || []; pintarProductos(); }); }

    // Producto completo tal como lo pide el servidor, con los cambios indicados
  function prodDe(p, cambios) {
    var o = { id: p.id, nombre: p.nombre, precio: p.precio, descripcion: p.descripcion || '', imagenes: p.imagenes || [], imagen: p.imagen || '', colores: p.colores || [],
      stock: p.stock || {}, coleccion: p.coleccion || '', orden: p.orden || 0, visible: p.visible !== false, destacado: !!p.destacado };
    Object.keys(cambios || {}).forEach(function (k) { o[k] = cambios[k]; });
    return o;
  }
  var guardarProd = function (o) { return api('admin-tienda', { method: 'POST', body: { recurso: 'producto', producto: o } }); };

  // ---------- Colecciones: agrupar productos ----------
  function guardarColecciones(lista) {
    return api('admin-tienda', { method: 'POST', body: { recurso: 'contenido', contenido: { textos: CONT.textos || {}, secciones: CONT.secciones || {}, colecciones: lista, hero_foto: CONT.hero_foto || '' } } })
      .then(function (r) { CONT = r.contenido; });
  }
  function cargarColecciones() {
    return Promise.all([api('admin-tienda?recurso=contenido'), api('admin-tienda?recurso=productos')]).then(function (rs) {
      CONT = rs[0].contenido || {}; PRODS = rs[1].productos || [];
      var cols = CONT.colecciones || [];
      var c = $('#p-colecciones'); c.textContent = '';
      c.appendChild(el('p', { class: 'nota', text: 'Una colección agrupa varios productos (por ejemplo "Tacones" o "Sandalias"). En la tienda aparece un botón por cada colección visible para filtrar.' }));
      var nombre = el('input', { id: 'f-ncol', placeholder: 'Nombre de la colección (ej. Tacones)', maxlength: '40', 'aria-label': 'Nombre de la nueva colección' });
      var mensajeN = el('input', { id: 'f-mcol', placeholder: 'Mensaje corto (ej. Elegancia en altura)', maxlength: '120', 'aria-label': 'Mensaje de la nueva colección' });
      var fotoN = el('input', { id: 'f-pcol', type: 'file', accept: 'image/*', 'aria-label': 'Imagen de portada de la nueva colección' });
      var crear = el('button', { type: 'button', text: '+ Crear colección', onclick: function () {
        var n = nombre.value.trim(); if (!n) return msg('Escribe el nombre de la colección', true);
        var id = slug(n) || 'coleccion', base = id, i = 2;
        while (cols.some(function (k) { return k.id === id; })) id = base + '-' + (i++);
        var m = mensajeN.value.trim(), f = fotoN.files && fotoN.files[0];
        msg(f ? 'Subiendo portada…' : 'Guardando…');
        (f ? subirFoto(f) : Promise.resolve('')).then(function (u) {
          var nueva = { id: id, nombre: n, visible: true };
          if (m) nueva.mensaje = m;
          if (u) nueva.portada = u;
          return guardarColecciones(cols.concat([nueva]));
        }).then(function () { msg('Colección "' + n + '" creada ✓ Ahora toca "Elegir productos".'); return cargarColecciones(); }).catch(falla);
      } });
      c.appendChild(el('div', { class: 'form' }, [el('label', {}, ['Nueva colección', nombre]), el('label', {}, ['Mensaje (opcional)', mensajeN]), el('label', {}, ['Imagen de portada (opcional)', fotoN]), crear]));
      c.appendChild(el('div', { id: 'edit-col' }));
      if (!cols.length) c.appendChild(el('p', { class: 'nota', text: 'Todavía no tienes colecciones.' }));
      cols.forEach(function (k, idx) {
        var mios = PRODS.filter(function (p) { return p.coleccion === k.id; });
        c.appendChild(el('article', { class: 'icard' }, [
          el('h3', { text: k.nombre }),
          k.portada ? el('img', { class: 'portada', src: k.portada, alt: 'Portada de ' + k.nombre }) : el('p', { class: 'nota', text: 'Sin portada propia: en la tienda se usa la foto de su primer producto.' }),
          (function () {
            var im = el('input', { type: 'text', maxlength: '120', value: k.mensaje || '', placeholder: 'Mensaje que se ve en la tienda', 'data-mensaje': k.id, 'aria-label': 'Mensaje de ' + k.nombre });
            return el('div', { class: 'form' }, [el('label', {}, ['Mensaje de la colección', im]), el('button', { type: 'button', class: 'claro', text: 'Guardar mensaje', onclick: function () {
              var v = im.value.trim();
              var l = cols.map(function (x) { if (x.id !== k.id) return x; var y = Object.assign({}, x); if (v) y.mensaje = v; else delete y.mensaje; return y; });
              msg('Guardando…'); guardarColecciones(l).then(function () { msg('Mensaje de "' + k.nombre + '" guardado ✓'); return cargarColecciones(); }).catch(falla); } })]);
          })(),
          el('p', { class: 'nota', text: mios.length + (mios.length === 1 ? ' producto' : ' productos') + ' · ' + (k.visible === false ? 'Oculta en la tienda' : 'Visible en la tienda') }),
          el('div', { class: 'acc2' }, [
            el('button', { type: 'button', text: 'Elegir productos', onclick: function () { elegirProductos(k); } }),
            el('button', { type: 'button', class: 'claro', text: k.portada ? 'Cambiar portada' : 'Subir portada', onclick: function () {
              var e = el('input', { type: 'file', accept: 'image/*', class: 'oculto', 'data-portada': k.id });
              e.onchange = function () {
                var f = e.files && e.files[0]; if (!f) return;
                msg('Subiendo portada…');
                subirFoto(f).then(function (u) {
                  var l = cols.map(function (x) { return x.id === k.id ? Object.assign({}, x, { portada: u }) : x; });
                  return guardarColecciones(l);
                }).then(function () { msg('Portada de "' + k.nombre + '" guardada ✓'); return cargarColecciones(); }).catch(falla);
              };
              document.body.appendChild(e); e.click();
            } }),
            k.portada ? el('button', { type: 'button', class: 'claro', text: 'Quitar portada', onclick: function () {
              var l = cols.map(function (x) { if (x.id !== k.id) return x; var y = Object.assign({}, x); delete y.portada; return y; });
              msg('Guardando…'); guardarColecciones(l).then(function () { msg('Portada quitada ✓'); return cargarColecciones(); }).catch(falla); } }) : null,
            el('button', { type: 'button', class: 'claro', text: k.visible === false ? 'Mostrar' : 'Ocultar', onclick: function () {
              var l = cols.map(function (x) { return x.id === k.id ? Object.assign({}, x, { visible: x.visible === false }) : x; });
              msg('Guardando…'); guardarColecciones(l).then(function () { msg('Listo ✓'); return cargarColecciones(); }).catch(falla); } }),
            el('button', { type: 'button', class: 'claro', text: 'Renombrar', onclick: function () {
              var n = (window.prompt('Nuevo nombre de la colección', k.nombre) || '').trim(); if (!n) return;
              var l = cols.map(function (x) { return x.id === k.id ? Object.assign({}, x, { nombre: n }) : x; });
              msg('Guardando…'); guardarColecciones(l).then(function () { msg('Nombre cambiado ✓'); return cargarColecciones(); }).catch(falla); } }),
            el('button', { type: 'button', class: 'claro', text: 'Eliminar', onclick: function () {
              if (!window.confirm('¿Eliminar la colección "' + k.nombre + '"? Los productos NO se borran, solo quedan sin colección.')) return;
              msg('Guardando…');
              mios.reduce(function (pr, p) { return pr.then(function () { return guardarProd(prodDe(p, { coleccion: '' })); }); }, Promise.resolve())
                .then(function () { return guardarColecciones(cols.filter(function (x) { return x.id !== k.id; })); })
                .then(function () { msg('Colección eliminada ✓'); return cargarColecciones(); }).catch(falla); } }),
          ]),
        ]));
      });
    });
  }
  function elegirProductos(k) {
    var f = $('#edit-col'); f.textContent = '';
    var nombres = {}; (CONT.colecciones || []).forEach(function (x) { nombres[x.id] = x.nombre; });
    var filas = PRODS.map(function (p) {
      var i = el('input', { type: 'checkbox', 'data-id': p.id }); i.checked = p.coleccion === k.id;
      var otra = p.coleccion && p.coleccion !== k.id ? ' (ahora en ' + (nombres[p.coleccion] || p.coleccion) + ')' : '';
      var foto = (p.imagenes && p.imagenes[0]) || p.imagen || '';
      var mini = foto ? el('img', { class: 'mini', src: foto, alt: '', loading: 'lazy' }) : el('span', { class: 'mini vacia', text: 'Sin foto' });
      return el('label', { class: 'ck sel' }, [i, mini, el('span', { class: 'nm' }, [p.nombre + otra])]);
    });
    var form = el('form', { class: 'form' }, [el('h3', { text: 'Productos de "' + k.nombre + '"' }), el('p', { class: 'nota', text: 'Marca los productos que van en esta colección. Si marcas uno que está en otra, se pasa a esta.' })].concat(filas, [
      el('div', { class: 'barra' }, [el('button', { type: 'submit', text: 'Guardar colección' }), el('button', { type: 'button', class: 'claro', text: 'Cancelar', onclick: function () { f.textContent = ''; } })]),
    ]));
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var cambios = PRODS.filter(function (p) {
        var marcado = form.querySelector('[data-id="' + p.id.replace(/"/g, '') + '"]').checked;
        return marcado ? p.coleccion !== k.id : p.coleccion === k.id;
      }).map(function (p) { return guardarProd(prodDe(p, { coleccion: form.querySelector('[data-id="' + p.id.replace(/"/g, '') + '"]').checked ? k.id : '' })); });
      if (!cambios.length) return msg('No cambiaste nada');
      msg('Guardando…');
      Promise.all(cambios).then(function () { msg('Colección "' + k.nombre + '" guardada ✓'); return cargarColecciones(); }).catch(falla);
    });
    f.appendChild(form); form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ---------- Inventario: pares por talla, con un solo toque para guardar ----------
  function cargarInventario() {
    return api('admin-tienda?recurso=productos').then(function (d) {
      PRODS = d.productos || [];
      var c = $('#p-inventario'); c.textContent = '';
      c.appendChild(el('p', { class: 'nota', text: 'Escribe cuántos pares hay de cada talla y toca "Guardar". La tienda se actualiza al instante. Los pedidos pagados descuentan solos.' }));
      if (!PRODS.length) c.appendChild(el('p', { class: 'nota', text: 'Todavía no hay productos.' }));
      PRODS.forEach(function (p) {
        var tallas = TALLAS.slice(); Object.keys(p.stock || {}).forEach(function (t) { if (tallas.indexOf(t) < 0) tallas.push(t); });
        var campos = tallas.map(function (t) { return el('label', {}, ['Talla ' + t, el('input', { type: 'number', inputmode: 'numeric', min: '0', max: '9999', 'data-t': t, value: p.stock && p.stock[t] != null ? p.stock[t] : 0 })]); });
        var tarjeta = el('article', { class: 'icard' + (totalU(p) ? '' : ' agot') }, [el('h3', { text: p.nombre }), el('div', { class: 'tallas' }, campos)]);
        tarjeta.appendChild(el('button', { type: 'button', text: 'Guardar inventario', onclick: function () {
          var stock = {}; tarjeta.querySelectorAll('[data-t]').forEach(function (i) { stock[i.getAttribute('data-t')] = parseInt(i.value || '0', 10) || 0; });
          var prod = prodDe(p, { stock: stock });
          msg('Guardando…');
          api('admin-tienda', { method: 'POST', body: { recurso: 'producto', producto: prod } })
            .then(function () { msg('Inventario de "' + p.nombre + '" guardado ✓'); return cargarInventario(); }).catch(falla);
        } }));
        c.appendChild(tarjeta);
      });
    });
  }

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
      var heroBox = el('div', { class: 'ancho' });
      function pintarHero() {
        heroBox.textContent = '';
        heroBox.appendChild(el('h3', { text: 'Foto de la portada principal' }));
        heroBox.appendChild(CONT.hero_foto ? el('img', { class: 'portada', src: CONT.hero_foto, alt: 'Foto de la portada principal' }) : el('p', { class: 'nota', text: 'Sin foto propia: la tienda usa la foto de uno de tus productos destacados.' }));
        var guardarHero = function (v) {
          var o = { textos: CONT.textos || {}, secciones: CONT.secciones || {}, colecciones: CONT.colecciones || [], hero_foto: v };
          return api('admin-tienda', { method: 'POST', body: { recurso: 'contenido', contenido: o } }).then(function (r) { CONT = r.contenido; pintarHero(); });
        };
        heroBox.appendChild(el('div', { class: 'acc2' }, [
          el('button', { type: 'button', text: CONT.hero_foto ? 'Cambiar foto' : 'Subir foto', onclick: function () {
            var e = el('input', { type: 'file', accept: 'image/*', class: 'oculto', 'data-hero': '1' });
            e.onchange = function () {
              var f = e.files && e.files[0]; if (!f) return;
              msg('Subiendo foto…');
              subirFoto(f).then(guardarHero).then(function () { msg('Foto de portada guardada ✓'); }).catch(falla);
            };
            document.body.appendChild(e); e.click();
          } }),
          CONT.hero_foto ? el('button', { type: 'button', class: 'claro', text: 'Quitar foto', onclick: function () { msg('Guardando…'); guardarHero('').then(function () { msg('Foto quitada ✓'); }).catch(falla); } }) : null,
        ]));
      }
      pintarHero();
      var form = el('form', { class: 'form' }, [heroBox].concat(campos, secs, [
        el('p', { class: 'nota ancho', text: 'Los botones siguen haciendo su función (abrir la colección, comprar, agregar al carrito); aquí solo cambia lo comercial: textos y qué secciones se ven. Las colecciones se crean en el botón "Colecciones" del inicio.' }),
        el('div', { class: 'ancho' }, [el('button', { type: 'submit', text: 'Guardar contenido' })]),
      ]));
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var textos = {}; form.querySelectorAll('[data-x]').forEach(function (i) { if (i.value.trim()) textos[i.getAttribute('data-x')] = i.value.trim(); });
        var secciones = { band: $('#s-band').checked, comunidad: $('#s-comunidad').checked, valores: $('#s-valores').checked };
        var colecciones = CONT.colecciones || [];
        msg('Guardando…');
        api('admin-tienda', { method: 'POST', body: { recurso: 'contenido', contenido: { textos: textos, secciones: secciones, colecciones: colecciones, hero_foto: CONT.hero_foto || '' } } })
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
  var cargarInicio = function () { return window.mfAdminInicio ? window.mfAdminInicio.abrir() : Promise.reject(new Error('El diseñador de inicio no cargó: revisa que admin-banners.js esté subido')); };
  var cargarDescuentos = function () { return window.mfAdminDescuentos ? window.mfAdminDescuentos.abrir() : Promise.reject(new Error('Descuentos no cargó: revisa que admin-descuentos.js esté subido')); };
  window.mfAdmin = { api: api, el: el, msg: msg, falla: falla, subirFoto: subirFoto };
  var cargarComunidad = function () { return window.mfAdminComunidad ? window.mfAdminComunidad.abrir() : Promise.reject(new Error('Comunidad no cargó: revisa que admin-comunidad.js esté subido')); };
  var CARGA = { comunidad: cargarComunidad, descuentos: cargarDescuentos, inicio: cargarInicio, productos: cargarProductos, colecciones: cargarColecciones, inventario: cargarInventario, envio: cargarEnvio, contenido: cargarContenido, pedidos: cargarPedidos, registro: cargarRegistro };
  var TITULOS = { comunidad: 'Comunidad', descuentos: 'Descuentos', inicio: 'Diseñador de inicio', productos: 'Productos', colecciones: 'Colecciones', inventario: 'Inventario', envio: 'Envío', contenido: 'Contenido', pedidos: 'Pedidos', registro: 'Registro' };
  function inicio() {
    $('#tabs').hidden = false; $('#volver').hidden = true;
    document.querySelectorAll('.panel').forEach(function (p) { p.classList.remove('on'); });
    msg(''); window.scrollTo(0, 0);
  }
  function abrir(t) {
    $('#tabs').hidden = true; $('#volver').hidden = false; $('#titulo').textContent = TITULOS[t] || '';
    document.querySelectorAll('.panel').forEach(function (p) { p.classList.toggle('on', p.id === 'p-' + t); });
    msg(''); window.scrollTo(0, 0); CARGA[t]().catch(falla);
  }
  function entrar() {
    token = $('#token').value.trim() || token;
    if (!token) return msg('Escribe la clave del panel', true);
    msg('Verificando…');
    api('admin-tienda?recurso=contenido').then(function (d) {
      CONT = d.contenido || {};
      try { sessionStorage.setItem('mf_admin_token', token); } catch (e) {}
      $('#app').hidden = false; $('#salir').hidden = false; $('#entrar').hidden = true; $('#token').hidden = true; $('#token').value = '';
      inicio();
    }).catch(falla);
  }
  function salir() {
    token = ''; try { sessionStorage.removeItem('mf_admin_token'); } catch (e) {}
    $('#app').hidden = true; $('#salir').hidden = true; $('#entrar').hidden = false; $('#token').hidden = false;
  }
  $('#entrar').addEventListener('click', entrar);
  $('#token').addEventListener('keydown', function (e) { if (e.key === 'Enter') entrar(); });
  $('#salir').addEventListener('click', function () { salir(); msg('Sesión cerrada'); });
  $('#inicio').addEventListener('click', inicio);
  $('#tabs').addEventListener('click', function (e) { var b = e.target.closest('button[data-t]'); if (b) abrir(b.getAttribute('data-t')); });
  if (token) entrar();
})();
