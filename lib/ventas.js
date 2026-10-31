'use strict';
// Pedidos por WhatsApp (los registra Marlon a mano) y Finanzas (resumen de ventas de la tienda + WhatsApp).
// Todo en pesos COP enteros. El total de cada pedido lo calcula el servidor: productos + envío - descuento.
const db = require('./db');
const { txt } = require('./util');

const METODOS = ['Transferencia', 'Nequi', 'Daviplata', 'Efectivo', 'Otro'];
const PAGOS = ['PAGADO', 'PENDIENTE', 'CANCELADO'];
const ENVIOS = ['PREPARANDO', 'EN_CAMINO', 'ENTREGADO', 'DEVUELTO'];
const MAX_PRECIO = 100000000;
const MAX_LINEAS = 20;
const RE_FECHA = /^\d{4}-\d{2}-\d{2}$/;
const RE_TALLA = /^[\w.,-]{1,10}$/;
const RE_TEL = /^[\d +()-]{0,20}$/;
const RE_GUIA = /^[\w .\-/]{0,60}$/;
const RE_MES = /^\d{4}-(0[1-9]|1[0-2])$/;

const esObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
const entero = (v) => (typeof v === 'number' || (typeof v === 'string' && v.trim() !== '')) && Number.isInteger(Number(v)) ? Number(v) : NaN;

// Fecha de hoy en Colombia (UTC-5, sin horario de verano)
const hoyBogota = (ahora = Date.now()) => new Date(ahora - 5 * 3600 * 1000).toISOString().slice(0, 10);
const fechaBogota = (iso) => { const t = Date.parse(iso); return Number.isFinite(t) ? new Date(t - 5 * 3600 * 1000).toISOString().slice(0, 10) : null; };
const fechaValida = (f) => RE_FECHA.test(f) && new Date(f + 'T00:00:00Z').toISOString().slice(0, 10) === f;

// Valida un pedido de WhatsApp. parcial=true (al editar) exige solo lo que llega... aquí siempre se manda el pedido completo.
function validarVenta(b, ahora = Date.now()) {
  if (!esObj(b)) return { error: 'Pedido inválido' };
  const cliente = txt(b.cliente, 80);
  if (!cliente) return { error: 'Escribe el nombre de la clienta' };
  const telefono = txt(b.telefono, 20);
  if (!RE_TEL.test(telefono)) return { error: 'Teléfono inválido (solo números, espacios, + y guiones)' };
  const ciudad = txt(b.ciudad, 60);
  const fecha = b.fecha ? String(b.fecha).trim() : hoyBogota(ahora);
  if (!fechaValida(fecha)) return { error: 'Fecha inválida' };
  if (fecha > hoyBogota(ahora + 24 * 3600 * 1000)) return { error: 'La fecha no puede ser futura' };

  if (!Array.isArray(b.items) || b.items.length < 1 || b.items.length > MAX_LINEAS) return { error: `Agrega entre 1 y ${MAX_LINEAS} productos` };
  const items = [];
  let subtotal = 0;
  for (const i of b.items) {
    if (!esObj(i)) return { error: 'Producto inválido' };
    const nombre = txt(i.nombre, 120);
    if (!nombre) return { error: 'Cada producto necesita nombre' };
    const talla = txt(i.talla, 10);
    if (talla && !RE_TALLA.test(talla)) return { error: `Talla inválida en "${nombre}"` };
    const color = txt(i.color, 40);
    const cant = entero(i.cant), precio = entero(i.precio);
    if (!Number.isInteger(cant) || cant < 1 || cant > 100) return { error: `Cantidad inválida en "${nombre}" (1 a 100)` };
    if (!Number.isInteger(precio) || precio < 1 || precio > MAX_PRECIO) return { error: `Precio inválido en "${nombre}" (pesos enteros mayores a 0)` };
    const it = { nombre, cant, precio };
    if (talla) it.talla = talla;
    if (color) it.color = color;
    items.push(it);
    subtotal += cant * precio;
  }
  const envio = b.envio == null || b.envio === '' ? 0 : entero(b.envio);
  if (!Number.isInteger(envio) || envio < 0 || envio > MAX_PRECIO) return { error: 'Envío inválido (pesos enteros, 0 o más)' };
  const descuento = b.descuento == null || b.descuento === '' ? 0 : entero(b.descuento);
  if (!Number.isInteger(descuento) || descuento < 0 || descuento > subtotal) return { error: 'Descuento inválido (no puede ser mayor que los productos)' };

  const metodo_pago = b.metodo_pago == null || b.metodo_pago === '' ? 'Transferencia' : String(b.metodo_pago);
  if (!METODOS.includes(metodo_pago)) return { error: 'Método de pago inválido' };
  const estado_pago = b.estado_pago == null || b.estado_pago === '' ? 'PAGADO' : String(b.estado_pago);
  if (!PAGOS.includes(estado_pago)) return { error: 'Estado de pago inválido' };
  const estado_envio = b.estado_envio == null || b.estado_envio === '' ? 'PREPARANDO' : String(b.estado_envio);
  if (!ENVIOS.includes(estado_envio)) return { error: 'Estado de envío inválido' };
  const guia = txt(b.guia, 60);
  if (!RE_GUIA.test(guia)) return { error: 'Guía con caracteres no permitidos' };
  const nota = txt(b.nota, 300);

  return { fila: { fecha, cliente, telefono: telefono || null, ciudad: ciudad || null, items, envio, descuento, total: subtotal + envio - descuento, metodo_pago, estado_pago, estado_envio, guia: guia || null, nota: nota || null } };
}

