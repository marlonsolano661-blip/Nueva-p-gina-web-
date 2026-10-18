const crypto = require('node:crypto');

const SHIPPING_COP = 17500;
const json = (statusCode, body, headers = {}) => ({ statusCode, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers }, body: JSON.stringify(body) });
const clean = (value, max) => String(value ?? '').trim().slice(0, max);
const env = () => ({
  db: process.env.SUPABASE_URL,
  key: process.env.SUPABASE_SERVICE_KEY,
  publicKey: process.env.WOMPI_PUBLIC_KEY,
  integrity: process.env.WOMPI_INTEGRITY_SECRET,
  site: process.env.SITE_URL
});
async function readJson(response) { try { return await response.json(); } catch { return null; } }

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Método no permitido.' }, { allow: 'POST' });
  const cfg = env();
  if (process.env.STORE_CHECKOUT_ENABLED !== 'true') {
    return json(503, { error: 'La creación de pedidos está desactivada hasta verificar el catálogo y la reserva de inventario.' });
  }
  if (process.env.STOCK_RESERVATION_READY !== 'true') {
    return json(503, { error: 'No se pueden iniciar pedidos hasta habilitar y verificar la reserva de inventario.' });
  }
  if (![cfg.db, cfg.key, cfg.publicKey, cfg.integrity, cfg.site].every(Boolean)) {
    return json(503, { error: 'El pago aún no está configurado. No se creó ningún cobro.' });
  }
  if (!cfg.publicKey.startsWith('pub_test_')) {
    return json(503, { error: 'La integración aislada solo permite credenciales de prueba. No se aceptan cobros reales desde esta rama.' });
  }
  try {
    const input = JSON.parse(event.body || '{}');
    const items = input.items;
    if (!Array.isArray(items) || !items.length || items.length > 20) return json(400, { error: 'Carrito vacío o inválido.' });
    const c = input.cliente || {};
    const cliente = {
      nombre: clean(c.nombre, 80), tel: clean(c.tel, 20), email: clean(c.email, 120),
      ciudad: clean(c.ciudad, 60), direccion: clean(c.direccion, 160), nota: clean(c.nota, 300)
    };
    const phone = cliente.tel.replace(/[\s-]/g, '');
    if (!cliente.nombre || !/^\+?\d{7,15}$/.test(phone) || (cliente.email && !/^\S+@\S+\.\S+$/.test(cliente.email)) || !cliente.ciudad || !cliente.direccion) {
      return json(400, { error: 'Revisa nombre, teléfono, ciudad y dirección.' });
    }
    const quantities = new Map();
    for (const item of items) {
      const id = clean(item.id, 120), talla = clean(item.talla, 12), cant = Number(item.cant);
      if (!id || !talla || !Number.isInteger(cant) || cant < 1 || cant > 10) return json(400, { error: 'Hay un producto, talla o cantidad inválidos.' });
      const key = id + '\u0000' + talla;
      quantities.set(key, (quantities.get(key) || 0) + cant);
      if (quantities.get(key) > 10) return json(400, { error: 'La cantidad por producto y talla excede el límite.' });
    }
    const ids = [...new Set(items.map(i => clean(i.id, 120)))];
    const query = ids.map(id => '"' + id.replace(/"/g, '\\"') + '"').join(',');
    const productsResponse = await fetch(cfg.db.replace(/\/$/, '') + '/rest/v1/productos?select=id,nombre,precio,stock,visible&id=in.(' + encodeURIComponent(query) + ')&visible=eq.true', {
      headers: { apikey: cfg.key, authorization: 'Bearer ' + cfg.key }
    });
    if (!productsResponse.ok) return json(503, { error: 'No se pudo validar el catálogo. Intenta más tarde.' });
    const products = await readJson(productsResponse);
    if (!Array.isArray(products)) return json(503, { error: 'Respuesta inválida del catálogo.' });
    const byId = new Map(products.map(p => [String(p.id), p]));
    let subtotalCop = 0;
    const lines = [];
    for (const [compound, cant] of quantities) {
      const [id, talla] = compound.split('\u0000');
      const p = byId.get(id);
      if (!p || !Number.isSafeInteger(Number(p.precio)) || Number(p.precio) <= 0) return json(409, { error: 'Un producto ya no está disponible.' });
      const stock = Number((p.stock || {})[talla] || 0);
      if (!Number.isInteger(stock) || stock < cant) return json(409, { error: 'No hay existencias suficientes para ' + clean(p.nombre, 100) + ', talla ' + talla + '.' });
      subtotalCop += Number(p.precio) * cant;
      lines.push({ id, nombre: clean(p.nombre, 120), talla, cant, precio: Number(p.precio) });
    }
    if (!Number.isSafeInteger(subtotalCop) || subtotalCop <= 0) return json(400, { error: 'No se pudo calcular el subtotal.' });
    const subtotalCents = subtotalCop * 100;
    const shippingCents = SHIPPING_COP * 100;
    const totalCents = subtotalCents + shippingCents;
    if (!Number.isSafeInteger(totalCents)) return json(400, { error: 'El total excede el límite permitido.' });
    const reference = 'MF-' + Date.now() + '-' + crypto.randomBytes(5).toString('hex').toUpperCase();
    const dbHeaders = { apikey: cfg.key, authorization: 'Bearer ' + cfg.key, 'content-type': 'application/json', prefer: 'return=representation' };
    const orderResponse = await fetch(cfg.db.replace(/\/$/, '') + '/rest/v1/pedidos', {
      method: 'POST', headers: dbHeaders,
      body: JSON.stringify({
        referencia: reference, estado_pago: 'PENDING', subtotal_centavos: subtotalCents,
        envio_centavos: shippingCents, monto_centavos: totalCents, items: lines, cliente,
        consent_wa: input.consent_wa === true,
        meta: { fbp: clean(input.meta?.fbp, 120), fbc: clean(input.meta?.fbc, 200), event_id: reference }
      })
    });
    if (!orderResponse.ok) return json(503, { error: 'No se pudo registrar el pedido. No continúes al pago.' });
    const integritySignature = crypto.createHash('sha256').update(reference + totalCents + 'COP' + cfg.integrity).digest('hex');
    const url = new URL('https://checkout.wompi.co/p/');
    const params = url.searchParams;
    params.set('public-key', cfg.publicKey); params.set('currency', 'COP');
    params.set('amount-in-cents', String(totalCents)); params.set('reference', reference);
    params.set('signature:integrity', integritySignature);
    params.set('redirect-url', cfg.site.replace(/\/$/, '') + '/gracias.html');
    params.set('customer-data:full-name', cliente.nombre);
    params.set('customer-data:phone-number', phone.replace(/\D/g, '').slice(-10));
    if (cliente.email) params.set('customer-data:email', cliente.email);
    return json(200, { url: url.toString(), referencia: reference, subtotal_cop: subtotalCop, envio_cop: SHIPPING_COP, total_cop: totalCents / 100 });
  } catch (error) {
    console.error('crear-pedido failed:', error?.message || 'unknown error');
    return json(500, { error: 'No pudimos preparar tu pedido. Intenta de nuevo.' });
  }
};