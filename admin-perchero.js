/* Panel · Perchero: ordenas a mano TODO el catálogo. La tienda muestra los productos en este orden. Se guarda en el servidor (recurso 'perchero'). */
(function () {
  'use strict';
  var A = function () { return window.mfAdmin; };
  var S = { lista: [], sucio: false };
  var foto = function (p) { return (Array.isArray(p.imagenes) && p.imagenes[0]) || p.imagen || ''; };
  var peso = function (n) { return '$' + Math.round(Number(n) || 0).toLocaleString('es-CO'); };

  function mover(i, d) { var j = i + d; if (j < 0 || j >= S.lista.length) return; var x = S.lista.splice(i, 1)[0]; S.lista.splice(j, 0, x); S.sucio = true; pintar(i, j); }
  function alInicio(i) { if (i < 1) return; S.lista.unshift(S.lista.splice(i, 1)[0]); S.sucio = true; pintar(0); }
  function pintar(foco) {
    var el = A().el, raiz = document.getElementById('p-perchero'); raiz.textContent = '';
    if (!S.lista.length) { raiz.appendChild(el('p', { class: 'pa-vacia', text: 'Todavía no hay productos. Créalos en Productos y vuelve aquí para ordenarlos.' })); return; }
    raiz.appendChild(el('p', { class: 'nota', text: 'Sube o baja cada producto: el de arriba es el primero que ve la clienta en la tienda.' }));
    var ul = el('div', { class: 'lo-lista' });
    S.lista.forEach(function (p, i) {
      var f = foto(p);
      ul.appendChild(el('div', { class: 'lo-it', 'data-i': i }, [
        el('span', { class: 'lo-n', text: String(i + 1) }),
        f ? el('img', { src: f, alt: '', loading: 'lazy' }) : el('span', { class: 'lo-sf', text: 'Sin foto' }),
        el('div', { class: 'lo-tx' }, [el('b', { text: p.nombre }), el('small', { text: peso(p.precio) + (p.visible === false ? ' · Oculto' : '') })]),
        el('div', { class: 'lo-ac' }, [
          el('button', { type: 'button', class: 'claro', 'aria-label': 'Subir ' + p.nombre, text: '↑', disabled: i === 0, onclick: function () { mover(i, -1); } }),
          el('button', { type: 'button', class: 'claro', 'aria-label': 'Bajar ' + p.nombre, text: '↓', disabled: i === S.lista.length - 1, onclick: function () { mover(i, 1); } }),
          el('button', { type: 'button', class: 'claro', 'aria-label': 'Poner de primero ' + p.nombre, text: 'Primero', disabled: i === 0, onclick: function () { alInicio(i); } }),
        ]),
      ]));
    });
    raiz.appendChild(ul);
    raiz.appendChild(el('div', { class: 'lo-barra' }, [
      el('button', { type: 'button', text: 'Guardar orden', onclick: guardar }),
      el('button', { type: 'button', class: 'claro', text: 'Descartar cambios', onclick: function () { abrir(); } }),
    ]));
    if (foco != null) { var b = ul.querySelector('[data-i="' + (typeof foco === 'number' ? foco : 0) + '"]'); if (b) b.scrollIntoView({ block: 'nearest' }); }
  }
  function guardar() {
    A().msg('Guardando…');
    A().api('admin-tienda', { method: 'POST', body: { recurso: 'perchero', perchero: S.lista.map(function (p) { return p.id; }) } })
      .then(function () { S.sucio = false; A().msg('Orden guardado ✓ La tienda lo muestra en segundos'); }).catch(A().falla);
  }
  function abrir() {
    return Promise.all([A().api('admin-tienda?recurso=productos'), A().api('admin-tienda?recurso=perchero')]).then(function (r) {
      var prods = r[0].productos || [], ord = r[1].perchero || [], pos = {};
      ord.forEach(function (id, i) { pos[String(id)] = i; });
      S.lista = prods.map(function (p, i) { return { p: p, i: i }; }).sort(function (a, b) {
        var x = pos[String(a.p.id)], y = pos[String(b.p.id)];
        return (x == null ? 1e9 : x) - (y == null ? 1e9 : y) || a.i - b.i;
      }).map(function (o) { return o.p; });
      S.sucio = false; pintar();
    });
  }
  window.mfAdminPerchero = { abrir: abrir };
})();
