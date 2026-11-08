/* Sección "Cómo comprar" en el inicio: un mini vídeo animado (HTML + CSS) que muestra el flujo de compra.
   NO toca la lógica de compra: solo agrega una sección a la portada, igual que banners.js.
   Si este archivo falla o no carga, la tienda funciona igual.
   Se carga solo desde el final de banners.js (junto con como-comprar.css): no hay que tocar index.html. */
(function () {
  'use strict';
  if (window.__mfComoComprar) return;
  window.__mfComoComprar = 1;

  var D = 3400; // duración de cada paso (ms)
  var PASOS = [
    ['Elige tu modelo', 'Explora la colección y toca el par que te enamore.'],
    ['Color y talla', 'Escoge el color y tu talla. ¿Dudas? Abre la guía de tallas.'],
    ['Agrégalo a la bolsa', 'Toca “Agregar a la bolsa” o “Comprar ahora” para ir directo.'],
    ['Tus datos de entrega', 'Nombre, cédula, dirección y ciudad. Enviamos a toda Colombia.'],
    ['Paga seguro', 'Con tarjeta o con Wompi: PSE, Nequi y más. Tu pago está protegido.'],
    ['¡Listo!', 'Recibes la confirmación y te avisamos por WhatsApp cuando salga tu pedido.']
  ];

  function E(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function precio(n) { return '$' + Math.round(n || 0).toLocaleString('es-CO'); }

  // Usa un producto real de la tienda para que el vídeo se vea como tu catálogo; si no hay, uno de ejemplo
  function productos() {
    var L = [];
    try { if (typeof catalog === 'function') L = catalog() || []; } catch (e) { L = []; }
    L = L.filter(function (p) { return p && p.name; });
    var base = { name: 'Tacón Aurora', price: 189900, img: '', tallas: ['35', '36', '37', '38', '39'], colors: [{ n: 'Negro', h: '#111' }, { n: 'Nude', h: '#d9b8a3' }, { n: 'Rojo', h: '#8e1b25' }] };
    var p = L[0] || base;
    var tallas = (p.tallas && p.tallas.length ? p.tallas : base.tallas).slice(0, 5);
    var colores = (p.colors && p.colors.length ? p.colors : base.colors).slice(0, 4);
    return { p: p, otros: L.slice(1, 4), tallas: tallas, colores: colores };
  }
  function foto(src) {
    return src ? '<div class="cc-im" style="background-image:url(&quot;' + E(src) + '&quot;)"></div>' : '<div class="cc-im ph"></div>';
  }
  function tb(n) { return '<div class="cc-tb"><span class="cc-lg">MF</span><span class="cc-bag">Bolsa <b><span>' + n + '</span><span>' + (n + 1) + '</span></b></span></div>'; }
  function tap(x, y, t) { return '<i class="cc-tap" style="--x:' + x + ';--y:' + y + ';--t:' + t + 's"></i>'; }

  function pantalla() {
    var d = productos(), p = d.p, el = d.tallas[Math.min(2, d.tallas.length - 1)];
    var nombre = E(p.name), pr = precio(p.price);
    var tarj = function (q) { return '<div>' + foto(q && q.img) + '<p>' + E(q ? q.name : 'Nuevo modelo') + '</p><small>' + (q ? precio(q.price) : '&nbsp;') + '</small></div>'; };
    var sw = '<div class="cc-sw">' + d.colores.map(function (c) { return '<i style="--c:' + E(c.h || '#111') + '"></i>'; }).join('') + '</div>';
    var sz = '<div class="cc-sz">' + d.tallas.map(function (t) { return '<i' + (t === el ? ' class="el"' : '') + '>' + E(t) + '</i>'; }).join('') + '</div>';
    var check = '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
    return '<div class="cc-bars">' + PASOS.map(function () { return '<i></i>'; }).join('') + '</div>' +
      // 1 · Elige
      '<div class="cc-s cc-s1">' + tb(0) + '<p class="cc-ttl">Colección</p><div class="cc-gr">' + tarj(p) + tarj(d.otros[0]) + tarj(d.otros[1]) + tarj(d.otros[2]) + '</div>' + tap('28%', '44%', 1) + '</div>' +
      // 2 · Color y talla
      '<div class="cc-s cc-s2">' + tb(0) + '<div class="cc-pd">' + foto(p.img) + '<h4>' + nombre + '</h4><p class="pr">' + pr + '</p><p class="cc-lb">Color</p>' + sw + '<p class="cc-lb">Talla</p>' + sz + '</div>' + tap('31%', '78%', .45) + tap('47%', '90%', 1.25) + '</div>' +
      // 3 · A la bolsa
      '<div class="cc-s cc-s3">' + tb(0) + '<div class="cc-pd">' + foto(p.img) + '<h4>' + nombre + '</h4><p class="pr">' + pr + '</p>' + sz + '<div class="cc-row"><span class="cc-btn o">Agregar a la bolsa</span><span class="cc-btn">Comprar ahora</span></div></div>' +
        '<div class="cc-toast">' + check + 'Agregado a tu bolsa</div>' + tap('50%', '79%', .85) + '</div>' +
      // 4 · Datos
      '<div class="cc-s cc-s4">' + tb(1).replace('<span>1</span><span>2</span>', '<span>1</span>') + '<div class="cc-crumbs">Bolsa › <b>Datos y envío</b> › Pago</div><p class="cc-ttl">Entrega</p>' +
        '<div class="cc-fl" style="--t:.3s"><small>Nombre y apellidos</small><span style="--t:.3s">Valentina Gómez</span></div>' +
        '<div class="cc-fl" style="--t:.9s"><small>Cédula</small><span style="--t:.9s">1.020.345.678</span></div>' +
        '<div class="cc-fl" style="--t:1.5s"><small>Dirección</small><span style="--t:1.5s">Calle 85 # 12-40, apto 502</span></div>' +
        '<div class="cc-fl" style="--t:2.1s"><small>Ciudad</small><span style="--t:2.1s">Bogotá</span></div>' +
        '<div class="cc-fl" style="--t:2.6s"><small>Celular</small><span style="--t:2.6s">300 123 4567</span></div></div>' +
      // 5 · Pago
      '<div class="cc-s cc-s5">' + tb(1).replace('<span>1</span><span>2</span>', '<span>1</span>') + '<div class="cc-crumbs">Bolsa › Datos › <b>Pago</b></div><p class="cc-ttl">Pago</p>' +
        '<div class="cc-op on"><i></i><div><b>Tarjeta</b><small>Crédito o débito, sin salir de la tienda</small></div></div>' +
        '<div class="cc-op"><i></i><div><b>Wompi</b><small>PSE, Nequi, Bancolombia y más</small></div></div>' +
        '<div class="cc-tot"><span>Total</span><span>' + pr + '</span></div><span class="cc-btn">Pagar ' + pr + '</span>' +
        '<div class="cc-lock"><svg viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>Pago seguro con Wompi</div>' + tap('50%', '76%', 1.2) + '</div>' +
      // 6 · Listo
      '<div class="cc-s cc-s6"><svg class="cc-ok" viewBox="0 0 52 52"><circle cx="26" cy="26" r="24"/><path d="M15 27l7.5 7.5L38 19"/></svg><p class="cc-ttl">¡Pedido confirmado!</p><p class="cc-mut">Puedes seguir tu pedido en cualquier momento.</p>' +
        '<span class="cc-wa"><svg viewBox="0 0 24 24"><path d="M4 20l1.3-3.9A8 8 0 1 1 8 18.8z"/></svg>Seguimiento por WhatsApp</span></div>';
  }

  var ICON_PAUSA = '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="3" y="2" width="3.5" height="12" rx="1"/><rect x="9.5" y="2" width="3.5" height="12" rx="1"/></svg>';
  var ICON_PLAY = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2.2v11.6a.6.6 0 0 0 .9.5l9.2-5.8a.6.6 0 0 0 0-1L4.9 1.7a.6.6 0 0 0-.9.5z"/></svg>';

  function html() {
    return '<section class="cc" id="como-comprar" aria-labelledby="cc-t">' +
      '<div class="cc-head"><h2 id="cc-t">CÓMO COMPRAR</h2><p class="cc-sub">En 6 pasos · menos de un minuto</p><span class="cc-line" aria-hidden="true"></span></div>' +
      '<div class="cc-body"><div class="cc-ph" aria-hidden="true"><div class="cc-scr"></div></div>' +
      '<div class="cc-side"><ol class="cc-steps">' + PASOS.map(function (s, i) { return '<li><button type="button" data-cc="' + i + '"><b>' + E(s[0]) + '</b><span>' + E(s[1]) + '</span></button></li>'; }).join('') + '</ol>' +
      '<div class="cc-dots" aria-hidden="true">' + PASOS.map(function (s, i) { return '<button type="button" tabindex="-1" data-cc="' + i + '"></button>'; }).join('') + '</div>' +
      '<div class="cc-ctl"><button type="button" class="cc-pp" aria-label="Pausar">' + ICON_PAUSA + '</button><small>Paso <b class="cc-n">1</b> de ' + PASOS.length + '</small></div></div></div>' +
      '<div class="cc-cta"><button class="btn" data-n="go" data-p="col">Ver la colección</button></div></section>';
  }

  /* ---------- Reproductor ---------- */
  var actual = null; // reproductor de la sección que está en pantalla (la tienda redibuja #app al navegar)
  function iniciar() {
    var sec = document.getElementById('como-comprar');
    if (!sec || sec.__cc) return;
    sec.__cc = 1;
    if (actual) actual.parar();
    var scr = sec.querySelector('.cc-scr');
    scr.innerHTML = pantalla();
    var esc = scr.querySelectorAll('.cc-s'), bars = scr.querySelectorAll('.cc-bars i');
    var lis = sec.querySelectorAll('.cc-steps li'), dots = sec.querySelectorAll('.cc-dots button');
    var pp = sec.querySelector('.cc-pp'), num = sec.querySelector('.cc-n');
    var reduce = false;
    try { reduce = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { /* nada */ }
    var i = 0, t = 0, restante = D, inicio = 0, porUsuario = reduce, visible = false;

    function dur(k) { return k === PASOS.length - 1 ? D + 900 : D; }
    function mostrar(k) {
      i = (k + PASOS.length) % PASOS.length;
      for (var j = 0; j < esc.length; j++) {
        var on = j === i;
        if (on) { esc[j].classList.remove('on'); void esc[j].offsetWidth; } // reinicia las animaciones del paso
        esc[j].classList.toggle('on', on);
        bars[j].classList.toggle('ya', j < i);
        bars[j].classList.remove('on');
        lis[j].classList.toggle('on', on);
        if (dots[j]) dots[j].classList.toggle('on', on);
      }
      void bars[i].offsetWidth;
      bars[i].style.setProperty('--cc-d', dur(i) + 'ms');
      bars[i].classList.add('on');
      if (num) num.textContent = i + 1;
      restante = dur(i);
    }
    function correr() {
      clearTimeout(t);
      if (porUsuario || !visible) return;
      sec.classList.remove('pausa');
      inicio = Date.now();
      t = setTimeout(function () { mostrar(i + 1); correr(); }, restante);
    }
    function detener() {
      if (!sec.classList.contains('pausa')) restante = Math.max(0, restante - (Date.now() - inicio));
      clearTimeout(t);
      sec.classList.add('pausa');
    }
    function boton() {
      pp.innerHTML = porUsuario ? ICON_PLAY : ICON_PAUSA;
      pp.setAttribute('aria-label', porUsuario ? 'Reproducir' : 'Pausar');
    }
    function alternar() {
      porUsuario = !porUsuario;
      if (porUsuario) detener(); else { if (i === PASOS.length - 1 && restante <= 0) mostrar(0); correr(); }
      boton();
    }

    pp.addEventListener('click', alternar);
    sec.querySelector('.cc-ph').addEventListener('click', alternar);
    [].forEach.call(sec.querySelectorAll('[data-cc]'), function (b) {
      b.addEventListener('click', function () {
        mostrar(+b.getAttribute('data-cc'));
        if (porUsuario) detener(); else correr();
      });
    });

    mostrar(0);
    if (porUsuario) { sec.classList.add('pausa'); boton(); }

    // Solo se reproduce cuando la sección está en pantalla (ahorra batería y la clienta lo ve desde el paso 1)
    var io = null;
    if ('IntersectionObserver' in window) {
      io = new IntersectionObserver(function (es) {
        var v = es[0].isIntersecting;
        if (v === visible) return;
        visible = v;
        if (v) correr(); else detener();
      }, { threshold: 0.35 });
      io.observe(sec.querySelector('.cc-ph'));
    } else { visible = true; correr(); }
    function onVis() { if (document.hidden) detener(); else if (visible) correr(); }
    document.addEventListener('visibilitychange', onVis);

    actual = { parar: function () { clearTimeout(t); if (io) io.disconnect(); document.removeEventListener('visibilitychange', onVis); } };
  }

  /* Se engancha a la portada sin tocar la tienda: agrega la sección después de las colecciones del inicio */
  function engancha() {
    var R = window.mfRef;
    if (!R || !R.home || R.__cc) return false;
    var h0 = R.home;
    R.home = function () {
      var s = h0.apply(this, arguments);
      try { if (s && s.indexOf('id="como-comprar"') < 0 && s.indexOf('data-rnew="home"') >= 0) return s.replace(/<\/div>\s*$/, html() + '</div>'); } catch (e) { /* se queda la portada de siempre */ }
      return s;
    };
    R.__cc = 1;
    var i0 = window.mfCatInit;
    window.mfCatInit = function () { if (i0) i0.apply(this, arguments); try { iniciar(); } catch (e) { /* nunca debe romper la tienda */ } };
    return true;
  }
  if (!engancha()) document.addEventListener('DOMContentLoaded', engancha);
  // Por si el inicio ya estaba dibujado cuando cargó este archivo
  try { if (window.mfRef && window.mfRef.__cc && typeof draw === 'function' && document.querySelector('#app [data-rnew="home"]')) draw(); } catch (e) { /* nada */ }

  window.mfComoComprar = { html: html, iniciar: iniciar };
})();
