/* Diseñador de inicio: varios banners con foto, textos que se arrastran y un botón.
   Usa las mismas funciones del panel (window.mfAdmin) y la misma vista de la tienda (window.mfBanners.card),
   así que lo que ves aquí es lo que sale en la tienda. Todo se valida de nuevo en el servidor al guardar. */
(function () {
  'use strict';
  var A = window.mfAdmin, M = window.mfBanners;
  var MAX_B = 6, MAX_C = 6;
  var B = [], sel = 0, cs = null /* null | número de texto | 'btn' */, vista = 'cel', sucio = false, PRODS = [], COLS = [];
  var root, stageBox, ctrlBox, listaBox, barra, fit, sc, avisoG;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var el = function () { return A.el.apply(null, arguments); };
  var clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };
  var r1 = function (v) { return Math.round(v * 10) / 10; };
  var nuevoId = function () { return 'b' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5); };
  var COLORES = ['#ffffff', '#0a0a0a', '#f6f2ec', '#b08d57'];

  function fuentes() {
    if (document.getElementById('ib-fonts')) return;
    var l = document.createElement('link'); l.id = 'ib-fonts'; l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,700;1,500&family=Jost:wght@400;500&display=swap';
    document.head.appendChild(l);
  }

  function nuevoBanner() {
    return { id: nuevoId(), foto: '', fx: 50, fy: 50, oscuro: 25, fondo: '#111111', visible: true,
      capas: [{ t: 'Tu título aquí', x: 50, y: 40, tam: 9, ancho: 86, color: '#ffffff', fuente: 'serif', cursiva: true, mayus: false, grueso: false, alinea: 'center' }],
      boton: { texto: 'Ver colección', destino: { tipo: 'go' }, x: 50, y: 78, estilo: 'claro' } };
  }
  var copia = function (o) { return JSON.parse(JSON.stringify(o)); };
  var cur = function () { return B[sel]; };
  var marcar = function () { sucio = true; if (avisoG) avisoG.textContent = 'Tienes cambios sin guardar'; };

  // ---------- Vista previa ----------
  // Para la vista previa se completa lo que falta (texto vacío, destino incompleto) sin tocar los datos reales.
  function paraVer(b) {
    var v = copia(b);
    v.capas = (v.capas || []).map(function (k) { if (!k.t) k.t = 'Texto'; return k; });
    if (v.boton) { if (!v.boton.texto) v.boton.texto = 'Botón'; v.boton.destino = { tipo: 'go' }; }
    return v;
  }
  function ajustarEscala() {
    if (!fit || !sc) return;
    var W = vista === 'pc' ? 1000 : 390, ancho = Math.min(fit.parentNode.clientWidth || W, W), k = ancho / W;
    fit.style.width = ancho + 'px'; sc.style.width = W + 'px'; sc.style.transform = 'scale(' + k + ')';
    fit.style.height = Math.round(sc.offsetHeight * k) + 'px';
  }
  function pintarStage() {
    var b = cur(); if (!b) { stageBox.textContent = ''; return; }
    stageBox.textContent = '';
    fit = el('div', { class: 'ib-fit' }); sc = el('div', { class: 'ib-sc ib-stage' });
    sc.innerHTML = M.card(paraVer(b), {});
    fit.appendChild(sc); stageBox.appendChild(fit);
    var bn = $('.mfb', sc);
    bn.appendChild(el('div', { class: 'ib-g v' })); bn.appendChild(el('div', { class: 'ib-g h' }));
    sc.querySelectorAll('.bn-l').forEach(function (p) { p.dataset.i = p.getAttribute('data-capa'); });
    var bt = $('.bn-b', sc); if (bt) { bt.dataset.btn = '1'; bt.removeAttribute('href'); bt.removeAttribute('target'); }
    marcarSel();
    ajustarEscala();
    sc.addEventListener('click', function (e) { e.preventDefault(); });
    sc.addEventListener('pointerdown', empezar);
  }
  function marcarSel() {
    if (!sc) return;
    sc.querySelectorAll('.sel').forEach(function (n) { n.classList.remove('sel'); });
    sc.querySelectorAll('.ib-h').forEach(function (n) { n.remove(); });
    var n = cs === 'btn' ? $('.bn-b', sc) : (cs != null ? sc.querySelector('.bn-l[data-i="' + cs + '"]') : null);
    if (n) {
      n.classList.add('sel');
      if (cs !== 'btn') n.appendChild(el('span', { class: 'ib-h', 'data-h': '1', title: 'Arrastra para cambiar el tamaño' }));
    }
  }

  // ---------- Arrastrar ----------
  var arr = null;
  function empezar(e) {
    if (e.button != null && e.button > 0) return;
    var bn = $('.mfb', sc), rect = bn.getBoundingClientRect();
    var h = e.target.closest('.ib-h'), n = e.target.closest('.bn-l,.bn-b');
    if (h) {
      var p = h.parentNode, k = cur().capas[+p.dataset.i];
      arr = { modo: 'tam', k: k, x0: e.clientX, tam0: k.tam, rect: rect };
    } else if (n) {
      var esBtn = n.classList.contains('bn-b'), o = esBtn ? cur().boton : cur().capas[+n.dataset.i];
      cs = esBtn ? 'btn' : +n.dataset.i; marcarSel(); pintarControles();
      var cx = rect.left + (o.x / 100) * rect.width, cy = rect.top + (o.y / 100) * rect.height;
      arr = { modo: 'mover', o: o, n: n, dx: e.clientX - cx, dy: e.clientY - cy, rect: rect, movido: false };
    } else {
      if (cs !== null) { cs = null; marcarSel(); pintarControles(); }
      if (!cur().foto) return;
      arr = { modo: 'foto', x0: e.clientX, y0: e.clientY, fx0: cur().fx, fy0: cur().fy, rect: rect, img: $('.bn-ph img', sc) };
    }
    e.preventDefault();
    try { sc.setPointerCapture(e.pointerId); } catch (x) { /* sin captura */ }
    sc.addEventListener('pointermove', mover); sc.addEventListener('pointerup', soltar); sc.addEventListener('pointercancel', soltar);
  }
  function guias(x, y) {
    var gv = $('.ib-g.v', sc), gh = $('.ib-g.h', sc);
    if (gv) gv.classList.toggle('on', x); if (gh) gh.classList.toggle('on', y);
  }
  function mover(e) {
    if (!arr) return;
    var R = arr.rect;
    if (arr.modo === 'mover') {
      var x = ((e.clientX - arr.dx - R.left) / R.width) * 100, y = ((e.clientY - arr.dy - R.top) / R.height) * 100;
      var sx = Math.abs(x - 50) < 1.6, sy = Math.abs(y - 50) < 1.6;
      if (sx) x = 50; if (sy) y = 50;
      arr.o.x = r1(clamp(x, 0, 100)); arr.o.y = r1(clamp(y, 0, 100));
      arr.n.style.setProperty('--x', arr.o.x + '%'); arr.n.style.setProperty('--y', arr.o.y + '%');
      guias(sx, sy); arr.movido = true; marcar();
    } else if (arr.modo === 'tam') {
      var f = vista === 'pc' ? 0.55 : 1;
      arr.k.tam = r1(clamp(arr.tam0 + (((e.clientX - arr.x0) / arr.rect.width) * 100) / f * 1.4, 2, 16));
      var p = $('.bn-l[data-i="' + cs + '"]', sc); if (p) p.style.setProperty('--s', arr.k.tam);
      marcar();
    } else if (arr.modo === 'foto') {
      var b = cur();
      b.fx = r1(clamp(arr.fx0 - ((e.clientX - arr.x0) / R.width) * 100, 0, 100));
      b.fy = r1(clamp(arr.fy0 - ((e.clientY - arr.y0) / R.height) * 100, 0, 100));
      if (arr.img) arr.img.style.objectPosition = b.fx + '% ' + b.fy + '%';
      marcar();
    }
  }
  function soltar() {
    if (!arr) return;
    var m = arr.modo; arr = null; guias(false, false);
    sc.removeEventListener('pointermove', mover); sc.removeEventListener('pointerup', soltar); sc.removeEventListener('pointercancel', soltar);
    if (m === 'tam') pintarControles();
  }

  // ---------- Lista de banners ----------
  function pintarLista() {
    listaBox.textContent = '';
    B.forEach(function (b, i) {
      listaBox.appendChild(el('button', { type: 'button', class: 'ib-t' + (i === sel ? ' on' : '') + (b.visible === false ? ' off' : ''), text: 'Banner ' + (i + 1), onclick: function () { sel = i; cs = null; pintarTodo(); } }));
    });
    if (B.length < MAX_B) listaBox.appendChild(el('button', { type: 'button', class: 'claro', text: '+ Nuevo banner', onclick: function () { B.push(nuevoBanner()); sel = B.length - 1; cs = null; marcar(); pintarTodo(); } }));
  }
  function pintarBarra() {
    barra.textContent = '';
    if (!B.length) return;
    var b = cur();
    barra.appendChild(el('div', { class: 'ib-vista' }, [
      el('button', { type: 'button', class: vista === 'cel' ? 'on' : '', text: 'Celular', onclick: function () { vista = 'cel'; pintarBarra(); pintarStage(); } }),
      el('button', { type: 'button', class: vista === 'pc' ? 'on' : '', text: 'Computador', onclick: function () { vista = 'pc'; pintarBarra(); pintarStage(); } }),
    ]));
    barra.appendChild(el('button', { type: 'button', class: 'claro', text: '← Subir', disabled: sel === 0, onclick: function () { mueve(-1); } }));
    barra.appendChild(el('button', { type: 'button', class: 'claro', text: 'Bajar →', disabled: sel === B.length - 1, onclick: function () { mueve(1); } }));
    barra.appendChild(el('button', { type: 'button', class: 'claro', text: b.visible === false ? 'Mostrar en la tienda' : 'Ocultar de la tienda', onclick: function () { b.visible = b.visible === false; marcar(); pintarTodo(); } }));
    barra.appendChild(el('button', { type: 'button', class: 'claro', text: 'Duplicar', disabled: B.length >= MAX_B, onclick: function () { var c = copia(b); c.id = nuevoId(); B.splice(sel + 1, 0, c); sel++; cs = null; marcar(); pintarTodo(); } }));
    barra.appendChild(el('button', { type: 'button', class: 'claro', text: 'Eliminar banner', onclick: function () {
      if (!confirm('¿Eliminar este banner? Se borra cuando guardes.')) return;
      B.splice(sel, 1); sel = clamp(sel, 0, Math.max(0, B.length - 1)); cs = null; marcar(); pintarTodo();
    } }));
  }
  function mueve(d) { var j = sel + d; if (j < 0 || j >= B.length) return; var t = B[sel]; B[sel] = B[j]; B[j] = t; sel = j; marcar(); pintarTodo(); }

  // ---------- Controles ----------
  function slider(etq, min, max, step, val, fn) {
    var v = el('output', { text: String(val) });
    var i = el('input', { type: 'range', min: String(min), max: String(max), step: String(step), value: String(val) });
    i.addEventListener('input', function () { var n = Number(i.value); v.textContent = String(n); fn(n); marcar(); });
    return el('label', {}, [el('span', {}, [etq + ': ', v]), i]);
  }
  function colorCtl(val, fn) {
    var i = el('input', { type: 'color', value: val || '#ffffff', 'aria-label': 'Color' });
    i.addEventListener('input', function () { fn(i.value); marcar(); });
    var fila = el('div', { class: 'ib-fila' }, [i].concat(COLORES.map(function (c) {
      return el('button', { type: 'button', class: 'ib-sw', style: 'background:' + c, 'aria-label': 'Color ' + c, onclick: function () { i.value = c; fn(c); marcar(); } });
    })));
    return fila;
  }
  function tog(etq, on, fn) { return el('button', { type: 'button', class: 'claro' + (on ? ' on' : ''), text: etq, 'aria-pressed': on ? 'true' : 'false', onclick: function () { fn(!on); marcar(); pintarStage(); pintarControles(); } }); }

  function ctlBanner() {
    var b = cur(), c = [el('h3', { text: 'Fondo del banner' })];
    var arch = el('input', { type: 'file', accept: 'image/*', hidden: true });
    arch.addEventListener('change', function () {
      var f = arch.files && arch.files[0]; if (!f) return;
      A.msg('Subiendo foto…');
      A.subirFoto(f).then(function (u) { b.foto = u; b.fx = 50; b.fy = 50; marcar(); A.msg('Foto subida ✓ Recuerda tocar Guardar al terminar'); pintarTodo(); }).catch(A.falla);
    });
    c.push(el('div', { class: 'ancho ib-fila' }, [
      el('button', { type: 'button', text: b.foto ? 'Cambiar foto' : 'Subir foto', onclick: function () { arch.click(); } }), arch,
      b.foto ? el('button', { type: 'button', class: 'claro', text: 'Quitar foto', onclick: function () { b.foto = ''; marcar(); pintarTodo(); } }) : null,
    ]));
    c.push(el('p', { class: 'ib-ayuda ancho', text: b.foto ? 'Arrastra la foto para elegir qué parte se ve. Toca un texto o el botón para moverlo.' : 'Sin foto se usa un color de fondo.' }));
    if (b.foto) {
      c.push(slider('Foto: izquierda ↔ derecha', 0, 100, 1, b.fx, function (n) { b.fx = n; var i = $('.bn-ph img', sc); if (i) i.style.objectPosition = b.fx + '% ' + b.fy + '%'; }));
      c.push(slider('Foto: arriba ↕ abajo', 0, 100, 1, b.fy, function (n) { b.fy = n; var i = $('.bn-ph img', sc); if (i) i.style.objectPosition = b.fx + '% ' + b.fy + '%'; }));
    }
    c.push(slider('Oscurecer la foto', 0, 70, 1, b.oscuro, function (n) { b.oscuro = n; var o = $('.mfb', sc); if (o) o.style.setProperty('--ov', n / 100); }));
    if (!b.foto) c.push(el('label', {}, ['Color de fondo', colorCtl(b.fondo, function (v) { b.fondo = v; var o = $('.mfb', sc); if (o) o.style.setProperty('--bg', v); })]));
    c.push(el('div', { class: 'ancho ib-fila' }, [
      el('button', { type: 'button', text: '+ Agregar texto', disabled: b.capas.length >= MAX_C, onclick: function () {
        b.capas.push({ t: 'Nuevo texto', x: 50, y: 55, tam: 6, ancho: 80, color: '#ffffff', fuente: 'sans', cursiva: false, mayus: false, grueso: false, alinea: 'center' });
        cs = b.capas.length - 1; marcar(); pintarStage(); pintarControles();
      } }),
      !b.boton ? el('button', { type: 'button', class: 'claro', text: '+ Agregar botón', onclick: function () { b.boton = { texto: 'Ver colección', destino: { tipo: 'go' }, x: 50, y: 80, estilo: 'claro' }; cs = 'btn'; marcar(); pintarStage(); pintarControles(); } }) : null,
    ]));
    return c;
  }
  function ctlTexto(k, i) {
    var b = cur(), c = [el('h3', { text: 'Texto seleccionado' })];
    var t = el('textarea', { rows: '3', maxlength: '140', 'aria-label': 'Texto' }); t.value = k.t;
    t.addEventListener('input', function () { k.t = t.value; marcar(); var p = $('.bn-l[data-i="' + i + '"]', sc); if (p) { var h = p.querySelector('.ib-h'); p.textContent = k.t || 'Texto'; if (h) p.appendChild(h); } });
    c.push(el('label', { class: 'ancho' }, ['Escribe aquí (Enter = nueva línea)', t]));
    c.push(slider('Tamaño', 2, 16, 0.5, k.tam, function (n) { k.tam = n; var p = $('.bn-l[data-i="' + i + '"]', sc); if (p) p.style.setProperty('--s', n); }));
    c.push(slider('Ancho de la caja', 20, 100, 1, k.ancho, function (n) { k.ancho = n; var p = $('.bn-l[data-i="' + i + '"]', sc); if (p) p.style.setProperty('--w', n + '%'); }));
    c.push(el('label', {}, ['Color', colorCtl(k.color, function (v) { k.color = v; var p = $('.bn-l[data-i="' + i + '"]', sc); if (p) p.style.setProperty('--c', v); })]));
    c.push(el('div', { class: 'ib-fila' }, [
      tog('Elegante', k.fuente !== 'sans', function (on) { k.fuente = on ? 'serif' : 'sans'; }),
      tog('Moderna', k.fuente === 'sans', function (on) { k.fuente = on ? 'sans' : 'serif'; }),
      tog('Cursiva', !!k.cursiva, function (on) { k.cursiva = on; }),
      tog('MAYÚSCULAS', !!k.mayus, function (on) { k.mayus = on; }),
      tog('Negrita', !!k.grueso, function (on) { k.grueso = on; }),
    ]));
    c.push(el('div', { class: 'ib-fila' }, [
      tog('Izquierda', k.alinea === 'left', function (on) { k.alinea = on ? 'left' : 'center'; }),
      tog('Centro', k.alinea !== 'left' && k.alinea !== 'right', function () { k.alinea = 'center'; }),
      tog('Derecha', k.alinea === 'right', function (on) { k.alinea = on ? 'right' : 'center'; }),
      el('button', { type: 'button', class: 'claro', text: 'Centrar', onclick: function () { k.x = 50; marcar(); pintarStage(); } }),
      el('button', { type: 'button', class: 'claro', text: 'Eliminar texto', onclick: function () { b.capas.splice(i, 1); cs = null; marcar(); pintarStage(); pintarControles(); } }),
    ]));
    return c;
  }
  function ctlBoton(t) {
    var b = cur(), c = [el('h3', { text: 'Botón seleccionado' })];
    var tx = el('input', { type: 'text', maxlength: '40', value: t.texto, 'aria-label': 'Texto del botón' });
    tx.addEventListener('input', function () { t.texto = tx.value; marcar(); var n = $('.bn-b', sc); if (n) n.textContent = t.texto || 'Botón'; });
    c.push(el('label', {}, ['Texto del botón', tx]));
    var d = t.destino || { tipo: 'go' };
    var tipo = el('select', { 'aria-label': 'A dónde lleva' }, [
      el('option', { value: 'go', text: 'Baja a las colecciones' }), el('option', { value: 'col', text: 'Abre una colección' }),
      el('option', { value: 'prod', text: 'Abre un producto' }), el('option', { value: 'url', text: 'Abre un enlace (https://…)' }),
    ]);
    tipo.value = d.tipo;
    var det = el('div', { class: 'ancho' });
    function pintarDestino() {
      det.textContent = '';
      var dd = t.destino;
      if (dd.tipo === 'col') {
        var s = el('select', { 'aria-label': 'Colección' }, [el('option', { value: '', text: 'Todos los modelos' })].concat(COLS.map(function (k) { return el('option', { value: k.id, text: k.nombre }); })));
        s.value = dd.id || ''; s.addEventListener('change', function () { dd.id = s.value; marcar(); });
        det.appendChild(el('label', {}, ['Colección', s]));
      } else if (dd.tipo === 'prod') {
        var p = el('select', { 'aria-label': 'Producto' }, [el('option', { value: '', text: 'Elige un producto…' })].concat(PRODS.map(function (k) { return el('option', { value: k.id, text: k.nombre }); })));
        p.value = dd.id || ''; p.addEventListener('change', function () { dd.id = p.value; marcar(); });
        det.appendChild(el('label', {}, ['Producto', p]));
      } else if (dd.tipo === 'url') {
        var u = el('input', { type: 'text', value: dd.url || '', placeholder: 'https://…', 'aria-label': 'Enlace' });
        u.addEventListener('input', function () { dd.url = u.value.trim(); marcar(); });
        det.appendChild(el('label', {}, ['Enlace', u]));
      }
    }
    tipo.addEventListener('change', function () { t.destino = { tipo: tipo.value }; if (tipo.value === 'col') t.destino.id = ''; marcar(); pintarDestino(); });
    pintarDestino();
    c.push(el('label', {}, ['A dónde lleva', tipo])); c.push(det);
    c.push(el('div', { class: 'ib-fila' }, [
      tog('Blanco', t.estilo === 'claro', function () { t.estilo = 'claro'; }),
      tog('Negro', t.estilo === 'oscuro', function () { t.estilo = 'oscuro'; }),
      tog('Solo borde', t.estilo === 'borde', function () { t.estilo = 'borde'; }),
      el('button', { type: 'button', class: 'claro', text: 'Centrar', onclick: function () { t.x = 50; marcar(); pintarStage(); } }),
      el('button', { type: 'button', class: 'claro', text: 'Eliminar botón', onclick: function () { b.boton = null; cs = null; marcar(); pintarStage(); pintarControles(); } }),
    ]));
    return c;
  }
  function pintarControles() {
    ctrlBox.textContent = '';
    var b = cur(); if (!b) return;
    var hijos;
    if (cs === 'btn' && b.boton) hijos = ctlBoton(b.boton);
    else if (cs != null && b.capas[cs]) hijos = ctlTexto(b.capas[cs], cs);
    else hijos = ctlBanner();
    ctrlBox.appendChild(el('div', { class: 'ib-panel' }, hijos));
    if (cs != null) ctrlBox.appendChild(el('p', { class: 'ib-ayuda' }, [el('button', { type: 'button', class: 'claro', text: '← Opciones del banner', onclick: function () { cs = null; marcarSel(); pintarControles(); } })]));
  }
  function pintarTodo() { pintarLista(); pintarBarra(); pintarStage(); pintarControles(); }

  // ---------- Guardar ----------
  function guardar() {
    A.msg('Guardando…');
    var enviar = copia(B);
    enviar.forEach(function (b) { if (b.boton && !b.boton.texto) b.boton = null; });
    return A.api('admin-tienda', { method: 'POST', body: { recurso: 'banners', banners: enviar } }).then(function (r) {
      B = copia(r.banners || []); sel = clamp(sel, 0, Math.max(0, B.length - 1)); cs = null; sucio = false;
      if (avisoG) avisoG.textContent = 'Todo guardado';
      A.msg('Banners guardados ✓ La tienda los muestra al recargar');
      pintarTodo();
    }).catch(A.falla);
  }

  function abrir() {
    fuentes();
    root = document.getElementById('p-inicio'); root.textContent = '';
    root.appendChild(el('p', { class: 'nota', text: 'Cada banner es una pantalla del inicio. Arrastra los textos y el botón con el dedo o el mouse; arrastra la foto para encuadrarla. Si no guardas ningún banner, la tienda muestra la portada de siempre.' }));
    listaBox = el('div', { class: 'ib-lista' }); barra = el('div', { class: 'ib-barra' }); stageBox = el('div', { class: 'ib-stagebox' }); ctrlBox = el('div', {});
    avisoG = el('span', { text: 'Todo guardado' });
    root.appendChild(listaBox); root.appendChild(barra); root.appendChild(stageBox);
    root.appendChild(el('p', { class: 'ib-ayuda', text: 'La línea dorada aparece cuando un elemento queda centrado. El círculo dorado de un texto cambia su tamaño.' }));
    root.appendChild(ctrlBox);
    root.appendChild(el('div', { class: 'ib-guardar' }, [avisoG, el('button', { type: 'button', text: 'Guardar cambios', onclick: guardar })]));
    return Promise.all([A.api('admin-tienda?recurso=banners'), A.api('admin-tienda?recurso=productos'), A.api('admin-tienda?recurso=contenido')]).then(function (r) {
      B = copia(r[0].banners || []); PRODS = r[1].productos || []; COLS = (r[2].contenido && r[2].contenido.colecciones) || [];
      sel = 0; cs = null; sucio = false;
      if (!B.length) {
        listaBox.appendChild(el('p', { class: 'nota', text: 'Todavía no tienes banners: la tienda usa la portada de siempre.' }));
        listaBox.appendChild(el('button', { type: 'button', text: 'Crear mi primer banner', onclick: function () { B.push(nuevoBanner()); sel = 0; marcar(); pintarTodo(); } }));
      } else pintarTodo();
    });
  }

  window.addEventListener('resize', function () { ajustarEscala(); });
  window.addEventListener('beforeunload', function (e) { if (sucio) { e.preventDefault(); e.returnValue = ''; } });
  window.mfAdminInicio = { abrir: abrir };
})();
