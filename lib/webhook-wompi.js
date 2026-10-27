'use strict';
// POST /api/webhook-wompi  (URL de eventos en el panel de Wompi)
//
// Un pago solo se da por aprobado si:
//   1) la firma del evento es válida (secreto de eventos),
//   2) la API de Wompi confirma estado APPROVED, la misma referencia, el mismo monto y moneda COP,
//   3) el monto coincide con el del pedido guardado (lo comprueba la función SQL).
// Wompi reintenta cuando respondemos distinto de 200, así que los fallos temporales devuelven 500
// y los casos que no se arreglan reintentando (monto distinto, pedido inexistente) devuelven 200 + log.
const crypto = require('crypto');
const { cfg } = require('./config');
const db = require('./db');
const { guard, json } = require('./http');
const { parseBody } = require('./util');
const { consultarTransaccion } = require('./wompi');
const correo = require('./correo');
const metaCapi = require('./meta-capi');

const PROPIEDADES_OBLIGATORIAS = ['transaction.id', 'transaction.status', 'transaction.amount_in_cents'];
const FALLIDOS = ['DECLINED', 'VOIDED', 'ERROR'];
const get = (o, p) => String(p).split('.').reduce((a, k) => (a == null ? undefined : a[k]), o);

async function webhook(req) {
  if (req.method !== 'POST') return json(405, { error: 'Método no permitido' }, { Allow: 'POST' });
  const c = cfg('webhook');

  const ev = parseBody(req.body);
  const sig = ev && ev.signature;
  if (!sig || !sig.checksum || !Array.isArray(sig.properties) || ev.data == null || ev.timestamp == null) return json(400, { error: 'Evento inválido' });
  if (!PROPIEDADES_OBLIGATORIAS.every((p) => sig.properties.includes(p))) return json(400, { error: 'Firma incompleta' });

  const base = sig.properties.map((p) => get(ev.data, p)).join('') + ev.timestamp + c.events;
  const mia = Buffer.from(crypto.createHash('sha256').update(base).digest('hex'));
  const suya = Buffer.from(String(sig.checksum).toLowerCase());
  if (mia.length !== suya.length || !crypto.timingSafeEqual(mia, suya)) return json(401, { error: 'Firma inválida' });

  if (ev.event !== 'transaction.updated') return json(200, { ok: true, ignorado: true });
  const t = ev.data && ev.data.transaction;
  if (!t || !t.id || !t.reference) return json(200, { ok: true, ignorado: true });

  if (t.status === 'APPROVED') {
    let tx = t;
    if (c.verificarWompi) {
      tx = await consultarTransaccion(c.pub, t.id); // si Wompi no responde, lanza error -> 500 -> Wompi reintenta
      if (!tx || tx.status !== 'APPROVED') {
        console.error('[webhook] evento APPROVED pero la API de Wompi dice', tx && tx.status, 'tx', t.id, '-> se pide reintento');
        return json(500, { error: 'Estado aún no confirmado' });
      }
      if (tx.reference !== t.reference || Number(tx.amount_in_cents) !== Number(t.amount_in_cents) || tx.currency !== 'COP') {
        console.error('[ALERTA] la API de Wompi no coincide con el evento. tx', t.id, 'ref evento', t.reference, 'ref API', tx.reference);
        await db.marcarAlerta(c, t.reference, 'WOMPI_NO_COINCIDE tx ' + t.id);
        return json(200, { ok: true, ignorado: true });
      }
    }
    const r = await db.aprobarPedido(c, { ref: tx.reference, tx: tx.id, monto: Number(tx.amount_in_cents), metodo: tx.payment_method_type });
    if (r === 'MONTO_DISTINTO' || r === 'NO_ENCONTRADO') {
      console.error('[ALERTA] pago aprobado en Wompi pero el pedido no se pudo aprobar:', r, 'ref', tx.reference, 'tx', tx.id);
    }
    await db.registrarEvento(c, 'pago_' + r.toLowerCase(), tx.reference, { tx: tx.id, monto: Number(tx.amount_in_cents) });
    // Confirmación por correo solo cuando este evento aprobó el pedido; si falla, el pago ya quedó aprobado y se responde 200.
    // (avisar() no lanza y además marca el envío para no repetirlo si Wompi reintenta.)
    if (r === 'APROBADO' || r === 'YA_APROBADO') {
      await correo.avisar(c, tx.reference, 'pago');
      // El evento solo se envía después de confirmar el pago. Meta deduplica con el mismo event_id del Pixel.
      try {
        const pedido = await db.pedidoParaAviso(c, tx.reference);
        const enviado = await metaCapi.enviarCompra({ config: c, referencia: tx.reference, montoCentavos: Number(tx.amount_in_cents), pedido });
        if (enviado) await db.registrarEvento(c, 'meta_purchase_enviado', tx.reference, { event_id: tx.reference });
      } catch (error) {
        console.error('[Meta CAPI] error enviando Purchase para', tx.reference, error && error.message);
        await db.registrarEvento(c, 'meta_purchase_error', tx.reference, { mensaje: String(error && error.message || 'error').slice(0, 180) });
      }
    }
    return json(200, { ok: true, resultado: r });
  }

  if (FALLIDOS.includes(t.status)) {
    await db.marcarFallido(c, t.reference, t.status, t.id);
    await db.registrarEvento(c, 'pago_' + t.status.toLowerCase(), t.reference, { tx: t.id });
    if (t.status === 'VOIDED') await db.alertaPostAprobacion(c, t.reference, t.id, 'ANULADO_DESPUES_DE_APROBAR tx ' + t.id);
  }
  return json(200, { ok: true });
}

module.exports = guard(webhook, { errorMsg: 'Error procesando el evento' });
