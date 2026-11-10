/* Panel · Outfits: los looks de la pasarela "Ideas de outfits" (/outfits).
   Cada look tiene fotos de la modelo (frente, lado, espalda…), el tacón con su color y las prendas que lo complementan,
   cada una con su foto si quieres. Las fotos se suben igual que las de productos (alta calidad).
   Se guarda en el servidor (/api/outfits) y la tienda lo usa en menos de un minuto.
   Se carga desde admin-comunidad.js; si falla, el resto del panel funciona igual. */
(function () {
  'use strict';
  if (window.__mfAdminOutfits) return; window.__mfAdminOutfits = 1;
  var A = window.mfAdmin;
  var tabs = document.getElementById('tabs');
  if (!A || !tabs) return;
  var el = function () { return A.el.apply(null, arguments); };
  var MAX_LOOKS = 12, MAX_FOTOS = 4, MAX_PIEZAS = 8;
  var ANGULOS = ['Frente', 'Lado', 'Espalda', 'Detalle'];
  var OCASIONES = ['Casual', 'Oficina', 'Noche', 'Fiesta', 'Cita', 'Boda o evento', 'Vacaciones'];
  var S = { lista: [], productos: [], editando: -1, sucio: false };

  var css = document.createElement('style');
  css.textContent = [
    '.ofA-look{display:grid;grid-template-columns:4.2rem 1fr;gap:.7rem;align-items:center;padding:.6rem;border:1px solid #e3e3e3;border-radius:.7rem;margin:.5rem 0;background:#fff}',
    '.ofA-look img{width:4.2rem;height:5.6rem;object-fit:cover;border-radius:.4rem;background:#f2f2f2}',
    '.ofA-look b{display:block}.ofA-look small{color:#777;display:block;margin:.15rem 0 .45rem}',
    '.ofA-acc{display:flex;gap:.35rem;flex-wrap:wrap}.ofA-acc button{padding:.4rem .6rem}',
    '.ofA-oculto{opacity:.55}',
    '.ofA-fotos{display:grid;grid-template-columns:repeat(auto-fill,minmax(7.5rem,1fr));gap:.6rem}',
    '.ofA-foto{display:grid;gap:.35rem;padding:.45rem;border:1px solid #e3e3e3;border-radius:.6rem;background:#fff}',
    '.ofA-foto img{width:100%;aspect-ratio:3/4;object-fit:cover;border-radius:.4rem;background:#f2f2f2}',
    '.ofA-vacia{display:grid;place-items:center;aspect-ratio:3/4;border:1px dashed #bbb;border-radius:.6rem;color:#555;background:#fff;font-size:.85rem;text-align:center;padding:.4rem;width:100%}',
    '.ofA-pieza{display:grid;grid-template-columns:3.4rem 1fr auto;gap:.5rem;align-items:center;margin:.4rem 0}',
    '.ofA-pieza .ofA-mini{width:3.4rem;height:3.4rem;object-fit:cover;border-radius:.4rem;background:#f2f2f2;border:1px dashed #bbb;display:grid;place-items:center;font-size:.7rem;color:#777;cursor:pointer;padding:0}',
    '.ofA-bar{display:flex;gap:.6rem;flex-wrap:wrap;padding:.9rem 0 1.2rem}',
    '#p-outfits{padding-bottom:6rem}', /* el aviso fijo de abajo no tapa los botones */
    '.ofA-ed{display:grid;gap:.8rem}'
  ].join('\n');
  document.head.appendChild(css);

  var btn = el('button', { type: 'button', 'data-of': '1' });
  btn.innerHTML = '<span class="ic">👗</span><span class="tx"><b>Outfits</b><small>Looks de la pasarela "Ideas de outfits"</small></span><i class="fl" aria-hidden="true">›</i>';
  var ref = tabs.querySelector('button[data-vt]') || tabs.querySelector('button[data-t="inicio"]');
  if (ref && ref.parentNode) ref.parentNode.insertBefore(btn, ref.nextSibling); else tabs.appendChild(btn);
  var sec = el('section', { class: 'panel', id: 'p-outfits' });
  var ult = document.querySelectorAll('.panel'); ult = ult[ult.length - 1];
  if (ult && ult.parentNode) ult.parentNode.insertBefore(sec, ult.nextSibling); else document.getElementById('app').appendChild(sec);

  function abrir() {
    tabs.hidden = true;
    var v = document.getElementById('volver'), t = document.getElementById('titulo'), ay = document.getElementById('ayuda');
    if (v) v.hidden = false; if (t) t.textContent = 'Outfits'; if (ay) ay.hidden = true;
    document.querySelectorAll('.panel').forEach(function (p) { p.classList.toggle('on', p === sec); });
    A.msg(''); window.scrollTo(0, 0);
    sec.textContent = ''; sec.appendChild(el('p', { class: 'nota', text: 'Cargando…' }));
    cargar().catch(A.falla);
  }
  btn.addEventListener('click', abrir);

  function cargar() {
    return Promise.all([A.api('outfits?admin=1'), A.api('admin-tienda?recurso=productos')]).then(function (r) {
      S.lista = (r[0].outfits || []).map(copia);
      S.productos = r[1].productos || [];
      S.editando = -1; S.sucio = false; pintar();
    });
  }
  var copia = function (o) { return JSON.parse(JSON.stringify(o)); };
  var porId = function (id) { return S.productos.filter(function (p) { return String(p.id) === String(id); })[0] || null; };
  var marcar = function () { S.sucio = true; A.msg('Tienes cambios sin guardar'); };
  function nuevo() { return { id: 'o' + Date.now().toString(36), nombre: '', ocasion: '', visible: true, producto: '', color: '', fotos: [], piezas: [] }; }

  // Elegir una foto del teléfono y subirla (misma calidad que las fotos de productos)
  function elegirFoto(listo) {
    var f = el('input', { type: 'file', accept: 'image/*', hidden: true });
    f.addEventListener('change', function () {
      var file = f.files && f.files[0]; f.remove(); if (!file) return;
      A.msg('Subiendo foto…');
      A.subirFoto(file).then(function (url) { listo(url); marcar(); A.msg('Foto subida ✓ Recuerda guardar.'); }).catch(A.falla);
    });
    document.body.appendChild(f); f.click();
  }

  function pintar() { if (S.editando >= 0) return editor(S.lista[S.editando]); lista(); }

  // ---------- Lista de looks ----------
  function lista() {
    var y = window.scrollY; sec.textContent = '';
    sec.appendChild(el('p', { class: 'nota', text: 'Aquí armas los looks de la página "Ideas de outfits". Para que se vean como pasarela, usa fotos de estudio: modelo de cuerpo completo, de frente, con fondo blanco o gris claro y el mismo encuadre en todas.' }));
    if (!S.lista.length) sec.appendChild(el('p', { class: 'nota', text: 'Todavía no has guardado looks. Mientras tanto la página muestra los 3 looks de ejemplo.' }));
    S.lista.forEach(function (o, i) {
      var p = porId(o.producto), f = o.fotos[0];
      var b = function (t, fn, dis) { var x = el('button', { type: 'button', class: 'claro', text: t }); x.disabled = !!dis; x.addEventListener('click', fn); return x; };
      sec.appendChild(el('div', { class: 'ofA-look' + (o.visible === false ? ' ofA-oculto' : '') }, [
        f ? el('img', { src: f.url, alt: '' }) : el('div', { class: 'ofA-vacia', text: 'Sin foto' }),
        el('div', {}, [
          el('b', { text: (i + 1) + '. ' + (o.nombre || 'Sin nombre') }),
          el('small', { text: (o.ocasion ? o.ocasion + ' · ' : '') + (p ? p.nombre : 'Sin tacón') + (o.color ? ' · ' + o.color : '') + ' · ' + o.fotos.length + ' foto(s) · ' + o.piezas.length + ' prenda(s)' + (o.visible === false ? ' · Oculto' : '') }),
          el('div', { class: 'ofA-acc' }, [
            b('Editar', function () { S.editando = i; pintar(); window.scrollTo(0, 0); }),
            b('↑', function () { S.lista.splice(i - 1, 0, S.lista.splice(i, 1)[0]); marcar(); pintar(); }, i === 0),
            b('↓', function () { S.lista.splice(i + 1, 0, S.lista.splice(i, 1)[0]); marcar(); pintar(); }, i === S.lista.length - 1),
            b(o.visible === false ? 'Mostrar' : 'Ocultar', function () { o.visible = o.visible === false; marcar(); pintar(); }),
            b('Eliminar', function () { if (window.confirm('¿Eliminar el look "' + (o.nombre || 'Sin nombre') + '"?')) { S.lista.splice(i, 1); marcar(); pintar(); } }),
          ]),
        ]),
      ]));
    });
    var add = el('button', { type: 'button', class: 'claro', text: '+ Nuevo look' });
    add.disabled = S.lista.length >= MAX_LOOKS;
    add.addEventListener('click', function () { S.lista.push(nuevo()); S.editando = S.lista.length - 1; marcar(); pintar(); window.scrollTo(0, 0); });
    var guardar = el('button', { type: 'button', text: 'Guardar outfits' });
    guardar.addEventListener('click', function () {
      guardar.disabled = true; A.msg('Guardando…');
      A.api('outfits', { method: 'POST', body: { outfits: S.lista } })
        .then(function (r) { S.lista = (r.outfits || []).map(copia); S.sucio = false; pintar(); A.msg('Outfits guardados ✓ Se verán en la tienda en menos de un minuto.'); })
        .catch(function (e) { guardar.disabled = false; A.falla(e); });
    });
    var deshacer = el('button', { type: 'button', class: 'claro', text: 'Deshacer cambios' });
    deshacer.addEventListener('click', function () { cargar().then(function () { A.msg('Cambios descartados'); }).catch(A.falla); });
    sec.appendChild(el('div', { class: 'ofA-bar' }, [add, guardar, deshacer]));
    sec.appendChild(el('p', { class: 'nota' }, ['Ver la página: ', el('a', { href: 'outfits.html', target: '_blank', rel: 'noopener', text: 'Ideas de outfits' })]));
    window.scrollTo(0, y);
  }

  // ---------- Editor de un look ----------
  function editor(o) {
    sec.textContent = '';
    var nombre = el('input', { type: 'text', maxlength: '40', value: o.nombre, placeholder: 'Ej: Noche glam' });
    nombre.addEventListener('input', function () { o.nombre = nombre.value; marcar(); });

    var opsO = OCASIONES.slice(); if (o.ocasion && opsO.indexOf(o.ocasion) < 0) opsO.push(o.ocasion);
    var selO = el('select', {}, [el('option', { value: '', text: 'Sin ocasión' })].concat(opsO.map(function (x) { return el('option', { value: x, text: x }); })));
    selO.value = o.ocasion || '';
    selO.addEventListener('change', function () { o.ocasion = selO.value; marcar(); });

    var selP = el('select', {}, [el('option', { value: '', text: 'Elige el tacón…' })].concat(S.productos.map(function (p) {
      return el('option', { value: p.id, text: p.nombre + (p.visible === false ? ' (oculto)' : '') });
    })));
    selP.value = o.producto || '';
    var selC = el('select', {});
    function colores() {
      var p = porId(selP.value), cs = (p && p.colores) || [];
      selC.textContent = '';
      selC.appendChild(el('option', { value: '', text: cs.length ? 'Elige el color…' : 'Sin colores' }));
      cs.forEach(function (c) { selC.appendChild(el('option', { value: c.n, text: c.n })); });
      selC.value = cs.some(function (c) { return c.n === o.color; }) ? o.color : '';
    }
    selP.addEventListener('change', function () { o.producto = selP.value; o.color = ''; colores(); marcar(); });
    selC.addEventListener('change', function () { o.color = selC.value; marcar(); });
    colores();

    var vis = el('input', { type: 'checkbox' }); vis.checked = o.visible !== false;
    vis.addEventListener('change', function () { o.visible = vis.checked; marcar(); });

    // Fotos de la modelo
    var fotosBox = el('div', { class: 'ofA-fotos' });
    function fotos() {
      fotosBox.textContent = '';
      o.fotos.forEach(function (f, i) {
        var sel = el('select', { 'aria-label': 'Ángulo' }, ANGULOS.map(function (a) { return el('option', { value: a, text: a }); }));
        sel.value = ANGULOS.indexOf(f.e) > -1 ? f.e : 'Frente';
        sel.addEventListener('change', function () { f.e = sel.value; marcar(); });
        var cambiar = el('button', { type: 'button', class: 'claro', text: 'Cambiar' });
        cambiar.addEventListener('click', function () { elegirFoto(function (url) { f.url = url; fotos(); }); });
        var quitar = el('button', { type: 'button', class: 'claro', text: 'Quitar' });
        quitar.addEventListener('click', function () { o.fotos.splice(i, 1); marcar(); fotos(); });
        var prin = i === 0 ? el('small', { text: 'Sale en la pasarela' }) : el('button', { type: 'button', class: 'claro', text: 'Usar en pasarela', onclick: function () { o.fotos.unshift(o.fotos.splice(i, 1)[0]); marcar(); fotos(); } });
        fotosBox.appendChild(el('div', { class: 'ofA-foto' }, [el('img', { src: f.url, alt: f.e }), sel, prin, cambiar, quitar]));
      });
      if (o.fotos.length < MAX_FOTOS) {
        var add = el('button', { type: 'button', class: 'claro ofA-vacia', text: '+ Subir foto de la modelo' });
        add.addEventListener('click', function () {
          elegirFoto(function (url) { var usados = o.fotos.map(function (x) { return x.e; }); o.fotos.push({ e: ANGULOS.filter(function (a) { return usados.indexOf(a) < 0; })[0] || 'Detalle', url: url }); fotos(); });
        });
        fotosBox.appendChild(add);
      }
    }
    fotos();

    // Prendas que complementan el look
    var piezasBox = el('div', {});
    function piezas() {
      piezasBox.textContent = '';
      o.piezas.forEach(function (p, i) {
        var n = el('input', { type: 'text', maxlength: '60', value: p.n, placeholder: 'Ej: Vestido midi camel', 'aria-label': 'Prenda ' + (i + 1) });
        n.addEventListener('input', function () { p.n = n.value; marcar(); });
        var mini = el('button', { type: 'button', class: 'ofA-mini', 'aria-label': p.foto ? 'Cambiar foto de la prenda' : 'Subir foto de la prenda' });
        if (p.foto) mini.appendChild(el('img', { src: p.foto, alt: '', style: 'width:100%;height:100%;object-fit:cover;border-radius:.4rem' })); else mini.textContent = '+ Foto';
        mini.addEventListener('click', function () { elegirFoto(function (url) { p.foto = url; piezas(); }); });
        var q = el('button', { type: 'button', class: 'claro', text: 'Quitar' });
        q.addEventListener('click', function () { o.piezas.splice(i, 1); marcar(); piezas(); });
        piezasBox.appendChild(el('div', { class: 'ofA-pieza' }, [mini, n, q]));
      });
      if (o.piezas.length < MAX_PIEZAS) {
        var add = el('button', { type: 'button', class: 'claro', text: '+ Agregar prenda' });
        add.addEventListener('click', function () { o.piezas.push({ n: '' }); marcar(); piezas(); });
        piezasBox.appendChild(add);
      }
    }
    piezas();

    var listo = el('button', { type: 'button', text: 'Listo, volver a la lista' });
    listo.addEventListener('click', function () { S.editando = -1; pintar(); A.msg('Recuerda tocar "Guardar outfits" para publicar los cambios.'); window.scrollTo(0, 0); });

    sec.appendChild(el('div', { class: 'ofA-ed' }, [
      el('label', {}, ['Nombre del look', nombre]),
      el('label', {}, ['Ocasión', selO]),
      el('label', {}, ['Tacón', selP]),
      el('label', {}, ['Color del tacón', selC]),
      el('h3', { text: 'Fotos de la modelo' }),
      el('p', { class: 'nota', text: 'La primera foto es la que sale en la pasarela. Las demás (lado, espalda…) se ven al tocar el look. Máximo ' + MAX_FOTOS + '.' }),
      fotosBox,
      el('h3', { text: 'Prendas que complementan el look' }),
      el('p', { class: 'nota', text: 'Escribe cada prenda (vestido, bolso, blazer…) y, si quieres, súbele una foto.' }),
      piezasBox,
      el('div', { style: 'display:flex;align-items:center;gap:.5rem' }, [vis, el('span', { text: 'Mostrar este look en la tienda' })]),
      el('div', { class: 'ofA-bar' }, [listo]),
    ]));
  }
})();
