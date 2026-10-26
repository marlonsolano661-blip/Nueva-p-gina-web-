'use strict';
// POST /api/descuento  { codigo, items:[{id,talla,cant}] }  (público)
// Calcula el descuento con los precios reales de la base de datos (nunca con el subtotal del navegador).
// No revela si un código existe pero está apagado: siempre "Ese código no es válido".
const { cfg } = require('./config');
const db = require('./db');
const { guard, json } = require('./http');
const { parseBody, clientIp } = require('./util');
const descuentos = require('./descuentos');

const MAX_LINEAS = 20, MAX_CANT = 10, RE_ID = /^[\w.-]{1,64}$/;
const LIMITE = 20, VENTANA_MS = 10 * 60 * 1000;
const intentos = new Map(); // freno por IP (en memoria de la instancia; el servidor igual valida de nuevo al crear el pedido)

function frenado(ip) {
  const ahora = Date.now();
  const l = (intentos.get(ip) || []).filter((t) => ahora - t < VENTANA_MS);
  l.push(ahora); intentos.set(ip, l);
  if (intentos.size > 5000) for (const [k, v] of intentos) if (!v.some((t) => ahora - t < VENTANA_MS)) intentos.delete(k);
  return l.length > LIMITE;
}

async function validar(req) {
  if (req.method !== 'POST') return json(405, { error: 'Método no permitido' }, { Allow: 'POST' });
  const c = cfg('catalogo');
  const b = parseBody(req.body);
  if (!b) return json(400, { error: 'Solicitud inválida' });
  const ip = clientIp(req.headers) || 'sin-ip';
  if (frenado(ip)) return json(429, { error: 'Demasiados intentos. Espera unos minutos.' });
  const items = b.items;
  if (!Array.isArray(items) || !items.length || items.length > MAX_LINEAS) return json(400, { error: 'Tu bolsa está vacía' });
  const cant = new Map();
  for (const i of items) {
    if (!i || typeof i !== 'object' || !RE_ID.test(String(i.id))) return json(400, { error: 'Producto inválido' });
    const n = Number(i.cant);
    if (!Number.isInteger(n) || n < 1 || n > MAX_CANT) return json(400, { error: 'Producto inválido' });
    cant.set(String(i.id), (cant.get(String(i.id)) || 0) + n);
  }
  const prods = await db.getProductos(c, [...cant.keys()]);
  const por = Object.fromEntries(prods.map((p) => [p.id, p]));
  let subtotal = 0;
  for (const [id, n] of cant) {
    const p = por[id], precio = p && Number(p.precio);
    if (!p || !Number.isInteger(precio) || precio <= 0) return json(400, { error: 'Uno de los productos ya no está disponible' });
    subtotal += precio * n;
  }
  const r = await descuentos.evaluar(c, { codigo: b.codigo, subtotal });
  if (!r.ok) return json(200, { ok: false, error: r.error });
  return json(200, { ok: true, codigo: r.codigo, pct: r.pct, descuento: r.descuento, subtotal });
}

module.exports = guard(validar, { errorMsg: 'No pudimos validar el código. Intenta de nuevo.' });
