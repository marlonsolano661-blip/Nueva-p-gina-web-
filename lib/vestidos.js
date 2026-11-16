'use strict';
// Vestidos (página /vestidos.html): la sesión de estudio. Se arma en el panel (sección "Vestidos") y se guarda en ajustes ('vestidos').
//   GET  /api/vestidos               (público) → looks visibles, en el formato que usa la página
//   GET  /api/vestidos?admin=1       (panel)   → todos los looks, también los ocultos
//   POST /api/vestidos { looks:[...] }                    (panel) → guarda la lista completa, en el orden recibido
//   POST /api/vestidos { accion:'firmar', tipo:'video/mp4' } (panel) → enlace para subir un archivo grande directo al
//        almacenamiento (los videos no caben por la función de Netlify). Devuelve { subir, url }: PUT del archivo a "subir"; "url" es la pública.
// Cada look: { id, visible, nombre, grupo, color:{n,h},
//   prenda:{ n, frente, espalda, w, h, gancho:[x,y], venta:{ id, n, p, color, colores, tallas, agotadas, fotos, fotosColor } },
//   foto:{ src, inicio, w, h, video, velocidad?, fin?, fondo?, disparos:[s] },
//   encaje:{ x, y, w }  (prenda sobre el PRIMER cuadro, en píxeles del video), puntoPrenda:[x,y] (sobre el cuadro final),
//   tacon:{ id, n, p, color?, colores, tallas, agotadas, punto:[x,y], mini?, desc?, fotos, fotosColor? } }
// Nombre, precio, tallas y colores se vuelven a tomar EN VIVO del catálogo en la página; lo guardado es solo respaldo.
const crypto = require('crypto');
const { cfg } = require('./config');
const db = require('./db');
const { esAdmin } = require('./auth');
const { guard, json } = require('./http');
const { parseBody, txt } = require('./util');

