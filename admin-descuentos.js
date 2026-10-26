/* Descuentos: códigos de porcentaje sobre los productos (el envío siempre se cobra completo).
   Cada código: nombre, porcentaje, activo, "anunciar en la tienda", una foto opcional para el banner y una nota interna. Cada correo puede usar un código una sola vez.
   Todo se valida de nuevo en el servidor al guardar. */
(function () {
  'use strict';
  var A = window.mfAdmin, MAX = 50, L = [], sucio = false;
  var el = function () { return A.el.apply(null, arguments); };
  var root = function () { return document.getElementById('p-descuentos'); };

  function fila(d, i) {
    var cod = el('input', { type: 'text', maxlength: '20', 'aria-label': 'Código', placeholder: 'BIENVENIDA', autocapitalize: 'characters', autocomplete: 'off', spellcheck: 'false', value: d.codigo });
    var pct = el('input', { type: 'number', min: '1', max: '90', step: '1', inputmode: 'numeric', 'aria-label': 'Porcentaje de descuento', value: String(d.pct || '') });
    var nota = el('input', { type: 'text', maxlength: '80', 'aria-label': 'Nota interna', placeholder: 'Nota interna (opcional)', value: d.nota || '' });
    var act = el('input', { type: 'checkbox', 'aria-label': 'Activo' }); act.checked = d.activo !== false;
    var anu = el('input', { type: 'checkbox', 'aria-label': 'Anunciar en la tienda' }); anu.checked = d.anuncio === true;
    var del = el('button', { type: 'button', class: 'claro', text: 'Quitar' });
    var archivo = el('input', { type: 'file', accept: 'image/*', 'aria-label': 'Foto del banner', style: 'display:none' });
    var miniatura = d.foto ? el('img', { src: d.foto, alt: 'Foto del banner de ' + (d.codigo || 'este código'), style: 'width:100%;max-height:9rem;object-fit:cover;border-radius:.6rem' }) : el('p', { class: 'nota', text: 'Sin foto: el banner se verá sin imagen.' });
    var subir = el('button', { type: 'button', class: 'claro', text: d.foto ? 'Cambiar foto' : 'Agregar foto' });
    var quitarFoto = el('button', { type: 'button', class: 'claro', text: 'Quitar foto' });
    subir.addEventListener('click', function () { archivo.click(); });
    archivo.addEventListener('change', function () {
      var f = archivo.files && archivo.files[0]; if (!f) return;
      subir.disabled = true; A.msg('Subiendo foto…');
      A.subirFoto(f).then(function (u) { d.foto = u; sucio = true; pintar(); A.msg('Foto lista ✓ Recuerda tocar "Guardar descuentos".'); })
        .catch(function (e) { subir.disabled = false; A.falla(e); });
    });
    quitarFoto.addEventListener('click', function () { delete d.foto; sucio = true; pintar(); });
    cod.addEventListener('input', function () { cod.value = cod.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ''); d.codigo = cod.value; sucio = true; });
    pct.addEventListener('input', function () { d.pct = parseInt(pct.value, 10) || 0; sucio = true; });
    nota.addEventListener('input', function () { d.nota = nota.value; sucio = true; });
    act.addEventListener('change', function () { d.activo = act.checked; sucio = true; });
    anu.addEventListener('change', function () {
      // solo un código anunciado a la vez
      if (anu.checked) { L.forEach(function (x) { x.anuncio = false; }); }
      d.anuncio = anu.checked; sucio = true; pintar();
    });
    del.addEventListener('click', function () { L.splice(i, 1); sucio = true; pintar(); });
    var tarjeta = el('div', { class: 'ib-card', style: 'padding:.8rem;border:1px solid #ddd;border-radius:.6rem;margin:.6rem 0;display:grid;gap:.5rem' }, [
      el('label', {}, ['Código', cod]),
      el('label', {}, ['Descuento (%)', pct]),
      nota,
      el('label', { style: 'display:flex;gap:.5rem;align-items:center' }, [act, 'Activo (la clienta puede usarlo)']),
      el('label', { style: 'display:flex;gap:.5rem;align-items:center' }, [anu, 'Anunciarlo en el inicio de la tienda']),
      el('p', { class: 'nota', text: 'Foto del banner (opcional): se ve arriba del aviso que sale en la tienda.' }),
      miniatura,
      el('div', { style: 'display:flex;gap:.6rem;flex-wrap:wrap' }, d.foto ? [subir, quitarFoto] : [subir]),
      archivo,
      del,
    ]);
    return tarjeta;
  }

  function pintar() {
    var c = root(); c.textContent = '';
    c.appendChild(el('p', { class: 'nota', text: 'El descuento es un porcentaje sobre los productos; el envío se cobra completo. Cada correo puede usar un código una sola vez. Un código apagado deja de funcionar al instante.' }));
    if (!L.length) c.appendChild(el('p', { class: 'nota', text: 'Todavía no tienes códigos.' }));
    L.forEach(function (d, i) { c.appendChild(fila(d, i)); });
    var aviso = el('p', { class: 'nota', role: 'status', text: sucio ? 'Tienes cambios sin guardar' : '' });
    var nuevo = el('button', { type: 'button', class: 'claro', text: '+ Agregar código' });
    nuevo.disabled = L.length >= MAX;
    nuevo.addEventListener('click', function () { L.push({ codigo: '', pct: 10, activo: true, anuncio: false, nota: '' }); sucio = true; pintar(); });
    var guardar = el('button', { type: 'button', text: 'Guardar descuentos' });
    guardar.addEventListener('click', function () {
      for (var i = 0; i < L.length; i++) {
        if (!/^[A-Z0-9_-]{3,20}$/.test(L[i].codigo || '')) return A.msg('El código ' + (i + 1) + ' debe tener de 3 a 20 letras o números, sin espacios', 'mal');
        if (!(L[i].pct >= 1 && L[i].pct <= 90)) return A.msg('El porcentaje del código ' + L[i].codigo + ' debe estar entre 1 y 90', 'mal');
      }
      A.msg('Guardando…'); guardar.disabled = true;
      A.api('admin-tienda', { method: 'POST', body: { recurso: 'descuentos', descuentos: L } })
        .then(function (r) { L = r.descuentos || []; sucio = false; pintar(); A.msg('Descuentos guardados ✓'); })
        .catch(function (e) { A.falla(e); guardar.disabled = false; });
    });
    c.appendChild(el('div', { style: 'display:flex;gap:.6rem;flex-wrap:wrap;margin-top:.8rem' }, [nuevo, guardar]));
    c.appendChild(aviso);
  }

  function abrir() {
    return A.api('admin-tienda?recurso=descuentos').then(function (d) { L = (d.descuentos || []).map(function (x) { return Object.assign({}, x); }); sucio = false; pintar(); });
  }
  window.mfAdminDescuentos = { abrir: abrir };
})();
