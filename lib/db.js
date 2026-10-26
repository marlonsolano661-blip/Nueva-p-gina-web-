'use strict';
// Acceso a Supabase (PostgREST) con la service key. Solo se usa desde el servidor.

const enc = encodeURIComponent;

function cabeceras(c, extra) {
  const h = { apikey: c.key, 'Content-Type': 'application/json', ...(extra || {}) };
  // Las llaves antiguas (service_role) son JWT y van también en Authorization.
  // Las nuevas (sb_secret_...) NO son JWT y solo se envían en apikey.
  if (c.key.startsWith('eyJ')) h.Authorization = 'Bearer ' + c.key;
  return h;
}

async function rest(c, ruta, { method = 'GET', body, prefer } = {}) {
  const r = await fetch(`${c.db}/rest/v1/${ruta}`, {
    method,
    headers: cabeceras(c, prefer ? { Prefer: prefer } : {}),
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(8000),
  });
  if (!r.ok) {
    const t = await r.text().catch(() => '');
    const e = new Error(`Supabase ${method} ${ruta.split('?')[0]} -> ${r.status} ${t.slice(0, 200)}`);
    e.status = r.status;
    throw e;
  }
  if (r.status === 204) return null;
  const t = await r.text();
  return t ? JSON.parse(t) : null;
}

const getProductos = (c, ids) =>
  rest(c, `productos?select=id,nombre,precio,stock,colores&visible=eq.true&id=in.(${ids.map((i) => enc('"' + i + '"')).join(',')})`);

// Tarifa de envío (pesos COP enteros). Única fuente: tabla ajustes, clave 'envio'. Si falta, se falla (no se inventa).
async function getEnvio(c) {
  const f = await rest(c, 'ajustes?clave=eq.envio&select=valor&limit=1');
  const t = f && f[0] && f[0].valor && f[0].valor.tarifa;
  if (!Number.isInteger(t) || t < 0) throw new Error('Tarifa de envío no configurada en ajustes');
  return t;
}
async function getAjuste(c, clave) {
  const f = await rest(c, `ajustes?clave=eq.${enc(clave)}&select=valor&limit=1`);
  return f && f[0] ? f[0].valor : null;
}
const setAjuste = (c, clave, valor) =>
  rest(c, 'ajustes?on_conflict=clave', { method: 'POST', body: { clave, valor, actualizado_en: new Date().toISOString() }, prefer: 'resolution=merge-duplicates,return=representation' });

const COL_CATALOGO = 'id,nombre,precio,stock,descripcion,imagen,imagenes,colores,coleccion,destacado,orden,visible';
const listarCatalogoPublico = (c) => rest(c, `productos?select=${COL_CATALOGO}&visible=eq.true&order=orden.asc`);
const listarProductosAdmin = (c) => rest(c, `productos?select=${COL_CATALOGO},actualizado_en&order=orden.asc`);
const upsertProducto = (c, fila) =>
  rest(c, 'productos?on_conflict=id', { method: 'POST', body: { ...fila, actualizado_en: new Date().toISOString() }, prefer: 'resolution=merge-duplicates,return=representation' });

// Fotos de productos: bucket público 'productos' en Supabase Storage (se crea solo la primera vez).
const BUCKET = 'productos';
async function storage(c, ruta, init) {
  return fetch(`${c.db}/storage/v1/${ruta}`, { ...init, signal: AbortSignal.timeout(15000) });
}
async function subirFoto(c, nombre, buf, tipo) {
  const subir = () => storage(c, `object/${BUCKET}/${nombre}`, { method: 'POST', headers: cabeceras(c, { 'Content-Type': tipo, 'x-upsert': 'false', 'cache-control': 'max-age=31536000' }), body: buf });
  let r = await subir();
  if (!r.ok && (r.status === 404 || r.status === 400)) {
    const t = await r.text().catch(() => '');
    if (!/bucket/i.test(t)) throw new Error(`Storage subir -> ${r.status} ${t.slice(0, 200)}`);
    const cr = await storage(c, 'bucket', { method: 'POST', headers: cabeceras(c), body: JSON.stringify({ id: BUCKET, name: BUCKET, public: true }) });
    if (!cr.ok && cr.status !== 409) throw new Error(`Storage crear bucket -> ${cr.status} ${(await cr.text().catch(() => '')).slice(0, 200)}`);
    r = await subir();
  }
  if (!r.ok) throw new Error(`Storage subir -> ${r.status} ${(await r.text().catch(() => '')).slice(0, 200)}`);
  return `${c.db}/storage/v1/object/public/${BUCKET}/${nombre}`;
}

