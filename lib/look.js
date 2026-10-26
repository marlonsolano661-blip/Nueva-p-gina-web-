'use strict';
// POST /api/look  (público)  { nombre, mensaje?, instagram?, autoriza:true, foto:<JPEG en base64>, web:'' }
// Recibe la foto que una clienta comparte ("Comparte tus MF"). Queda PENDIENTE hasta que la dueña la apruebe en el panel.
const { cfg } = require('./config');
const { guard, json } = require('./http');
const { parseBody, clientIp } = require('./util');
const looks = require('./looks');

const LIMITE = 3, VENTANA_MS = 10 * 60 * 1000;
const intentos = new Map(); // freno por IP (memoria de la instancia)

function frenado(ip) {
  const ahora = Date.now();
  const l = (intentos.get(ip) || []).filter((t) => ahora - t < VENTANA_MS);
  l.push(ahora); intentos.set(ip, l);
  if (intentos.size > 5000) for (const [k, v] of intentos) if (!v.some((t) => ahora - t < VENTANA_MS)) intentos.delete(k);
  return l.length > LIMITE;
}

async function look(req) {
  if (req.method !== 'POST') return json(405, { error: 'Método no permitido' }, { Allow: 'POST' });
  const c = cfg('catalogo');
  const b = parseBody(req.body);
  if (!b) return json(400, { error: 'Solicitud inválida' });
  if (frenado(clientIp(req.headers) || 'sin-ip')) return json(429, { error: 'Demasiados envíos. Espera unos minutos e inténtalo de nuevo.' });
  const v = looks.validarEnvio(b);
  if (v.error) return json(400, { error: v.error });
  await looks.recibir(c, v);
  return json(200, { ok: true });
}

module.exports = guard(look, { errorMsg: 'No pudimos recibir tu foto. Intenta de nuevo.' });
