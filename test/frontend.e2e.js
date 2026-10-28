'use strict';
// Pruebas del frontend en un Chromium real, con la API simulada (page.route).
// Ejecutar:  NODE_PATH=$(npm root -g) node test/frontend.e2e.js
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const RAIZ = path.join(__dirname, '..');
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8' };
const servidor = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  const f = path.join(RAIZ, u.pathname === '/' ? 'tienda-falsa.html' : u.pathname);
  if (!f.startsWith(RAIZ) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TIPOS[path.extname(f)] || 'text/plain' }); res.end(fs.readFileSync(f));
});

// Tienda mínima con la misma interfaz que usa pago-online.js: botón data-n="topay", FRM y CART
const TIENDA = `<!doctype html><meta charset=utf-8><body><button data-n="topay">Pagar $379.800</button>
<script>
 var FRM={nombre:'Ana',tel:'3115752334',ciudad:'Cali',dir:'Calle 1',nota:''};
 var CART=[{id:'plataforma-luna',talla:'36',q:2}];
 window.__toasts=[]; function toast(m){window.__toasts.push(m)}
 window.__tiendaClick=0; document.querySelector('[data-n=topay]').addEventListener('click',function(){window.__tiendaClick++});
 window.MF_REDIRECT=function(u){window.__redirigido=u};
</script><script src="pago-online.js"></script>`;

let n = 0;
async function prueba(nombre, fn) {
  try { await fn(); n++; console.log('  ok  ', nombre); } catch (e) { console.log('  FALLA', nombre, '\n      ', e.message); process.exitCode = 1; }
}

