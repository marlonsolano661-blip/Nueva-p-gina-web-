'use strict';
// Correos de la tienda con Resend: (1) confirmación de compra cuando Wompi aprueba el pago,
// (2) aviso de envío con la guía cuando el pedido pasa a "En camino".
//
// Reglas:
//  - Un correo fallido NUNCA rompe el pago ni el panel: avisar() no lanza, devuelve el resultado.
//  - No se envía dos veces lo mismo: cada aviso se "reclama" en pedidos.notificado (función SQL atómica).
//  - Todo sale de los datos guardados en el pedido; no se inventan fechas ni valores.
//  - Si falta RESEND_API_KEY o MAIL_FROM, no se envía nada (resultado 'omitido') y la tienda sigue igual.
const db = require('./db');

const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
const cop = (n) => '$' + Math.round(Number(n) || 0).toLocaleString('es-CO');
const pesosDeCentavos = (c) => (Number(c) || 0) / 100;
const METODOS = { CARD: 'Tarjeta', NEQUI: 'Nequi', PSE: 'PSE', BANCOLOMBIA_TRANSFER: 'Bancolombia', BANCOLOMBIA_COLLECT: 'Bancolombia', BANCOLOMBIA_QR: 'Bancolombia QR' };

function config() {
  const e = process.env;
  const key = String(e.RESEND_API_KEY || '').trim();
  const from = String(e.MAIL_FROM || '').trim();
  if (!key || !from) return null;
  return {
    key, from,
    owner: RE_EMAIL.test(String(e.OWNER_EMAIL || '').trim()) ? String(e.OWNER_EMAIL).trim() : '',
    wa: String(e.WA_PHONE || '3115752334').replace(/\D/g, ''),
    site: String(e.SITE_URL || '').trim().replace(/\/+$/, ''),
  };
}

// ---------- Diseño (blanco y negro, como la tienda) ----------
const marco = (cuerpo) => `<!doctype html><html lang="es"><body style="margin:0;background:#f3f3f1;font-family:Helvetica,Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f3f1"><tr><td align="center" style="padding:32px 12px">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff">
<tr><td align="center" style="padding:34px 24px 10px;font-family:Georgia,'Times New Roman',serif;font-size:26px;letter-spacing:8px;color:#0a0a0a">MF·COL</td></tr>
${cuerpo}
<tr><td align="center" style="background:#0a0a0a;padding:20px;font-size:10px;letter-spacing:4px;text-transform:uppercase;color:#bdbdb8">© Marlon Footwear</td></tr>
</table></td></tr></table></body></html>`;

const etiqueta = (t) => `<span style="font-size:10px;letter-spacing:3px;text-transform:uppercase;color:#767672">${t}</span>`;

function filasProductos(items) {
  return (items || []).map((i) => `
    <tr><td style="padding:14px 0;border-bottom:1px solid #e4e4e0;font-size:15px;color:#0a0a0a">${esc(i.nombre)}<br><span style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#767672">Talla ${esc(i.talla)}${i.color ? ' · ' + esc(i.color) : ''} · x${esc(i.cant)}</span></td>
    <td align="right" style="padding:14px 0;border-bottom:1px solid #e4e4e0;font-size:15px;color:#0a0a0a">${cop((Number(i.precio) || 0) * (Number(i.cant) || 0))}</td></tr>`).join('');
}

function boton(url, texto) {
  return `<table cellpadding="0" cellspacing="0" style="margin:0 auto"><tr><td align="center" style="background:#0a0a0a"><a href="${esc(url)}" style="display:inline-block;padding:15px 30px;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#ffffff;text-decoration:none">${esc(texto)}</a></td></tr></table>`;
}

function direccion(p) {
  const c = p.cliente || {};
  return `${esc(c.nombre)}<br>${esc(c.direccion)}${c.ciudad && !String(c.direccion || '').includes(c.ciudad) ? ', ' + esc(c.ciudad) : ''}<br>${esc(c.tel)}`;
}

function enlacePedido(E, p) {
  return E.site && p.token ? `${E.site}/gracias.html?t=${encodeURIComponent(p.token)}` : '';
}

