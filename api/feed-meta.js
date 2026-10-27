'use strict';
const feed = require('../lib/feed-meta');
module.exports = async function (req, res) {
  const out = await feed({ method: req.method, headers: req.headers, query: req.query || {} });
  for (const [k, v] of Object.entries(out.headers || {})) res.setHeader(k, v);
  res.setHeader('Content-Type', out.tipo);
  res.statusCode = out.status;
  res.end(out.text);
};
