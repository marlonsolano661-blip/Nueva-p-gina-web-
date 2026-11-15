'use strict';
// Lookbook (looks con productos) y Perchero (orden manual del catálogo): panel → servidor → catálogo público.
const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { hayDB, iniciar, PRODUCTOS_BASE, ENV_PRUEBA } = require('./helpers/backend');
const adminTienda = require('../lib/admin-tienda');
const catalogo = require('../lib/catalogo');

const H = { Authorization: 'Bearer ' + ENV_PRUEBA.ADMIN_TOKEN };
const post = (body, headers = H) => adminTienda({ method: 'POST', headers, query: {}, body });
const get = (recurso) => adminTienda({ method: 'GET', headers: H, query: { recurso } });
const pub = async () => (await catalogo({ method: 'GET', headers: {}, query: {} })).json;
const FOTO = 'https://ejemplo.supabase.co/storage/v1/object/public/fotos/look1.jpg';

describe('lookbook y perchero', { skip: !hayDB && 'Falta TEST_DATABASE_URL' }, () => {
  let b;
  beforeEach(async () => {
    b = await iniciar(); await b.sembrar(PRODUCTOS_BASE);
    for (const f of ['migracion-ventas-whatsapp.sql', 'migracion-gastos.sql']) await b.psql(fs.readFileSync(path.join(__dirname, '../supabase', f), 'utf8'));
  });
  afterEach(() => b.terminar());

  it('exige la clave del panel', async () => {
    assert.equal((await post({ recurso: 'lookbook', lookbook: [] }, {})).status, 401);
    assert.equal((await post({ recurso: 'perchero', perchero: [] }, {})).status, 401);
  });

  it('valida: cada look necesita foto https y no más de 8 productos', async () => {
    assert.equal((await post({ recurso: 'lookbook', lookbook: [{ titulo: 'x', foto: '' }] })).status, 400);
    assert.equal((await post({ recurso: 'lookbook', lookbook: [{ foto: 'javascript:alert(1)' }] })).status, 400);
    assert.equal((await post({ recurso: 'lookbook', lookbook: [{ foto: FOTO, productos: Array.from({ length: 9 }, (_, i) => 'p' + i) }] })).status, 400);
    assert.equal((await post({ recurso: 'perchero', perchero: 'no' })).status, 400);
  });

  it('un look guardado sale en el catálogo público solo con productos que existen; el oculto no sale', async () => {
    const id = PRODUCTOS_BASE[0].id;
    const r = await post({ recurso: 'lookbook', lookbook: [{ titulo: 'Noche', foto: FOTO, productos: [id, 'no-existe'], visible: true }, { titulo: 'Oculto', foto: FOTO, productos: [], visible: false }] });
    assert.equal(r.status, 200);
    assert.ok(r.json.lookbook[0].id, 'el servidor asigna id');
    const lb = (await pub()).contenido.lookbook;
    assert.equal(lb.length, 1);
    assert.deepEqual([lb[0].titulo, lb[0].productos], ['Noche', [id]]);
  });

  it('el perchero ordena el catálogo público y la versión anterior va a la papelera', async () => {
    const ids = (await pub()).productos.map((p) => p.id);
    assert.ok(ids.length >= 2);
    const invertido = ids.slice().reverse();
    assert.equal((await post({ recurso: 'perchero', perchero: invertido })).status, 200);
    assert.deepEqual((await pub()).productos.map((p) => p.id), invertido);
    assert.equal((await post({ recurso: 'perchero', perchero: ids })).status, 200);
    assert.deepEqual((await pub()).productos.map((p) => p.id), ids);
    const pap = (await get('papelera')).json.papelera;
    assert.ok(pap.some((x) => x.tipo === 'perchero' && x.motivo === 'reemplazado'));
  });
});
