/* Vista del catálogo: barra con "Filtrar", conteo de productos y selector de vista (2 o 3 columnas),
   botón de bolsa sobre cada foto, muestras de color y paleta en blanco puro y negro.
   No cambia datos, precios, ids ni la compra: solo estilos y elementos de presentación.
   Se carga en index.html DESPUÉS de categoria.js (para que sus estilos tengan la última palabra).
   Si este archivo falla o no carga, la tienda funciona igual con su diseño anterior. */
(function () {
  'use strict';
  if (window.__mfVista) return; window.__mfVista = 1;

  var css = [
    /* ---- Paleta: más blanco y más negro (sin rosados ni grises azulados) ---- */
    ':root{--k:#000;--w:#fff;--g1:#f7f7f7;--g2:#e6e6e6;--g3:#555;--gr:#000;--gs:#f7f7f7;--rs:#fff;--rs2:#000;--mv:#000;--mv2:#000;--cr:#fff;--ro:#f7f7f7;--ch:#e6e6e6;--or:#444;--tx:#000;--mu:#555}',
    'body{background:#fff;color:#000}',
    /* ---- Encabezado: logo + nombre de la marca siempre visibles ---- */
    'body.cat .wm,body .wm{display:inline-block;font:600 .95rem Figtree,Jost,system-ui,sans-serif;letter-spacing:.18em;color:#000;white-space:nowrap}',
    '@media(max-width:380px){body .wm{font-size:.8rem;letter-spacing:.12em}}',
    '.pc .pr,.pr.big{color:#000}',
    '.pbox{background:#f7f7f7}',
    /* ---- Cabecera compacta de la colección ---- */
    'body .rcp{padding-top:1rem}',
    'body .rcp-head{text-align:left;margin:1.2rem 0 1rem}',
    'body .rcp-head .rey,body .rcp-head p{display:none}',
    'body .rcp-head h1{font:600 1.15rem/1.2 Figtree,Jost,system-ui,sans-serif;letter-spacing:.04em;text-transform:none;margin:0;color:#000}',
    'body .rchips{justify-content:flex-start;flex-wrap:nowrap;overflow-x:auto;gap:.5rem;margin:0 0 1rem;padding-bottom:2px;scrollbar-width:none}',
    'body .rchips::-webkit-scrollbar{display:none}',
    'body .rchip{flex:none;border:1px solid #d8d8d8;border-radius:999px;padding:.55rem 1rem;letter-spacing:.14em;color:#000}',
    'body .rchip::after{display:none}',
    'body .rchip.on{background:#000;color:#fff;border-color:#000}',
    /* ---- Barra: Filtrar · conteo · vista ---- */
    '.cv-bar{display:flex;align-items:center;gap:1rem;padding:.7rem 0;border-top:1px solid #e6e6e6;border-bottom:1px solid #e6e6e6;margin:0 0 1.1rem}',
    '.cv-fil{display:inline-flex;align-items:center;min-height:2.8rem;padding:0 1.4rem;border:1px solid #d8d8d8;border-radius:999px;background:#fff;color:#000;font:600 .95rem Figtree,Jost,system-ui,sans-serif;cursor:pointer}',
    '.cv-bar.open .cv-fil{background:#000;color:#fff;border-color:#000}',
    '.cv-n{font:400 .95rem Figtree,Jost,system-ui,sans-serif;color:#000}',
    '.cv-v{margin-left:auto;display:flex;gap:.3rem}',
    '.cv-v button{width:2.8rem;height:2.8rem;display:grid;place-items:center;border:0;border-radius:.6rem;background:transparent;color:#9a9a9a;cursor:pointer}',
    '.cv-v button[aria-pressed="true"]{background:#f1f1f1;color:#000}',
    '.cv-v svg{width:1.5rem;height:1.5rem;fill:currentColor}',
    'body .rcp .tools{display:none;max-width:none;margin:0 0 1.2rem;gap:.6rem}',
    'body .rcp .tools.cv-on{display:grid}',
    /* ---- Cuadrícula ---- */
    'body #gr{display:grid;gap:22px 12px;grid-template-columns:repeat(2,minmax(0,1fr))}',
    'body #gr.cv3{gap:16px 6px;grid-template-columns:repeat(3,minmax(0,1fr))}',
    '@media(min-width:800px){body #gr{gap:40px 18px;grid-template-columns:repeat(3,minmax(0,1fr))}body #gr.cv3{gap:28px 12px;grid-template-columns:repeat(5,minmax(0,1fr))}}',
    /* ---- Tarjeta ---- */
    'body #gr .pc{text-align:left;align-items:stretch;background:none}',
    'body #gr .pc .im{position:relative;aspect-ratio:3/4;background:#fff;border:1px solid #efefef;overflow:hidden}',
    'body #gr .pc .im::after{display:none}',
    'body #gr .pc:hover .im img{transform:none}',
    'body #gr .pc h3{font:600 .8rem/1.35 Figtree,Jost,system-ui,sans-serif;letter-spacing:.06em;text-transform:uppercase;color:#000;margin:.75rem 0 .2rem}',
    'body #gr.cv3 .pc h3{font-size:.62rem;letter-spacing:.04em;margin-top:.5rem}',
    'body #gr .pc .pr{font:500 .95rem Figtree,Jost,system-ui,sans-serif;letter-spacing:0;color:#000;margin:0 0 .45rem}',
    'body #gr.cv3 .pc .pr{font-size:.72rem}',
    'body #gr .pc .dots{display:flex;justify-content:flex-start;gap:.4rem;margin:0 0 .3rem}',
    'body #gr .pc .dots i{display:block;width:1rem;height:1rem;border-radius:50%;background:var(--c,#ccc);border:1px solid #cfcfcf}',
    'body #gr.cv3 .pc .dots{display:none}',
    '.cv-bag{position:absolute;right:.6rem;bottom:.6rem;width:2.7rem;height:2.7rem;display:grid;place-items:center;border:0;border-radius:50%;background:#fff;color:#000;box-shadow:0 1px 6px #0003;cursor:pointer;padding:0}',
    '.cv-bag svg{width:1.25rem;height:1.25rem;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}',
    'body #gr.cv3 .cv-bag{width:2rem;height:2rem;right:.4rem;bottom:.4rem}body #gr.cv3 .cv-bag svg{width:1rem;height:1rem}',
    'body #gr .pc .tag{position:absolute;left:.5rem;top:.5rem;background:#000;color:#fff;padding:.25rem .55rem;font:600 .6rem Figtree,sans-serif;letter-spacing:.12em;text-transform:uppercase}'
  ].join('\n');
  var st = document.createElement('style'); st.setAttribute('data-vista', '1'); st.textContent = css; document.head.appendChild(st);

  var BOLSA = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8h14l-1 12H6L5 8z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></svg>';
  var V2 = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="8" height="8" rx="1"/><rect x="13" y="3" width="8" height="8" rx="1"/><rect x="3" y="13" width="8" height="8" rx="1"/><rect x="13" y="13" width="8" height="8" rx="1"/></svg>';
  var V3 = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="5" height="5" rx=".8"/><rect x="9.5" y="3" width="5" height="5" rx=".8"/><rect x="16" y="3" width="5" height="5" rx=".8"/><rect x="3" y="9.5" width="5" height="5" rx=".8"/><rect x="9.5" y="9.5" width="5" height="5" rx=".8"/><rect x="16" y="9.5" width="5" height="5" rx=".8"/><rect x="3" y="16" width="5" height="5" rx=".8"/><rect x="9.5" y="16" width="5" height="5" rx=".8"/><rect x="16" y="16" width="5" height="5" rx=".8"/></svg>';

  var vista = '2';
  try { var g = localStorage.getItem('mf_vista'); if (g === '3') vista = '3'; } catch (e) { /* sin almacenamiento */ }
  function guardar() { try { localStorage.setItem('mf_vista', vista); } catch (e) { /* nada */ } }

  function texto(n) { return n + (n === 1 ? ' producto' : ' productos'); }

  function refrescar() {
    var gr = document.getElementById('gr'); if (!gr) return;
    gr.classList.toggle('cv3', vista === '3');
    var cp = gr.closest('.rcp'); if (!cp) return;
    var tools = cp.querySelector('.tools');
    var bar = cp.querySelector('.cv-bar');
    if (!bar) {
      bar = document.createElement('div'); bar.className = 'cv-bar';
      bar.innerHTML = '<button type="button" class="cv-fil" data-cvf aria-expanded="false">Filtrar</button><span class="cv-n" role="status"></span>' +
        '<div class="cv-v" role="group" aria-label="Vista"><button type="button" data-cvv="2" aria-label="Ver de a dos">' + V2 + '</button><button type="button" data-cvv="3" aria-label="Ver de a tres">' + V3 + '</button></div>';
      if (tools && tools.parentNode) tools.parentNode.insertBefore(bar, tools); else gr.parentNode.insertBefore(bar, gr);
    }
    Array.prototype.forEach.call(bar.querySelectorAll('[data-cvv]'), function (b) { var on = b.getAttribute('data-cvv') === vista; if (b.getAttribute('aria-pressed') !== String(on)) b.setAttribute('aria-pressed', String(on)); });
    var cards = gr.querySelectorAll('.pc[data-id]');
    var n = bar.querySelector('.cv-n'), t = texto(cards.length);
    if (n && n.textContent !== t) n.textContent = t;
    Array.prototype.forEach.call(cards, function (c) {
      var im = c.querySelector('.im'); if (!im || im.querySelector('.cv-bag')) return;
      var b = document.createElement('button'); b.type = 'button'; b.className = 'cv-bag';
      b.setAttribute('data-n', 'prod'); b.setAttribute('data-id', c.getAttribute('data-id'));
      b.setAttribute('aria-label', 'Elegir talla de ' + (c.querySelector('h3') ? c.querySelector('h3').textContent : 'este modelo'));
      b.innerHTML = BOLSA; im.appendChild(b);
    });
  }

  document.addEventListener('click', function (e) {
    var t = e.target && e.target.closest ? e.target : null; if (!t) return;
    var f = t.closest('[data-cvf]');
    if (f) {
      var bar = f.closest('.cv-bar'), tools = bar && bar.parentNode.querySelector('.tools');
      var open = !bar.classList.contains('open');
      bar.classList.toggle('open', open); f.setAttribute('aria-expanded', String(open));
      if (tools) tools.classList.toggle('cv-on', open);
      if (open && tools) { var q = tools.querySelector('input'); if (q) try { q.focus(); } catch (x) { /* nada */ } }
      return;
    }
    var v = t.closest('[data-cvv]');
    if (v) { vista = v.getAttribute('data-cvv') === '3' ? '3' : '2'; guardar(); refrescar(); }
  });

  var pendiente = false;
  function programar() { if (pendiente) return; pendiente = true; requestAnimationFrame(function () { pendiente = false; try { refrescar(); } catch (e) { /* la tienda sigue igual */ } }); }
  function iniciar() {
    var app = document.getElementById('app') || document.body;
    new MutationObserver(programar).observe(app, { childList: true, subtree: true });
    programar();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();