function correoPago(E, p) {
  const c = p.cliente || {};
  const primero = esc(String(c.nombre || '').trim().split(/\s+/)[0] || '');
  const link = enlacePedido(E, p);
  const envio = pesosDeCentavos(p.envio_centavos), sub = pesosDeCentavos(p.subtotal_centavos);
  const wa = E.wa ? `<p style="margin:22px 0 0;font-size:13px;color:#767672">¿Dudas? Escríbenos por <a href="https://wa.me/${esc(E.wa)}" style="color:#0a0a0a">WhatsApp</a>.</p>` : '';
  const html = marco(`
<tr><td align="center" style="padding:6px 28px 0;font-size:11px;letter-spacing:5px;text-transform:uppercase;color:#767672">Pago recibido</td></tr>
<tr><td align="center" style="padding:16px 28px 0;font-family:Georgia,'Times New Roman',serif;font-size:36px;line-height:1.1;color:#0a0a0a">Gracias${primero ? ', <i>' + primero + '</i>' : ''}</td></tr>
<tr><td align="center" style="padding:14px 36px 0;font-size:14px;line-height:1.7;color:#767672">Recibimos tu pago y ya estamos preparando tu pedido. Cuando lo despachemos te enviaremos la guía de seguimiento por correo.</td></tr>
<tr><td style="padding:26px 36px 0"><table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #0a0a0a"><tr><td style="padding:16px 18px">${etiqueta('Pedido')}<br><span style="font-family:Georgia,serif;font-size:22px;letter-spacing:1px;color:#0a0a0a">${esc(p.referencia)}</span></td></tr></table></td></tr>
<tr><td style="padding:22px 36px 0"><table width="100%" cellpadding="0" cellspacing="0">${filasProductos(p.items)}
<tr><td style="padding:12px 0 4px;font-size:14px;color:#767672">Productos</td><td align="right" style="padding:12px 0 4px;font-size:14px;color:#0a0a0a">${cop(sub)}</td></tr>
<tr><td style="padding:4px 0;font-size:14px;color:#767672">Envío</td><td align="right" style="padding:4px 0;font-size:14px;color:#0a0a0a">${cop(envio)}</td></tr>
<tr><td style="padding:12px 0 0;font-size:17px;color:#0a0a0a;border-top:1px solid #0a0a0a">Total pagado</td><td align="right" style="padding:12px 0 0;font-size:17px;color:#0a0a0a;border-top:1px solid #0a0a0a">${cop(pesosDeCentavos(p.monto_centavos))}</td></tr></table>
<p style="margin:10px 0 0;font-size:12px;color:#767672">Medio de pago: ${esc(METODOS[p.metodo] || p.metodo || 'En línea')}</p></td></tr>
<tr><td style="padding:22px 36px 0;font-size:13px;line-height:1.7;color:#767672">${etiqueta('Enviamos a')}<br>${direccion(p)}</td></tr>
${link ? `<tr><td align="center" style="padding:26px 36px 0">${boton(link, 'Ver mi pedido')}</td></tr>` : ''}
<tr><td align="center" style="padding:6px 36px 34px">${wa}</td></tr>`);
  const texto = `Gracias${primero ? ', ' + primero : ''}. Recibimos tu pago del pedido ${p.referencia}.\n\n` +
    (p.items || []).map((i) => `- ${i.nombre} · talla ${i.talla}${i.color ? ' · ' + i.color : ''} x${i.cant}: ${cop((Number(i.precio) || 0) * (Number(i.cant) || 0))}`).join('\n') +
    `\n\nProductos: ${cop(sub)}\nEnvío: ${cop(envio)}\nTotal pagado: ${cop(pesosDeCentavos(p.monto_centavos))}\n` + (link ? `\nVer tu pedido: ${link}\n` : '') + '\nMarlon Footwear';
  return { subject: `Recibimos tu pago · pedido ${p.referencia}`, html, text: texto };
}

function correoEnvio(E, p) {
  const c = p.cliente || {};
  const primero = esc(String(c.nombre || '').trim().split(/\s+/)[0] || '');
  const link = enlacePedido(E, p);
  const rastreo = p.link_rastreo && /^https:\/\//i.test(p.link_rastreo) ? p.link_rastreo : '';
  const fila = (k, v) => (v ? `<tr><td style="padding:8px 0;font-size:13px;color:#767672">${k}</td><td align="right" style="padding:8px 0;font-size:14px;color:#0a0a0a">${esc(v)}</td></tr>` : '');
  const html = marco(`
<tr><td align="center" style="padding:6px 28px 0;font-size:11px;letter-spacing:5px;text-transform:uppercase;color:#767672">Pedido enviado</td></tr>
<tr><td align="center" style="padding:16px 28px 0;font-family:Georgia,'Times New Roman',serif;font-size:36px;line-height:1.1;color:#0a0a0a">Tu pedido va <i>en camino</i></td></tr>
<tr><td align="center" style="padding:14px 36px 0;font-size:14px;line-height:1.7;color:#767672">${primero ? primero + ', t' : 'T'}u pedido ${esc(p.referencia)} ya salió. Con estos datos puedes seguirlo.</td></tr>
<tr><td style="padding:24px 36px 0"><table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #0a0a0a;border-bottom:1px solid #e4e4e0">${fila('Transportadora', p.transportadora)}${fila('Número de guía', p.guia)}${fila('Pedido', p.referencia)}</table></td></tr>
${rastreo ? `<tr><td align="center" style="padding:26px 36px 0">${boton(rastreo, 'Rastrear pedido')}</td></tr>` : ''}
<tr><td style="padding:22px 36px 0;font-size:13px;line-height:1.7;color:#767672">${etiqueta('Enviamos a')}<br>${direccion(p)}</td></tr>
${link ? `<tr><td align="center" style="padding:22px 36px 0;font-size:13px"><a href="${esc(link)}" style="color:#0a0a0a">Ver el estado de mi pedido</a></td></tr>` : ''}
<tr><td style="padding:0 0 34px"></td></tr>`);
  const texto = `Tu pedido ${p.referencia} va en camino.\n` + (p.transportadora ? `Transportadora: ${p.transportadora}\n` : '') + (p.guia ? `Guía: ${p.guia}\n` : '') + (rastreo ? `Rastrear: ${rastreo}\n` : '') + (link ? `Estado de tu pedido: ${link}\n` : '') + '\nMarlon Footwear';
  return { subject: `Tu pedido ${p.referencia} va en camino`, html, text: texto };
}

