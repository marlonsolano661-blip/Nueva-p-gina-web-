const json = (statusCode, body) => ({ statusCode, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' }, body: JSON.stringify(body) });
exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') return json(405, { error: 'Método no permitido.' });
  const db = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_KEY;
  if (!db || !key) return json(503, { error: 'Seguimiento no configurado.' });
  try {
    const q = event.queryStringParameters || {};
    let filter = '';
    if (q.t && /^[a-f0-9]{32}$/.test(q.t)) filter = 'token=eq.' + q.t;
    else if (q.id && /^[A-Za-z0-9_-]{5,100}$/.test(q.id)) filter = 'wompi_tx=eq.' + encodeURIComponent(q.id);
    else return json(400, { error: 'Enlace de seguimiento inválido.' });
    const url = db.replace(/\/$/, '') + '/rest/v1/pedidos?' + filter + '&select=referencia,token,estado_pago,estado_envio,transportadora,guia,monto_centavos,subtotal_centavos,envio_centavos,metodo,creado_en,items&limit=1';
    const response = await fetch(url, { headers: { apikey: key, authorization: 'Bearer ' + key } });
    if (!response.ok) return json(503, { error: 'No se pudo consultar el pedido.' });
    const rows = await response.json();
    const p = Array.isArray(rows) ? rows[0] : null;
    if (!p) return json(404, { error: 'Pedido aún no disponible. Actualiza en unos segundos.' });
    return json(200, {
      token: p.token, reference: p.referencia, estado_pago: p.estado_pago,
      estado_envio: p.estado_envio, transportadora: p.transportadora, guia: p.guia,
      amount_in_cents: Number(p.monto_centavos), subtotal_in_cents: p.subtotal_centavos == null ? null : Number(p.subtotal_centavos),
      shipping_in_cents: p.envio_centavos == null ? 1750000 : Number(p.envio_centavos),
      payment_method_type: p.metodo, created_at: p.creado_en,
      items: Array.isArray(p.items) ? p.items.map(i => ({ nombre: i.nombre, talla: i.talla, cant: i.cant })) : []
    });
  } catch (error) {
    console.error('seguimiento failed:', error?.message || 'unknown error');
    return json(500, { error: 'No pudimos consultar el pedido.' });
  }
};