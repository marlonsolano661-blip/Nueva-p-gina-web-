/* Panel · Vestidos: la sesión de estudio de /vestidos.html, sin tocar código.
   Cada look: la prenda colgada (frente y espalda, se le quita el fondo verde aquí mismo), el video de la sesión,
   dónde cae la prenda sobre la modelo (primer cuadro), dónde terminan las etiquetas (último cuadro),
   el vestido y el tacón MF de la tienda. El mismo vestido en varios colores sale en un solo gancho.
   Fotos y videos suben directo al almacenamiento; la lista se guarda en /api/vestidos.
   Se carga desde admin-comunidad.js; si falla, el resto del panel funciona igual. */
(function () {
  'use strict';
  if (window.__mfAdminVestidos) return; window.__mfAdminVestidos = 1;
  var A = window.mfAdmin;
  if (!A) return;
  var el = function () { return A.el.apply(null, arguments); };
  var MAX_LOOKS = 24, MAX_VIDEO = 500 * 1024 * 1024, PAD_TOP = 89;
  var TALLAS_ROPA = ['XS', 'S', 'M', 'L', 'XL', 'Unica'];
  var S = { lista: [], productos: [], sucio: false, respaldo: false };

  var css = document.createElement('style');
  css.textContent = [
    '#p-vestidos{padding-bottom:6rem}',
    '.vsA-look{display:grid;grid-template-columns:4.2rem 1fr;gap:.7rem;align-items:center;padding:.6rem;border:1px solid #e3e3e3;border-radius:.8rem;margin:.5rem 0;background:#fff}',
    '.vsA-look img{width:4.2rem;height:6.4rem;object-fit:cover;border-radius:.45rem;background:#f2f2f2}',
    '.vsA-look b{display:block}.vsA-look small{color:#777;display:block;margin:.15rem 0 .45rem;line-height:1.35}',
    '.vsA-acc{display:flex;gap:.35rem;flex-wrap:wrap}.vsA-acc button{padding:.4rem .6rem}',
    '.vsA-oculto{opacity:.55}',
    '.vsA-pt{display:inline-block;width:.9rem;height:.9rem;border-radius:50%;border:1px solid rgba(0,0,0,.2);vertical-align:-.12rem;margin-right:.25rem}',
    '.vsA-bar{display:flex;gap:.6rem;flex-wrap:wrap;padding:.9rem 0 1.2rem;align-items:center}',
    '.vsA-ed{display:grid;gap:1rem}',
    '.vsA-paso{border:1px solid #e3e3e3;border-radius:.9rem;background:#fff;padding:.9rem;display:grid;gap:.7rem}',
    '.vsA-paso h4{margin:0;font-size:1rem;display:flex;gap:.5rem;align-items:center}',
    '.vsA-n{display:inline-grid;place-items:center;width:1.6rem;height:1.6rem;border-radius:50%;background:#0a0a0a;color:#fff;font-size:.8rem;flex:none}',
    '.vsA-paso.ok .vsA-n{background:#2e7d32}',
    '.vsA-ay{font-size:.84rem;line-height:1.4;color:#6b6b6b;margin:0}',
    '.vsA-campo{display:grid;gap:.25rem;font-weight:600;font-size:.9rem}',
    '.vsA-dos{display:grid;grid-template-columns:1fr 1fr;gap:.6rem}',
    '.vsA-prenda{display:grid;gap:.4rem;justify-items:center;padding:.5rem;border:1px dashed #c9c9c9;border-radius:.7rem;text-align:center;font-size:.85rem}',
    '.vsA-prenda .img{width:100%;aspect-ratio:3/4;border-radius:.5rem;background:#fff url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2716%27 height=%2716%27%3E%3Crect width=%278%27 height=%278%27 fill=%27%23eee%27/%3E%3Crect x=%278%27 y=%278%27 width=%278%27 height=%278%27 fill=%27%23eee%27/%3E%3C/svg%3E");display:grid;place-items:center;overflow:hidden}',
    '.vsA-prenda .img img{max-width:100%;max-height:100%;object-fit:contain}',
    '.vsA-esc{position:relative;width:min(100%,21rem);border-radius:.7rem;overflow:hidden;background:#f2f2f2;touch-action:none;user-select:none;-webkit-user-select:none;margin:0 auto}',
    '.vsA-esc > img,.vsA-esc > video{position:absolute;inset:0;width:100%;height:100%;object-fit:fill;display:block;pointer-events:none}',
    '.vsA-gar{position:absolute;opacity:.72;cursor:grab;clip-path:inset(14% 0 0 0);pointer-events:auto!important;filter:drop-shadow(0 0 1px #b08d57)}',
    '.vsA-esc.marca{cursor:crosshair;outline:3px solid #b08d57;outline-offset:3px}',
    '.vsA-pin{position:absolute;transform:translate(-50%,-50%);padding:.25rem .55rem;border-radius:1rem;background:#0a0a0a;color:#fff;font-size:.72rem;font-weight:700;white-space:nowrap;box-shadow:0 0 0 2px #fff,0 2px 8px rgba(0,0,0,.35);pointer-events:none}',
    '.vsA-pin.t{background:#b08d57}',
    '.vsA-fila{display:flex;gap:.5rem;flex-wrap:wrap;align-items:center}',
    '.vsA-fila input[type=range]{flex:1 1 10rem}',
    '.vsA-prog{height:.4rem;border-radius:.2rem;background:#eee;overflow:hidden}.vsA-prog i{display:block;height:100%;width:0;background:#0a0a0a;transition:width .2s}',
    '.vsA-aviso{padding:.6rem .8rem;border-radius:.6rem;background:#fff4e0;border:1px solid #f0d9a8;font-size:.86rem;line-height:1.4}',
    '.vsA-gal{display:grid;grid-template-columns:repeat(auto-fill,minmax(5rem,1fr));gap:.45rem}',
    '.vsA-gal figure{margin:0;display:grid;gap:.25rem}.vsA-gal img,.vsA-gal video{width:100%;aspect-ratio:3/4;object-fit:cover;border-radius:.4rem;background:#f2f2f2}',
    '.vsA-gal button{font-size:.75rem;padding:.3rem}',
    '.vsA-marca{background:#0a0a0a;color:#fff;border-color:#0a0a0a;font-weight:700}',
    '.vsA-marca.esperando{background:#b08d57;border-color:#b08d57}',
    '.vsA-chips{display:grid;grid-template-columns:repeat(auto-fill,minmax(5.4rem,1fr));gap:.45rem}',
    '.vsA-chip{display:grid;gap:.25rem;padding:.3rem;border:2px solid #e3e3e3;border-radius:.6rem;background:#fff;font:inherit;font-size:.72rem;line-height:1.2;text-align:center;cursor:pointer;color:#0a0a0a}',
    '.vsA-chip img{width:100%;aspect-ratio:1;object-fit:contain;border-radius:.35rem;background:#f6f6f6}',
    '.vsA-chip[aria-pressed="true"]{border-color:#0a0a0a;box-shadow:0 0 0 1px #0a0a0a}',
    '.vsA-gal small{font-size:.72rem;line-height:1.2}',
  ].join('\n');
  document.head.appendChild(css);

  // La sección vive en el menú lateral (panel-menu.js → Contenido › Vestidos, dirección #/vestidos)
  var sec = document.getElementById('p-vestidos');
  if (!sec) { sec = el('section', { class: 'panel', id: 'p-vestidos' }); var ult = document.querySelectorAll('.panel'); ult = ult[ult.length - 1]; ult.parentNode.insertBefore(sec, ult.nextSibling); }
  var P = window.mfPanel;
  if (P && P.CARGA) {
    P.CARGA.vestidos = function () { sec.textContent = ''; sec.appendChild(el('p', { class: 'nota', text: 'Cargando…' })); return cargar(); };
    if (P.TITULOS) P.TITULOS.vestidos = 'Vestidos';
  }
  window.addEventListener('beforeunload', function (e) { if (S.sucio) { e.preventDefault(); e.returnValue = ''; } });

  var copia = function (o) { return JSON.parse(JSON.stringify(o)); };
  var porId = function (id) { return S.productos.filter(function (p) { return String(p.id) === String(id); })[0] || null; };
  var esRopa = function (p) { return Object.keys((p && p.stock) || {}).some(function (t) { return TALLAS_ROPA.indexOf(t) > -1; }); };
  var fotoDe = function (p) { return p ? ((p.imagenes && p.imagenes[0]) || p.imagen || '') : ''; };
  var peso = function (n) { return n > 0 ? '$' + Number(n).toLocaleString('es-CO') : ''; };
  var marcar = function () { S.sucio = true; };

  // Los looks que ya estaban en la página (vestidos/looks.js) sirven de punto de partida la primera vez
  function respaldo() {
    if (window.MF_VESTIDOS) return Promise.resolve(window.MF_VESTIDOS);
    return new Promise(function (ok) {
      var s = document.createElement('script'); s.src = 'vestidos/looks.js';
      s.onload = function () { ok(window.MF_VESTIDOS || []); }; s.onerror = function () { ok([]); };
      document.body.appendChild(s);
    });
  }
  function cargar() {
    return Promise.all([A.api('vestidos?admin=1'), A.api('admin-tienda?recurso=productos')]).then(function (r) {
      S.productos = r[1].productos || [];
      if (Array.isArray(r[0].looks)) { S.lista = r[0].looks.map(copia); S.respaldo = false; S.sucio = false; pintar(); return; }
      return respaldo().then(function (L) {
        S.lista = L.map(function (x, i) { var o = copia(x); o.id = o.id || 'v' + (i + 1); o.visible = true; return o; });
        S.respaldo = true; S.sucio = false; pintar();
      });
    });
  }

  // ---------- Lista de looks ----------
  function pintar() {
    sec.textContent = '';
    sec.appendChild(el('p', { class: 'nota', text: 'Cada look es una sesión: la prenda en el gancho, el video de la modelo y el tacón MF. Los looks del mismo vestido (en otros colores) salen juntos en un solo gancho con selector de color. El orden de aquí es el orden de la página.' }));
    if (S.respaldo && S.lista.length) sec.appendChild(el('p', { class: 'vsA-aviso', text: 'Estos son los looks que ya están publicados en la página. Al tocar "Guardar vestidos" quedan administrados desde aquí.' }));
    if (!S.lista.length) sec.appendChild(el('p', { class: 'nota', text: 'Todavía no hay looks. Toca "+ Nuevo look".' }));
    S.lista.forEach(function (L, i) {
      var V = L.prenda && L.prenda.venta, T = L.tacon, C = L.color;
      var info = [V ? (V.n || V.id) : (L.prenda && L.prenda.n) || 'Sin vestido', T ? ' · ' + (T.n || T.id) : ' · sin tacón'].join('');
      var vis = el('button', { type: 'button', class: 'claro', text: L.visible === false ? 'Mostrar' : 'Ocultar' });
      vis.addEventListener('click', function () { L.visible = L.visible === false; marcar(); pintar(); });
      var sube = el('button', { type: 'button', class: 'claro', text: '↑', 'aria-label': 'Subir' }); sube.disabled = i === 0;
      sube.addEventListener('click', function () { S.lista.splice(i - 1, 0, S.lista.splice(i, 1)[0]); marcar(); pintar(); });
      var baja = el('button', { type: 'button', class: 'claro', text: '↓', 'aria-label': 'Bajar' }); baja.disabled = i === S.lista.length - 1;
      baja.addEventListener('click', function () { S.lista.splice(i + 1, 0, S.lista.splice(i, 1)[0]); marcar(); pintar(); });
      var quitar = el('button', { type: 'button', class: 'claro', text: 'Quitar' });
      quitar.addEventListener('click', function () { if (confirm('¿Quitar el look "' + L.nombre + '"?')) { S.lista.splice(i, 1); marcar(); pintar(); } });
      var editar = el('button', { type: 'button', text: 'Editar' });
      editar.addEventListener('click', function () { editor(i); });
      var tit = el('b', {}, [C ? el('span', { class: 'vsA-pt', style: 'background:' + C.h }) : null, L.nombre || 'Sin nombre']);
      sec.appendChild(el('article', { class: 'vsA-look' + (L.visible === false ? ' vsA-oculto' : '') }, [
        el('img', { src: (L.foto && (L.foto.inicio || L.foto.src)) || '', alt: '', loading: 'lazy' }),
        el('div', {}, [tit, el('small', { text: info + (C ? ' · color ' + C.n : '') + (L.visible === false ? ' · oculto' : '') }),
          el('div', { class: 'vsA-acc' }, [editar, vis, sube, baja, quitar])]),
      ]));
    });
    var nuevo = el('button', { type: 'button', class: 'claro', text: '+ Nuevo look' }); nuevo.disabled = S.lista.length >= MAX_LOOKS;
    nuevo.addEventListener('click', function () { editor(-1); });
    var guardar = el('button', { type: 'button', text: 'Guardar vestidos' });
    guardar.addEventListener('click', function () {
      A.msg('Guardando…'); guardar.disabled = true;
      var lista = S.lista.map(function (L) { var o = copia(L); return o; });
      A.api('vestidos', { method: 'POST', body: { looks: lista } })
        .then(function (r) { S.lista = (r.looks || []).map(copia); S.respaldo = false; S.sucio = false; pintar(); A.msg('Vestidos guardados ✓ La página se actualiza en menos de un minuto.'); })
        .catch(function (e) { guardar.disabled = false; A.falla(e); });
    });
    var ver = el('button', { type: 'button', class: 'claro', text: 'Ver la página' });
    ver.addEventListener('click', function () { window.open('vestidos.html', '_blank', 'noopener'); });
    sec.appendChild(el('div', { class: 'vsA-bar' }, [nuevo, guardar, ver]));
    if (S.sucio) sec.appendChild(el('p', { class: 'vsA-aviso', text: 'Tienes cambios sin guardar: toca "Guardar vestidos".' }));
  }

  // ---------- Subidas ----------
  // Directo al almacenamiento con un enlace firmado (los videos pesan más de lo que deja pasar el servidor)
  function subirDirecto(blob, tipo, barra) {
    return A.api('vestidos', { method: 'POST', body: { accion: 'firmar', tipo: tipo } }).then(function (r) {
      return new Promise(function (ok, mal) {
        var x = new XMLHttpRequest();
        x.open('PUT', r.subir);
        x.setRequestHeader('Content-Type', tipo);
        x.setRequestHeader('cache-control', 'max-age=31536000');
        if (barra) x.upload.onprogress = function (e) { if (e.lengthComputable) barra.style.width = Math.round(e.loaded / e.total * 100) + '%'; };
        x.onload = function () {
          if (x.status >= 200 && x.status < 300) { if (barra) barra.style.width = '100%'; return ok(r.url); }
          if (x.status === 413 || /maximum allowed size|too large/i.test(x.responseText || '')) return mal(new Error('El almacenamiento no acepta archivos tan pesados (' + (blob.size / 1048576).toFixed(0) + ' MB). Sube el límite de tamaño de archivos en Supabase (Storage › Settings) o usa una versión más liviana del video.'));
          mal(new Error('No se pudo subir el archivo (' + x.status + ')'));
        };
        x.onerror = function () { mal(new Error('Se cortó la conexión al subir. Intenta de nuevo.')); };
        x.send(blob);
      });
    });
  }
  function aBlob(canvas, tipo, q) {
    return new Promise(function (ok) { canvas.toBlob(function (b) { ok(b); }, tipo, q); });
  }
  // WEBP con transparencia; Safari no sabe crear WEBP, entonces queda en PNG
  function blobTransparente(canvas) {
    return aBlob(canvas, 'image/webp', 0.9).then(function (b) { return b && b.type === 'image/webp' ? b : aBlob(canvas, 'image/png'); });
  }
  function abrirImagen(file) {
    return new Promise(function (ok, mal) {
      var u = URL.createObjectURL(file), im = new Image();
      im.onload = function () { ok(im); };
      im.onerror = function () { mal(new Error('No se pudo abrir la foto (usa JPG, PNG o WEBP)')); };
      im.src = u;
    });
  }
  function elegirArchivo(accept, cb) {
    var i = el('input', { type: 'file', accept: accept, style: 'display:none' });
    i.addEventListener('change', function () { var f = i.files && i.files[0]; i.remove(); if (f) cb(f); });
    document.body.appendChild(i); i.click();
  }

  // ---------- Quitar el fondo verde (o blanco) de la prenda ----------
  // Devuelve la prenda recortada al ras: { c: canvas, gx: dónde está el gancho (x, dentro del recorte) }
  function recortar(im, fuerza) {
    var k = Math.min(1, 1400 / Math.max(im.naturalWidth, im.naturalHeight));
    var W = Math.round(im.naturalWidth * k), H = Math.round(im.naturalHeight * k);
    var c = document.createElement('canvas'); c.width = W; c.height = H;
    var g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(im, 0, 0, W, H);
    var d = g.getImageData(0, 0, W, H), p = d.data, i, n = W * H;
    // ¿Qué fondo tiene? Se mira el borde de la foto
    var br = 0, bg = 0, bb = 0, ba = 0, cnt = 0;
    var mira = function (x, y) { var j = (y * W + x) * 4; br += p[j]; bg += p[j + 1]; bb += p[j + 2]; ba += p[j + 3]; cnt++; };
    for (var x = 0; x < W; x += 4) { mira(x, 0); mira(x, H - 1); }
    for (var y = 0; y < H; y += 4) { mira(0, y); mira(W - 1, y); }
    br /= cnt; bg /= cnt; bb /= cnt; ba /= cnt;
    var f = fuerza || 1, modo;
    if (ba < 200) modo = 'listo';
    else if (bg > br + 25 && bg > bb + 15) modo = 'verde';
    else if (br > 215 && bg > 215 && bb > 215) modo = 'blanco';
    else throw new Error('La foto debe tener fondo verde (o venir ya sin fondo, en PNG)');
    if (modo === 'verde') {
      // Verde de fondo vs prenda: se mide cuánto verde "puro" tiene cada punto (el azul cuenta en contra), así una prenda
      // verde esmeralda o turquesa no se borra. Los bordes se des-mezclan del verde para que no quede halo.
      var lo = 40 / f, hi = 235 / f;
      for (i = 0; i < n; i++) {
        var j = i * 4, r = p[j], gg = p[j + 1], b = p[j + 2], s = gg - Math.max(r, 1.5 * b);
        var a = s <= lo ? 1 : s >= hi ? 0 : 1 - (s - lo) / (hi - lo);
        if (a < 0.04) a = 0;
        if (a > 0 && a < 1) {
          p[j] = Math.max(0, Math.min(255, (r - (1 - a) * br) / a));
          p[j + 1] = Math.max(0, Math.min(255, (gg - (1 - a) * bg) / a));
          p[j + 2] = Math.max(0, Math.min(255, (b - (1 - a) * bb) / a));
        }
        p[j + 3] = Math.round(p[j + 3] * a);
      }
    } else if (modo === 'blanco') {
      var lw = 6 * f, hw = 30 * f;
      for (i = 0; i < n; i++) {
        var q = i * 4, dist = 255 - Math.min(p[q], p[q + 1], p[q + 2]);
        var a2 = dist <= lw ? 0 : dist >= hw ? 1 : (dist - lw) / (hw - lw);
        p[q + 3] = Math.round(p[q + 3] * a2);
      }
    }
    g.putImageData(d, 0, 0);
    // Recorte al ras (se ignoran motas sueltas)
    var filas = new Array(H).fill(0), cols = new Array(W).fill(0);
    for (y = 0; y < H; y++) for (x = 0; x < W; x++) if (p[(y * W + x) * 4 + 3] > 60) { filas[y]++; cols[x]++; }
    var y0 = filas.findIndex(function (v) { return v > 2; }), y1 = H - 1 - filas.slice().reverse().findIndex(function (v) { return v > 2; });
    var x0 = cols.findIndex(function (v) { return v > 2; }), x1 = W - 1 - cols.slice().reverse().findIndex(function (v) { return v > 2; });
    if (y0 < 0 || x0 < 0 || y1 - y0 < 40 || x1 - x0 < 30) throw new Error('No se encontró la prenda en la foto');
    // El gancho: el centro de lo primero que aparece arriba
    var sx = 0, sn = 0;
    for (y = y0; y < Math.min(H, y0 + 6); y++) for (x = x0; x <= x1; x++) if (p[(y * W + x) * 4 + 3] > 60) { sx += x; sn++; }
    var t = document.createElement('canvas'); t.width = x1 - x0 + 1; t.height = y1 - y0 + 1;
    t.getContext('2d').drawImage(c, x0, y0, t.width, t.height, 0, 0, t.width, t.height);
    return { c: t, gx: (sn ? sx / sn : (x0 + x1) / 2) - x0 };
  }
  // Frente y espalda en el mismo lienzo: el mismo alto, con el gancho en el mismo punto (así giran sin saltar)
  function componer(fr, es) {
    var alto = Math.min(970, fr.c.height), kf = alto / fr.c.height;
    var ke = es ? alto / es.c.height : 0;
    var izq = Math.max(fr.gx * kf, es ? es.gx * ke : 0), der = Math.max((fr.c.width - fr.gx) * kf, es ? (es.c.width - es.gx) * ke : 0);
    var mitad = Math.ceil(Math.max(izq, der)) + 4, W = mitad * 2, H = Math.round(alto) + PAD_TOP + 8;
    var lienzo = function (o, k) {
      var c = document.createElement('canvas'); c.width = W; c.height = H;
      var g = c.getContext('2d'); g.imageSmoothingQuality = 'high';
      g.drawImage(o.c, mitad - o.gx * k, PAD_TOP, o.c.width * k, o.c.height * k);
      return c;
    };
    return { w: W, h: H, gancho: [mitad, PAD_TOP + 3], frente: lienzo(fr, kf), espalda: es ? lienzo(es, ke) : null };
  }

  // ---------- Video: H.264 (se ve en todos los teléfonos) y cuadros del video ----------
  function revisarCodec(file) {
    if (file.size > MAX_VIDEO) return Promise.reject(new Error('El video pesa más de 500 MB. Acórtalo un poco (10–20 s bastan para la sesión).'));
    // Videos 4K: no se lee todo el archivo (pesaría mucho en el celular). El formato está en la cabecera, al inicio o al final.
    var TROZO = 8 * 1024 * 1024;
    var partes = file.size <= TROZO * 2 ? [file] : [file.slice(0, TROZO), file.slice(file.size - TROZO)];
    return Promise.all(partes.map(function (p) { return p.arrayBuffer(); })).then(function (bufs) {
      var tiene = function (s) {
        var c0 = s.charCodeAt(0), c1 = s.charCodeAt(1), c2 = s.charCodeAt(2), c3 = s.charCodeAt(3);
        return bufs.some(function (buf) { var b = new Uint8Array(buf); for (var i = 0; i < b.length - 3; i++) if (b[i] === c0 && b[i + 1] === c1 && b[i + 2] === c2 && b[i + 3] === c3) return true; return false; });
      };
      if (tiene('avc1')) return;
      if (tiene('hvc1') || tiene('hev1')) throw new Error('Este video está en HEVC (formato del iPhone) y no se ve en Android ni en Chrome. Expórtalo como MP4 "más compatible" (H.264): en el iPhone, Ajustes › Cámara › Formatos › Más compatible, o pásalo por CapCut / WhatsApp.');
      throw new Error('No reconozco el formato del video. Súbelo como MP4 (H.264).');
    });
  }
  function cargarVideo(src) {
    return new Promise(function (ok, mal) {
      var v = document.createElement('video');
      v.muted = true; v.playsInline = true; v.setAttribute('playsinline', ''); v.preload = 'auto';
      if (/^https?:/.test(src) && src.indexOf(location.origin) !== 0) v.crossOrigin = 'anonymous'; // para poder leer sus cuadros
      v.onloadeddata = function () { ok(v); };
      v.onerror = function () { mal(new Error('Este navegador no pudo abrir el video')); };
      v.src = src; v.load();
    });
  }
  function irA(v, t) {
    return new Promise(function (ok) {
      var listo = function () { v.removeEventListener('seeked', listo); setTimeout(ok, 30); };
      v.addEventListener('seeked', listo);
      v.currentTime = Math.max(0.001, Math.min(t, (v.duration || t) - 0.001));
    });
  }
  function cuadro(v) {
    var c = document.createElement('canvas'); c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext('2d').drawImage(v, 0, 0); return c;
  }
  // Flashes de cámara repartidos por la sesión
  function disparos(fin) {
    var n = Math.max(2, Math.min(6, Math.round(fin / 1.6))), out = [];
    for (var k = 0; k < n; k++) out.push(Math.round((fin * (k + 0.6) / (n + 0.2)) * 100) / 100);
    return out;
  }

  // ---------- Editor de un look ----------
  function editor(idx) {
    var D = idx > -1 ? copia(S.lista[idx]) : { id: 'v' + Date.now().toString(36), visible: true, nombre: '', prenda: null, foto: null, encaje: null, puntoPrenda: null, tacon: null };
    var vidLocal = null; // el video recién elegido (para sacar cuadros sin descargarlo)
    sec.textContent = ''; window.scrollTo(0, 0);
    var ed = el('div', { class: 'vsA-ed' });
    sec.appendChild(el('div', { class: 'vsA-bar' }, [
      el('button', { type: 'button', class: 'claro', text: '← Volver sin cambios', onclick: function () { if (!hay() || confirm('¿Salir sin aplicar los cambios de este look?')) pintar(); } }),
    ]));
    sec.appendChild(ed);
    var tocado = false; var hay = function () { return tocado; }; var t = function () { tocado = true; };

    // Paso 1 · nombre, vestido y color
    var p1 = el('div', { class: 'vsA-paso' });
    var nombre = el('input', { type: 'text', maxlength: '40', placeholder: 'Noche en negro', value: D.nombre || '' });
    nombre.addEventListener('input', function () { D.nombre = nombre.value; t(); });
    var selV = el('select', {}), selC = el('select', {});
    var ropas = S.productos.filter(esRopa), calz = S.productos.filter(function (p) { return !esRopa(p); });
    selV.appendChild(el('option', { value: '', text: '— Elige el vestido de la tienda —' }));
    ropas.forEach(function (p) { selV.appendChild(el('option', { value: p.id, text: p.nombre + (p.visible ? '' : ' (oculto)') })); });
    var vId = D.prenda && D.prenda.venta && D.prenda.venta.id; selV.value = vId || '';
    function pintarColores() {
      var p = porId(selV.value); selC.textContent = '';
      var cols = (p && p.colores) || [];
      selC.appendChild(el('option', { value: '', text: cols.length ? '— Color de este look —' : 'Sin colores en el producto' }));
      cols.forEach(function (c) { selC.appendChild(el('option', { value: c.n, text: c.n })); });
      selC.value = (D.color && D.color.n) || '';
    }
    pintarColores();
    selV.addEventListener('change', function () { D._venta = selV.value; t(); pintarColores(); });
    selC.addEventListener('change', function () {
      var p = porId(selV.value), c = ((p && p.colores) || []).filter(function (x) { return x.n === selC.value; })[0];
      D.color = c ? { n: c.n, h: c.h || '#cccccc' } : null; t();
    });
    p1.appendChild(el('h4', {}, [el('span', { class: 'vsA-n', text: '1' }), 'Nombre y vestido']));
    p1.appendChild(el('label', { class: 'vsA-campo' }, ['Nombre del look', nombre]));
    p1.appendChild(el('label', { class: 'vsA-campo' }, ['Vestido de la tienda', selV]));
    p1.appendChild(el('label', { class: 'vsA-campo' }, ['Color', selC]));
    p1.appendChild(el('p', { class: 'vsA-ay', text: 'Si ya hay otro look con el mismo vestido, este sale en el mismo gancho como otro color.' }));
    ed.appendChild(p1);

    // Paso 2 · la prenda en el gancho
    var p2 = el('div', { class: 'vsA-paso' });
    var orig = { frente: null, espalda: null }, fuerza = 1;
    var caja = { frente: el('div', { class: 'img' }), espalda: el('div', { class: 'img' }) };
    var est2 = el('p', { class: 'vsA-ay' });
    function mostrarPrenda() {
      ['frente', 'espalda'].forEach(function (k) {
        caja[k].textContent = '';
        var u = D.prenda && (D.prenda['_' + k + 'Url'] || D.prenda[k]);
        caja[k].appendChild(u ? el('img', { src: u, alt: '' }) : el('span', { text: k === 'frente' ? 'Sin foto' : 'Opcional' }));
      });
      p2.classList.toggle('ok', !!(D.prenda && D.prenda.frente));
    }
    function procesar() {
      if (!orig.frente) return Promise.resolve();
      est2.textContent = 'Quitando el fondo…';
      return new Promise(function (ok) { setTimeout(ok, 30); }).then(function () {
        var fr = recortar(orig.frente, fuerza), es = orig.espalda ? recortar(orig.espalda, fuerza) : null;
        var C = componer(fr, es);
        return Promise.all([blobTransparente(C.frente), C.espalda ? blobTransparente(C.espalda) : null]).then(function (b) {
          D.prenda = D.prenda || {};
          D._blobs = { frente: b[0], espalda: b[1] };
          D.prenda._frenteUrl = URL.createObjectURL(b[0]);
          D.prenda._espaldaUrl = b[1] ? URL.createObjectURL(b[1]) : '';
          D.prenda.w = C.w; D.prenda.h = C.h; D.prenda.gancho = C.gancho;
          D.prenda.frente = 'pendiente'; if (b[1]) D.prenda.espalda = 'pendiente'; else delete D.prenda.espalda;
          est2.textContent = 'Listo. Revisa que no quede verde en los bordes; si queda, sube la fuerza del recorte.';
          t(); mostrarPrenda(); pintarEncaje();
        });
      }).catch(function (e) { est2.textContent = ''; A.falla(e); });
    }
    var bF = el('button', { type: 'button', class: 'claro', text: 'Foto de frente' }), bE = el('button', { type: 'button', class: 'claro', text: 'Foto de espalda' });
    bF.addEventListener('click', function () { elegirArchivo('image/*', function (f) { abrirImagen(f).then(function (im) { orig.frente = im; if (!orig.espalda && D.prenda && D.prenda.espalda && D.prenda.espalda !== 'pendiente') { delete D.prenda.espalda; } return procesar(); }).catch(A.falla); }); });
    bE.addEventListener('click', function () {
      if (!orig.frente) return A.msg('Primero sube (o vuelve a subir) la foto de frente: la espalda se alinea con ella', true);
      elegirArchivo('image/*', function (f) { abrirImagen(f).then(function (im) { orig.espalda = im; return procesar(); }).catch(A.falla); });
    });
    var rFuerza = el('input', { type: 'range', min: '0.6', max: '1.8', step: '0.1', value: '1' });
    rFuerza.addEventListener('change', function () { fuerza = Number(rFuerza.value); procesar(); });
    p2.appendChild(el('h4', {}, [el('span', { class: 'vsA-n', text: '2' }), 'La prenda en el gancho']));
    p2.appendChild(el('p', { class: 'vsA-ay', text: 'Fotos de la prenda colgada en fondo verde, de frente y de espalda (mismo encuadre). El fondo se quita aquí mismo y la espalda queda alineada con el frente.' }));
    p2.appendChild(el('div', { class: 'vsA-dos' }, [
      el('div', { class: 'vsA-prenda' }, [caja.frente, bF]),
      el('div', { class: 'vsA-prenda' }, [caja.espalda, bE]),
    ]));
    p2.appendChild(el('label', { class: 'vsA-campo' }, ['Fuerza del recorte', el('div', { class: 'vsA-fila' }, [el('small', { text: 'suave' }), rFuerza, el('small', { text: 'fuerte' })])]));
    p2.appendChild(est2);
    ed.appendChild(p2);

    // Paso 3 · el video de la sesión
    var p3 = el('div', { class: 'vsA-paso' });
    var est3 = el('p', { class: 'vsA-ay' });
    var prog = el('i'), barra = el('div', { class: 'vsA-prog', hidden: true }, [prog]);
    var rFin = el('input', { type: 'range', min: '0', max: '1', step: '0.01', value: '1' });
    var tFin = el('b', { text: '' });
    var vel = el('select', {}, [el('option', { value: '1', text: 'Normal' }), el('option', { value: '0.75', text: 'Lenta (0,75×)' }), el('option', { value: '0.5', text: 'Muy lenta (0,5×)' })]);
    var gris = el('input', { type: 'checkbox', style: 'width:auto;flex:none' });
    var vistaFin = el('div', { class: 'vsA-esc', style: 'width:min(100%,12rem)' });
    var bV = el('button', { type: 'button', class: 'claro', text: D.foto ? 'Cambiar video' : 'Elegir video' });
    function syncVideoUI() {
      p3.classList.toggle('ok', !!(D.foto && D.foto.video));
      if (!D.foto) { rFin.disabled = true; return; }
      vel.value = String(D.foto.velocidad || 1); gris.checked = D.foto.fondo === 'gris';
      rFin.disabled = false;
    }
    var vMed = null; // video para medir (local o el ya subido)
    function prepararMedidor() {
      if (!D.foto || !D.foto.video) return Promise.resolve();
      var src = vidLocal ? vidLocal.url : D.foto.video;
      return cargarVideo(src).then(function (v) {
        vMed = v;
        rFin.max = String(Math.floor(v.duration * 100) / 100);
        var fin = D.foto.fin || Math.max(0.3, v.duration - 0.05);
        rFin.value = String(fin); tFin.textContent = fin.toFixed(2) + ' s de ' + v.duration.toFixed(1) + ' s';
        return verFin();
      }).catch(function (e) { est3.textContent = e.message; });
    }
    var finTimer = 0;
    function verFin() {
      if (!vMed) return Promise.resolve();
      var fin = Number(rFin.value);
      return irA(vMed, fin).then(function () {
        vistaFin.textContent = ''; vistaFin.style.aspectRatio = vMed.videoWidth + ' / ' + vMed.videoHeight;
        try { var c = cuadro(vMed); c.style.cssText = 'width:100%;height:100%;display:block'; vistaFin.appendChild(c); }
        catch (e) { var v2 = vMed; v2.style.cssText = 'width:100%;display:block'; vistaFin.appendChild(v2); }
        pintarPuntos();
      });
    }
    rFin.addEventListener('input', function () {
      var fin = Number(rFin.value); tFin.textContent = fin.toFixed(2) + ' s' + (vMed ? ' de ' + vMed.duration.toFixed(1) + ' s' : '');
      clearTimeout(finTimer); finTimer = setTimeout(function () {
        if (!D.foto) return;
        D.foto.fin = vMed && fin >= vMed.duration - 0.06 ? undefined : fin;
        D.foto.disparos = disparos(fin); t(); verFin();
      }, 120);
    });
    vel.addEventListener('change', function () { if (D.foto) { D.foto.velocidad = Number(vel.value); t(); } });
    gris.addEventListener('change', function () { if (D.foto) { if (gris.checked) D.foto.fondo = 'gris'; else delete D.foto.fondo; t(); } });
    bV.addEventListener('click', function () {
      elegirArchivo('video/mp4,video/quicktime,video/*', function (f) {
        est3.textContent = 'Revisando el video…';
        revisarCodec(f).then(function () {
          var url = URL.createObjectURL(f);
          return cargarVideo(url).then(function (v) {
            if (!v.videoWidth) throw new Error('Este navegador no pudo leer el video');
            if (v.videoWidth > v.videoHeight) A.msg('Ojo: el video es horizontal. La sesión se ve mejor en vertical (9:16).', true);
            return irA(v, 0).then(function () {
              var ini = cuadro(v);
              return aBlob(ini, 'image/jpeg', 0.9).then(function (bIni) {
                vidLocal = { file: f, url: url, ini: bIni, iniUrl: URL.createObjectURL(bIni) };
                var fin = Math.max(0.3, v.duration - 0.05);
                D.foto = { video: 'pendiente', inicio: vidLocal.iniUrl, src: vidLocal.iniUrl, w: v.videoWidth, h: v.videoHeight, velocidad: Number(vel.value) || 1, disparos: disparos(fin) };
                if (gris.checked) D.foto.fondo = 'gris';
                // Al cambiar de video, el encaje y los puntos se vuelven a ubicar
                D.encaje = null; D.puntoPrenda = null; if (D.tacon) delete D.tacon.punto; D.pruebas = []; if (typeof pintarRes7 === 'function') pintarRes7();
                bV.textContent = 'Cambiar video'; t(); syncVideoUI();
                var es4k = Math.max(v.videoWidth, v.videoHeight) >= 3000;
                est3.textContent = 'Video listo (' + (f.size / 1048576).toFixed(1) + ' MB, ' + v.videoWidth + '×' + v.videoHeight + (es4k ? ', 4K' : '') + '). Se sube al tocar "Aplicar"' + (f.size > 80 * 1048576 ? ': por su peso puede tardar unos minutos, deja esta pantalla abierta.' : '.');
                pintarEncaje(); return prepararMedidor();
              });
            });
          });
        }).catch(function (e) { est3.textContent = ''; A.falla(e); });
      });
    });
    p3.appendChild(el('h4', {}, [el('span', { class: 'vsA-n', text: '3' }), 'El video de la sesión']));
    p3.appendChild(el('p', { class: 'vsA-ay', text: 'MP4 vertical (H.264), hasta 4K y 500 MB, fondo blanco o claro, de 5 a 20 segundos. El primer cuadro se toma solo: ahí aterriza la prenda. Elige dónde termina: la modelo queda quieta en ese cuadro, con las etiquetas.' }));
    p3.appendChild(el('div', { class: 'vsA-fila' }, [bV]));
    p3.appendChild(barra);
    p3.appendChild(est3);
    p3.appendChild(el('label', { class: 'vsA-campo' }, ['Dónde termina (pose final)', el('div', { class: 'vsA-fila' }, [rFin]), tFin]));
    p3.appendChild(vistaFin);
    p3.appendChild(el('label', { class: 'vsA-campo' }, ['Velocidad', vel]));
    p3.appendChild(el('label', { class: 'vsA-fila', style: 'font-size:.9rem' }, [gris, 'El video tiene fondo gris: fundir los bordes con el blanco de la página']));
    ed.appendChild(p3);

    // Paso 4 · dónde cae la prenda (primer cuadro)
    var p4 = el('div', { class: 'vsA-paso' });
    var esc4 = el('div', { class: 'vsA-esc' });
    var rTam = el('input', { type: 'range', min: '20', max: '200', step: '1', value: '60' });
    function pintarEncaje() {
      esc4.textContent = '';
      p4.classList.toggle('ok', !!D.encaje);
      if (!D.foto || !D.prenda || !D.prenda.frente) { esc4.style.aspectRatio = '9 / 16'; esc4.appendChild(el('p', { class: 'vsA-ay', style: 'padding:1rem', text: 'Primero sube la prenda (paso 2) y el video (paso 3).' })); return; }
      var F = D.foto, P = D.prenda;
      esc4.style.aspectRatio = F.w + ' / ' + F.h;
      esc4.appendChild(el('img', { src: F.inicio || F.src, alt: '' }));
      if (!D.encaje) { var w0 = Math.round(F.w * 0.62); D.encaje = { x: Math.round((F.w - w0) / 2), y: Math.round(F.h * 0.12), w: w0 }; }
      var E = D.encaje, g = el('img', { class: 'vsA-gar', src: P._frenteUrl || P.frente, alt: '', draggable: 'false' });
      var poner = function () { g.style.left = (E.x / F.w * 100) + '%'; g.style.top = (E.y / F.h * 100) + '%'; g.style.width = (E.w / F.w * 100) + '%'; };
      poner(); esc4.appendChild(g);
      rTam.value = String(Math.round(E.w / F.w * 100));
      rTam.oninput = function () { var cx = E.x + E.w / 2, nw = Math.round(F.w * Number(rTam.value) / 100); E.x = Math.round(cx - nw / 2); E.w = nw; poner(); t(); };
      var ptrs = {}, ini = null;
      var escala = function () { return F.w / esc4.clientWidth; };
      g.onpointerdown = function (e) {
        e.preventDefault(); g.setPointerCapture(e.pointerId); ptrs[e.pointerId] = [e.clientX, e.clientY];
        ini = { E: { x: E.x, y: E.y, w: E.w }, p: copia(ptrs) };
      };
      g.onpointermove = function (e) {
        if (!ptrs[e.pointerId] || !ini) return;
        ptrs[e.pointerId] = [e.clientX, e.clientY];
        var ids = Object.keys(ptrs), k = escala();
        if (ids.length === 1 && ini.p[ids[0]]) {
          E.x = Math.round(ini.E.x + (ptrs[ids[0]][0] - ini.p[ids[0]][0]) * k);
          E.y = Math.round(ini.E.y + (ptrs[ids[0]][1] - ini.p[ids[0]][1]) * k);
        } else if (ids.length >= 2 && ini.p[ids[0]] && ini.p[ids[1]]) { // pellizco: cambia el tamaño
          var dist = function (a, b) { return Math.hypot(a[0] - b[0], a[1] - b[1]) || 1; };
          var s = dist(ptrs[ids[0]], ptrs[ids[1]]) / dist(ini.p[ids[0]], ini.p[ids[1]]);
          var nw = Math.max(20, Math.round(ini.E.w * s)), cx = ini.E.x + ini.E.w / 2;
          E.w = nw; E.x = Math.round(cx - nw / 2); rTam.value = String(Math.round(nw / F.w * 100));
        }
        poner(); t();
      };
      g.onpointerup = g.onpointercancel = function (e) { delete ptrs[e.pointerId]; ini = { E: { x: E.x, y: E.y, w: E.w }, p: copia(ptrs) }; };
      p4.classList.add('ok');
    }
    p4.appendChild(el('h4', {}, [el('span', { class: 'vsA-n', text: '4' }), 'Dónde cae la prenda']));
    p4.appendChild(el('p', { class: 'vsA-ay', text: 'Arrastra la prenda transparente hasta que quede encima del vestido de la modelo (cuello con cuello, ruedo con ruedo). Cámbiale el tamaño con la barra o pellizcando. Así la transición empalma con el video.' }));
    p4.appendChild(esc4);
    p4.appendChild(el('label', { class: 'vsA-campo' }, ['Tamaño de la prenda', rTam]));
    ed.appendChild(p4);

    // Paso 5 · tacón MF
    var p5 = el('div', { class: 'vsA-paso' });
    var selT = el('select', {}), selTC = el('select', {});
    selT.appendChild(el('option', { value: '', text: '— Sin tacón —' }));
    calz.forEach(function (p) { selT.appendChild(el('option', { value: p.id, text: p.nombre + (p.visible ? '' : ' (oculto)') })); });
    selT.value = (D.tacon && D.tacon.id) || '';
    function pintarColTac() {
      var p = porId(selT.value); selTC.textContent = '';
      selTC.appendChild(el('option', { value: '', text: 'Color que lleva la modelo (opcional)' }));
      ((p && p.colores) || []).forEach(function (c) { selTC.appendChild(el('option', { value: c.n, text: c.n })); });
      selTC.value = (D.tacon && D.tacon.color) || '';
      selTC.disabled = !p;
    }
    pintarColTac();
    selT.addEventListener('change', function () {
      if (!selT.value) D.tacon = null;
      else { var punto = D.tacon && D.tacon.punto, fotos = (D.tacon && D.tacon.fotos) || []; D.tacon = { id: selT.value, fotos: fotos }; if (punto) D.tacon.punto = punto; }
      t(); pintarColTac(); pintarGal(); pintarPuntos(); pintarChips();
    });
    selTC.addEventListener('change', function () { if (D.tacon) { if (selTC.value) D.tacon.color = selTC.value; else delete D.tacon.color; t(); } });
    var gal = el('div', { class: 'vsA-gal' });
    var pendientesT = []; // fotos/videos del tacón por subir
    function pintarGal() {
      gal.textContent = '';
      if (!D.tacon) return;
      (D.tacon.fotos || []).forEach(function (f, i) {
        var u = typeof f === 'string' ? f : (f.u || f.v), esV = typeof f === 'object' && f.v;
        var quitar = el('button', { type: 'button', class: 'claro', text: 'Quitar' });
        quitar.addEventListener('click', function () { D.tacon.fotos.splice(i, 1); t(); pintarGal(); });
        gal.appendChild(el('figure', {}, [esV ? el('video', { src: u, muted: true, playsinline: true, preload: 'metadata' }) : el('img', { src: u, alt: '' }), quitar]));
      });
      pendientesT.forEach(function (x, i) {
        var quitar = el('button', { type: 'button', class: 'claro', text: 'Quitar' });
        quitar.addEventListener('click', function () { pendientesT.splice(i, 1); pintarGal(); });
        gal.appendChild(el('figure', {}, [x.video ? el('video', { src: x.url, muted: true, playsinline: true }) : el('img', { src: x.url, alt: '' }), quitar]));
      });
    }
    var bTF = el('button', { type: 'button', class: 'claro', text: '+ Foto o video del tacón' });
    bTF.addEventListener('click', function () {
      if (!D.tacon) return A.msg('Primero elige el tacón', true);
      elegirArchivo('image/*,video/mp4,video/quicktime', function (f) {
        var esV = /^video\//.test(f.type);
        (esV ? revisarCodec(f) : Promise.resolve()).then(function () { pendientesT.push({ file: f, video: esV, url: URL.createObjectURL(f) }); t(); pintarGal(); }).catch(A.falla);
      });
    });
    p5.appendChild(el('h4', {}, [el('span', { class: 'vsA-n', text: '5' }), 'El tacón MF']));
    p5.appendChild(el('label', { class: 'vsA-campo' }, ['Tacón de la tienda', selT]));
    p5.appendChild(selTC);
    p5.appendChild(el('p', { class: 'vsA-ay', text: 'Fotos o un video corto del tacón en la sesión (opcional): salen primero en su ficha; las del catálogo se agregan solas detrás.' }));
    p5.appendChild(gal); p5.appendChild(bTF);
    pintarGal();
    ed.appendChild(p5);

    // Paso 6 · etiquetas sobre el cuadro final
    var p6 = el('div', { class: 'vsA-paso' });
    var esc6 = el('div', { class: 'vsA-esc' });
    var modo = '';
    var bPV = el('button', { type: 'button', class: 'vsA-marca', text: 'Marcar el vestido' }), bPT = el('button', { type: 'button', class: 'vsA-marca', text: 'Marcar el tacón' });
    function pintarPuntos() {
      esc6.textContent = ''; esc6.classList.toggle('marca', !!modo);
      bPV.classList.toggle('esperando', modo === 'v'); bPT.classList.toggle('esperando', modo === 't');
      bPT.disabled = !D.tacon;
      p6.classList.toggle('ok', !!(D.puntoPrenda && (!D.tacon || D.tacon.punto)));
      if (!D.foto) { esc6.style.aspectRatio = '9 / 16'; esc6.appendChild(el('p', { class: 'vsA-ay', style: 'padding:1rem', text: 'Primero sube el video (paso 3).' })); return; }
      var F = D.foto; esc6.style.aspectRatio = F.w + ' / ' + F.h;
      var fondo = vistaFin.querySelector('canvas');
      if (fondo) { var cp = document.createElement('canvas'); cp.width = fondo.width; cp.height = fondo.height; cp.getContext('2d').drawImage(fondo, 0, 0); cp.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none'; esc6.appendChild(cp); }
      else esc6.appendChild(el('img', { src: F.inicio || F.src, alt: '' }));
      var pin = function (p, txt, cls) { if (!p) return; esc6.appendChild(el('span', { class: 'vsA-pin ' + cls, text: txt, style: 'left:' + (p[0] / F.w * 100) + '%;top:' + (p[1] / F.h * 100) + '%' })); };
      pin(D.puntoPrenda, '1 · Vestido', 'v');
      pin(D.tacon && D.tacon.punto, '2 · Tacón', 't');
    }
    esc6.addEventListener('click', function (e) {
      if (!modo || !D.foto) return;
      var r = esc6.getBoundingClientRect(), F = D.foto;
      var p = [Math.round((e.clientX - r.left) / r.width * F.w), Math.round((e.clientY - r.top) / r.height * F.h)];
      if (modo === 'v') D.puntoPrenda = p; else if (D.tacon) D.tacon.punto = p;
      modo = ''; t(); pintarPuntos();
    });
    bPV.addEventListener('click', function () { modo = modo === 'v' ? '' : 'v'; pintarPuntos(); });
    bPT.addEventListener('click', function () { modo = modo === 't' ? '' : 't'; pintarPuntos(); });
    p6.appendChild(el('h4', {}, [el('span', { class: 'vsA-n', text: '6' }), 'Etiquetas en la pose final']));
    p6.appendChild(el('p', { class: 'vsA-ay', text: 'Toca "Marcar el vestido" y luego toca el vestido en la foto; haz lo mismo con el tacón (sobre el pie). Ahí aparecen las etiquetas de compra: primero el vestido, luego el tacón.' }));
    p6.appendChild(el('div', { class: 'vsA-fila' }, [bPV, bPT]));
    p6.appendChild(esc6);
    ed.appendChild(p6);


    // Paso 7 · Cabina: la modelo se prueba otros tacones MF (IA en Google Cloud, sobre el cuadro final)
    var p7 = el('div', { class: 'vsA-paso' });
    var elegidos = {}, chips7 = el('div', { class: 'vsA-chips' }), res7 = el('div', { class: 'vsA-gal' }), est7 = el('p', { class: 'vsA-ay' });
    var bIA = el('button', { type: 'button', class: 'vsA-marca', text: '✨ Crear pruebas con IA' });
    D.pruebas = D.pruebas || [];
    function pintarChips() {
      chips7.textContent = '';
      calz.filter(function (p) { return fotoDe(p) && (!D.tacon || p.id !== D.tacon.id); }).forEach(function (p) {
        var ya = D.pruebas.some(function (x) { return x.id === p.id; });
        var b = el('button', { type: 'button', class: 'vsA-chip', 'aria-pressed': elegidos[p.id] ? 'true' : 'false' }, [el('img', { src: fotoDe(p), alt: '', loading: 'lazy' }), el('span', { text: p.nombre + (ya ? ' ✓' : '') })]);
        b.addEventListener('click', function () {
          if (!elegidos[p.id] && Object.keys(elegidos).length >= 8) return A.msg('Máximo 8 tacones por tanda', true);
          if (elegidos[p.id]) delete elegidos[p.id]; else elegidos[p.id] = 1; pintarChips();
        });
        chips7.appendChild(b);
      });
      var n = Object.keys(elegidos).length;
      bIA.textContent = n ? '✨ Crear ' + n + (n === 1 ? ' prueba' : ' pruebas') + ' con IA' : '✨ Crear pruebas con IA';
      bIA.disabled = !n;
    }
    function pintarRes7() {
      res7.textContent = '';
      D.pruebas.forEach(function (x, i) {
        var q = el('button', { type: 'button', class: 'claro', text: 'Quitar' });
        q.addEventListener('click', function () { D.pruebas.splice(i, 1); t(); pintarRes7(); pintarChips(); });
        res7.appendChild(el('figure', {}, [el('img', { src: x.img, alt: '' }), el('small', { text: x.n || x.id }), q]));
      });
      p7.classList.toggle('ok', D.pruebas.length > 0);
    }
    // El recorte de piernas y pies (3:4) alrededor del punto del tacón
    function recorteDe(W, H, pt) {
      var bottom = Math.min(H, Math.round(pt[1] + H * 0.14)), ch = Math.min(bottom, Math.round(H * 0.46)), cw = Math.round(ch * 3 / 4);
      if (cw > W) { cw = W; ch = Math.round(cw * 4 / 3); }
      var y = Math.max(0, bottom - ch), x = Math.min(Math.max(0, Math.round(pt[0] - cw / 2)), W - cw);
      return { x: x, y: y, w: cw, h: ch };
    }
    function abrirRemota(u) {
      return new Promise(function (ok, mal) { var im = new Image(); im.crossOrigin = 'anonymous'; im.onload = function () { ok(im); }; im.onerror = function () { mal(new Error('No se pudo abrir la prueba creada')); }; im.src = u; });
    }
    // Pega la prueba sobre el cuadro final con bordes difuminados (cara, vestido y fondo quedan idénticos al video)
    function pegar(base, im, R) {
      var c = document.createElement('canvas'); c.width = base.width; c.height = base.height;
      var g = c.getContext('2d'); g.drawImage(base, 0, 0);
      var o = document.createElement('canvas'); o.width = R.w; o.height = R.h;
      var go = o.getContext('2d', { willReadFrequently: true }); go.drawImage(im, 0, 0, R.w, R.h);
      var d = go.getImageData(0, 0, R.w, R.h), px = d.data, f = Math.max(8, Math.round(R.w * 0.09));
      var sube = R.y > 0, izq = R.x > 0, der = R.x + R.w < base.width, baja = R.y + R.h < base.height;
      var rampa = function (v) { v = Math.max(0, Math.min(1, v / f)); return v * v * (3 - 2 * v); };
      for (var y = 0; y < R.h; y++) for (var x = 0; x < R.w; x++) {
        var a = 1;
        if (sube) a *= rampa(y); if (baja) a *= rampa(R.h - 1 - y); if (izq) a *= rampa(x); if (der) a *= rampa(R.w - 1 - x);
        if (a < 1) px[(y * R.w + x) * 4 + 3] = Math.round(255 * a);
      }
      go.putImageData(d, 0, 0); g.drawImage(o, R.x, R.y);
      return c;
    }
    bIA.addEventListener('click', function () {
      if (!D.foto || !D.foto.video) return A.msg('Primero sube el video (paso 3)', true);
      if (!D.tacon || !D.tacon.punto) return A.msg('Primero elige el tacón y marca su etiqueta (pasos 5 y 6)', true);
      if (!vMed) return A.msg('Espera a que cargue el video', true);
      var ids = Object.keys(elegidos); if (!ids.length) return;
      bIA.disabled = true; est7.textContent = 'Tomando el cuadro final…';
      var base, R, trabajo = 'IA-' + Math.random().toString(36).slice(2, 12);
      irA(vMed, Number(rFin.value)).then(function () {
        base = cuadro(vMed); R = recorteDe(base.width, base.height, D.tacon.punto);
        var cr = document.createElement('canvas'); cr.width = R.w; cr.height = R.h;
        cr.getContext('2d').drawImage(base, R.x, R.y, R.w, R.h, 0, 0, R.w, R.h);
        return aBlob(cr, 'image/jpeg', 0.92);
      }).then(function (bl) {
        if (!bl) throw new Error('El navegador no dejó leer el video. Vuelve a elegir el video desde tu teléfono.');
        est7.textContent = 'Subiendo el cuadro…'; return subirDirecto(bl, 'image/jpeg');
      }).then(function (url) {
        var tac = ids.map(function (id) { var p = porId(id); return { id: id, n: p ? p.nombre : id, foto: fotoDe(p) }; });
        return A.api('tacones-ia-background', { method: 'POST', body: { trabajo: trabajo, cuadro: url, tacones: tac } });
      }).then(function () {
        var t0 = Date.now();
        return new Promise(function (ok, mal) {
          (function mirar() {
            var seg = Math.round((Date.now() - t0) / 1000);
            est7.textContent = 'La IA está probándole los tacones a la modelo… (' + seg + ' s; tarda unos 30 s por tacón)';
            A.api('fotos-ia-estado?trabajo=' + trabajo).then(function (r) {
              if (r.listo) return r.error ? mal(new Error(r.error)) : ok(r);
              if (Date.now() - t0 > 14 * 60 * 1000) return mal(new Error('La IA tardó demasiado. Intenta con menos tacones.'));
              setTimeout(mirar, 5000);
            }).catch(function () { setTimeout(mirar, 8000); });
          })();
        });
      }).then(function (r) {
        var fotos = r.fotos || [], cola = Promise.resolve();
        fotos.forEach(function (f, i) {
          cola = cola.then(function () {
            est7.textContent = 'Ajustando la prueba ' + (i + 1) + ' de ' + fotos.length + ' sobre el video…';
            return abrirRemota(f.url).then(function (im) { return aBlob(pegar(base, im, R), 'image/jpeg', 0.9); })
              .then(function (bl) { return subirDirecto(bl, 'image/jpeg'); })
              .then(function (u) {
                var p = porId(f.id), rp = respaldoProducto(p, f.id);
                D.pruebas = D.pruebas.filter(function (x) { return x.id !== f.id; });
                D.pruebas.push({ id: f.id, n: rp.n, p: rp.p, colores: rp.colores, tallas: rp.tallas, agotadas: rp.agotadas, img: u, mini: fotoDe(p) || undefined });
                t(); pintarRes7();
              });
          });
        });
        return cola.then(function () {
          var malos = (r.errores || []).map(function (e) { var p = porId(e.id); return (p ? p.nombre : e.id) + ': ' + e.error; });
          var dudas = fotos.filter(function (f) { return f.revisada === false; }).map(function (f) { var p = porId(f.id); return p ? p.nombre : f.id; });
          est7.textContent = fotos.length + ' prueba(s) lista(s).' + (dudas.length ? ' Revisa con cuidado: ' + dudas.join(', ') + ' (el revisor no quedó seguro).' : '') + (malos.length ? ' No salieron: ' + malos.join(' · ') : '');
          elegidos = {}; pintarChips(); bIA.disabled = false;
        });
      }).catch(function (e) { est7.textContent = ''; bIA.disabled = false; A.falla(e); });
    });
    p7.appendChild(el('h4', {}, [el('span', { class: 'vsA-n', text: '7' }), 'Pruébatelo con otros tacones (IA)']));
    p7.appendChild(el('p', { class: 'vsA-ay', text: 'Elige tacones MF y la IA se los pone a la modelo en la pose final (solo cambia los zapatos; cara, vestido y fondo quedan idénticos). En la página aparecen como "Pruébatelo": la clienta toca un tacón y la modelo lo lleva puesto. Se cobra en tu Google Cloud, no en créditos de Netlify. Revisa cada prueba y quita las que no queden perfectas.' }));
    p7.appendChild(chips7); p7.appendChild(bIA); p7.appendChild(est7); p7.appendChild(res7);
    pintarChips(); pintarRes7();
    ed.appendChild(p7);

    // Aplicar: sube lo pendiente, completa los datos de respaldo del catálogo y vuelve a la lista
    var aplicar = el('button', { type: 'button', text: idx > -1 ? 'Aplicar cambios' : 'Agregar look' });
    var estA = el('p', { class: 'vsA-ay' });
    aplicar.addEventListener('click', function () {
      D.nombre = (nombre.value || '').trim();
      var vSel = selV.value;
      if (!D.nombre) return A.msg('Ponle un nombre al look', true);
      if (!vSel) return A.msg('Elige el vestido de la tienda', true);
      if (!D.prenda || !D.prenda.frente) return A.msg('Sube la foto de frente de la prenda', true);
      if (!D.foto || !D.foto.video) return A.msg('Sube el video de la sesión', true);
      if (!D.encaje) return A.msg('Ubica la prenda sobre la modelo (paso 4)', true);
      if (!D.puntoPrenda) return A.msg('Marca dónde va la etiqueta del vestido (paso 6)', true);
      if (D.tacon && !D.tacon.punto) return A.msg('Marca dónde va la etiqueta del tacón (paso 6)', true);
      aplicar.disabled = true; barra.hidden = false; prog.style.width = '0%';
      var paso = function (txt) { estA.textContent = txt; A.msg(txt); };
      var cola = Promise.resolve();
      if (D._blobs) {
        cola = cola.then(function () { paso('Subiendo la prenda…'); return subirDirecto(D._blobs.frente, D._blobs.frente.type); })
          .then(function (u) { D.prenda.frente = u; return D._blobs.espalda ? subirDirecto(D._blobs.espalda, D._blobs.espalda.type) : null; })
          .then(function (u) { if (u) D.prenda.espalda = u; });
      }
      if (vidLocal) {
        cola = cola.then(function () { paso('Subiendo el primer cuadro…'); return subirDirecto(vidLocal.ini, 'image/jpeg'); })
          .then(function (u) { D.foto.inicio = D.foto.src = u; paso('Subiendo el video… (no cierres esta pantalla)'); return subirDirecto(vidLocal.file, 'video/mp4', prog); })
          .then(function (u) { D.foto.video = u; });
      }
      pendientesT.slice().forEach(function (x) {
        cola = cola.then(function () {
          paso('Subiendo fotos del tacón…');
          return x.video ? subirDirecto(x.file, 'video/mp4', prog) : A.subirFoto(x.file);
        }).then(function (u) { if (D.tacon) D.tacon.fotos = (D.tacon.fotos || []).concat([x.video ? { v: u } : u]); pendientesT.splice(pendientesT.indexOf(x), 1); });
      });
      cola.then(function () {
        // Datos de respaldo del catálogo (la página los vuelve a tomar en vivo)
        var pv = porId(vSel), venta = respaldoProducto(pv, vSel);
        venta.color = D.color ? D.color.n : '';
        var fotosV = [{ u: D.prenda.frente, fit: 'contain' }]; if (D.prenda.espalda) fotosV.push({ u: D.prenda.espalda, fit: 'contain' });
        venta.fotos = fotosV; venta.fotosColor = {}; if (venta.color) venta.fotosColor[venta.color] = fotosV;
        D.prenda.venta = venta; D.prenda.n = venta.n;
        D.grupo = vSel; // el mismo vestido en varios colores: un solo gancho
        if (D.tacon) {
          var pt = porId(D.tacon.id), rt = respaldoProducto(pt, D.tacon.id);
          ['n', 'p', 'colores', 'tallas', 'agotadas'].forEach(function (k) { D.tacon[k] = rt[k]; });
          D.tacon.mini = D.tacon.mini && !/^blob:/.test(D.tacon.mini) ? D.tacon.mini : fotoDe(pt);
          if (!D.tacon.mini) delete D.tacon.mini;
        }
        if (D.foto && !D.foto.disparos) D.foto.disparos = disparos(D.foto.fin || 6);
        delete D._blobs; delete D._venta;
        if (D.prenda) { delete D.prenda._frenteUrl; delete D.prenda._espaldaUrl; }
        if (idx > -1) S.lista[idx] = D; else S.lista.push(D);
        S.sucio = true; pintar();
        A.msg('Look listo ✓ Toca "Guardar vestidos" para publicarlo.');
      }).catch(function (e) { aplicar.disabled = false; barra.hidden = true; estA.textContent = ''; A.falla(e); });
    });
    ed.appendChild(el('div', { class: 'vsA-bar' }, [aplicar, estA]));

    mostrarPrenda(); syncVideoUI(); pintarEncaje(); pintarPuntos();
    prepararMedidor();
  }

  function respaldoProducto(p, id) {
    if (!p) return { id: id, n: id };
    var stock = p.stock || {}, tallas = Object.keys(stock);
    var orden = function (a, b) { var ia = TALLAS_ROPA.indexOf(a), ib = TALLAS_ROPA.indexOf(b); return ia > -1 || ib > -1 ? ia - ib : Number(a) - Number(b); };
    tallas.sort(orden);
    return { id: p.id, n: p.nombre, p: Number(p.precio) || undefined, colores: (p.colores || []).map(function (c) { return c.n; }), tallas: tallas, agotadas: tallas.filter(function (t) { return !(stock[t] > 0); }) };
  }

  window.mfAdminVestidos = { cargar: cargar };
})();
