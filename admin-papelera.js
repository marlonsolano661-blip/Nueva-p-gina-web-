/* Papelera: la versión anterior de todo lo que se cambia o elimina. Lo nuevo reemplaza a lo viejo; lo viejo queda aquí. */
(function () {
  'use strict';
  var A = function () { return window.mfAdmin; };
  var TIPOS = { producto: 'Producto', banners: 'Banners', contenido: 'Textos', vitrina: 'Vitrina', descuentos: 'Descuentos', envio: 'Envío', venta_wa: 'Pedido WhatsApp', gasto: 'Gasto' };
  var MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  function cuando(iso) {
    var d = new Date(new Date(iso).getTime() - 5 * 3600 * 1000); if (isNaN(d)) return '';
    var h = d.getUTCHours(), m = ('0' + d.getUTCMinutes()).slice(-2);
    return d.getUTCDate() + ' ' + MESES[d.getUTCMonth()] + ' ' + d.getUTCFullYear() + ', ' + (h % 12 || 12) + ':' + m + (h < 12 ? ' a. m.' : ' p. m.');
  }
  function pintar(lista) {
    var el = A().el, raiz = document.getElementById('p-papelera'); raiz.textContent = '';
    if (!lista.length) { raiz.appendChild(el('p', { class: 'pa-vacia', text: 'La papelera está vacía. Cuando cambies o elimines algo, la versión anterior aparecerá aquí.' })); return; }
    raiz.appendChild(el('div', { class: 'barra' }, [
      el('span', { class: 'nota', text: lista.length + (lista.length === 1 ? ' elemento' : ' elementos') + ' · lo más reciente arriba' }),
      el('button', { type: 'button', class: 'claro', text: 'Vaciar papelera', onclick: function () {
        if (confirm('¿Vaciar la papelera? Se borra para siempre y no se puede deshacer.')) accion('vaciar', '', 'Papelera vaciada ✓');
      } }),
    ]));
    var ul = el('div', { class: 'pa-lista' });
    lista.forEach(function (x) {
      ul.appendChild(el('div', { class: 'pa-it' }, [
        el('b', {}, [el('span', { class: 'pa-tag', text: TIPOS[x.tipo] || x.tipo }), x.nombre || x.ref || '']),
        el('span', { class: 'meta', text: (x.motivo === 'eliminado' ? 'Eliminado' : 'Reemplazado') + ' · ' + cuando(x.fecha) }),
        el('div', { class: 'acc' }, [
          el('button', { type: 'button', text: 'Restaurar', onclick: function () {
            accion('restaurar', x.id, 'Restaurado ✓ Lo que estaba activo pasó a la papelera', true);
          } }),
          el('button', { type: 'button', class: 'peligro', text: 'Eliminar', onclick: function () {
            if (confirm('¿Eliminar para siempre «' + (x.nombre || x.ref) + '»?')) accion('eliminar', x.id, 'Eliminado definitivamente ✓');
          } }),
        ]),
      ]));
    });
    raiz.appendChild(ul);
  }
  function accion(a, id, ok) {
    A().msg('Guardando…');
    return A().api('admin-tienda', { method: 'POST', body: { recurso: 'papelera', accion: a, id: id } })
      .then(function (d) { A().msg(ok); pintar(d.papelera || []); }).catch(A().falla);
  }
  function abrir() { return A().api('admin-tienda?recurso=papelera').then(function (d) { pintar(d.papelera || []); }); }
  window.mfAdminPapelera = { abrir: abrir };
})();
