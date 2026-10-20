'use strict';
const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { hayDB, iniciar, eventoWompi, PRODUCTOS_BASE, CLIENTE_OK } = require('./helpers/backend');
const crearPedido = require('../lib/crear-pedido');
const webhook = require('../lib/webhook-wompi');

const enviar = (body) => webhook({ method: 'POST', headers: {}, query: {}, body });

describe('webhook-wompi', { skip: !hayDB && 'Falta TEST_DATABASE_URL' }, () => {
  let b;
  beforeEach(async () => { b = await iniciar(); await b.sembrar(PRODUCTOS_BASE); });
  afterEach(() => b.terminar());

  // Crea un pedido real (PENDING) por la API y devuelve su referencia y monto
  async function nuevoPedido(items = [{ id: 'plataforma-luna', talla: '36', cant: 2 }]) {
    const r = await crearPedido({ method: 'POST', headers: {}, query: {}, body: { items, cliente: CLIENTE_OK, consent_wa: true } });
    assert.equal(r.status, 200);
    const ref = r.json.referencia;
    return { ref, monto: Number((await b.pedido(ref)).monto_centavos) };
  }
  // Registra la transacción en la "API de Wompi" y devuelve el evento firmado
  function pago({ ref, monto, id = 'tx-1', status = 'APPROVED', apiStatus = status, apiRef = ref, apiMonto = monto, evMonto = monto }) {
    b.wompi.txs.set(id, { id, status: apiStatus, reference: apiRef, amount_in_cents: apiMonto, currency: 'COP', payment_method_type: 'CARD' });
    return eventoWompi({ id, status, reference: ref, monto: evMonto });
  }

  describe('firma', () => {
    it('rechaza una firma incorrecta (401) y no toca la base', async () => {
      const { ref, monto } = await nuevoPedido();
      const ev = pago({ ref, monto });
      ev.signature.checksum = 'a'.repeat(64);
      assert.equal((await enviar(ev)).status, 401);
      assert.equal((await b.pedido(ref)).estado_pago, 'PENDING');
    });
    it('rechaza un evento firmado con otro secreto', async () => {
      const { ref, monto } = await nuevoPedido();
      b.wompi.txs.set('tx-1', { id: 'tx-1', status: 'APPROVED', reference: ref, amount_in_cents: monto, currency: 'COP' });
      const ev = eventoWompi({ id: 'tx-1', status: 'APPROVED', reference: ref, monto, secret: 'secreto-ajeno' });
      assert.equal((await enviar(ev)).status, 401);
    });
    it('rechaza si el atacante cambia el estado después de firmar', async () => {
      const { ref, monto } = await nuevoPedido();
      const ev = pago({ ref, monto, status: 'DECLINED', apiStatus: 'APPROVED' });
      ev.data.transaction.status = 'APPROVED';
      assert.equal((await enviar(ev)).status, 401);
      assert.equal((await b.pedido(ref)).estado_pago, 'PENDING');
    });
    it('rechaza si cambian el monto después de firmar', async () => {
      const { ref } = await nuevoPedido();
      const ev = pago({ ref, monto: 100, apiMonto: 100 });
      ev.data.transaction.amount_in_cents = 1;
      assert.equal((await enviar(ev)).status, 401);
    });
    it('rechaza eventos sin firma, mal formados o con firma que omite propiedades clave (400)', async () => {
      for (const ev of [{}, null, 'texto', { event: 'x', data: {}, timestamp: 1 }, { signature: { checksum: 'x' } }]) {
        assert.equal((await enviar(ev)).status, 400, JSON.stringify(ev));
      }
      const { ref, monto } = await nuevoPedido();
      b.wompi.txs.set('tx-1', { id: 'tx-1', status: 'APPROVED', reference: ref, amount_in_cents: monto, currency: 'COP' });
      const sinEstado = eventoWompi({ id: 'tx-1', status: 'APPROVED', reference: ref, monto, props: ['transaction.id', 'transaction.amount_in_cents'] });
      assert.equal((await enviar(sinEstado)).status, 400);
    });
    it('solo acepta POST', async () => {
      assert.equal((await webhook({ method: 'GET', headers: {}, query: {} })).status, 405);
    });
    it('un evento que no es de transacciones se ignora con 200', async () => {
      const ev = eventoWompi({ id: 'x', status: 'APPROVED', reference: 'r', monto: 1, evento: 'nequi_token.updated' });
      const r = await enviar(ev);
      assert.equal(r.status, 200);
      assert.equal(r.json.ignorado, true);
    });
  });

  describe('pago aprobado', () => {
    it('aprueba el pedido, guarda la transacción y descuenta el stock', async () => {
      const { ref, monto } = await nuevoPedido();
      const r = await enviar(pago({ ref, monto }));
      assert.equal(r.status, 200);
      assert.equal(r.json.resultado, 'APROBADO');
      const p = await b.pedido(ref);
      assert.equal(p.estado_pago, 'APPROVED');
      assert.equal(p.wompi_tx, 'tx-1');
      assert.equal(p.metodo, 'CARD');
      assert.ok(p.pagado_en);
      assert.equal(p.alerta, null);
      assert.deepEqual((await b.producto('plataforma-luna')).stock, { 36: 1, 37: 2 });
    });
    it('es idempotente: el mismo evento repetido no descuenta dos veces', async () => {
      const { ref, monto } = await nuevoPedido();
      const ev = pago({ ref, monto });
      assert.equal((await enviar(ev)).json.resultado, 'APROBADO');
      for (let i = 0; i < 3; i++) assert.equal((await enviar(ev)).json.resultado, 'YA_APROBADO');
      assert.equal((await b.producto('plataforma-luna')).stock['36'], 1);
    });
    it('dos entregas simultáneas del mismo evento descuentan una sola vez', async () => {
      const { ref, monto } = await nuevoPedido();
      const ev = pago({ ref, monto });
      const rs = await Promise.all([enviar(ev), enviar(ev), enviar(ev), enviar(ev)]);
      assert.deepEqual(rs.map((r) => r.status), [200, 200, 200, 200]);
      assert.equal(rs.filter((r) => r.json.resultado === 'APROBADO').length, 1);
      assert.equal((await b.producto('plataforma-luna')).stock['36'], 1);
    });
    it('varios pedidos que compran el mismo producto a la vez no pierden descuentos de stock', async () => {
      const pedidos = [];
      for (let i = 0; i < 3; i++) pedidos.push(await nuevoPedido([{ id: 'plataforma-luna', talla: '36', cant: 1 }]));
      await Promise.all(pedidos.map((p, i) => enviar(pago({ ref: p.ref, monto: p.monto, id: 'tx-c' + i }))));
      assert.equal((await b.producto('plataforma-luna')).stock['36'], 0);
      assert.equal((await b.filas("select * from pedidos where estado_pago = 'APPROVED'")).length, 3);
    });
    it('descuenta cada talla y producto del pedido', async () => {
      const { ref, monto } = await nuevoPedido([{ id: 'plataforma-luna', talla: '36', cant: 1 }, { id: 'plataforma-luna', talla: '37', cant: 2 }, { id: 'tacon-aurora', talla: '38', cant: 3 }]);
      await enviar(pago({ ref, monto }));
      assert.deepEqual((await b.producto('plataforma-luna')).stock, { 36: 2, 37: 0 });
      assert.deepEqual((await b.producto('tacon-aurora')).stock, { 36: 1, 38: 2 });
    });
    it('si el stock ya no alcanza, registra el pago, deja el stock en 0 y marca alerta', async () => {
      const a = await nuevoPedido([{ id: 'tacon-aurora', talla: '36', cant: 1 }]);
      const c = await nuevoPedido([{ id: 'tacon-aurora', talla: '36', cant: 1 }]); // ambos vieron stock 1
      await enviar(pago({ ref: a.ref, monto: a.monto, id: 'tx-a' }));
      await enviar(pago({ ref: c.ref, monto: c.monto, id: 'tx-c' }));
      assert.equal((await b.pedido(a.ref)).alerta, null);
      const segundo = await b.pedido(c.ref);
      assert.equal(segundo.estado_pago, 'APPROVED');
      assert.equal(segundo.alerta, 'STOCK_INSUFICIENTE');
      assert.equal((await b.producto('tacon-aurora')).stock['36'], 0);
    });
    it('si el producto fue borrado, igual registra el pago con alerta', async () => {
      const { ref, monto } = await nuevoPedido();
      await b.psql("delete from productos where id = 'plataforma-luna'");
      assert.equal((await enviar(pago({ ref, monto }))).json.resultado, 'APROBADO');
      const p = await b.pedido(ref);
      assert.equal(p.estado_pago, 'APPROVED');
      assert.equal(p.alerta, 'STOCK_INSUFICIENTE');
    });
  });

  describe('verificación con la API de Wompi', () => {
    it('no aprueba si el monto del evento no coincide con el del pedido', async () => {
      const { ref, monto } = await nuevoPedido();
      const r = await enviar(pago({ ref, monto: monto - 100000 })); // pagó menos
      assert.equal(r.status, 200);
      assert.equal(r.json.resultado, 'MONTO_DISTINTO');
      const p = await b.pedido(ref);
      assert.equal(p.estado_pago, 'PENDING');
      assert.match(p.alerta, /^MONTO_DISTINTO/);
      assert.equal((await b.producto('plataforma-luna')).stock['36'], 3, 'el stock no se toca');
    });
    it('pide reintento (500) si el evento dice APPROVED pero la API aún dice PENDING', async () => {
      const { ref, monto } = await nuevoPedido();
      const r = await enviar(pago({ ref, monto, apiStatus: 'PENDING' }));
      assert.equal(r.status, 500);
      assert.equal((await b.pedido(ref)).estado_pago, 'PENDING');
    });
    it('no aprueba si la API de Wompi no conoce la transacción', async () => {
      const { ref, monto } = await nuevoPedido();
      const ev = eventoWompi({ id: 'tx-fantasma', status: 'APPROVED', reference: ref, monto });
      assert.equal((await enviar(ev)).status, 500);
      assert.equal((await b.pedido(ref)).estado_pago, 'PENDING');
    });
    it('no aprueba si la API devuelve otra referencia: queda alerta y no se reintenta', async () => {
      const a = await nuevoPedido();
      const otra = await nuevoPedido();
      const r = await enviar(pago({ ref: a.ref, monto: a.monto, apiRef: otra.ref }));
      assert.equal(r.status, 200);
      assert.equal((await b.pedido(a.ref)).estado_pago, 'PENDING');
      assert.equal((await b.pedido(otra.ref)).estado_pago, 'PENDING');
      assert.match((await b.pedido(a.ref)).alerta, /WOMPI_NO_COINCIDE/);
    });
    it('no aprueba si la API reporta otro monto', async () => {
      const { ref, monto } = await nuevoPedido();
      const r = await enviar(pago({ ref, monto, apiMonto: 100 }));
      assert.equal(r.status, 200);
      assert.equal((await b.pedido(ref)).estado_pago, 'PENDING');
    });
    it('si la API de Wompi está caída responde 500 para que Wompi reintente', async () => {
      const { ref, monto } = await nuevoPedido();
      const ev = pago({ ref, monto });
      b.wompi.caido = true;
      assert.equal((await enviar(ev)).status, 500);
      assert.equal((await b.pedido(ref)).estado_pago, 'PENDING');
      b.wompi.caido = false; // Wompi reintenta y ahora sí
      assert.equal((await enviar(ev)).json.resultado, 'APROBADO');
      assert.equal((await b.pedido(ref)).estado_pago, 'APPROVED');
    });
    it('con WOMPI_VERIFY_API=0 usa solo la firma del evento', async () => {
      process.env.WOMPI_VERIFY_API = '0';
      const { ref, monto } = await nuevoPedido();
      const ev = eventoWompi({ id: 'tx-sin-api', status: 'APPROVED', reference: ref, monto });
      assert.equal((await enviar(ev)).json.resultado, 'APROBADO');
    });
    it('referencia desconocida: 200 con alerta en log, sin crear nada', async () => {
      const r = await enviar(pago({ ref: 'MF-NO-EXISTE', monto: 500000 }));
      assert.equal(r.status, 200);
      assert.equal(r.json.resultado, 'NO_ENCONTRADO');
      assert.equal((await b.filas('select * from pedidos')).length, 0);
    });
  });

  describe('pagos fallidos y anulados', () => {
    it('DECLINED marca el pedido; un reintento aprobado posterior lo aprueba', async () => {
      const { ref, monto } = await nuevoPedido();
      assert.equal((await enviar(pago({ ref, monto, id: 'tx-1', status: 'DECLINED' }))).status, 200);
      let p = await b.pedido(ref);
      assert.equal(p.estado_pago, 'DECLINED');
      assert.equal(p.wompi_tx, 'tx-1');
      assert.equal((await enviar(pago({ ref, monto, id: 'tx-2' }))).json.resultado, 'APROBADO');
      p = await b.pedido(ref);
      assert.equal(p.estado_pago, 'APPROVED');
      assert.equal(p.wompi_tx, 'tx-2');
    });
    it('un DECLINED que llega tarde no pisa un pedido ya aprobado', async () => {
      const { ref, monto } = await nuevoPedido();
      await enviar(pago({ ref, monto, id: 'tx-2' }));
      await enviar(pago({ ref, monto, id: 'tx-1', status: 'DECLINED' }));
      const p = await b.pedido(ref);
      assert.equal(p.estado_pago, 'APPROVED');
      assert.equal(p.wompi_tx, 'tx-2');
    });
    it('ERROR y VOIDED también se registran en pedidos pendientes', async () => {
      for (const status of ['ERROR', 'VOIDED']) {
        const { ref, monto } = await nuevoPedido();
        await enviar(pago({ ref, monto, status }));
        assert.equal((await b.pedido(ref)).estado_pago, status);
      }
    });
    it('si se anula un pago ya aprobado, el pedido sigue aprobado pero queda alerta para revisar', async () => {
      const { ref, monto } = await nuevoPedido();
      await enviar(pago({ ref, monto, id: 'tx-1' }));
      await enviar(pago({ ref, monto, id: 'tx-1', status: 'VOIDED' }));
      const p = await b.pedido(ref);
      assert.equal(p.estado_pago, 'APPROVED');
      assert.match(p.alerta, /ANULADO_DESPUES_DE_APROBAR/);
    });
    it('anular OTRO intento (otra transacción) no levanta alerta en el pedido aprobado', async () => {
      const { ref, monto } = await nuevoPedido();
      await enviar(pago({ ref, monto, id: 'tx-2' }));
      await enviar(pago({ ref, monto, id: 'tx-1', status: 'VOIDED' }));
      assert.equal((await b.pedido(ref)).alerta, null);
    });
    it('un evento PENDING no cambia nada', async () => {
      const { ref, monto } = await nuevoPedido();
      assert.equal((await enviar(pago({ ref, monto, status: 'PENDING' }))).status, 200);
      assert.equal((await b.pedido(ref)).estado_pago, 'PENDING');
    });
  });
});