function correoDueno(p) {
  const c = p.cliente || {};
  const html = `<div style="font-family:Helvetica,Arial,sans-serif;font-size:14px;color:#0a0a0a;line-height:1.7">
<h2 style="font-family:Georgia,serif;font-weight:400;margin:0 0 8px">Nuevo pedido pagado ${esc(p.referencia)}</h2>
<p style="margin:0 0 14px"><b>Total: ${cop(pesosDeCentavos(p.monto_centavos))}</b> · ${esc(METODOS[p.metodo] || p.metodo || 'En línea')}</p>
<table cellpadding="0" cellspacing="0" width="100%">${filasProductos(p.items)}</table>
<p style="margin:16px 0 0"><b>Clienta</b><br>${esc(c.nombre)}<br>${esc(c.email)}<br>WhatsApp: ${esc(c.tel)}<br>${esc(c.direccion)}${c.ciudad ? ', ' + esc(c.ciudad) : ''}${c.nota ? '<br>Indicaciones: ' + esc(c.nota) : ''}</p></div>`;
  return { subject: `Nuevo pedido pagado ${p.referencia} · ${cop(pesosDeCentavos(p.monto_centavos))}`, html };
}

async function enviarResend(E, payload) {
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + E.key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: E.from, ...payload }),
    signal: AbortSignal.timeout(8000),
  });
  if (!r.ok) throw new Error('Resend ' + r.status + ' ' + (await r.text().catch(() => '')).slice(0, 160));
}

// tipo: 'pago' | 'envio'.  opciones.forzar: reenvío manual desde el panel (no usa ni cambia la marca de "ya enviado").
// Devuelve: 'enviado' | 'omitido' | 'ya_enviado' | 'no_aplica' | 'sin_correo' | 'no_encontrado' | 'fallo'
async function avisar(c, referencia, tipo, opciones) {
  const forzar = !!(opciones && opciones.forzar);
  let reclamado = false, clave = tipo === 'pago' ? 'pago_correo' : 'envio_correo';
  try {
    const E = config();
    if (!E) return 'omitido';
    const p = await db.pedidoParaAviso(c, referencia);
    if (!p) return 'no_encontrado';
    if (p.estado_pago !== 'APPROVED') return 'no_aplica';
    const para = String((p.cliente && p.cliente.email) || '').trim();
    if (!RE_EMAIL.test(para)) return 'sin_correo';
    if (!forzar) {
      if (!(await db.reclamarAviso(c, referencia, clave))) return 'ya_enviado';
      reclamado = true;
    }
    const m = tipo === 'pago' ? correoPago(E, p) : correoEnvio(E, p);
    await enviarResend(E, { to: [para], reply_to: E.owner || undefined, subject: m.subject, html: m.html, text: m.text });
    if (tipo === 'pago' && E.owner && !forzar) {
      const d = correoDueno(p); // la copia a la dueña no bloquea el resultado
      await enviarResend(E, { to: [E.owner], reply_to: para, subject: d.subject, html: d.html }).catch((e) => console.error('[correo] copia a la dueña falló:', e.message));
    }
    await db.registrarEvento(c, 'correo_enviado', referencia, { tipo, forzado: forzar }).catch(() => {});
    return 'enviado';
  } catch (e) {
    console.error('[correo] no se pudo enviar', tipo, referencia, '-', e.message);
    if (reclamado) await db.liberarAviso(c, referencia, clave).catch(() => {});
    await db.registrarEvento(c, 'correo_fallo', referencia, { tipo, error: String(e.message).slice(0, 200) }).catch(() => {});
    return 'fallo';
  }
}

module.exports = { avisar, config, correoPago, correoEnvio };
