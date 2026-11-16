/* Comunidad: fotos que las clientas envían con "Comparte tus MF".
   Aquí las revisas: Aprobar (se publica en Comunidad Marlon, puedes corregir nombre, texto e Instagram), Rechazar, o Quitar una ya publicada. */
(function () {
  'use strict';
  var A = window.mfAdmin, E = { pendientes: [], publicados: [] };
  var el = function () { return A.el.apply(null, arguments); };
  var root = function () { return document.getElementById('p-comunidad'); };

  function foto(url) { return el('img', { src: url, alt: 'Foto de la clienta', loading: 'lazy', style: 'width:100%;max-height:22rem;object-fit:cover;border-radius:.6rem;background:#eee' }); }

  function pendiente(p) {
    var n = el('input', { type: 'text', maxlength: '60', 'aria-label': 'Nombre', value: p.n });
    var t = el('textarea', { rows: '2', maxlength: '200', 'aria-label': 'Texto', placeholder: 'Texto (opcional)' }); t.value = p.t || '';
    var ig = el('input', { type: 'text', maxlength: '31', 'aria-label': 'Instagram', placeholder: '@usuario (opcional)', value: p.ig || '' });
    var ok = el('button', { type: 'button', text: 'Aprobar y publicar' });
    var no = el('button', { type: 'button', class: 'claro', text: 'Rechazar' });
    function enviar(accion, aviso) {
      ok.disabled = no.disabled = true; A.msg('Guardando…');
      A.api('admin-tienda', { method: 'POST', body: { recurso: 'look', accion: accion, id: p.id, n: n.value, t: t.value, ig: ig.value } })
        .then(function (r) { E = { pendientes: r.pendientes || [], publicados: r.publicados || [] }; pintar(); A.msg(aviso); })
        .catch(function (e) { A.falla(e); ok.disabled = no.disabled = false; });
    }
    ok.addEventListener('click', function () { enviar('aprobar', 'Foto publicada en Comunidad Marlon ✓'); });
    no.addEventListener('click', function () { if (window.confirm('¿Rechazar esta foto? No se publicará.')) enviar('rechazar', 'Foto rechazada'); });
    return el('div', { style: 'padding:.8rem;border:1px solid #ddd;border-radius:.6rem;margin:.6rem 0;display:grid;gap:.5rem' }, [
      foto(p.img),
      el('label', {}, ['Nombre', n]), el('label', {}, ['Texto', t]), el('label', {}, ['Instagram', ig]),
      el('p', { class: 'nota', text: 'Enviada: ' + (p.fecha ? new Date(p.fecha).toLocaleString('es-CO') : '') }),
      el('div', { style: 'display:flex;gap:.6rem;flex-wrap:wrap' }, [ok, no]),
    ]);
  }

  function publicado(p) {
    var q = el('button', { type: 'button', class: 'claro', text: 'Quitar de la tienda' });
    q.addEventListener('click', function () {
      if (!window.confirm('¿Quitar esta foto de Comunidad Marlon?')) return;
      q.disabled = true; A.msg('Guardando…');
      A.api('admin-tienda', { method: 'POST', body: { recurso: 'look', accion: 'quitar', id: p.id } })
        .then(function (r) { E = { pendientes: r.pendientes || [], publicados: r.publicados || [] }; pintar(); A.msg('Foto quitada ✓'); })
        .catch(function (e) { A.falla(e); q.disabled = false; });
    });
    return el('div', { style: 'padding:.8rem;border:1px solid #ddd;border-radius:.6rem;margin:.6rem 0;display:grid;gap:.4rem' }, [
      foto(p.img), el('strong', { text: p.n }), p.t ? el('span', { text: p.t }) : '', p.ig ? el('small', { text: p.ig }) : '', q,
    ]);
  }

  function pintar() {
    var c = root(); c.textContent = '';
    c.appendChild(el('p', { class: 'nota', text: 'Aquí llegan las fotos que las clientas comparten con "Comparte tus MF". Nada se publica sin tu aprobación.' }));
    c.appendChild(el('h3', { text: 'Por revisar (' + E.pendientes.length + ')' }));
    if (!E.pendientes.length) c.appendChild(el('p', { class: 'nota', text: 'No hay fotos pendientes.' }));
    E.pendientes.forEach(function (p) { c.appendChild(pendiente(p)); });
    c.appendChild(el('h3', { text: 'Publicadas (' + E.publicados.length + ')' }));
    if (!E.publicados.length) c.appendChild(el('p', { class: 'nota', text: 'Todavía no has publicado ninguna.' }));
    E.publicados.forEach(function (p) { c.appendChild(publicado(p)); });
  }

  window.mfAdminComunidad = {
    abrir: function () {
      return A.api('admin-tienda?recurso=looks').then(function (r) { E = { pendientes: r.pendientes || [], publicados: r.publicados || [] }; pintar(); });
    },
  };
})();
