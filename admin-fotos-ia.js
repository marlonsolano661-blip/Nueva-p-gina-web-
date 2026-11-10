/* Botón "✨ Crear fotos con IA" en el formulario de producto del panel.
   Flujo en un solo recuadro: 1) subir la foto principal, 2) tocar los colores deseados, 3) "Crear fotos".
   La IA (función fotos-ia-background, con un prompt fijo de la tienda) crea 1, 2 o 3 fotos por color: como la foto original,
   de lado y el par junto sin piernas en fondo blanco; o solo el par junto. Las fotos entran a la galería por el mismo camino que "+ Agregar fotos",
   y cada color se agrega solo a los colores del producto con su foto. Nada se publica hasta que la persona revisa y toca "Guardar". Lo carga sugerir-color.js.
   También: botón "Nombre y descripción con IA" (función textos-ia) que llena esos dos campos a partir de la foto principal. */
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

  // Los mismos nombres y códigos de la paleta del panel, para que el color quede igual en la tienda
  var COLORES = [['Negro', '#111111'], ['Blanco', '#FFFFFF'], ['Nude', '#E0B89E'], ['Beige', '#D8C3A5'], ['Camel', '#B98550'],
    ['Café', '#5C3A21'], ['Dorado', '#C9A227'], ['Plata', '#C0C0C0'], ['Rojo', '#C00000'], ['Vinotinto', '#6D1A2B'],
    ['Rosado', '#F4A6B8'], ['Fucsia', '#D81B7A'], ['Azul', '#1F4FA3'], ['Verde', '#2E7D32']];

  function filaColor(nombre) {
    var r = null;
    document.querySelectorAll('#f-cols .color').forEach(function (f) { if (f.querySelector('input.cnom').value.trim().toLowerCase() === nombre.toLowerCase()) r = f; });
    return r;
  }
  // Agrega el color a "Colores" del producto (si no estaba) y le pone su foto (si no tenía)
  function ponerColor(nombre, url) {
    var f = filaColor(nombre);
    if (!f) {
      var b = document.querySelector('.paleta:not(.ia-paleta) button.pal[data-n="' + nombre + '"]');
      if (b) b.click();
      f = filaColor(nombre);
    }
    var fo = f && f.querySelector('select.cfoto');
    if (fo && !fo.value) { fo.value = url; fo.dispatchEvent(new Event('change', { bubbles: true })); }
  }

  function crear(entrada, boton, cuantas, chips) {
    var m = M();
    if (!m) return;
    var rejilla = entrada.parentNode.querySelector('.fotos');
    var principal = rejilla && rejilla.querySelector('.foto img');
    if (!principal) return m.msg('Primero sube la foto del zapato con "+ Agregar fotos" (paso 1)', true);
    var colores = Array.prototype.map.call(chips.querySelectorAll('button.pal.on'), function (b) { return { n: b.getAttribute('data-n'), h: b.getAttribute('data-h') }; });
    if (!colores.length) return m.msg('Toca uno o más colores (paso 2) y luego "Crear fotos"', true);
    if (colores.length > 6) return m.msg('Máximo 6 colores por vez', true);
    var soloPar = cuantas.value === 'par', porColor = soloPar ? 1 : (Number(cuantas.value) === 3 ? 3 : Number(cuantas.value) === 2 ? 2 : 1), total = colores.length * porColor;
    var antes = rejilla.querySelectorAll('.foto').length;
    if (antes + total > 30) return m.msg('Máximo 30 fotos por producto: quita algunas antes', true);
    if (!window.DataTransfer) return m.msg('Este navegador no permite agregar las fotos automáticamente. Actualízalo e intenta de nuevo.', true);
    if (!confirm('La IA creará ' + total + ' foto(s) a partir de la foto principal, para: ' + colores.map(function (k) { return k.n; }).join(', ') +
      '. Tarda unos ' + Math.max(1, Math.ceil(total / 3)) + ' minuto(s) y gasta créditos de Netlify. ¿Continuar?')) return;
    var trabajo = 'IA-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    boton.disabled = true; cuantas.disabled = true;
    var soltar = function () { boton.disabled = false; cuantas.disabled = false; };
    var quitarMarcas = function () { chips.querySelectorAll('button.pal.on').forEach(function (b) { b.classList.remove('on'); }); };
    m.msg('La IA está creando ' + total + ' foto(s)… no cierres esta página.');
    m.api('fotos-ia-background', { method: 'POST', body: { src: principal.getAttribute('src'), trabajo: trabajo, colores: colores, porColor: porColor, soloPar: soloPar } })
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
          // A cada color se le asigna su primera foto creada (la de la misma pose, o el par si solo se pidió el par)
          var hecho = {};
          fotos.forEach(function (x, i) { if (!hecho[x.color] && urls[i]) { hecho[x.color] = 1; ponerColor(x.color, urls[i]); } });
          soltar(); quitarMarcas();
          var faltan = (d.errores || []).length, dudosas = fotos.filter(function (x) { return x.revisada === false; }).length;
          m.msg('Listas ' + fotos.length + ' foto(s) con IA ✓' + (faltan ? ' (' + faltan + ' no salieron)' : '') +
            (dudosas ? ' Ojo: ' + dudosas + ' no pasaron la revisión de la IA, míralas con cuidado.' : '') +
            ' Ya quedaron en las fotos y en los colores. Revísalas, quita las que no se parezcan al zapato real y toca "Guardar" abajo.', faltan > 0 || dudosas > 0);
        });
      })
      .catch(function (e) { soltar(); m.falla(e); });
  }

  // Nombre y descripción con IA: mira la foto principal y llena los campos; la persona revisa antes de guardar.
  function textos(entrada, btn) {
    var m = M();
    if (!m) return;
    var principal = entrada.parentNode.querySelector('.fotos .foto img');
    if (!principal) return m.msg('Primero sube la foto del zapato con "+ Agregar fotos"', true);
    var nom = document.getElementById('f-nombre'), des = document.getElementById('f-desc');
    if (!nom || !des) return;
    if ((nom.value.trim() || des.value.trim()) && !confirm('Ya hay nombre o descripción. ¿Reemplazarlos por los que escriba la IA?')) return;
    btn.disabled = true; m.msg('La IA está escribiendo el nombre y la descripción…');
    m.api('textos-ia', { method: 'POST', body: { src: principal.getAttribute('src') } })
      .then(function (d) {
        nom.value = d.nombre || nom.value; des.value = d.descripcion || des.value;
        nom.dispatchEvent(new Event('input', { bubbles: true })); des.dispatchEvent(new Event('input', { bubbles: true }));
        btn.disabled = false;
        nom.scrollIntoView({ behavior: 'smooth', block: 'center' });
        m.msg('Listo ✓ Revisa el nombre, la descripción y sobre todo la ALTURA (la IA la calcula a ojo). Luego toca "Guardar".');
      })
      .catch(function (e) { btn.disabled = false; m.falla(e); });
  }

  function poner() {
    var entrada = document.getElementById('f-file');
    if (!entrada || entrada.dataset.ia) return;
    entrada.dataset.ia = '1';
    var nuevo = function (tag, cls, txt) { var n = document.createElement(tag); if (cls) n.className = cls; if (txt) n.textContent = txt; return n; };
    var caja = nuevo('div', 'ia-fotos');
    caja.style.cssText = 'border:1.5px solid var(--g2,#ddd);border-radius:1rem;padding:.9rem;margin:.8rem 0;';
    caja.appendChild(nuevo('b', '', '✨ Crear fotos con IA'));
    caja.appendChild(nuevo('p', 'nota', '1. Sube arriba la foto del zapato con "+ Agregar fotos".'));
    var bt = nuevo('button', 'claro', '✨ Nombre y descripción con IA');
    bt.type = 'button'; bt.style.margin = '.2rem 0 .6rem';
    bt.addEventListener('click', function () { textos(entrada, bt); });
    caja.appendChild(bt);
    caja.appendChild(nuevo('p', 'nota', '2. Toca los colores en que lo quieres:'));
    var chips = nuevo('div', 'paleta ia-paleta');
    COLORES.forEach(function (k) {
      var b = nuevo('button', 'pal');
      b.type = 'button'; b.setAttribute('data-n', k[0]); b.setAttribute('data-h', k[1]);
      var i = nuevo('i'); i.style.background = k[1];
      b.appendChild(i); b.appendChild(nuevo('span', '', k[0]));
      b.addEventListener('click', function () { b.classList.toggle('on'); });
      chips.appendChild(b);
    });
    caja.appendChild(chips);
    caja.appendChild(nuevo('p', 'nota', '3. ¿Cuántas fotos por color?'));
    var cuantas = nuevo('select');
    cuantas.setAttribute('aria-label', 'Fotos por color');
    [['1', '1 foto por color'], ['2', '2 fotos por color (una de lado)'], ['3', '3 fotos por color (de lado y el par junto)'], ['par', 'Solo el par junto, sin piernas (fondo blanco)']].forEach(function (o) {
      var op = nuevo('option', '', o[1]); op.value = o[0]; cuantas.appendChild(op);
    });
    caja.appendChild(cuantas);
    var boton = nuevo('button', '', '✨ Crear fotos');
    boton.type = 'button'; boton.style.marginTop = '.7rem';
    boton.addEventListener('click', function () { crear(entrada, boton, cuantas, chips); });
    caja.appendChild(boton);
    entrada.parentNode.appendChild(caja); // debajo de las fotos del producto
  }
  new MutationObserver(poner).observe(document.documentElement, { childList: true, subtree: true });
})();
