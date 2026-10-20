'use strict';
// Verificación de humo contra tu sitio YA desplegado. No cobra nada ni aprueba pagos.
//   node scripts/verificar-despliegue.js https://tienda.mfcol.com ID_PRODUCTO TALLA [CLAVE_ADMIN]
// Crea 1 pedido de prueba PENDING (sin pagar) y comprueba que las defensas responden bien.
const [base, id, talla, claveAdmin] = process.argv.slice(2);
if (!base || !id || !talla) { console.log('Uso: node scripts/verificar-despliegue.js https://TU-DOMINIO ID_PRODUCTO TALLA [CLAVE_ADMIN]'); process.exit(2); }
const B = base.replace(/\/+$/, '');
let fallas = 0;
const ok = (c, m, extra) => { console.log((c ? '  ok    ' : '  FALLA ') + m + (c || !extra ? '' : '  → ' + extra)); if (!c) fallas++; };
const post = (ruta, cuerpo, h = {}) => fetch(B + ruta, { method: 'POST', headers: { 'Content-Type': 'application/json', ...h }, body: JSON.stringify(cuerpo) });

(async () => {
  console.log('1) Crear pedido de prueba');
  let r = await post('/api/crear-pedido', { items: [{ id, talla, cant: 1 }], cliente: { nombre: 'PRUEBA Verificación', tel: '3000000000', ciudad: 'Prueba', direccion: 'Calle de prueba 1' } });
  const j = await r.json().catch(() => ({}));
  ok(r.status === 200 && /^https:\/\/checkout\.wompi\.co\/p\/\?/.test(j.url || ''), 'devuelve enlace al checkout de Wompi', `estado ${r.status} ${JSON.stringify(j).slice(0, 160)}`);
  if (j.url) {
    const u = new URL(j.url);
    ok(/^pub_(test|prod)_/.test(u.searchParams.get('public-key') || ''), 'usa llave pública de Wompi: ' + (u.searchParams.get('public-key') || '').slice(0, 9) + '…');
    ok((u.searchParams.get('signature:integrity') || '').length === 64, 'incluye firma de integridad');
    ok(u.searchParams.get('redirect-url') === B + '/gracias.html', 'redirige a ' + B + '/gracias.html', u.searchParams.get('redirect-url'));
    console.log('     Referencia creada:', j.referencia, '(queda PENDING; puedes borrarla en Supabase)');
  }

  console.log('2) Defensas');
  r = await post('/api/crear-pedido', { items: [{ id, talla, cant: 1, precio: 1 }], cliente: {} });
  ok(r.status === 400, 'rechaza datos incompletos (400)', 'estado ' + r.status);
  r = await post('/api/webhook-wompi', { event: 'transaction.updated', data: { transaction: { id: 'x', status: 'APPROVED', amount_in_cents: 1 } }, timestamp: 1, signature: { checksum: 'f'.repeat(64), properties: ['transaction.id', 'transaction.status', 'transaction.amount_in_cents'] } });
  ok(r.status === 401, 'el webhook rechaza una firma falsa (401)', 'estado ' + r.status + (r.status === 500 ? ' (¿falta WOMPI_EVENTS_SECRET?)' : ''));
  r = await fetch(B + '/api/seguimiento?t=' + 'a'.repeat(32));
  ok(r.status === 404, 'seguimiento con token falso → 404', 'estado ' + r.status);
  r = await fetch(B + '/api/admin-pedidos');
  ok(r.status === 401, 'el panel exige clave (401)', 'estado ' + r.status + (r.status === 500 ? ' (¿falta ADMIN_TOKEN?)' : ''));
  if (claveAdmin) {
    r = await fetch(B + '/api/admin-pedidos?limite=1', { headers: { Authorization: 'Bearer ' + claveAdmin } });
    ok(r.status === 200, 'el panel acepta tu clave de administrador', 'estado ' + r.status);
  }

  console.log('3) Páginas');
  for (const p of ['/gracias.html', '/panel-pedidos.html', '/pago-online.js']) { r = await fetch(B + p); ok(r.status === 200, p + ' publicada', 'estado ' + r.status); }

  console.log(fallas ? `\n${fallas} comprobación(es) fallaron. Revisa PASOS.md > "Si algo falla".` : '\nTodo en orden. Falta solo la compra de prueba con tarjeta de sandbox (PASOS.md, paso 8).');
  process.exit(fallas ? 1 : 0);
})().catch((e) => { console.error('No se pudo conectar:', e.message); process.exit(1); });
