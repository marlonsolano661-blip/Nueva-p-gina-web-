const crypto = require('node:crypto');
const json = (statusCode, body) => ({ statusCode, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' }, body: JSON.stringify(body) });
const clean = (v, n) => String(v ?? '').trim().slice(0, n);
function authorized(event, expected) {
  const headers = event.headers || {};
  const value = headers.authorization || headers.Authorization || '';
  const match = /^Bearer\s+(.+)$/i.exec(value);
  if (!match || !expected) return false;
  const a = Buffer.from(match[1]), b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
exports.handler = async (event) => {
  if (!['GET', 'POST'].includes(event.httpMethod)) return json(405, { error: 'Método no permitido.' });
  const token = process.env.ADMIN_TOKEN, db = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_KEY;
  if (!token || token.length < 24 || !db || !key) return json(503, { error: 'Panel administrativo no configurado.' });
  if (!authorized(event, token)) return json(401, { error: 'No autorizado.' });
  const base = db.replace(/\/$/, '');
  const headers = { apikey: key, authorization: 'Bearer ' + key, 'content-type': 'application/json', prefer: 'return=representation' };
  try {
    if (event.httpMethod === 'GET') {
      const url = base + '/rest/v1/pedidos?select=referencia,estado_pago,estado_envio,transportadora,guia,monto_centavos,subtotal_centavos,envio_centavos,metodo,creado_en,pagado_en,enviado_en,entregado_en,items,cliente&order=creado_en.desc&limit=100';
      const response = await fetch(url, { headers });
      if (!response.ok) return json(503, { error: 'No se pudieron cargar los pedidos.' });
      return json(200, await response.json());
    }
    const body = JSON.parse(event.body || '{}');
    const reference = clean(body.referencia, 100);
    const state = clean(body.estado_envio, 24);
    if (!reference || !['PREPARANDO', 'EN_CAMINO', 'ENTREGADO', 'DEVUELTO'].includes(state)) return json(400, { error: 'Referencia o estado de envío inválido.' });
    const now = new Date().toISOString();
    const update = { estado_envio: state, transportadora: clean(body.transportadora, 80) || null, guia: clean(body.guia, 100) || null };
    if (state === 'EN_CAMINO') update.enviado_en = now;
    if (state === 'ENTREGADO') update.entregado_en = now;
    const response = await fetch(base + '/rest/v1/pedidos?referencia=eq.' + encodeURIComponent(reference), {
      method: 'PATCH', headers, body: JSON.stringify(update)
    });
    if (!response.ok) return json(503, { error: 'No se pudo actualizar el envío.' });
    const rows = await response.json();
    if (!Array.isArray(rows) || !rows.length) return json(404, { error: 'Pedido no encontrado.' });
    return json(200, { ok: true, pedido: rows[0] });
  } catch (error) {
    console.error('admin-pedidos failed:', error?.message || 'unknown error');
    return json(500, { error: 'Error procesando la solicitud administrativa.' });
  }
};