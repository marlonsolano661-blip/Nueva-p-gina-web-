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
    // Opcionales de marketing: si no existen, el bloque correspondiente simplemente no se muestra.
    ig: /^https:\/\//i.test(String(e.INSTAGRAM_URL || '').trim()) ? String(e.INSTAGRAM_URL).trim() : '',
    codigo: String(e.CODIGO_PROXIMA || '').trim().slice(0, 24),
    codigoTxt: String(e.CODIGO_TEXTO || '').trim().slice(0, 90),
  };
}

// ---------- Diseño: negro, marfil y un toque dorado (la misma línea de la tienda) ----------
const K = { ink: '#0a0a0a', paper: '#ffffff', sand: '#f6f2ec', bg: '#ebe7e0', line: '#e4dfd6', mute: '#77736b', gold: '#b08d57', pend: '#d9d4cb' };
const SERIF = "Georgia,'Times New Roman',serif";
const SANS = 'Helvetica,Arial,sans-serif';
const etiqueta = (t, color) => `<span style="font-family:${SANS};font-size:10px;letter-spacing:3px;text-transform:uppercase;color:${color || K.mute}">${t}</span>`;

// El logo se sirve desde el propio sitio: /assets/brand/logo-blanco.png (si no hay SITE_URL, se muestra el nombre en texto).
function logo(E, ancho) {
  if (!E.site) return `<span style="font-family:${SERIF};font-size:26px;letter-spacing:8px;color:#ffffff">MF·COL</span>`;
  return `<img src="${esc(E.site + '/assets/brand/logo-blanco.png')}" width="${ancho}" alt="MF·COL" style="display:block;margin:0 auto;border:0;outline:none;height:auto;font-family:${SERIF};font-size:24px;letter-spacing:8px;color:#ffffff">`;
}

function boton(url, texto, claro) {
  const fondo = claro ? K.paper : K.ink, tinta = claro ? K.ink : '#ffffff';
  return `<table cellpadding="0" cellspacing="0" style="margin:0 auto"><tr><td align="center" bgcolor="${fondo}" style="background:${fondo};border:1px solid ${K.ink}"><a href="${esc(url)}" style="display:inline-block;padding:16px 34px;font-family:${SANS};font-size:11px;letter-spacing:3px;text-transform:uppercase;color:${tinta};text-decoration:none">${esc(texto)}</a></td></tr></table>`;
}

// Cuatro tramos de progreso: 'ok' (hecho, negro), 'act' (en curso, dorado), '' (pendiente).
function progreso(estados) {
  const nombres = ['Pago confirmado', 'Preparando', 'En camino', 'Entregado'];
  return `<table width="100%" cellpadding="0" cellspacing="0" style="table-layout:fixed"><tr>${nombres.map((n, i) => {
    const e = estados[i], col = e === 'ok' ? K.ink : e === 'act' ? K.gold : K.pend;
    return `<td width="25%" valign="top" style="padding:0 3px"><div style="height:3px;line-height:3px;font-size:0;background:${col}">&nbsp;</div><div style="padding-top:9px;font-family:${SANS};font-size:9px;letter-spacing:1.5px;text-transform:uppercase;color:${e ? K.ink : K.mute};font-weight:${e === 'act' ? 'bold' : 'normal'}">${n}</div></td>`;
  }).join('')}</tr></table>`;
}

function filasProductos(items) {
  return (items || []).map((i) => `
    <tr><td style="padding:16px 0;border-bottom:1px solid ${K.line};font-family:${SERIF};font-size:19px;line-height:1.25;color:${K.ink}">${esc(i.nombre)}<br><span style="font-family:${SANS};font-size:10px;letter-spacing:2px;text-transform:uppercase;color:${K.mute}">Talla ${esc(i.talla)}${i.color ? ' · ' + esc(i.color) : ''} · x${esc(i.cant)}</span></td>
    <td align="right" valign="top" style="padding:16px 0;border-bottom:1px solid ${K.line};font-family:${SANS};font-size:14px;letter-spacing:.5px;color:${K.ink}">${cop((Number(i.precio) || 0) * (Number(i.cant) || 0))}</td></tr>`).join('');
}

function direccion(p) {
  const c = p.cliente || {};
  return `${esc(c.nombre)}<br>${esc(c.direccion)}${c.ciudad && !String(c.direccion || '').includes(c.ciudad) ? ', ' + esc(c.ciudad) : ''}<br>${esc(c.tel)}`;
}

function enlacePedido(E, p) {
  return E.site && p.token ? `${E.site}/gracias.html?t=${encodeURIComponent(p.token)}` : '';
}

