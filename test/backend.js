'use strict';
// Backend de pruebas: imita Supabase (PostgREST) y la API de Wompi.
// Las consultas se ejecutan contra un PostgreSQL REAL (variable TEST_DATABASE_URL), con el
// supabase/schema.sql real y los mismos roles de Supabase (anon, authenticated, service_role).
const { execFile } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const DB_URL = process.env.TEST_DATABASE_URL || '';
const hayDB = !!DB_URL;
const SCHEMA = fs.readFileSync(path.join(__dirname, '../../supabase/schema.sql'), 'utf8');

const ENV_PRUEBA = {
  SUPABASE_URL: 'https://supa.test',
  SUPABASE_SERVICE_KEY: 'sb_secret_prueba',
  WOMPI_PUBLIC_KEY: 'pub_test_abc123',
  WOMPI_INTEGRITY_SECRET: 'test_integrity_secreto',
  WOMPI_EVENTS_SECRET: 'test_events_secreto',
  SITE_URL: 'https://tienda.test',
  ADMIN_TOKEN: 'clave-admin-de-prueba-muy-larga-1234567890',
};

function psql(sql) {
  return new Promise((resolve, reject) => {
    const p = execFile('psql', ['-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1', DB_URL, '-f', '-'], { maxBuffer: 50 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) return reject(Object.assign(new Error(String(stderr || err.message).trim()), { sql }));
      resolve(stdout.trim());
    });
    p.stdin.end(sql);
  });
}

const lit = (v) => {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (typeof v === 'object') return lit(JSON.stringify(v)) + '::jsonb';
  return `'${String(v).replace(/'/g, "''")}'`;
};
const ident = (s) => { if (!/^\w+$/.test(s)) throw new Error('identificador no permitido: ' + s); return s; };
const colExpr = (k) => { const m = /^(\w+)->>(\w+)$/.exec(k); return m ? `${ident(m[1])}->>'${ident(m[2])}'` : ident(k); };

function dondeDe(sp) {
  const conds = [];
  for (const [k, v] of sp) {
    if (['select', 'order', 'limit', 'on_conflict'].includes(k)) continue;
    const e = colExpr(k), i = v.indexOf('.'), op = v.slice(0, i), val = v.slice(i + 1);
    if (op === 'eq') conds.push(`(${e})::text = ${lit(val)}`);
    else if (op === 'neq') conds.push(`(${e})::text <> ${lit(val)}`);
    else if (op === 'is') conds.push(`(${e}) is ${val === 'null' ? 'null' : 'not null'}`);
    else if (op === 'gte') conds.push(`(${e}) >= ${lit(val)}::timestamptz`);
    else if (op === 'in') conds.push(`(${e})::text in (${val.replace(/^\(|\)$/g, '').split(',').map((s) => lit(s.replace(/^"|"$/g, ''))).join(',')})`);
    else throw new Error('operador no soportado: ' + op);
  }
  return conds.length ? ' where ' + conds.join(' and ') : '';
}

const jsonRes = (status, body) => new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

