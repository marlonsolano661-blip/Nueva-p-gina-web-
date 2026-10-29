'use strict';
// Prueba de punta a punta en Chromium: tienda real (index.html) + centro de control (admin-tienda.html)
// + funciones reales (lib/*) + PostgreSQL real. Supabase y Wompi se simulan; no hay pagos ni red externa.
// Ejecutar:  TEST_DATABASE_URL=postgresql://… NODE_PATH=$(npm root -g) node test/tienda.e2e.js
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { hayDB, iniciar, eventoWompi, PRODUCTOS_BASE, ENV_PRUEBA } = require('./helpers/backend');

const RAIZ = path.join(__dirname, '..');
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8' };
const FUNCIONES = ['crear-pedido', 'webhook-wompi', 'seguimiento', 'admin-pedidos', 'catalogo', 'admin-tienda'];
const handlers = Object.fromEntries(FUNCIONES.map((f) => [f, require(path.join(RAIZ, 'lib', f + '.js'))]));
if (!hayDB) { console.log('Falta TEST_DATABASE_URL'); process.exit(1); }

const servidor = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  const m = /^\/api\/([\w-]+)$/.exec(u.pathname);
  if (m && handlers[m[1]]) {
    const chunks = []; for await (const c of req) chunks.push(c);
    const out = await handlers[m[1]]({ method: req.method, headers: req.headers, query: Object.fromEntries(u.searchParams), body: Buffer.concat(chunks).toString('utf8') || undefined });
    res.writeHead(out.status, { 'Content-Type': 'application/json', ...(out.headers || {}) });
    return res.end(out.json === undefined ? '' : JSON.stringify(out.json));
  }
  const f = path.join(RAIZ, u.pathname === '/' ? 'index.html' : u.pathname);
  if (!f.startsWith(RAIZ) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TIPOS[path.extname(f)] || 'text/plain' }); res.end(fs.readFileSync(f));
});

let n = 0;
async function prueba(nombre, fn) {
  try { await fn(); n++; console.log('  ok  ', nombre); } catch (e) { console.log('  FALLA', nombre, '\n      ', e.message.split('\n').slice(0, 6).join('\n       ')); process.exitCode = 1; }
}