// Bloque de marketing: cuidado del producto, comunidad, detalle opcional (código) y ayuda. Todo discreto y sin promesas inventadas.
function marketing(E) {
  const tips = ['Guárdalas en una bolsa de tela, lejos del sol directo.', 'Límpialas con un paño suave y apenas húmedo; sécalas al aire.', 'Evita charcos y lluvia fuerte para que duren más.'];
  const lista = tips.map((t, i) => `<tr><td width="38" valign="top" style="padding:7px 0;font-family:${SERIF};font-size:20px;color:${K.gold}">0${i + 1}</td><td valign="top" style="padding:9px 0;font-family:${SANS};font-size:13px;line-height:1.6;color:#3d3a35">${t}</td></tr>`).join('');
  const codigo = E.codigo && E.codigoTxt ? `
<tr><td class="px" style="padding:6px 40px 0"><table width="100%" cellpadding="0" cellspacing="0" style="border:1px dashed ${K.gold}"><tr><td align="center" style="padding:22px 18px">${etiqueta('Un detalle para ti', K.gold)}<div style="padding-top:8px;font-family:${SANS};font-size:13px;line-height:1.6;color:#3d3a35">${esc(E.codigoTxt)}</div><div style="padding-top:10px;font-family:${SERIF};font-size:30px;letter-spacing:6px;color:${K.ink}">${esc(E.codigo)}</div></td></tr></table></td></tr>` : '';
  const comunidad = `
<tr><td class="px" align="center" style="padding:30px 40px 0">${etiqueta('Comunidad MF')}<div style="padding-top:10px;font-family:${SERIF};font-size:22px;line-height:1.3;color:${K.ink}">Cuéntanos cómo luces tus <i>Pasos únicos</i></div><div style="padding:8px 0 18px;font-family:${SANS};font-size:13px;line-height:1.7;color:${K.mute}">Etiquétanos con <b style="color:${K.ink}">#PasosÚnicos</b> y comparte tu estilo.</div>${E.ig ? boton(E.ig, 'Síguenos en Instagram', true) : ''}</td></tr>`;
  const ayuda = E.wa ? `<tr><td align="center" style="padding:24px 40px 0;font-family:${SANS};font-size:13px;color:${K.mute}">¿Dudas con tu talla o tu pedido? <a href="https://wa.me/${esc(E.wa)}" style="color:${K.ink};text-decoration:underline">Escríbenos por WhatsApp</a>.</td></tr>` : '';
  return `
<tr><td style="padding:34px 0 0"><table width="100%" cellpadding="0" cellspacing="0"><tr><td bgcolor="${K.sand}" class="px" style="background:${K.sand};padding:34px 40px 26px">${etiqueta('Hecho para mujeres únicas', K.gold)}<div style="padding:8px 0 12px;font-family:${SERIF};font-size:26px;line-height:1.2;color:${K.ink}">Cuida tu par, <i>luce tu estilo</i></div><table width="100%" cellpadding="0" cellspacing="0">${lista}</table></td></tr></table></td></tr>
${codigo}${comunidad}${ayuda}`;
}

