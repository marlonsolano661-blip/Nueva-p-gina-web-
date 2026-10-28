'use strict';
// Meta Conversions API: Purchase desde el webhook confirmado de Wompi.
// event_id usa la referencia del pedido, igual que eventID en meta-pixel.js.
const crypto = require('crypto');

function hash(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized ? crypto.createHash('sha256').update(normalized).digest('hex') : undefined;
}

// Teléfono en formato de Meta: solo dígitos y con indicativo del país (Colombia: 57 + 10 dígitos).
function telefono(v) {
  const d = String(v || '').replace(/\D/g, '');
  if (d.length === 10 && d[0] === '3') return '57' + d;
  return d.length >= 11 ? d : '';
}

async function enviarCompra({ config, referencia, montoCentavos, pedido, meta }) {
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
  const phone = hash(telefono(cliente.tel));
  if (email) userData.em = [email];
  if (phone) userData.ph = [phone];
  // Datos de navegación guardados al crear el pedido: Meta los exige para eventos de sitio web y mejoran la coincidencia.
  const m = meta && typeof meta === 'object' ? meta : {};
  if (m.ua) userData.client_user_agent = String(m.ua).slice(0, 300);
  if (m.ip) userData.client_ip_address = String(m.ip).slice(0, 64);
  if (m.fbp) userData.fbp = String(m.fbp).slice(0, 120);
  if (m.fbc) userData.fbc = String(m.fbc).slice(0, 200);

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
    action_source: userData.client_user_agent ? 'website' : 'system_generated',
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
  // Resumen para el Registro del panel (sin datos personales ni credenciales).
  return {
    event_id: event.event_id,
    action_source: event.action_source,
    modo_prueba: !!config.metaTestEventCode,
    con_agente_usuario: !!userData.client_user_agent,
    con_fbp: !!userData.fbp,
    con_email: !!userData.em,
    con_telefono: !!userData.ph,
    fbtrace_id: result.fbtrace_id ? String(result.fbtrace_id).slice(0, 40) : undefined,
  };
}

module.exports = { enviarCompra, telefono };
