'use strict';
// POST /api/bienvenida  { email }  (público)
// Entrega el código anunciado SOLO después de recibir un correo válido, lo registra en eventos
// (tipo 'suscripcion_bienvenida') y lo envía por correo si Resend está configurado.
// Si el correo ya usó ese código, lo dice. Si falla el envío, igual se muestra el código en pantalla.
const { cfg } = require('./config');
const db = require('./db');
const { guard, json } = require('./http');
const { parseBody, clientIp } = require('./util');
const descuentos = require('./descuentos');
const correo = require('./correo');

const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const LIMITE = 5, VENTANA_MS = 10 * 60 * 1000;
const intentos = new Map(); // freno por IP (memoria de la instancia)
const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));

function frenado(ip) {
  const ahora = Date.now();
  const l = (intentos.get(ip) || []).filter((t) => ahora - t < VENTANA_MS);
  l.push(ahora); intentos.set(ip, l);
  if (intentos.size > 5000) for (const [k, v] of intentos) if (!v.some((t) => ahora - t < VENTANA_MS)) intentos.delete(k);
  return l.length > LIMITE;
}

function mensaje(E, d) {
  const sitio = E.site ? `<p style="margin:22px 0 0"><a href="${esc(E.site)}" style="display:inline-block;background:#0a0a0a;color:#ffffff;text-decoration:none;padding:14px 28px;font-size:13px;letter-spacing:2px;text-transform:uppercase">Ir a la tienda</a></p>` : '';
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#ebe7e0;font-family:Helvetica,Arial,sans-serif"><table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:28px 10px"><table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff"><tr><td align="center" bgcolor="#0a0a0a" style="background:#0a0a0a;padding:30px 24px;font-family:Georgia,serif;font-size:24px;letter-spacing:8px;color:#ffffff">MARLON FOOTWEAR</td></tr><tr><td height="3" bgcolor="#b08d57" style="height:3px;line-height:3px;font-size:0">&nbsp;</td></tr><tr><td align="center" style="padding:38px 32px"><div style="font-family:Georgia,serif;font-size:32px;line-height:1.15;color:#0a0a0a">${d.pct} % menos en tu primer par</div><p style="margin:14px 0 22px;font-size:14px;line-height:1.7;color:#77736b">Gracias por dejarnos tu correo. Escribe este código al pagar:</p><div style="display:inline-block;border:1.5px dashed #0a0a0a;padding:14px 26px;font-size:24px;letter-spacing:4px;color:#0a0a0a">${esc(d.codigo)}</div><p style="margin:18px 0 0;font-size:12px;line-height:1.7;color:#77736b">Un uso por correo. El descuento aplica a los productos y el envío se cobra completo.</p>${sitio}</td></tr></table></td></tr></table></body></html>`;
  const text = `${d.pct} % menos en tu primer par en MARLON FOOTWEAR.\nTu código: ${d.codigo}\nUn uso por correo. El descuento aplica a los productos y el envío se cobra completo.${E.site ? '\n' + E.site : ''}`;
  return { subject: `Tu código de bienvenida: ${d.pct} % de descuento`, html, text };
}

async function enviar(E, para, m) {
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + E.key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: E.from, to: [para], reply_to: E.owner || undefined, subject: m.subject, html: m.html, text: m.text }),
    signal: AbortSignal.timeout(8000),
  });
  if (!r.ok) throw new Error('Resend ' + r.status);
}

async function bienvenida(req) {
  if (req.method !== 'POST') return json(405, { error: 'Método no permitido' }, { Allow: 'POST' });
  const c = cfg('catalogo');
  const b = parseBody(req.body);
  if (!b) return json(400, { error: 'Solicitud inválida' });
  if (frenado(clientIp(req.headers) || 'sin-ip')) return json(429, { error: 'Demasiados intentos. Espera unos minutos.' });
  const email = descuentos.normEmail(b.email);
  if (!RE_EMAIL.test(email) || email.length > 120) return json(400, { error: 'Escribe un correo válido' });

  const a = await descuentos.anuncio(c);
  if (!a) return json(200, { ok: false, error: 'Por ahora no hay un descuento disponible' });
  const ev = await descuentos.evaluar(c, { codigo: a.codigo, subtotal: 1, email }); // revisa "un uso por correo"
  if (!ev.ok) return json(200, { ok: false, error: ev.error });

  await db.registrarEvento(c, 'suscripcion_bienvenida', null, { email, codigo: a.codigo });
  let enviado = false;
  const E = correo.config();
  if (E) {
    try { await enviar(E, email, mensaje(E, a)); enviado = true; }
    catch (e) { console.error('[bienvenida] correo no enviado:', e.message); }
  }
  return json(200, { ok: true, codigo: a.codigo, pct: a.pct, enviado });
}

module.exports = guard(bienvenida, { errorMsg: 'No pudimos enviar tu código. Intenta de nuevo.' });
