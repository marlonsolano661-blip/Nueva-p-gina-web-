'use strict';
const crypto = require('crypto');

const txt = (v, n) => String(v == null ? '' : v).trim().slice(0, n);

function lowerKeys(o) {
  const r = {};
  for (const k of Object.keys(o || {})) r[k.toLowerCase()] = o[k];
  return r;
}

// Devuelve un objeto, {} si no hay cuerpo, o null si el cuerpo no es JSON válido.
function parseBody(b) {
  if (b == null) return {};
  if (Buffer.isBuffer(b)) b = b.toString('utf8');
  if (typeof b === 'string') {
    try {
      const j = JSON.parse(b || '{}');
      return j && typeof j === 'object' ? j : null;
    } catch {
      return null;
    }
  }
  return typeof b === 'object' ? b : null;
}

// Celular colombiano: 10 dígitos que empiezan por 3 (acepta +57 / 57 delante).
function normTel(v) {
  let d = String(v == null ? '' : v).replace(/\D/g, '');
  if (d.length === 12 && d.startsWith('57')) d = d.slice(2);
  return /^3\d{9}$/.test(d) ? d : null;
}

function clientIp(h) {
  const raw = h['x-nf-client-connection-ip'] || h['x-vercel-forwarded-for'] || String(h['x-forwarded-for'] || '').split(',')[0] || h['x-real-ip'] || '';
  const ip = String(raw).trim().slice(0, 64);
  return /^[0-9a-fA-F:.]+$/.test(ip) ? ip : '';
}

// Comparación en tiempo constante (se comparan los hashes, así no importa la longitud).
function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

module.exports = { txt, lowerKeys, parseBody, normTel, clientIp, safeEqual };
