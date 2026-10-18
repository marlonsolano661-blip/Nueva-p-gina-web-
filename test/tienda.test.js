'use strict';
// Integración tienda: envío fijo, catálogo administrable, pedidos sin duplicados, despacho y registro de eventos.
// Corre contra PostgreSQL real con el esquema real (supabase/schema.sql); Supabase/Wompi se simulan por fetch.
const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { hayDB, iniciar, eventoWompi, PRODUCTOS_BASE, CLIENTE_OK, ENV_PRUEBA } = require('./helpers/backend');
const crearPedido = require('../lib/crear-pedido');
const webhook = require('../lib/webhook-wompi');
const catalogo = require('../lib/catalogo');
const adminTienda = require('../lib/admin-tienda');
const adminPedidos = require('../lib/admin-pedidos');

const ENVIO = 17500;
const crear = (body, h = {}) => crearPedido({ method: 'POST', headers: h, query: {}, body });
const verCatalogo = () => catalogo({ method: 'GET', headers: {}, query: {} });
const tienda = (method, { query = {}, body, token = ENV_PRUEBA.ADMIN_TOKEN } = {}) =>
  adminTienda({ method, headers: token === null ? {} : { Authorization: 'Bearer ' + token }, query, body });
const pedidos = (method, { query = {}, body } = {}) => adminPedidos({ method, headers: { Authorization: 'Bearer ' + ENV_PRUEBA.ADMIN_TOKEN }, query, body });
const items = (n = 1) => [{ id: 'plataforma-luna', talla: '36', cant: n }];
const NUEVO = { id: 'bota-nueva', nombre: 'Bota Nueva', precio: 300000, stock: { 36: 2, 37: 1 }, descripcion: 'Bota de prueba', imagenes: ['https://cdn.test/a.jpg', 'https://cdn.test/b.jpg'], colores: [{ n: 'Negro', h: '#111111' }], coleccion: 'botas', destacado: true, orden: 1, visible: true };