async function iniciar() {
  if (!hayDB) throw new Error('Falta TEST_DATABASE_URL');
  await psql(`
    drop schema if exists public cascade; create schema public;
    do $$ begin
      if not exists (select from pg_roles where rolname = 'anon') then create role anon; end if;
      if not exists (select from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
      if not exists (select from pg_roles where rolname = 'service_role') then create role service_role bypassrls; end if;
    end $$;
    alter role service_role bypassrls;  -- como en Supabase
    grant usage on schema public to anon, authenticated, service_role;
    -- como en Supabase: lo nuevo en public queda abierto a esos roles por defecto
    alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
    alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
  `);
  await psql(SCHEMA);

  const wompi = { txs: new Map(), caido: false };
  const llamadas = [];
  const resend = { enviados: [], falla: false };
  const storage = { bucket: false, objetos: new Map(), cabeceras: [] };

  async function fetchFalso(url, opts = {}) {
    const u = new URL(String(url));
    const method = String(opts.method || 'GET').toUpperCase();
    llamadas.push({ host: u.hostname, path: u.pathname, method });

    if (u.hostname.endsWith('wompi.co')) {
      if (wompi.caido) return jsonRes(503, { error: 'caído' });
      const id = decodeURIComponent(u.pathname.split('/').pop());
      const tx = wompi.txs.get(id);
      return tx ? jsonRes(200, { data: tx }) : jsonRes(404, { error: { type: 'NOT_FOUND_ERROR' } });
    }
    if (u.hostname === 'api.resend.com') {
      if (resend.falla) return jsonRes(500, { message: 'Resend caído' });
      resend.enviados.push({ auth: opts.headers.Authorization, ...JSON.parse(opts.body) });
      return jsonRes(200, { id: 'em_' + resend.enviados.length });
    }
    if (u.hostname !== 'supa.test') throw new Error('fetch inesperado a ' + u.hostname);

    if (u.pathname.startsWith('/storage/v1/')) {
      const sp = u.pathname.slice('/storage/v1/'.length);
      if (sp === 'bucket' && method === 'POST') { storage.bucket = true; return jsonRes(200, { name: 'productos' }); }
      const m = /^object\/productos\/([\w.-]+)$/.exec(sp);
      if (m && method === 'POST') {
        if (!storage.bucket) return jsonRes(404, { error: 'Bucket not found', message: 'Bucket not found', statusCode: '404' });
        storage.objetos.set(m[1], { tipo: opts.headers['Content-Type'], bytes: Buffer.from(opts.body) });
        storage.cabeceras.push(opts.headers);
        return jsonRes(200, { Key: 'productos/' + m[1] });
      }
      return jsonRes(400, { message: 'ruta de storage no simulada' });
    }
    const ruta = u.pathname.replace(/^\/rest\/v1\//, '');
    const body = opts.body ? JSON.parse(opts.body) : undefined;
    const prefer = (opts.headers && opts.headers.Prefer) || '';
    try {
      if (ruta.startsWith('rpc/')) {
        const args = Object.entries(body || {}).map(([k, v]) => `${ident(k)} => ${lit(v)}`).join(', ');
        return jsonRes(200, JSON.parse(await psql(`select to_json(${ident(ruta.slice(4))}(${args}));`)));
      }
      const tabla = ident(ruta);
      const donde = dondeDe(u.searchParams);
      if (method === 'GET') {
        const cols = (u.searchParams.get('select') || '*').split(',').map((c) => (c === '*' ? '*' : ident(c))).join(', ');
        const ord = u.searchParams.get('order');
        const orden = ord ? ` order by ${ident(ord.split('.')[0])} ${/\.desc$/.test(ord) ? 'desc' : 'asc'}` : '';
        const lim = u.searchParams.get('limit') ? ` limit ${parseInt(u.searchParams.get('limit'), 10)}` : '';
        return jsonRes(200, JSON.parse(await psql(`select coalesce(json_agg(t), '[]'::json) from (select ${cols} from ${tabla}${donde}${orden}${lim}) t;`)));
      }
      let cuerpoSql;
      if (method === 'POST') {
        const ks = Object.keys(body);
        cuerpoSql = `insert into ${tabla} (${ks.map(ident).join(', ')}) values (${ks.map((k) => lit(body[k])).join(', ')})`;
        const oc = u.searchParams.get('on_conflict');
        if (oc && prefer.includes('merge-duplicates')) cuerpoSql += ` on conflict (${ident(oc)}) do update set ${ks.filter((k) => k !== oc).map((k) => `${ident(k)} = excluded.${ident(k)}`).join(', ')}`;
        cuerpoSql += ' returning *';
      } else if (method === 'PATCH') {
        cuerpoSql = `update ${tabla} set ${Object.keys(body).map((k) => `${ident(k)} = ${lit(body[k])}`).join(', ')}${donde} returning *`;
      } else if (method === 'DELETE') {
        cuerpoSql = `delete from ${tabla}${donde} returning *`;
      } else throw new Error('método no soportado ' + method);
      const filas = JSON.parse(await psql(`with r as (${cuerpoSql}) select coalesce(json_agg(r), '[]'::json) from r;`));
      return prefer.includes('return=representation') ? jsonRes(method === 'POST' ? 201 : 200, filas) : new Response(null, { status: method === 'POST' ? 201 : 204 });
    } catch (e) {
      return jsonRes(/duplicate key/.test(e.message) ? 409 : 400, { message: e.message });
    }
  }

  // Estado previo para restaurar al terminar
  const fetchOriginal = globalThis.fetch;
  const envOriginal = {};
  for (const k of Object.keys(ENV_PRUEBA).concat(['ALLOWED_ORIGIN', 'WOMPI_VERIFY_API', 'RESEND_API_KEY', 'MAIL_FROM', 'OWNER_EMAIL', 'WA_PHONE'])) { envOriginal[k] = process.env[k]; delete process.env[k]; }
  Object.assign(process.env, ENV_PRUEBA);
  globalThis.fetch = fetchFalso;

  const sembrar = (lista) => psql(lista.map((p) => `insert into productos (id, nombre, precio, stock, visible) values (${lit(p.id)}, ${lit(p.nombre)}, ${p.precio}, ${lit(p.stock || {})}, ${p.visible === false ? 'false' : 'true'});`).join('\n'));
  const filas = async (sql) => JSON.parse(await psql(`select coalesce(json_agg(t), '[]'::json) from (${sql}) t;`));

  return {
    wompi, llamadas, storage, resend, psql, sembrar, filas,
    pedido: async (ref) => (await filas(`select * from pedidos where referencia = ${lit(ref)}`))[0],
    producto: async (id) => (await filas(`select * from productos where id = ${lit(id)}`))[0],
    terminar() {
      globalThis.fetch = fetchOriginal;
      for (const [k, v] of Object.entries(envOriginal)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
    },
  };
}

// Evento de webhook firmado como lo hace Wompi: sha256(valores de las propiedades + timestamp + secreto de eventos)
function eventoWompi({ id, status, reference, monto, metodo = 'CARD', secret = ENV_PRUEBA.WOMPI_EVENTS_SECRET, props, ts = 1700000000, evento = 'transaction.updated' }) {
  const propiedades = props || ['transaction.id', 'transaction.status', 'transaction.amount_in_cents'];
  const data = { transaction: { id, status, reference, amount_in_cents: monto, currency: 'COP', payment_method_type: metodo } };
  const valores = propiedades.map((p) => p.split('.').reduce((a, k) => (a == null ? undefined : a[k]), data));
  const checksum = crypto.createHash('sha256').update(valores.join('') + ts + secret).digest('hex');
  return { event: evento, data, environment: 'test', signature: { properties: propiedades, checksum }, timestamp: ts, sent_at: new Date().toISOString() };
}

const PRODUCTOS_BASE = [
  { id: 'plataforma-luna', nombre: 'Plataforma Luna', precio: 189900, stock: { 36: 3, 37: 2 } },
  { id: 'tacon-aurora', nombre: 'Tacón Aurora', precio: 169900, stock: { 36: 1, 38: 5 } },
  { id: 'oculto', nombre: 'Modelo oculto', precio: 100000, stock: { 36: 5 }, visible: false },
];

const CLIENTE_OK = { nombre: 'Ana Pérez', documento: '1020304050', tel: '3115752334', email: 'ana@correo.com', ciudad: 'Medellín', direccion: 'Calle 10 # 20-30, Medellín', nota: 'Portería' };

module.exports = { hayDB, iniciar, eventoWompi, ENV_PRUEBA, PRODUCTOS_BASE, CLIENTE_OK, psql };
