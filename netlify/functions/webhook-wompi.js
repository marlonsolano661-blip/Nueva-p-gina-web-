const crypto = require('node:crypto');
const json = (statusCode, body) => ({ statusCode, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }, body: JSON.stringify(body) });
const atPath = (obj, path) => String(path).split('.').reduce((value, key) => value == null ? undefined : value[key], obj);
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Método no permitido.' });
  const db = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_KEY, secret = process.env.WOMPI_EVENTS_SECRET;
  if (!db || !key || !secret) return json(503, { error: 'Webhook no configurado.' });
  try {
    const payload = JSON.parse(event.body || '{}');
    const signature = payload.signature;
    if (!signature || typeof signature.checksum !== 'string' || !Array.isArray(signature.properties) || !Number.isFinite(Number(payload.timestamp))) {
      return json(400, { error: 'Firma de evento inválida.' });
    }
    const values = signature.properties.map(path => atPath(payload.data, path));
    if (values.some(value => value === undefined || value === null)) return json(400, { error: 'Faltan campos firmados.' });
    const base = values.join('') + payload.timestamp + secret;
    const expected = crypto.createHash('sha256').update(base).digest();
    let received;
    try { received = Buffer.from(signature.checksum, 'hex'); } catch { return json(401, { error: 'Firma inválida.' }); }
    if (received.length !== expected.length || !crypto.timingSafeEqual(received, expected)) return json(401, { error: 'Firma inválida.' });

    if (payload.event !== 'transaction.updated') return json(200, { ok: true, ignored: true });
    const tx = payload.data && payload.data.transaction;
    if (!tx || typeof tx.id !== 'string' || typeof tx.reference !== 'string' || !Number.isSafeInteger(Number(tx.amount_in_cents)) || tx.currency !== 'COP') {
      return json(400, { error: 'Transacción incompleta.' });
    }
    const baseUrl = db.replace(/\/$/, '');
    const headers = { apikey: key, authorization: 'Bearer ' + key, 'content-type': 'application/json', prefer: 'return=minimal' };
    if (tx.status === 'APPROVED') {
      const response = await fetch(baseUrl + '/rest/v1/rpc/aprobar_pedido', {
        method: 'POST', headers,
        body: JSON.stringify({ p_ref: tx.reference, p_tx: tx.id, p_monto: Number(tx.amount_in_cents), p_metodo: tx.payment_method_type || null })
      });
      if (!response.ok) {
        console.error('Webhook approval RPC rejected event with status', response.status);
        return json(500, { error: 'No se pudo confirmar el pedido.' });
      }
      const result = await response.json().catch(() => false);
      if (result !== true) {
        // Idempotent replay of the same transaction is acceptable only if DB already records it.
        const check = await fetch(baseUrl + '/rest/v1/pedidos?referencia=eq.' + encodeURIComponent(tx.reference) + '&select=estado_pago,wompi_tx,monto_centavos&limit=1', { headers });
        const rows = check.ok ? await check.json().catch(() => []) : [];
        const order = Array.isArray(rows) ? rows[0] : null;
        if (!order || order.estado_pago !== 'APPROVED' || order.wompi_tx !== tx.id || Number(order.monto_centavos) !== Number(tx.amount_in_cents)) {
          console.error('Webhook approval mismatch: reference, amount or transaction did not match.');
          return json(409, { error: 'La transacción no coincide con el pedido.' });
        }
      }
    } else if (['DECLINED', 'VOIDED', 'ERROR'].includes(tx.status)) {
      const response = await fetch(baseUrl + '/rest/v1/pedidos?referencia=eq.' + encodeURIComponent(tx.reference) + '&estado_pago=eq.PENDING&monto_centavos=eq.' + Number(tx.amount_in_cents), {
        method: 'PATCH', headers, body: JSON.stringify({ estado_pago: tx.status, wompi_tx: tx.id })
      });
      if (!response.ok) return json(500, { error: 'No se pudo actualizar el estado del pedido.' });
    }
    return json(200, { ok: true });
  } catch (error) {
    console.error('webhook-wompi failed:', error?.message || 'unknown error');
    return json(500, { error: 'Error procesando el evento.' });
  }
};