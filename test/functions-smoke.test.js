const test = require('node:test');
const assert = require('node:assert/strict');

const createOrder = require('../netlify/functions/crear-pedido');
const tracking = require('../netlify/functions/seguimiento');
const webhook = require('../netlify/functions/webhook-wompi');
const admin = require('../netlify/functions/admin-pedidos');

const envKeys = ['SUPABASE_URL','SUPABASE_SERVICE_KEY','WOMPI_PUBLIC_KEY','WOMPI_INTEGRITY_SECRET','WOMPI_EVENTS_SECRET','SITE_URL','ADMIN_TOKEN'];
function withoutIntegrationEnv(fn) {
  const before = Object.fromEntries(envKeys.map(k => [k, process.env[k]]));
  for (const key of envKeys) delete process.env[key];
  try { return fn(); }
  finally { for (const key of envKeys) { if (before[key] === undefined) delete process.env[key]; else process.env[key] = before[key]; } }
}

test('crear-pedido no crea pedidos si falta configuración de servidor', async () => {
  const result = await withoutIntegrationEnv(() => createOrder.handler({ httpMethod: 'POST', body: JSON.stringify({ items: [{id:'x',talla:'36',cant:1}] }) }));
  assert.equal(result.statusCode, 503);
  assert.match(JSON.parse(result.body).error, /no está configurado/i);
});

test('crear-pedido rechaza métodos que no sean POST', async () => {
  const result = await createOrder.handler({ httpMethod: 'GET', body: '' });
  assert.equal(result.statusCode, 405);
});

test('seguimiento falla cerrado si Supabase no está configurado', async () => {
  const result = await withoutIntegrationEnv(() => tracking.handler({ httpMethod: 'GET', queryStringParameters: { t: 'a'.repeat(32) } }));
  assert.equal(result.statusCode, 503);
});

test('webhook falla cerrado si falta el secreto de eventos', async () => {
  const result = await withoutIntegrationEnv(() => webhook.handler({ httpMethod: 'POST', body: '{}' }));
  assert.equal(result.statusCode, 503);
});

test('panel administrativo falla cerrado si falta ADMIN_TOKEN', async () => {
  const result = await withoutIntegrationEnv(() => admin.handler({ httpMethod: 'GET', headers: {} }));
  assert.equal(result.statusCode, 503);
});
