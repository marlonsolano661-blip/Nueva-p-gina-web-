'use strict';
const { ConfigError } = require('./config');
const { lowerKeys } = require('./util');

const BASE = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };

const json = (status, body, headers) => ({ status, json: body, headers: { ...BASE, ...(headers || {}) } });
const vacio = (status, headers) => ({ status, headers: { ...BASE, ...(headers || {}) } });

// CORS opcional: solo si defines ALLOWED_ORIGIN (por ejemplo, si la página vive en otro dominio
// que la API). Si la tienda y la API están en el mismo dominio no hace falta.
function cors(req) {
  const permitidos = String(process.env.ALLOWED_ORIGIN || '').split(',').map((s) => s.trim().replace(/\/+$/, '')).filter(Boolean);
  const origen = String(req.headers.origin || '').replace(/\/+$/, '');
  if (!origen || !permitidos.includes(origen)) return {};
  return {
    'Access-Control-Allow-Origin': origen,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    Vary: 'Origin',
  };
}

// Envuelve un handler: normaliza cabeceras, responde OPTIONS y convierte cualquier error en
// una respuesta 500 genérica (el detalle va solo al log del servidor, nunca al cliente).
function guard(fn, { errorMsg = 'Error interno' } = {}) {
  return async function handler(raw) {
    const req = { ...raw, headers: lowerKeys(raw.headers), query: raw.query || {} };
    const c = cors(req);
    if (req.method === 'OPTIONS') return vacio(204, c);
    try {
      const out = await fn(req);
      out.headers = { ...c, ...(out.headers || {}) };
      return out;
    } catch (e) {
      if (e instanceof ConfigError) console.error('[config]', e.message);
      else console.error('[error]', e && e.message ? e.message : e);
      return json(500, { error: errorMsg }, c);
    }
  };
}

module.exports = { json, vacio, guard };