function marco(E, cuerpo, pre) {
  const relleno = '&#847;&zwnj;&nbsp;'.repeat(24);
  const redes = [E.ig ? `<a href="${esc(E.ig)}" style="color:#d8d2c6;text-decoration:underline">Instagram</a>` : '', E.wa ? `<a href="https://wa.me/${esc(E.wa)}" style="color:#d8d2c6;text-decoration:underline">WhatsApp</a>` : ''].filter(Boolean).join(' &nbsp;·&nbsp; ');
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light"><title>MF Colombia</title>
<style>@media only screen and (max-width:620px){.w{width:100%!important}.px{padding-left:22px!important;padding-right:22px!important}.h1{font-size:32px!important}}</style></head>
<body style="margin:0;background:${K.bg};font-family:${SANS}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${K.bg};font-size:1px;line-height:1px">${esc(pre || '')}${relleno}</div>
<table width="100%" cellpadding="0" cellspacing="0" style="background:${K.bg}"><tr><td align="center" style="padding:28px 10px">
<table class="w" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:${K.paper}">
<tr><td align="center" bgcolor="${K.ink}" style="background:${K.ink};padding:38px 24px 30px">${logo(E, 76)}<div style="padding-top:16px;font-family:${SANS};font-size:10px;letter-spacing:6px;text-transform:uppercase;color:#bfb7a8">Pasos únicos</div></td></tr>
<tr><td height="3" bgcolor="${K.gold}" style="height:3px;line-height:3px;font-size:0;background:${K.gold}">&nbsp;</td></tr>
${cuerpo}
${marketing(E)}
<tr><td height="38" style="height:38px;line-height:38px;font-size:0">&nbsp;</td></tr>
<tr><td align="center" bgcolor="${K.ink}" style="background:${K.ink};padding:30px 24px 28px">
<div style="font-family:${SANS};font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#d8d2c6">${redes}</div>
<div style="padding-top:14px;font-family:${SANS};font-size:11px;line-height:1.7;color:#8f897d">Recibes este correo porque realizaste una compra en nuestra tienda.</div>
<div style="padding-top:8px;font-family:${SANS};font-size:10px;letter-spacing:4px;text-transform:uppercase;color:#8f897d">© Marlon Footwear</div></td></tr>
</table></td></tr></table></body></html>`;
}

const hero = (sobre, titulo, texto) => `
<tr><td align="center" class="px" style="padding:40px 40px 0">${etiqueta(sobre, K.gold)}<div class="h1" style="padding-top:14px;font-family:${SERIF};font-size:40px;line-height:1.1;color:${K.ink}">${titulo}</div><div style="padding-top:14px;font-family:${SANS};font-size:14px;line-height:1.75;color:${K.mute}">${texto}</div></td></tr>`;

const tarjetaPedido = (ref) => `
<tr><td class="px" style="padding:26px 40px 0"><table width="100%" cellpadding="0" cellspacing="0"><tr><td bgcolor="${K.sand}" style="background:${K.sand};border-left:3px solid ${K.gold};padding:16px 20px">${etiqueta('Número de pedido')}<br><span style="font-family:${SERIF};font-size:24px;letter-spacing:1px;color:${K.ink}">${esc(ref)}</span></td></tr></table></td></tr>`;

function correoPago(E, p) {
  const c = p.cliente || {};
  const primero = esc(String(c.nombre || '').trim().split(/\s+/)[0] || '');
  const link = enlacePedido(E, p);
  const envio = pesosDeCentavos(p.envio_centavos);
  // El subtotal guardado ya trae el descuento; los productos del pedido muestran cuánto valían antes
  const bruto = (p.items || []).reduce((t, i) => t + (Number(i.precio) || 0) * (Number(i.cant) || 0), 0);
  const netoSub = pesosDeCentavos(p.subtotal_centavos);
  const descPesos = bruto > netoSub && netoSub > 0 ? bruto - netoSub : 0; // descuento aplicado (0 si no hubo)
  const sub = descPesos ? bruto : netoSub;
  const html = marco(E, `${hero('Pago confirmado', `Gracias${primero ? ', <i>' + primero + '</i>' : ''}`, 'Recibimos tu pago y ya estamos preparando tu pedido. Cuando lo despachemos te enviaremos la guía de seguimiento por correo.')}
<tr><td class="px" style="padding:28px 40px 0">${progreso(['ok', 'act', '', ''])}</td></tr>
${tarjetaPedido(p.referencia)}
<tr><td class="px" style="padding:12px 40px 0"><table width="100%" cellpadding="0" cellspacing="0">${filasProductos(p.items)}
<tr><td style="padding:16px 0 4px;font-family:${SANS};font-size:13px;color:${K.mute}">Productos</td><td align="right" style="padding:16px 0 4px;font-family:${SANS};font-size:14px;color:${K.ink}">${cop(sub)}</td></tr>
${descPesos ? `<tr><td style="padding:4px 0;font-family:${SANS};font-size:13px;color:${K.mute}">Descuento</td><td align="right" style="padding:4px 0;font-family:${SANS};font-size:14px;color:${K.ink}">−${cop(descPesos)}</td></tr>` : ''}
<tr><td style="padding:4px 0;font-family:${SANS};font-size:13px;color:${K.mute}">Envío</td><td align="right" style="padding:4px 0;font-family:${SANS};font-size:14px;color:${K.ink}">${envio ? cop(envio) : 'Gratis'}</td></tr>
<tr><td style="padding:14px 0 0;font-family:${SERIF};font-size:20px;color:${K.ink};border-top:1px solid ${K.ink}">Total pagado</td><td align="right" style="padding:14px 0 0;font-family:${SERIF};font-size:20px;color:${K.ink};border-top:1px solid ${K.ink}">${cop(pesosDeCentavos(p.monto_centavos))}</td></tr></table>
<div style="padding-top:10px;font-family:${SANS};font-size:12px;color:${K.mute}">Medio de pago: ${esc(METODOS[p.metodo] || p.metodo || 'En línea')}</div></td></tr>
<tr><td class="px" style="padding:24px 40px 0;font-family:${SANS};font-size:13px;line-height:1.75;color:${K.mute}">${etiqueta('Enviamos a')}<br>${direccion(p)}</td></tr>
${link ? `<tr><td align="center" class="px" style="padding:30px 40px 0">${boton(link, 'Ver mi pedido')}</td></tr>` : ''}`, `Tu pago está confirmado · pedido ${p.referencia}`);
  const texto = `Gracias${primero ? ', ' + primero : ''}. Recibimos tu pago del pedido ${p.referencia}.\n\n` +
    (p.items || []).map((i) => `- ${i.nombre} · talla ${i.talla}${i.color ? ' · ' + i.color : ''} x${i.cant}: ${cop((Number(i.precio) || 0) * (Number(i.cant) || 0))}`).join('\n') +
    `\n\nProductos: ${cop(sub)}\n${descPesos ? `Descuento: −${cop(descPesos)}\n` : ''}Envío: ${envio ? cop(envio) : 'Gratis'}\nTotal pagado: ${cop(pesosDeCentavos(p.monto_centavos))}\n` + (link ? `\nVer tu pedido: ${link}\n` : '') +
    (E.codigo && E.codigoTxt ? `\n${E.codigoTxt}: ${E.codigo}\n` : '') + (E.wa ? `\n¿Dudas? WhatsApp: https://wa.me/${E.wa}\n` : '') + '\nMarlon Footwear';
  return { subject: `Recibimos tu pago · pedido ${p.referencia}`, html, text: texto };
}

