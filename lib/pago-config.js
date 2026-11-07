'use strict';
// GET /api/pago-config → datos PÚBLICOS para el formulario de tarjeta de la tienda:
// llave pública de Wompi (para tokenizar la tarjeta en el navegador) y los contratos que la clienta acepta.
const { cfg } = require('./config');
const { guard, json } = require('./http');
const wompi = require('./wompi');

async function pagoConfig(req) {
  if (req.method !== 'GET') return json(405, { error: 'Método no permitido' }, { Allow: 'GET' });
  const c = cfg('pago');
  const a = await wompi.aceptacion(c.pub);
  return json(200, { pub: c.pub, api: wompi.base(c.pub), terminos: a.terminos, datos: a.datos }, { 'Cache-Control': 'no-store' });
}

module.exports = guard(pagoConfig, { errorMsg: 'El pago con tarjeta no está disponible en este momento' });