// ---- Finanzas (función pura: recibe filas ya leídas y arma el resumen) ----
const lineasOnline = (items) => (Array.isArray(items) ? items : []).map((i) => ({ nombre: String(i.nombre || ''), talla: i.talla ? String(i.talla) : '', color: i.color ? String(i.color) : '', cant: Number(i.cant) || 0, precio: Number(i.precio) || 0 }));

function ventasDeTienda(pedidos) {
  return (pedidos || []).map((p) => {
    const total = Math.round(Number(p.monto_centavos) / 100);
    const envio = Math.round(Number(p.envio_centavos || 0) / 100);
    const sub = p.subtotal_centavos == null ? total - envio : Math.round(Number(p.subtotal_centavos) / 100);
    const cl = esObj(p.cliente) ? p.cliente : {};
    return { canal: 'Tienda online', fecha: fechaBogota(p.pagado_en || p.creado_en), referencia: p.referencia, cliente: txt(cl.nombre, 80), ciudad: txt(cl.ciudad, 60), items: lineasOnline(p.items), subtotal: sub, envio, descuento: 0, total, metodo: p.metodo || 'Wompi', envio_estado: p.estado_envio };
  }).filter((v) => v.fecha);
}

function ventasDeWhatsapp(filas) {
  return (filas || []).filter((v) => v.estado_pago === 'PAGADO').map((v) => {
    const items = lineasOnline(v.items);
    const sub = items.reduce((t, i) => t + i.cant * i.precio, 0);
    return { canal: 'WhatsApp', fecha: String(v.fecha), referencia: 'WA-' + v.id, cliente: v.cliente, ciudad: v.ciudad || '', items, subtotal: sub, envio: Number(v.envio) || 0, descuento: Number(v.descuento) || 0, total: Number(v.total) || 0, metodo: v.metodo_pago, envio_estado: v.estado_envio };
  });
}

function armarFinanzas(pedidos, ventasWa, mes) {
  const todas = ventasDeTienda(pedidos).concat(ventasDeWhatsapp(ventasWa));
  const meses = {};
  for (const v of todas) {
    const m = v.fecha.slice(0, 7);
    const x = meses[m] || (meses[m] = { mes: m, n: 0, total: 0, online: 0, whatsapp: 0 });
    x.n += 1; x.total += v.total;
    if (v.canal === 'WhatsApp') x.whatsapp += v.total; else x.online += v.total;
  }
  const lista = Object.values(meses).sort((a, b) => (a.mes < b.mes ? 1 : -1));
  const sel = mes && RE_MES.test(mes) ? mes : 'todos';
  const periodo = sel === 'todos' ? todas : todas.filter((v) => v.fecha.slice(0, 7) === sel);
  periodo.sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0));

  const suma = (arr, f) => arr.reduce((t, v) => t + f(v), 0);
  const on = periodo.filter((v) => v.canal !== 'WhatsApp'), wa = periodo.filter((v) => v.canal === 'WhatsApp');
  const total = suma(periodo, (v) => v.total);
  const pares = suma(periodo, (v) => suma(v.items, (i) => i.cant));
  const top = {};
  for (const v of periodo) for (const i of v.items) { const t = top[i.nombre] || (top[i.nombre] = { nombre: i.nombre, cant: 0, total: 0 }); t.cant += i.cant; t.total += i.cant * i.precio; }
  const pendientes = (ventasWa || []).filter((v) => v.estado_pago === 'PENDIENTE' && (sel === 'todos' || String(v.fecha).slice(0, 7) === sel));

  return {
    mes: sel,
    meses: lista,
    resumen: {
      total, n: periodo.length, ticket: periodo.length ? Math.round(total / periodo.length) : 0, pares,
      online: { n: on.length, total: suma(on, (v) => v.total) },
      whatsapp: { n: wa.length, total: suma(wa, (v) => v.total) },
      envios_cobrados: suma(periodo, (v) => v.envio),
      descuentos: suma(periodo, (v) => v.descuento),
      por_cobrar: { n: pendientes.length, total: suma(pendientes, (v) => Number(v.total) || 0) },
    },
    top: Object.values(top).sort((a, b) => b.cant - a.cant || b.total - a.total).slice(0, 5),
    detalle: periodo,
  };
}

// ---- Acciones del panel ----
const sinTabla = (e) => e && (e.status === 404 || /PGRST205|schema cache|does not exist/.test(String(e.message)));
const AVISO_TABLA = 'Falta crear la tabla de pedidos por WhatsApp: ejecuta supabase/migracion-ventas-whatsapp.sql en Supabase (SQL Editor) y vuelve a intentar.';

async function listar(c, { estado, limite }) {
  let v = await db.listarVentasWa(c, Math.min(Math.max(parseInt(limite, 10) || 200, 1), 500));
  v = Array.isArray(v) ? v : [];
  if (estado === 'por_cobrar') v = v.filter((x) => x.estado_pago === 'PENDIENTE');
  else if (estado === 'pagados') v = v.filter((x) => x.estado_pago === 'PAGADO');
  return v;
}

async function finanzas(c, mes) {
  const [pedidos, wa] = await Promise.all([db.pedidosAprobados(c, 5000), db.listarVentasWa(c, 5000).catch((e) => { if (sinTabla(e)) return []; throw e; })]);
  return armarFinanzas(pedidos || [], wa || [], mes);
}

module.exports = { METODOS, PAGOS, ENVIOS, validarVenta, armarFinanzas, listar, finanzas, sinTabla, AVISO_TABLA, hoyBogota };
