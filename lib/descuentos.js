'use strict';
// Códigos de descuento (porcentaje sobre los productos; el envío siempre se cobra completo).
// Se guardan en la tabla ajustes (clave 'descuentos'): [{ codigo, pct, activo, anuncio, nota, foto? }].
// "Un uso por correo": se cuentan los pedidos aprobados (y los pendientes de la última hora) con ese código y ese correo.
const db = require('./db');

const RE_CODIGO = /^[A-Z0-9_-]{3,20}$/;
const MAX_CODIGOS = 50;
const MAX_PCT = 90;
const RE_IMG = /^(https:\/\/[^\s"'<>]{4,480}|assets\/[\w./-]{1,200})$/;
const HORA_MS = 60 * 60 * 1000;

const normalizar = (v) => String(v == null ? '' : v).trim().toUpperCase();
const normEmail = (v) => String(v == null ? '' : v).trim().toLowerCase();
const calcular = (subtotal, pct) => Math.floor((Number(subtotal) * Number(pct)) / 100);

// Valida la lista que envía el panel. Devuelve { valor } o { error }.
function validarLista(lista) {
  if (!Array.isArray(lista) || lista.length > MAX_CODIGOS) return { error: `Máximo ${MAX_CODIGOS} códigos` };
  const vistos = new Set(), out = [];
  for (const d of lista) {
    if (!d || typeof d !== 'object') return { error: 'Código inválido' };
    const codigo = normalizar(d.codigo);
    if (!RE_CODIGO.test(codigo)) return { error: 'El código debe tener de 3 a 20 letras, números, guion o guion bajo (sin espacios)' };
    if (vistos.has(codigo)) return { error: 'Hay un código repetido: ' + codigo };
    vistos.add(codigo);
    const pct = Number(d.pct);
    if (!Number.isInteger(pct) || pct < 1 || pct > MAX_PCT) return { error: `El porcentaje de ${codigo} debe ser un número entero entre 1 y ${MAX_PCT}` };
    const foto = typeof d.foto === 'string' ? d.foto.trim() : '';
    if (foto && !RE_IMG.test(foto)) return { error: 'La foto del código ' + codigo + ' no es válida (https://… o assets/…)' };
    out.push({ codigo, pct, activo: d.activo !== false, anuncio: d.anuncio === true, nota: String(d.nota == null ? '' : d.nota).replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 80), ...(foto ? { foto } : {}) });
  }
  return { valor: out };
}

async function lista(c) {
  const v = await db.getAjuste(c, 'descuentos').catch(() => null);
  return Array.isArray(v) ? v : [];
}

// Evalúa un código. email es opcional (en la bolsa aún no se conoce; al crear el pedido sí).
async function evaluar(c, { codigo, subtotal, email }) {
  const cod = normalizar(codigo);
  if (!RE_CODIGO.test(cod)) return { ok: false, error: 'Ese código no es válido' };
  const d = (await lista(c)).find((x) => x && x.codigo === cod && x.activo !== false);
  if (!d) return { ok: false, error: 'Ese código no es válido' };
  const sub = Number(subtotal);
  if (!Number.isInteger(sub) || sub <= 0) return { ok: false, error: 'Tu bolsa está vacía' };
  const e = normEmail(email);
  if (e && await usado(c, cod, e)) return { ok: false, error: 'Ya usaste este código con ese correo' };
  return { ok: true, codigo: cod, pct: d.pct, descuento: calcular(sub, d.pct) };
}

async function usado(c, codigo, emailMin) {
  const filas = await db.pedidosConDescuento(c, codigo, emailMin);
  const corte = Date.now() - HORA_MS;
  return filas.some((f) => f.estado_pago === 'APPROVED' || (f.estado_pago === 'PENDING' && new Date(f.creado_en).getTime() >= corte));
}

// Lo único público: el código anunciado en la tienda (si el panel lo marcó). Nunca se publican los demás.
async function anuncio(c) {
  const d = (await lista(c)).find((x) => x && x.activo !== false && x.anuncio === true);
  return d ? { codigo: d.codigo, pct: d.pct, ...(d.foto ? { foto: d.foto } : {}) } : null;
}

module.exports = { RE_CODIGO, normalizar, normEmail, calcular, validarLista, lista, evaluar, anuncio, MAX_PCT };
