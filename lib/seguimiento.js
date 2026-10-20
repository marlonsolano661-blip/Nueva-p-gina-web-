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
        // Respaldo por si el webhook no llega: la API de Wompi (no el navegador) confirma APPROVED, misma referencia,
        // mismo monto y COP. aprobar_pedido es idempotente y comprueba el monto otra vez, así que el webhook sigue funcionando igual.
        if (p && d.status === 'APPROVED' && d.currency === 'COP' && p.estado_pago !== 'APPROVED') {
          try {
            const r = await db.aprobarPedido(c, { ref: d.reference, tx: d.id, monto: Number(d.amount_in_cents), metodo: d.payment_method_type });
            if (r === 'APROBADO') await db.registrarEvento(c, 'pago_aprobado_al_regresar', d.reference, { tx: d.id, monto: Number(d.amount_in_cents) });
            if (r === 'APROBADO' || r === 'YA_APROBADO') p = (await db.buscarPedido(c, 'referencia', d.reference)) || p;
          } catch (e) { console.error('[seguimiento] no se pudo aprobar al regresar:', e && e.message); }
        }
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
