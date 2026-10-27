'use strict';
// GET /api/feed-meta  (público)  -> catálogo en CSV para Meta (Commerce Manager > Orígenes de datos > Lista de datos programada).
// Usa los MISMOS ids que manda el Píxel (content_ids), así los eventos coinciden con el catálogo.
// Solo publica productos visibles que tengan precio, foto y nombre; el resto se omite (GET ?omitidos=1 los lista).
// Nunca expone costos, stock exacto ni datos de pedidos: la disponibilidad es solo "in stock" / "out of stock".
const { cfg, ConfigError } = require('./config');
const db = require('./db');

const MARCA = 'Marlon Footwear';
const COLUMNAS = ['id', 'title', 'description', 'availability', 'condition', 'price', 'link', 'image_link', 'brand', 'product_type'];

const limpio = (v, n) => String(v == null ? '' : v).replace(/<[^>]*>/g, ' ').replace(/[\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
const celda = (v) => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
const absoluta = (site, u) => {
  const s = String(u || '').trim();
  if (!s) return '';
  if (/^https:\/\//i.test(s)) return s;
  if (/^[\w./-]+$/.test(s) && !s.startsWith('//')) return site + '/' + s.replace(/^\/+/, '');
  return '';
};

// Convierte un producto de la base en una fila, o devuelve { motivo } si no se puede publicar.
function fila(p, site) {
  const id = String(p.id || '');
  if (!/^[\w.-]{1,100}$/.test(id)) return { id, motivo: 'id inválido' };
  const title = limpio(p.nombre, 150);
  if (!title) return { id, motivo: 'sin nombre' };
  const precio = Number(p.precio);
  if (!Number.isInteger(precio) || precio <= 0) return { id, motivo: 'sin precio' };
  const imgs = Array.isArray(p.imagenes) && p.imagenes.length ? p.imagenes : [];
  const img = absoluta(site, p.imagen || imgs[0]);
  if (!img) return { id, motivo: 'sin foto válida' };
  const stock = p.stock && typeof p.stock === 'object' ? p.stock : {};
  const hay = Object.keys(stock).some((t) => Number(stock[t]) > 0);
  return {
    id,
    valores: [id, title, limpio(p.descripcion, 5000) || title, hay ? 'in stock' : 'out of stock', 'new', precio + ' COP',
      site + '/?producto=' + encodeURIComponent(id), img, MARCA, limpio(p.coleccion, 100)],
  };
}

function construir(productos, site) {
  const filas = [], omitidos = [];
  for (const p of productos || []) {
    const f = fila(p, site);
    if (f.motivo) omitidos.push({ id: f.id, motivo: f.motivo }); else filas.push(f.valores);
  }
  const csv = [COLUMNAS.map(celda).join(',')].concat(filas.map((v) => v.map(celda).join(','))).join('\r\n') + '\r\n';
  return { csv, publicados: filas.length, omitidos };
}

async function feedMeta(req) {
  const H = { 'X-Content-Type-Options': 'nosniff' };
  if (req.method !== 'GET') return { status: 405, headers: { ...H, Allow: 'GET' }, text: 'Método no permitido', tipo: 'text/plain; charset=utf-8' };
  try {
    const c = cfg('catalogo');
    if (!c.site) throw new ConfigError(['SITE_URL']);
    const r = construir(await db.listarCatalogoPublico(c), c.site);
    if (req.query && req.query.omitidos === '1') {
      return { status: 200, headers: { ...H, 'Cache-Control': 'no-store' }, text: JSON.stringify({ publicados: r.publicados, omitidos: r.omitidos }), tipo: 'application/json; charset=utf-8' };
    }
    return { status: 200, headers: { ...H, 'Cache-Control': 'public, max-age=300', 'X-Productos': String(r.publicados), 'X-Omitidos': String(r.omitidos.length) }, text: r.csv, tipo: 'text/csv; charset=utf-8' };
  } catch (e) {
    if (e instanceof ConfigError) console.error('[config]', e.message); else console.error('[error]', e && e.message ? e.message : e);
    return { status: 500, headers: { ...H, 'Cache-Control': 'no-store' }, text: 'No pudimos generar el catálogo', tipo: 'text/plain; charset=utf-8' };
  }
}

module.exports = feedMeta;
module.exports.construir = construir;
module.exports.COLUMNAS = COLUMNAS;
