/* Botón "Ideas para combinar este tacón" en la ficha de producto.
   Solo sale en los tacones que tienen looks en la pasarela (/outfits) y lleva a esos looks.
   Lo carga header.js. Si falla, la tienda funciona igual. */
(function () {
  'use strict';
  var app = document.getElementById('app');
  if (!app || window.__mfOutfitsBoton) return;
  window.__mfOutfitsBoton = 1;
  var EJEMPLO = ['sandalia-miel-elite-mf']; // tacón de los looks de ejemplo, mientras no haya looks guardados en el panel
  var ids = null, fotos = {};

  var css = document.createElement('style');
  css.textContent = [
    '.of-ideas{display:flex;align-items:center;gap:.8rem;margin:1.1rem 0 .4rem;padding:.55rem .9rem .55rem .55rem;border:1px solid #0a0a0a;color:#0a0a0a;text-decoration:none;background:#fff}',
    '.of-ideas img{width:44px;height:58px;object-fit:cover;background:#f6f6f4;flex:none}',
    '.of-ideas span{flex:1;display:grid;gap:.15rem}',
    '.of-ideas b{font:500 .7rem Jost,Helvetica,sans-serif;letter-spacing:.2em;text-transform:uppercase}',
    '.of-ideas small{font-size:.82rem;color:#6b6b66}',
    '.of-ideas i{font-style:normal;font-size:1.1rem}',
    '.of-ideas:hover{background:#0a0a0a;color:#fff}.of-ideas:hover small{color:#ddd}'
  ].join('\n');
  document.head.appendChild(css);

  function idActual(pd) {
    var b = pd.querySelector('[data-n="add"][data-id]');
    if (b) return b.getAttribute('data-id');
    var h = pd.querySelector('.pi h1'), nombre = h ? h.textContent : '';
    try { var p = (typeof catalog === 'function' ? catalog() : []).filter(function (x) { return x.name === nombre; })[0]; return p ? String(p.id) : ''; } catch (e) { return ''; }
  }

  function poner() {
    if (!ids) return;
    var pd = app.querySelector('.pd');
    if (!pd || pd.querySelector('.of-ideas')) return;
    var id = idActual(pd);
    if (!id || ids.indexOf(id) < 0) return;
    var a = document.createElement('a');
    a.className = 'of-ideas';
    a.href = 'outfits.html?producto=' + encodeURIComponent(id);
    a.innerHTML = (fotos[id] ? '<img alt="" loading="lazy">' : '') + '<span><b>Ideas para combinar este tacón</b><small>Outfits para cada ocasión</small></span><i aria-hidden="true">→</i>';
    if (fotos[id]) a.querySelector('img').src = fotos[id];
    var t = pd.querySelector('.pi .trust');
    if (t) t.parentNode.insertBefore(a, t); else (pd.querySelector('.pi') || pd).appendChild(a);
  }

  fetch((window.MF_API_BASE || '') + '/api/outfits').then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
    var L = d && Array.isArray(d.outfits) ? d.outfits : [];
    ids = L.length ? L.map(function (x) { return String(x.producto); }) : EJEMPLO;
    L.forEach(function (x) { if (!fotos[x.producto] && x.fotos && x.fotos[0]) fotos[x.producto] = x.fotos[0].url; });
    poner();
  }).catch(function () { ids = EJEMPLO; poner(); });

  new MutationObserver(function () { try { poner(); } catch (e) { /* nunca debe romper la tienda */ } }).observe(app, { childList: true });
})();
