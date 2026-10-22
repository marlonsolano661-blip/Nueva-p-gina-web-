/* Diseño de la tienda (portada con carrusel, colección con filtros, manifiesto y valores).
   Usa el catálogo real (catalog()), la colección elegida (window.MF_COL) y los textos del panel. No inventa datos.
   Se carga en index.html después de tienda-api.js. Expone window.mfRef { ok, main, chip } y window.mfCatInit. */
(function () {
  'use strict';
  var MAX = 5, MS = 7000, tm = null, cur = -1, wired = false;

  var css = [
    /* ---- Tipografía y botones de toda la tienda ---- */
    'body{font-family:Jost,system-ui,sans-serif;font-weight:300}',
    'body h1,body h2,body h3,body .st,body .pt{font-family:"Cormorant Garamond",Georgia,serif;font-weight:500;letter-spacing:-.01em;text-transform:none}',
    'body .btn{border-radius:0;font-weight:400;letter-spacing:.26em}',
    'body .ann{display:none}',
    /* ---- Encabezado sobre la portada: solo logo ---- */
    'body.cat .wm,body.cat .sq,body.cat .hc{display:none}',
    'body.cat .bar{position:fixed;left:0;right:0;top:0;background:transparent;border-bottom:1px solid transparent;color:#fff;backdrop-filter:none;transition:background .4s,color .4s,border-color .4s}',
    'body.cat .bar .logo,body.cat .bar .bag,body.cat .bar .mb{color:inherit}',
    'body.cat .bar .bag svg,body.cat .bar .mb svg{stroke:currentColor}',
    'body.cat .bar.dk:not(.solid){color:#111}',
    'body.cat .bar.solid{background:#fff;color:#0a0a0a;border-bottom-color:#dcdcd8}',
    /* ---- Portada con carrusel ---- */
    '.cv2{position:relative;height:100svh;min-height:520px;overflow:hidden;background:#0b0b0c;--c:#fff;--c2:#0b0b0c}',
    '.cs{position:absolute;inset:0;color:var(--c);clip-path:inset(0 0 100% 0);transition:clip-path 1.2s cubic-bezier(.77,0,.18,1);z-index:1}',
    '.cs.on{clip-path:inset(0);z-index:3}.cs.prev{clip-path:inset(0);z-index:2}.cs.rst{transition:none;clip-path:inset(0 0 100% 0)}',
    '.cs-bg{position:absolute;inset:0;background:radial-gradient(ellipse at 62% 38%,#f5f3ef 0%,#e2dfd8 62%,#d3cfc6 100%)}',
    '.cs.intro .cs-bg{background:radial-gradient(ellipse at 70% 40%,#26262a 0%,#0e0e10 60%,#050506 100%)}',
    '.cs-photo{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;transform:scale(1.14);transition:transform 9s cubic-bezier(.2,.6,.2,1)}',
    '.cs.on .cs-photo,.cs.prev .cs-photo{transform:scale(1)}',
    '.cs-ov{position:absolute;inset:0;background:linear-gradient(to top,rgba(0,0,0,.82),rgba(0,0,0,.35) 55%,rgba(0,0,0,.2))}',
    '.cs-wm{position:absolute;right:-12%;top:50%;width:78%;max-width:760px;transform:translateY(-50%);fill:#fff;opacity:.06}',
    '.cs-im{position:absolute;left:50%;top:12%;width:90%;height:50%;transform:translateX(-50%) scale(1.1);object-fit:contain;mix-blend-mode:multiply;-webkit-mask-image:radial-gradient(ellipse at center,#000 58%,transparent 98%);mask-image:radial-gradient(ellipse at center,#000 58%,transparent 98%);transition:transform 9s cubic-bezier(.2,.6,.2,1)}',
    '.cs.on .cs-im,.cs.prev .cs-im{transform:translateX(-50%) scale(1)}',
    '.cs .ctx{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;text-align:center;padding:0 22px calc(84px + env(safe-area-inset-bottom,0px))}',
    '.cs .cey{font:400 .7rem Jost,sans-serif;letter-spacing:.5em;text-transform:uppercase;margin-bottom:.9rem}',
    '.cs .ctt{font-family:"Cormorant Garamond",Georgia,serif;font-weight:500;font-size:clamp(40px,11vw,128px);line-height:.98;margin:0 0 .9rem}',
    '.cs .ctt .cw{display:inline-block;overflow:hidden;vertical-align:top;padding:0 .05em .1em}',
    '.cs .ctt .cw>span{display:inline-block;transform:translateY(108%);transition:transform 1.1s cubic-bezier(.2,.9,.2,1)}',
    '.cs .ctt .cw:last-child>span{font-style:italic}',
    '.cs .csb{max-width:380px;font-size:.92rem;line-height:1.7;margin:0 0 1.3rem;opacity:.9}',
    '.cs .pr2{font:400 .95rem Jost,sans-serif;letter-spacing:.12em;margin-bottom:1.1rem}',
    '.cs .cey,.cs .csb,.cs .cbt,.cs .pr2,.cs .rcats{opacity:0;transform:translateY(20px);transition:opacity 1s,transform 1s cubic-bezier(.2,.9,.2,1)}',
    '.cs.on .ctt .cw>span,.cs.prev .ctt .cw>span{transform:none}.cs.on .ctt .cw>span{transition-delay:calc(.55s + var(--i)*.1s)}',
    '.cs.on .cey,.cs.prev .cey,.cs.on .pr2,.cs.prev .pr2{opacity:1;transform:none}.cs.on .cey{transition-delay:.45s}.cs.on .pr2{transition-delay:.9s}',
    '.cs.on .csb,.cs.prev .csb{opacity:.9;transform:none}.cs.on .csb{transition-delay:.95s}',
    '.cs.on .cbt,.cs.prev .cbt,.cs.on .rcats,.cs.prev .rcats{opacity:1;transform:none}.cs.on .cbt{transition-delay:1.15s}.cs.on .rcats{transition-delay:1.3s}',
    '.cs .cbt{display:flex;gap:.7rem;flex-wrap:wrap;justify-content:center}',
    '.cs .cb{border:1px solid var(--c);color:var(--c);background:none;padding:.95rem 1.7rem;font:400 .7rem Jost,sans-serif;letter-spacing:.3em;text-transform:uppercase;cursor:pointer;transition:background .35s,color .35s}',
    '.cs .cb.p{background:var(--c);color:var(--c2)}.cs .cb:hover{background:var(--c);color:var(--c2)}.cs .cb.p:hover{background:none;color:var(--c)}',
    '.cs .rcats{display:flex;gap:1.3rem;flex-wrap:wrap;justify-content:center;margin-top:1.3rem}',
    '.cs .rcats button{border:0;background:none;color:var(--c);font:400 .68rem Jost,sans-serif;letter-spacing:.28em;text-transform:uppercase;padding:0 0 4px;border-bottom:1px solid currentColor;cursor:pointer;opacity:.85}',
    '.cv2 .cpb{position:absolute;left:22px;right:22px;bottom:calc(24px + env(safe-area-inset-bottom,0px));display:flex;gap:6px;z-index:6;color:var(--c);transition:color .6s}',
    '.cv2 .cpb button{flex:1;height:20px;position:relative;background:none;border:0;padding:0;cursor:pointer}',
    '.cv2 .cpb button::before{content:"";position:absolute;left:0;right:0;top:9px;height:2px;background:currentColor;opacity:.25}',
    '.cv2 .cpb i{position:absolute;left:0;top:9px;height:2px;width:0;background:currentColor}',
    '.cv2 .cpb .done i{width:100%}.cv2 .cpb .on i{animation:csfill 7s linear forwards}',
    '@keyframes csfill{to{width:100%}}',
    '.cv2 .ccn{position:absolute;right:22px;bottom:calc(48px + env(safe-area-inset-bottom,0px));z-index:6;font:300 .75rem Jost,sans-serif;letter-spacing:.3em;color:var(--c);transition:color .6s}',
    '.cv2 .car{display:none;position:absolute;top:50%;z-index:6;width:52px;height:52px;border:1px solid var(--c);border-radius:50%;color:var(--c);background:none;font-size:20px;cursor:pointer;transition:background .3s,color .3s,transform .3s}',
    '.cv2 .car:hover{background:var(--c);color:var(--c2);transform:scale(1.08)}.cv2 .car.pv{left:24px}.cv2 .car.nx{right:24px}',
    '@media(min-width:800px){.cv2 .car{display:block}}',
    '@media(min-aspect-ratio:1/1){.cs .ctx{align-items:flex-start;text-align:left;justify-content:center;padding:70px 9vw 70px;width:54%}.cs .cbt,.cs .rcats{justify-content:flex-start}.cs .ctt{font-size:clamp(48px,6.4vw,110px)}',
    ' .cs-im{left:auto;right:3%;top:50%;width:50%;height:78%;transform:translateY(-50%) scale(1.1)}.cs.on .cs-im,.cs.prev .cs-im{transform:translateY(-50%) scale(1)}}',
    /* ---- Colección ---- */
    '.rsec{max-width:1240px;margin:0 auto;padding:110px 22px 60px}',
    'body:not(.cat) .rsec{padding-top:40px}',
    '.rhead{text-align:center;margin-bottom:34px}.rhead small{font:300 .7rem Jost,sans-serif;letter-spacing:.5em;text-transform:uppercase;color:#767672}',
    '.rhead h2{font-size:clamp(38px,7vw,72px);margin-top:12px}',
    '.rchips{display:flex;gap:26px;justify-content:center;flex-wrap:wrap;margin-bottom:34px}',
    '.rchip{border:0;background:none;font:400 .75rem Jost,sans-serif;letter-spacing:.24em;text-transform:uppercase;color:#767672;padding:0 0 6px;position:relative;cursor:pointer;transition:color .3s}',
    '.rchip::after{content:"";position:absolute;left:0;bottom:0;height:1px;width:100%;background:#0a0a0a;transform:scaleX(0);transition:transform .4s}',
    '.rchip.on{color:#0a0a0a}.rchip.on::after{transform:scaleX(1)}',
    '.rsec .tools{max-width:34rem;margin:0 auto 34px}',
    '.rsec .tools input,.rsec .tools select{border-radius:0}',
    'body #gr{display:grid;grid-template-columns:repeat(2,1fr);gap:22px 14px}@media(min-width:800px){body #gr{grid-template-columns:repeat(3,1fr);gap:56px 34px}}',
    'body #gr .pc{border:0;background:none;box-shadow:none;border-radius:0;padding:0;text-align:center;display:block;cursor:pointer;transform:none}',
    'body #gr .pc .im{position:relative;aspect-ratio:1;background:#fff;border-radius:0;display:grid;place-items:center;overflow:hidden}',
    'body #gr .pc .im::after{content:"";position:absolute;inset:12px;border:1px solid #dcdcd8;transition:inset .5s,border-color .5s;pointer-events:none}',
    'body #gr .pc:hover .im::after{inset:6px;border-color:#0a0a0a}',
    'body #gr .pc .im img{position:absolute;inset:8%;width:84%;height:84%;object-fit:contain}',
    'body #gr .pc h3{font:500 clamp(20px,5vw,26px)/1.1 "Cormorant Garamond",Georgia,serif;letter-spacing:0;text-transform:none;margin:18px 0 4px}',
    'body #gr .pc .pr{font:400 14px Jost,sans-serif;letter-spacing:.1em;color:#0a0a0a;margin:0 0 10px}',
    'body #gr .pc .dots{justify-content:center;margin:0 0 10px}',
    'body #gr .pc .btn.s{width:auto;min-height:0;border:0;border-bottom:1px solid #0a0a0a;background:none;color:#0a0a0a;border-radius:0;padding:0 0 3px;font:400 11px Jost,sans-serif;letter-spacing:.28em}',
    'body #gr .pc .btn.s:hover{background:none;color:#0a0a0a}',
    /* ---- Manifiesto y valores ---- */
    '.rman{background:#0a0a0a;color:#fafaf8;text-align:center;padding:120px 24px}',
    '.rman h2{font-size:clamp(34px,6.5vw,76px);line-height:1.15;max-width:900px;margin:0 auto}',
    '.rman p{font:300 .7rem Jost,sans-serif;letter-spacing:.5em;text-transform:uppercase;margin:30px 0 0;opacity:.6}',
    '.rvals{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:36px;max-width:960px;margin:0 auto;padding:80px 24px;text-align:center}',
    '.rvals h3{font-size:24px;margin:0 0 8px}.rvals p{font-size:13px;line-height:1.7;color:#767672;margin:0}',
    '@media(prefers-reduced-motion:reduce){.cs,.cs-im,.cs-photo{transition:none}.cv2 .cpb .on i{animation:none;width:100%}}'
  ].join('\n');
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  var MONO = '<svg class="cs-wm" viewBox="240 254 581 508" aria-hidden="true"><polygon points="246,260 426,548 606,260 607,756 570,756 570,388 426,617 283,388 283,756 246,756"/><rect x="606" y="323" width="209" height="37"/><rect x="606" y="521" width="161" height="37"/></svg>';
  var E = function (t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (m) { return '&#' + m.charCodeAt(0) + ';'; }); };

  function colecciones() { return ((window.MF_CONTENIDO && window.MF_CONTENIDO.colecciones) || []).filter(function (k) { return k.visible !== false; }); }
  function coleccionActual() {
    var id = window.MF_COL || '', c = colecciones();
    for (var i = 0; i < c.length; i++) if (c[i].id === id) return c[i];
    return null;
  }
  function titulo() { var k = coleccionActual(); return k ? k.nombre : 'Nuestra colección'; }
  function productos() {
    var id = window.MF_COL || '';
    return catalog().filter(function (p) { return !id || p.coleccion === id; });
  }
  function palabras(t) {
    return String(t).split(/\s+/).filter(Boolean).map(function (w, k) { return '<span class="cw"><span style="--i:' + k + '">' + E(w) + '</span></span>'; }).join(' ');
  }

  /* ---- Portada ---- */
  function hero() {
    var ps = productos().filter(function (p) { return p.img || (p.imgs && p.imgs[0]); }).slice(0, MAX);
    if (!ps.length) return '';
    var k = coleccionActual(), all = productos().length, S = [];
    var nombre = k ? k.nombre : TX('hero_titulo', 'Nueva colección');
    var sub = k ? all + (all === 1 ? ' modelo' : ' modelos') + ' en pocas unidades.' : TX('hero_kicker', 'Tacones y sandalias en ediciones cortas, con acabados impecables.');
    var cats = colecciones().filter(function (c) { return catalog().some(function (p) { return p.coleccion === c.id; }); });
    var links = k ? '<button data-cf="">← Todas las colecciones</button>' : cats.map(function (c) { return '<button data-cf="' + E(c.id) + '">' + E(c.nombre) + '</button>'; }).join('');
    S.push('<section class="cs intro rst" style="--c:#fff;--c2:#0b0b0c">' +
      (k && k.portada ? '<img class="cs-photo" alt="" src="' + E(k.portada) + '"><div class="cs-ov"></div>' : '<div class="cs-bg"></div>' + MONO) +
      '<div class="ctx"><div class="cey">Colección</div><h1 class="ctt">' + palabras(nombre) + '</h1>' +
      '<p class="csb">' + E(sub) + '</p><div class="cbt"><button class="cb p" data-cs="go">Ver modelos</button></div>' +
      (links ? '<div class="rcats">' + links + '</div>' : '') + '</div></section>');
    ps.forEach(function (p) {
      var im = p.img || p.imgs[0];
      S.push('<section class="cs rst" style="--c:#111;--c2:#fff"><div class="cs-bg"></div><img class="cs-im" alt="' + E(p.name) + '" src="' + E(im) + '"' + (S.length > 1 ? ' loading="lazy"' : '') + '>' +
        '<div class="ctx"><div class="cey">' + E(k ? k.nombre : 'Colección') + '</div><h2 class="ctt">' + palabras(p.name) + '</h2>' +
        (p.desc ? '<p class="csb">' + E(p.desc.length > 120 ? p.desc.slice(0, 117) + '…' : p.desc) + '</p>' : '') +
        '<div class="pr2">' + E(fmt(p.price)) + '</div>' +
        '<div class="cbt"><button class="cb p" data-n="prod" data-id="' + E(p.id) + '">Ver modelo</button><button class="cb" data-cs="go">Ver todos</button></div></div></section>');
    });
    var bars = S.map(function (x, i) { return '<button data-cs-bar="' + i + '" aria-label="Diapositiva ' + (i + 1) + '"><i></i></button>'; }).join('');
    return '<div class="cv2" id="cv2" role="region" aria-label="Destacados">' + S.join('') +
      '<button class="car pv" data-cs-ar="-1" aria-label="Anterior">←</button><button class="car nx" data-cs-ar="1" aria-label="Siguiente">→</button>' +
      '<div class="ccn" id="cn2"></div><div class="cpb" id="pb2">' + bars + '</div></div>';
  }
  window.mfCatHero = hero;

  function chips() {
    var id = window.MF_COL || '', c = colecciones();
    if (!c.length) return '';
    var one = function (v, n) { var on = id === v; return '<button class="rchip' + (on ? ' on' : '') + '" data-cf="' + E(v) + '" aria-pressed="' + on + '">' + E(n) + '</button>'; };
    return '<div class="rchips" id="rchips">' + one('', 'Todo') + c.map(function (k) { return one(k.id, k.nombre); }).join('') + '</div>';
  }

  /* ---- Página completa (sin el pie): portada + colección + manifiesto + valores ---- */
  function main() {
    var h = hero();
    var env = typeof window.MF_ENVIO === 'number' ? 'Tarifa fija de ' + fmt(window.MF_ENVIO) + ' a todo el país.' : 'Envío a todo el país.';
    var man = SEC('band') ? '<div class="rman"><h2>' + E(TX('band_titulo', 'Pisa distinto.')) + '</h2><p>' + E(TX('band_texto', 'Ediciones cortas, acabados impecables y una firma que se reconoce al caminar.')) + '</p></div>' : '';
    return h +
      '<section class="rsec" id="lista"><div class="rhead"><small>La colección</small><h2 id="rtit">' + E(titulo()) + '</h2></div>' + chips() +
      '<div class="tools"><input id="q" type="search" placeholder="Buscar modelo" aria-label="Buscar modelo" value="' + E(Q) + '"><select id="so" aria-label="Ordenar"><option value="">Ordenar</option><option value="a"' + (SO === 'a' ? ' selected' : '') + '>Precio: menor a mayor</option><option value="d"' + (SO === 'd' ? ' selected' : '') + '>Precio: mayor a menor</option></select></div>' +
      '<div class="grid" id="gr">' + grid() + '</div></section>' + man +
      '<div class="rvals"><div><h3>Envío</h3><p>' + E(env) + '</p></div><div><h3>Pago seguro</h3><p>Tarjeta, Nequi o PSE con Wompi.</p></div><div><h3>Ediciones limitadas</h3><p>Pocas unidades por modelo.</p></div></div>';
  }

  /* Cambio de colección sin recargar la página ni mover al cliente */
  function chip(id, origen) {
    window.MF_COL = id || '';
    try { Q = ''; } catch (e) { /* sin buscador */ }
    var cv = document.getElementById('cv2'), h = hero();
    if (cv && h) { cv.outerHTML = h; window.mfCatInit(); }
    var gr = document.getElementById('gr'); if (gr) gr.innerHTML = grid();
    var q = document.getElementById('q'); if (q) q.value = '';
    var t = document.getElementById('rtit'); if (t) t.textContent = titulo();
    var cc = document.getElementById('rchips');
    if (cc) cc.outerHTML = chips();
    if (origen && origen.closest && origen.closest('.rcats')) window.scrollTo(0, 0);
    else { var l = document.getElementById('lista'); if (l && l.scrollIntoView) l.scrollIntoView({ behavior: 'smooth' }); }
  }

  window.mfRef = { ok: function () { try { return catalog().length > 0; } catch (e) { return false; } }, main: main, chip: chip };

  /* ---- Carrusel ---- */
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function barra() { return document.querySelector('.bar'); }
  function show(n) {
    var root = document.getElementById('cv2'); if (!root) return;
    var SL = root.querySelectorAll('.cs'), BR = root.querySelectorAll('.cpb button');
    n = (n + SL.length) % SL.length; if (n === cur) return;
    var old = cur >= 0 ? SL[cur] : null, nw = SL[n];
    if (old) { old.className = old.className.replace(/\b(on|rst)\b/g, '').trim() + ' prev'; (function (o) { setTimeout(function () { if (o !== SL[cur]) o.className = o.className.replace(/\bprev\b/g, '').trim() + ' rst'; }, 1300); })(old); }
    nw.className = nw.className.replace(/\b(prev|rst|on)\b/g, '').trim() + ' rst'; void nw.offsetWidth;
    nw.className = nw.className.replace(/\brst\b/g, '').trim() + ' on';
    cur = n;
    var oscuro = n === 0;
    root.style.setProperty('--c', oscuro ? '#fff' : '#111');
    var b = barra(); if (b) b.classList.toggle('dk', !oscuro);
    var cn = document.getElementById('cn2'); if (cn) cn.textContent = pad(n + 1) + ' / ' + pad(SL.length);
    BR.forEach(function (x, i) { x.className = i < n ? 'done' : (i === n ? 'on' : ''); });
    clearTimeout(tm); tm = setTimeout(tick, MS);
  }
  function tick() {
    var root = document.getElementById('cv2'); if (!root) return;
    if (document.hidden || window.scrollY > window.innerHeight * 0.8) { tm = setTimeout(tick, 1500); return; }
    show(cur + 1);
  }
  function alDesplazar() {
    var b = barra(); if (!b) return;
    if (document.body.classList.contains('cat')) b.classList.toggle('solid', window.scrollY > window.innerHeight * 0.6);
    else { b.classList.remove('solid'); b.classList.remove('dk'); }
  }

  window.mfCatInit = function () {
    clearTimeout(tm); cur = -1;
    var root = document.getElementById('cv2');
    document.body.classList.toggle('cat', !!root);
    alDesplazar();
    if (!root) return;
    show(0);
    var x0 = 0, y0 = 0;
    root.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
    root.addEventListener('touchend', function (e) {
      var dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) show(cur + (dx < 0 ? 1 : -1));
    }, { passive: true });
  };

  if (!wired) {
    wired = true;
    window.addEventListener('scroll', alDesplazar, { passive: true });
    document.addEventListener('click', function (e) {
      var t = e.target && e.target.closest ? e.target : null; if (!t) return;
      var b;
      if ((b = t.closest('[data-cs-ar]'))) { show(cur + Number(b.getAttribute('data-cs-ar'))); return; }
      if ((b = t.closest('[data-cs-bar]'))) { show(Number(b.getAttribute('data-cs-bar'))); return; }
      if (t.closest('[data-cs="go"]')) { var l = document.getElementById('lista'); if (l) l.scrollIntoView({ behavior: 'smooth' }); }
    });
  }
})();
