'use strict';
// Centro de control (solo ADMIN_TOKEN). Todo se valida y se guarda en el servidor.
//   GET  /api/admin-tienda?recurso=productos | envio | contenido | eventos
//   POST /api/admin-tienda  { recurso:'producto',  producto:{...} }   crea o actualiza un producto
//   POST /api/admin-tienda  { recurso:'envio',     tarifa: 17500 }    cambia la tarifa (no altera pedidos ya creados)
//   POST /api/admin-tienda  { recurso:'contenido', contenido:{...} }  textos, secciones y colecciones de la tienda
const { cfg } = require('./config');
const db = require('./db');
const { esAdmin } = require('./auth');
const { guard, json } = require('./http');
const { parseBody, txt } = require('./util');

const RE_ID = /^[\w.-]{1,64}$/;
const RE_TALLA = /^[\w.-]{1,10}$/;
const RE_IMG = /^(https:\/\/[^\s"'<>]{4,480}|assets\/[\w./-]{1,200})$/;
const RE_HEX = /^#[0-9a-fA-F]{6}$/;
const TEXTOS = ['hero_kicker', 'hero_titulo', 'boton_coleccion', 'boton_pagar', 'band_titulo', 'band_texto', 'band_boton'];
const SECCIONES = ['band', 'comunidad', 'valores'];
const MAX_PRECIO = 100000000;
const MAX_TARIFA = 1000000;

const esObj = (v) => v && typeof v === 'object' && !Array.isArray(v);

function validarProducto(b) {
  if (!esObj(b)) return { error: 'Producto inválido' };
  const id = String(b.id == null ? '' : b.id).trim();
  if (!RE_ID.test(id)) return { error: 'Identificador inválido (letras, números, guiones; máx. 64)' };
  const nombre = txt(b.nombre, 120);
  if (!nombre) return { error: 'El producto necesita nombre' };
  const precio = Number(b.precio);
  if (!Number.isInteger(precio) || precio < 1 || precio > MAX_PRECIO) return { error: 'Precio inválido (pesos enteros mayores a 0)' };
  if (!esObj(b.stock)) return { error: 'Inventario inválido' };
  const stock = {};
  for (const [t, n] of Object.entries(b.stock)) {
    if (!RE_TALLA.test(t) || !Number.isInteger(Number(n)) || Number(n) < 0 || Number(n) > 9999) return { error: `Inventario inválido en talla ${t}` };
    stock[t] = Number(n);
  }
  const imagenes = Array.isArray(b.imagenes) ? b.imagenes.map((x) => String(x).trim()).filter(Boolean) : [];
  const imagen = txt(b.imagen || imagenes[0] || '', 500);
  if (imagenes.length > 12 || imagenes.some((u) => !RE_IMG.test(u)) || (imagen && !RE_IMG.test(imagen))) return { error: 'Imágenes inválidas (https://… o assets/…)' };
  const colores = [];
  for (const k of Array.isArray(b.colores) ? b.colores : []) {
    if (!esObj(k) || !txt(k.n, 30) || !RE_HEX.test(String(k.h))) return { error: 'Color inválido (nombre y código #RRGGBB)' };
    colores.push({ n: txt(k.n, 30), h: String(k.h) });
  }
  if (colores.length > 12) return { error: 'Máximo 12 colores' };
  const orden = b.orden == null ? 0 : Number(b.orden);
  if (!Number.isInteger(orden) || orden < -9999 || orden > 9999) return { error: 'Orden inválido' };
  return {
    fila: {
      id, nombre, precio, stock, descripcion: txt(b.descripcion, 1500), imagen: imagen || null, imagenes,
      colores, coleccion: txt(b.coleccion, 40) || null, destacado: b.destacado === true, orden, visible: b.visible !== false,
    },
  };
}

function validarContenido(b) {
  if (!esObj(b)) return { error: 'Contenido inválido' };
  const out = { textos: {}, secciones: {}, colecciones: [] };
  for (const k of TEXTOS) { const v = txt(esObj(b.textos) ? b.textos[k] : '', 200); if (v) out.textos[k] = v; }
  for (const k of SECCIONES) if (esObj(b.secciones) && typeof b.secciones[k] === 'boolean') out.secciones[k] = b.secciones[k];
  const cols = Array.isArray(b.colecciones) ? b.colecciones : [];
  if (cols.length > 20) return { error: 'Máximo 20 colecciones' };
  const vistos = new Set();
  for (const k of cols) {
    const id = String(esObj(k) ? k.id : '').trim(), nombre = txt(esObj(k) ? k.nombre : '', 40);
    if (!RE_ID.test(id) || !nombre || vistos.has(id)) return { error: 'Colección inválida o repetida' };
    vistos.add(id);
    out.colecciones.push({ id, nombre, visible: k.visible !== false });
  }
  return { valor: out };
}

async function adminTienda(req) {
  const c = cfg('admin');
  if (!esAdmin(req, c)) return json(401, { error: 'No autorizado' });

  if (req.method === 'GET') {
    const r = String(req.query.recurso || '');
    if (r === 'productos') return json(200, { productos: await db.listarProductosAdmin(c) });
    if (r === 'envio') return json(200, { tarifa: await db.getEnvio(c) });
    if (r === 'contenido') return json(200, { contenido: (await db.getAjuste(c, 'contenido')) || {} });
    if (r === 'eventos') return json(200, { eventos: await db.listarEventos(c, Math.min(Math.max(parseInt(req.query.limite, 10) || 50, 1), 200)) });
    return json(400, { error: 'Recurso desconocido' });
  }

  if (req.method === 'POST') {
    const b = parseBody(req.body);
    if (!b) return json(400, { error: 'Solicitud inválida' });
    if (b.recurso === 'producto') {
      const v = validarProducto(b.producto);
      if (v.error) return json(400, { error: v.error });
      const filas = await db.upsertProducto(c, v.fila);
      if (!Array.isArray(filas) || !filas.length) throw new Error('El producto no quedó guardado');
      await db.registrarEvento(c, 'producto_guardado', v.fila.id, { precio: v.fila.precio, visible: v.fila.visible });
      return json(200, { ok: true, producto: filas[0] });
    }
    if (b.recurso === 'envio') {
      const tarifa = typeof b.tarifa === 'number' || (typeof b.tarifa === 'string' && b.tarifa.trim() !== '') ? Number(b.tarifa) : NaN;
      if (!Number.isInteger(tarifa) || tarifa < 0 || tarifa > MAX_TARIFA) return json(400, { error: 'Tarifa inválida (pesos enteros, 0 o más)' });
      const anterior = await db.getEnvio(c);
      const filas = await db.setAjuste(c, 'envio', { tarifa });
      if (!Array.isArray(filas) || !filas.length) throw new Error('La tarifa no quedó guardada');
      await db.registrarEvento(c, 'envio_actualizado', null, { anterior, nueva: tarifa });
      return json(200, { ok: true, tarifa });
    }
    if (b.recurso === 'contenido') {
      const v = validarContenido(b.contenido);
      if (v.error) return json(400, { error: v.error });
      const filas = await db.setAjuste(c, 'contenido', v.valor);
      if (!Array.isArray(filas) || !filas.length) throw new Error('El contenido no quedó guardado');
      await db.registrarEvento(c, 'contenido_actualizado', null, {});
      return json(200, { ok: true, contenido: v.valor });
    }
    return json(400, { error: 'Recurso desconocido' });
  }
  return json(405, { error: 'Método no permitido' }, { Allow: 'GET, POST' });
}

module.exports = guard(adminTienda, { errorMsg: 'No se pudo completar la operación' });
