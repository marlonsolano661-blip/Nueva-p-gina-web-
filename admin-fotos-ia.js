/* Botón "✨ Crear fotos con IA" en el formulario de producto del panel.
   Flujo: subir la foto principal → agregar los colores → tocar el botón. La IA (función fotos-ia-background, con un
   prompt fijo de la tienda) crea 1 o 2 fotos por cada color que todavía no tiene foto: la misma pose en ese color y,
   si se piden 2, también una vista lateral. Las fotos entran a la galería por el mismo camino que "+ Agregar fotos"
   y cada color queda con su foto. Nada se publica hasta que la persona revisa y toca "Guardar". Lo carga sugerir-color.js. */
(function () {
  'use strict';
  if (typeof document === 'undefined') return;
  var M = function () { return window.mfAdmin; };
  var espera = function (ms) { return new Promise(function (ok) { setTimeout(ok, ms); }); };

  function hastaQue(cond, maxMs, paso) {
    var t0 = Date.now();
    return new Promise(function (ok, mal) {
      (function mirar() {
        var v; try { v = cond(); } catch (e) { v = null; }
        if (v) return ok(v);
        if (Date.now() - t0 > maxMs) return mal(new Error('tiempo'));
        setTimeout(mirar, paso || 500);
      })();
    });
  }

  function filaColor(nombre) {
    var r = null;
    document.querySelectorAll('#f-cols .color').forEach(function (f) { if (f.querySelector('input.cnom').value.trim().toLowerCase() === nombre.toLowerCase()) r = f; });
    return r;
  }
  function coloresSinFoto() {
    var out = [];
    document.querySelectorAll('#f-cols .color').forEach(function (f) {
      var n = f.querySelector('input.cnom').value.trim(), h = f.querySelector('input.chex').value.trim(), fo = f.querySelector('select.cfoto');
      if (n && /^#[0-9a-fA-F]{6}$/.test(h) && !(fo && fo.value)) out.push({ n: n, h: h });
    });
    return out;
  }

  function crear(entrada, boton, cuantas) {
    var m = M();
    if (!m) return;
    var rejilla = entrada.parentNode.querySelector('.fotos');
    var principal = rejilla && rejilla.querySelector('.foto img');
    if (!principal) return m.msg('Primero sube la foto principal del producto', true);
    var colores = coloresSinFoto();
    if (!colores.length) return m.msg('Agrega abajo los colores que quieres (toca un color de la lista). La IA crea las fotos de los colores que todavía no tienen foto.', true);
    if (colores.length > 6) return m.msg('Máximo 6 colores por tanda: quita algunos o asígnales foto', true);
    var porColor = Number(cuantas.value) === 2 ? 2 : 1, total = colores.length * porColor;
    var antes = rejilla.querySelectorAll('.foto').length;
    if (antes + total > 30) return m.msg('Máximo 30 fotos por producto: quita algunas antes', true);
    if (!window.DataTransfer) return m.msg('Este navegador no permite agregar las fotos automáticamente. Actualízalo e intenta de nuevo.', true);
    if (!confirm('La IA creará ' + total + ' foto(s) a partir de la foto principal, para: ' + colores.map(function (k) { return k.n; }).join(', ') +
      '. Tarda unos ' + Math.max(1, Math.ceil(total / 3)) + ' minuto(s) y gasta créditos de Netlify. ¿Continuar?')) return;
    var trabajo = 'IA-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    boton.disabled = true; cuantas.disabled = true;
    var soltar = function () { boton.disabled = false; cuantas.disabled = false; };
    m.msg('La IA está creando ' + total + ' foto(s)… no cierres esta página.');
    m.api('fotos-ia-background', { method: 'POST', body: { src: principal.getAttribute('src'), trabajo: trabajo, colores: colores, porColor: porColor } })
      .then(function () {
        var n = 0;
        return (function revisar() {
          if (++n > 150) throw new Error('La IA tardó demasiado. Inténtalo de nuevo en unos minutos.');
          return espera(5000).then(function () { return m.api('fotos-ia-estado?trabajo=' + trabajo); })
            .then(function (d) { return d.listo ? d : revisar(); });
        })();
      })
      .then(function (d) {
        if (d.error) throw new Error(d.error);
        var fotos = d.fotos || [];
        if (!fotos.length) throw new Error('La IA no pudo crear las fotos esta vez. Inténtalo de nuevo.');
        m.msg('Agregando las fotos al producto…');
        return Promise.all(fotos.map(function (x, i) {
          return fetch(x.url).then(function (r) { if (!r.ok) throw new Error('No se pudo descargar una foto'); return r.blob(); })
            .then(function (b) { return new File([b], 'ia-' + i + '.' + (/png/.test(b.type) ? 'png' : 'jpg'), { type: b.type || 'image/png' }); });
        })).then(function (archivos) {
          var dt = new DataTransfer();
          archivos.forEach(function (a) { dt.items.add(a); });
          entrada.files = dt.files;
          entrada.dispatchEvent(new Event('change'));
          // La galería sube cada foto y la agrega al final, en el mismo orden
          return hastaQue(function () { return rejilla.querySelectorAll('.foto').length >= antes + archivos.length; }, 300000);
        }).then(function () {
          var urls = Array.prototype.map.call(rejilla.querySelectorAll('.foto img'), function (i) { return i.getAttribute('src'); }).slice(antes);
          fotos.forEach(function (x, i) {
            if (x.vista !== 1 || !urls[i]) return;
            var f = filaColor(x.color), fo = f && f.querySelector('select.cfoto');
            if (fo && !fo.value) { fo.value = urls[i]; fo.dispatchEvent(new Event('change', { bubbles: true })); }
          });
          soltar();
          var faltan = (d.errores || []).length;
          m.msg('Listas ' + fotos.length + ' foto(s) con IA ✓' + (faltan ? ' (' + faltan + ' no salieron)' : '') +
            ' Revísalas, quita las que no se parezcan al zapato real y toca "Guardar" abajo.', faltan > 0);
        });
      })
      .catch(function (e) { soltar(); m.falla(e); });
  }

  function poner() {
    var entrada = document.getElementById('f-file');
    if (!entrada || entrada.dataset.ia) return;
    entrada.dataset.ia = '1';
    var cuantas = document.createElement('select');
    cuantas.setAttribute('aria-label', 'Fotos por color');
    [['1', '1 foto por color'], ['2', '2 fotos por color (+ vista lateral)']].forEach(function (o) {
      var op = document.createElement('option'); op.value = o[0]; op.textContent = o[1]; cuantas.appendChild(op);
    });
    var boton = document.createElement('button');
    boton.type = 'button'; boton.className = 'claro'; boton.textContent = '✨ Crear fotos con IA';
    boton.addEventListener('click', function () { crear(entrada, boton, cuantas); });
    var caja = document.createElement('div');
    caja.className = 'ia-fotos';
    var nota = document.createElement('p');
    nota.className = 'nota';
    nota.textContent = 'Con IA: sube la foto principal, agrega los colores abajo y toca el botón. Crea las fotos de los colores que aún no tienen foto.';
    caja.appendChild(nota); caja.appendChild(cuantas); caja.appendChild(boton);
    entrada.parentNode.insertBefore(caja, entrada);
  }
  new MutationObserver(poner).observe(document.documentElement, { childList: true, subtree: true });
})();
