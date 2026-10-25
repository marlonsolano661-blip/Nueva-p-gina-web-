'use strict';
// GET /api/catalogo  (público)  -> productos publicados, tarifa de envío y contenido de la tienda.
// Es lo que lee la tienda. Nunca expone costos ni datos de pedidos; el stock se resume en tallas disponibles.
const { cfg } = require('./config');
const db = require('./db');
const { guard, json } = require('./http');

async function catalogo(req) {
  if (req.method !== 'GET') return json(405, { error: 'Método no permitido' }, { Allow: 'GET' });
  const c = cfg('catalogo');
  const [filas, tarifa, contenido, banners] = await Promise.all([db.listarCatalogoPublico(c), db.getEnvio(c), db.getAjuste(c, 'contenido'), db.getAjuste(c, 'banners').catch(() => null)]);
  const productos = (filas || []).map((p) => {
    const imgs = Array.isArray(p.imagenes) && p.imagenes.length ? p.imagenes : (p.imagen ? [p.imagen] : []);
    const stock = p.stock && typeof p.stock === 'object' ? p.stock : {};
    return {
      id: p.id, name: p.nombre, price: Number(p.precio), desc: p.descripcion || '',
      img: p.imagen || imgs[0] || '', imgs, colors: Array.isArray(p.colores) ? p.colores : [],
      tallas: Object.keys(stock).filter((t) => Number(stock[t]) > 0).sort((a, b) => Number(a) - Number(b)),
      coleccion: p.coleccion || '', destacado: !!p.destacado,
    };
  });
  const cont = { ...(contenido || {}) };
  const visibles = Array.isArray(banners) ? banners.filter((x) => x && x.visible !== false) : [];
  if (visibles.length) cont.banners = visibles; // solo los banners publicados
  return json(200, { productos, envio: { tarifa }, contenido: cont });
}

module.exports = guard(catalogo, { errorMsg: 'No pudimos cargar el catálogo' });