describe('tienda integrada', { skip: !hayDB && 'Falta TEST_DATABASE_URL' }, () => {
  let b;
  beforeEach(async () => { b = await iniciar(); await b.sembrar(PRODUCTOS_BASE); });
  afterEach(() => b.terminar());
  const aprobar = async (ref, id = 'tx-1') => {
    const p = await b.pedido(ref), monto = Number(p.monto_centavos);
    b.wompi.txs.set(id, { id, status: 'APPROVED', reference: ref, amount_in_cents: monto, currency: 'COP', payment_method_type: 'CARD' });
    return webhook({ method: 'POST', headers: {}, query: {}, body: eventoWompi({ id, status: 'APPROVED', reference: ref, monto }) });
  };
  const eventos = async (tipo) => b.filas(`select * from eventos where tipo = '${tipo}' order by id`);

  describe('envío fijo de $17.500', () => {
    it('total = subtotal + envío, guardado en el pedido y enviado igual al checkout', async () => {
      const r = await crear({ items: items(2), cliente: CLIENTE_OK });
      assert.equal(r.status, 200);
      const sub = 189900 * 2;
      assert.deepEqual([r.json.subtotal, r.json.envio, r.json.total], [sub, ENVIO, sub + ENVIO]);
      const p = await b.pedido(r.json.referencia);
      assert.equal(Number(p.subtotal_centavos), sub * 100);
      assert.equal(Number(p.envio_centavos), ENVIO * 100);
      assert.equal(Number(p.monto_centavos), (sub + ENVIO) * 100);
      assert.equal(new URL(r.json.url).searchParams.get('amount-in-cents'), String(Number(p.monto_centavos)));
    });
    it('el envío no se suma dos veces con varias líneas ni se omite', async () => {
      const r = await crear({ items: [{ id: 'plataforma-luna', talla: '36', cant: 1 }, { id: 'tacon-aurora', talla: '38', cant: 1 }, { id: 'plataforma-luna', talla: '37', cant: 1 }], cliente: CLIENTE_OK });
      assert.equal(r.json.total, 189900 * 2 + 169900 + ENVIO);
    });
    it('total_esperado distinto al del servidor → 409 y no crea pedido', async () => {
      const r = await crear({ items: items(), cliente: CLIENTE_OK, total_esperado: 189900 });
      assert.equal(r.status, 409);
      assert.equal(r.json.total, 189900 + ENVIO);
      assert.equal((await b.filas('select id from pedidos')).length, 0);
      const ok = await crear({ items: items(), cliente: CLIENTE_OK, total_esperado: 189900 + ENVIO });
      assert.equal(ok.status, 200);
    });
    it('el navegador no puede fijar el envío', async () => {
      const r = await crear({ items: items(), cliente: CLIENTE_OK, envio: 0, shipping: 0, total: 1 });
      assert.equal(r.json.envio, ENVIO);
    });
    it('si no hay tarifa configurada falla con 500 y no crea pedido (no inventa valores)', async () => {
      await b.psql("delete from ajustes where clave = 'envio'");
      const r = await crear({ items: items(), cliente: CLIENTE_OK });
      assert.equal(r.status, 500);
      assert.equal(r.json.url, undefined);
      assert.equal((await b.filas('select id from pedidos')).length, 0);
    });
    it('el webhook aprueba el monto con envío; el monto sin envío NO aprueba', async () => {
      const r = await crear({ items: items(), cliente: CLIENTE_OK });
      const ref = r.json.referencia, sinEnvio = 189900 * 100;
      b.wompi.txs.set('tx-x', { id: 'tx-x', status: 'APPROVED', reference: ref, amount_in_cents: sinEnvio, currency: 'COP' });
      const mal = await webhook({ method: 'POST', headers: {}, query: {}, body: eventoWompi({ id: 'tx-x', status: 'APPROVED', reference: ref, monto: sinEnvio }) });
      assert.equal(mal.json.resultado, 'MONTO_DISTINTO');
      assert.equal((await b.pedido(ref)).estado_pago, 'PENDING');
      const bien = await aprobar(ref, 'tx-ok');
      assert.equal(bien.json.resultado, 'APROBADO');
      assert.equal((await b.pedido(ref)).estado_pago, 'APPROVED');
    });
    it('el webhook repetido no duplica el pago ni el descuento de stock y queda registrado', async () => {
      const r = await crear({ items: items(), cliente: CLIENTE_OK });
      await aprobar(r.json.referencia); await aprobar(r.json.referencia);
      assert.equal((await b.producto('plataforma-luna')).stock['36'], 2);
      assert.equal((await eventos('pago_aprobado')).length, 1);
      assert.equal((await eventos('pago_ya_aprobado')).length, 1);
    });
    it('cambiar la tarifa desde el panel afecta pedidos nuevos y NO los históricos', async () => {
      const viejo = await crear({ items: items(), cliente: CLIENTE_OK });
      const r = await tienda('POST', { body: { recurso: 'envio', tarifa: 20000 } });
      assert.equal(r.status, 200);
      const nuevo = await crear({ items: items(), cliente: CLIENTE_OK });
      assert.equal(nuevo.json.envio, 20000);
      const pv = await b.pedido(viejo.json.referencia);
      assert.equal(Number(pv.envio_centavos), ENVIO * 100);
      assert.equal((await aprobar(viejo.json.referencia)).json.resultado, 'APROBADO'); // se cobra lo que se creó
      assert.deepEqual((await eventos('envio_actualizado'))[0].detalle, { anterior: ENVIO, nueva: 20000 });
    });
    it('valida la tarifa', async () => {
      for (const tarifa of [-1, 1.5, 'x', 1e9, null]) assert.equal((await tienda('POST', { body: { recurso: 'envio', tarifa } })).status, 400, String(tarifa));
      assert.equal((await b.filas("select valor from ajustes where clave='envio'"))[0].valor.tarifa, ENVIO);
    });
  });

  describe('pedidos sin duplicados', () => {
    it('misma clave dos veces → un solo pedido', async () => {
      const body = { items: items(), cliente: CLIENTE_OK, clave: 'clave-12345678' };
      const a = await crear(body), c = await crear(body);
      assert.equal(a.json.referencia, c.json.referencia);
      assert.equal(c.json.reutilizado, true);
      assert.equal((await b.filas('select id from pedidos')).length, 1);
      assert.equal(new URL(c.json.url).searchParams.get('amount-in-cents'), new URL(a.json.url).searchParams.get('amount-in-cents'));
    });
    it('solicitudes simultáneas con la misma clave → un solo pedido', async () => {
      const body = { items: items(), cliente: CLIENTE_OK, clave: 'clave-simultanea-1' };
      const rs = await Promise.all([crear(body), crear(body), crear(body)]);
      assert.ok(rs.every((r) => r.status === 200), JSON.stringify(rs.map((r) => r.status)));
      assert.equal(new Set(rs.map((r) => r.json.referencia)).size, 1);
      assert.equal((await b.filas('select id from pedidos')).length, 1);
    });
    it('clave de un pedido ya pagado → 409; claves malformadas → 400', async () => {
      const body = { items: items(), cliente: CLIENTE_OK, clave: 'clave-pagada-123' };
      const a = await crear(body);
      await aprobar(a.json.referencia);
      assert.equal((await crear(body)).status, 409);
      assert.equal((await crear({ ...body, clave: "x'; drop" })).status, 400);
    });
    it('si la base falla al guardar no se declara pedido creado', async () => {
      const f = globalThis.fetch;
      globalThis.fetch = async (u, o = {}) => (String(u).includes('/rest/v1/pedidos') && o.method === 'POST' ? new Response('{"message":"boom"}', { status: 500 }) : f(u, o));
      try {
        const r = await crear({ items: items(), cliente: CLIENTE_OK });
        assert.equal(r.status, 500);
        assert.equal(r.json.url, undefined);
      } finally { globalThis.fetch = f; }
      assert.equal((await eventos('pedido_creado')).length, 0);
    });
    it('registra el evento pedido_creado con los montos', async () => {
      const r = await crear({ items: items(), cliente: CLIENTE_OK });
      const e = await eventos('pedido_creado');
      assert.equal(e.length, 1);
      assert.equal(e[0].referencia, r.json.referencia);
      assert.deepEqual(e[0].detalle, { subtotal: 189900, envio: ENVIO, total: 189900 + ENVIO });
    });
  });

  describe('colores', () => {
    it('valida el color contra el catálogo y lo guarda en el pedido', async () => {
      await b.psql(`update productos set colores = '[{"n":"Negro","h":"#111111"}]' where id = 'plataforma-luna'`);
      assert.equal((await crear({ items: [{ ...items()[0], color: 'Rojo' }], cliente: CLIENTE_OK })).status, 400);
      assert.equal((await crear({ items: items(), cliente: CLIENTE_OK })).status, 400); // el producto tiene colores: hay que elegir uno
      const r = await crear({ items: [{ ...items()[0], color: 'Negro' }], cliente: CLIENTE_OK });
      assert.equal(r.status, 200);
      assert.equal((await b.pedido(r.json.referencia)).items[0].color, 'Negro');
    });
  });

  describe('administración del catálogo', () => {
    it('exige autorización real en el servidor', async () => {
      for (const token of [null, 'x'.repeat(40), '']) {
        assert.equal((await tienda('GET', { query: { recurso: 'productos' }, token })).status, 401);
        assert.equal((await tienda('POST', { body: { recurso: 'producto', producto: NUEVO }, token })).status, 401);
        assert.equal((await tienda('POST', { body: { recurso: 'envio', tarifa: 1 }, token })).status, 401);
      }
      assert.equal((await b.filas("select id from productos where id = 'bota-nueva'")).length, 0);
    });
    it('crear → aparece en el catálogo público → comprar con precio del servidor', async () => {
      const g = await tienda('POST', { body: { recurso: 'producto', producto: NUEVO } });
      assert.equal(g.status, 200);
      const pub = (await verCatalogo()).json;
      const p = pub.productos.find((x) => x.id === 'bota-nueva');
      assert.ok(p);
      assert.deepEqual([p.name, p.price, p.tallas, p.colors, p.coleccion, p.destacado, p.img], ['Bota Nueva', 300000, ['36', '37'], [{ n: 'Negro', h: '#111111' }], 'botas', true, 'https://cdn.test/a.jpg']);
      assert.equal(pub.envio.tarifa, ENVIO);
      const r = await crear({ items: [{ id: 'bota-nueva', talla: '36', cant: 1, color: 'Negro', precio: 1 }], cliente: CLIENTE_OK });
      assert.equal(r.json.total, 300000 + ENVIO);
    });
    it('editar precio, imágenes, tallas y colores persiste (se relee de la base)', async () => {
      await tienda('POST', { body: { recurso: 'producto', producto: NUEVO } });
      const ed = { ...NUEVO, precio: 280000, imagenes: ['https://cdn.test/c.jpg'], stock: { 38: 5 }, colores: [{ n: 'Café', h: '#552200' }, { n: 'Negro', h: '#111111' }] };
      assert.equal((await tienda('POST', { body: { recurso: 'producto', producto: ed } })).status, 200);
      const fila = (await b.filas("select * from productos where id = 'bota-nueva'"))[0];
      assert.equal(Number(fila.precio), 280000);
      assert.deepEqual([fila.imagenes, fila.stock, fila.colores.length], [['https://cdn.test/c.jpg'], { 38: 5 }, 2]);
      const adm = (await tienda('GET', { query: { recurso: 'productos' } })).json.productos.find((x) => x.id === 'bota-nueva');
      assert.equal(Number(adm.precio), 280000);
    });
    it('ocultar retira del catálogo público y de la compra; publicar lo devuelve', async () => {
      await tienda('POST', { body: { recurso: 'producto', producto: NUEVO } });
      await tienda('POST', { body: { recurso: 'producto', producto: { ...NUEVO, visible: false } } });
      assert.ok(!(await verCatalogo()).json.productos.some((x) => x.id === 'bota-nueva'));
      assert.equal((await crear({ items: [{ id: 'bota-nueva', talla: '36', cant: 1, color: 'Negro' }], cliente: CLIENTE_OK })).status, 400);
      assert.ok((await tienda('GET', { query: { recurso: 'productos' } })).json.productos.some((x) => x.id === 'bota-nueva'));
      await tienda('POST', { body: { recurso: 'producto', producto: NUEVO } });
      assert.ok((await verCatalogo()).json.productos.some((x) => x.id === 'bota-nueva'));
    });
    it('cambiar un precio no altera pedidos históricos', async () => {
      const r = await crear({ items: items(), cliente: CLIENTE_OK });
      await tienda('POST', { body: { recurso: 'producto', producto: { id: 'plataforma-luna', nombre: 'Plataforma Luna', precio: 1000, stock: { 36: 3 } } } });
      const p = await b.pedido(r.json.referencia);
      assert.equal(p.items[0].precio, 189900);
      assert.equal(Number(p.monto_centavos), (189900 + ENVIO) * 100);
      assert.equal((await aprobar(r.json.referencia)).json.resultado, 'APROBADO');
    });
    it('rechaza datos inválidos y no guarda ni registra nada', async () => {
      const malos = [{ ...NUEVO, precio: 0 }, { ...NUEVO, precio: 10.5 }, { ...NUEVO, nombre: '' }, { ...NUEVO, id: 'a b' }, { ...NUEVO, stock: { 36: -1 } }, { ...NUEVO, imagenes: ['javascript:alert(1)'] }, { ...NUEVO, colores: [{ n: 'X', h: 'rojo' }] }, { ...NUEVO, stock: [] }];
      for (const producto of malos) assert.equal((await tienda('POST', { body: { recurso: 'producto', producto } })).status, 400, JSON.stringify(producto).slice(0, 60));
      assert.equal((await b.filas("select id from productos where id = 'bota-nueva'")).length, 0);
      assert.equal((await eventos('producto_guardado')).length, 0);
      assert.equal((await tienda('POST', { body: { recurso: 'otro' } })).status, 400);
      assert.equal((await tienda('POST', { body: '{roto' })).status, 400);
    });
    it('el catálogo público no expone ocultos ni datos internos', async () => {
      const pub = JSON.stringify((await verCatalogo()).json);
      assert.ok(!pub.includes('oculto'));
      assert.ok(!/costo|actualizado_en|"stock"/.test(pub));
    });
    it('si la base falla al guardar el producto responde error y no confirma', async () => {
      const f = globalThis.fetch;
      globalThis.fetch = async (u, o = {}) => (String(u).includes('/rest/v1/productos') && o.method === 'POST' ? new Response('{}', { status: 500 }) : f(u, o));
      try {
        const r = await tienda('POST', { body: { recurso: 'producto', producto: NUEVO } });
        assert.equal(r.status, 500);
        assert.equal(r.json.ok, undefined);
      } finally { globalThis.fetch = f; }
      assert.equal((await eventos('producto_guardado')).length, 0);
    });
    it('contenido: guarda textos, secciones y colecciones; lo público lo recibe', async () => {
      const contenido = { textos: { hero_titulo: 'Nuevo título', boton_coleccion: 'Explorar', inventado: 'no' }, secciones: { band: false, comunidad: true, xss: true }, colecciones: [{ id: 'botas', nombre: 'Botas', visible: true }, { id: 'tacones', nombre: 'Tacones' }] };
      const r = await tienda('POST', { body: { recurso: 'contenido', contenido } });
      assert.equal(r.status, 200);
      const pub = (await verCatalogo()).json.contenido;
      assert.deepEqual(pub.textos, { hero_titulo: 'Nuevo título', boton_coleccion: 'Explorar' });
      assert.deepEqual(pub.secciones, { band: false, comunidad: true });
      assert.equal(pub.colecciones.length, 2);
      assert.equal((await tienda('POST', { body: { recurso: 'contenido', contenido: { colecciones: [{ id: 'a', nombre: 'A' }, { id: 'a', nombre: 'B' }] } } })).status, 400);
    });
  });

  describe('pedidos y despacho en el panel', () => {
    it('pagado ≠ despachado: aparece por preparar, se prepara, se despacha y queda registrado', async () => {
      const r = await crear({ items: items(), cliente: CLIENTE_OK });
      const pend = await crear({ items: items(), cliente: CLIENTE_OK });
      await aprobar(r.json.referencia);
      const lista = (await pedidos('GET', { query: { preparacion: 'pendiente' } })).json.pedidos;
      assert.deepEqual(lista.map((p) => p.referencia), [r.json.referencia]); // el no pagado no aparece
      assert.equal(Number(lista[0].envio_centavos), ENVIO * 100);
      assert.equal(lista[0].estado_envio, 'PREPARANDO');
      const id = lista[0].id;
      assert.equal((await pedidos('POST', { body: { id, estado_envio: 'PREPARANDO', preparado: true, nota_despacho: 'Caja lista' } })).status, 200);
      assert.equal((await pedidos('GET', { query: { preparacion: 'pendiente' } })).json.pedidos.length, 0);
      const d = await pedidos('POST', { body: { id, estado_envio: 'EN_CAMINO', transportadora: 'Servientrega', guia: 'SV123456', incidencia: '' } });
      assert.equal(d.json.pedido.estado_envio, 'EN_CAMINO');
      assert.ok(d.json.pedido.enviado_en && d.json.pedido.preparado_en);
      assert.equal(d.json.pedido.guia, 'SV123456');
      assert.deepEqual((await eventos('despacho_actualizado'))[1].detalle, { estado_envio: 'EN_CAMINO', transportadora: 'Servientrega', guia: 'SV123456' });
      // no se puede despachar un pedido sin pago aprobado
      const idp = (await b.pedido(pend.json.referencia)).id;
      assert.equal((await pedidos('POST', { body: { id: idp, estado_envio: 'EN_CAMINO' } })).status, 404);
    });
    it('los eventos solo los lee el administrador', async () => {
      await crear({ items: items(), cliente: CLIENTE_OK });
      assert.equal((await tienda('GET', { query: { recurso: 'eventos' }, token: null })).status, 401);
      assert.ok((await tienda('GET', { query: { recurso: 'eventos' } })).json.eventos.length >= 1);
    });
  });

  describe('cableado de funciones', () => {
    const raiz = path.join(__dirname, '..');
    const FUNCIONES = ['crear-pedido', 'webhook-wompi', 'seguimiento', 'admin-pedidos', 'catalogo', 'admin-tienda'];
    for (const f of FUNCIONES) {
      it(`${f}: existe la lógica, el adaptador de Netlify y el de Vercel, y los tres cargan`, () => {
        for (const rel of [`lib/${f}.js`, `netlify/functions/${f}.js`, `api/${f}.js`]) assert.ok(fs.existsSync(path.join(raiz, rel)), 'falta ' + rel);
        assert.equal(typeof require(path.join(raiz, `netlify/functions/${f}.js`)).handler, 'function');
        assert.equal(typeof require(path.join(raiz, `api/${f}.js`)), 'function');
        assert.ok(fs.readFileSync(path.join(raiz, `netlify/functions/${f}.js`), 'utf8').includes(`lib/${f}`));
        assert.ok(fs.statSync(path.join(raiz, `lib/${f}.js`)).size > 500, 'lib/' + f + '.js parece un adaptador, no la lógica');
      });
    }
    it('netlify.toml redirige /api/* a las funciones', () => {
      const t = fs.readFileSync(path.join(raiz, 'netlify.toml'), 'utf8');
      assert.match(t, /from = "\/api\/\*"/);
      assert.match(t, /to = "\/\.netlify\/functions\/:splat"/);
      assert.match(t, /directory = "netlify\/functions"/);
    });
    it('la función de Netlify responde de punta a punta (catálogo)', async () => {
      const r = await require(path.join(raiz, 'netlify/functions/catalogo.js')).handler({ httpMethod: 'GET', headers: {}, queryStringParameters: {} });
      assert.equal(r.statusCode, 200);
      assert.equal(JSON.parse(r.body).envio.tarifa, ENVIO);
    });
  });
});
