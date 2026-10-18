'use strict';
// Panel interno de pedidos. Protegido con ADMIN_TOKEN (cabecera Authorization: Bearer <token>).
//   GET  /api/admin-pedidos?pago=APPROVED&envio=PREPARANDO&limite=50   -> lista de pedidos
//   POST /api/admin-pedidos  { id, estado_envio, transportadora, guia } -> actualiza el envío
const { cfg } = require('./config');
const db = require('./db');
const { guard, json } = require('./http');
const { esAdmin } = require('./auth');
const { parseBody, txt } = require('./util');

const ESTADOS_ENVIO = ['PREPARANDO', 'EN_CAMINO', 'ENTREGADO', 'DEVUELTO'];
const ESTADOS_PAGO = ['PENDING', 'APPROVED', 'DECLINED', 'VOIDED', 'ERROR'];

async function admin(req) {
  const c = cfg('admin');
  if (!esAdmin(req, c)) return json(401, { error: 'No autorizado' });

  if (req.method === 'GET') {
    const q = req.query;
    const pago = typeof q.pago === 'string' && ESTADOS_PAGO.includes(q.pago) ? q.pago : '';
    const envio = typeof q.envio === 'string' && ESTADOS_ENVIO.includes(q.envio) ? q.envio : '';
    const limite = Math.min(Math.max(parseInt(q.limite, 10) || 50, 1), 200);
    const porPreparar = q.preparacion === 'pendiente'; // pagados que aún no se han preparado
    return json(200, { pedidos: await db.listarPedidos(c, { pago: porPreparar ? 'APPROVED' : pago, envio: porPreparar ? 'PREPARANDO' : envio, limite, porPreparar }) });
  }

  if (req.method === 'POST') {
    const b = parseBody(req.body);
    if (!b) return json(400, { error: 'Solicitud inválida' });
    const id = Number(b.id);
    if (!Number.isInteger(id) || id < 1) return json(400, { error: 'Pedido inválido' });
    if (!ESTADOS_ENVIO.includes(b.estado_envio)) return json(400, { error: 'Estado de envío inválido' });
    const transportadora = txt(b.transportadora, 40);
    const guia = txt(b.guia, 60);
    if (!/^[\w .\-/]*$/.test(transportadora) || !/^[\w .\-/]*$/.test(guia)) return json(400, { error: 'Transportadora o guía con caracteres no permitidos' });

    const ahora = new Date().toISOString();
    const parche = { estado_envio: b.estado_envio, transportadora: transportadora || null, guia: guia || null };
    if (b.estado_envio === 'EN_CAMINO') parche.enviado_en = ahora;
    if (b.estado_envio === 'ENTREGADO') parche.entregado_en = ahora;
    // Preparación y novedades (opcionales; no se inventan: solo lo que escribe quien administra)
    if (typeof b.preparado === 'boolean') parche.preparado_en = b.preparado ? ahora : null;
    if (b.incidencia !== undefined) parche.incidencia = txt(b.incidencia, 200) || null;
    if (b.nota_despacho !== undefined) parche.nota_despacho = txt(b.nota_despacho, 300) || null;
    const filas = await db.actualizarEnvio(c, id, parche);
    if (!Array.isArray(filas) || !filas.length) return json(404, { error: 'Pedido no encontrado o con pago no aprobado' });
    await db.registrarEvento(c, 'despacho_actualizado', filas[0].referencia, { estado_envio: b.estado_envio, transportadora: transportadora || null, guia: guia || null });
    return json(200, { ok: true, pedido: filas[0] });
  }

  return json(405, { error: 'Método no permitido' }, { Allow: 'GET, POST' });
}

module.exports = guard(admin, { errorMsg: 'Error interno' });
