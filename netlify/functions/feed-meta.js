'use strict';
const feed = require('../../lib/feed-meta');
// Respuesta de texto (CSV): el adaptador común solo entrega JSON, por eso este envoltorio propio.
exports.handler = async (event) => {
  const out = await feed({ method: event.httpMethod, headers: event.headers || {}, query: event.queryStringParameters || {} });
  return { statusCode: out.status, headers: { 'Content-Type': out.tipo, ...(out.headers || {}) }, body: out.text };
};
