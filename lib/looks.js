'use strict';
// Comunidad Marlon: fotos que envían las clientas ("Comparte tus MF"), aprobación en el panel y publicación.
//  - La clienta envía la foto (POST /api/look). Queda PENDIENTE: la foto se guarda en el almacenamiento y la solicitud en el registro (eventos).
//  - La dueña la revisa en el panel (pestaña Comunidad): aprobar (se publica), rechazar o quitar una ya publicada.
//  - Lo publicado vive en ajustes ('looks') y la tienda lo lee de /api/catalogo (contenido.looks).
const crypto = require('crypto');
const db = require('./db');
const { txt } = require('./util');

const MAX_PUBLICOS = 24;
const MAX_FOTO = 2 * 1024 * 1024;
const RE_IMG = /^https:\/\/[^\s"'<>]{4,480}$/;
const RE_ID = /^[a-f0-9]{16}$/;
const RE_IG = /^@?[A-Za-z0-9._]{1,30}$/;

const limpio = (v, n) => txt(v, n).replace(/[<>]/g, '');

// Valida lo que envía la clienta. Devuelve { fila, buf } o { error }.
function validarEnvio(b) {
  if (!b || typeof b !== 'object') return { error: 'Solicitud inválida' };
  if (b.web) return { error: 'Solicitud inválida' }; // trampa para robots (campo oculto)
  if (b.autoriza !== true) return { error: 'Debes autorizar la publicación de tu foto' };
  const nombre = limpio(b.nombre, 60);
  if (!nombre) return { error: 'Escribe tu nombre' };
  const mensaje = limpio(b.mensaje, 200);
  let ig = limpio(b.instagram, 31);
  if (ig && !RE_IG.test(ig)) return { error: 'Tu Instagram no es válido (ejemplo: @usuario)' };
  if (ig && ig[0] !== '@') ig = '@' + ig;
  const datos = String(b.foto || '').replace(/^data:[^,]*,/, '');
  if (!datos || !/^[A-Za-z0-9+/=\s]+$/.test(datos)) return { error: 'Foto inválida' };
  const buf = Buffer.from(datos, 'base64');
  if (!buf.length) return { error: 'Foto inválida' };
  if (buf.length > MAX_FOTO) return { error: 'La foto pesa demasiado' };
  if (!(buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff)) return { error: 'Solo se aceptan fotos JPG' };
  return { fila: { nombre, mensaje, ig }, buf };
}

const nuevoId = () => crypto.randomBytes(8).toString('hex');

// Guarda la foto y deja la solicitud pendiente.
async function recibir(c, v) {
  const id = nuevoId();
  const img = await db.subirFoto(c, `look-${id}.jpg`, v.buf, 'image/jpeg');
  const ok = await db.registrarEvento(c, 'look_enviado', id, { id, nombre: v.fila.nombre, mensaje: v.fila.mensaje, ig: v.fila.ig, img });
  if (!ok) throw new Error('La solicitud no quedó registrada');
  return id;
}

async function publicados(c) {
  const v = await db.getAjuste(c, 'looks').catch(() => null);
  return Array.isArray(v) ? v.filter((x) => x && RE_ID.test(String(x.id)) && RE_IMG.test(String(x.img))) : [];
}

// Versión pública (sin id ni datos internos).
const paraTienda = (lista) => lista.slice(0, MAX_PUBLICOS).map((x) => ({ img: x.img, n: x.n, t: x.t || '', ig: x.ig || '' }));

async function pendientes(c) {
  const ev = await db.eventosPorTipo(c, ['look_enviado', 'look_aprobado', 'look_rechazado'], 300);
  const decididos = new Set((ev || []).filter((e) => e.tipo !== 'look_enviado').map((e) => e.referencia));
  return (ev || [])
    .filter((e) => e.tipo === 'look_enviado' && e.detalle && RE_ID.test(String(e.referencia)) && !decididos.has(e.referencia))
    .map((e) => ({ id: e.referencia, n: e.detalle.nombre || '', t: e.detalle.mensaje || '', ig: e.detalle.ig || '', img: e.detalle.img || '', fecha: e.creado_en }));
}

async function estado(c) {
  const [p, a] = await Promise.all([pendientes(c), publicados(c)]);
  return { pendientes: p, publicados: a };
}

// accion: aprobar | rechazar | quitar. Para aprobar se pueden corregir nombre, mensaje e Instagram.
async function decidir(c, b) {
  if (!b || typeof b !== 'object') return { error: 'Solicitud inválida' };
  const id = String(b.id || '');
  if (!RE_ID.test(id)) return { error: 'Identificador inválido' };
  const accion = b.accion;
  if (accion === 'quitar') {
    const lista = await publicados(c);
    if (!lista.some((x) => x.id === id)) return { error: 'Esa foto ya no está publicada' };
    const filas = await db.setAjuste(c, 'looks', lista.filter((x) => x.id !== id));
    if (!Array.isArray(filas) || !filas.length) throw new Error('No se pudo quitar la foto');
    await db.registrarEvento(c, 'look_quitado', id, {});
    return { ok: true };
  }
  const pend = (await pendientes(c)).find((x) => x.id === id);
  if (!pend) return { error: 'Esa solicitud ya fue revisada' };
  if (accion === 'rechazar') {
    await db.registrarEvento(c, 'look_rechazado', id, {});
    return { ok: true };
  }
  if (accion !== 'aprobar') return { error: 'Acción inválida' };
  const lista = await publicados(c);
  if (lista.length >= MAX_PUBLICOS) return { error: `Ya hay ${MAX_PUBLICOS} fotos publicadas: quita alguna antes de aprobar otra` };
  if (!RE_IMG.test(pend.img)) return { error: 'La foto de esta solicitud no es válida' };
  const n = limpio(b.n != null ? b.n : pend.n, 60);
  if (!n) return { error: 'El nombre no puede quedar vacío' };
  let ig = limpio(b.ig != null ? b.ig : pend.ig, 31);
  if (ig && !RE_IG.test(ig)) return { error: 'El Instagram no es válido' };
  if (ig && ig[0] !== '@') ig = '@' + ig;
  const nuevo = { id, img: pend.img, n, t: limpio(b.t != null ? b.t : pend.t, 200), ig };
  const filas = await db.setAjuste(c, 'looks', [nuevo, ...lista]);
  if (!Array.isArray(filas) || !filas.length) throw new Error('No se pudo publicar la foto');
  await db.registrarEvento(c, 'look_aprobado', id, {});
  return { ok: true };
}

module.exports = { validarEnvio, recibir, publicados, paraTienda, pendientes, estado, decidir, MAX_PUBLICOS };