const MAX_LOOKS = 24, MAX_FOTOS = 12;
const RE_ID = /^[\w.-]{1,64}$/;
const RE_MEDIA = /^(https:\/\/[^\s"'<>()\\]{4,480}|vestidos\/[\w.-]{1,120})$/;
const RE_HEX = /^#[0-9a-fA-F]{6}$/;
const RE_TALLA = /^[\w.-]{1,10}$/;
const esObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const limpio = (v, n) => txt(v, n).replace(/[<>"]/g, '');
const media = (v) => { const u = typeof v === 'string' ? v.trim() : ''; return u && RE_MEDIA.test(u) && !u.includes('..') ? u : ''; };
const num = (v, min, max) => { const n = Number(v); return v !== null && v !== '' && Number.isFinite(n) && n >= min && n <= max ? Math.round(n * 100) / 100 : null; };
const ent = (v, min, max) => { const n = num(v, min, max); return n === null ? null : Math.round(n); };
const par = (v, W, H) => (Array.isArray(v) ? ((x, y) => (x !== null && y !== null ? [x, y] : null))(ent(v[0], 0, W), ent(v[1], 0, H)) : null);
const lista = (v, n, f) => (Array.isArray(v) ? v.slice(0, n).map(f).filter((x) => x !== null && x !== '') : []);
const talla = (t) => { const s = String(t == null ? '' : t).trim(); return RE_TALLA.test(s) ? s : null; };
const textoCorto = (t) => limpio(t, 30) || null;

// Una foto de la galería de compra: "url" | { u, fit:'contain' } | { v: video }
function fotoGaleria(f) {
  if (typeof f === 'string') return media(f) || null;
  if (!esObj(f)) return null;
  if (f.v) { const v = media(f.v); return v ? { v } : null; }
  const u = media(f.u);
  if (!u) return null;
  return f.fit === 'contain' ? { u, fit: 'contain' } : u;
}
function fotosColor(v) {
  const out = {};
  if (!esObj(v)) return out;
  Object.keys(v).slice(0, 12).forEach((k) => {
    const n = limpio(k, 30);
    const fs = lista(v[k], MAX_FOTOS, fotoGaleria);
    if (n && fs.length) out[n] = fs;
  });
  return out;
}
// Datos de respaldo del producto (si el catálogo no responde)
function producto(x, nombre) {
  const id = String(x && x.id || '').trim();
  if (!RE_ID.test(id)) return { error: nombre };
  const o = { id, n: limpio(x.n, 60) || id };
  const p = ent(x.p, 1, 100000000); if (p) o.p = p;
  const color = limpio(x.color, 30); if (color) o.color = color;
  o.colores = lista(x.colores, 12, textoCorto);
  o.tallas = lista(x.tallas, 20, talla);
  o.agotadas = lista(x.agotadas, 20, talla);
  o.fotos = lista(x.fotos, MAX_FOTOS, fotoGaleria);
  const fc = fotosColor(x.fotosColor); if (Object.keys(fc).length) o.fotosColor = fc;
  const desc = lista(x.desc, 6, (t) => limpio(t, 120) || null); if (desc.length) o.desc = desc;
  return { valor: o };
}

function validar(entrada) {
  if (!Array.isArray(entrada)) return { error: 'Lista de vestidos inválida' };
  if (entrada.length > MAX_LOOKS) return { error: `Máximo ${MAX_LOOKS} looks` };
  const out = [], ids = new Set();
  for (let i = 0; i < entrada.length; i++) {
    const x = entrada[i];
    if (!esObj(x)) return { error: 'Look inválido' };
    const nombre = limpio(x.nombre, 40);
    if (!nombre) return { error: `El look ${i + 1} necesita un nombre` };
    let id = String(x.id || '').trim();
    if (!RE_ID.test(id) || ids.has(id)) id = `v${Date.now().toString(36)}${i}`;
    ids.add(id);

    // La prenda colgada
    const P = esObj(x.prenda) ? x.prenda : {};
    const frente = media(P.frente);
    if (!frente) return { error: `Falta la foto de frente de la prenda en "${nombre}"` };
    const pw = ent(P.w, 50, 4000), ph = ent(P.h, 50, 6000);
    if (!pw || !ph) return { error: `Tamaño de la prenda inválido en "${nombre}"` };
    const prenda = { n: limpio(P.n, 60) || nombre, frente, w: pw, h: ph };
    const espalda = media(P.espalda); if (espalda) prenda.espalda = espalda;
    prenda.gancho = par(P.gancho, pw, ph) || [Math.round(pw / 2), 0];
    if (P.venta) {
      const v = producto(P.venta, 'x');
      if (v.error) return { error: `Elige el vestido de la tienda en "${nombre}"` };
      prenda.venta = v.valor;
    }

    // La sesión (video)
    const F = esObj(x.foto) ? x.foto : {};
    const fw = ent(F.w, 100, 5000), fh = ent(F.h, 100, 8000);
    const video = media(F.video), inicio = media(F.inicio) || media(F.src);
    if (!video) return { error: `Falta el video de la sesión en "${nombre}"` };
    if (!inicio) return { error: `Falta el primer cuadro del video en "${nombre}"` };
    if (!fw || !fh) return { error: `Tamaño del video inválido en "${nombre}"` };
    const foto = { src: inicio, inicio, w: fw, h: fh, video };
    const vel = num(F.velocidad, 0.25, 2); if (vel && vel !== 1) foto.velocidad = vel;
    const fin = num(F.fin, 0.3, 600); if (fin) foto.fin = fin;
    if (F.fondo === 'gris') foto.fondo = 'gris';
    foto.disparos = lista(F.disparos, 12, (s) => num(s, 0, 600)).sort((a, b) => a - b);

    // Encaje y puntos
    const E = esObj(x.encaje) ? x.encaje : {};
    const ex = ent(E.x, -fw, fw * 2), ey = ent(E.y, -fh, fh * 2), ew = ent(E.w, 20, fw * 3);
    if (ex === null || ey === null || !ew) return { error: `Ubica la prenda sobre la modelo en "${nombre}"` };
    const puntoPrenda = par(x.puntoPrenda, fw, fh);
    if (!puntoPrenda) return { error: `Marca el punto del vestido en "${nombre}"` };

    const look = { id, visible: x.visible !== false, nombre, grupo: limpio(x.grupo, 64) || id, prenda, foto, encaje: { x: ex, y: ey, w: ew }, puntoPrenda };
    const C = esObj(x.color) ? x.color : {};
    const cn = limpio(C.n, 30);
    if (cn) look.color = { n: cn, h: RE_HEX.test(String(C.h || '')) ? String(C.h) : '#cccccc' };

    // El tacón MF
    if (x.tacon) {
      const t = producto(x.tacon, 'x');
      if (t.error) return { error: `Elige el tacón de la tienda en "${nombre}"` };
      const punto = par(x.tacon.punto, fw, fh);
      if (!punto) return { error: `Marca el punto del tacón en "${nombre}"` };
      t.valor.punto = punto;
      const mini = media(x.tacon.mini); if (mini) t.valor.mini = mini;
      look.tacon = t.valor;
    }
    out.push(look);
  }
  return { valor: out };
}

const paraTienda = (v) => (Array.isArray(v) ? v.filter((x) => x && x.visible !== false && x.foto && x.prenda) : []);

// Enlace firmado para subir directo al bucket público 'productos', carpeta vestidos/.
const TIPOS = { 'video/mp4': 'mp4', 'video/quicktime': 'mov', 'image/webp': 'webp', 'image/png': 'png', 'image/jpeg': 'jpg' };
async function firmar(c, tipo) {
  const ext = TIPOS[tipo];
  if (!ext) return json(400, { error: 'Solo se aceptan videos MP4 o fotos JPG, PNG o WEBP' });
  const ruta = `vestidos/${Date.now()}-${crypto.randomBytes(6).toString('hex')}.${ext}`;
  const h = { apikey: c.key, 'Content-Type': 'application/json' };
  if (c.key.startsWith('eyJ')) h.Authorization = 'Bearer ' + c.key;
  const r = await fetch(`${c.db}/storage/v1/object/upload/sign/productos/${ruta}`, { method: 'POST', headers: h, body: '{}', signal: AbortSignal.timeout(10000) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.url) throw new Error(`Storage firmar -> ${r.status} ${JSON.stringify(d).slice(0, 200)}`);
  return json(200, { subir: `${c.db}/storage/v1${d.url}`, url: `${c.db}/storage/v1/object/public/productos/${ruta}` });
}

async function vestidos(req) {
  if (req.method === 'GET') {
    if (req.query.admin) {
      const c = cfg('admin');
      if (!esAdmin(req, c)) return json(401, { error: 'No autorizado' });
      const v = await db.getAjuste(c, 'vestidos');
      return json(200, { looks: Array.isArray(v) ? v : null }, { 'Cache-Control': 'no-store' });
    }
    const c = cfg('catalogo');
    const v = await db.getAjuste(c, 'vestidos');
    // null = nunca se ha guardado desde el panel (la página usa sus looks de respaldo)
    return json(200, { looks: Array.isArray(v) ? paraTienda(v) : null }, {
      'Cache-Control': 'public, max-age=0, must-revalidate',
      'Netlify-CDN-Cache-Control': 'public, s-maxage=30, stale-while-revalidate=120',
    });
  }
  if (req.method === 'POST') {
    const c = cfg('admin');
    if (!esAdmin(req, c)) return json(401, { error: 'No autorizado' });
    const b = parseBody(req.body);
    if (!b) return json(400, { error: 'Solicitud inválida' });
    if (b.accion === 'firmar') return firmar(c, String(b.tipo || ''));
    const v = validar(b.looks);
    if (v.error) return json(400, { error: v.error });
    const filas = await db.setAjuste(c, 'vestidos', v.valor);
    if (!Array.isArray(filas) || !filas.length) throw new Error('Los vestidos no quedaron guardados');
    await db.registrarEvento(c, 'vestidos_actualizados', null, { cantidad: v.valor.length });
    return json(200, { ok: true, looks: v.valor });
  }
  return json(405, { error: 'Método no permitido' }, { Allow: 'GET, POST' });
}

module.exports = guard(vestidos, { errorMsg: 'No se pudieron cargar los vestidos' });
module.exports.validar = validar;
module.exports.paraTienda = paraTienda;
