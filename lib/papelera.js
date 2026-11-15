'use strict';
// PAPELERA del panel. Cuando algo se reemplaza o se elimina, la versión anterior queda guardada aquí
// (tabla ajustes, clave 'papelera', solo service_role) y se puede restaurar. Lo nuevo reemplaza a lo viejo:
// nunca quedan las dos versiones activas a la vez.
//   Entrada: { id, fecha, tipo, ref, nombre, motivo: 'reemplazado' | 'eliminado', datos }
//   tipo: producto | banners | contenido | vitrina | lookbook | perchero | descuentos | envio | venta_wa | gasto
const crypto = require('crypto');
const db = require('./db');

const MAX = 60;
const AJUSTES = ['banners', 'contenido', 'vitrina', 'lookbook', 'perchero', 'descuentos', 'envio'];
const ETIQUETAS = {
  banners: 'Banners del inicio', contenido: 'Textos y colecciones', vitrina: 'La vitrina', lookbook: 'Lookbook', perchero: 'Orden del perchero', descuentos: 'Códigos de descuento', envio: 'Tarifa de envío',
};

// JSON con llaves ordenadas: dos valores iguales dan el mismo texto sin importar el orden de las llaves.
function estable(v) {
  if (Array.isArray(v)) return '[' + v.map(estable).join(',') + ']';
  if (v && typeof v === 'object') return '{' + Object.keys(v).sort().map((k) => JSON.stringify(k) + ':' + estable(v[k])).join(',') + '}';
  return JSON.stringify(v === undefined ? null : v);
}
const iguales = (a, b) => estable(a) === estable(b);

// Campos del producto que cuentan como "cambio" (actualizado_en no cuenta).
const CAMPOS = ['nombre', 'precio', 'stock', 'descripcion', 'imagen', 'imagenes', 'colores', 'coleccion', 'destacado', 'orden', 'visible'];
const soloCampos = (p) => { const o = {}; for (const k of CAMPOS) o[k] = p[k] === undefined ? null : p[k]; return o; };
const nombreAjuste = (clave, v) => {
  if (clave === 'banners') return `${ETIQUETAS.banners} (${Array.isArray(v) ? v.length : 0})`;
  if (clave === 'descuentos') return `${ETIQUETAS.descuentos} (${Array.isArray(v) ? v.length : 0})`;
  if (clave === 'lookbook' || clave === 'perchero') return `${ETIQUETAS[clave]} (${Array.isArray(v) ? v.length : 0})`;
  if (clave === 'vitrina') return `${ETIQUETAS.vitrina} (${Array.isArray(v) ? v.length : 0})`;
  if (clave === 'envio') return `${ETIQUETAS.envio}: $${Number(v && v.tarifa || 0).toLocaleString('es-CO')}`;
  return ETIQUETAS[clave] || clave;
};

async function leer(c) { const v = await db.getAjuste(c, 'papelera'); return Array.isArray(v) ? v : []; }
async function guardar(c, lista) {
  const filas = await db.setAjuste(c, 'papelera', lista.slice(0, MAX));
  if (!Array.isArray(filas) || !filas.length) throw new Error('La papelera no quedó guardada');
}
const entrada = (e) => ({ id: crypto.randomBytes(6).toString('hex'), fecha: new Date().toISOString(), ...e });
async function archivar(c, e) { const l = await leer(c); l.unshift(entrada(e)); await guardar(c, l); }

