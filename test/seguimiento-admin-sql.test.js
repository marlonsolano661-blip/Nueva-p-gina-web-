'use strict';
const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { hayDB, iniciar, eventoWompi, PRODUCTOS_BASE, CLIENTE_OK, ENV_PRUEBA, psql } = require('./helpers/backend');
const crearPedido = require('../lib/crear-pedido');
const webhook = require('../lib/webhook-wompi');
const seguimiento = require('../lib/seguimiento');
const admin = require('../lib/admin-pedidos');

const get = (query) => seguimiento({ method: 'GET', headers: {}, query });
const adminReq = (method, { query = {}, body, token = ENV_PRUEBA.ADMIN_TOKEN } = {}) =>
  admin({ method, headers: token === null ? {} : { Authorization: 'Bearer ' + token }, query, body });

describe('seguimiento, panel admin y SQL', { skip: !hayDB && 'Falta TEST_DATABASE_URL' }, () => {
  let b;
  beforeEach(async () => { b = await iniciar(); await b.sembrar(PRODUCTOS_BASE); });
  afterEach(() => b.terminar());

  async function pedidoPagado(id = 'tx-1') {
    const r = await crearPedido({ method: 'POST', headers: {}, query: {}, body: { items: [{ id: 'plataforma-luna', talla: '36', cant: 1 }], cliente: CLIENTE_OK } });
    const ref = r.json.referencia, p = await b.pedido(ref), monto = Number(p.monto_centavos);
    b.wompi.txs.set(id, { id, status: 'APPROVED', reference: ref, amount_in_cents: monto, currency: 'COP', payment_method_type: 'NEQUI' });
    await webhook({ method: 'POST', headers: {}, query: {}, body: eventoWompi({ id, status: 'APPROVED', reference: ref, monto }) });
    return { ref, monto, id, token: p.token };
  }
  async function pedidoPendiente() {
    const r = await crearPedido({ method: 'POST', headers: {}, query: {}, body: { items: [{ id: 'plataforma-luna', talla: '36', cant: 1 }], cliente: CLIENTE_OK } });
    const p = await b.pedido(r.json.referencia);
    return { ref: p.referencia, monto: Number(p.monto_centavos), token: p.token };
  }

  describe('seguimiento', () => {
    it('por token privado: devuelve estado sin datos personales', async () => {
      const p = await pedidoPagado();
      const r = await get({ t: p.token });
      assert.equal(r.status, 200);
      assert.equal(r.json.estado_pago, 'APPROVED');
      assert.equal(r.json.estado_envio, 'PREPARANDO');
      assert.equal(r.json.reference, p.ref);
      assert.equal(r.json.amount_in_cents, p.monto);
      assert.deepEqual(r.json.items, [{ nombre: 'Plataforma Luna', talla: '36', cant: 1 }]);
      const texto = JSON.stringify(r.json);
      for (const secreto of ['Ana Pérez', '3115752334', 'ana@correo.com', 'Calle 10', 'Medellín', '"ip"', '"cliente"']) assert.equal(texto.includes(secreto), false, secreto);
      assert.equal(r.headers['Cache-Control'], 'no-store');
    });
    it('por id de transacción (regreso desde Wompi)', async () => {
      const p = await pedidoPagado('tx-777');
      const r = await get({ id: 'tx-777' });
      assert.equal(r.status, 200);
      assert.equal(r.json.estado_pago, 'APPROVED');
      assert.equal(r.json.token, p.token);
    });
    it('si el webhook aún no llegó, consulta a Wompi y muestra el estado en vivo', async () => {
      const p = await pedidoPendiente();
      b.wompi.txs.set('tx-vivo', { id: 'tx-vivo', status: 'PENDING', reference: p.ref, amount_in_cents: p.monto, currency: 'COP' });
      const r = await get({ id: 'tx-vivo' });
      assert.equal(r.status, 200);
      assert.equal(r.json.estado_pago, 'PENDING');
      b.wompi.txs.set('tx-vivo', { id: 'tx-vivo', status: 'DECLINED', reference: p.ref, amount_in_cents: p.monto, currency: 'COP' });
      assert.equal((await get({ id: 'tx-vivo' })).json.estado_pago, 'DECLINED');
    });
    it('un estado "en vivo" APPROVED no se acepta como pagado hasta que el webhook lo confirme... pero se muestra', async () => {
      const p = await pedidoPendiente();
      b.wompi.txs.set('tx-vivo-2', { id: 'tx-vivo-2', status: 'APPROVED', reference: p.ref, amount_in_cents: p.monto, currency: 'COP' });
      assert.equal((await get({ id: 'tx-vivo-2' })).json.estado_pago, 'APPROVED');
      assert.equal((await b.pedido(p.ref)).estado_pago, 'PENDING', 'la base solo la cambia el webhook');
    });
    it('descarta la transacción si su monto no coincide con el pedido', async () => {
      const p = await pedidoPendiente();
      b.wompi.txs.set('tx-monto-malo', { id: 'tx-monto-malo', status: 'APPROVED', reference: p.ref, amount_in_cents: 100, currency: 'COP' });
      assert.equal((await get({ id: 'tx-monto-malo' })).status, 404);
    });
    it('404 para tokens e ids desconocidos, y 404 (no error) si Wompi está caído', async () => {
      assert.equal((await get({ t: 'a'.repeat(32) })).status, 404);
      assert.equal((await get({ id: 'tx-no-existe' })).status, 404);
      b.wompi.caido = true;
      assert.equal((await get({ id: 'tx-otra' })).status, 404);
    });
    it('rechaza parámetros mal formados e intentos de inyección', async () => {
      for (const q of [{}, { t: 'corto' }, { t: 'A'.repeat(32) }, { t: ['a'.repeat(32)] }, { id: 'x' }, { id: "tx';drop table pedidos;--" }, { id: 'a&select=*' }, { id: ['tx-1', 'tx-2'] }]) {
        assert.equal((await get(q)).status, 404, JSON.stringify(q));
      }
      assert.equal((await b.filas('select * from pedidos')).length, 0);
    });
    it('solo GET', async () => {
      assert.equal((await seguimiento({ method: 'POST', headers: {}, query: {} })).status, 405);
    });
  });

  describe('panel admin', () => {
    it('exige la clave: sin clave, con clave errónea o sin configurar → no entra', async () => {
      assert.equal((await adminReq('GET', { token: null })).status, 401);
      assert.equal((await adminReq('GET', { token: 'equivocada' })).status, 401);
      assert.equal((await adminReq('GET', { token: '' })).status, 401);
      assert.equal((await adminReq('POST', { token: 'equivocada', body: { id: 1, estado_envio: 'EN_CAMINO' } })).status, 401);
      process.env.ADMIN_TOKEN = 'corta';
      assert.equal((await adminReq('GET', { token: 'corta' })).status, 500, 'una clave de menos de 24 caracteres se rechaza');
      delete process.env.ADMIN_TOKEN;
      assert.equal((await adminReq('GET', { token: '' })).status, 500);
    });
    it('lista pedidos con filtros e incluye los datos de entrega', async () => {
      await pedidoPagado(); await pedidoPendiente();
      const todos = await adminReq('GET');
      assert.equal(todos.json.pedidos.length, 2);
      const aprobados = await adminReq('GET', { query: { pago: 'APPROVED' } });
      assert.equal(aprobados.json.pedidos.length, 1);
      assert.equal(aprobados.json.pedidos[0].cliente.nombre, 'Ana Pérez');
      assert.equal((await adminReq('GET', { query: { pago: 'APPROVED', envio: 'ENTREGADO' } })).json.pedidos.length, 0);
      assert.equal((await adminReq('GET', { query: { pago: "x';--" } })).json.pedidos.length, 2, 'filtro inválido se ignora');
    });
    it('actualiza el envío, guarda fechas y se ve en el seguimiento del cliente', async () => {
      const p = await pedidoPagado();
      const id = (await b.pedido(p.ref)).id;
      const r = await adminReq('POST', { body: { id, estado_envio: 'EN_CAMINO', transportadora: 'Servientrega', guia: 'SV-123/45' } });
      assert.equal(r.status, 200);
      const fila = await b.pedido(p.ref);
      assert.equal(fila.estado_envio, 'EN_CAMINO');
      assert.ok(fila.enviado_en);
      const seg = await get({ t: p.token });
      assert.equal(seg.json.estado_envio, 'EN_CAMINO');
      assert.equal(seg.json.transportadora, 'Servientrega');
      assert.equal(seg.json.guia, 'SV-123/45');
      await adminReq('POST', { body: { id, estado_envio: 'ENTREGADO', transportadora: 'Servientrega', guia: 'SV-123/45' } });
      assert.ok((await b.pedido(p.ref)).entregado_en);
    });
    it('no deja cambiar el envío de un pedido sin pago aprobado', async () => {
      const p = await pedidoPendiente();
      const id = (await b.pedido(p.ref)).id;
      assert.equal((await adminReq('POST', { body: { id, estado_envio: 'EN_CAMINO' } })).status, 404);
      assert.equal((await b.pedido(p.ref)).estado_envio, 'PREPARANDO');
    });
    it('valida lo que entra', async () => {
      const p = await pedidoPagado();
      const id = (await b.pedido(p.ref)).id;
      for (const body of [{ id: 'x', estado_envio: 'EN_CAMINO' }, { id, estado_envio: 'VOLANDO' }, { id, estado_envio: 'EN_CAMINO', guia: "1'; drop table pedidos;--" }, { id, estado_envio: 'EN_CAMINO', transportadora: '<script>' }, {}]) {
        assert.equal((await adminReq('POST', { body })).status, 400, JSON.stringify(body));
      }
      assert.equal((await adminReq('POST', { body: '{roto' })).status, 400);
      assert.equal((await adminReq('PUT')).status, 405);
    });
  });

  describe('SQL real y permisos de Supabase', () => {
    it('el esquema se puede ejecutar dos veces sin perder datos (idempotente)', async () => {
      const p = await pedidoPagado();
      const fs = require('node:fs'), path = require('node:path');
      await psql(fs.readFileSync(path.join(__dirname, '../supabase/schema.sql'), 'utf8'));
      assert.equal((await b.pedido(p.ref)).estado_pago, 'APPROVED');
      assert.equal((await b.filas('select * from productos')).length, 3);
    });
    it('migra una base de la versión anterior (sin columna alerta, función booleana)', async () => {
      await psql(`
        drop schema public cascade; create schema public;
        grant usage on schema public to anon, authenticated, service_role;
        create table productos (id text primary key, nombre text not null, precio bigint not null check (precio > 0), stock jsonb not null default '{}', visible boolean not null default true);
        create table pedidos (id bigint generated always as identity primary key, referencia text unique not null,
          token text unique not null default replace(gen_random_uuid()::text,'-',''), estado_pago text not null default 'PENDING',
          estado_envio text not null default 'PREPARANDO' check (estado_envio in ('PREPARANDO','EN_CAMINO','ENTREGADO','DEVUELTO')),
          transportadora text, guia text, monto_centavos bigint not null, metodo text, wompi_tx text, items jsonb not null, cliente jsonb not null,
          consent_wa boolean not null default false, meta jsonb not null default '{}', notificado jsonb not null default '{}',
          creado_en timestamptz not null default now(), pagado_en timestamptz, enviado_en timestamptz, entregado_en timestamptz);
        create function aprobar_pedido(p_ref text, p_tx text, p_monto bigint, p_metodo text) returns boolean language sql as 'select true';
        insert into pedidos (referencia, monto_centavos, items, cliente) values ('MF-VIEJO', 100, '[]', '{}');
      `);
      const fs = require('node:fs'), path = require('node:path');
      await psql(fs.readFileSync(path.join(__dirname, '../supabase/schema.sql'), 'utf8'));
      assert.equal((await b.pedido('MF-VIEJO')).alerta, null);
      assert.equal(await psql("select aprobar_pedido('MF-VIEJO','t',100,'CARD')"), 'APROBADO');
    });
    it('la llave pública (anon) y usuarios autenticados NO pueden leer ni escribir tablas', async () => {
      await pedidoPagado();
      for (const rol of ['anon', 'authenticated']) {
        for (const sql of ['select * from pedidos', 'select * from productos', "update productos set precio = 1", "insert into pedidos (referencia, monto_centavos, items, cliente) values ('x',1,'[]','{}')", 'delete from pedidos']) {
          await assert.rejects(psql(`set role ${rol}; ${sql};`), /permission denied/, `${rol}: ${sql}`);
        }
      }
    });
    it('anon y authenticated NO pueden ejecutar aprobar_pedido por RPC (nadie puede marcarse como pagado)', async () => {
      const p = await pendienteSimple();
      for (const rol of ['anon', 'authenticated']) {
        await assert.rejects(psql(`set role ${rol}; select aprobar_pedido('${p.ref}','fake',${p.monto},'CARD');`), /permission denied/, rol);
      }
      assert.equal((await b.pedido(p.ref)).estado_pago, 'PENDING');
      async function pendienteSimple() { const x = await pedidoPendiente(); return x; }
    });
    it('service_role sí puede usar las tablas y la función', async () => {
      const p = await pedidoPendiente();
      assert.equal(await psql(`set role service_role; select aprobar_pedido('${p.ref}','t1',${p.monto},'CARD');`), 'APROBADO');
    });
    it('las restricciones de la base rechazan datos corruptos', async () => {
      await assert.rejects(psql("insert into productos (id,nombre,precio) values ('p','x',0)"), /check/);
      await assert.rejects(psql("insert into productos (id,nombre,precio) values ('p','x',-5)"), /check/);
      await assert.rejects(psql(`insert into productos (id,nombre,precio,stock) values ('p','x',5,'[1,2]')`), /check/);
      await assert.rejects(psql("insert into pedidos (referencia,monto_centavos,items,cliente,estado_pago) values ('r',100,'[]','{}','PAGADO')"), /check/);
      await assert.rejects(psql("insert into pedidos (referencia,monto_centavos,items,cliente) values ('r',0,'[]','{}')"), /check/);
    });
  });
});
