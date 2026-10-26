'use strict';
// Centro de control (solo ADMIN_TOKEN). Todo se valida y se guarda en el servidor.
//   GET  /api/admin-tienda?recurso=productos | envio | contenido | eventos
//   POST /api/admin-tienda  { recurso:'producto',  producto:{...} }   crea o actualiza un producto
//   POST /api/admin-tienda  { recurso:'envio',     tarifa: 17500 }    cambia la tarifa (no altera pedidos ya creados)
//   POST /api/admin-tienda  { recurso:'contenido', contenido:{...} }  textos, secciones y colecciones de la tienda
//   GET/POST ... recurso 'descuentos'  { descuentos:[{codigo,pct,activo,anuncio,nota}] }  códigos de descuento (% sobre productos)
//   GET/POST ... recurso 'banners'  { banners:[...] }  banners del inicio (foto, textos posicionables y botón)
const { cfg } = require('./config');
const db = require('./db');
const descuentos = require('./descuentos');
const { esAdmin } = require('./auth');
const { guard, json } = require('./http');
const crypto = require('crypto');
const { parseBody, txt } = require('./util');

const RE_ID = /^[\w.-]{1,64}$/;
const RE_TALLA = /^[\w.-]{1,10}$/;
const RE_IMG = /^(https:\/\/[^\s"'<>]{4,480}|assets\/[\w./-]{1,200})$/;
const RE_HEX = /^#[0-9a-fA-F]{6}$/;
const TEXTOS = ['hero_kicker', 'hero_titulo', 'boton_coleccion', 'boton_pagar', 'band_titulo', 'band_texto', 'band_boton'];
const SECCIONES = ['band', 'comunidad', 'valores'];
const MAX_IMAGENES = 30; // el catálogo original tiene productos con 16 fotos
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
  if (imagenes.length > MAX_IMAGENES) return { error: `Máximo ${MAX_IMAGENES} fotos por producto` };
  if (imagenes.some((u) => !RE_IMG.test(u)) || (imagen && !RE_IMG.test(imagen))) return { error: 'Imágenes inválidas (https://… o assets/…)' };
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
  const hero = typeof b.hero_foto === 'string' ? b.hero_foto.trim() : '';
  if (hero) { if (!RE_IMG.test(hero)) return { error: 'Foto de portada inválida (https://… o assets/…)' }; out.hero_foto = hero; }
  for (const k of TEXTOS) { const v = txt(esObj(b.textos) ? b.textos[k] : '', 200); if (v) out.textos[k] = v; }
  for (const k of SECCIONES) if (esObj(b.secciones) && typeof b.secciones[k] === 'boolean') out.secciones[k] = b.secciones[k];
  const cols = Array.isArray(b.colecciones) ? b.colecciones : [];
  if (cols.length > 20) return { error: 'Máximo 20 colecciones' };
  const vistos = new Set();
  for (const k of cols) {
    const id = String(esObj(k) ? k.id : '').trim(), nombre = txt(esObj(k) ? k.nombre : '', 40);
    if (!RE_ID.test(id) || !nombre || vistos.has(id)) return { error: 'Colección inválida o repetida' };
    vistos.add(id);
    const portada = typeof k.portada === 'string' ? k.portada.trim() : '';
    if (portada && !RE_IMG.test(portada)) return { error: 'Portada inválida (https://… o assets/…)' };
    const mensaje = txt(k.mensaje, 120);
    const col = { id, nombre, visible: k.visible !== false };
    if (mensaje) col.mensaje = mensaje;
    if (portada) col.portada = portada;
    out.colecciones.push(col);
  }
  return { valor: out };
}

// ---- Banners del inicio (diseñador): varios banners con foto, textos posicionables y un botón ----
const MAX_BANNERS = 6, MAX_CAPAS = 6;
const RE_URL = /^https:\/\/[^\s"'<>]{4,300}$/;
const num = (v, min, max, def) => { const n = Number(v); return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n * 10) / 10)) : def; };
const textoMultilinea = (v, n) => String(v == null ? '' : v).replace(/\r/g, '').replace(/\n{3,}/g, '\n\n').trim().slice(0, n);
const hex = (v, def) => (RE_HEX.test(String(v)) ? String(v).toLowerCase() : def);

