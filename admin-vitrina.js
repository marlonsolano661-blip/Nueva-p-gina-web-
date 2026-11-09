/* Panel · Vitrina: eliges qué zapatos salen en "La vitrina" del inicio y en qué orden.
   Se guarda en el servidor (recurso 'vitrina') y la tienda lo usa en menos de un minuto.
   Si la lista guardada queda vacía, la tienda usa la lista por defecto de DATA/recortes.js.
   Se carga desde admin-comunidad.js; si falla, el resto del panel funciona igual. */
(function () {
  'use strict';
  if (window.__mfAdminVitrina) return; window.__mfAdminVitrina = 1;
  var A = window.mfAdmin;
  var tabs = document.getElementById('tabs');
  if (!A || !tabs) return;
  var el = function () { return A.el.apply(null, arguments); };
  var MAX = 24;
  var S = { lista: [], productos: [], guardada: [], filtro: '' };

  var css = document.createElement('style');
  css.textContent = [
    '.vtA-fila{display:grid;grid-template-columns:2.2rem 3.6rem 1fr auto;align-items:center;gap:.6rem;padding:.55rem .6rem;border:1px solid #e3e3e3;border-radius:.7rem;margin:.45rem 0;background:#fff}',
    '.vtA-n{font-weight:600;color:#888;text-align:center}',
    '.vtA-im{width:3.6rem;height:3.6rem;object-fit:contain;background:#f6f6f6;border-radius:.4rem}',
    '.vtA-tx b{display:block;font-size:.95rem;line-height:1.25}.vtA-tx small{color:#777}',
    '.vtA-ac{display:flex;gap:.3rem}',
    '.vtA-ac button{min-width:2.4rem;padding:.45rem .55rem}',
    '.vtA-busca{width:100%;margin:.4rem 0 .6rem}',
    '.vtA-cat{display:grid;grid-template-columns:repeat(auto-fill,minmax(8.5rem,1fr));gap:.6rem;max-height:28rem;overflow:auto;padding:.2rem}',
    '.vtA-p{display:grid;gap:.35rem;padding:.5rem;border:1px solid #e3e3e3;border-radius:.7rem;background:#fff;text-align:left;cursor:pointer;font:inherit}',
    '.vtA-p img{width:100%;aspect-ratio:1/1;object-fit:contain;background:#f6f6f6;border-radius:.4rem}',
    '.vtA-p span{font-size:.82rem;line-height:1.25}',
    '.vtA-p[disabled]{opacity:.4;cursor:default}',
    '.vtA-bar{display:flex;gap:.6rem;flex-wrap:wrap;padding:.8rem 0 1.2rem}'
  ].join('\n');
  document.head.appendChild(css);

  // Botón en el inicio del panel ("Diseño de la tienda") y su sección
  var btn = el('button', { type: 'button', 'data-vt': '1' });
  btn.innerHTML = '<span class="ic">🛍️</span><span class="tx"><b>Vitrina</b><small>Zapatos de la vitrina del inicio y su orden</small></span><i class="fl" aria-hidden="true">›</i>';
  var ref = tabs.querySelector('button[data-t="inicio"]');
  if (ref && ref.parentNode) ref.parentNode.insertBefore(btn, ref.nextSibling); else tabs.appendChild(btn);
  var sec = el('section', { class: 'panel', id: 'p-vitrina' });
  var ult = document.querySelectorAll('.panel'); ult = ult[ult.length - 1];
  if (ult && ult.parentNode) ult.parentNode.insertBefore(sec, ult.nextSibling); else document.getElementById('app').appendChild(sec);

  function abrir() {
    tabs.hidden = true;
    var v = document.getElementById('volver'), t = document.getElementById('titulo'), ay = document.getElementById('ayuda');
    if (v) v.hidden = false; if (t) t.textContent = 'Vitrina'; if (ay) ay.hidden = true;
    document.querySelectorAll('.panel').forEach(function (p) { p.classList.toggle('on', p === sec); });
    A.msg(''); window.scrollTo(0, 0);
    sec.textContent = ''; sec.appendChild(el('p', { class: 'nota', text: 'Cargando…' }));
    cargar().catch(A.falla);
  }
  btn.addEventListener('click', abrir);

  function foto(p) { var L = Array.isArray(p.imagenes) && p.imagenes.length ? p.imagenes : (p.imagen ? [p.imagen] : []); var u = p.imagen || L[0] || ''; return /cdn\.shopify\.com/.test(u) ? u + (u.indexOf('?') < 0 ? '?' : '&') + 'width=200' : u; }
  function porId(id) { return S.productos.filter(function (p) { return String(p.id) === String(id); })[0] || null; }
  function sinTilde(t) { return String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  var money = function (n) { return '$' + Math.round(Number(n) || 0).toLocaleString('es-CO'); };

  function cargar() {
    return Promise.all([A.api('admin-tienda?recurso=vitrina'), A.api('admin-tienda?recurso=productos')]).then(function (r) {
      S.productos = (r[1].productos || []);
      S.guardada = (r[0].vitrina || []).slice();
      var base = S.guardada.length ? S.guardada : (Array.isArray(window.MF_VITRINA) ? window.MF_VITRINA : []);
      S.lista = base.filter(function (id) { return porId(id); });
      S.filtro = '';
      pintar();
    });
  }

  function mover(i, d) { var j = i + d; if (j < 0 || j >= S.lista.length) return; var x = S.lista[i]; S.lista[i] = S.lista[j]; S.lista[j] = x; pintar(); }
  function quitar(i) { S.lista.splice(i, 1); pintar(); }
  function agregar(id) { if (S.lista.indexOf(id) >= 0) return; if (S.lista.length >= MAX) { A.msg('Máximo ' + MAX + ' productos en la vitrina', true); return; } S.lista.push(id); pintar(); A.msg('Agregado al final de la vitrina'); }

  function fila(id, i) {
    var p = porId(id) || { id: id, nombre: id };
    var b = function (t, lbl, fn, dis) { var x = el('button', { type: 'button', class: 'claro', text: t, 'aria-label': lbl }); x.disabled = !!dis; x.addEventListener('click', fn); return x; };
    return el('div', { class: 'vtA-fila' }, [
      el('span', { class: 'vtA-n', text: String(i + 1) }),
      el('img', { class: 'vtA-im', src: foto(p), alt: '', loading: 'lazy' }),
      el('div', { class: 'vtA-tx' }, [el('b', { text: p.nombre || id }), el('small', { text: (p.precio ? money(p.precio) : '') + (p.visible === false ? ' · oculto en la tienda' : '') })]),
      el('div', { class: 'vtA-ac' }, [
        b('↑', 'Subir ' + (p.nombre || id), function () { mover(i, -1); }, i === 0),
        b('↓', 'Bajar ' + (p.nombre || id), function () { mover(i, 1); }, i === S.lista.length - 1),
        b('✕', 'Quitar ' + (p.nombre || id), function () { quitar(i); })
      ])
    ]);
  }

  function catalogo() {
    var q = sinTilde(S.filtro);
    var L = S.productos.filter(function (p) { return !q || sinTilde(p.nombre).indexOf(q) >= 0 || sinTilde(p.id).indexOf(q) >= 0; });
    var grid = el('div', { class: 'vtA-cat' });
    L.forEach(function (p) {
      var ya = S.lista.indexOf(String(p.id)) >= 0;
      var c = el('button', { type: 'button', class: 'vtA-p', title: ya ? 'Ya está en la vitrina' : 'Agregar a la vitrina' }, [
        el('img', { src: foto(p), alt: '', loading: 'lazy' }),
        el('span', { text: (ya ? '✓ ' : '+ ') + (p.nombre || p.id) })
      ]);
      c.disabled = ya;
      c.addEventListener('click', function () { agregar(String(p.id)); });
      grid.appendChild(c);
    });
    if (!L.length) grid.appendChild(el('p', { class: 'nota', text: 'Ningún producto coincide con la búsqueda.' }));
    return grid;
  }

  function pintar() {
    var y = window.scrollY;
    sec.textContent = '';
    sec.appendChild(el('p', { class: 'nota', text: 'Estos son los zapatos que salen en "La vitrina" del inicio, en este orden. Usa ↑ ↓ para ordenarlos, ✕ para quitarlos y agrega otros desde el catálogo. Funciona mejor con fotos de fondo blanco. Los cambios se ven en la tienda en menos de un minuto después de guardar.' }));
    if (!S.guardada.length) sec.appendChild(el('p', { class: 'nota', text: 'Todavía no has guardado una vitrina: abajo está la lista que usa la tienda por defecto. Guárdala para poder cambiarla desde aquí.' }));
    sec.appendChild(el('h3', { text: 'En la vitrina (' + S.lista.length + ')' }));
    if (!S.lista.length) sec.appendChild(el('p', { class: 'nota', text: 'La vitrina está vacía: si la guardas así, la tienda usará la lista por defecto.' }));
    S.lista.forEach(function (id, i) { sec.appendChild(fila(id, i)); });

    var guardar = el('button', { type: 'button', text: 'Guardar vitrina' });
    var deshacer = el('button', { type: 'button', class: 'claro', text: 'Deshacer cambios' });
    guardar.addEventListener('click', function () {
      guardar.disabled = true; A.msg('Guardando…');
      A.api('admin-tienda', { method: 'POST', body: { recurso: 'vitrina', vitrina: S.lista } })
        .then(function (r) { S.guardada = (r.vitrina || []).slice(); S.lista = S.guardada.slice(); pintar(); A.msg('Vitrina guardada ✓ Se verá en la tienda en menos de un minuto.'); })
        .catch(function (e) { guardar.disabled = false; A.falla(e); });
    });
    deshacer.addEventListener('click', function () { cargar().then(function () { A.msg('Cambios descartados'); }).catch(A.falla); });
    sec.appendChild(el('div', { class: 'vtA-bar' }, [guardar, deshacer]));

    sec.appendChild(el('h3', { text: 'Agregar desde el catálogo' }));
    var busca = el('input', { type: 'search', class: 'vtA-busca', placeholder: 'Buscar por nombre…', 'aria-label': 'Buscar producto', value: S.filtro });
    var cont = el('div', {}, [catalogo()]);
    busca.addEventListener('input', function () { S.filtro = busca.value; cont.textContent = ''; cont.appendChild(catalogo()); });
    sec.appendChild(busca);
    sec.appendChild(cont);
    window.scrollTo(0, y);
  }
})();
