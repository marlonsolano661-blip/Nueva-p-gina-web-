'use strict';
// Autorización del panel: cabecera Authorization: Bearer <ADMIN_TOKEN>. Se valida SIEMPRE en el servidor.
const { safeEqual } = require('./util');

function esAdmin(req, c) {
  const auth = String(req.headers.authorization || '');
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  return !!token && safeEqual(token, c.admin);
}

module.exports = { esAdmin };
