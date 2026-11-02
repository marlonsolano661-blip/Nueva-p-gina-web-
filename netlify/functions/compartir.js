'use strict';
const compartir = require('../../lib/compartir');
// Respuesta HTML: el adaptador común solo entrega JSON, por eso este envoltorio propio (igual que feed-meta).
exports.handler = async (event) => {
  const out = await compartir({ method: event.httpMethod, headers: event.headers || {}, query: event.queryStringParameters || {} });
  return { statusCode: out.status, headers: { 'Content-Type': out.tipo, ...(out.headers || {}) }, body: out.text };
};
