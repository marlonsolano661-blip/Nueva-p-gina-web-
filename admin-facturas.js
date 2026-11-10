/* Facturas: crea un comprobante de venta en PDF desde el panel y lo envía a la clienta por WhatsApp.
   Todo ocurre en este navegador: no toca pedidos, pagos ni la base de datos. Los productos y la tarifa de envío se leen del panel.
   IMPORTANTE: es un comprobante interno. NO es una factura electrónica de venta validada por la DIAN (eso exige un proveedor tecnológico autorizado);
   por eso el PDF lo dice en el pie. El historial y la numeración se guardan solo en este dispositivo. */
(function () {
  'use strict';
  var A = window.mfAdmin;
  var el = function () { return A.el.apply(null, arguments); };
  var root = function () { return document.getElementById('p-facturas'); };
  var KE = 'mf_fact_emisor', KN = 'mf_fact_n', KH = 'mf_fact_hist';
  var TALLAS = ['34', '35', '36', '37', '38', '39', '40'];
  var PAGOS = ['Transferencia', 'Nequi', 'Daviplata', 'Bancolombia', 'Efectivo', 'Otro'];
  var PRODS = [], TARIFA = 0, ULTIMA = null;
  var F = nueva();

  function nueva() { return { cliente: { nombre: '', doc: '', tel: '', email: '', ciudad: '', dir: '' }, items: [], desc: 0, envio: TARIFA, pago: 'Transferencia', estado: 'Pagado', nota: '' }; }
  function leer(k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
  function guardar(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* sin espacio: se ignora */ } }
  function emisor() { return Object.assign({ nombre: 'Marlon Footwear', nit: '', tel: '311 575 2334', ciudad: 'Cúcuta, Norte de Santander', web: 'mfcol.com' }, leer(KE, {})); }
  var peso = function (n) { return '$' + Math.round(Number(n) || 0).toLocaleString('es-CO'); };
  function siguiente() { var n = parseInt(leer(KN, 1), 10) || 1; return 'MF-' + String(n).padStart(4, '0'); }
  function subtotal() { return F.items.reduce(function (t, i) { return t + (+i.cant || 0) * (+i.precio || 0); }, 0); }
  function descuento() {
    if (+F.descPesos > 0) return Math.min(subtotal(), Math.round(+F.descPesos)); // pedidos de WhatsApp: el descuento viene en pesos
    return Math.round(subtotal() * (Math.min(90, Math.max(0, +F.desc || 0)) / 100));
  }
  function etqDesc(f) { return +f.descPesos > 0 ? 'Descuento' : 'Descuento (' + f.desc + '%)'; }
  var GAR_MESES = 3;
  function garHasta(f) {
    var d = new Date(f && f.creado ? f.creado : Date.now()), dia = d.getDate();
    d.setMonth(d.getMonth() + GAR_MESES); if (d.getDate() < dia) d.setDate(0); // 30 nov + 3 meses = 28/29 feb
    return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });
  }
  function garTexto(f) {
    return 'Este par tiene garantía de ' + GAR_MESES + ' meses por defectos de fabricación, contados desde la fecha de compra (válida hasta el ' + garHasta(f) + '). ' +
      'No cubre el desgaste normal por uso, el mal uso, la humedad, el almacenamiento inadecuado ni los daños causados después de la entrega. Para hacerla válida presenta este comprobante.';
  }
  function total() { return Math.max(0, subtotal() - descuento() + (+F.envio || 0)); }

  /* ---------- PDF sin librerías (A4, Helvetica) ---------- */
  var LATIN = { '–': '-', '—': '-', '‘': "'", '’': "'", '“': '"', '”': '"', '…': '...', '•': '-', '×': 'x' };
  function lat(s) {
    return String(s == null ? '' : s).replace(/[\r\n\t]+/g, ' ').replace(/[^\x20-\x7E -ÿ]/g, function (c) { return LATIN[c] || '?'; });
  }
  function esc(s) { return lat(s).replace(/([\\()])/g, '\\$1'); }
  var cv = null;
  function ancho(t, size, bold) {
    cv = cv || document.createElement('canvas').getContext('2d');
    cv.font = (bold ? 'bold ' : '') + '100px Helvetica, Arial, "Liberation Sans", sans-serif';
    return cv.measureText(lat(t)).width * size / 100;
  }
  function envolver(t, max, size, bold) {
    var pal = lat(t).split(' '), lin = [], act = '';
    pal.forEach(function (p) {
      var prueba = act ? act + ' ' + p : p;
      if (ancho(prueba, size, bold) <= max || !act) act = prueba; else { lin.push(act); act = p; }
    });
    if (act) lin.push(act);
    return lin.length ? lin : [''];
  }

  function crearPDF(f, em) {
    var W = 595, H = 842, M = 48, pags = [], cs = null, y = 0;
    function pag() { cs = []; pags.push(cs); y = H - M; }
    function col(c) { return (c || [0, 0, 0]).map(function (x) { return (x / 255).toFixed(3); }).join(' '); }
    function txt(t, x, yy, size, o) {
      o = o || {}; var w = ancho(t, size, o.b), xx = o.der ? x - w : (o.cen ? x - w / 2 : x);
      cs.push('BT /' + (o.b ? 'F2' : 'F1') + ' ' + size + ' Tf ' + col(o.c) + ' rg ' + xx.toFixed(2) + ' ' + yy.toFixed(2) + ' Td (' + esc(t) + ') Tj ET');
    }
    function linea(x1, y1, x2, y2, c, g) { cs.push((g || .6) + ' w ' + col(c || [200, 200, 196]).replace(/ /g, ' ') + ' RG ' + x1 + ' ' + y1 + ' m ' + x2 + ' ' + y2 + ' l S'); }
    function logo(x0, ytop, k) {
      var P = [[246, 260], [426, 548], [606, 260], [607, 756], [570, 756], [570, 388], [426, 617], [283, 388], [283, 756], [246, 756]];
      var X = function (px) { return (x0 + (px - 246) * k).toFixed(2); }, Y = function (py) { return (ytop - (py - 260) * k).toFixed(2); };
      var d = P.map(function (p, i) { return X(p[0]) + ' ' + Y(p[1]) + (i ? ' l' : ' m'); }).join(' ') + ' h f';
      var r = function (rx, ry, rw, rh) { return X(rx) + ' ' + Y(ry + rh) + ' ' + (rw * k).toFixed(2) + ' ' + (rh * k).toFixed(2) + ' re f'; };
      cs.push('0 0 0 rg ' + d + ' ' + r(606, 323, 209, 37) + ' ' + r(606, 521, 161, 37));
    }
    var GR = [110, 110, 105], CH = [160, 130, 80];
    pag(); logo(M, y, 0.075);
    txt('COMPROBANTE DE VENTA', W - M, y - 14, 15, { b: 1, der: 1 });
    txt('N.º ' + f.numero, W - M, y - 32, 11, { der: 1, c: CH });
    txt(f.fecha, W - M, y - 47, 9.5, { der: 1, c: GR });
    y -= 70;
    txt(em.nombre, M, y, 12, { b: 1 }); y -= 14;
    [em.nit ? 'NIT/CC ' + em.nit : '', em.ciudad, 'WhatsApp ' + em.tel + (em.web ? '  |  ' + em.web : '')].forEach(function (l) { if (l) { txt(l, M, y, 9.5, { c: GR }); y -= 12; } });
    y -= 10; linea(M, y, W - M, y); y -= 20;
    txt('CLIENTE', M, y, 8.5, { b: 1, c: CH }); y -= 14;
    var c = f.cliente;
    txt(c.nombre || '-', M, y, 11, { b: 1 }); y -= 14;
    [c.doc ? 'CC/NIT ' + c.doc : '', c.tel ? 'Tel. ' + c.tel : '', c.email, [c.ciudad, c.dir].filter(Boolean).join(' - ')].forEach(function (l) {
      if (l) envolver(l, W - 2 * M, 9.5).forEach(function (s) { txt(s, M, y, 9.5, { c: GR }); y -= 12; });
    });
    y -= 12;
    var cD = M, cT = 330, cC = 385, cU = 465, cTot = W - M;
    function cab() {
      cs.push(col([244, 243, 240]) + ' rg ' + M + ' ' + (y - 6) + ' ' + (W - 2 * M) + ' 20 re f');
      txt('DESCRIPCION', cD + 6, y, 8, { b: 1 }); txt('TALLA', cT, y, 8, { b: 1, cen: 1 }); txt('CANT.', cC, y, 8, { b: 1, cen: 1 });
      txt('VALOR UNIT.', cU, y, 8, { b: 1, der: 1 }); txt('TOTAL', cTot - 6, y, 8, { b: 1, der: 1 }); y -= 24;
    }
    cab();
    f.items.forEach(function (i) {
      var nom = envolver(i.nombre, cT - cD - 30, 10), alto = nom.length * 12 + 8;
      if (y - alto < 150) { pag(); cab(); }
      nom.forEach(function (s, k) { txt(s, cD + 6, y - k * 12, 10); });
      txt(i.talla || '-', cT, y, 10, { cen: 1 }); txt(String(i.cant), cC, y, 10, { cen: 1 });
      txt(peso(i.precio), cU, y, 10, { der: 1 }); txt(peso(i.cant * i.precio), cTot - 6, y, 10, { der: 1 });
      y -= alto - 2; linea(M, y + 4, W - M, y + 4, [232, 232, 228], .5); y -= 8;
    });
    if (y < 190) { pag(); }
    y -= 6;
    var xr = cTot - 6, xl = 380;
    function fila(a, b, o) { txt(a, xl, y, o && o.g ? 12 : 10, { b: o && o.g, c: o && o.g ? null : GR }); txt(b, xr, y, o && o.g ? 12 : 10, { der: 1, b: o && o.g }); y -= o && o.g ? 18 : 15; }
    fila('Subtotal', peso(f.subtotal));
    if (f.descuento > 0) fila(etqDesc(f), '-' + peso(f.descuento));
    fila('Envio', f.envio > 0 ? peso(f.envio) : 'Sin costo');
    linea(xl, y + 8, W - M, y + 8, [20, 20, 20], .8); y -= 4;
    fila('TOTAL', peso(f.total), { g: 1 });
    y -= 8;
    txt('Pago: ' + f.pago + '  |  Estado: ' + f.estado, M, y, 10, { b: 1 }); y -= 14;
    if (f.nota) envolver('Nota: ' + f.nota, W - 2 * M, 9.5).forEach(function (s) { txt(s, M, y, 9.5, { c: GR }); y -= 12; });
    var gl = envolver(garTexto(f), W - 2 * M - 24, 9);
    if (y - (gl.length * 11.5 + 40) < 100) { pag(); }
    y -= 14;
    var gAlto = gl.length * 11.5 + 30;
    cs.push(col([248, 246, 241]) + ' rg ' + M + ' ' + (y - gAlto + 12) + ' ' + (W - 2 * M) + ' ' + gAlto + ' re f');
    txt('GARANTIA DE ' + GAR_MESES + ' MESES', M + 12, y - 4, 9, { b: 1, c: CH }); y -= 18;
    gl.forEach(function (s) { txt(s, M + 12, y - 4, 9, { c: [60, 60, 56] }); y -= 11.5; });
    txt('Gracias por tu compra en ' + em.nombre + '.', W / 2, 78, 10.5, { cen: 1, b: 1 });

    var objs = [], add = function (s) { objs.push(s); return objs.length; };
    add('<< /Type /Catalog /Pages 2 0 R >>'); add(''); // 2 = Pages (se rellena)
    var f1 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
    var f2 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
    var kids = [];
    pags.forEach(function (p) {
      var cont = p.join('\n'), cid = add('<< /Length ' + cont.length + ' >>\nstream\n' + cont + '\nendstream');
      kids.push(add('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + W + ' ' + H + '] /Resources << /Font << /F1 ' + f1 + ' 0 R /F2 ' + f2 + ' 0 R >> >> /Contents ' + cid + ' 0 R >>'));
    });
    objs[1] = '<< /Type /Pages /Kids [' + kids.map(function (k) { return k + ' 0 R'; }).join(' ') + '] /Count ' + kids.length + ' >>';
    var out = '%PDF-1.4\n', pos = [];
    objs.forEach(function (o, i) { pos.push(out.length); out += (i + 1) + ' 0 obj\n' + o + '\nendobj\n'; });
    var xr0 = out.length;
    out += 'xref\n0 ' + (objs.length + 1) + '\n0000000000 65535 f \n' + pos.map(function (p) { return String(p).padStart(10, '0') + ' 00000 n \n'; }).join('');
    out += 'trailer\n<< /Size ' + (objs.length + 1) + ' /Root 1 0 R >>\nstartxref\n' + xr0 + '\n%%EOF';
    var bytes = new Uint8Array(out.length);
    for (var i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 255;
    return new Blob([bytes], { type: 'application/pdf' });
  }

  /* ---------- Enviar / descargar ---------- */
  function archivo(f) { return new File([crearPDF(f, emisor())], 'Comprobante-' + f.numero + '.pdf', { type: 'application/pdf' }); }
  function descargar(f) {
    var file = archivo(f), u = URL.createObjectURL(file), a = document.createElement('a');
    a.href = u; a.download = file.name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(u); }, 4000);
  }
  function waTexto(f) { return 'Hola ' + (f.cliente.nombre || '').split(' ')[0] + ', te comparto tu comprobante ' + f.numero + ' por ' + peso(f.total) + '. Tu par tiene garantía de ' + GAR_MESES + ' meses por defectos de fabricación, hasta el ' + garHasta(f) + '. Gracias por tu compra en ' + emisor().nombre + '.'; }
  function waLink(f) {
    var d = String(f.cliente.tel || '').replace(/\D/g, ''); if (d.length === 10) d = '57' + d;
    return 'https://wa.me/' + d + '?text=' + encodeURIComponent(waTexto(f));
  }
  function compartir(f) {
    var file = archivo(f);
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      return navigator.share({ files: [file] }).catch(function (e) { if (e && e.name !== 'AbortError') throw e; });
    }
    descargar(f);
    A.msg('PDF descargado. Se abre WhatsApp: adjunta el archivo en el chat.');
    if (String(f.cliente.tel || '').replace(/\D/g, '')) window.open(waLink(f), '_blank', 'noopener');
    return Promise.resolve();
  }

  /* ---------- Pantalla ---------- */
  function campo(etq, input) { return el('label', {}, [etq, input]); }
  function entrada(obj, k, etq, o) {
    o = o || {};
    var i = el('input', { type: o.type || 'text', maxlength: o.max || '80', autocomplete: 'off', placeholder: o.ph || '', inputmode: o.im || false, 'aria-label': etq, value: obj[k] == null ? '' : String(obj[k]) });
    i.addEventListener('input', function () { obj[k] = o.num ? (parseFloat(i.value) || 0) : i.value; if (o.cb) o.cb(); });
    return campo(etq, i);
  }
  function resumen(f, ocultoNuevo) {
    return el('div', { class: 'pedido' }, [
      el('div', { class: 'fila' }, [el('span', { class: 'ref', text: f.numero }), el('strong', { text: peso(f.total) })]),
      el('p', { class: 'suave', text: f.fecha + ' · ' + (f.cliente.nombre || 'Sin nombre') + ' · ' + f.pago + ' (' + f.estado + ')' }),
      el('div', { class: 'envio' }, [
        el('button', { type: 'button', text: 'Enviar por WhatsApp', onclick: function () { compartir(f).catch(A.falla); } }),
        el('button', { type: 'button', class: 'claro', text: 'Descargar PDF', onclick: function () { descargar(f); } }),
        ocultoNuevo ? null : el('button', { type: 'button', class: 'claro', text: 'Duplicar', onclick: function () { duplicar(f); } }),
      ]),
    ]);
  }
  function duplicar(f) {
    F = nueva(); F.cliente = Object.assign({}, f.cliente); F.items = f.items.map(function (i) { return Object.assign({}, i); });
    F.desc = f.desc; F.descPesos = f.descPesos || 0; F.envio = f.envio; F.pago = f.pago; F.estado = f.estado; F.nota = f.nota; ULTIMA = null; pintar(); window.scrollTo(0, 0);
  }

  var refTot = null;
  function actTotales() {
    if (!refTot) return;
    refTot.textContent = '';
    [['Subtotal', peso(subtotal())], descuento() > 0 ? [etqDesc(F), '-' + peso(descuento())] : null, ['Envío', +F.envio > 0 ? peso(F.envio) : 'Sin costo'], ['Total', peso(total())]].forEach(function (r, k, a) {
      if (!r) return; refTot.appendChild(el('div', { class: 'linea' + (r[0] === 'Total' ? ' tot' : '') }, [el('span', { text: r[0] }), el('span', { text: r[1] })]));
    });
  }

  // Crea el comprobante con F: numera, genera el PDF y lo guarda en el historial. Devuelve la factura o el motivo si falta algo.
  function emitir() {
    if (!String(F.cliente.nombre || '').trim()) return 'Escribe el nombre de la clienta';
    if (!F.items.length) return 'Agrega al menos un producto';
    if (F.items.some(function (i) { return !String(i.nombre || '').trim() || !(+i.cant > 0) || !(+i.precio >= 0); })) return 'Revisa descripción, cantidad y precio de cada producto';
    var n = parseInt(leer(KN, 1), 10) || 1, ahora = new Date();
    var f = {
      numero: 'MF-' + String(n).padStart(4, '0'), creado: ahora.toISOString(), fecha: ahora.toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' }),
      cliente: Object.assign({}, F.cliente), items: F.items.map(function (i) { return { nombre: String(i.nombre).trim(), talla: String(i.talla || '').trim(), cant: +i.cant, precio: +i.precio }; }),
      desc: +F.descPesos > 0 ? 0 : Math.min(90, Math.max(0, +F.desc || 0)), descPesos: +F.descPesos > 0 ? Math.round(+F.descPesos) : 0, waId: F.waId || null, subtotal: subtotal(), descuento: descuento(), envio: +F.envio || 0, total: total(), pago: F.pago, estado: F.estado, nota: (F.nota || '').trim(),
    };
    try { crearPDF(f, emisor()); } catch (e) { return 'No se pudo crear el PDF: ' + e.message; }
    guardar(KN, n + 1); var h = leer(KH, []); h.unshift(f); guardar(KH, h.slice(0, 100));
    ULTIMA = f; pintar(); window.scrollTo(0, 0); A.msg('Factura ' + f.numero + ' creada ✓');
    return f;
  }

  function pintar() {
    var c = root(); c.textContent = ''; refTot = null;
    if (F.waId && !ULTIMA) c.appendChild(el('p', { class: 'alerta', text: 'Datos traídos del pedido de WhatsApp de ' + (F.cliente.nombre || 'la clienta') + '. Revísalos y pulsa «Crear factura».' }));
    c.appendChild(el('p', { class: 'nota', text: 'Crea el comprobante con los datos de la clienta y envíaselo por WhatsApp. Cada comprobante incluye la garantía de 3 meses por defectos de fabricación, con su fecha de vencimiento. Es un comprobante de venta, no una factura electrónica de la DIAN.' }));
    if (ULTIMA) {
      c.appendChild(el('p', { class: 'nota', text: 'Comprobante listo ✓' }));
      c.appendChild(resumen(ULTIMA, true));
      c.appendChild(el('button', { type: 'button', text: '+ Nueva factura', onclick: function () { F = nueva(); ULTIMA = null; pintar(); window.scrollTo(0, 0); } }));
    } else {
      var cli = F.cliente;
      c.appendChild(el('div', { class: 'form' }, [
        el('h3', { text: 'Clienta' }),
        entrada(cli, 'nombre', 'Nombre', { ph: 'Nombre y apellido' }),
        entrada(cli, 'doc', 'Cédula o NIT (opcional)', { im: 'numeric', max: '20' }),
        entrada(cli, 'tel', 'WhatsApp', { type: 'tel', im: 'tel', max: '20', ph: '3001234567' }),
        entrada(cli, 'email', 'Correo (opcional)', { type: 'email', max: '80' }),
        entrada(cli, 'ciudad', 'Ciudad', { max: '40' }),
        entrada(cli, 'dir', 'Dirección (opcional)', { max: '120' }),
      ]));

      // Productos
      var sel = el('select', { 'aria-label': 'Producto' }, [el('option', { value: '', text: PRODS.length ? 'Elige un producto…' : 'Sin productos cargados' })]);
      PRODS.forEach(function (p, i) { sel.appendChild(el('option', { value: String(i), text: p.nombre + ' · ' + peso(p.precio) })); });
      var tal = el('select', { 'aria-label': 'Talla' }, TALLAS.map(function (t) { return el('option', { value: t, text: 'Talla ' + t }); }));
      var cant = el('input', { type: 'number', min: '1', max: '99', value: '1', inputmode: 'numeric', 'aria-label': 'Cantidad' });
      var add = el('button', { type: 'button', text: 'Agregar', onclick: function () {
        if (sel.value === '') return A.msg('Elige un producto', true);
        var p = PRODS[+sel.value]; F.items.push({ nombre: p.nombre, talla: tal.value, cant: Math.max(1, parseInt(cant.value, 10) || 1), precio: +p.precio || 0 }); pintar();
      } });
      var libre = el('button', { type: 'button', class: 'claro', text: '+ Otro concepto', onclick: function () { F.items.push({ nombre: '', talla: '', cant: 1, precio: 0 }); pintar(); } });
      var caja = el('div', { class: 'form' }, [el('h3', { text: 'Productos' }), campo('Producto', sel), campo('Talla', tal), campo('Cantidad', cant), el('div', { class: 'envio' }, [add, libre])]);
      F.items.forEach(function (i, k) {
        caja.appendChild(el('div', { class: 'pedido' }, [
          entrada(i, 'nombre', 'Descripción', { max: '90', cb: actTotales }),
          el('div', { class: 'envio' }, [
            entrada(i, 'talla', 'Talla', { max: '6' }),
            entrada(i, 'cant', 'Cant.', { type: 'number', im: 'numeric', num: 1, cb: actTotales }),
            entrada(i, 'precio', 'Precio unitario', { type: 'number', im: 'numeric', num: 1, cb: actTotales }),
            el('button', { type: 'button', class: 'claro', text: 'Quitar', onclick: function () { F.items.splice(k, 1); pintar(); } }),
          ]),
        ]));
      });
      c.appendChild(caja);

      // Totales y pago
      var pagoSel = el('select', { 'aria-label': 'Medio de pago' }, PAGOS.map(function (p) { var o = el('option', { value: p, text: p }); if (p === F.pago) o.selected = true; return o; }));
      pagoSel.addEventListener('change', function () { F.pago = pagoSel.value; });
      var estSel = el('select', { 'aria-label': 'Estado del pago' }, ['Pagado', 'Pendiente de pago'].map(function (p) { var o = el('option', { value: p, text: p }); if (p === F.estado) o.selected = true; return o; }));
      estSel.addEventListener('change', function () { F.estado = estSel.value; });
      refTot = el('div', { class: 'form' });
      c.appendChild(el('div', { class: 'form' }, [
        el('h3', { text: 'Total' }),
        +F.descPesos > 0
          ? entrada(F, 'descPesos', 'Descuento (COP) · viene del pedido de WhatsApp', { type: 'number', im: 'numeric', num: 1, cb: actTotales })
          : entrada(F, 'desc', 'Descuento (%)', { type: 'number', im: 'numeric', num: 1, cb: actTotales }),
        entrada(F, 'envio', 'Envío (COP)' + (TARIFA ? ' · tarifa del panel ' + peso(TARIFA) : ''), { type: 'number', im: 'numeric', num: 1, cb: actTotales }),
        campo('Medio de pago', pagoSel), campo('Estado', estSel),
        entrada(F, 'nota', 'Nota (opcional)', { max: '200' }),
      ]));
      c.appendChild(refTot); actTotales();

      var crear = el('button', { type: 'button', text: 'Crear factura' });
      crear.addEventListener('click', function () { var r = emitir(); if (typeof r === 'string') A.msg(r, true); });
      c.appendChild(crear);
    }

    // Datos del negocio
    var em = emisor(), det = el('details', { class: 'form' }, [el('summary', { text: 'Datos de tu negocio (salen en el PDF)' })]);
    ['nombre', 'nit', 'tel', 'ciudad', 'web'].forEach(function (k) {
      var et = { nombre: 'Nombre del negocio', nit: 'NIT o cédula (opcional)', tel: 'WhatsApp', ciudad: 'Ciudad', web: 'Página web' }[k];
      det.appendChild(entrada(em, k, et, { max: '60', cb: function () { guardar(KE, em); } }));
    });
    c.appendChild(det);

    // Historial
    var h = leer(KH, []);
    c.appendChild(el('h3', { text: 'Facturas creadas', style: 'margin-top:1.4rem' }));
    if (!h.length) c.appendChild(el('p', { class: 'nota', text: 'Aún no has creado facturas en este dispositivo.' }));
    h.slice(0, 30).forEach(function (f) { c.appendChild(resumen(f)); });
    if (h.length) c.appendChild(el('p', { class: 'nota', text: 'El historial y la numeración se guardan solo en este dispositivo. Si usas otro teléfono o computador, empezarán de cero.' }));
    if (h.length) c.appendChild(el('button', { type: 'button', class: 'claro', text: 'Borrar historial y reiniciar numeración', onclick: function () {
      if (!window.confirm('¿Borrar todas las facturas guardadas en este dispositivo y volver a empezar en MF-0001? Esto no se puede deshacer.')) return;
      try { localStorage.removeItem(KH); localStorage.removeItem(KN); } catch (e) { /* sin acceso: se ignora */ }
      ULTIMA = null; A.msg('Historial borrado. El próximo comprobante será MF-0001.'); pintar();
    } }));
  }

  function cargarDatos() {
    return Promise.all([
      A.api('admin-tienda?recurso=productos').then(function (d) { PRODS = (d.productos || []).filter(function (p) { return p && p.nombre; }); }),
      A.api('admin-tienda?recurso=envio').then(function (d) { TARIFA = Number(d.tarifa) || 0; }),
    ]);
  }
  function abrir() {
    F = nueva(); ULTIMA = null; pintar();
    return cargarDatos().then(function () { F.envio = TARIFA; pintar(); });
  }

  /* ---------- Conexión con Pedidos WhatsApp ---------- */
  var PAGO_WA = { Transferencia: 'Transferencia', Nequi: 'Nequi', Daviplata: 'Daviplata', Bancolombia: 'Bancolombia', Efectivo: 'Efectivo' };
  // Comprobante ya hecho para ese pedido (el historial vive en este dispositivo)
  function deWhatsapp(id) { if (id == null) return null; return leer(KH, []).filter(function (f) { return f && f.waId != null && String(f.waId) === String(id); })[0] || null; }
  function desdeVenta(v) {
    var f = nueva();
    f.cliente = { nombre: v.cliente || '', doc: '', tel: v.telefono || '', email: '', ciudad: v.ciudad || '', dir: '' };
    f.items = (v.items || []).map(function (i) { return { nombre: [i.nombre, i.color].filter(Boolean).join(' - '), talla: i.talla || '', cant: +i.cant || 1, precio: +i.precio || 0 }; });
    f.desc = 0; f.descPesos = +v.descuento || 0; f.envio = +v.envio || 0;
    f.pago = PAGO_WA[v.metodo_pago] || 'Otro'; f.estado = v.estado_pago === 'PAGADO' ? 'Pagado' : 'Pendiente de pago';
    f.nota = v.nota || ''; f.waId = v.id;
    return f;
  }
  // Abre Facturas con el comprobante del pedido: si ya existe lo muestra para reenviarlo; si no, lo crea de una vez
  // con los datos del pedido (sin volver a llenar nada). Si al pedido le falta algo (nombre o productos), deja el formulario lleno para completarlo.
  function desdeWhatsapp(v) {
    mostrar();
    var hecha = deWhatsapp(v.id);
    if (hecha) { ULTIMA = hecha; F = nueva(); pintar(); return Promise.resolve(hecha); }
    ULTIMA = null; F = desdeVenta(v); pintar();
    var r = emitir();
    if (typeof r === 'string') {
      A.msg('Falta un dato para la factura: ' + r, true);
      return cargarDatos().then(function () { if (!F.items.length) F.envio = TARIFA; pintar(); });
    }
    cargarDatos().catch(function () {});
    return Promise.resolve(r);
  }
  window.mfAdminFacturas = { abrir: abrir, desdeWhatsapp: desdeWhatsapp, deWhatsapp: deWhatsapp, _crearPDF: crearPDF };

  function mostrar() {
    var tabs = document.getElementById('tabs'), volver = document.getElementById('volver');
    if (tabs) tabs.hidden = true; if (volver) volver.hidden = false;
    var t = document.getElementById('titulo'); if (t) t.textContent = 'Facturas';
    var ay = document.getElementById('ayuda'); if (ay) ay.hidden = true;
    document.querySelectorAll('.panel').forEach(function (p) { p.classList.toggle('on', p.id === 'p-facturas'); });
    A.msg(''); window.scrollTo(0, 0);
  }

  /* Se agrega solo el botón "Facturas" al inicio del panel y su sección; no hace falta tocar otro archivo. */
  function montar() {
    var tabs = document.getElementById('tabs'), volver = document.getElementById('volver');
    if (!tabs || !volver || document.getElementById('b-facturas')) return;
    var secc = el('section', { class: 'panel', id: 'p-facturas' });
    var ultimo = document.querySelector('.panel:last-of-type'); if (ultimo && ultimo.parentNode) ultimo.parentNode.appendChild(secc); else volver.parentNode.appendChild(secc);
    var lista = tabs.querySelector('.lista'); // primer grupo: "Ventas y dinero"
    var b;
    if (lista) {
      b = el('button', { type: 'button', id: 'b-facturas' }, [el('span', { class: 'ic', text: '📄' }), el('span', { class: 'tx' }, [el('b', { text: 'Facturas' }), el('small', { text: 'Crea y envía comprobantes por WhatsApp' })]), el('i', { class: 'fl', 'aria-hidden': 'true', text: '›' })]);
      lista.appendChild(b);
    } else {
      b = el('button', { type: 'button', id: 'b-facturas' }, [el('span', { class: 'ic', text: '📄' }), 'Facturas', el('small', { text: 'Crea y envía comprobantes por WhatsApp' })]);
      tabs.appendChild(b);
    }
    b.addEventListener('click', function () { mostrar(); abrir().catch(A.falla); });
  }
  montar();
})();