// Registro de eventos: nunca rompe la operación principal, pero tampoco finge éxito (devuelve false si falla).
async function registrarEvento(c, tipo, referencia, detalle) {
  try {
    await rest(c, 'eventos', { method: 'POST', body: { tipo, referencia: referencia || null, detalle: detalle || {} }, prefer: 'return=minimal' });
    return true;
  } catch (e) {
    console.error('[evento no guardado]', tipo, e.message);
    return false;
  }
}
const eventosPorTipo = (c, tipos, limite) => rest(c, `eventos?tipo=in.(${tipos.map(enc).join(',')})&select=id,tipo,referencia,detalle,creado_en&order=creado_en.desc&limit=${limite}`);
const listarEventos = (c, limite) => rest(c, `eventos?select=id,tipo,referencia,detalle,creado_en&order=creado_en.desc&limit=${limite}`);

// Pedido ya creado con la misma clave de idempotencia (doble clic / reintento de red)
async function buscarPorClave(c, clave) {
  const f = await rest(c, `pedidos?meta->>clave=eq.${enc(clave)}&select=referencia,estado_pago,monto_centavos,subtotal_centavos,envio_centavos,cliente&limit=1`);
  return Array.isArray(f) && f[0] ? f[0] : null;
}

const insertarPedido = (c, fila) => rest(c, 'pedidos', { method: 'POST', body: fila, prefer: 'return=minimal' });

async function contarRecientes(c, ip, desdeISO) {
  const f = await rest(c, `pedidos?select=id&meta->>ip=eq.${enc(ip)}&creado_en=gte.${enc(desdeISO)}&limit=50`);
  return Array.isArray(f) ? f.length : 0;
}

// Devuelve: APROBADO | YA_APROBADO | NO_ENCONTRADO | MONTO_DISTINTO
const aprobarPedido = (c, { ref, tx, monto, metodo }) =>
  rest(c, 'rpc/aprobar_pedido', { method: 'POST', body: { p_ref: ref, p_tx: tx, p_monto: monto, p_metodo: metodo || null } });

// No pisa un pedido ya aprobado (un intento fallido viejo puede llegar tarde).
const marcarFallido = (c, ref, estado, tx) =>
  rest(c, `pedidos?referencia=eq.${enc(ref)}&estado_pago=neq.APPROVED`, { method: 'PATCH', body: { estado_pago: estado, wompi_tx: tx }, prefer: 'return=minimal' });

const marcarAlerta = (c, ref, alerta) =>
  rest(c, `pedidos?referencia=eq.${enc(ref)}`, { method: 'PATCH', body: { alerta: String(alerta).slice(0, 300) }, prefer: 'return=minimal' });

// Pago aprobado que luego fue anulado: se marca para revisión manual (reembolso/stock).
const alertaPostAprobacion = (c, ref, tx, alerta) =>
  rest(c, `pedidos?referencia=eq.${enc(ref)}&estado_pago=eq.APPROVED&wompi_tx=eq.${enc(tx)}`, { method: 'PATCH', body: { alerta: String(alerta).slice(0, 300) }, prefer: 'return=minimal' });

// Si todavía no se ejecutó la migración de link_rastreo en Supabase, se reintenta sin esa columna
// (la tienda y el panel siguen funcionando; solo falta el link hasta correr el SQL).
const sinLink = (cols) => cols.replace(',link_rastreo', '');
async function conRespaldoLink(c, armar) {
  try { return await rest(c, armar(true)); } catch (e) {
    if (e && e.status === 400 && /link_rastreo/.test(String(e.message))) return rest(c, armar(false));
    throw e;
  }
}
const COLUMNAS_PUBLICAS = 'subtotal_centavos,envio_centavos,referencia,token,estado_pago,estado_envio,transportadora,guia,link_rastreo,monto_centavos,metodo,creado_en,items,cliente';
async function buscarPedido(c, columna, valor) {
  if (!['token', 'wompi_tx', 'referencia'].includes(columna)) throw new Error('columna no permitida');
  const f = await conRespaldoLink(c, (con) => `pedidos?${columna}=eq.${enc(valor)}&select=${con ? COLUMNAS_PUBLICAS : sinLink(COLUMNAS_PUBLICAS)}&limit=1`);
  return Array.isArray(f) && f[0] ? f[0] : null;
}

