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
  var ANGULOS = ['Frente', 'Lado', 'Espalda', 'Editorial', 'Detalle'];
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
    '.ofA-ed{display:grid;gap:.8rem}',
    '.ofA-ay{display:block;font-size:.82rem;line-height:1.35;color:#6b6b6b;font-weight:400;margin:.15rem 0 .35rem}',
    '.ofA-pasos{margin:.3rem 0 .8rem;padding:.8rem .9rem .8rem 2rem;border:1px solid #e3e3e3;border-radius:.7rem;background:#fff;line-height:1.45;font-size:.9rem}',
    '.ofA-pasos li{margin:.25rem 0}',
    '.ofA-bot{display:grid;gap:.25rem}.ofA-bot .ofA-ay{margin:0;max-width:15rem}',
    '.ofA-bar{align-items:flex-start}',
    '.ofA-aviso{padding:.6rem .8rem;border-radius:.6rem;background:#fff4e0;border:1px solid #f0d9a8;font-size:.88rem;line-height:1.4}',
    '.ofA-campo{display:grid;gap:.2rem;font-weight:600}',
    '.ofA-foto button{font-size:.8rem}',
    /* Puntos de compra: cada prenda puede llevar a un producto de la tienda o a un link */
    '.ofA-pz{padding:.6rem;border:1px solid #e3e3e3;border-radius:.7rem;background:#fff;margin:.5rem 0}',
    '.ofA-pz .ofA-pieza{margin:0}',
    '.ofA-dest{display:grid;gap:.45rem;margin-top:.55rem}',
    '.ofA-dest label{display:grid;gap:.15rem;font-size:.85rem;font-weight:600}',
    '.ofA-pz [hidden]{display:none!important}',
    '.ofA-pin{display:flex;gap:.4rem;flex-wrap:wrap;align-items:center}',
    '.ofA-pin .ok{font-size:.82rem;color:#2e7d32}',
    '.ofA-num{display:inline-grid;place-items:center;width:1.4rem;height:1.4rem;border-radius:50%;background:#0a0a0a;color:#fff;font-size:.72rem;font-weight:700;flex:none}',
    '.ofA-mapa{position:relative;width:min(100%,22rem);aspect-ratio:3/4;border-radius:.6rem;overflow:hidden;background:#f2f2f2;cursor:crosshair;touch-action:manipulation}',
    '.ofA-mapa img{width:100%;height:100%;object-fit:cover;display:block;pointer-events:none}',
    '.ofA-mapa .ofA-num{position:absolute;transform:translate(-50%,-50%);box-shadow:0 0 0 3px #fff,0 2px 8px rgba(0,0,0,.35);pointer-events:none}',
    '.ofA-mapa .ofA-num.act{background:#b08d57}',
    '.ofA-pide{padding:.6rem .8rem;border-radius:.6rem;background:#0a0a0a;color:#fff;font-size:.9rem;margin:.4rem 0}',
    /* Botón de marcar: negro y grande para que no se pierda; dorado mientras espera el toque en la foto */
    '.ofA-pin .ofA-marca{background:#0a0a0a;color:#fff;border-color:#0a0a0a;font-weight:700;padding:.7rem 1.1rem;flex:1 1 12rem}',
    '.ofA-pin .ofA-marca.esperando{background:#b08d57;border-color:#b08d57;animation:ofaLatido 1.2s ease-in-out infinite}',
    '@keyframes ofaLatido{50%{box-shadow:0 0 0 6px rgba(176,141,87,.25)}}',
    '.ofA-mapa.esperando{outline:3px solid #b08d57;outline-offset:3px}',
    '.ofA-tabs{display:flex;gap:.45rem;overflow-x:auto;padding:.2rem .1rem .5rem}',
    '.ofA-tab{display:grid;gap:.2rem;flex:none;width:4.6rem;padding:.25rem;border:2px solid #e3e3e3;border-radius:.55rem;background:#fff;font:inherit;font-size:.72rem;text-align:center;cursor:pointer;color:#0a0a0a}',
    '.ofA-tab img{width:100%;aspect-ratio:3/4;object-fit:cover;border-radius:.35rem;background:#f2f2f2}',
    '.ofA-tab[aria-pressed="true"]{border-color:#0a0a0a;box-shadow:0 0 0 1px #0a0a0a}',
    /* Fotos con IA: tu modelo + prendas + tacón */
    '.ofA-ia{display:grid;gap:.7rem;padding:.9rem;border:1px solid #e6dcc8;border-radius:.8rem;background:#fffaf1}',
    '.ofA-ia h4{margin:0;font-size:1rem}',
    '.ofA-ia .fila{display:flex;gap:.6rem;align-items:center;flex-wrap:wrap}',
    '.ofA-ia .min{width:4.2rem;height:5.6rem;object-fit:cover;border-radius:.4rem;background:#f2f2f2;border:1px solid #e3e3e3;display:block}',
    '.ofA-ia .chips{display:grid;grid-template-columns:repeat(auto-fill,minmax(5.6rem,1fr));gap:.5rem}',
    '.ofA-ia .chip{display:grid;gap:.25rem;padding:.3rem;border:2px solid #e3e3e3;border-radius:.6rem;background:#fff;cursor:pointer;font-size:.75rem;text-align:center;line-height:1.2}',
    '.ofA-ia .chip img{width:100%;aspect-ratio:3/4;object-fit:cover;border-radius:.35rem;background:#f2f2f2}',
    '.ofA-ia .chip[aria-pressed="true"]{border-color:#0a0a0a;box-shadow:0 0 0 1px #0a0a0a}',
    '.ofA-ia .crear{background:#0a0a0a;color:#fff;border-color:#0a0a0a;font-weight:700;padding:.8rem 1.1rem}',
    '.ofA-ia .estado{font-size:.88rem;margin:0}',
    '.ofA-ia .res{display:grid;grid-template-columns:repeat(auto-fill,minmax(7rem,1fr));gap:.6rem}',
    '.ofA-ia .res figure{margin:0;display:grid;gap:.25rem;font-size:.78rem}',
    '.ofA-ia .res img{width:100%;aspect-ratio:3/4;object-fit:cover;border-radius:.5rem;background:#f2f2f2}',
    '.ofA-ia .ojo{color:#8a5a00}',
    '.ofA-ia .res > img{width:100%;aspect-ratio:3/4;object-fit:cover;border-radius:.5rem;background:#f2f2f2}',
    /* Selector con foto: tacón, color y producto de cada prenda */
    /* En el celular nada se sale de la pantalla */
    '.ofA-pieza{grid-template-columns:3.4rem minmax(0,1fr) auto!important}.ofA-pieza input,.ofA-dest input{min-width:0;width:100%;box-sizing:border-box}.ofA-pz,.ofA-dest>*,.ofA-campo{min-width:0}.ofA-pin .ofA-marca{flex:1 1 10rem;min-width:0;white-space:normal}',
    '.ofA-pick{min-width:0;box-sizing:border-box;display:flex;align-items:center;gap:.6rem;width:100%;padding:.4rem .9rem .4rem .45rem;border:1px solid #d9d2c4;border-radius:.9rem;background:#fffdf8;color:#0a0a0a;text-align:left;font:inherit;font-weight:600;cursor:pointer}',
    '.ofA-pick .ft,.ofA-menu .ft{width:2.8rem;height:2.8rem;object-fit:cover;border-radius:.55rem;background:#f2f2f2;flex:none;display:grid;place-items:center;font-size:1.1rem;color:#999}',
    '.ofA-pick .tx{flex:1;line-height:1.25}.ofA-pick .fl{font-style:normal;color:#777;font-size:.8rem}',
    '.ofA-menu{margin-top:.5rem;padding:.6rem;border:1px solid #e3e3e3;border-radius:.8rem;background:#fff;display:grid;gap:.55rem;font-weight:400}',
    '.ofA-menu input{width:100%}',
    /* Lista como la de Productos: foto a la izquierda, nombre y precio a la derecha */
    '.ofA-menu .grid{display:flex;flex-direction:column;gap:.45rem;max-height:62vh;overflow:auto;padding:.1rem}',
    '#p-outfits .ofA-menu .op{flex:none;display:grid!important;grid-template-columns:4.2rem minmax(0,1fr) auto;gap:.8rem;align-items:center;width:100%;min-height:0!important;height:auto!important;padding:.45rem .8rem .45rem .45rem!important;border:2px solid #ece6da!important;border-radius:1rem!important;background:#fffdf8!important;color:#0a0a0a!important;font:inherit;text-align:left;white-space:normal;box-shadow:none;cursor:pointer}',
    '#p-outfits .ofA-menu .op .ft{width:4.2rem;height:4.2rem;border-radius:.7rem}',
    '#p-outfits .ofA-menu .op .nm{display:grid;gap:.15rem;min-width:0}',
    '#p-outfits .ofA-menu .op .nm b{font-size:1rem;line-height:1.2;font-weight:700}',
    '#p-outfits .ofA-menu .op .nm small{font-size:.85rem;color:#6b6b6b;font-weight:400}',
    '#p-outfits .ofA-menu .op .ck{width:1.6rem;height:1.6rem;border-radius:50%;border:2px solid #d9d2c4;display:grid;place-items:center;font-size:.9rem;color:#fff}',
    '#p-outfits .ofA-menu .op[aria-pressed="true"]{border-color:#0a0a0a!important;background:#fff!important}',
    '#p-outfits .ofA-menu .op[aria-pressed="true"] .ck{background:#0a0a0a;border-color:#0a0a0a}',
    '.ofA-menu .nada{grid-column:1/-1;color:#777;font-size:.85rem;margin:0}',
    '.ofA-pick .pt,.ofA-menu .pt{display:inline-block;width:1rem;height:1rem;border-radius:50%;border:1px solid rgba(0,0,0,.15);vertical-align:-.15rem;margin-right:.3rem}'
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
  // Si hay cambios sin guardar, el navegador pregunta antes de cerrar o recargar la página
  window.addEventListener('beforeunload', function (e) { if (S.sucio) { e.preventDefault(); e.returnValue = ''; } });

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
  // Ropa: productos con tallas XS…XL o talla única (los demás son tacones)
  var TALLAS_ROPA = ['XS', 'S', 'M', 'L', 'XL', 'Unica'];
  var esRopa = function (p) { return Object.keys((p && p.stock) || {}).some(function (t) { return TALLAS_ROPA.indexOf(t) > -1; }); };
  var fotoDe = function (p) { return p ? ((p.imagenes && p.imagenes[0]) || p.imagen || '') : ''; };
  var precioDe = function (p) { var n = Number(p && p.precio); return n > 0 ? '$' + n.toLocaleString('es-CO') : ''; };
  var VISTA_NOM = { frente: 'Frente', lado: 'Lado', espalda: 'Espalda', editorial: 'Editorial' };
  // Puntos de compra por foto: pts[i] = [x, y] sobre la foto i. x / y repiten el de la foto principal (pts[0]).
  var ptsDe = function (p) { if (!Array.isArray(p.pts)) p.pts = p.x != null && p.y != null ? [[p.x, p.y]] : []; return p.pts; };
  var sync = function (p) { var a = ptsDe(p)[0]; if (a) { p.x = a[0]; p.y = a[1]; } else { delete p.x; delete p.y; } };
  // Selector con foto (reemplaza las listas de solo texto): un botón con la foto y el nombre elegido;
  // al tocarlo se abre una cuadrícula con la foto de cada opción y, si son muchas, un buscador.
  // op = { lista(), valor(), elegir(id), foto(x), nombre(x), punto(x), extra(x), vacio, ninguno, ningunoIc }
  function selector(op) {
    var caja = el('div', {}), abierto = false, q = '';
    var minFoto = function (u, ic) { return u ? el('img', { class: 'ft', src: u, alt: '', loading: 'lazy' }) : el('span', { class: 'ft', text: ic || '👠' }); };
    var sinTilde = function (s) { return String(s || '').toLowerCase().normalize('NFD').replace(/\p{M}/gu, ''); };
    function pintarS() {
      caja.textContent = '';
      var lista = op.lista(), v = op.valor();
      var sel = v ? lista.filter(function (x) { return String(x.id) === String(v); })[0] : null;
      var etiqueta = sel ? op.nombre(sel) : (op.ninguno && v === '' && op.ningunoElegido ? op.ninguno : op.vacio);
      var b = el('button', { type: 'button', class: 'ofA-pick', 'aria-expanded': abierto ? 'true' : 'false' }, [
        sel ? minFoto(op.foto(sel)) : minFoto('', op.ningunoElegido ? op.ningunoIc : '＋'),
        el('span', { class: 'tx' }, [sel && op.punto && op.punto(sel) ? el('i', { class: 'pt', style: 'background:' + op.punto(sel) }) : null, etiqueta]),
        el('i', { class: 'fl', text: abierto ? 'Cerrar ▲' : 'Cambiar ▼' })
      ]);
      b.addEventListener('click', function () { abierto = !abierto; q = ''; pintarS(); });
      caja.appendChild(b);
      if (!abierto) return;
      var menu = el('div', { class: 'ofA-menu' }), grid = el('div', { class: 'grid' });
      if (lista.length > 8) {
        var bus = el('input', { type: 'search', placeholder: 'Buscar por nombre…', 'aria-label': 'Buscar' });
        bus.addEventListener('input', function () { q = sinTilde(bus.value.trim()); llenar(); });
        menu.appendChild(bus);
      }
      function elegir(id) { abierto = false; op.elegir(id); pintarS(); }
      function llenar() {
        grid.textContent = '';
        if (op.ninguno && !q) {
          var n = el('button', { type: 'button', class: 'op', 'aria-pressed': !v && op.ningunoElegido ? 'true' : 'false' }, [minFoto('', op.ningunoIc), el('span', { class: 'nm' }, [el('b', { text: op.ninguno }), el('small', { text: 'Pegas un link de WhatsApp, Instagram u otra página' })]), el('span', { class: 'ck', text: '✓' })]);
          n.addEventListener('click', function () { elegir(''); });
          grid.appendChild(n);
        }
        var vis = lista.filter(function (x) { return !q || sinTilde(op.nombre(x)).indexOf(q) > -1; });
        vis.forEach(function (x) {
          var o2 = el('button', { type: 'button', class: 'op', 'aria-pressed': String(x.id) === String(v) ? 'true' : 'false' }, [
            minFoto(op.foto(x)),
            el('span', { class: 'nm' }, [el('b', {}, [op.punto && op.punto(x) ? el('i', { class: 'pt', style: 'background:' + op.punto(x) }) : null, op.nombre(x)]),
              op.extra && op.extra(x) ? el('small', { text: op.extra(x) }) : null]),
            el('span', { class: 'ck', text: '✓' })
          ]);
          o2.addEventListener('click', function () { elegir(x.id); });
          grid.appendChild(o2);
        });
        if (!vis.length && !(op.ninguno && !q)) grid.appendChild(el('p', { class: 'nada', text: q ? 'No hay nada con ese nombre.' : 'No hay opciones.' }));
      }
      llenar();
      menu.appendChild(grid);
      caja.appendChild(menu);
    }
    pintarS();
    return { nodo: caja, pintar: pintarS };
  }

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
    sec.appendChild(el('p', { class: 'nota', text: 'Aquí armas los looks de la página "Ideas de outfits". Cada look es UN outfit: una modelo con una ropa y un tacón. En la tienda se pasa de un look a otro con las flechas.' }));
    sec.appendChild(el('ol', { class: 'ofA-pasos' }, [
      el('li', { text: 'Toca "+ Nuevo look" por cada outfit. Si tienes 3 outfits (jean, vestido, falda), son 3 looks.' }),
      el('li', { text: 'Dentro del look sube solo las fotos de ESE outfit: primero la de frente y, si la tienes, la de lado o espalda.' }),
      el('li', { text: 'Elige el tacón que lleva puesto la modelo y escribe la ropa que lleva (blusa, jean, bolso…).' }),
      el('li', { text: 'Toca "Listo" y al final "Guardar outfits" para que salga en la tienda.' })
    ]));
    sec.appendChild(el('p', { class: 'nota', text: 'Fotos: modelo de cuerpo completo, vertical, fondo blanco o gris claro y el mismo encuadre en todas. Sirven JPG, PNG o fotos del celular.' }));
    if (!S.lista.length) sec.appendChild(el('p', { class: 'nota', text: 'Todavía no has guardado looks. Mientras tanto la página muestra los 3 looks de ejemplo.' }));
    if (S.lista.length) {
      sec.appendChild(el('h3', { text: 'Tus looks (' + S.lista.length + ' de ' + MAX_LOOKS + ')' }));
      sec.appendChild(el('p', { class: 'ofA-ay', text: 'Editar: cambiar fotos, tacón o ropa del look · ↑ ↓: el orden en que salen en la pasarela · Ocultar: no sale en la tienda pero no se borra · Eliminar: lo borra.' }));
    }
    S.lista.forEach(function (o, i) {
      var p = porId(o.producto), f = o.fotos[0];
      var b = function (t, fn, dis, lbl) { var x = el('button', { type: 'button', class: 'claro', text: t, title: lbl || t, 'aria-label': lbl || t }); x.disabled = !!dis; x.addEventListener('click', fn); return x; };
      sec.appendChild(el('div', { class: 'ofA-look' + (o.visible === false ? ' ofA-oculto' : '') }, [
        f ? el('img', { src: f.url, alt: '' }) : el('div', { class: 'ofA-vacia', text: 'Sin foto' }),
        el('div', {}, [
          el('b', { text: (i + 1) + '. ' + (o.nombre || 'Sin nombre') }),
          el('small', { text: (o.ocasion ? o.ocasion + ' · ' : '') + (p ? p.nombre : 'Sin tacón') + (o.color ? ' · ' + o.color : '') + ' · ' + o.fotos.length + ' foto(s) · ' + o.piezas.length + ' prenda(s)' + (o.visible === false ? ' · Oculto' : '') }),
          el('div', { class: 'ofA-acc' }, [
            b('Editar', function () { S.editando = i; pintar(); window.scrollTo(0, 0); }),
            b('↑', function () { S.lista.splice(i - 1, 0, S.lista.splice(i, 1)[0]); marcar(); pintar(); }, i === 0, 'Mover antes en la pasarela'),
            b('↓', function () { S.lista.splice(i + 1, 0, S.lista.splice(i, 1)[0]); marcar(); pintar(); }, i === S.lista.length - 1, 'Mover después en la pasarela'),
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
    var conAyuda = function (boton, texto) { return el('div', { class: 'ofA-bot' }, [boton, el('small', { class: 'ofA-ay', text: texto })]); };
    sec.appendChild(el('div', { class: 'ofA-bar' }, [
      conAyuda(add, add.disabled ? 'Llegaste al máximo de ' + MAX_LOOKS + ' looks.' : 'Crea un outfit nuevo (uno por cada ropa distinta).'),
      conAyuda(guardar, 'Publica tus looks en la tienda. Sin esto no se ve nada.'),
      conAyuda(deshacer, 'Borra lo que cambiaste y no has guardado.')
    ]));
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

    // Tacón y color: con foto para reconocerlos rápido
    var nomP = function (p) { return p.nombre + (p.visible === false ? ' (oculto)' : ''); };
    var selP = selector({
      lista: function () { return S.productos.filter(function (p) { return !esRopa(p) || String(p.id) === String(o.producto); }); },
      valor: function () { return o.producto || ''; },
      elegir: function (id) { if (String(id) !== String(o.producto)) { o.producto = id; o.color = ''; } selC.pintar(); marcar(); if (iaBox) pintarIA(); },
      foto: fotoDe, nombre: nomP,
      extra: function (p) { var n = (p.colores || []).length; return [precioDe(p), n > 1 ? n + ' colores' : ''].filter(Boolean).join(' · '); },
      vacio: 'Elige el tacón…'
    });
    var selC = selector({
      lista: function () { var p = porId(o.producto); return ((p && p.colores) || []).map(function (c) { return { id: c.n, c: c }; }); },
      valor: function () { return o.color || ''; },
      elegir: function (id) { o.color = id; marcar(); if (iaBox) pintarIA(); },
      foto: function (x) { return x.c.img || fotoDe(porId(o.producto)); },
      nombre: function (x) { return x.c.n; },
      punto: function (x) { return /^#[0-9a-f]{6}$/i.test(x.c.h || '') ? x.c.h : ''; },
      vacio: 'Elige el color…'
    });

    var vis = el('input', { type: 'checkbox' }); vis.checked = o.visible !== false;
    vis.addEventListener('change', function () { o.visible = vis.checked; marcar(); });

    // Fotos de la modelo
    var fotosBox = el('div', { class: 'ofA-fotos' });
    var avisoFotos = el('p', { class: 'ofA-aviso', role: 'status' }); avisoFotos.hidden = true;
    function fotos() {
      if (vdBox) pintarVideo(); // la pasarela en video parte de la foto principal
      fotosBox.textContent = '';
      o.fotos.forEach(function (f, i) {
        var sel = el('select', { 'aria-label': '¿Desde dónde se ve la modelo?' }, ANGULOS.map(function (a) { return el('option', { value: a, text: a }); }));
        sel.value = ANGULOS.indexOf(f.e) > -1 ? f.e : 'Frente';
        sel.addEventListener('change', function () { f.e = sel.value; marcar(); fotos(); });
        var cambiar = el('button', { type: 'button', class: 'claro', text: 'Cambiar esta foto' });
        cambiar.addEventListener('click', function () { elegirFoto(function (url) { f.url = url; fotos(); }); });
        var quitar = el('button', { type: 'button', class: 'claro', text: 'Quitar foto' });
        quitar.addEventListener('click', function () { o.fotos.splice(i, 1); o.piezas.forEach(function (p) { ptsDe(p).splice(i, 1); sync(p); }); if (fm >= o.fotos.length) fm = 0; marcar(); fotos(); piezas(); });
        var prin = i === 0 ? el('small', { class: 'ofA-ay', text: '★ Foto principal: es la que sale en la pasarela' }) : el('button', { type: 'button', class: 'claro', text: 'Hacer foto principal', onclick: function () { o.fotos.unshift(o.fotos.splice(i, 1)[0]); o.piezas.forEach(function (p) { var a = ptsDe(p); a.length = Math.max(a.length, i + 1); a.unshift(a.splice(i, 1)[0] || null); sync(p); }); fm = 0; marcar(); fotos(); piezas(); } });
        fotosBox.appendChild(el('div', { class: 'ofA-foto' }, [el('img', { src: f.url, alt: f.e }), el('small', { class: 'ofA-ay', text: '¿Desde dónde se ve?' }), sel, prin, cambiar, quitar]));
      });
      var cuenta = {}; o.fotos.forEach(function (f) { cuenta[f.e] = (cuenta[f.e] || 0) + 1; });
      var rep = Object.keys(cuenta).filter(function (k) { return cuenta[k] > 1; });
      avisoFotos.hidden = !rep.length;
      avisoFotos.textContent = rep.length ? 'Tienes ' + cuenta[rep[0]] + ' fotos marcadas como "' + rep[0] + '". Si son outfits distintos (otra ropa), cada uno va en su propio look: quítalas de aquí y crea un "+ Nuevo look" para cada uno. Si es la misma ropa, cambia el ángulo (Lado, Espalda, Detalle).' : '';
      if (o.fotos.length < MAX_FOTOS) {
        var add = el('button', { type: 'button', class: 'claro ofA-vacia', text: o.fotos.length ? '+ Otra foto de este mismo outfit (lado, espalda…)' : '+ Subir la foto de frente' });
        add.addEventListener('click', function () {
          elegirFoto(function (url) { var usados = o.fotos.map(function (x) { return x.e; }); o.fotos.push({ e: ANGULOS.filter(function (a) { return usados.indexOf(a) < 0; })[0] || 'Detalle', url: url }); fotos(); });
        });
        fotosBox.appendChild(add);
      }
    }
    fotos();

    // ---------- ✨ Fotos con IA: tu modelo con las prendas y el tacón del look ----------
    var iaBox = el('div', { class: 'ofA-ia' });
    var IA = { modelo: '', prendas: [], extra: [], lado: true, espalda: true, editorial: true, ocupado: false, res: null, estado: '', hist: null, verHist: false };
    try { IA.modelo = localStorage.getItem('mf_ia_modelo') || ''; } catch (e) { IA.modelo = ''; }
    // Súper modelo MF (guardada en el servidor) y si el servidor tiene la clave de Google para video
    IA.marca = null; IA.hayVideo = null;
    IA.sm = { abierto: false, ocupado: false, estado: '', opciones: null, piel: '', cabello: '', edad: '', cuerpo: '', rasgos: '' };
    IA.vd = { ocupado: false, estado: '', url: '', formato: 'vertical', calidad: 'rapida', tipo: 'pasarela' };
    A.api('fotos-ia-estado?modelo=1').then(function (r) {
      IA.marca = r && r.modelo ? r.modelo : null; IA.hayVideo = !!(r && r.video);
      if (!IA.modelo && IA.marca) IA.modelo = IA.marca.url;
      pintarIA(); pintarVideo();
    }).catch(function () { /* el resto del editor funciona igual */ });
    function ponerModelo(url) { IA.modelo = url; try { localStorage.setItem('mf_ia_modelo', url); } catch (e) {} pintarIA(); }
    // Espera un trabajo de IA (fotos, súper modelo o video) consultando /api/fotos-ia-estado cada 6 s
    function sondear(trabajo, t0, avance) {
      return new Promise(function (ok) { setTimeout(ok, 6000); }).then(function () { return A.api('fotos-ia-estado?trabajo=' + trabajo); }).then(function (r) {
        if (r && r.listo) return r;
        if (Date.now() - t0 > 15 * 60 * 1000) throw new Error('La IA está tardando demasiado. Intenta de nuevo en unos minutos.');
        avance(Math.round((Date.now() - t0) / 1000));
        return sondear(trabajo, t0, avance);
      });
    }
    var nuevoTrabajo = function () { return 'IA-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); };

    // ---------- ✨ Súper modelo MF: formulario de estilo y 3 opciones para elegir ----------
    function formSuperModelo() {
      var S2 = IA.sm, caja = el('div', { class: 'ofA-ia', style: 'background:#fff' });
      caja.appendChild(el('b', { text: 'Cómo quieres a tu súper modelo MF' }));
      caja.appendChild(el('small', { class: 'ofA-ay', text: 'Describe el estilo en palabras sencillas (puedes dejar en blanco lo que quieras: la IA usa una modelo latina elegante). Se crean 3 opciones de una mujer que no existe; eliges una y queda como la modelo de tu marca. Cuenta 3 fotos del límite diario.' }));
      function campoSM(clave, titulo, ej) {
        var i = el('input', { type: 'text', maxlength: clave === 'rasgos' ? '200' : '80', value: S2[clave], placeholder: ej });
        i.addEventListener('input', function () { S2[clave] = i.value; });
        return el('label', { class: 'ofA-campo' }, [titulo, i]);
      }
      caja.appendChild(campoSM('piel', 'Tono de piel', 'Ej: trigueña, morena clara, blanca, afro…'));
      caja.appendChild(campoSM('cabello', 'Cabello', 'Ej: largo castaño ondulado, negro liso, rizado…'));
      caja.appendChild(campoSM('edad', 'Edad aproximada', 'Ej: 25 a 30 años'));
      caja.appendChild(campoSM('cuerpo', 'Contextura', 'Ej: alta y delgada, curvy, atlética…'));
      caja.appendChild(campoSM('rasgos', 'Otros detalles (opcional)', 'Ej: ojos color miel, pecas suaves, estilo elegante'));
      var b = el('button', { type: 'button', class: 'crear', text: S2.ocupado ? 'Creando…' : '✨ Crear 3 opciones' });
      b.disabled = S2.ocupado;
      b.addEventListener('click', function () {
        var trabajo = nuevoTrabajo(), t0 = Date.now();
        S2.ocupado = true; S2.opciones = null; S2.estado = 'Creando 3 opciones… tarda de 1 a 3 minutos. No cierres esta pantalla.'; pintarIA();
        A.api('outfit-ia-background', { method: 'POST', body: { modo: 'supermodelo', trabajo: trabajo, estilo: { piel: S2.piel, cabello: S2.cabello, edad: S2.edad, cuerpo: S2.cuerpo, rasgos: S2.rasgos } } })
          .then(function () { return sondear(trabajo, t0, function (s) { S2.estado = 'Creando… (' + s + ' s)'; var e = iaBox.querySelector('.sm-estado'); if (e) e.textContent = S2.estado; }); })
          .then(function (r) {
            S2.ocupado = false;
            if (r.error) { S2.estado = '✗ ' + r.error; return pintarIA(); }
            S2.opciones = r.fotos || [];
            S2.estado = S2.opciones.length ? '✓ Elige la que más te guste.' : '✗ No se pudo crear. Intenta de nuevo.';
            pintarIA();
          })
          .catch(function (e) { S2.ocupado = false; S2.estado = '✗ ' + (e.message || 'No se pudo crear'); pintarIA(); });
      });
      caja.appendChild(b);
      if (S2.estado) caja.appendChild(el('p', { class: 'estado sm-estado', role: 'status', text: S2.estado }));
      if (S2.opciones && S2.opciones.length) {
        caja.appendChild(el('div', { class: 'res' }, S2.opciones.map(function (f) {
          var elegir = el('button', { type: 'button', text: 'Elegir esta' });
          elegir.addEventListener('click', function () {
            A.api('fotos-ia-estado', { method: 'POST', body: { modelo: { url: f.url } } }).then(function (r) {
              IA.marca = r.modelo; S2.abierto = false; S2.opciones = null; S2.estado = '';
              ponerModelo(f.url); A.msg('Súper modelo MF guardada ✓ Se usa en todos tus looks.');
            }).catch(A.falla);
          });
          return el('figure', {}, [el('img', { src: f.url, alt: 'Opción de súper modelo' }), elegir]);
        })));
      }
      return caja;
    }

    // ---------- 🎬 Pasarela en video (Google Veo): anima la foto de frente del look ----------
    var vdBox = el('div', { class: 'ofA-ia' });
    function pintarVideo() {
      var V = IA.vd; vdBox.textContent = '';
      vdBox.appendChild(el('h4', { text: '🎬 Videos con IA' }));
      vdBox.appendChild(el('p', { class: 'ofA-ay', text: 'Dos tipos de video de 8 segundos: "Pasarela" (la modelo de la foto principal camina como en un desfile) o "Zapato en la mano" (estilo TikTok: unas manos con uñas cuidadas y anillos giran tu tacón para mostrarlo por todos lados). Tarda de 2 a 6 minutos. Revisa que el tacón se vea igual antes de usarlo. Máximo 6 videos al día.' }));
      var selT = el('select', {}, [el('option', { value: 'pasarela', text: '🚶‍♀️ Pasarela: la modelo camina con el look' }), el('option', { value: 'mano', text: '🤲 Zapato en la mano (estilo TikTok / Instagram)' })]);
      selT.value = V.tipo; selT.addEventListener('change', function () { V.tipo = selT.value; pintarVideo(); });
      vdBox.appendChild(el('label', { class: 'ofA-campo' }, ['Tipo de video', selT]));
      if (IA.hayVideo === false) {
        vdBox.appendChild(el('p', { class: 'ofA-aviso', text: 'Falta activar el video: crea una clave en Google AI Studio (aistudio.google.com → Get API key, con tu tarjeta) y guárdala en Netlify como variable GOOGLE_VEO_API_KEY. Los videos se cobran en Google (≈ US$0,64 a US$3,20 cada uno), no en créditos de Netlify.' }));
      }
      if (o.video) {
        var quitar = el('button', { type: 'button', class: 'claro', text: 'Quitar el video del look' });
        quitar.addEventListener('click', function () { delete o.video; marcar(); pintarVideo(); });
        vdBox.appendChild(el('div', {}, [el('small', { class: 'ofA-ay', text: '✓ Este look ya tiene video de pasarela:' }),
          el('video', { src: o.video, controls: true, muted: true, playsinline: true, style: 'width:min(100%,16rem);border-radius:.6rem;background:#000' }), quitar]));
      }
      var f0 = V.tipo === 'mano' ? { url: fotoTacon() } : o.fotos[0];
      if (V.tipo === 'mano' && !f0.url) { vdBox.appendChild(el('small', { class: 'ofA-ay', text: 'Elige el tacón y su color en el paso 1.' })); return; }
      if (!f0) { vdBox.appendChild(el('small', { class: 'ofA-ay', text: 'Primero crea o sube la foto de frente del look (paso 2).' })); return; }
      var selF = el('select', {}, [el('option', { value: 'vertical', text: 'Vertical 9:16 (Instagram, TikTok, celular)' }), el('option', { value: 'horizontal', text: 'Horizontal 16:9 (web, YouTube)' })]);
      selF.value = V.formato; selF.addEventListener('change', function () { V.formato = selF.value; });
      var selC = el('select', {}, [el('option', { value: 'rapida', text: 'Rápida (≈ US$0,96 por video)' }), el('option', { value: 'alta', text: 'Máxima calidad (≈ US$3,20 por video)' })]);
      selC.value = V.calidad; selC.addEventListener('change', function () { V.calidad = selC.value; });
      var crear = el('button', { type: 'button', class: 'crear', text: V.ocupado ? 'Creando video…' : (V.tipo === 'mano' ? '🎬 Crear video del zapato en la mano' : '🎬 Crear pasarela en video') });
      crear.disabled = V.ocupado || IA.hayVideo === false;
      crear.addEventListener('click', function () {
        if (!/\/storage\/v1\/object\/public\/productos\//.test(f0.url)) return A.msg(V.tipo === 'mano' ? 'La foto del tacón debe estar subida en la tienda' : 'La foto principal debe estar subida en la tienda (crea las fotos con IA o súbela de nuevo)', true);
        if (!window.confirm('Se creará 1 video de 8 segundos (' + (V.calidad === 'alta' ? '≈ US$3,20' : '≈ US$0,96') + ' en tu cuenta de Google). ¿Continuar?')) return;
        var trabajo = nuevoTrabajo(), t0 = Date.now();
        V.ocupado = true; V.url = ''; V.estado = 'Creando el video… tarda de 2 a 6 minutos. No cierres esta pantalla.'; pintarVideo();
        A.api('pasarela-ia-background', { method: 'POST', body: { trabajo: trabajo, tipo: V.tipo, foto: V.tipo === 'mano' ? '' : f0.url, tacon: fotoTacon(), formato: V.formato, calidad: V.calidad } })
          .then(function () { return sondear(trabajo, t0, function (s) { V.estado = 'Creando video… (' + s + ' s)'; var e = vdBox.querySelector('.estado'); if (e) e.textContent = V.estado; }); })
          .then(function (r) {
            V.ocupado = false;
            if (r.error) { V.estado = '✗ ' + r.error; return pintarVideo(); }
            V.url = r.videos && r.videos[0] ? r.videos[0].url : '';
            V.estado = V.url ? '✓ Listo. Míralo y, si el tacón se ve bien, toca "Usar este video en el look".' : '✗ No llegó el video. Intenta de nuevo.';
            pintarVideo();
          })
          .catch(function (e) { V.ocupado = false; V.estado = '✗ ' + (e.message || 'No se pudo crear'); pintarVideo(); });
      });
      vdBox.appendChild(el('div', { class: 'fila' }, [el('img', { class: 'min', src: f0.url, alt: 'Foto de partida' }), el('small', { class: 'ofA-ay', text: V.tipo === 'mano' ? 'Usa la foto de este tacón: la IA lo pone en las manos y lo anima (siempre vertical).' : 'Parte de la foto principal (★) del look.' })]));
      if (V.tipo !== 'mano') vdBox.appendChild(el('label', { class: 'ofA-campo' }, ['Formato', selF]));
      vdBox.appendChild(el('label', { class: 'ofA-campo' }, ['Calidad', selC]));
      vdBox.appendChild(crear);
      if (V.estado) vdBox.appendChild(el('p', { class: 'estado', role: 'status', text: V.estado }));
      if (V.url) {
        var usar = el('button', { type: 'button', text: 'Usar este video en el look' });
        usar.addEventListener('click', function () { o.video = V.url; V.url = ''; V.estado = '✓ Video puesto. Toca "Listo" y después "Guardar outfits". Para descargarlo y subirlo a Instagram o TikTok, mantén presionado el video.'; marcar(); pintarVideo(); });
        var desc = el('button', { type: 'button', class: 'claro', text: 'Descartar' });
        desc.addEventListener('click', function () { V.url = ''; V.estado = ''; pintarVideo(); });
        vdBox.appendChild(el('video', { src: V.url, controls: true, autoplay: true, muted: true, loop: true, playsinline: true, style: 'width:min(100%,16rem);border-radius:.6rem;background:#000' }));
        vdBox.appendChild(el('div', { class: 'fila' }, [usar, desc]));
      }
    }
    // Prendas ya enlazadas en el look: quedan marcadas
    o.piezas.forEach(function (x) { var pr = porId(x.producto); if (pr && esRopa(pr) && fotoDe(pr) && IA.prendas.indexOf(fotoDe(pr)) < 0) IA.prendas.push(fotoDe(pr)); });
    function fotoTacon() {
      var p = porId(o.producto); if (!p) return '';
      var c = (p.colores || []).filter(function (k) { return k.n === o.color; })[0];
      return (c && c.img) || fotoDe(p);
    }
    function pintarIA() {
      iaBox.textContent = '';
      iaBox.appendChild(el('h4', { text: '✨ Crear las fotos con IA con tu modelo' }));
      iaBox.appendChild(el('p', { class: 'ofA-ay', text: 'La IA le pone a tu modelo el tacón del paso 1, copiado exacto (mismo tacón, plataforma, tiras y color), y si eliges ropa la viste con ella. Fondo blanco de estudio, misma modelo en todas las fotos. Tarda de 2 a 6 minutos: primero limpia la prenda, la viste, le pone tu tacón y revisa cada foto. Revisas las fotos antes de usarlas.' }));
      // A) Modelo: la súper modelo MF (creada con IA) o la foto de una modelo real
      var subirM = el('button', { type: 'button', class: 'claro', text: IA.modelo ? 'Usar otra foto (modelo real)' : '+ Subir la foto de una modelo real' });
      subirM.addEventListener('click', function () { elegirFoto(function (url) { ponerModelo(url); }); });
      var crearSM = el('button', { type: 'button', class: 'crear', text: IA.sm.abierto ? 'Cerrar' : (IA.marca ? '✨ Crear otra súper modelo MF' : '✨ Crear la súper modelo MF con IA') });
      crearSM.addEventListener('click', function () { IA.sm.abierto = !IA.sm.abierto; pintarIA(); });
      var usarMarca = IA.marca && IA.marca.url !== IA.modelo ? el('button', { type: 'button', class: 'claro', text: 'Usar la súper modelo MF' }) : null;
      if (usarMarca) usarMarca.addEventListener('click', function () { ponerModelo(IA.marca.url); });
      var esMarca = IA.marca && IA.marca.url === IA.modelo;
      iaBox.appendChild(el('div', {}, [el('b', { text: 'A. La modelo' }),
        el('small', { class: 'ofA-ay', text: 'La súper modelo MF es una modelo virtual exclusiva de tu marca, creada con IA: siempre la misma cara y cuerpo en todos tus looks. También puedes usar la foto de una modelo real (cuerpo completo, de frente, con su permiso).' }),
        el('div', { class: 'fila' }, [IA.modelo ? el('img', { class: 'min', src: IA.modelo, alt: 'La modelo' }) : null,
          IA.modelo ? el('span', { text: esMarca ? '★ Súper modelo MF' : 'Modelo real' }) : null]),
        el('div', { class: 'fila' }, [crearSM, usarMarca, subirM])]));
      if (IA.sm.abierto) iaBox.appendChild(formSuperModelo());
      // B) Tacón
      var ft = fotoTacon(), pt = porId(o.producto);
      iaBox.appendChild(el('div', {}, [el('b', { text: 'B. El tacón' }),
        ft ? el('div', { class: 'fila' }, [el('img', { class: 'min', src: ft, alt: '' }), el('span', { text: (pt ? pt.nombre : '') + (o.color ? ' · ' + o.color : '') })])
          : el('small', { class: 'ofA-ay', text: 'Elige el tacón (y su color) en el paso 1, arriba.' })]));
      // C) Prendas
      var ropa = S.productos.filter(function (x) { return esRopa(x) && fotoDe(x); });
      var chips = el('div', { class: 'chips' });
      ropa.forEach(function (x) {
        var u = fotoDe(x), on = IA.prendas.indexOf(u) > -1;
        var ch = el('button', { type: 'button', class: 'chip', 'aria-pressed': on ? 'true' : 'false' }, [el('img', { src: u, alt: '' }), x.nombre]);
        ch.addEventListener('click', function () { var i = IA.prendas.indexOf(u); if (i > -1) IA.prendas.splice(i, 1); else if (IA.prendas.length + IA.extra.length < 3) IA.prendas.push(u); else A.msg('Máximo 3 prendas por foto'); pintarIA(); });
        chips.appendChild(ch);
      });
      IA.extra.forEach(function (u, i) {
        var ch = el('button', { type: 'button', class: 'chip', 'aria-pressed': 'true' }, [el('img', { src: u, alt: '' }), 'Quitar']);
        ch.addEventListener('click', function () { IA.extra.splice(i, 1); pintarIA(); });
        chips.appendChild(ch);
      });
      var subirP = el('button', { type: 'button', class: 'claro', text: '+ Subir foto de una prenda' });
      subirP.addEventListener('click', function () { if (IA.prendas.length + IA.extra.length >= 3) return A.msg('Máximo 3 prendas por foto'); elegirFoto(function (url) { IA.extra.push(url); pintarIA(); }); });
      iaBox.appendChild(el('div', {}, [el('b', { text: 'C. La ropa (opcional, hasta 3 prendas)' }),
        el('small', { class: 'ofA-ay', text: 'Si no eliges nada, tu modelo conserva la ropa de su foto y solo se le cambian los zapatos. ' + (ropa.length ? 'Toca tus prendas de la tienda para elegirlas, o sube una foto (en gancho, maniquí o plana, nítida y sin arrugas).' : 'Para vestirla con otra ropa, sube una foto de la prenda.') }),
        chips, subirP]));
      // D) Vistas
      var cL = el('input', { type: 'checkbox' }); cL.checked = IA.lado; cL.addEventListener('change', function () { IA.lado = cL.checked; });
      var cE = el('input', { type: 'checkbox' }); cE.checked = IA.espalda; cE.addEventListener('change', function () { IA.espalda = cE.checked; });
      var cP = el('input', { type: 'checkbox' }); cP.checked = IA.editorial; cP.addEventListener('change', function () { IA.editorial = cP.checked; });
      iaBox.appendChild(el('div', {}, [el('b', { text: 'D. Fotos a crear' }), el('div', { class: 'fila' }, [
        el('span', { text: '✓ Frente' }), el('label', { class: 'fila' }, [cL, 'De lado']), el('label', { class: 'fila' }, [cE, 'De espalda']), el('label', { class: 'fila' }, [cP, 'Pose editorial'])]),
        el('small', { class: 'ofA-ay', text: 'Cada foto cuenta para el límite de 40 fotos con IA al día.' })]));
      // Fotos ya creadas: si se cerró la pantalla o se bloqueó el celular, aquí se recuperan
      var verH = el('button', { type: 'button', class: 'claro', text: IA.verHist ? 'Ocultar fotos creadas antes' : '🕘 Ver fotos que ya creaste con IA' });
      verH.addEventListener('click', function () {
        IA.verHist = !IA.verHist;
        if (IA.verHist && !IA.hist) { IA.hist = 'cargando'; A.api('fotos-ia-estado?recientes=1').then(function (r) { IA.hist = (r && r.trabajos) || []; pintarIA(); }).catch(function (e) { IA.hist = null; A.falla(e); pintarIA(); }); }
        pintarIA();
      });
      var hBox = el('div', {}, [verH]);
      if (IA.verHist) {
        if (IA.hist === 'cargando') hBox.appendChild(el('p', { class: 'ofA-ay', text: 'Buscando…' }));
        else if (IA.hist && !IA.hist.length) hBox.appendChild(el('p', { class: 'ofA-ay', text: 'Todavía no hay fotos creadas.' }));
        else if (IA.hist) IA.hist.forEach(function (t) {
          var fecha = new Date(t.creado_en);
          var usarT = el('button', { type: 'button', class: 'claro', text: 'Revisar y usar estas' });
          usarT.addEventListener('click', function () { IA.res = t.fotos; IA.verHist = false; IA.estado = 'Fotos recuperadas. Revísalas y toca "Usar estas fotos en el look".'; pintarIA(); iaBox.scrollIntoView({ behavior: 'smooth', block: 'end' }); });
          hBox.appendChild(el('div', { style: 'margin:.6rem 0' }, [
            el('small', { class: 'ofA-ay', text: fecha.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }) + ' · ' + fecha.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' }) + ' · ' + t.fotos.length + ' fotos' }),
            el('div', { class: 'res' }, t.fotos.map(function (f) { return el('img', { src: f.url, alt: VISTA_NOM[f.vista] || '', loading: 'lazy' }); })),
            usarT
          ]));
        });
      }
      iaBox.appendChild(hBox);
      // Crear
      var crear = el('button', { type: 'button', class: 'crear', text: IA.ocupado ? 'Creando…' : '✨ Crear fotos' });
      crear.disabled = IA.ocupado;
      crear.addEventListener('click', crearIA);
      iaBox.appendChild(crear);
      if (IA.estado) iaBox.appendChild(el('p', { class: 'estado', role: 'status', text: IA.estado }));
      // Resultado
      if (IA.res && IA.res.length) {
        var res = el('div', { class: 'res' });
        IA.res.forEach(function (f) {
          res.appendChild(el('figure', {}, [el('img', { src: f.url, alt: VISTA_NOM[f.vista] || '' }), el('figcaption', { text: VISTA_NOM[f.vista] || f.vista }),
            f.revisada === false ? el('small', { class: 'ojo', text: '⚠ Revísala: ' + (f.nota || 'puede tener detalles distintos') }) : null]));
        });
        var usar = el('button', { type: 'button', text: 'Usar estas fotos en el look' });
        usar.addEventListener('click', usarIA);
        var otra = el('button', { type: 'button', class: 'claro', text: 'Descartar' });
        otra.addEventListener('click', function () { IA.res = null; IA.estado = ''; pintarIA(); });
        iaBox.appendChild(res);
        iaBox.appendChild(el('div', { class: 'fila' }, [usar, otra]));
      }
    }
    function crearIA() {
      var prendas = IA.prendas.concat(IA.extra);
      if (!IA.modelo) return A.msg('Primero elige la modelo (A): crea la súper modelo MF o sube una foto');
      if (!fotoTacon()) return A.msg('Elige el tacón en el paso 1 (B)');
      var trabajo = 'IA-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      var vistas = ['frente'].concat(IA.lado ? ['lado'] : [], IA.espalda ? ['espalda'] : [], IA.editorial ? ['editorial'] : []);
      IA.ocupado = true; IA.res = null; IA.estado = 'Creando ' + vistas.length + (vistas.length === 1 ? ' foto' : ' fotos') + '… puede tardar de 2 a 6 minutos. No cierres esta pantalla.';
      pintarIA();
      var t0 = Date.now();
      try { localStorage.setItem('mf_ia_pendiente', JSON.stringify({ trabajo: trabajo, t0: t0 })); } catch (e) {}
      esperar(A.api('outfit-ia-background', { method: 'POST', body: { trabajo: trabajo, modelo: IA.modelo, tacon: fotoTacon(), prendas: prendas, vistas: vistas } }), trabajo, t0);
    }
    // Espera el resultado. Si se cerró la pantalla a mitad, al volver a abrir el look sigue esperando (mf_ia_pendiente).
    function esperar(inicio, trabajo, t0) {
      inicio
        .then(function () {
          return (function mirar() {
            return new Promise(function (ok) { setTimeout(ok, 6000); }).then(function () { return A.api('fotos-ia-estado?trabajo=' + trabajo); }).then(function (r) {
              if (r && r.listo) return r;
              if (Date.now() - t0 > 15 * 60 * 1000) throw new Error('La IA está tardando demasiado. Intenta de nuevo en unos minutos.');
              IA.estado = 'Creando… (' + Math.round((Date.now() - t0) / 1000) + ' s)'; var e = iaBox.querySelector('.estado'); if (e) e.textContent = IA.estado;
              return mirar();
            });
          })();
        })
        .then(function (r) {
          IA.ocupado = false; IA.hist = null;
          try { localStorage.removeItem('mf_ia_pendiente'); } catch (e) {}
          if (r.error) { IA.estado = '✗ ' + r.error; pintarIA(); return A.msg(r.error, true); }
          IA.res = (r.fotos || []);
          var fallas = (r.errores || []).length;
          IA.estado = IA.res.length ? '✓ Listo. Revisa las fotos y toca "Usar estas fotos en el look".' + (fallas ? ' (' + fallas + ' no se pudo crear)' : '') : '✗ La IA no pudo crear las fotos. Prueba con otra foto de la modelo o de la prenda.';
          pintarIA();
        })
        .catch(function (e) { IA.ocupado = false; try { localStorage.removeItem('mf_ia_pendiente'); } catch (x) {} IA.estado = '✗ ' + (e.message || 'No se pudo crear'); pintarIA(); A.falla(e); });
    }
    function usarIA() {
      if (!IA.res || !IA.res.length) return;
      if (o.fotos.length && !window.confirm('¿Reemplazar las fotos actuales del look por las fotos creadas con IA?')) return;
      o.fotos = IA.res.slice(0, MAX_FOTOS).map(function (f) { return { e: VISTA_NOM[f.vista] || 'Frente', url: f.url }; });
      // Las prendas de la tienda que usaste quedan enlazadas en "Ropa que lleva puesta"; los puntos se marcan de nuevo en la foto nueva
      IA.prendas.forEach(function (u) {
        var pr = S.productos.filter(function (x) { return fotoDe(x) === u; })[0];
        if (pr && !o.piezas.some(function (x) { return x.producto === pr.id; }) && o.piezas.length < MAX_PIEZAS) o.piezas.push({ n: pr.nombre, producto: pr.id });
      });
      o.piezas.forEach(function (x) { x.pts = []; sync(x); }); fm = 0;
      IA.res = null; IA.estado = '✓ Fotos puestas en el look. Marca los puntos de las prendas (paso 3), toca "Listo" y después "Guardar outfits".';
      marcar(); fotos(); piezas(); pintarIA();
    }
    pintarIA();
    pintarVideo();
    (function () {
      var pend = null; try { pend = JSON.parse(localStorage.getItem('mf_ia_pendiente') || 'null'); } catch (e) {}
      if (!pend || !pend.trabajo) return;
      if (Date.now() - pend.t0 > 15 * 60 * 1000) { try { localStorage.removeItem('mf_ia_pendiente'); } catch (e) {} return; }
      IA.ocupado = true; IA.estado = 'Seguimos esperando las fotos que pediste… (' + Math.round((Date.now() - pend.t0) / 1000) + ' s)';
      pintarIA(); esperar(Promise.resolve(), pend.trabajo, pend.t0);
    })();

    // Prendas que complementan el look, cada una con su punto de compra sobre la foto principal
    var piezasBox = el('div', {});
    var mapaBox = el('div', {});
    var activa = -1; /* prenda que se está marcando en la foto */
    var fm = 0; /* foto del mapa en la que se marcan los puntos (0 = principal) */
    function piezas() {
      piezasBox.textContent = '';
      o.piezas.forEach(function (p, i) {
        var n = el('input', { type: 'text', maxlength: '60', value: p.n, placeholder: 'Ej: Blusa blanca, Jean recto, Bolso…', 'aria-label': 'Prenda ' + (i + 1) });
        n.addEventListener('input', function () { p.n = n.value; marcar(); });
        var mini = el('button', { type: 'button', class: 'ofA-mini', 'aria-label': p.foto ? 'Cambiar foto de la prenda' : 'Subir foto de la prenda' });
        if (p.foto) mini.appendChild(el('img', { src: p.foto, alt: '', style: 'width:100%;height:100%;object-fit:cover;border-radius:.4rem' })); else mini.textContent = '+ Foto';
        mini.addEventListener('click', function () { elegirFoto(function (url) { p.foto = url; piezas(); }); });
        var q = el('button', { type: 'button', class: 'claro', text: 'Quitar', 'aria-label': 'Quitar esta prenda' });
        q.addEventListener('click', function () { o.piezas.splice(i, 1); if (activa === i) activa = -1; marcar(); piezas(); });

        // A dónde lleva el punto: un producto de la tienda o un link
        var selD = selector({
          lista: function () { return S.productos.filter(esRopa).concat(S.productos.filter(function (x) { return !esRopa(x); })); },
          valor: function () { return p.producto && porId(p.producto) ? p.producto : ''; },
          elegir: function (id) { if (id) { p.producto = id; if (!n.value.trim()) { p.n = porId(id).nombre; n.value = p.n; } } else delete p.producto; dest(); marcar(); },
          foto: fotoDe, nombre: nomP, extra: function (x) { return [precioDe(x), esRopa(x) ? 'Ropa' : 'Calzado'].filter(Boolean).join(' · '); },
          ninguno: 'No está en la tienda (uso un link)', ningunoIc: '🔗', ningunoElegido: true, vacio: ''
        });
        var link = el('input', { type: 'url', inputmode: 'url', maxlength: '300', value: p.link || '', placeholder: 'https://wa.me/57…  o  https://instagram.com/…' });
        var precio = el('input', { type: 'number', inputmode: 'numeric', min: '0', step: '100', value: p.precio || '', placeholder: 'Ej: 89900' });
        var lLink = el('label', {}, ['Link de la prenda', el('small', { class: 'ofA-ay', text: 'A dónde va la clienta al tocar "Ver prenda": tu WhatsApp, Instagram u otra página. Debe empezar por https://' }), link]);
        var lPrecio = el('label', {}, ['Precio (opcional)', precio]);
        function dest() { var t = !!(p.producto && porId(p.producto)); lLink.hidden = t; lPrecio.hidden = t; }
        link.addEventListener('input', function () { var v = link.value.trim(); if (v) p.link = v; else delete p.link; marcar(); });
        precio.addEventListener('input', function () { var v = parseInt(precio.value, 10); if (v > 0) p.precio = v; else delete p.precio; marcar(); });
        dest();

        var tiene = !!ptsDe(p)[fm];
        var nomF = o.fotos[fm] ? o.fotos[fm].e : 'Frente';
        var con = o.fotos.map(function (f, k) { return ptsDe(p)[k] ? f.e : null; }).filter(Boolean);
        var pin = el('button', { type: 'button', class: 'ofA-marca' + (activa === i ? ' esperando' : ''), text: activa === i ? '👇 Ahora toca la prenda en la foto' : (tiene ? '📍 Cambiar el punto (' + nomF + ')' : '📍 Poner el punto en la foto ' + nomF) });
        pin.addEventListener('click', function () {
          if (!o.fotos.length) { A.msg('Primero sube la foto de frente de la modelo'); return; }
          activa = i; piezas(); mapaBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
        var quitarPin = el('button', { type: 'button', class: 'claro', text: 'Quitar punto de ' + nomF });
        quitarPin.hidden = !tiene;
        quitarPin.addEventListener('click', function () { ptsDe(p)[fm] = null; sync(p); marcar(); piezas(); });

        piezasBox.appendChild(el('div', { class: 'ofA-pz' }, [
          el('div', { class: 'ofA-pieza' }, [mini, n, q]),
          el('div', { class: 'ofA-dest' }, [
            el('div', { class: 'ofA-campo' }, ['¿A dónde lleva?', el('small', { class: 'ofA-ay', text: 'Si la prenda ya está creada como producto, elígela por su foto. Si no, deja "No está en la tienda" y pega un link.' }), selD.nodo]),
            lLink, lPrecio,
            el('div', { class: 'ofA-pin' }, [el('span', { class: 'ofA-num', text: String(i + 1) }), pin, quitarPin, con.length ? el('span', { class: 'ok', text: '✓ Punto en: ' + con.join(', ') }) : el('span', { class: 'ofA-ay', text: 'Sin punto: no sale el círculo en la foto' })])
          ])
        ]));
      });
      if (o.piezas.length < MAX_PIEZAS) {
        var add = el('button', { type: 'button', class: 'claro', text: o.piezas.length ? '+ Otra prenda que lleva puesta' : '+ Agregar una prenda que lleva puesta' });
        add.addEventListener('click', function () { o.piezas.push({ n: '' }); marcar(); piezas(); });
        piezasBox.appendChild(add);
      }
      mapa();
    }
    // La foto principal con los puntos numerados; al tocarla se pone el punto de la prenda activa
    function mapa() {
      mapaBox.textContent = '';
      if (fm >= o.fotos.length) fm = 0;
      var f = o.fotos[fm];
      if (!f) { mapaBox.appendChild(el('p', { class: 'ofA-ay', text: 'Sube la foto de frente (paso 2) para poder marcar las prendas.' })); return; }
      // Una pestaña por foto: cada foto (frente, lado, espalda…) lleva sus propios puntos
      if (o.fotos.length > 1) {
        mapaBox.appendChild(el('p', { class: 'ofA-ay', text: 'Elige en qué foto marcas los puntos. Cada foto tiene los suyos: en la tienda salen en la foto que la clienta esté viendo.' }));
        mapaBox.appendChild(el('div', { class: 'ofA-tabs' }, o.fotos.map(function (x, k) {
          var n = o.piezas.filter(function (p) { return ptsDe(p)[k]; }).length;
          var t = el('button', { type: 'button', class: 'ofA-tab', 'aria-pressed': k === fm ? 'true' : 'false' }, [el('img', { src: x.url, alt: '' }), el('span', { text: x.e + (n ? ' · ' + n + ' 📍' : '') })]);
          t.addEventListener('click', function () { fm = k; piezas(); });
          return t;
        })));
      }
      if (activa >= 0 && o.piezas[activa]) mapaBox.appendChild(el('p', { class: 'ofA-pide', text: 'Toca en la foto justo encima de: ' + (o.piezas[activa].n || 'prenda ' + (activa + 1)) }));
      var m = el('div', { class: 'ofA-mapa' + (activa >= 0 ? ' esperando' : ''), role: 'button', 'aria-label': 'Foto principal: toca para poner el punto de la prenda' }, [el('img', { src: f.url, alt: '' })]);
      o.piezas.forEach(function (p, i) {
        var q = ptsDe(p)[fm]; if (!q) return;
        m.appendChild(el('span', { class: 'ofA-num' + (i === activa ? ' act' : ''), text: String(i + 1), style: 'left:' + q[0] + '%;top:' + q[1] + '%' }));
      });
      m.addEventListener('click', function (e) {
        if (activa < 0 || !o.piezas[activa]) {
          // Sin prenda elegida: si hay una sola, se mueve su punto; si hay varias, va a la primera que no tenga punto
          var sin = o.piezas.map(function (x, k) { return ptsDe(x)[fm] ? -1 : k; }).filter(function (k) { return k > -1; });
          if (o.piezas.length === 1) activa = 0;
          else if (sin.length) activa = sin[0];
          else { A.msg('Toca "📍 Cambiar el punto de lugar" en la prenda que quieres mover y luego toca la foto'); return; }
        }
        var r = m.getBoundingClientRect();
        var p = o.piezas[activa];
        var a = ptsDe(p);
        while (a.length < fm) a.push(null);
        a[fm] = [Math.round(Math.min(100, Math.max(0, (e.clientX - r.left) / r.width * 100)) * 10) / 10,
          Math.round(Math.min(100, Math.max(0, (e.clientY - r.top) / r.height * 100)) * 10) / 10];
        sync(p);
        activa = -1; marcar(); piezas(); A.msg('Punto puesto ✓ Recuerda guardar.');
      });
      mapaBox.appendChild(m);
      mapaBox.appendChild(el('small', { class: 'ofA-ay', text: 'Estás marcando la foto: ' + f.e + (fm === 0 ? ' (★ principal)' : '') + '. Si cambias una foto por otra, revisa que los puntos sigan en su sitio.' }));
    }
    piezas();

    var listo = el('button', { type: 'button', text: 'Listo, volver a la lista' });
    listo.addEventListener('click', function () { S.editando = -1; pintar(); A.msg('Recuerda tocar "Guardar outfits" para publicar los cambios.'); window.scrollTo(0, 0); });

    var campo = function (titulo, ayuda, control) { return el('label', { class: 'ofA-campo' }, [titulo, el('small', { class: 'ofA-ay', text: ayuda }), control]); };
    // Igual que campo, pero en un div: dentro de un <label> cada toque en la cuadrícula activaría el botón
    var caja = function (titulo, ayuda, control) { return el('div', { class: 'ofA-campo' }, [titulo, el('small', { class: 'ofA-ay', text: ayuda }), control]); };
    sec.appendChild(el('div', { class: 'ofA-ed' }, [
      el('p', { class: 'nota', text: 'Estás editando UN look. Todo lo de esta pantalla es de un solo outfit: la misma modelo, con la misma ropa y el mismo tacón.' }),
      el('h3', { text: '1. Datos del look' }),
      campo('Nombre del look', 'Así se llama el outfit en la pasarela. Ej: "Jean y blusa blanca", "Vestido camel".', nombre),
      campo('Ocasión', 'Para qué plan sirve este outfit. Sale como etiqueta pequeña encima del nombre.', selO),
      caja('Tacón', 'El zapato de tu tienda que lleva puesto la modelo en estas fotos. Toca para ver todos con su foto.', selP.nodo),
      caja('Color del tacón', 'El color de ese zapato que se ve en las fotos.', selC.nodo),
      el('h3', { text: '2. Fotos de la modelo con este outfit' }),
      el('p', { class: 'ofA-ay', text: 'Solo fotos de ESTE outfit. Empieza por la de frente (será la foto principal de la pasarela) y, si tienes, agrega la de lado, espalda o un detalle. Máximo ' + MAX_FOTOS + '. Si tienes otra ropa, es otro look: vuelve a la lista y toca "+ Nuevo look".' }),
      avisoFotos,
      fotosBox,
      iaBox,
      vdBox,
      el('h3', { text: '3. Ropa que lleva puesta' }),
      el('p', { class: 'ofA-ay', text: 'Escribe cada prenda que se ve en las fotos (blusa, jean, vestido, bolso, cinturón…). Sale en "Para combinar". No pongas aquí otros looks. La foto de la prenda es opcional: toca "+ Foto" si quieres mostrarla.' }),
      el('p', { class: 'ofA-ay', text: 'Puntos de compra: elige la foto (frente, lado, espalda…), toca "📍 Poner el punto" y después toca la prenda sobre la foto. Repite en cada foto donde se vea la prenda. En la tienda sale un círculo palpitando ahí; al tocarlo, la clienta ve la prenda y el botón "Ver prenda".' }),
      piezasBox,
      mapaBox,
      el('h3', { text: '4. Mostrar en la tienda' }),
      el('div', { style: 'display:flex;align-items:center;gap:.5rem' }, [vis, el('span', { text: 'Mostrar este look en la tienda' })]),
      el('p', { class: 'ofA-ay', text: 'Si lo desmarcas, el look queda guardado aquí pero las clientas no lo ven.' }),
      el('div', { class: 'ofA-bar' }, [el('div', { class: 'ofA-bot' }, [listo, el('small', { class: 'ofA-ay', text: 'Vuelve a la lista. Después toca "Guardar outfits" para publicarlo.' })])]),
    ]));
  }
})();