function validarBanners(b) {
  if (!esObj(b) || !Array.isArray(b.banners)) return { error: 'Banners inválidos' };
  if (b.banners.length > MAX_BANNERS) return { error: `Máximo ${MAX_BANNERS} banners` };
  const out = [], ids = new Set();
  for (const x of b.banners) {
    if (!esObj(x)) return { error: 'Banner inválido' };
    const id = String(x.id == null ? '' : x.id).trim();
    if (!RE_ID.test(id) || ids.has(id)) return { error: 'Identificador de banner inválido o repetido' };
    ids.add(id);
    const foto = typeof x.foto === 'string' ? x.foto.trim() : '';
    if (foto && !RE_IMG.test(foto)) return { error: 'Foto del banner inválida (https://… o assets/…)' };
    const capasIn = Array.isArray(x.capas) ? x.capas : [];
    if (capasIn.length > MAX_CAPAS) return { error: `Máximo ${MAX_CAPAS} textos por banner` };
    const capas = [];
    for (const k of capasIn) {
      if (!esObj(k)) return { error: 'Texto de banner inválido' };
      const t = textoMultilinea(k.t, 140);
      if (!t) continue; // un texto vacío simplemente no se guarda
      capas.push({
        t, x: num(k.x, 0, 100, 50), y: num(k.y, 0, 100, 50), tam: num(k.tam, 2, 16, 6), ancho: num(k.ancho, 20, 100, 80),
        color: hex(k.color, '#ffffff'), fuente: k.fuente === 'sans' ? 'sans' : 'serif',
        cursiva: k.cursiva === true, mayus: k.mayus === true, grueso: k.grueso === true,
        alinea: k.alinea === 'left' || k.alinea === 'right' ? k.alinea : 'center',
      });
    }
    let boton = null;
    if (x.boton != null) {
      if (!esObj(x.boton)) return { error: 'Botón inválido' };
      const texto = txt(x.boton.texto, 40);
      if (texto) {
        const d = esObj(x.boton.destino) ? x.boton.destino : {};
        let destino;
        if (d.tipo === 'go') destino = { tipo: 'go' };
        else if (d.tipo === 'col') {
          const cid = String(d.id == null ? '' : d.id).trim();
          if (cid && !RE_ID.test(cid)) return { error: 'Colección del botón inválida' };
          destino = { tipo: 'col', id: cid };
        } else if (d.tipo === 'prod') {
          const pid = String(d.id == null ? '' : d.id).trim();
          if (!RE_ID.test(pid)) return { error: 'Producto del botón inválido' };
          destino = { tipo: 'prod', id: pid };
        } else if (d.tipo === 'url') {
          const u = String(d.url == null ? '' : d.url).trim();
          if (!RE_URL.test(u)) return { error: 'El enlace del botón debe empezar por https://' };
          destino = { tipo: 'url', url: u };
        } else return { error: 'Destino del botón inválido' };
        boton = { texto, destino, x: num(x.boton.x, 0, 100, 50), y: num(x.boton.y, 0, 100, 85), estilo: ['claro', 'oscuro', 'borde'].includes(x.boton.estilo) ? x.boton.estilo : 'claro' };
      }
    }
    const banner = {
      id, foto, fx: num(x.fx, 0, 100, 50), fy: num(x.fy, 0, 100, 50), oscuro: Math.round(num(x.oscuro, 0, 70, 25)),
      fondo: hex(x.fondo, '#111111'), capas, visible: x.visible !== false,
    };
    if (boton) banner.boton = boton;
    out.push(banner);
  }
  return { valor: out };
}

// Foto subida desde el panel: el navegador ya la reduce; aquí se comprueba que de verdad sea una imagen.
const MAX_FOTO = 3 * 1024 * 1024;
function validarFoto(b) {
  const datos = String(b && b.datos || '').replace(/^data:[^,]*,/, '');
  if (!datos || !/^[A-Za-z0-9+/=\s]+$/.test(datos)) return { error: 'Foto inválida' };
  const buf = Buffer.from(datos, 'base64');
  if (!buf.length) return { error: 'Foto inválida' };
  if (buf.length > MAX_FOTO) return { error: 'La foto pesa demasiado (máximo 3 MB)' };
  let tipo = '', ext = '';
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) { tipo = 'image/jpeg'; ext = 'jpg'; }
  else if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) { tipo = 'image/png'; ext = 'png'; }
  else if (buf.length > 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') { tipo = 'image/webp'; ext = 'webp'; }
  else return { error: 'Solo se aceptan fotos JPG, PNG o WEBP' };
  return { buf, tipo, nombre: `${Date.now()}-${crypto.randomBytes(6).toString('hex')}.${ext}` };
}

async function adminTienda(req) {
  const c = cfg('admin');
  if (!esAdmin(req, c)) return json(401, { error: 'No autorizado' });

  if (req.method === 'GET') {
    const r = String(req.query.recurso || '');
    if (r === 'productos') return json(200, { productos: await db.listarProductosAdmin(c) });
    if (r === 'envio') return json(200, { tarifa: await db.getEnvio(c) });
    if (r === 'contenido') return json(200, { contenido: (await db.getAjuste(c, 'contenido')) || {} });
    if (r === 'banners') return json(200, { banners: (await db.getAjuste(c, 'banners')) || [] });
    if (r === 'descuentos') return json(200, { descuentos: await descuentos.lista(c) });
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
    if (b.recurso === 'foto') {
      const v = validarFoto(b);
      if (v.error) return json(400, { error: v.error });
      const url = await db.subirFoto(c, v.nombre, v.buf, v.tipo);
      return json(200, { ok: true, url });
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
    if (b.recurso === 'banners') {
      const v = validarBanners(b);
      if (v.error) return json(400, { error: v.error });
      const filas = await db.setAjuste(c, 'banners', v.valor);
      if (!Array.isArray(filas) || !filas.length) throw new Error('Los banners no quedaron guardados');
      await db.registrarEvento(c, 'banners_actualizados', null, { cantidad: v.valor.length });
      return json(200, { ok: true, banners: v.valor });
    }
    if (b.recurso === 'descuentos') {
      const v = descuentos.validarLista(b.descuentos);
      if (v.error) return json(400, { error: v.error });
      const filas = await db.setAjuste(c, 'descuentos', v.valor);
      if (!Array.isArray(filas) || !filas.length) throw new Error('Los descuentos no quedaron guardados');
      await db.registrarEvento(c, 'descuentos_actualizados', null, { cantidad: v.valor.length });
      return json(200, { ok: true, descuentos: v.valor });
    }
    return json(400, { error: 'Recurso desconocido' });
  }
  return json(405, { error: 'Método no permitido' }, { Allow: 'GET, POST' });
}

module.exports = guard(adminTienda, { errorMsg: 'No se pudo completar la operación' });
