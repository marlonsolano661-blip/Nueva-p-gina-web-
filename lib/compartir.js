'use strict';
// GET /?producto=<id o nombre>  (netlify.toml lo envía aquí)  -> la tienda (index.html) con la vista previa propia del producto:
// nombre, foto y precio al pegar el enlace en WhatsApp, Instagram, Facebook, Telegram, etc. Quien abre el enlace ve la tienda normal
// y la tienda abre ese producto (lo hace tienda-api.js). Nunca falla de cara a la clienta: si algo sale mal, entrega la tienda sin cambios.
const fs = require('node:fs');
const path = require('node:path');
const { cfg } = require('./config');
const db = require('./db');

const MARCA = 'Marlon Footwear';
const esc = (v) => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const limpio = (v, n) => String(v == null ? '' : v).replace(/<[^>]*>/g, ' ').replace(/[\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
const slug = (s) => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const cop = (n) => '$' + Math.round(Number(n) || 0).toLocaleString('es-CO');

// index.html viaja junto a la función (included_files en netlify.toml). Se busca en los sitios habituales.
function leerIndice() {
  const bases = [process.env.LAMBDA_TASK_ROOT, process.cwd(), path.join(__dirname, '..'), path.join(__dirname, '..', '..'), __dirname];
  for (const b of bases) {
    if (!b) continue;
    try { return fs.readFileSync(path.join(b, 'index.html'), 'utf8'); } catch (e) { /* se prueba el siguiente sitio */ }
  }
  return null;
}

function encontrar(productos, pedido) {
  const id = String(pedido || '').trim();
  if (!id || id.length > 100) return null;
  const lista = Array.isArray(productos) ? productos : [];
  return lista.find((p) => String(p.id) === id) || lista.find((p) => slug(p.nombre) === slug(id) && slug(id)) || null;
}

const imagenAbsoluta = (site, p) => {
  const imgs = Array.isArray(p.imagenes) && p.imagenes.length ? p.imagenes : [];
  const s = String(p.imagen || imgs[0] || '').trim();
  if (/^https:\/\//i.test(s)) return s;
  if (site && /^[\w./-]+$/.test(s) && !s.startsWith('//')) return site + '/' + s.replace(/^\/+/, '');
  return '';
};

// Devuelve el HTML de la tienda con el título, la descripción y las etiquetas Open Graph del producto.
function conVistaPrevia(html, p, site) {
  const nombre = limpio(p.nombre, 150);
  if (!nombre) return html;
  const precio = Number(p.precio);
  const hay = Number.isInteger(precio) && precio > 0;
  const titulo = nombre + ' · ' + MARCA;
  const desc = (hay ? cop(precio) + ' · ' : '') + (limpio(p.descripcion, 160) || 'Tacones exclusivos de alta calidad. Ediciones cortas, acabados impecables.');
  const url = site ? site + '/?producto=' + encodeURIComponent(String(p.id)) : '';
  const img = imagenAbsoluta(site, p);
  const t = [
    url ? `<link rel="canonical" href="${esc(url)}">` : '',
    '<meta property="og:type" content="product">',
    `<meta property="og:site_name" content="${MARCA}">`,
    '<meta property="og:locale" content="es_CO">',
    `<meta property="og:title" content="${esc(titulo)}">`,
    `<meta property="og:description" content="${esc(desc)}">`,
    url ? `<meta property="og:url" content="${esc(url)}">` : '',
    img ? `<meta property="og:image" content="${esc(img)}">` : '',
    `<meta name="twitter:card" content="${img ? 'summary_large_image' : 'summary'}">`,
    `<meta name="twitter:title" content="${esc(titulo)}">`,
    `<meta name="twitter:description" content="${esc(desc)}">`,
    img ? `<meta name="twitter:image" content="${esc(img)}">` : '',
    hay ? `<meta property="product:price:amount" content="${precio}"><meta property="product:price:currency" content="COP">` : '',
  ].filter(Boolean).join('\n');
  // La tienda ya trae etiquetas genéricas: se quitan para que solo quede la del producto (si hubiera dos, WhatsApp y otros usan la primera)
  let out = html.replace(/<meta (?:property="(?:og|product):[^"]*"|name="twitter:[^"]*")[^>]*>/gi, '').replace(/<link rel="canonical"[^>]*>/gi, '');
  out = out.replace(/<title>[\s\S]*?<\/title>/i, () => `<title>${esc(titulo)}</title>`);
  out = out.replace(/<meta name="description"[^>]*>/i, () => `<meta name="description" content="${esc(desc)}">`);
  return out.replace(/<\/head>/i, () => t + '\n</head>');
}

async function compartir(req) {
  const H = { 'X-Content-Type-Options': 'nosniff' };
  if (req.method !== 'GET' && req.method !== 'HEAD') return { status: 405, headers: { ...H, Allow: 'GET, HEAD' }, text: 'Método no permitido', tipo: 'text/plain; charset=utf-8' };
  const html = leerIndice();
  // Sin index.html a mano, se manda a la portada (nunca un error)
  if (!html) return { status: 302, headers: { ...H, Location: '/', 'Cache-Control': 'no-store' }, text: '', tipo: 'text/plain; charset=utf-8' };
  let salida = html, conProducto = false;
  try {
    const c = cfg('catalogo');
    const p = encontrar(await db.listarCatalogoPublico(c), req.query && req.query.id);
    if (p) { salida = conVistaPrevia(html, p, c.site || ''); conProducto = salida !== html; }
  } catch (e) {
    console.error('[compartir]', e && e.message ? e.message : e); // la tienda se entrega igual, sin vista previa
  }
  return {
    status: 200,
    headers: { ...H, 'Cache-Control': 'public, max-age=0, must-revalidate', 'Netlify-CDN-Cache-Control': conProducto ? 'public, s-maxage=60, stale-while-revalidate=300' : 'no-store' },
    text: req.method === 'HEAD' ? '' : salida, tipo: 'text/html; charset=utf-8',
  };
}

module.exports = compartir;
module.exports.conVistaPrevia = conVistaPrevia;
module.exports.encontrar = encontrar;
