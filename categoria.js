/* Diseño de la tienda: portada principal + tres portadas de colección apiladas (sin carrusel) + página de colección.
   Usa el catálogo real (catalog()), las colecciones y la foto de portada del panel. No inventa productos, precios ni fotos:
   cada portada de colección usa su foto propia (si se subió en el panel) o la foto real de uno de sus productos.
   Se carga en index.html después de tienda-api.js. Expone window.mfRef { ok, home, col, chip } y window.mfCatInit. */
(function () {
  'use strict';
  var ORDEN = ['tacones', 'plataformas', 'sandalias'];
  var FRASES = {
    tacones: 'Elegancia en altura, con personalidad propia.',
    plataformas: 'Comodidad con presencia, para caminar con carácter.',
    sandalias: 'Ligeras y con estilo, para cada ocasión.'
  };
  var MARCA = 'MF nace alrededor de una idea sencilla: calzado femenino en ediciones cortas, con acabados impecables.';
  var deep = false;

  var css = [
    /* ---- Tipografía y botones de toda la tienda ---- */
    ':root{--mv:#6b1d33;--mv2:#4a1222;--cr:#f8f1e9;--ro:#efd5cc;--ch:#e8d6b8;--or:#b58a4f;--tx:#1d1416;--mu:#6f6260}',
    'body{font-family:Jost,system-ui,sans-serif;font-weight:300}',
    'body h1,body h2,body h3,body .st,body .pt{font-family:"Cormorant Garamond",Georgia,serif;font-weight:500;letter-spacing:-.01em;text-transform:none}',
    'body .btn{border-radius:0;font-weight:400;letter-spacing:.26em}',
    'body .ann{display:none}',
    'body.cat .wm,body.cat .sq{display:none}',
    /* ---- Botón negro principal ---- */
    '.rbtn{display:inline-flex;align-items:center;justify-content:center;min-height:3.4rem;padding:1.05rem 2.6rem;background:var(--mv);color:#fff;border:1px solid var(--mv);border-radius:0;font:400 .78rem Jost,sans-serif;letter-spacing:.3em;text-transform:uppercase;cursor:pointer;transition:background .3s,color .3s}',
    '.rbtn:hover{background:transparent;color:var(--mv)}',
    '.rcov[data-k="tacones"] .rbtn{background:#fff;color:var(--mv);border-color:#fff}.rcov[data-k="tacones"] .rbtn:hover{background:transparent;color:#fff}',
    '.rey{font:400 .7rem Jost,sans-serif;letter-spacing:.5em;text-transform:uppercase;color:var(--or);margin-bottom:1rem}',
    /* ---- Portada principal ---- */
    '.rh{display:grid;grid-template-columns:1fr;background:var(--cr);color:var(--tx)}',
    '.rh-tx h1 em{color:var(--mv)}',
    '.rh-ph,.rcov-ph{width:100%;position:relative;background:var(--ro);overflow:hidden;aspect-ratio:4/5;max-height:72svh}',
    '.rh-ph{max-height:54svh}',
    '.rh-ph img,.rcov-ph img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;transition:transform 1.2s cubic-bezier(.2,.8,.2,1)}',
    '.rh-ph img.fit,.rcov-ph img.fit{inset:7%;width:86%;height:86%;object-fit:contain;mix-blend-mode:multiply;-webkit-mask-image:radial-gradient(ellipse at center,#000 62%,transparent 99%);mask-image:radial-gradient(ellipse at center,#000 62%,transparent 99%)}',
    '.rh-tx,.rcov-tx{padding:2.2rem 1.4rem 3rem;text-align:center;display:flex;flex-direction:column;align-items:center;justify-content:center}',
    '.rh-tx h1{font-size:clamp(32px,7.4vw,66px);line-height:1.08;margin:0 0 1rem;max-width:18ch}',
    '.rh-tx h1 em{font-style:italic}',
    '.rh-tx p,.rcov-tx p{font-size:1rem;line-height:1.7;color:var(--mu);margin:0 0 1.8rem;max-width:30rem}',
    '@media(min-width:900px){.rh{grid-template-columns:1fr 1.1fr;min-height:calc(100svh - 8rem)}.rh-ph{aspect-ratio:auto;max-height:none;order:2}.rh-tx{order:1;text-align:left;align-items:flex-start;padding:4rem 6vw}}',
    /* ---- Portadas de colección apiladas ---- */
    '.rcols{border-top:1px solid var(--ch)}',
    '.rcov{display:grid;grid-template-columns:1fr;border-bottom:1px solid var(--ch);background:var(--cr);color:var(--tx)}',
    '.rcov[data-k="tacones"]{background:var(--mv);color:#fff}.rcov[data-k="tacones"] .rcov-ph{background:#7e2a43}.rcov[data-k="tacones"] .rcov-tx p{color:#ecd9d3}.rcov[data-k="tacones"] .rey{color:var(--ch)}',
    '.rcov[data-k="plataformas"]{background:var(--ch)}.rcov[data-k="plataformas"] .rcov-ph{background:#f1e5cf}',
    '.rcov[data-k="sandalias"]{background:var(--ro)}.rcov[data-k="sandalias"] .rcov-ph{background:#f7e4dc}',
    '.rcov-tx h2{font-size:clamp(40px,9vw,84px);line-height:1;margin:0 0 .9rem}',
    '@media(min-width:900px){.rcov{grid-template-columns:1fr 1fr;min-height:min(86svh,780px)}.rcov-ph{aspect-ratio:auto;max-height:none}.rcov-tx{padding:4rem 6vw;align-items:flex-start;text-align:left}.rcov:nth-child(even) .rcov-ph{order:2}.rcov:hover .rcov-ph img{transform:scale(1.04)}.rcov:hover .rcov-ph img.fit{transform:scale(1.04)}}',
    '.rall{text-align:center;padding:2.4rem 1rem 0}',
    '.rall button{border:0;background:none;font:400 .75rem Jost,sans-serif;letter-spacing:.28em;text-transform:uppercase;padding:0 0 4px;border-bottom:1px solid var(--mv);cursor:pointer;color:var(--mv)}',
    '.rvbg{background:var(--mv2);color:#fff}.rvals{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:36px;max-width:960px;margin:0 auto;padding:70px 24px;text-align:center}',
    '.rvals h3{font-size:24px;margin:0 0 8px;color:var(--ch)}.rvals p{font-size:13px;line-height:1.7;color:#e6d3cd;margin:0}',
    /* ---- Página de colección ---- */
    '.rcp{background:var(--cr);max-width:1240px;margin:0 auto;padding:1.6rem 10px 60px}',
    '.rback{border:0;background:none;font:400 .72rem Jost,sans-serif;letter-spacing:.26em;text-transform:uppercase;cursor:pointer;color:var(--mv);padding:0 0 3px;border-bottom:1px solid var(--mv)}',
    '.rcp-head{text-align:center;margin:2.2rem 0 2rem}',
    '.rcp-head h1{font-size:clamp(44px,9vw,92px);line-height:1;margin:0 0 .8rem;color:var(--mv)}',
    '.rcp-head p{color:var(--mu);margin:0 auto;max-width:30rem}',
    '.rchips{display:flex;gap:26px;justify-content:center;flex-wrap:wrap;margin-bottom:34px}',
    '.rchip{border:0;background:none;font:400 .75rem Jost,sans-serif;letter-spacing:.24em;text-transform:uppercase;color:var(--mu);padding:0 0 6px;position:relative;cursor:pointer;transition:color .3s}',
    '.rchip::after{content:"";position:absolute;left:0;bottom:0;height:1px;width:100%;background:var(--or);transform:scaleX(0);transition:transform .4s}',
    '.rchip.on{color:var(--mv)}.rchip.on::after{transform:scaleX(1)}',
    '.rcp .tools{max-width:34rem;margin:0 auto 34px}.rcp .tools input,.rcp .tools select{border-radius:0}',
    'body #gr{display:grid;grid-template-columns:repeat(2,1fr);gap:26px 8px}@media(min-width:800px){body #gr{grid-template-columns:repeat(3,1fr);gap:56px 30px}}',
    'body #gr .pc{border:0;background:none;box-shadow:none;border-radius:0;padding:0;text-align:center;display:block;cursor:pointer;transform:none}',
    'body #gr .pc .im{position:relative;aspect-ratio:3/4;background:#fffaf5;border-radius:0;display:grid;place-items:center;overflow:hidden}',
    'body #gr .pc .im::after{content:"";position:absolute;inset:7px;border:1px solid var(--ch);transition:inset .5s,border-color .5s;pointer-events:none}',
    'body #gr .pc:hover .im::after{inset:4px;border-color:var(--or)}',
    'body #gr .pc .im img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center}',
    'body #gr .pc h3{font:500 clamp(20px,5vw,26px)/1.1 "Cormorant Garamond",Georgia,serif;letter-spacing:0;text-transform:none;margin:18px 0 4px}',
    'body #gr .pc .pr{font:400 14px Jost,sans-serif;letter-spacing:.1em;color:var(--mv);margin:0 0 10px}',
    'body #gr .pc .dots{justify-content:center;margin:0 0 10px}',
    'body #gr .pc .btn.s{width:auto;min-height:0;border:0;border-bottom:1px solid var(--mv);background:none;color:var(--mv);border-radius:0;padding:0 0 3px;font:400 11px Jost,sans-serif;letter-spacing:.28em}',
    'body #gr .pc .btn.s:hover{background:none;color:var(--or)}',
    '@media(prefers-reduced-motion:reduce){.rh-ph img,.rcov-ph img{transition:none}}'
  ].join('\n');
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  var E = function (t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (m) { return '&#' + m.charCodeAt(0) + ';'; }); };
  var foto = function (p) { return (p && (p.img || (p.imgs && p.imgs[0]))) || ''; };

  function visibles() {
    var c = ((window.MF_CONTENIDO && window.MF_CONTENIDO.colecciones) || []).filter(function (k) { return k.visible !== false; });
    var pos = function (k) { var i = ORDEN.indexOf(k.id); return i < 0 ? ORDEN.length : i; };
    return c.map(function (k, i) { return { k: k, i: i }; }).sort(function (a, b) { return pos(a.k) - pos(b.k) || a.i - b.i; }).map(function (x) { return x.k; });
  }
  function deColeccion(id) { return catalog().filter(function (p) { return p.coleccion === id; }); }
  function conProductos() { return visibles().filter(function (k) { return deColeccion(k.id).length > 0; }); }
  function actual() { var id = window.MF_COL || ''; return visibles().filter(function (k) { return k.id === id; })[0] || null; }
  function frase(k, n) { return FRASES[k.id] || (n + (n === 1 ? ' modelo' : ' modelos') + ' en pocas unidades.'); }
  function img(src, alt, cover) { return src ? '<img class="' + (cover ? '' : 'fit') + '" src="' + E(src) + '" alt="' + E(alt) + '" decoding="async">' : ''; }

  /* ---- Portada principal ---- */
  function heroFoto() {
    var h = window.MF_CONTENIDO && window.MF_CONTENIDO.hero_foto;
    if (h) return { src: h, cover: true };
    var C = catalog().filter(function (p) { return foto(p); });
    var d = C.filter(function (p) { return p.destacado; })[0] || C[0];
    return d ? { src: foto(d), cover: false, alt: d.name } : null;
  }
  function hero() {
    var f = heroFoto(), titulo = TX('hero_titulo', '');
    var h1 = titulo ? E(titulo) : 'El calzado no completa el look. <em>Lo transforma.</em>';
    var sub = TX('hero_kicker', '') || MARCA;
    return '<section class="rh" id="rh"><div class="rh-ph">' + (f ? img(f.src, f.alt || 'Calzado Marlon Footwear', f.cover) : '') + '</div>' +
      '<div class="rh-tx"><div class="rey">Marlon Footwear</div><h1>' + h1 + '</h1><p>' + E(sub) + '</p>' +
      '<button class="rbtn" data-r="go">Ver colecciones</button></div></section>';
  }

  /* ---- Portadas de colección, una debajo de otra ---- */
  function portadas() {
    var L = conProductos();
    if (!L.length) return '';
    return '<div class="rcols" id="colecciones">' + L.map(function (k) {
      var ps = deColeccion(k.id), n = ps.length;
      var f = k.portada ? { src: k.portada, cover: true } : (function () { var d = ps.filter(function (p) { return foto(p); }); var q = d.filter(function (p) { return p.destacado; })[0] || d[0]; return q ? { src: foto(q), cover: false } : null; })();
      return '<section class="rcov" data-k="' + E(k.id) + '" id="c-' + E(k.id) + '"><div class="rcov-ph">' + (f ? img(f.src, k.nombre, f.cover) : '') + '</div>' +
        '<div class="rcov-tx"><div class="rey">Colección</div><h2>' + E(k.nombre) + '</h2><p>' + E(frase(k, n)) + '</p>' +
        '<button class="rbtn" data-ver="' + E(k.id) + '" aria-label="Ver colección ' + E(k.nombre) + '">Ver colección</button></div></section>';
    }).join('') + '</div><div class="rall"><button data-ver="">Ver todos los modelos</button></div>';
  }

  function valores() {
    var env = typeof window.MF_ENVIO === 'number' ? 'Tarifa fija de ' + fmt(window.MF_ENVIO) + ' a todo el país.' : 'Envío a todo el país.';
    return '<div class="rvbg"><div class="rvals"><div><h3>Envío</h3><p>' + E(env) + '</p></div><div><h3>Pago seguro</h3><p>Tarjeta, Nequi o PSE con Wompi.</p></div><div><h3>Ediciones limitadas</h3><p>Pocas unidades por modelo.</p></div></div></div>';
  }

  function home() { return '<div data-rnew="home">' + hero() + portadas() + valores() + '</div>'; }

  /* ---- Página de una colección (o de todos los modelos) ---- */
  function chips() {
    var id = window.MF_COL || '', c = visibles();
    var one = function (v, n) { var on = id === v; return '<button class="rchip' + (on ? ' on' : '') + '" data-cf="' + E(v) + '" aria-pressed="' + on + '">' + E(n) + '</button>'; };
    return '<div class="rchips">' + one('', 'Todo') + c.map(function (k) { return one(k.id, k.nombre); }).join('') + '</div>';
  }
  function col() {
    var k = actual(), n = catalog().filter(function (p) { return !k || p.coleccion === k.id; }).length;
    var titulo = k ? k.nombre : 'Todos los modelos';
    var sub = k ? frase(k, n) : 'Cada modelo, en pocas unidades.';
    return '<section class="rcp" id="lista" data-rnew="col"><button class="rback" data-r="home">← Inicio</button>' +
      '<div class="rcp-head"><div class="rey">Colección</div><h1>' + E(titulo) + '</h1><p>' + E(sub) + '</p></div>' + chips() +
      '<div class="tools"><input id="q" type="search" placeholder="Buscar modelo" aria-label="Buscar modelo" value="' + E(Q) + '"><select id="so" aria-label="Ordenar"><option value="">Ordenar</option><option value="a"' + (SO === 'a' ? ' selected' : '') + '>Precio: menor a mayor</option><option value="d"' + (SO === 'd' ? ' selected' : '') + '>Precio: mayor a menor</option></select></div>' +
      '<div class="grid" id="gr">' + grid() + '</div></section>';
  }

  function chip(id) {
    window.MF_COL = id || '';
    try { Q = ''; } catch (e) { /* sin buscador */ }
    try { history.replaceState(history.state, '', id ? '#' + id : location.pathname + location.search); } catch (e) { /* sin historial */ }
    draw(); window.scrollTo(0, 0);
  }

  window.mfRef = { ok: function () { try { return catalog().length > 0; } catch (e) { return false; } }, home: home, col: col, chip: chip };

  window.mfCatInit = function () {
    /* Enlace directo: tienda/#tacones abre esa colección una sola vez, cuando ya llegó el catálogo */
    if (!deep && window.MF_API_OK) {
      deep = true;
      var h = decodeURIComponent((location.hash || '').slice(1));
      if (h && visibles().some(function (k) { return k.id === h; })) { window.MF_COL = h; pg = 'col'; draw(); return; }
    }
    document.body.classList.toggle('cat', !!document.querySelector('[data-rnew]'));
  };

  /* Si cambian el # de la dirección con la tienda abierta, se abre esa colección */
  addEventListener('hashchange', function () {
    var h = decodeURIComponent((location.hash || '').slice(1));
    if (h && visibles().some(function (k) { return k.id === h; }) && (window.MF_COL !== h || pg !== 'col')) { window.MF_COL = h; pg = 'col'; draw(); window.scrollTo(0, 0); }
  });

  /* Estado de la colección en el historial (botón "atrás") */
  addEventListener('popstate', function (e) { if (e.state && typeof e.state.c === 'string') { window.MF_COL = e.state.c; draw(); } });

  document.addEventListener('click', function (e) {
    var t = e.target && e.target.closest ? e.target : null; if (!t) return;
    var b;
    if ((b = t.closest('[data-ver]'))) { window.MF_COL = b.getAttribute('data-ver') || ''; try { Q = ''; } catch (x) { /* */ } nav('col'); return; }
    if ((b = t.closest('[data-r]'))) {
      var a = b.getAttribute('data-r');
      if (a === 'go') { var l = document.getElementById('colecciones'); if (l) l.scrollIntoView({ behavior: 'smooth' }); }
      if (a === 'home') { window.MF_COL = ''; nav('home'); }
    }
  });
  /* "Colección" del menú o del encabezado abre todos los modelos */
  document.addEventListener('click', function (e) {
    var t = e.target && e.target.closest ? e.target.closest('[data-n="go"][data-p="col"],[data-mn="col"]') : null;
    if (t && !t.hasAttribute('data-ver')) window.MF_COL = '';
  }, true);
})();
