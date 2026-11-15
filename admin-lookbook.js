/* Panel · Lookbook: looks con foto y los productos que se ven en cada uno. Se publican en el inicio de la tienda. Se guarda en el servidor (recurso 'lookbook'). */
(function () {
  'use strict';
  var A = function () { return window.mfAdmin; };
  var MAX = 12, MAX_P = 8;
  var S = { looks: [], prods: [], abierto: -1 };
  var nombre = function (id) { var p = S.prods.filter(function (x) { return String(x.id) === String(id); })[0]; return p ? p.nombre : id; };

  function mover(i, d) { var j = i + d; if (j < 0 || j >= S.looks.length) return; var x = S.looks.splice(i, 1)[0]; S.looks.splice(j, 0, x); S.abierto = j; pintar(); }
  function nuevo(file) {
    if (S.looks.length >= MAX) return A().msg('Máximo ' + MAX + ' looks', true);
    A().msg('Subiendo foto…');
    A().subirFoto(file).then(function (url) {
      S.looks.push({ id: '', titulo: '', foto: url, productos: [], visible: true }); S.abierto = S.looks.length - 1; pintar(); A().msg('Foto subida. Completa el look y pulsa «Guardar lookbook»');
    }).catch(A().falla);
  }
  function tarjeta(l, i) {
    var el = A().el, abierta = S.abierto === i;
    var cab = el('div', { class: 'lo-it' }, [
      el('span', { class: 'lo-n', text: String(i + 1) }),
      el('img', { src: l.foto, alt: '', loading: 'lazy' }),
      el('div', { class: 'lo-tx' }, [el('b', { text: l.titulo || 'Look sin título' }), el('small', { text: (l.productos.length ? l.productos.length + ' producto' + (l.productos.length === 1 ? '' : 's') : 'Sin productos') + (l.visible === false ? ' · Oculto' : ' · Publicado') })]),
      el('div', { class: 'lo-ac' }, [
        el('button', { type: 'button', class: 'claro', 'aria-label': 'Subir look', text: '↑', disabled: i === 0, onclick: function () { mover(i, -1); } }),
        el('button', { type: 'button', class: 'claro', 'aria-label': 'Bajar look', text: '↓', disabled: i === S.looks.length - 1, onclick: function () { mover(i, 1); } }),
        el('button', { type: 'button', class: 'claro', text: abierta ? 'Cerrar' : 'Editar', 'aria-expanded': abierta, onclick: function () { S.abierto = abierta ? -1 : i; pintar(); } }),
      ]),
    ]);
    if (!abierta) return cab;
    var tit = el('input', { type: 'text', maxlength: '80', value: l.titulo, placeholder: 'Ej. Noche de verano' });
    tit.addEventListener('input', function () { l.titulo = tit.value; });
    var vis = el('input', { type: 'checkbox' }); vis.checked = l.visible !== false; vis.addEventListener('change', function () { l.visible = vis.checked; });
    var sel = el('div', { class: 'lo-prods' });
    S.prods.forEach(function (p) {
      var c = el('input', { type: 'checkbox' }); c.checked = l.productos.indexOf(String(p.id)) > -1;
      c.addEventListener('change', function () {
        var k = l.productos.indexOf(String(p.id));
        if (c.checked && k < 0) { if (l.productos.length >= MAX_P) { c.checked = false; return A().msg('Máximo ' + MAX_P + ' productos por look', true); } l.productos.push(String(p.id)); }
        if (!c.checked && k > -1) l.productos.splice(k, 1);
      });
      sel.appendChild(el('label', { class: 'ck' }, [c, p.nombre]));
    });
    var cambiar = el('input', { type: 'file', accept: 'image/*', hidden: true });
    cambiar.addEventListener('change', function () { if (!cambiar.files[0]) return; A().msg('Subiendo foto…'); A().subirFoto(cambiar.files[0]).then(function (u) { l.foto = u; pintar(); A().msg('Foto cambiada. Pulsa «Guardar lookbook»'); }).catch(A().falla); });
    return el('div', { class: 'lo-edit' }, [cab, el('div', { class: 'form' }, [
      el('label', {}, ['Título del look', tit]),
      el('label', { class: 'ck' }, [vis, 'Publicado (visible en la tienda)']),
      el('div', { class: 'ancho' }, [el('p', { class: 'nota', text: 'Productos que se ven en este look (hasta ' + MAX_P + ')' }), sel]),
      el('div', { class: 'ancho barra' }, [
        el('button', { type: 'button', class: 'claro', text: 'Cambiar foto', onclick: function () { cambiar.click(); } }), cambiar,
        el('button', { type: 'button', class: 'peligro', text: 'Quitar este look', onclick: function () {
          if (!confirm('¿Quitar este look? Se aplica al pulsar «Guardar lookbook» y la versión anterior queda en la Papelera.')) return;
          S.looks.splice(i, 1); S.abierto = -1; pintar();
        } }),
      ]),
    ])]);
  }
  function pintar() {
    var el = A().el, raiz = document.getElementById('p-lookbook'); raiz.textContent = '';
    var entrada = el('input', { type: 'file', accept: 'image/*', hidden: true });
    entrada.addEventListener('change', function () { if (entrada.files[0]) nuevo(entrada.files[0]); entrada.value = ''; });
    raiz.appendChild(el('div', { class: 'barra' }, [el('button', { type: 'button', text: '+ Nuevo look', onclick: function () { entrada.click(); } }), entrada]));
    if (!S.looks.length) raiz.appendChild(el('p', { class: 'pa-vacia', text: 'Aún no hay looks. Pulsa «+ Nuevo look», sube una foto y elige los productos que se ven en ella.' }));
    var ul = el('div', { class: 'lo-lista' }); S.looks.forEach(function (l, i) { ul.appendChild(tarjeta(l, i)); }); raiz.appendChild(ul);
    if (S.looks.length || S.cargado) raiz.appendChild(el('div', { class: 'lo-barra' }, [
      el('button', { type: 'button', text: 'Guardar lookbook', onclick: guardar }),
      el('button', { type: 'button', class: 'claro', text: 'Descartar cambios', onclick: function () { abrir(); } }),
    ]));
  }
  function guardar() {
    A().msg('Guardando…');
    A().api('admin-tienda', { method: 'POST', body: { recurso: 'lookbook', lookbook: S.looks } })
      .then(function (d) { S.looks = d.lookbook || []; S.abierto = -1; pintar(); A().msg('Lookbook guardado ✓ La tienda lo muestra en segundos'); }).catch(A().falla);
  }
  function abrir() {
    return Promise.all([A().api('admin-tienda?recurso=lookbook'), A().api('admin-tienda?recurso=productos')]).then(function (r) {
      S.looks = (r[0].lookbook || []).map(function (l) { l.productos = (l.productos || []).map(String); return l; });
      S.prods = r[1].productos || []; S.abierto = -1; S.cargado = true; pintar();
    });
  }
  window.mfAdminLookbook = { abrir: abrir };
})();
