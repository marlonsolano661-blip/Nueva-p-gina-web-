'use strict';
// POST /api/crear-pedido
// Recibe { items:[{id,talla,cant}], cliente:{nombre,tel,email,ciudad,direccion,nota}, consent_wa, meta:{fbp,fbc} }
// El servidor NUNCA confía en precios del navegador: recalcula todo desde la base de datos.
const crypto = require('crypto');
const { cfg } = require('./config');
const db = require('./db');
const { guard, json } = require('./http');
const { txt, normTel, parseBody, clientIp } = require('./util');

const MAX_LINEAS = 20;
const MAX_CANT = 10;
const LIMITE_POR_IP = 8; // pedidos creados por la misma IP en la ventana
const VENTANA_MS = 10 * 60 * 1000;
const RE_ID = /^[\w.-]{1,64}$/;
const RE_TALLA = /^[\w.-]{1,10}$/;
const RE_COLOR = /^[^\u0000-\u001f<>]{1,40}$/;
const RE_CLAVE = /^[\w-]{8,64}$/;
const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function checkoutUrl(c, ref, centavos, cliente, tel) {
  const firma = crypto.createHash('sha256').update(`${ref}${centavos}COP${c.integrity}`).digest('hex');
  const q = new URLSearchParams({
    'public-key': c.pub, currency: 'COP', 'amount-in-cents': String(centavos), reference: ref, 'signature:integrity': firma,
    'redirect-url': `${c.site}/gracias.html`, 'customer-data:full-name': cliente.nombre, 'customer-data:phone-number': tel,
  });
  if (cliente.email) q.set('customer-data:email', cliente.email);
  if (cliente.documento) { q.set('customer-data:legal-id', cliente.documento); q.set('customer-data:legal-id-type', 'CC'); }
  return `https://checkout.wompi.co/p/?${q}`;
}