(async () => {
  fs.writeFileSync(path.join(RAIZ, 'tienda-falsa.html'), TIENDA);
  await new Promise((r) => servidor.listen(0, r));
  const base = 'http://localhost:' + servidor.address().port;
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
  const ctx = await browser.newContext();

  const nueva = async () => { const p = await ctx.newPage(); p.errores = []; p.on('pageerror', (e) => p.errores.push(e.message)); return p; };

  console.log('pago-online.js');
  await prueba('la casilla de WhatsApp aparece SIN marcar', async () => {
    const p = await nueva(); await p.goto(base + '/');
    assert.equal(await p.locator('#mf-wa input').isChecked(), false);
    assert.equal(p.errores.length, 0, p.errores.join());
    await p.close();
  });
  await prueba('envía el carrito, el permiso y redirige solo al checkout de Wompi', async () => {
    const p = await nueva(); let enviado;
    await p.route('**/api/crear-pedido', (r) => { enviado = JSON.parse(r.request().postData()); r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ url: 'https://checkout.wompi.co/p/?x=1', referencia: 'MF-1' }) }); });
    await p.goto(base + '/');
    await p.locator('#mf-wa input').check();
    await p.click('[data-n=topay]');
    await p.waitForFunction(() => window.__redirigido);
    assert.equal(await p.evaluate(() => window.__redirigido), 'https://checkout.wompi.co/p/?x=1');
    assert.deepEqual(enviado.items, [{ id: 'plataforma-luna', talla: '36', cant: 2 }]);
    assert.equal(enviado.consent_wa, true);
    assert.equal(enviado.cliente.direccion, 'Calle 1, Cali');
    assert.equal(await p.evaluate(() => window.__tiendaClick), 0, 'el clic original de la tienda queda bloqueado');
    await p.close();
  });
  await prueba('sin marcar la casilla envía consent_wa=false', async () => {
    const p = await nueva(); let enviado;
    await p.route('**/api/crear-pedido', (r) => { enviado = JSON.parse(r.request().postData()); r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ url: 'https://checkout.wompi.co/p/?x=1' }) }); });
    await p.goto(base + '/'); await p.click('[data-n=topay]'); await p.waitForFunction(() => window.__redirigido);
    assert.equal(enviado.consent_wa, false); await p.close();
  });
  await prueba('no redirige a un dominio que no sea Wompi (respuesta manipulada)', async () => {
    const p = await nueva();
    await p.route('**/api/crear-pedido', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ url: 'https://sitio-malo.com/robo' }) }));
    await p.goto(base + '/'); await p.click('[data-n=topay]');
    await p.waitForFunction(() => window.__toasts.length);
    assert.equal(await p.evaluate(() => window.__redirigido), undefined);
    assert.equal(await p.locator('[data-n=topay]').isEnabled(), true, 'el botón vuelve a quedar activo');
    await p.close();
  });
  await prueba('muestra el error del servidor y reactiva el botón', async () => {
    const p = await nueva();
    await p.route('**/api/crear-pedido', (r) => r.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ error: 'Sin stock: Plataforma Luna talla 36' }) }));
    await p.goto(base + '/'); await p.click('[data-n=topay]');
    await p.waitForFunction(() => window.__toasts.length);
    assert.equal(await p.evaluate(() => window.__toasts[0]), 'Sin stock: Plataforma Luna talla 36');
    assert.equal(await p.locator('[data-n=topay]').textContent(), 'Pagar $379.800');
    assert.equal(await p.locator('[data-n=topay]').isEnabled(), true);
    await p.close();
  });
  await prueba('doble clic rápido envía una sola solicitud', async () => {
    const p = await nueva(); let llamadas = 0;
    await p.route('**/api/crear-pedido', async (r) => { llamadas++; await new Promise((x) => setTimeout(x, 400)); r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ url: 'https://checkout.wompi.co/p/?x=1' }) }); });
    await p.goto(base + '/');
    await p.evaluate(() => { const b = document.querySelector('[data-n=topay]'); b.click(); b.click(); b.click(); });
    await p.waitForFunction(() => window.__redirigido);
    assert.equal(llamadas, 1); await p.close();
  });
  await prueba('datos incompletos: avisa y no llama a la API', async () => {
    const p = await nueva(); let llamadas = 0;
    await p.route('**/api/crear-pedido', (r) => { llamadas++; r.abort(); });
    await p.goto(base + '/'); await p.evaluate(() => { FRM.dir = ''; }); await p.click('[data-n=topay]');
    assert.equal(await p.evaluate(() => window.__toasts[0]), 'Completa tus datos de entrega');
    assert.equal(llamadas, 0); await p.close();
  });
  await prueba('error de red: avisa y reactiva el botón', async () => {
    const p = await nueva();
    await p.route('**/api/crear-pedido', (r) => r.abort());
    await p.goto(base + '/'); await p.click('[data-n=topay]'); await p.waitForFunction(() => window.__toasts.length);
    assert.equal(await p.locator('[data-n=topay]').isEnabled(), true); await p.close();
  });

  console.log('gracias.html');
  const seg = (o) => JSON.stringify({ token: 'a'.repeat(32), estado_pago: 'APPROVED', estado_envio: 'PREPARANDO', transportadora: null, guia: null, amount_in_cents: 37980000, reference: 'MF-123', payment_method_type: 'CARD', created_at: '2026-10-17T00:00:00Z', items: [{ nombre: 'Plataforma Luna', talla: '36', cant: 2 }], ...o });
  await prueba('pago aprobado: confirma, muestra productos y total en COP, limpia el carrito', async () => {
    const p = await nueva(); await p.addInitScript(() => localStorage.setItem('cart', '[1]'));
    await p.route('**/api/seguimiento*', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: seg() }));
    await p.goto(base + '/gracias.html?id=tx-12345');
    await p.waitForSelector('h1');
    assert.equal(await p.locator('h1').textContent(), '¡Pago recibido!');
    const t = await p.locator('#tarjeta').textContent();
    assert.match(t, /Plataforma Luna/); assert.match(t, /Talla 36 · Cant\. 2/); assert.match(t, /379\.800/); assert.match(t, /MF-123/); assert.match(t, /Preparando/);
    assert.equal(await p.evaluate(() => localStorage.getItem('cart')), null);
    assert.ok((await p.evaluate(() => location.search)).startsWith('?t='), 'el enlace pasa a ser el privado');
    assert.equal(p.errores.length, 0, p.errores.join()); await p.close();
  });
  await prueba('resumen completo con el enlace privado: precios, envío, datos del cliente, guía y botón Rastrear pedido', async () => {
    const p = await nueva();
    const completo = seg({ estado_envio: 'EN_CAMINO', transportadora: 'Coordinadora', guia: '7000282727272', link_rastreo: 'https://rastreo.ejemplo.com/?g=7000282727272', subtotal_centavos: 17900000, envio_centavos: 1750000, amount_in_cents: 19650000, items: [{ nombre: 'Bota Nueva', talla: '37', color: 'Negro', cant: 1, precio: 179000 }], cliente: { nombre: 'Ana Pérez', tel: '3115752334', email: 'ana@correo.com', ciudad: 'Medellín', direccion: 'Calle 10 # 5-5' } });
    await p.route('**/api/seguimiento*', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: completo }));
    await p.goto(base + '/gracias.html?t=' + 'a'.repeat(32));
    await p.waitForSelector('h1');
    const t = await p.locator('#tarjeta').textContent();
    for (const x of [/Resumen de tu compra/, /Bota Nueva/, /Talla 37 · Negro · Cant\. 1/, /179\.000/, /Envío/, /17\.500/, /196\.500/, /Datos de tu compra/, /Ana Pérez/, /3115752334/, /Medellín/, /Calle 10 # 5-5/, /Coordinadora/, /7000282727272/]) assert.match(t, x);
    const a = p.locator('a:has-text("Rastrear pedido")');
    assert.equal(await a.getAttribute('href'), 'https://rastreo.ejemplo.com/?g=7000282727272');
    assert.equal(await a.getAttribute('target'), '_blank'); assert.match(await a.getAttribute('rel'), /noopener/);
    assert.equal(p.errores.length, 0, p.errores.join()); await p.close();
  });
  await prueba('un link de rastreo que no sea https no se muestra como botón', async () => {
    const p = await nueva();
    await p.route('**/api/seguimiento*', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: seg({ estado_envio: 'EN_CAMINO', transportadora: 'X', guia: '1', link_rastreo: 'javascript:alert(1)' }) }));
    await p.goto(base + '/gracias.html?t=' + 'a'.repeat(32)); await p.waitForSelector('h1');
    assert.equal(await p.locator('a:has-text("Rastrear pedido")').count(), 0);
    assert.equal(p.errores.length, 0, p.errores.join()); await p.close();
  });
  await prueba('pendiente → se actualiza solo cuando llega la aprobación', async () => {
    const p = await nueva(); let n2 = 0;
    await p.addInitScript(() => { window.MF_POLL_MS = 150; });
    await p.route('**/api/seguimiento*', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: seg({ estado_pago: ++n2 < 3 ? 'PENDING' : 'APPROVED' }) }));
    await p.goto(base + '/gracias.html?id=tx-12345');
    await p.waitForFunction(() => document.querySelector('h1') && document.querySelector('h1').textContent === 'Estamos confirmando tu pago');
    await p.waitForFunction(() => document.querySelector('h1').textContent === '¡Pago recibido!', null, { timeout: 5000 });
    await p.close();
  });
  await prueba('pago rechazado: no limpia el carrito y ofrece volver', async () => {
    const p = await nueva(); await p.addInitScript(() => localStorage.setItem('cart', '[1]'));
    await p.route('**/api/seguimiento*', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: seg({ estado_pago: 'DECLINED' }) }));
    await p.goto(base + '/gracias.html?id=tx-12345'); await p.waitForSelector('h1');
    assert.equal(await p.locator('h1').textContent(), 'El pago no fue aprobado');
    assert.equal(await p.evaluate(() => localStorage.getItem('cart')), '[1]');
    assert.equal(await p.locator('a.boton').count(), 1); await p.close();
  });
  await prueba('envío en camino con transportadora y guía', async () => {
    const p = await nueva();
    await p.route('**/api/seguimiento*', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: seg({ estado_envio: 'EN_CAMINO', transportadora: 'Servientrega', guia: 'SV-1' }) }));
    await p.goto(base + '/gracias.html?t=' + 'a'.repeat(32)); await p.waitForSelector('h1');
    const t = await p.locator('#tarjeta').textContent(); assert.match(t, /Servientrega/); assert.match(t, /SV-1/);
    assert.equal(await p.locator('.paso.on').count(), 2); await p.close();
  });
  await prueba('sin parámetros o pedido inexistente: mensaje claro, sin errores de JS', async () => {
    const p = await nueva(); await p.goto(base + '/gracias.html'); await p.waitForSelector('h1');
    assert.equal(await p.locator('h1').textContent(), 'No encontramos tu pedido');
    const q = await nueva(); await q.route('**/api/seguimiento*', (r) => r.fulfill({ status: 404, contentType: 'application/json', body: '{"error":"x"}' }));
    await q.addInitScript(() => { window.MF_POLL_MS = 20; });
    await q.goto(base + '/gracias.html?id=tx-99999'); await q.waitForFunction(() => document.querySelector('h1') && document.querySelector('h1').textContent === 'No encontramos tu pedido', null, { timeout: 5000 });
    assert.equal(p.errores.length + q.errores.length, 0); await p.close(); await q.close();
  });
  await prueba('no interpreta HTML venido del servidor (sin XSS)', async () => {
    const p = await nueva();
    await p.route('**/api/seguimiento*', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: seg({ items: [{ nombre: '<img src=x onerror="window.__xss=1">', talla: '36', cant: 1 }], reference: '<b>x</b>' }) }));
    await p.goto(base + '/gracias.html?id=tx-12345'); await p.waitForSelector('h1');
    assert.equal(await p.evaluate(() => window.__xss), undefined);
    assert.equal(await p.locator('#tarjeta img').count(), 0); await p.close();
  });

  console.log('panel-pedidos.html');
  const pedido = (o) => ({ id: 7, referencia: 'MF-777', estado_pago: 'APPROVED', estado_envio: 'PREPARANDO', transportadora: null, guia: null, monto_centavos: 18990000, metodo: 'NEQUI', items: [{ nombre: 'Plataforma Luna', talla: '37', cant: 1 }], cliente: { nombre: 'Ana', tel: '3115752334', direccion: 'Calle 1, Cali', nota: 'Portería' }, consent_wa: true, alerta: 'STOCK_INSUFICIENTE', creado_en: '2026-10-17T10:00:00Z', pagado_en: '2026-10-17T10:05:00Z', ...o });
  await prueba('pide clave, lista pedidos con alerta, y guarda un envío con la clave en la cabecera', async () => {
    const p = await nueva(); let auth, guardado;
    await p.route('**/api/admin-pedidos*', (r) => {
      auth = r.request().headers().authorization;
      if (r.request().method() === 'GET') return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ pedidos: [pedido()] }) });
      guardado = JSON.parse(r.request().postData()); r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
    });
    await p.goto(base + '/panel-pedidos.html');
    assert.equal(await p.locator('#filtros').isHidden(), true, 'sin clave no se ve nada');
    await p.fill('#token', 'mi-clave'); await p.click('#entrar');
    await p.waitForSelector('.pedido');
    assert.equal(auth, 'Bearer mi-clave');
    const t = await p.locator('.pedido').textContent(); assert.match(t, /MF-777/); assert.match(t, /Revisar: STOCK_INSUFICIENTE/); assert.match(t, /189\.900/);
    assert.equal(await p.locator('.pedido a[href="https://wa.me/573115752334"]').count(), 1);
    await p.selectOption('.pedido select[aria-label="Estado de envío"]', 'EN_CAMINO');
    await p.fill('[aria-label=Transportadora]', 'Servientrega'); await p.fill('[aria-label="Número de guía"]', 'SV-9');
    await p.click('text=Guardar envío'); await p.waitForSelector('#msg.ok');
    assert.deepEqual(guardado, { id: 7, estado_envio: 'EN_CAMINO', transportadora: 'Servientrega', guia: 'SV-9', link_rastreo: '' });
    assert.equal(p.errores.length, 0, p.errores.join()); await p.close();
  });
  await prueba('clave incorrecta (401): vuelve a pedirla y no deja datos en pantalla', async () => {
    const p = await nueva();
    await p.route('**/api/admin-pedidos*', (r) => r.fulfill({ status: 401, contentType: 'application/json', body: '{"error":"No autorizado"}' }));
    await p.goto(base + '/panel-pedidos.html'); await p.fill('#token', 'mala'); await p.click('#entrar');
    await p.waitForFunction(() => document.querySelector('#msg').textContent === 'Clave incorrecta');
    assert.equal(await p.locator('#token').isVisible(), true); assert.equal(await p.locator('.pedido').count(), 0);
    assert.equal(await p.evaluate(() => sessionStorage.getItem('mf_admin')), null); await p.close();
  });
  await prueba('pedido sin pago aprobado: controles de envío deshabilitados; texto del cliente sin XSS', async () => {
    const p = await nueva();
    await p.route('**/api/admin-pedidos*', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ pedidos: [pedido({ estado_pago: 'PENDING', alerta: null, cliente: { nombre: '<img src=x onerror="window.__xss=1">', tel: '3115752334', direccion: '<b>d</b>' } })] }) }));
    await p.goto(base + '/panel-pedidos.html'); await p.fill('#token', 'k'); await p.click('#entrar'); await p.waitForSelector('.pedido');
    assert.equal(await p.locator('text=Guardar envío').isDisabled(), true);
    assert.equal(await p.evaluate(() => window.__xss), undefined); assert.equal(await p.locator('.pedido img').count(), 0); await p.close();
  });

  await browser.close(); servidor.close(); fs.unlinkSync(path.join(RAIZ, 'tienda-falsa.html'));
  console.log(`\n${n} pruebas de frontend pasaron` + (process.exitCode ? ' (HAY FALLAS)' : ''));
})().catch((e) => { console.error(e); try { fs.unlinkSync(path.join(RAIZ, 'tienda-falsa.html')); } catch (_) {} process.exit(1); });
