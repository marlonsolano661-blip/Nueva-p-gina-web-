'use strict';
// Meta Conversions API: Purchase desde el webhook confirmado de Wompi.
// event_id usa la referencia del pedido, igual que eventID en meta-pixel.js.
const crypto = require('crypto');

function hash(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized ? crypto.createHash('sha256').update(normalized).digest('hex') : undefined;
}

async function enviarCompra({ config, referencia, montoCentavos, pedido }) {
  if (!config.metaPixelId || !config.metaCapiToken) {
    console.warn('[Meta CAPI] omitido: faltan META_PIXEL_ID o META_CAPI_ACCESS_TOKEN');
    return false;
  }
  if (!referencia || !Number.isFinite(montoCentavos) || montoCentavos <= 0) return false;

  const cliente = (pedido && pedido.cliente) || {};
  const userData = {
    external_id: [hash(referencia)],
  };
  const email = hash(cliente.email);
  const phone = hash(String(cliente.tel || '').replace(/\\D/g, ''));
  if (email) userData.em = [email];
  if (phone) userData.ph = [phone];

  const items = Array.isArray(pedido && pedido.items) ? pedido.items : [];
  const contents = items.map((item) => ({
    id: String(item.id || item.nombre || 'producto'),
    quantity: Math.max(1, Number(item.cant) || 1),
    item_price: Number(item.precio) || 0,
  }));

  const event = {
    event_name: 'Purchase',
    event_time: Math.floor(Date.now() / 1000),
    event_id: String(referencia),
    action_source: 'website',
    user_data: userData,
    custom_data: {
      currency: 'COP',
      value: montoCentavos / 100,
      content_type: 'product',
      ...(contents.length ? { contents, num_items: contents.reduce((sum, item) => sum + item.quantity, 0) } : {}),
    },
  };
  if (config.site) event.event_source_url = config.site + '/gracias.html';

  const body = { data: [event] };
  if (config.metaTestEventCode) body.test_event_code = config.metaTestEventCode;

  const url = 'https://graph.facebook.com/v25.0/' + encodeURIComponent(config.metaPixelId) + '/events';
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + config.metaCapiToken,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(8000),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || Number(result.events_received) < 1) {
    throw new Error('Meta Graph API ' + response.status + ': ' + JSON.stringify(result).slice(0, 300));
  }
  return true;
}

module.exports = { enviarCompra };