// ---- Ganchos: se llaman justo ANTES de guardar lo nuevo ----
async function alGuardarProducto(c, fila) {
  const prev = await db.getProducto(c, fila.id);
  if (prev && !iguales(soloCampos(prev), soloCampos(fila))) await archivar(c, { tipo: 'producto', ref: prev.id, nombre: prev.nombre, motivo: 'reemplazado', datos: prev });
}
async function alGuardarAjuste(c, clave, nuevo) {
  const prev = await db.getAjuste(c, clave);
  if (prev != null && !iguales(prev, nuevo)) await archivar(c, { tipo: clave, ref: clave, nombre: nombreAjuste(clave, prev), motivo: 'reemplazado', datos: prev });
}
const alEliminarProducto = (c, prev) => archivar(c, { tipo: 'producto', ref: prev.id, nombre: prev.nombre, motivo: 'eliminado', datos: prev });
const alEliminarVentaWa = (c, f) => archivar(c, { tipo: 'venta_wa', ref: 'WA-' + f.id, nombre: `Pedido WhatsApp de ${f.cliente || 'cliente'} ($${Number(f.total || 0).toLocaleString('es-CO')})`, motivo: 'eliminado', datos: f });
const alEliminarGasto = (c, f) => archivar(c, { tipo: 'gasto', ref: 'G-' + f.id, nombre: `Gasto ${f.categoria} ($${Number(f.monto || 0).toLocaleString('es-CO')})`, motivo: 'eliminado', datos: f });

// ---- Lo que ve el panel ----
async function listar(c) {
  return (await leer(c)).map(({ id, fecha, tipo, ref, nombre, motivo }) => ({ id, fecha, tipo, ref, nombre, motivo }));
}

// Devuelve la versión guardada. Si lo actual es distinto, lo actual pasa a la papelera (restaurar también se puede deshacer).
async function restaurar(c, id) {
  const lista = await leer(c);
  const i = lista.findIndex((e) => e.id === id);
  if (i < 0) return { error: 'Ese elemento ya no está en la papelera', status: 404 };
  const e = lista[i];
  const resto = lista.filter((_, k) => k !== i);
  const d = e.datos;
  let desplazado = null;
  if (e.tipo === 'producto') {
    const actual = await db.getProducto(c, e.ref);
    if (actual && !iguales(soloCampos(actual), soloCampos(d))) desplazado = { tipo: 'producto', ref: actual.id, nombre: actual.nombre, motivo: 'reemplazado', datos: actual };
    const fila = { id: d.id }; for (const k of CAMPOS) fila[k] = d[k] === undefined ? null : d[k];
    const r = await db.upsertProducto(c, fila);
    if (!Array.isArray(r) || !r.length) throw new Error('El producto no quedó restaurado');
  } else if (AJUSTES.includes(e.tipo)) {
    const actual = await db.getAjuste(c, e.tipo);
    if (actual != null && !iguales(actual, d)) desplazado = { tipo: e.tipo, ref: e.tipo, nombre: nombreAjuste(e.tipo, actual), motivo: 'reemplazado', datos: actual };
    const r = await db.setAjuste(c, e.tipo, d);
    if (!Array.isArray(r) || !r.length) throw new Error('No se pudo restaurar');
  } else if (e.tipo === 'venta_wa' || e.tipo === 'gasto') {
    const { id: _id, creado_en: _c, ...fila } = d; // la base asigna un número nuevo
    const r = e.tipo === 'venta_wa' ? await db.insertarVentaWa(c, fila) : await db.insertarGasto(c, fila);
    if (!Array.isArray(r) || !r.length) throw new Error('No se pudo restaurar');
  } else return { error: 'Tipo desconocido', status: 400 };
  if (desplazado) resto.unshift(entrada(desplazado));
  await guardar(c, resto);
  return { ok: true, tipo: e.tipo, ref: e.ref, nombre: e.nombre };
}
async function borrarDefinitivo(c, id) {
  const lista = await leer(c);
  if (!lista.some((e) => e.id === id)) return { error: 'Ese elemento ya no está en la papelera', status: 404 };
  await guardar(c, lista.filter((e) => e.id !== id));
  return { ok: true };
}
async function vaciar(c) { await guardar(c, []); return { ok: true }; }

module.exports = { listar, restaurar, borrarDefinitivo, vaciar, alGuardarProducto, alGuardarAjuste, alEliminarProducto, alEliminarVentaWa, alEliminarGasto, MAX };
