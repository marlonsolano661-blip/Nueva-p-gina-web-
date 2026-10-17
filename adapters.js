'use strict';
// Adaptadores delgados: la lógica vive en lib/*.js y es igual en cualquier plataforma.

// Vercel: api/<nombre>.js
function vercel(handler) {
  return async function (req, res) {
    const out = await handler({ method: req.method, headers: req.headers, query: req.query || {}, body: req.body });
    for (const [k, v] of Object.entries(out.headers || {})) res.setHeader(k, v);
    res.statusCode = out.status;
    if (out.json !== undefined) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify(out.json));
    } else {
      res.end();
    }
  };
}

// Netlify: netlify/functions/<nombre>.js (con redirección /api/* en netlify.toml)
function netlify(handler) {
  return async function (event) {
    const body = event.isBase64Encoded ? Buffer.from(event.body || '', 'base64').toString('utf8') : event.body;
    const out = await handler({ method: event.httpMethod, headers: event.headers || {}, query: event.queryStringParameters || {}, body });
    return {
      statusCode: out.status,
      headers: { 'Content-Type': 'application/json; charset=utf-8', ...(out.headers || {}) },
      body: out.json !== undefined ? JSON.stringify(out.json) : '',
    };
  };
}

module.exports = { vercel, netlify };