async function crearPedido(req) {
  if (req.method !== 'POST') return json(405, { error: 'Método no permitido' }, { Allow: 'POST' });
  const c = cfg('crear');

  const body = parseBody(req.body);
  if (!body) return json(400, { error: 'Solicitud inválida' });
  const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
  const raw = obj(body.cliente);
  const m = obj(body.meta);

  // 1) Carrito: se valida cada línea y se fusionan las repetidas (mismo producto y talla)
  const { items } = body;
  if (!Array.isArray(items) || items.length < 1 || items.length > MAX_LINEAS) return json(400, { error: 'Carrito vacío o inválido' });
  const lineasPedidas = new Map();
  for (const i of items) {
    if (!i || typeof i !== 'object') return json(400, { error: 'Producto inválido' });
    const id = String(i.id), talla = String(i.talla), cant = Number(i.cant);
    const color = i.color == null ? '' : String(i.color).trim();
    if (!RE_ID.test(id) || !RE_TALLA.test(talla) || !Number.isInteger(cant) || cant < 1 || cant > MAX_CANT) return json(400, { error: 'Producto inválido' });
    if (color && !RE_COLOR.test(color)) return json(400, { error: 'Producto inválido' });
    const k = id + '|' + talla + '|' + color;
    const prev = lineasPedidas.get(k);
    const total = (prev ? prev.cant : 0) + cant;
    if (total > MAX_CANT) return json(400, { error: `Máximo ${MAX_CANT} unidades por referencia y talla` });
    lineasPedidas.set(k, { id, talla, color, cant: total });
  }

  // 2) Datos del cliente
  const tel = normTel(raw.tel);
  const cliente = {
    nombre: txt(raw.nombre, 80), tel: tel || '', email: txt(raw.email, 120),
    ciudad: txt(raw.ciudad, 60), direccion: txt(raw.direccion, 160), nota: txt(raw.nota, 300),
    documento: String(raw.documento == null ? '' : raw.documento).replace(/[\s.\-]/g, '').slice(0, 15),
  };
  if (!cliente.nombre || !cliente.direccion) return json(400, { error: 'Revisa tus datos: nombre y dirección' });
  if (!tel) return json(400, { error: 'Escribe tu WhatsApp de 10 dígitos (ej. 3115752334)' });
  if (!cliente.email || !RE_EMAIL.test(cliente.email)) return json(400, { error: 'Escribe un correo válido (ej. nombre@correo.com)' });
  if (!/^\d{5,12}$/.test(cliente.documento)) return json(400, { error: 'Escribe tu número de documento (solo números, sin puntos)' });

  // 2b) Clave de idempotencia: un doble clic o reintento de red no crea un segundo pedido
  const clave = body.clave == null ? '' : String(body.clave);
  if (clave && !RE_CLAVE.test(clave)) return json(400, { error: 'Solicitud inválida' });
  if (clave) {
    const previo = await db.buscarPorClave(c, clave);
    if (previo) {
      if (previo.estado_pago !== 'PENDING') return json(409, { error: 'Este pedido ya fue procesado. Revisa tu pedido o inicia uno nuevo.' });
      const cent = Number(previo.monto_centavos);
      return json(200, {
        url: checkoutUrl(c, previo.referencia, cent, previo.cliente || cliente, tel), referencia: previo.referencia, reutilizado: true,
        subtotal: previo.subtotal_centavos == null ? null : Number(previo.subtotal_centavos) / 100, envio: Number(previo.envio_centavos) / 100, total: cent / 100,
      });
    }
  }

  // 3) Freno contra abuso: demasiados pedidos creados desde la misma IP en pocos minutos
  const ip = clientIp(req.headers);
  if (ip) {
    const n = await db.contarRecientes(c, ip, new Date(Date.now() - VENTANA_MS).toISOString());
    if (n >= LIMITE_POR_IP) return json(429, { error: 'Demasiados intentos seguidos. Espera unos minutos e inténtalo de nuevo.' });
  }

  // 4) Precios y stock reales desde la base de datos
  const ids = [...new Set([...lineasPedidas.values()].map((l) => l.id))];
  const prods = Object.fromEntries((await db.getProductos(c, ids)).map((p) => [p.id, p]));
  let total = 0;
  const lineas = [];
  for (const l of lineasPedidas.values()) {
    const p = prods[l.id];
    if (!p) return json(400, { error: 'Uno de los productos ya no está disponible' });
    const precio = Number(p.precio);
    if (!Number.isInteger(precio) || precio <= 0) throw new Error('Precio inválido en la base de datos para ' + l.id);
    const disponible = Number(p.stock && p.stock[l.talla]) || 0;
    if (disponible < l.cant) return json(409, { error: `Sin stock: ${p.nombre} talla ${l.talla}` });
    const colores = (Array.isArray(p.colores) ? p.colores : []).map((x) => x && x.n).filter(Boolean);
    if (colores.length ? !colores.includes(l.color) : l.color) return json(400, { error: `Color no disponible: ${p.nombre}` });
    total += precio * l.cant;
    lineas.push({ id: p.id, nombre: p.nombre, talla: l.talla, ...(l.color ? { color: l.color } : {}), cant: l.cant, precio });
  }

  // 4b) Envío: tarifa guardada en la base (ajustes). El servidor suma el envío; el navegador no decide nada.
  const envio = await db.getEnvio(c);
  const subtotal = total;
  total = subtotal + envio;
  if (body.total_esperado != null && Number(body.total_esperado) !== total) {
    return json(409, { error: 'Los precios o el envío cambiaron. Revisa el total e inténtalo de nuevo.', subtotal, envio, total });
  }

  // 5) Se guarda el pedido (PENDING) y se arma el enlace del checkout de Wompi firmado
  const centavos = total * 100;
  const ref = `MF-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
  try {
    await db.insertarPedido(c, {
      referencia: ref, monto_centavos: centavos, subtotal_centavos: subtotal * 100, envio_centavos: envio * 100, items: lineas, cliente, consent_wa: body.consent_wa === true,
      meta: { fbp: txt(m.fbp, 120), fbc: txt(m.fbc, 200), ua: txt(req.headers['user-agent'], 300), ip, event_id: ref, ...(clave ? { clave } : {}) },
    });
  } catch (e) {
    // Dos solicitudes simultáneas con la misma clave: la segunda reutiliza el pedido de la primera
    if (clave && (e.status === 409 || /duplicate key|23505/.test(e.message))) {
      const previo = await db.buscarPorClave(c, clave);
      if (previo && previo.estado_pago === 'PENDING') {
        return json(200, { url: checkoutUrl(c, previo.referencia, Number(previo.monto_centavos), previo.cliente || cliente, tel), referencia: previo.referencia, reutilizado: true, subtotal: Number(previo.subtotal_centavos) / 100, envio: Number(previo.envio_centavos) / 100, total: Number(previo.monto_centavos) / 100 });
      }
    }
    throw e;
  }

  await db.registrarEvento(c, 'pedido_creado', ref, { subtotal, envio, total });
  return json(200, { url: checkoutUrl(c, ref, centavos, cliente, tel), referencia: ref, subtotal, envio, total });
}

module.exports = guard(crearPedido, { errorMsg: 'No pudimos iniciar el pago. Intenta de nuevo.' });
