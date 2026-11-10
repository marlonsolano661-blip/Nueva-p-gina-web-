'use strict';
// Ideas de outfits (pasarela /outfits). Se arman en el panel (sección "Outfits") y se guardan en ajustes ('outfits').
//   GET  /api/outfits               (público) → looks visibles para la pasarela
//   GET  /api/outfits?admin=1       (panel)   → todos los looks, también los ocultos
//   POST /api/outfits { outfits:[...] } (panel) → guarda la lista completa, en el orden recibido
// Cada look: { id, nombre, ocasion, visible, producto, color, fotos:[{ e:'Frente', url }], piezas:[{ n:'Vestido camel', foto? }] }
const { cfg } = require('./config');
const db = require('./db');
const { esAdmin } = require('./auth');
const { guard, json } = require('./http');
const { parseBody, txt } = require('./util');

const MAX_LOOKS = 12, MAX_FOTOS = 4, MAX_PIEZAS = 8;
const RE_ID = /^[\w.-]{1,64}$/;
const RE_IMG = /^(https:\/\/[^\s"'<>]{4,480}|(assets|outfits-img)\/[\w./-]{1,200})$/;
const esObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const limpio = (v, n) => txt(v, n).replace(/[<>]/g, '');
const img = (v) => { const u = typeof v === 'string' ? v.trim() : ''; return u && RE_IMG.test(u) && !u.includes('..') ? u : ''; };

function validar(lista) {
  if (!Array.isArray(lista)) return { error: 'Lista de outfits inválida' };
  if (lista.length > MAX_LOOKS) return { error: `Máximo ${MAX_LOOKS} looks` };
  const out = [], ids = new Set();
  for (let i = 0; i < lista.length; i++) {
    const x = lista[i];
    if (!esObj(x)) return { error: 'Look inválido' };
    const nombre = limpio(x.nombre, 40);
    if (!nombre) return { error: `El look ${i + 1} necesita un nombre` };
    let id = String(x.id || '').trim();
    if (!RE_ID.test(id) || ids.has(id)) id = `o${Date.now().toString(36)}${i}`;
    ids.add(id);
    const producto = String(x.producto || '').trim();
    if (!RE_ID.test(producto)) return { error: `Elige el tacón del look "${nombre}"` };
    const fotosIn = Array.isArray(x.fotos) ? x.fotos : [];
    if (fotosIn.length > MAX_FOTOS) return { error: `Máximo ${MAX_FOTOS} fotos de la modelo en "${nombre}"` };
    const fotos = [];
    for (const f of fotosIn) {
      if (!esObj(f)) continue;
      const url = img(f.url);
      if (!url) return { error: `Hay una foto inválida en "${nombre}"` };
      fotos.push({ e: limpio(f.e, 20) || 'Frente', url });
    }
    if (!fotos.length) return { error: `Sube al menos una foto de la modelo en "${nombre}"` };
    const piezasIn = Array.isArray(x.piezas) ? x.piezas : [];
    if (piezasIn.length > MAX_PIEZAS) return { error: `Máximo ${MAX_PIEZAS} prendas en "${nombre}"` };
    const piezas = [];
    for (const p of piezasIn) {
      if (!esObj(p)) continue;
      const n = limpio(p.n, 60);
      if (!n) continue; // fila vacía: se ignora
      const foto = p.foto ? img(p.foto) : '';
      if (p.foto && !foto) return { error: `La foto de "${n}" no es válida` };
      piezas.push(foto ? { n, foto } : { n });
    }
    out.push({ id, nombre, ocasion: limpio(x.ocasion, 30), visible: x.visible !== false, producto, color: limpio(x.color, 30), fotos, piezas });
  }
  return { valor: out };
}

// Lo que ve la tienda: solo los looks visibles.
const paraTienda = (v) => (Array.isArray(v) ? v.filter((x) => x && x.visible !== false && Array.isArray(x.fotos) && x.fotos.length) : []);

async function outfits(req) {
  if (req.method === 'GET') {
    if (req.query.admin) {
      const c = cfg('admin');
      if (!esAdmin(req, c)) return json(401, { error: 'No autorizado' });
      const v = await db.getAjuste(c, 'outfits');
      return json(200, { outfits: Array.isArray(v) ? v : [] }, { 'Cache-Control': 'no-store' });
    }
    const c = cfg('catalogo');
    return json(200, { outfits: paraTienda(await db.getAjuste(c, 'outfits')) }, {
      'Cache-Control': 'public, max-age=0, must-revalidate',
      'Netlify-CDN-Cache-Control': 'public, s-maxage=30, stale-while-revalidate=120',
    });
  }
  if (req.method === 'POST') {
    const c = cfg('admin');
    if (!esAdmin(req, c)) return json(401, { error: 'No autorizado' });
    const b = parseBody(req.body);
    if (!b) return json(400, { error: 'Solicitud inválida' });
    const v = validar(b.outfits);
    if (v.error) return json(400, { error: v.error });
    const filas = await db.setAjuste(c, 'outfits', v.valor);
    if (!Array.isArray(filas) || !filas.length) throw new Error('Los outfits no quedaron guardados');
    await db.registrarEvento(c, 'outfits_actualizados', null, { cantidad: v.valor.length });
    return json(200, { ok: true, outfits: v.valor });
  }
  return json(405, { error: 'Método no permitido' }, { Allow: 'GET, POST' });
}

module.exports = guard(outfits, { errorMsg: 'No se pudieron cargar los outfits' });
module.exports.validar = validar;
module.exports.paraTienda = paraTienda;
