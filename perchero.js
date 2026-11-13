/* EL PERCHERO del inicio (inspirado en las tiendas "Your store, but it moves"):
   - Un riel curvo bajo un cielo rosado, con los zapatos colgados de ganchos. Giran como carrusel (solos, con flechas,
     deslizando o con la rueda del mouse); el del centro se ve grande y de frente, los de los lados de perfil, y todos se mecen.
   - "Ver modelo": el zapato viaja a la izquierda (arriba en el celular) y entra un panel con colores, tallas,
     "Agregar a la bolsa" (el carrito de siempre: add(), Meta Pixel incluido) y "Ver todos los detalles" (la página del producto).
   - Salen los mismos productos de "La vitrina" (lista del panel → DATA/recortes.js → automático) y la reemplaza en el inicio.
   - El fondo blanco de cada foto se quita en el navegador; si una foto no tiene fondo blanco, cuelga como una tarjeta.
   No cambia datos, precios, ids, stock ni pagos. Si este archivo falla, la tienda sigue igual (con La vitrina de siempre). */
(function () {
  'use strict';
  if (window.__mfPerchero) return; window.__mfPerchero = 1;
  var app = document.getElementById('app');
  if (!app) return;

  var reduce = false;
  try { reduce = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { /* sin matchMedia */ }
  var E = function (t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (m) { return '&#' + m.charCodeAt(0) + ';'; }); };
  var money = function (n) { return '$' + Math.round(Number(n) || 0).toLocaleString('es-CO'); };
  var EASE = 'cubic-bezier(.22,.8,.18,1)';

  /* ================= estilos ================= */
  var css = [
    '.pc{position:relative;height:var(--pc-h,86svh);min-height:560px;max-height:980px;overflow:hidden;isolation:isolate;user-select:none;-webkit-user-select:none;touch-action:pan-y;color:#0a0a0a;',
    '  background:radial-gradient(120% 55% at 50% 108%,#f7cfae 0%,rgba(247,207,174,0) 62%),radial-gradient(70% 45% at 85% 18%,rgba(255,226,216,.6),rgba(255,226,216,0) 70%),linear-gradient(180deg,#ecb6b4 0%,#f3c6bd 32%,#f7d6c6 56%,#f2b9a2 82%,#eba48d 100%)}',
    'body.pc-on [data-rnew="home"] .vt{display:none!important}',
    '.pc-sky{position:absolute;inset:-4%;z-index:0;pointer-events:none;transition:transform 1.2s ' + EASE + '}',
    '.pc-cl{position:absolute;border-radius:50%;filter:blur(18px);opacity:.85}',
    '.pc-dr{animation:pcDrift linear infinite alternate}',
    '@keyframes pcDrift{from{transform:translateX(-5vw)}to{transform:translateX(5vw)}}',
    '.pc-bank{position:absolute;left:-10%;right:-10%;bottom:-6%;height:40%;filter:blur(6px);background:',
    '  radial-gradient(18% 40% at 8% 60%,#fde6d2 0%,rgba(253,230,210,0) 70%),radial-gradient(22% 46% at 27% 72%,#fad7bd 0%,rgba(250,215,189,0) 70%),',
    '  radial-gradient(20% 50% at 47% 80%,#f8ccb0 0%,rgba(248,204,176,0) 70%),radial-gradient(24% 48% at 69% 66%,#fde0c9 0%,rgba(253,224,201,0) 70%),',
    '  radial-gradient(22% 52% at 91% 62%,#f9d3b7 0%,rgba(249,211,183,0) 70%),radial-gradient(60% 50% at 50% 100%,#f0a990 0%,rgba(240,169,144,0) 80%)}',
    '.pc-glow{position:absolute;inset:0;background:radial-gradient(50% 35% at 50% 60%,rgba(255,238,226,.5),rgba(255,238,226,0) 70%)}',
    '.pc-logo{position:absolute;left:50%;z-index:3;transform:translateX(-50%);height:var(--pc-lg,64px);width:auto;pointer-events:none;filter:drop-shadow(0 2px 16px rgba(150,60,50,.25));transition:opacity .6s ' + EASE + ',transform .9s ' + EASE + '}',
    '.pc-rail{position:absolute;inset:0;width:100%;height:100%;z-index:2;pointer-events:none;transition:opacity .8s ' + EASE + '}',
    '.pc-it{position:absolute;left:0;top:0;z-index:4;display:block;border:0;margin:0;padding:0;background:none;cursor:pointer;color:inherit;outline:none;-webkit-tap-highlight-color:transparent;transform-origin:50% 0;',
    '  transition:transform 1s ' + EASE + ',opacity .7s ' + EASE + ';will-change:transform}',
    '.pc-it:focus-visible .pc-fig{outline:1px solid #0a0a0a;outline-offset:6px}',
    '.pc-sw{position:absolute;inset:0;transform-origin:50% 0}',
    '.pc-hk{position:absolute;left:50%;top:0;width:24%;height:var(--pc-cord,18%);transform:translateX(-50%);overflow:visible}',
    '.pc-3d{position:absolute;left:0;right:0;bottom:0;top:var(--pc-cord,18%);perspective:900px}',
    '.pc-fig{position:absolute;inset:0;transform-origin:50% 0;transition:transform 1s ' + EASE + ',filter .6s;filter:drop-shadow(0 18px 18px rgba(110,45,40,.18))}',
    '.pc-fig img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;object-position:50% 0;pointer-events:none;-webkit-user-drag:none;transition:opacity .35s}',
    '.pc-fig.card img{inset:4% 8% auto;width:84%;height:auto;aspect-ratio:1/1;object-fit:cover;border-radius:10px;background:#fff;box-shadow:0 10px 30px rgba(110,45,40,.18)}',
    '.pc-fig img.ld{opacity:0}',
    '.pc-now{position:absolute;left:50%;z-index:5;transform:translateX(-50%);width:min(92%,440px);text-align:center;transition:opacity .5s ' + EASE + '}',
    '.pc-now b{display:block;font:500 clamp(1.35rem,4.6vw,1.9rem)/1.12 "Cormorant Garamond",Georgia,serif;color:#1a0f0d}',
    '.pc-now i{display:block;font:normal 400 .78rem/1.4 Jost,system-ui,sans-serif;letter-spacing:.16em;text-transform:uppercase;color:rgba(60,25,20,.6);margin:.4rem 0 .9rem}',
    '.pc-go{display:inline-flex;align-items:center;gap:.5rem;min-height:2.6rem;padding:0 1.3rem;border:1px solid rgba(26,15,13,.6);border-radius:999px;background:rgba(255,245,240,.25);backdrop-filter:blur(4px);',
    '  font:500 .7rem/1 Jost,system-ui,sans-serif;letter-spacing:.2em;text-transform:uppercase;color:#1a0f0d;cursor:pointer;transition:background .3s,color .3s}',
    '.pc-go:hover{background:#0a0a0a;color:#fff}',
    '.pc-swap{animation:pcSwap .55s ' + EASE + '}@keyframes pcSwap{from{opacity:0;transform:translate(-50%,8px)}to{opacity:1;transform:translate(-50%,0)}}',
    '.pc-ar{position:absolute;top:46%;z-index:6;display:grid;place-items:center;width:2.6rem;height:2.6rem;border:0;border-radius:50%;background:rgba(255,242,236,.78);backdrop-filter:blur(6px);color:#1a0f0d;cursor:pointer;box-shadow:0 4px 18px rgba(120,50,40,.14);transition:opacity .5s,transform .3s}',
    '.pc-ar:hover{transform:scale(1.08)}.pc-ar svg{width:1rem;height:1rem;fill:none;stroke:currentColor;stroke-width:2}',
    '.pc-ar.p{left:clamp(.8rem,3vw,2rem)}.pc-ar.n{right:clamp(.8rem,3vw,2rem)}',
    '.pc-dots{position:absolute;left:50%;bottom:1.1rem;z-index:6;transform:translateX(-50%);display:flex;gap:6px;transition:opacity .5s}',
    '.pc-dots i{width:5px;height:5px;border-radius:50%;background:rgba(255,255,255,.6);transition:all .5s ' + EASE + '}.pc-dots i.on{width:18px;border-radius:3px;background:#fff}',
    /* modo explorar */
    '.pc.ex .pc-it:not(.cur){opacity:0!important;pointer-events:none}',
    '.pc.ex .pc-rail{opacity:.16}.pc.ex .pc-now,.pc.ex .pc-ar,.pc.ex .pc-dots{opacity:0;pointer-events:none}',
    '.pc.ex .pc-logo{opacity:0;transform:translate(-50%,-20px)}.pc.ex .pc-sky{transform:scale(1.05) translateX(-1%)}',
    '.pc-pn{position:absolute;z-index:10;top:50%;right:clamp(1rem,6vw,6rem);width:min(390px,42vw);max-height:calc(100% - 2.5rem);overflow:auto;overscroll-behavior:contain;',
    '  transform:translate(40px,-50%);opacity:0;pointer-events:none;visibility:hidden;',
    '  background:linear-gradient(160deg,rgba(255,244,240,.86),rgba(255,230,222,.76));backdrop-filter:blur(22px) saturate(1.2);-webkit-backdrop-filter:blur(22px) saturate(1.2);',
    '  border:1px solid rgba(255,255,255,.65);border-radius:16px;padding:1.6rem 1.5rem .6rem;box-shadow:0 30px 80px rgba(120,50,40,.22);',
    '  transition:transform .8s ' + EASE + ',opacity .6s ' + EASE + ',visibility 0s .8s;font-family:Jost,system-ui,sans-serif}',
    '.pc.ex .pc-pn{transform:translate(0,-50%);opacity:1;pointer-events:auto;visibility:visible;transition-delay:.18s,.18s,0s}',
    '.pc-x{position:absolute;top:.9rem;right:.9rem;display:grid;place-items:center;width:2rem;height:2rem;border:0;border-radius:50%;background:rgba(255,255,255,.75);cursor:pointer;color:#0a0a0a}',
    '.pc-x svg{width:.7rem;height:.7rem;stroke:currentColor;stroke-width:2}',
    '.pc-k{font:500 .62rem/1.3 Jost,system-ui,sans-serif;letter-spacing:.22em;text-transform:uppercase;color:rgba(40,18,14,.55);padding-right:2.4rem}',
    '.pc-pn h3{font:500 1.9rem/1.05 "Cormorant Garamond",Georgia,serif;margin:.45rem 0 .35rem;color:#0a0a0a}',
    '.pc-pr{font:500 1.05rem/1.2 Jost,system-ui,sans-serif;color:#0a0a0a}.pc-pr small{font-size:.66rem;font-weight:400;letter-spacing:.12em;text-transform:uppercase;color:rgba(40,18,14,.55);margin-left:.55rem}',
    '.pc-lb{display:flex;justify-content:space-between;gap:1rem;margin:1.35rem 0 .7rem;font:500 .62rem/1 Jost,system-ui,sans-serif;letter-spacing:.2em;text-transform:uppercase;color:rgba(40,18,14,.55)}',
    '.pc-lb b{color:#0a0a0a;font-weight:500;margin-left:.4rem}',
    '.pc-cs{display:flex;flex-wrap:wrap;gap:.7rem}',
    '.pc-c{position:relative;width:1.6rem;height:1.6rem;border:0;border-radius:50%;cursor:pointer;box-shadow:inset 0 0 0 1px rgba(0,0,0,.14);transition:transform .2s}',
    '.pc-c:hover{transform:scale(1.1)}.pc-c.on::after{content:"";position:absolute;inset:-5px;border-radius:50%;border:1.5px solid #0a0a0a}',
    '.pc-ts{position:relative;display:flex;align-items:center;height:2.2rem;border-radius:999px;background:#0a0a0a}',
    '.pc-ts button{position:relative;z-index:2;flex:1;height:100%;border:0;background:none;cursor:pointer;font:500 .74rem/1 Jost,system-ui,sans-serif;letter-spacing:.06em;color:rgba(255,255,255,.55);transition:color .3s}',
    '.pc-ts button.on{color:#fff}',
    '.pc-th{position:absolute;z-index:1;top:50%;left:0;width:2.9rem;height:2.9rem;margin:-1.45rem 0 0 -1.45rem;border-radius:50%;background:#0a0a0a;box-shadow:0 6px 16px rgba(0,0,0,.28);opacity:0;transition:left .55s ' + EASE + ',opacity .3s}',
    '.pc-ts.sel .pc-th{opacity:1}',
    '.pc-add{display:flex;justify-content:space-between;align-items:center;width:100%;margin-top:1.4rem;padding:1rem 1.3rem;border:0;border-radius:999px;background:#0a0a0a;color:#fff;cursor:pointer;',
    '  font:500 .72rem/1 Jost,system-ui,sans-serif;letter-spacing:.18em;text-transform:uppercase;box-shadow:0 12px 26px rgba(10,10,10,.22);transition:transform .2s,background .2s}',
    '.pc-add:hover{background:#2a2a2a}.pc-add:active{transform:scale(.98)}.pc-add[disabled]{background:rgba(10,10,10,.35);cursor:not-allowed;box-shadow:none}',
    '.pc-full{display:block;margin:1rem auto .5rem;border:0;background:none;cursor:pointer;font:500 .64rem/1 Jost,system-ui,sans-serif;letter-spacing:.2em;text-transform:uppercase;text-decoration:underline;text-underline-offset:.4em;color:rgba(40,18,14,.7)}',
    '.pc-pn details{border-top:1px solid rgba(40,18,14,.12);font-size:.86rem}.pc-pn details:last-of-type{border-bottom:1px solid rgba(40,18,14,.12)}',
    '.pc-pn summary{list-style:none;display:flex;justify-content:space-between;padding:.85rem .1rem;cursor:pointer;font-weight:500;color:#0a0a0a}',
    '.pc-pn summary::-webkit-details-marker{display:none}.pc-pn summary::after{content:"+";transition:transform .3s}.pc-pn details[open] summary::after{transform:rotate(45deg)}',
    '.pc-pn details p{margin:0;padding:0 .1rem .9rem;color:rgba(40,18,14,.75);line-height:1.55;font-size:.82rem}.pc-pn details a{color:inherit}',
    '.pc-pad{height:.8rem}',
    /* la tienda centra y pone en mayúsculas los títulos: en el panel se respeta su propio estilo */
    'html body .pc .pc-pn,html body .pc .pc-pn h3,html body .pc .pc-pn .pc-k,html body .pc .pc-pn .pc-pr{text-align:left}',
    'html body .pc .pc-pn h3{text-transform:none;letter-spacing:-.01em}',
    '@media(max-width:760px){',
    '  .pc-ar{display:none}',
    '  .pc-pn{left:.6rem;right:.6rem;top:auto;bottom:.6rem;width:auto;max-height:58%;transform:translateY(60px);border-radius:20px;padding:1.3rem 1.1rem .4rem}',
    '  .pc.ex .pc-pn{transform:none}',
    '  .pc-pn h3{font-size:1.6rem}',
    '}',
    '@media(prefers-reduced-motion:reduce){.pc-dr{animation:none}.pc-it,.pc-fig,.pc-pn{transition-duration:.01s!important}}'
  ].join('\n');
  var st = document.createElement('style'); st.setAttribute('data-perchero', '1'); st.textContent = css; document.head.appendChild(st);

  /* ================= datos ================= */
  function productos() {
    try { if (typeof catalog === 'function') return catalog() || []; } catch (e) { /* sin catálogo */ }
    return Array.isArray(window.MF_CATALOGO_PRODUCTOS) ? window.MF_CATALOGO_PRODUCTOS : [];
  }
  function porId(id) { return productos().filter(function (p) { return p && String(p.id) === String(id); })[0] || null; }
  function agotado(p) { return Array.isArray(p.tallas) && !p.tallas.length; }
  function recorte(p) { var R = window.MF_RECORTES || {}; return (p && (p.recorte || R[p.id])) || ''; }
  function tam(u, w) { return /cdn\.shopify\.com/.test(u) ? u + (u.indexOf('?') < 0 ? '?' : '&') + 'width=' + w : u; }
  function listaFija() {
    var c = window.MF_CONTENIDO && window.MF_CONTENIDO.vitrina;
    if (Array.isArray(c) && c.length) return c.map(String);
    return Array.isArray(window.MF_VITRINA) ? window.MF_VITRINA.map(String) : [];
  }
  // Foto de un color: la del color si tiene, si no la principal
  function fotoColor(p, ci) { var c = (p.colors || [])[ci]; return (c && c.img) || p.img || (p.imgs || [])[0] || ''; }

  /* ================= quitar el fondo blanco ================= */
  // Se llena desde los bordes todo lo que sea blanco (claro y sin color) y se vuelve transparente, con borde suave.
  // Devuelve { src, ok }: ok=false si la foto no tiene fondo blanco (o no se pudo leer) → cuelga como tarjeta.
  var CACHE = {};
  function recortar(u) {
    if (!u) return Promise.resolve({ src: '', ok: false });
    if (CACHE[u]) return CACHE[u];
    CACHE[u] = new Promise(function (ok) {
      var im = new Image(); im.crossOrigin = 'anonymous'; im.decoding = 'async';
      var listo = false, t = setTimeout(function () { fin({ src: tam(u, 700), ok: false }); }, 9000);
      function fin(r) { if (listo) return; listo = true; clearTimeout(t); ok(r); }
      im.onload = function () {
        try {
          var M = 620, s = Math.min(1, M / Math.max(im.naturalWidth, im.naturalHeight));
          var W = Math.max(1, Math.round(im.naturalWidth * s)), H = Math.max(1, Math.round(im.naturalHeight * s));
          var c = document.createElement('canvas'); c.width = W; c.height = H;
          var x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(im, 0, 0, W, H);
          var d = x.getImageData(0, 0, W, H), px = d.data, N = W * H;
          var bgC = function (i) { var o = i * 4, r = px[o], g = px[o + 1], b = px[o + 2], mn = Math.min(r, g, b), mx = Math.max(r, g, b); return mn >= 226 && mx - mn <= 24; };
          // ¿el borde es casi todo blanco?
          var n = 0, b = 0, i, j;
          for (i = 0; i < W; i++) { n += 2; if (bgC(i)) b++; if (bgC((H - 1) * W + i)) b++; }
          for (j = 1; j < H - 1; j++) { n += 2; if (bgC(j * W)) b++; if (bgC(j * W + W - 1)) b++; }
          if (b / n < 0.8) { fin({ src: tam(u, 700), ok: false }); return; }
          // relleno desde los bordes
          var vis = new Uint8Array(N), q = new Int32Array(N), h = 0, tl = 0;
          var push = function (k) { if (!vis[k] && bgC(k)) { vis[k] = 1; q[tl++] = k; } };
          for (i = 0; i < W; i++) { push(i); push((H - 1) * W + i); }
          for (j = 0; j < H; j++) { push(j * W); push(j * W + W - 1); }
          while (h < tl) {
            var k = q[h++], kx = k % W;
            if (kx > 0) push(k - 1); if (kx < W - 1) push(k + 1);
            if (k >= W) push(k - W); if (k < N - W) push(k + W);
          }
          var x0 = W, y0 = H, x1 = 0, y1 = 0;
          for (k = 0; k < N; k++) {
            var o = k * 4;
            if (vis[k]) { px[o + 3] = 0; continue; }
            var kx2 = k % W, ky = (k / W) | 0;
            // borde suave: un píxel claro pegado al fondo queda semitransparente
            var junto = (kx2 > 0 && vis[k - 1]) || (kx2 < W - 1 && vis[k + 1]) || (k >= W && vis[k - W]) || (k < N - W && vis[k + W]);
            if (junto) { var l = Math.min(px[o], px[o + 1], px[o + 2]); if (l > 170) px[o + 3] = Math.round(255 * Math.min(1, (255 - l) / 85)); }
            if (px[o + 3] > 24) { if (kx2 < x0) x0 = kx2; if (kx2 > x1) x1 = kx2; if (ky < y0) y0 = ky; if (ky > y1) y1 = ky; }
          }
          if (x1 <= x0 || y1 <= y0) { fin({ src: tam(u, 700), ok: false }); return; }
          x.putImageData(d, 0, 0);
          // se recorta al zapato (con un margen) para que llene el cuadro y cuelgue desde arriba
          var pad = Math.round(Math.max(W, H) * 0.02);
          x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(W - 1, x1 + pad); y1 = Math.min(H - 1, y1 + pad);
          var c2 = document.createElement('canvas'); c2.width = x1 - x0 + 1; c2.height = y1 - y0 + 1;
          c2.getContext('2d').drawImage(c, x0, y0, c2.width, c2.height, 0, 0, c2.width, c2.height);
          var src = '';
          try { src = c2.toDataURL('image/webp', 0.9); } catch (e) { /* nada */ }
          if (src.indexOf('data:image/webp') !== 0) src = c2.toDataURL('image/png');
          fin({ src: src, ok: true });
        } catch (e) { fin({ src: tam(u, 700), ok: false }); } // la foto no deja leer sus píxeles: tarjeta
      };
      im.onerror = function () { fin({ src: tam(u, 700), ok: false }); };
      im.src = tam(u, 700);
    });
    return CACHE[u];
  }

  // Lista de zapatos: la del panel (Vitrina) o DATA/recortes.js, en ese orden; si no hay, los destacados y luego el resto (hasta 12).
  function elegir() {
    var P = productos(), fija = listaFija(), orden;
    if (fija.length) orden = fija.map(porId).filter(function (p) { return p && !agotado(p); });
    else {
      var all = P.filter(function (p) { return p && p.id != null && !agotado(p) && (p.img || (p.imgs || []).length); });
      orden = all.filter(function (p) { return p.destacado; }).concat(all.filter(function (p) { return !p.destacado; }));
    }
    orden = orden.slice(0, fija.length ? 16 : 24);
    return Promise.all(orden.map(function (p) {
      if (recorte(p)) return Promise.resolve({ p: p, ci: 0, src: recorte(p), ok: true });
      // primera foto con fondo blanco: la de cada color, luego las de la galería
      var L = (p.colors || []).map(function (c) { return c && c.img; }).concat(p.imgs || [], [p.img]).filter(Boolean).filter(function (u, k, a) { return a.indexOf(u) === k; }).slice(0, 4);
      var k = 0;
      var prueba = function () {
        if (k >= L.length) return fija.length && L.length ? recortar(L[0]).then(function (r) { return { p: p, ci: 0, src: r.src, ok: false }; }) : null;
        var u = L[k++];
        return recortar(u).then(function (r) {
          if (!r.ok) return prueba();
          var ci = (p.colors || []).map(function (c) { return c && c.img; }).indexOf(u);
          return { p: p, ci: ci < 0 ? 0 : ci, src: r.src, ok: true };
        });
      };
      return Promise.resolve(prueba());
    })).then(function (r) { return r.filter(Boolean).slice(0, fija.length ? 16 : 12); });
  }

  /* ================= armado ================= */
  var FL = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>', FR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>';
  var HOOK = '<svg class="pc-hk" viewBox="0 0 40 60" preserveAspectRatio="none" aria-hidden="true"><path d="M20 58 L20 16 Q20 4 28 4 Q35 4 35 11" fill="none" stroke="#a9adb3" stroke-width="2.6" stroke-linecap="round" vector-effect="non-scaling-stroke"/><circle cx="20" cy="57" r="2.2" fill="#9097a0"/></svg>';
  var LISTA = null, armando = false;
  var S = { cur: 0, ex: false, sec: null, its: [], L: {}, raf: 0, last: 0, toque: 0, vis: true, ci: 0, talla: '' };

  function html(L) {
    var logo = 'assets/logo-blanco.png';
    var items = L.map(function (x, i) {
      return '<button class="pc-it" type="button" data-pi="' + i + '" aria-label="' + E(x.p.name + ', ' + money(x.p.price)) + '">' +
        '<span class="pc-sw">' + HOOK + '<span class="pc-3d"><span class="pc-fig' + (x.ok ? '' : ' card') + '"><img src="' + E(x.src) + '" alt="" draggable="false" decoding="async"></span></span></span></button>';
    }).join('');
    var dots = L.map(function () { return '<i></i>'; }).join('');
    return '<section class="pc" id="perchero" aria-label="El perchero · Marlon Footwear" aria-roledescription="carrusel">' +
      '<div class="pc-sky" aria-hidden="true">' +
      '<span class="pc-cl pc-dr" style="left:-4%;top:16%;width:34vw;height:9vw;background:#fbdcd4;animation-duration:38s"></span>' +
      '<span class="pc-cl pc-dr" style="left:62%;top:10%;width:30vw;height:7vw;background:#fde4dc;animation-duration:46s;animation-direction:alternate-reverse"></span>' +
      '<span class="pc-cl pc-dr" style="left:70%;top:38%;width:26vw;height:8vw;background:#fbd0bd;animation-duration:31s"></span>' +
      '<span class="pc-cl pc-dr" style="left:3%;top:46%;width:24vw;height:7vw;background:#f8cbb8;animation-duration:35s;animation-direction:alternate-reverse"></span>' +
      '<span class="pc-glow"></span><span class="pc-bank"></span></div>' +
      '<img class="pc-logo" src="' + logo + '" alt="" aria-hidden="true">' +
      '<svg class="pc-rail" aria-hidden="true"></svg>' + items +
      '<div class="pc-now" aria-live="polite"></div>' +
      '<button class="pc-ar p" type="button" aria-label="Modelo anterior">' + FL + '</button><button class="pc-ar n" type="button" aria-label="Modelo siguiente">' + FR + '</button>' +
      '<div class="pc-dots" aria-hidden="true">' + dots + '</div>' +
      '<aside class="pc-pn" aria-hidden="true" aria-label="Detalle del modelo"></aside></section>';
  }

  function n() { return LISTA ? LISTA.length : 0; }
  function idx(i) { var N = n(); return ((i % N) + N) % N; }
  function off(i) { var N = n(), o = idx(i - S.cur); if (o >= N / 2) o -= N; return o; }
  function railY(x) { var L = S.L, t = (x - L.cx) / L.half; return L.y0 + L.sag * (1 - t * t); }

  function medir() {
    var sec = S.sec; if (!sec) return;
    // alto: la pantalla menos el encabezado fijo
    var hd = document.querySelector('header.bar'), hh = hd ? hd.getBoundingClientRect().height : 0;
    sec.style.setProperty('--pc-h', 'calc(100svh - ' + Math.round(hh) + 'px)');
    var W = sec.clientWidth, H = sec.clientHeight, m = W < 760, L = S.L;
    L.W = W; L.H = H; L.m = m; L.hh = hh; L.cx = W / 2;
    L.half = W * (m ? 0.62 : 0.43);
    L.y0 = H * (m ? 0.22 : 0.23); L.sag = H * (m ? 0.035 : 0.05);
    L.gh = m ? Math.min(W * 0.74, H * 0.4) : Math.min(H * 0.46, W * 0.27); // alto del gancho + zapato
    L.gw = L.gh * 0.86;
    L.sp = m ? W * 0.21 : Math.min(W * 0.115, 210);
    L.vis = m ? 2 : 3;
    var x0 = L.cx - L.half, x1 = L.cx + L.half, rail = sec.querySelector('.pc-rail'), sw = m ? 6 : 8;
    rail.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    var curva = 'M' + x0 + ' ' + L.y0 + ' Q' + L.cx + ' ' + (L.y0 + L.sag * 2) + ' ' + x1 + ' ' + L.y0;
    var pa = L.cx - L.half * 0.78, pb = L.cx + L.half * 0.78;
    rail.innerHTML = '<defs><linearGradient id="pcChrome" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f6f6f8"/><stop offset=".45" stop-color="#9da1a8"/><stop offset=".6" stop-color="#6f737b"/><stop offset="1" stop-color="#dadce0"/></linearGradient>' +
      '<filter id="pcBl"><feGaussianBlur stdDeviation="4"/></filter></defs>' +
      '<line x1="' + pa + '" y1="0" x2="' + pa + '" y2="' + railY(pa) + '" stroke="#e2e3e7" stroke-width="2" opacity=".75"/>' +
      '<line x1="' + pb + '" y1="0" x2="' + pb + '" y2="' + railY(pb) + '" stroke="#e2e3e7" stroke-width="2" opacity=".75"/>' +
      '<path d="' + curva + '" fill="none" stroke="rgba(120,50,40,.2)" stroke-width="' + (sw + 2) + '" transform="translate(0 8)" filter="url(#pcBl)"/>' +
      '<path d="' + curva + '" fill="none" stroke="url(#pcChrome)" stroke-width="' + sw + '" stroke-linecap="round"/>' +
      '<circle cx="' + x0 + '" cy="' + L.y0 + '" r="' + (sw * 0.75) + '" fill="#8e929a"/><circle cx="' + x1 + '" cy="' + L.y0 + '" r="' + (sw * 0.75) + '" fill="#8e929a"/>';
    var lg = sec.querySelector('.pc-logo'), lh = m ? 46 : Math.min(84, H * 0.09);
    sec.style.setProperty('--pc-lg', lh + 'px');
    lg.style.top = Math.max(10, L.y0 - lh - (m ? 26 : 34)) + 'px';
    S.its.forEach(function (it) { it.el.style.width = L.gw + 'px'; it.el.style.height = L.gh + 'px'; });
    sec.style.setProperty('--pc-cord', '17%');
    poner(true);
  }

  function poner(sinAnim) {
    var L = S.L, sec = S.sec; if (!sec) return;
    S.its.forEach(function (it, i) {
      var o = off(i), a = Math.abs(o), el = it.el, fig = it.fig;
      if (sinAnim) { el.style.transition = 'none'; fig.style.transition = 'none'; }
      el.classList.toggle('cur', o === 0);
      el.tabIndex = o === 0 ? 0 : -1;
      if (S.ex && o === 0) {
        var sc = L.m ? Math.min(0.95, (L.H * 0.4 - 30) / L.gh) : Math.min(1.45, (L.H * 0.86) / L.gh);
        var x = L.m ? L.cx : L.W * 0.3, y = L.m ? 18 : (L.H - L.gh * sc) / 2;
        el.style.transform = 'translate(' + (x - L.gw / 2) + 'px,' + y + 'px) scale(' + sc + ')';
        el.style.opacity = 1; el.style.zIndex = 8; fig.style.transform = 'none';
      } else {
        var sg = o < 0 ? -1 : 1;
        var px = L.cx + (a ? sg * (L.sp * 1.4 + (a - 1) * L.sp) : 0);
        var s = o === 0 ? 1 : 0.6 - (a - 1) * 0.03;
        el.style.transform = 'translate(' + (px - L.gw / 2) + 'px,' + (railY(px) - 3) + 'px) scale(' + s + ')';
        el.style.opacity = a > L.vis ? 0 : (a === L.vis ? 0.7 : 1);
        el.style.zIndex = 7 - a;
        el.style.pointerEvents = a > L.vis ? 'none' : '';
        // los de los lados quedan "de perfil", como girados sobre el gancho
        fig.style.transform = o === 0 ? 'none' : 'rotateY(' + (sg * -62) + 'deg)';
      }
      if (sinAnim) { void el.offsetWidth; el.style.transition = ''; fig.style.transition = ''; }
    });
    var now = sec.querySelector('.pc-now');
    now.style.top = (railY(L.cx) + L.gh * 0.98 + (L.m ? 14 : 10)) + 'px';
    [].forEach.call(sec.querySelectorAll('.pc-dots i'), function (d, i) { d.classList.toggle('on', i === idx(S.cur)); });
  }

  function info() {
    var sec = S.sec; if (!sec) return;
    var x = LISTA[idx(S.cur)], p = x.p, now = sec.querySelector('.pc-now');
    var c = (p.colors || [])[x.ci];
    now.innerHTML = '<b>' + E(p.name) + '</b><i>' + (c && c.n ? E(c.n) + ' · ' : '') + money(p.price) + '</i>' +
      '<button class="pc-go" type="button" data-pc-go>Ver modelo</button>';
    now.classList.remove('pc-swap'); void now.offsetWidth; now.classList.add('pc-swap');
  }

  function ir(destino) {
    var dir = destino > S.cur ? 1 : destino < S.cur ? -1 : 0; if (!dir || S.ex) return;
    S.cur = destino; poner(); info();
    S.its.forEach(function (it) { it.v += -dir * (60 + Math.random() * 45); });
    S.toque = performance.now();
  }

  /* ================= vaivén (física de resorte) ================= */
  function tick(t) {
    S.raf = 0;
    if (!S.sec || !S.sec.isConnected) return;
    var dt = Math.min(0.033, (t - (S.last || t)) / 1000); S.last = t;
    if (S.vis) {
      S.its.forEach(function (it) {
        var meta = reduce ? 0 : Math.sin(t / 1000 * 0.9 + it.ph) * (S.ex ? 0.7 : 1.3);
        it.v += (-(it.a - meta) * 26 - it.v * 3.2) * dt;
        it.a += it.v * dt;
        if (reduce) it.a = 0;
        it.sw.style.transform = 'rotate(' + it.a.toFixed(3) + 'deg)';
      });
    }
    S.raf = requestAnimationFrame(tick);
  }

  /* ================= panel "Ver modelo" ================= */
  function panel() {
    var x = LISTA[idx(S.cur)], p = porId(x.p.id) || x.p, pn = S.sec.querySelector('.pc-pn');
    var cols = p.colors || [], tallas = Array.isArray(p.tallas) ? p.tallas : [];
    S.ci = Math.min(x.ci || 0, Math.max(0, cols.length - 1)); S.talla = '';
    var nro = String(idx(S.cur) + 1).padStart(2, '0') + ' / ' + String(n()).padStart(2, '0');
    var col = p.coleccion ? String(p.coleccion) : 'Marlon Footwear';
    pn.innerHTML = '<button class="pc-x" type="button" data-pc-x aria-label="Cerrar"><svg viewBox="0 0 12 12"><path d="M1 1l10 10M11 1L1 11"/></svg></button>' +
      '<div class="pc-k">' + E(col) + ' · ' + nro + '</div>' +
      '<h3>' + E(p.name) + '</h3>' +
      '<div class="pc-pr">' + money(p.price) + '<small>Envío nacional</small></div>' +
      (cols.length ? '<div class="pc-lb"><span>Color<b data-pc-cn>' + E((cols[S.ci] || {}).n || '') + '</b></span></div><div class="pc-cs">' +
        cols.map(function (c, k) { return '<button class="pc-c' + (k === S.ci ? ' on' : '') + '" type="button" data-pc-c="' + k + '" style="background:' + E(c.h || '#ddd') + '" aria-label="' + E(c.n || 'Color') + '" title="' + E(c.n || '') + '"></button>'; }).join('') + '</div>' : '') +
      '<div class="pc-lb"><span>Talla<b data-pc-tn>' + (tallas.length ? 'Elige tu talla' : '') + '</b></span>' + (tallas.length ? '' : '<span>Agotado</span>') + '</div>' +
      (tallas.length ? '<div class="pc-ts"><span class="pc-th"></span>' + tallas.map(function (t) { return '<button type="button" data-pc-t="' + E(t) + '">' + E(t) + '</button>'; }).join('') + '</div>' : '') +
      '<button class="pc-add" type="button" data-pc-add' + (tallas.length ? '' : ' disabled') + '><span data-pc-al>' + (tallas.length ? 'Agregar a la bolsa' : 'Agotado') + '</span><span>' + money(p.price) + '</span></button>' +
      '<button class="pc-full" type="button" data-pc-full>Ver todos los detalles</button>' +
      (p.desc ? '<details><summary>Descripción</summary><p>' + E(p.desc) + '</p></details>' : '') +
      '<details><summary>Envíos</summary><p>Enviamos a toda Colombia. Consulta tiempos y costos en <a href="envios.html">envíos</a>.</p></details>' +
      '<details><summary>Cambios y devoluciones</summary><p>Revisa las condiciones en <a href="cambios-y-devoluciones.html">cambios y devoluciones</a>.</p></details>' +
      '<div class="pc-pad"></div>';
    pn.scrollTop = 0;
  }
  function ponerTalla(t) {
    var pn = S.sec.querySelector('.pc-pn'), ts = pn.querySelector('.pc-ts'); if (!ts) return;
    S.talla = t;
    var b = null;
    [].forEach.call(ts.querySelectorAll('button'), function (x) { var on = x.getAttribute('data-pc-t') === t; x.classList.toggle('on', on); if (on) b = x; });
    if (b) { ts.querySelector('.pc-th').style.left = (b.offsetLeft + b.offsetWidth / 2) + 'px'; ts.classList.add('sel'); }
    pn.querySelector('[data-pc-tn]').textContent = t;
    pn.querySelector('[data-pc-al]').textContent = 'Agregar a la bolsa · ' + t;
  }
  function ponerColor(k) {
    var x = LISTA[idx(S.cur)], p = porId(x.p.id) || x.p, pn = S.sec.querySelector('.pc-pn');
    S.ci = k;
    [].forEach.call(pn.querySelectorAll('.pc-c'), function (b) { b.classList.toggle('on', +b.getAttribute('data-pc-c') === k); });
    var cn = pn.querySelector('[data-pc-cn]'); if (cn) cn.textContent = ((p.colors || [])[k] || {}).n || '';
    var it = S.its[idx(S.cur)], img = it.fig.querySelector('img'), u = fotoColor(p, k);
    img.classList.add('ld');
    recortar(u).then(function (r) {
      if (S.ci !== k) return;
      img.onload = function () { img.classList.remove('ld'); img.onload = null; };
      img.src = r.src; it.fig.classList.toggle('card', !r.ok);
      x.ci = k; x.src = r.src; x.ok = r.ok; it.v += 50;
    });
  }
  function bloquear(si) { document.documentElement.style.overflow = si ? 'hidden' : ''; document.body.style.overflow = si ? 'hidden' : ''; }
  function abrir() {
    if (S.ex || !S.sec) return;
    // la sección queda justo debajo del encabezado y la página no se mueve mientras el panel está abierto
    var top = S.sec.getBoundingClientRect().top + (window.scrollY || 0) - (S.L.hh || 0);
    try { window.scrollTo({ top: Math.max(0, top), behavior: reduce ? 'auto' : 'smooth' }); } catch (e) { window.scrollTo(0, top); }
    S.ex = true; S.sec.classList.add('ex');
    panel(); poner();
    var pn = S.sec.querySelector('.pc-pn'); pn.setAttribute('aria-hidden', 'false');
    S.its[idx(S.cur)].v += 80;
    setTimeout(function () { if (S.ex) bloquear(true); }, reduce ? 0 : 450);
    setTimeout(function () { var x = pn.querySelector('.pc-x'); if (x) try { x.focus({ preventScroll: true }); } catch (e) { /* nada */ } }, 500);
  }
  function cerrar() {
    if (!S.ex || !S.sec) return;
    S.ex = false; S.sec.classList.remove('ex'); bloquear(false);
    S.sec.querySelector('.pc-pn').setAttribute('aria-hidden', 'true');
    // el zapato vuelve con el color que se eligió
    poner(); info(); S.its[idx(S.cur)].v -= 70; S.toque = performance.now();
  }
  function agregar() {
    var x = LISTA[idx(S.cur)], p = porId(x.p.id);
    if (!p) return;
    if (!S.talla) {
      var tn = S.sec.querySelector('[data-pc-tn]'); if (tn) { tn.textContent = 'Elige tu talla'; }
      var ts = S.sec.querySelector('.pc-ts'); if (ts && ts.animate) ts.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' }, { transform: 'translateX(0)' }], { duration: 320 });
      if (typeof toast === 'function') toast('Elige tu talla');
      return;
    }
    try {
      // el carrito de siempre: misma función que el botón del producto (con su evento de Meta Pixel)
      selT = S.talla; selC = S.ci;
      var fn = typeof window.add === 'function' ? window.add : (typeof add === 'function' ? add : null);
      if (!fn || !fn(p.id)) return;
      var cnt = document.getElementById('cnt'); if (cnt && typeof CART !== 'undefined') cnt.textContent = CART.reduce(function (s, l) { return s + l.q; }, 0);
      if (typeof renderBag === 'function') renderBag();
      if (typeof bagBump === 'function') bagBump();
      if (typeof toast === 'function') toast('Agregado a tu bolsa', 'Ver bolsa', function () { cerrar(); if (typeof nav === 'function') nav('cart'); });
      selT = ''; selC = 0;
    } catch (e) { /* si algo falla, se abre la página del producto para comprar desde ahí */ abrirProducto(p.id); }
  }
  // Se abre con la navegación de la tienda (como tocar una tarjeta del catálogo)
  function abrirProducto(id) {
    if (S.ex) { S.ex = false; bloquear(false); }
    var b = document.createElement('button');
    b.type = 'button'; b.hidden = true; b.setAttribute('data-n', 'prod'); b.setAttribute('data-id', id);
    document.body.appendChild(b);
    try { b.click(); } finally { if (b.parentNode) b.parentNode.removeChild(b); }
  }

  /* ================= eventos ================= */
  function eventos(sec) {
    sec.addEventListener('click', function (e) {
      var t = e.target; if (!t || !t.closest) return;
      if (S.mov) return;
      if (t.closest('[data-pc-x]')) { cerrar(); return; }
      if (t.closest('[data-pc-go]')) { abrir(); return; }
      if (t.closest('.pc-ar.p')) { ir(S.cur - 1); return; }
      if (t.closest('.pc-ar.n')) { ir(S.cur + 1); return; }
      var c = t.closest('[data-pc-c]'); if (c) { ponerColor(+c.getAttribute('data-pc-c')); return; }
      var tb = t.closest('[data-pc-t]'); if (tb) { ponerTalla(tb.getAttribute('data-pc-t')); return; }
      if (t.closest('[data-pc-add]')) { agregar(); return; }
      if (t.closest('[data-pc-full]')) { var x = LISTA[idx(S.cur)]; cerrar(); abrirProducto(x.p.id); return; }
      var it = t.closest('.pc-it');
      if (it) { var i = +it.getAttribute('data-pi'), o = off(i); if (S.ex) return; if (o === 0) abrir(); else ir(S.cur + o); return; }
      // tocar el cielo con el panel abierto lo cierra
      if (S.ex && !t.closest('.pc-pn')) cerrar();
    });
    // deslizar (dedo o mouse)
    var sx = null, sy = 0;
    sec.addEventListener('pointerdown', function (e) { if (S.ex || e.target.closest('.pc-pn')) return; sx = e.clientX; sy = e.clientY; S.mov = false; });
    sec.addEventListener('pointermove', function (e) { if (sx !== null && Math.abs(e.clientX - sx) > 10 && Math.abs(e.clientX - sx) > Math.abs(e.clientY - sy)) S.mov = true; });
    sec.addEventListener('pointerup', function (e) {
      if (sx === null) return; var dx = e.clientX - sx; sx = null;
      if (S.mov && Math.abs(dx) > 40) ir(S.cur + (dx < 0 ? 1 : -1));
      setTimeout(function () { S.mov = false; }, 0);
    });
    sec.addEventListener('pointercancel', function () { sx = null; S.mov = false; });
    // rueda / trackpad horizontal
    var rueda = 0;
    sec.addEventListener('wheel', function (e) {
      if (S.ex || Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return; // el desplazamiento vertical sigue bajando la página
      e.preventDefault();
      if (Math.abs(e.deltaX) < 10 || performance.now() - rueda < 650) return;
      rueda = performance.now(); ir(S.cur + (e.deltaX > 0 ? 1 : -1));
    }, { passive: false });
    sec.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && S.ex) { cerrar(); return; }
      if (S.ex) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); ir(S.cur + 1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); ir(S.cur - 1); }
    });
    // el cielo se mueve un poco con el mouse
    sec.addEventListener('pointermove', function (e) {
      if (S.ex || S.L.m || reduce || e.pointerType !== 'mouse') return;
      var r = sec.getBoundingClientRect(), px = (e.clientX - r.left) / r.width - 0.5, py = (e.clientY - r.top) / r.height - 0.5;
      sec.querySelector('.pc-sky').style.transform = 'translate(' + (px * -14) + 'px,' + (py * -10) + 'px)';
    });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (en) { S.vis = en[0].isIntersecting; if (!S.vis && S.ex) cerrar(); }, { threshold: 0.05 }).observe(sec);
    }
  }

  // gira solo mientras nadie lo toca
  setInterval(function () {
    if (reduce || !S.sec || !S.sec.isConnected || S.ex || !S.vis || document.hidden || !n()) return;
    if (performance.now() - S.toque < 5000) return;
    ir(S.cur + 1); S.toque = performance.now() - 1800;
  }, 3200);
  addEventListener('resize', function () { if (S.sec && S.sec.isConnected) medir(); });

  /* ================= montaje ================= */
  function montar() {
    var home = app.querySelector('[data-rnew="home"]');
    if (!home) { if (S.ex) { S.ex = false; bloquear(false); } return; }
    if (home.querySelector('.pc')) return;
    if (!LISTA) {
      if (armando) return; armando = true;
      elegir().then(function (L) { LISTA = L; armando = false; montar(); }, function () { armando = false; LISTA = []; });
      return;
    }
    if (LISTA.length < 3) { document.body.classList.remove('pc-on'); return; } // pocos zapatos: se queda La vitrina de siempre
    S.cur = idx(S.cur); S.ex = false;
    var tmp = document.createElement('div'); tmp.innerHTML = html(LISTA);
    var sec = tmp.firstChild;
    // va de primero en el inicio, encima de la portada (#bns o #rh)
    home.insertBefore(sec, home.firstChild);
    document.body.classList.add('pc-on');
    S.sec = sec;
    S.its = [].map.call(sec.querySelectorAll('.pc-it'), function (el) { return { el: el, sw: el.querySelector('.pc-sw'), fig: el.querySelector('.pc-fig'), a: 0, v: 0, ph: Math.random() * 6 }; });
    eventos(sec);
    medir(); info();
    if (!S.raf) { S.last = 0; S.raf = requestAnimationFrame(tick); }
  }
  // Si el catálogo del servidor llega después (o cambia la lista del panel), se rehace con los datos definitivos
  var firma = '';
  setInterval(function () {
    var f = productos().length + '|' + listaFija().join(',');
    if (firma && f !== firma && !armando && !S.ex) {
      LISTA = null;
      var viejo = app.querySelector('[data-rnew="home"] .pc'); if (viejo) viejo.parentNode.removeChild(viejo);
      programar();
    }
    firma = f;
  }, 1500);

  var pend = false;
  function programar() { if (pend) return; pend = true; requestAnimationFrame(function () { pend = false; try { montar(); } catch (e) { document.body.classList.remove('pc-on'); } }); }
  new MutationObserver(programar).observe(app, { childList: true, subtree: true });
  try { montar(); } catch (e) { /* la tienda sigue igual */ }
})();
