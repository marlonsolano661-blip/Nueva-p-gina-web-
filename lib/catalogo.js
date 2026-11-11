'use strict';
// GET /api/catalogo  (público)  -> productos publicados, tarifa de envío y contenido de la tienda.
// Es lo que lee la tienda. Nunca expone costos ni datos de pedidos; el stock se resume en tallas disponibles.
const { cfg } = require('./config');
const db = require('./db');
const { guard, json } = require('./http');
const descuentos = require('./descuentos');
const looks = require('./looks');

// Ropa: tallas en letras y talla única. Si un producto tiene alguna, es ropa; si no, calzado (34…40).
const TALLAS_ROPA = ['XS', 'S', 'M', 'L', 'XL', 'Unica'];
const esRopa = (stock) => Object.keys(stock || {}).some((t) => TALLAS_ROPA.includes(t));
const ordenTalla = (a, b) => {
  const ia = TALLAS_ROPA.indexOf(a), ib = TALLAS_ROPA.indexOf(b);
  if (ia > -1 || ib > -1) return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  return Number(a) - Number(b);
};

async function catalogo(req) {
  if (req.method !== 'GET') return json(405, { error: 'Método no permitido' }, { Allow: 'GET' });
  const c = cfg('catalogo');
  // Todo en paralelo: antes la promo y las fotos esperaban a las otras consultas (más tiempo en blanco al abrir la tienda)
  const [filas, tarifa, contenido, banners, promo, fotos, vitrina] = await Promise.all([
    db.listarCatalogoPublico(c), db.getEnvio(c), db.getAjuste(c, 'contenido'), db.getAjuste(c, 'banners').catch(() => null),
    descuentos.anuncio(c).catch(() => null), looks.publicados(c).catch(() => []), db.getAjuste(c, 'vitrina').catch(() => null),
  ]);
  const productos = (filas || []).map((p) => {
    const imgs = Array.isArray(p.imagenes) && p.imagenes.length ? p.imagenes : (p.imagen ? [p.imagen] : []);
    const stock = p.stock && typeof p.stock === 'object' ? p.stock : {};
    return {
      id: p.id, name: p.nombre, price: Number(p.precio), desc: p.descripcion || '',
      img: p.imagen || imgs[0] || '', imgs, colors: Array.isArray(p.colores) ? p.colores : [],
      tallas: Object.keys(stock).filter((t) => Number(stock[t]) > 0).sort(ordenTalla),
      tipo: esRopa(stock) ? 'ropa' : 'calzado',
      coleccion: p.coleccion || '', destacado: !!p.destacado,
    };
  });
  const cont = { ...(contenido || {}) };
  const visibles = Array.isArray(banners) ? banners.filter((x) => x && x.visible !== false) : [];
  if (visibles.length) cont.banners = visibles; // solo los banners publicados
  if (Array.isArray(vitrina) && vitrina.length) cont.vitrina = vitrina; // productos de "La vitrina" del inicio (elegidos en el panel)
  if (promo) cont.promo = { pct: promo.pct, correo: true, ...(promo.foto ? { foto: promo.foto } : {}) }; // el código NO se publica: se entrega en /api/bienvenida al dejar el correo
  if (fotos.length) cont.looks = looks.paraTienda(fotos); // fotos de la Comunidad ya aprobadas
  // Datos públicos: la CDN los guarda 30 s (y sirve la copia anterior hasta 2 min mientras se renueva) para que la tienda abra rápido.
  // Un cambio hecho en el panel se ve en la tienda en menos de un minuto. El navegador siempre revalida.
  return json(200, { productos, envio: { tarifa }, contenido: cont }, {
    'Cache-Control': 'public, max-age=0, must-revalidate',
    'Netlify-CDN-Cache-Control': 'public, s-maxage=30, stale-while-revalidate=120',
  });
}

module.exports = guard(catalogo, { errorMsg: 'No pudimos cargar el catálogo' });