function correoEnvio(E, p) {
  const c = p.cliente || {};
  const primero = esc(String(c.nombre || '').trim().split(/\s+/)[0] || '');
  const link = enlacePedido(E, p);
  const rastreo = p.link_rastreo && /^https:\/\//i.test(p.link_rastreo) ? p.link_rastreo : '';
  const fila = (k, v) => (v ? `<tr><td style="padding:11px 0;font-family:${SANS};font-size:12px;letter-spacing:1px;text-transform:uppercase;color:${K.mute};border-bottom:1px solid ${K.line}">${k}</td><td align="right" style="padding:11px 0;font-family:${SERIF};font-size:18px;color:${K.ink};border-bottom:1px solid ${K.line}">${esc(v)}</td></tr>` : '');
  const html = marco(E, `${hero('Pedido enviado', 'Tu pedido va <i>en camino</i>', `${primero ? primero + ', t' : 'T'}u pedido ${esc(p.referencia)} ya salió. Con estos datos puedes seguirlo en todo momento.`)}
<tr><td class="px" style="padding:28px 40px 0">${progreso(['ok', 'ok', 'act', ''])}</td></tr>
<tr><td class="px" style="padding:26px 40px 0"><table width="100%" cellpadding="0" cellspacing="0" style="border-top:2px solid ${K.ink}">${fila('Transportadora', p.transportadora)}${fila('Número de guía', p.guia)}${fila('Pedido', p.referencia)}</table></td></tr>
${rastreo ? `<tr><td align="center" class="px" style="padding:28px 40px 0">${boton(rastreo, 'Rastrear pedido')}</td></tr>` : ''}
<tr><td class="px" style="padding:26px 40px 0;font-family:${SANS};font-size:13px;line-height:1.75;color:${K.mute}">${etiqueta('Enviamos a')}<br>${direccion(p)}</td></tr>
<tr><td class="px" style="padding:20px 40px 0;font-family:${SANS};font-size:13px;line-height:1.7;color:${K.mute}">Cuando llegue, ten a la mano tu número de guía. Si algo no está bien, escríbenos y lo resolvemos contigo.</td></tr>
${link ? `<tr><td align="center" class="px" style="padding:20px 40px 0;font-family:${SANS};font-size:13px"><a href="${esc(link)}" style="color:${K.ink};text-decoration:underline">Ver el estado de mi pedido</a></td></tr>` : ''}`, `Tu pedido ${p.referencia} va en camino${p.guia ? ' · guía ' + p.guia : ''}`);
  const texto = `Tu pedido ${p.referencia} va en camino.\n` + (p.transportadora ? `Transportadora: ${p.transportadora}\n` : '') + (p.guia ? `Guía: ${p.guia}\n` : '') + (rastreo ? `Rastrear: ${rastreo}\n` : '') + (link ? `Estado de tu pedido: ${link}\n` : '') +
    (E.wa ? `\n¿Dudas? WhatsApp: https://wa.me/${E.wa}\n` : '') + '\nMarlon Footwear';
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
