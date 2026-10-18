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

const COLUMNAS_PUBLICAS = 'subtotal_centavos,envio_centavos,referencia,token,estado_pago,estado_envio,transportadora,guia,monto_centavos,metodo,creado_en,items';
async function buscarPedido(c, columna, valor) {
  if (!['token', 'wompi_tx', 'referencia'].includes(columna)) throw new Error('columna no permitida');
  const f = await rest(c, `pedidos?${columna}=eq.${enc(valor)}&select=${COLUMNAS_PUBLICAS}&limit=1`);
  return Array.isArray(f) && f[0] ? f[0] : null;
}

const COLUMNAS_ADMIN = 'subtotal_centavos,envio_centavos,preparado_en,incidencia,nota_despacho,id,referencia,token,estado_pago,estado_envio,transportadora,guia,monto_centavos,metodo,wompi_tx,items,cliente,consent_wa,alerta,creado_en,pagado_en,enviado_en,entregado_en';
function listarPedidos(c, { pago, envio, limite, porPreparar }) {
  let q = `pedidos?select=${COLUMNAS_ADMIN}&order=creado_en.desc&limit=${limite}`;
  if (pago) q += `&estado_pago=eq.${enc(pago)}`;
  if (envio) q += `&estado_envio=eq.${enc(envio)}`;
  if (porPreparar) q += '&preparado_en=is.null';
  return rest(c, q);
}

// Solo se puede cambiar el envío de pedidos con pago aprobado.
const actualizarEnvio = (c, id, parche) =>
  rest(c, `pedidos?id=eq.${enc(String(id))}&estado_pago=eq.APPROVED`, { method: 'PATCH', body: parche, prefer: 'return=representation' });

module.exports = {
  getEnvio, getAjuste, setAjuste, listarCatalogoPublico, listarProductosAdmin, upsertProducto, registrarEvento, listarEventos, buscarPorClave,
  getProductos, insertarPedido, contarRecientes, aprobarPedido, marcarFallido, marcarAlerta,
  alertaPostAprobacion, buscarPedido, listarPedidos, actualizarEnvio,
};