const COLUMNAS_ADMIN = 'subtotal_centavos,envio_centavos,preparado_en,incidencia,nota_despacho,id,referencia,token,estado_pago,estado_envio,transportadora,guia,link_rastreo,monto_centavos,metodo,wompi_tx,items,cliente,consent_wa,alerta,creado_en,pagado_en,enviado_en,entregado_en';
function listarPedidos(c, { pago, envio, limite, porPreparar }) {
  let filtros = '';
  if (pago) filtros += `&estado_pago=eq.${enc(pago)}`;
  if (envio) filtros += `&estado_envio=eq.${enc(envio)}`;
  if (porPreparar) filtros += '&preparado_en=is.null';
  return conRespaldoLink(c, (con) => `pedidos?select=${con ? COLUMNAS_ADMIN : sinLink(COLUMNAS_ADMIN)}&order=creado_en.desc&limit=${limite}${filtros}`);
}

// Solo se puede cambiar el envío de pedidos con pago aprobado.
const actualizarEnvio = (c, id, parche) =>
  rest(c, `pedidos?id=eq.${enc(String(id))}&estado_pago=eq.APPROVED`, { method: 'PATCH', body: parche, prefer: 'return=representation' });

// ---- Avisos por correo: lectura del pedido y marca de "ya enviado" (columna notificado) ----
const COLUMNAS_AVISO = 'referencia,token,estado_pago,estado_envio,transportadora,guia,link_rastreo,monto_centavos,subtotal_centavos,envio_centavos,metodo,items,cliente,notificado';
async function pedidoParaAviso(c, referencia) {
  const f = await conRespaldoLink(c, (con) => `pedidos?referencia=eq.${enc(referencia)}&select=${con ? COLUMNAS_AVISO : sinLink(COLUMNAS_AVISO)}&limit=1`);
  return Array.isArray(f) && f[0] ? f[0] : null;
}
// Reclama el aviso de forma atómica: solo una llamada gana (la fila se actualiza únicamente si la clave aún no existe).
async function reclamarAviso(c, referencia, clave) {
  const f = await rest(c, `pedidos?referencia=eq.${enc(referencia)}&select=notificado&limit=1`);
  if (!f || !f[0]) return false;
  const nuevo = { ...(f[0].notificado || {}), [clave]: new Date().toISOString() };
  const r = await rest(c, `pedidos?referencia=eq.${enc(referencia)}&notificado->>${clave}=is.null`, { method: 'PATCH', body: { notificado: nuevo }, prefer: 'return=representation' });
  return Array.isArray(r) && r.length > 0;
}
async function liberarAviso(c, referencia, clave) {
  const f = await rest(c, `pedidos?referencia=eq.${enc(referencia)}&select=notificado&limit=1`);
  if (!f || !f[0]) return;
  const n = { ...(f[0].notificado || {}) }; delete n[clave];
  await rest(c, `pedidos?referencia=eq.${enc(referencia)}`, { method: 'PATCH', body: { notificado: n }, prefer: 'return=minimal' });
}

// Datos mínimos de un pedido por id (para reenviar el correo de envío sin tocar su estado).
async function pedidoPorId(c, id) {
  const f = await rest(c, `pedidos?id=eq.${enc(String(id))}&select=referencia,estado_pago,estado_envio,transportadora,guia,link_rastreo&limit=1`);
  return Array.isArray(f) && f[0] ? f[0] : null;
}

// Pedidos que ya usaron un código con un correo (para "un uso por correo").
async function pedidosConDescuento(c, codigo, emailMin) {
  const f = await rest(c, `pedidos?meta->>descuento_codigo=eq.${enc(codigo)}&meta->>descuento_email=eq.${enc(emailMin)}&estado_pago=in.(APPROVED,PENDING)&select=referencia,estado_pago,creado_en&limit=20`);
  return Array.isArray(f) ? f : [];
}

module.exports = {
  pedidosConDescuento, pedidoPorId, getEnvio, getAjuste, setAjuste, listarCatalogoPublico, listarProductosAdmin, upsertProducto, subirFoto, registrarEvento, listarEventos, eventosPorTipo, buscarPorClave,
  getProductos, insertarPedido, contarRecientes, aprobarPedido, marcarFallido, marcarAlerta,
  alertaPostAprobacion, buscarPedido, listarPedidos, actualizarEnvio, pedidoParaAviso, reclamarAviso, liberarAviso,
};
