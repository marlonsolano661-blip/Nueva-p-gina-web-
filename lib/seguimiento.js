'use strict';
// GET /api/seguimiento?t=TOKEN  |  ?id=ID_TRANSACCION_WOMPI   (sin datos personales en la respuesta)
const { cfg } = require('./config');
const db = require('./db');
const { guard, json } = require('./http');
const { consultarTransaccion } = require('./wompi');

async function seguimiento(req) {
  if (req.method !== 'GET') return json(405, { error: 'Método no permitido' }, { Allow: 'GET' });
  const c = cfg('seguimiento');
  const { t, id } = req.query;
  let p = null, vivo = null;

  if (typeof t === 'string' && /^[a-f0-9]{32}$/.test(t)) {
    p = await db.buscarPedido(c, 'token', t);
  } else if (typeof id === 'string' && /^[\w-]{5,80}$/.test(id)) {
    p = await db.buscarPedido(c, 'wompi_tx', id);
    if (!p) {
      // El webhook puede tardar unos segundos: se consulta a Wompi y se verifica referencia y monto.
      const d = await consultarTransaccion(c.pub, id).catch(() => null);
      if (d && d.reference) {
        vivo = d.status;
        p = await db.buscarPedido(c, 'referencia', d.reference);
        if (p && Number(p.monto_centavos) !== Number(d.amount_in_cents)) p = null;
      }
    }
  }
  if (!p) return json(404, { error: 'Pedido no encontrado' });

  return json(200, {
    token: p.token,
    estado_pago: p.estado_pago === 'APPROVED' ? 'APPROVED' : (vivo || p.estado_pago),
    estado_envio: p.estado_envio, transportadora: p.transportadora, guia: p.guia,
    amount_in_cents: Number(p.monto_centavos), reference: p.referencia, payment_method_type: p.metodo, created_at: p.creado_en,
    items: (Array.isArray(p.items) ? p.items : []).map((i) => ({ nombre: i.nombre, talla: i.talla, cant: i.cant })),
  });
}

module.exports = guard(seguimiento, { errorMsg: 'No pudimos consultar el pedido' });