(async () => {
  const b = await iniciar();
  await b.sembrar(PRODUCTOS_BASE.filter((p) => p.visible !== false));
  await b.psql(`update productos set colores = '[{"n":"Negro","h":"#111111"}]' where id = 'plataforma-luna'`);
  await new Promise((r) => servidor.listen(0, r));
  const base = 'http://localhost:' + servidor.address().port;
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
  const ctx = await browser.newContext();
  await ctx.route((u) => !String(u).startsWith(base), (r) => r.abort()); // nada sale a internet
  const errores = [];

  const admin = await ctx.newPage();
  admin.on('pageerror', (e) => errores.push('admin: ' + e.message));
  const tienda = await ctx.newPage();
  tienda.on('pageerror', (e) => errores.push('tienda: ' + e.message));
  const msg = () => admin.locator('#msg').innerText();
  const esperarMsg = (re) => admin.waitForFunction((s) => new RegExp(s).test(document.querySelector('#msg').textContent), re.source, { timeout: 8000 });

  const ir = async (t) => { if (await admin.locator('#inicio').isVisible()) await admin.click('#inicio'); await admin.click(`#tabs [data-t="${t}"]`); };
  console.log('admin-tienda.html');
  await prueba('clave incorrecta: no entra y el servidor la rechaza', async () => {
    await admin.goto(base + '/admin-tienda.html');
    await admin.fill('#token', 'clave-incorrecta-muy-larga-0000000000');
    await admin.click('#entrar');
    await esperarMsg(/incorrecta|vencida/);
    assert.equal(await admin.locator('#app').isHidden(), true);
  });
  await prueba('con la clave correcta entra y lista los productos del servidor', async () => {
    await admin.fill('#token', ENV_PRUEBA.ADMIN_TOKEN);
    await admin.click('#entrar');
    await admin.waitForSelector('#tabs [data-t="productos"]');
    await ir('productos');
    await admin.waitForSelector('#p-productos .pcard');
    assert.match(await admin.locator('#p-productos').innerText(), /Plataforma Luna/);
  });
  await prueba('crea un producto desde el panel y queda guardado en la base', async () => {
    await admin.click('text=Nuevo producto');
    await admin.fill('#f-nombre', 'Bota Nueva'); await admin.fill('#f-precio', '300000');
    await admin.fill('#f-desc', 'Bota creada desde el panel');
    await admin.setInputFiles('#f-file', { name: 'foto.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64') });
    await esperarMsg(/Fotos listas/);
    assert.equal(await admin.locator('#form-prod .foto img').count(), 1);
    await admin.click('button.pal[data-n="Negro"]'); assert.equal(await admin.locator('#f-cols input.chex').inputValue(), '#111111'); assert.equal(await admin.locator('#f-cols input.cnom').inputValue(), 'Negro');
    await admin.fill('[data-t="36"]', '2'); await admin.check('#f-dest');
    await admin.click('#form-prod button[type=submit]');
    await esperarMsg(/guardado en el servidor/);
    const f = (await b.filas("select * from productos where id='bota-nueva'"))[0];
    assert.deepEqual([Number(f.precio), f.stock['36'], f.destacado, f.colores[0].n], [300000, 2, true, 'Negro']);
    assert.equal(f.imagenes.length, 1); assert.equal(f.imagen, f.imagenes[0]);
    assert.match(f.imagen, /^https:\/\/supa\.test\/storage\/v1\/object\/public\/productos\/[\w.-]+\.jpg$/);
    assert.equal(b.storage.objetos.size, 1); // la foto realmente se subió al almacenamiento
  });
  await prueba('inventario: cambiar los pares por talla desde el panel se guarda y se ve en la tienda', async () => {
    await ir('inventario');
    const tarjeta = admin.locator('#p-inventario .icard', { hasText: 'Bota Nueva' });
    await tarjeta.waitFor();
    await tarjeta.locator('[data-t="37"]').fill('9');
    await tarjeta.locator('button').click();
    await esperarMsg(/Inventario de "Bota Nueva" guardado/);
    const f = (await b.filas("select stock, precio, imagenes from productos where id='bota-nueva'"))[0];
    assert.deepEqual([f.stock['36'], f.stock['37'], Number(f.precio), f.imagenes.length], [2, 9, 300000, 1]); // no se pierde nada más
  });
  await prueba('datos inválidos: el servidor responde error y el panel NO dice guardado', async () => {
    await ir('productos'); await admin.waitForSelector('#p-productos .pcard');
    await admin.click('text=Nuevo producto');
    await admin.fill('#f-nombre', 'Malo'); await admin.fill('#f-precio', '0');
    await admin.evaluate(() => { document.querySelector('#form-prod form').noValidate = true; });
    await admin.click('#form-prod button[type=submit]');
    await esperarMsg(/Precio inválido/);
    assert.equal((await b.filas("select id from productos where id='malo'")).length, 0);
  });

  console.log('index.html (tienda real)');
  await prueba('la tienda lee el catálogo del servidor y muestra el producto nuevo', async () => {
    await tienda.goto(base + '/index.html');
    await tienda.waitForFunction(() => window.MF_API_OK === true);
    await tienda.evaluate(() => nav('col'));
    await tienda.waitForSelector('article.pc[data-id="bota-nueva"]');
    assert.match(await tienda.locator('article.pc[data-id="bota-nueva"]').innerText(), /bota nueva[\s\S]*300\.000/i);
    assert.equal(await tienda.locator('article.pc[data-id^="d"]').count(), 0); // no se mezcla con el DEMO
  });
  await prueba('agrega al carrito, ve envío $17.500 y total = subtotal + envío; el checkout recibe ese total', async () => {
    await tienda.click('article.pc[data-id="bota-nueva"] .im');
    await tienda.click('.tl .sz >> nth=0');
    await tienda.click('.cl .sw >> nth=0');
    await tienda.click('[data-n="add"] >> nth=0');
    await tienda.evaluate(() => nav('out', null, 'online'));
    await tienda.fill('#f-nombre', 'Ana Pérez'); await tienda.fill('#f-doc', '1020304050'); await tienda.fill('#f-email', 'ana@correo.com'); await tienda.fill('#f-tel', '3115752334'); await tienda.fill('#f-ciudad', 'Cali'); await tienda.fill('#f-dir', 'Calle 1 # 2-3');
    const resumen = await tienda.locator('.sum').first().innerText();
    assert.match(resumen, /Subtotal[\s\S]*300\.000/); assert.match(resumen, /Envío[\s\S]*17\.500/); assert.match(resumen, /Total a pagar[\s\S]*317\.500/);
    await tienda.evaluate(() => { window.MF_REDIRECT = (u) => { window.__r = u; }; });
    await tienda.click('[data-n="topay"]');
    await tienda.waitForFunction(() => window.__r);
    const u = new URL(await tienda.evaluate(() => window.__r));
    assert.equal(u.origin + u.pathname, 'https://checkout.wompi.co/p/');
    assert.equal(u.searchParams.get('amount-in-cents'), '31750000');
    const p = (await b.filas("select * from pedidos order by id desc limit 1"))[0];
    assert.deepEqual([Number(p.subtotal_centavos), Number(p.envio_centavos), Number(p.monto_centavos), p.items[0].color], [30000000, 1750000, 31750000, 'Negro']);
    assert.equal(u.searchParams.get('reference'), p.referencia);
  });
  await prueba('reintentar el pago con el mismo carrito no crea otro pedido', async () => {
    // la clienta vuelve atrás desde Wompi (bfcache) y paga otra vez
    await tienda.evaluate(() => { window.__r = null; window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })); });
    await tienda.click('[data-n="topay"]');
    await tienda.waitForFunction(() => window.__r);
    assert.equal((await b.filas('select id from pedidos')).length, 1);
  });

  console.log('administración → tienda');
  await prueba('cambiar la tarifa de envío en el panel se refleja en la tienda; el pedido anterior conserva $17.500', async () => {
    await ir('envio');
    await admin.fill('#f-tarifa', '20000'); await admin.click('#p-envio button[type=submit]');
    await esperarMsg(/Tarifa guardada: \$20\.000/);
    await tienda.evaluate(() => localStorage.removeItem('mf_cat_v1')); await tienda.reload(); await tienda.waitForFunction(() => window.MF_API_OK === true);
    assert.equal(await tienda.evaluate(() => window.MF_ENVIO), 20000);
    assert.equal(Number((await b.filas('select envio_centavos from pedidos'))[0].envio_centavos), 1750000);
  });
  await prueba('textos, secciones y colecciones del panel se ven en la tienda', async () => {
    await ir('contenido');
    await admin.waitForSelector('[data-x="hero_titulo"]');
    await admin.fill('[data-x="hero_titulo"]', 'Colección de otoño'); await admin.uncheck('#s-band');
    await admin.click('#p-contenido button[type=submit]');
    await esperarMsg(/Contenido guardado/);
    await ir('colecciones');
    await admin.fill('#f-ncol', 'Botas'); await admin.click('text=+ Crear colección');
    await esperarMsg(/creada/);
    await admin.locator('#p-colecciones .icard', { hasText: 'Botas' }).locator('text=Elegir productos').click();
    await admin.locator('#edit-col label', { hasText: 'Bota Nueva' }).locator('input').check();
    await admin.click('#edit-col button[type=submit]');
    await esperarMsg(/Colección "Botas" guardada/);
    assert.equal((await b.filas("select coleccion from productos where id='bota-nueva'"))[0].coleccion, 'botas');
    assert.match(await admin.locator('#p-colecciones').innerText(), /1 producto/);
    await tienda.evaluate(() => localStorage.removeItem('mf_cat_v1')); await tienda.reload(); await tienda.waitForFunction(() => window.MF_API_OK === true);
    assert.match(await tienda.locator('.rh h1').innerText(), /colección de otoño/i);
    // Portada propia: se sube desde el panel, se guarda en la colección y la tienda la usa
    await ir('colecciones');
    const [fc] = await Promise.all([admin.waitForEvent('filechooser'), admin.locator('#p-colecciones .icard', { hasText: 'Botas' }).locator('text=Subir portada').click()]);
    await fc.setFiles({ name: 'p.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==', 'base64') });
    await esperarMsg(/Portada de "Botas" guardada/);
    assert.match(JSON.stringify((await b.filas("select valor from ajustes where clave='contenido'")).map((r) => r.valor)), /portada/);
    await tienda.evaluate(() => localStorage.removeItem('mf_cat_v1')); await tienda.reload(); await tienda.waitForFunction(() => window.MF_API_OK === true);
    await tienda.evaluate(() => { nav('home'); });
    // (la imagen de prueba no existe en la red, por eso se comprueba el dato que usa la tarjeta)
    assert.match(await tienda.evaluate(() => window.MF_CONTENIDO.colecciones.find((k) => k.id === 'botas').portada), /storage\/v1\/object\/public\/productos\//);
    // Crear colección con mensaje y portada desde el mismo formulario; el mensaje se puede editar después
    await ir('colecciones'); await admin.waitForSelector('#p-colecciones .icard'); await admin.waitForTimeout(1000);
    await admin.fill('#f-ncol', 'Sandalias'); await admin.fill('#f-mcol', 'Ligeras y con estilo');
    await admin.setInputFiles('#f-pcol', { name: 'p.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==', 'base64') });
    await admin.click('text=+ Crear colección'); await esperarMsg(/creada/);
    await tienda.evaluate(() => localStorage.removeItem('mf_cat_v1')); await tienda.reload(); await tienda.waitForFunction(() => window.MF_API_OK === true);
    const sand = await tienda.evaluate(() => window.MF_CONTENIDO.colecciones.find((k) => k.id === 'sandalias'));
    assert.equal(sand.mensaje, 'Ligeras y con estilo'); assert.match(sand.portada, /storage\/v1\/object\/public\/productos\//);
    await admin.fill('[data-mensaje="sandalias"]', 'Para cada ocasión');
    await admin.locator('#p-colecciones .icard', { hasText: 'Sandalias' }).locator('text=Guardar mensaje').click(); await esperarMsg(/Mensaje de "Sandalias" guardado/);
    assert.equal(await tienda.evaluate(() => fetch('/api/catalogo').then((r) => r.json()).then((j) => j.contenido.colecciones.find((k) => k.id === 'sandalias').mensaje)), 'Para cada ocasión');
    // Elegir productos muestra una miniatura junto a cada nombre
    await admin.locator('#p-colecciones .icard', { hasText: 'Sandalias' }).locator('text=Elegir productos').click();
    assert.ok(await admin.locator('#edit-col label.sel .mini').count() >= 1);
    await admin.click('#edit-col button:has-text("Cancelar")');
    // Foto de la portada principal: se sube desde el panel y la tienda la usa
    await ir('contenido');
    const [fh] = await Promise.all([admin.waitForEvent('filechooser'), admin.locator('#p-contenido button', { hasText: 'Subir foto' }).click()]);
    await fh.setFiles({ name: 'h.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==', 'base64') });
    await esperarMsg(/Foto de portada guardada/);
    assert.match(JSON.stringify((await b.filas("select valor from ajustes where clave='contenido'")).map((r) => r.valor)), /hero_foto/);
    await tienda.evaluate(() => localStorage.removeItem('mf_cat_v1')); await tienda.reload(); await tienda.waitForFunction(() => window.MF_API_OK === true);
    assert.match(await tienda.locator('.rh-ph img').getAttribute('src'), /storage\/v1\/object\/public\/productos\//);
    // Inicio: portada principal + portadas de colección apiladas, sin carrusel
    assert.equal(await tienda.locator('.cs, .cv2').count(), 0);
    assert.equal(await tienda.locator('.rcov').count(), 1);
    assert.equal(await tienda.locator('.rcov h2').innerText(), 'Botas');
    assert.equal(await tienda.locator('.wm').isVisible(), true); // el nombre de la marca se ve junto al logo también en las colecciones (catalogo-vista.js)
    await tienda.evaluate(() => { Q = 'zzz'; });
    // El botón de la portada abre exactamente esa colección y deja el enlace #botas
    await tienda.click('.rcov [data-ver="botas"]');
    assert.equal(await tienda.locator('.rcp h1').innerText(), 'Botas');
    assert.equal(await tienda.locator('#gr .pc').count(), 1);
    assert.equal(await tienda.inputValue('#q'), '');
    assert.equal(await tienda.evaluate(() => location.hash), '#botas');
    await tienda.goBack();
    assert.equal(await tienda.locator('#rh').count(), 1);
    // Enlace directo
    await tienda.goto(tienda.url().split('#')[0] + '#botas'); await tienda.waitForFunction(() => window.MF_API_OK === true);
    await tienda.waitForSelector('.rcp h1');
    assert.equal(await tienda.locator('.rcp h1').innerText(), 'Botas');
    // Producto desde la colección y filtro "Todo"
    await tienda.click('#gr .pc');
    assert.match(await tienda.locator('.pd h1').innerText(), /Bota Nueva/);
    await tienda.evaluate(() => nav('col'));
    await tienda.click('.rchips [data-cf=""]');
    assert.equal(await tienda.locator('article.pc').count(), 3);
  });
  await prueba('eliminar una colección no borra los productos: quedan sin colección', async () => {
    admin.once('dialog', (d) => d.accept());
    await ir('colecciones');
    await admin.locator('#p-colecciones .icard', { hasText: 'Botas' }).locator('text=Eliminar').click();
    await esperarMsg(/Colección eliminada/);
    const f = (await b.filas("select coleccion from productos where id='bota-nueva'"))[0];
    assert.equal(f.coleccion || '', '');
    assert.equal((await b.filas("select id from productos where id='bota-nueva'")).length, 1);
    await tienda.evaluate(() => localStorage.removeItem('mf_cat_v1')); await tienda.reload(); await tienda.waitForFunction(() => window.MF_API_OK === true);
    await tienda.evaluate(() => nav('col'));
    assert.equal(await tienda.locator('[data-cf="botas"]').count(), 0);
  });
  await prueba('ocultar el producto en el panel lo retira de la tienda', async () => {
    await ir('productos'); await admin.waitForSelector('#p-productos .pcard');
    await admin.locator('#p-productos .pcard', { hasText: 'Bota Nueva' }).locator('button').click();
    await admin.uncheck('#f-vis'); await admin.click('#form-prod button[type=submit]'); await esperarMsg(/guardado en el servidor/);
    await tienda.evaluate(() => localStorage.removeItem('mf_cat_v1')); await tienda.reload(); await tienda.waitForFunction(() => window.MF_API_OK === true);
    await tienda.evaluate(() => nav('col'));
    assert.equal(await tienda.locator('article.pc[data-id="bota-nueva"]').count(), 0);
  });

  console.log('pedidos y despacho');
  await prueba('un pedido pagado aparece por preparar con su envío aplicado; se registra el despacho', async () => {
    const p = (await b.filas('select * from pedidos order by id limit 1'))[0];
    b.wompi.txs.set('tx-e2e', { id: 'tx-e2e', status: 'APPROVED', reference: p.referencia, amount_in_cents: Number(p.monto_centavos), currency: 'COP', payment_method_type: 'CARD' });
    const r = await handlers['webhook-wompi']({ method: 'POST', headers: {}, query: {}, body: eventoWompi({ id: 'tx-e2e', status: 'APPROVED', reference: p.referencia, monto: Number(p.monto_centavos) }) });
    assert.equal(r.json.resultado, 'APROBADO');
    await ir('pedidos');
    await admin.waitForSelector('.pedido');
    const t = await admin.locator('.pedido').first().innerText();
    assert.match(t, /Pagado/); assert.match(t, /Envío aplicado[\s\S]*17\.500/); assert.match(t, /Total cobrado[\s\S]*317\.500/);
    const card = admin.locator('.pedido').first();
    await card.locator('input[type=checkbox]').check();
    await card.locator('select').selectOption('EN_CAMINO');
    await card.locator('input[placeholder="Transportadora"]').fill('Servientrega'); await card.locator('input[placeholder="N.º de guía"]').fill('SV998877');
    await card.getByText('Guardar despacho').click();
    await esperarMsg(/Despacho guardado/);
    const f = (await b.filas('select * from pedidos order by id limit 1'))[0];
    assert.deepEqual([f.estado_envio, f.guia, !!f.preparado_en, !!f.enviado_en], ['EN_CAMINO', 'SV998877', true, true]);
  });
  await prueba('el registro muestra los eventos reales', async () => {
    await ir('registro');
    await admin.waitForSelector('#p-registro table');
    const t = await admin.locator('#p-registro').innerText();
    for (const e of ['pedido_creado', 'pago_aprobado', 'envio_actualizado', 'producto_guardado', 'despacho_actualizado', 'contenido_actualizado']) assert.match(t, new RegExp(e));
  });
  await prueba('sin errores de JavaScript en ninguna página', async () => { assert.deepEqual(errores, []); });

  await browser.close(); servidor.close(); b.terminar();
  console.log(`\n${n} pruebas e2e de la tienda pasaron${process.exitCode ? ' (HAY FALLAS)' : ''}`);
})().catch((e) => { console.error(e); process.exit(1); });
