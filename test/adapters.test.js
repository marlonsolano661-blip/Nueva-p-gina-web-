'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { vercel, netlify } = require('../lib/adapters');

const eco = async (req) => ({ status: 201, json: { metodo: req.method, q: req.query, cuerpo: req.body, auth: req.headers.authorization }, headers: { 'X-Prueba': '1' } });
const vacio = async () => ({ status: 204, headers: {} });

describe('adaptadores de plataforma', () => {
  it('Vercel: traduce petición y respuesta JSON', async () => {
    const cab = {}; let cuerpo = '', codigo = 0;
    const res = { setHeader: (k, v) => { cab[k] = v; }, set statusCode(v) { codigo = v; }, end: (c) => { cuerpo = c || ''; } };
    await vercel(eco)({ method: 'POST', headers: { authorization: 'Bearer x' }, query: { a: '1' }, body: { z: 1 } }, res);
    assert.equal(codigo, 201);
    assert.equal(cab['Content-Type'], 'application/json; charset=utf-8');
    assert.equal(cab['X-Prueba'], '1');
    assert.deepEqual(JSON.parse(cuerpo), { metodo: 'POST', q: { a: '1' }, cuerpo: { z: 1 }, auth: 'Bearer x' });
  });
  it('Vercel: respuesta sin cuerpo', async () => {
    let codigo = 0, cuerpo = 'x';
    await vercel(vacio)({ method: 'OPTIONS', headers: {} }, { setHeader() {}, set statusCode(v) { codigo = v; }, end: (c) => { cuerpo = c || ''; } });
    assert.equal(codigo, 204); assert.equal(cuerpo, '');
  });
  it('Netlify: traduce evento (incluido cuerpo en base64) y respuesta', async () => {
    const r = await netlify(eco)({ httpMethod: 'POST', headers: { authorization: 'Bearer y' }, queryStringParameters: { b: '2' }, body: Buffer.from('{"k":1}').toString('base64'), isBase64Encoded: true });
    assert.equal(r.statusCode, 201);
    assert.equal(r.headers['Content-Type'], 'application/json; charset=utf-8');
    const j = JSON.parse(r.body);
    assert.equal(j.cuerpo, '{"k":1}'); assert.equal(j.q.b, '2'); assert.equal(j.auth, 'Bearer y');
  });
  it('Netlify: evento sin query ni cuerpo', async () => {
    const r = await netlify(vacio)({ httpMethod: 'GET', headers: null, queryStringParameters: null, body: null });
    assert.equal(r.statusCode, 204); assert.equal(r.body, '');
  });
  it('los archivos api/ y netlify/functions/ cargan y exportan funciones', () => {
    for (const n of ['crear-pedido', 'webhook-wompi', 'seguimiento', 'admin-pedidos']) {
      assert.equal(typeof require('../api/' + n), 'function', 'api/' + n);
      assert.equal(typeof require('../netlify/functions/' + n).handler, 'function', 'netlify/' + n);
    }
  });
});
