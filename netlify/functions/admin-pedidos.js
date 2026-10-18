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
      const q = event.queryStringParameters || {};
      const limit = Math.max(1, Math.min(100, Number.parseInt(q.limite || '100', 10) || 100));
      const filters = [];
      if (q.pago && ['PENDING','APPROVED','DECLINED','VOIDED','ERROR'].includes(q.pago)) filters.push('estado_pago=eq.' + q.pago);
      if (q.envio && ['PREPARANDO','EN_CAMINO','ENTREGADO','DEVUELTO'].includes(q.envio)) filters.push('estado_envio=eq.' + q.envio);
      const query = 'select=id,referencia,estado_pago,estado_envio,transportadora,guia,monto_centavos,subtotal_centavos,envio_centavos,metodo,creado_en,pagado_en,enviado_en,entregado_en,items,cliente&order=creado_en.desc&limit=' + limit + (filters.length ? '&' + filters.join('&') : '');
      const response = await fetch(base + '/rest/v1/pedidos?' + query, { headers });
      if (!response.ok) return json(503, { error: 'No se pudieron cargar los pedidos.' });
      const pedidos = await response.json();
      return json(200, { pedidos: Array.isArray(pedidos) ? pedidos : [] });
    }
    const body = JSON.parse(event.body || '{}');
    const id = Number(body.id);
    const state = clean(body.estado_envio, 24);
    if (!Number.isSafeInteger(id) || id < 1 || !['PREPARANDO', 'EN_CAMINO', 'ENTREGADO', 'DEVUELTO'].includes(state)) return json(400, { error: 'Pedido o estado de envío inválido.' });
    const now = new Date().toISOString();
    const update = { estado_envio: state, transportadora: clean(body.transportadora, 80) || null, guia: clean(body.guia, 100) || null };
    if (state === 'EN_CAMINO') update.enviado_en = now;
    if (state === 'ENTREGADO') update.entregado_en = now;
    const response = await fetch(base + '/rest/v1/pedidos?id=eq.' + id + '&estado_pago=eq.APPROVED', { method: 'PATCH', headers, body: JSON.stringify(update) });
    if (!response.ok) return json(503, { error: 'No se pudo actualizar el envío.' });
    const rows = await response.json();
    if (!Array.isArray(rows) || !rows.length) return json(404, { error: 'Pedido aprobado no encontrado.' });
    return json(200, { ok: true, pedido: rows[0] });
  } catch (error) {
    console.error('admin-pedidos failed:', error?.message || 'unknown error');
    return json(500, { error: 'Error procesando la solicitud administrativa.' });
  }
};