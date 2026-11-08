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

// ---------- Diseño de Marlon Footwear: todo en blanco, alineado a la izquierda y solo lo esencial ----------
// Sin bloques ni botones negros: texto oscuro sobre blanco, líneas finas y botones de contorno.
const K = { ink: '#1c1c1c', paper: '#ffffff', bg: '#ffffff', line: '#ececec', mute: '#7a7a7a', act: '#9a9a9a', pend: '#e6e6e6' };
const SERIF = "Georgia,'Times New Roman',serif";
const SANS = "'Helvetica Neue',Helvetica,Arial,sans-serif";
const etiqueta = (t, color) => `<span style="font-family:${SANS};font-size:10px;letter-spacing:3px;text-transform:uppercase;color:${color || K.mute}">${t}</span>`;

// Logo oscuro sobre blanco servido desde el propio sitio (sin SITE_URL, el nombre en texto).
function logo(E, ancho) {
  if (!E.site) return `<span style="font-family:${SERIF};font-size:22px;letter-spacing:6px;color:${K.ink}">MF·COL</span>`;
  return `<img src="${esc(E.site + '/assets/brand/logo-negro.png')}" width="${ancho}" alt="MF·COL" style="display:block;border:0;outline:none;height:auto;font-family:${SANS};font-size:16px;letter-spacing:6px;color:${K.ink}">`;
}

// Botón de contorno (fondo blanco, borde fino)
function boton(url, texto) {
  return `<table cellpadding="0" cellspacing="0"><tr><td style="border:1px solid ${K.ink}"><a href="${esc(url)}" style="display:inline-block;padding:13px 26px;font-family:${SANS};font-size:11px;letter-spacing:3px;text-transform:uppercase;color:${K.ink};text-decoration:none">${esc(texto)}</a></td></tr></table>`;
}

function progreso(estados, nombres) {
  nombres = nombres || ['Pago confirmado', 'Preparando', 'En camino', 'Entregado'];
  const ancho = (100 / nombres.length).toFixed(2).replace(/\.?0+$/, '') + '%';
  const seis = nombres.length > 4; // con 6 pasos: menos espacio entre letras y, en pantallas angostas, dos filas de 3
  return `<table${seis ? ' class="pt"' : ''} width="100%" cellpadding="0" cellspacing="0" style="table-layout:fixed"><tr>${nombres.map((n, i) => {
    const e = estados[i], col = e === 'ok' ? K.ink : e === 'act' ? K.act : K.pend;
    return `<td width="${ancho}" valign="top" style="padding:0 3px"><div style="height:3px;line-height:3px;font-size:0;background:${col}">&nbsp;</div><div style="padding-top:9px;font-family:${SANS};font-size:9px;letter-spacing:${seis ? '1' : '1.5'}px;text-transform:uppercase;color:${e ? K.ink : K.mute};font-weight:${e === 'act' ? 'bold' : 'normal'}">${n}</div></td>`;
  }).join('')}</tr></table>`;
}

function filasProductos(items, unitario) {
  return (items || []).map((i) => `
    <tr><td style="padding:16px 0;border-bottom:1px solid ${K.line};font-family:${SERIF};font-size:19px;line-height:1.25;color:${K.ink}">${esc(i.nombre)}<br><span style="font-family:${SANS};font-size:10px;letter-spacing:2px;text-transform:uppercase;color:${K.mute}">Talla ${esc(i.talla)}${i.color ? ' · ' + esc(i.color) : ''} · x${esc(i.cant)}${unitario && Number(i.cant) > 1 && Number(i.precio) > 0 ? ' · ' + cop(Number(i.precio)) + ' c/u' : ''}</span></td>
    <td align="right" valign="top" style="padding:16px 0;border-bottom:1px solid ${K.line};font-family:${SANS};font-size:14px;letter-spacing:.5px;color:${K.ink}">${cop((Number(i.precio) || 0) * (Number(i.cant) || 0))}</td></tr>`).join('');
}

function direccion(p) {
  const c = p.cliente || {};
  return `${esc(c.nombre)}<br>${esc(c.direccion)}${c.ciudad && !String(c.direccion || '').includes(c.ciudad) ? ', ' + esc(c.ciudad) : ''}<br>${esc(c.tel)}`;
}

// Datos de la clienta (quién compra) y dirección de entrega (dónde llega): todo sale del pedido guardado.
function datosCliente(p) {
  const c = p.cliente || {};
  return [esc(c.nombre), esc(c.email), esc(c.tel)].filter(Boolean).join('<br>');
}
function direccionEntrega(p) {
  const c = p.cliente || {};
  const ciudad = c.ciudad && !String(c.direccion || '').includes(c.ciudad) ? ', ' + esc(c.ciudad) : '';
  return `${esc(c.direccion)}${ciudad}${c.nota ? '<br>Indicaciones: ' + esc(c.nota) : ''}`;
}

function enlacePedido(E, p) {
  return E.site && p.token ? `${E.site}/gracias.html?t=${encodeURIComponent(p.token)}` : '';
}

// Invitación a seguir la marca: Instagram si INSTAGRAM_URL existe; si no, la tienda.
function seguir(E) {
  const url = E.ig || E.site;
  if (!url) return '';
  return `
<tr><td class="px" style="padding:36px 44px 0"><div style="border-top:1px solid ${K.line};padding-top:30px;font-family:${SERIF};font-size:21px;line-height:1.35;color:${K.ink}">¿Ya nos sigues?</div><div style="padding:8px 0 20px;font-family:${SANS};font-size:13px;line-height:1.7;color:${K.mute}">${E.ig ? 'Síguenos para ver primero los nuevos modelos y las ediciones limitadas.' : 'Visítanos para ver primero los nuevos modelos y las ediciones limitadas.'}</div>${boton(url, E.ig ? 'Síguenos en Instagram' : 'Visitar la tienda')}</td></tr>`;
}

function marco(E, cuerpo, pre, extra) {
  const relleno = '&#847;&zwnj;&nbsp;'.repeat(24);
  const ayuda = E.wa ? `¿Dudas? <a href="https://wa.me/${esc(E.wa)}" style="color:${K.ink};text-decoration:underline">Escríbenos por WhatsApp</a><br>` : '';
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light"><title>MF Colombia</title>
<style>@media only screen and (max-width:620px){.w{width:100%!important}.px{padding-left:24px!important;padding-right:24px!important}.h1{font-size:28px!important}.col{display:block!important;width:100%!important;padding:0 0 20px!important}.pt,.pt tbody,.pt tr{display:block!important;width:100%!important}.pt td{display:inline-block!important;width:33.33%!important;box-sizing:border-box!important;padding-bottom:12px!important}}</style></head>
<body style="margin:0;background:${K.bg};font-family:${SANS}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${K.bg};font-size:1px;line-height:1px">${esc(pre || '')}${relleno}</div>
<table width="100%" cellpadding="0" cellspacing="0" bgcolor="${K.bg}" style="background:${K.bg}"><tr><td align="center" style="padding:20px 10px">
<table class="w" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:${K.paper}">
<tr><td class="px" style="padding:30px 44px 0">${logo(E, 56)}</td></tr>
${cuerpo}
${extra || ''}
<tr><td class="px" style="padding:40px 44px 30px"><div style="border-top:1px solid ${K.line};padding-top:20px;font-family:${SANS};font-size:12px;line-height:1.8;color:${K.mute}">${ayuda}Marlon Footwear · Hecho en Colombia</div></td></tr>
</table></td></tr></table></body></html>`;
}

const hero = (sobre, titulo, texto) => `
<tr><td class="px" style="padding:36px 44px 0">${etiqueta(sobre)}<div class="h1" style="padding-top:12px;font-family:${SERIF};font-size:32px;line-height:1.15;color:${K.ink}">${titulo}</div><div style="padding-top:12px;font-family:${SANS};font-size:14px;line-height:1.7;color:${K.mute}">${texto}</div></td></tr>`;

// Confirmación de compra: solo lo esencial (confirmación y resumen, datos de la compradora, agradecimiento e invitación a seguir).
function correoPago(E, p) {
  const c = p.cliente || {};
  const primero = esc(String(c.nombre || '').trim().split(/\s+/)[0] || '');
  const link = enlacePedido(E, p);
  const envio = pesosDeCentavos(p.envio_centavos);
  const total = cop(pesosDeCentavos(p.monto_centavos));
  // El subtotal guardado ya trae el descuento; los productos muestran cuánto valían antes
  const bruto = (p.items || []).reduce((t, i) => t + (Number(i.precio) || 0) * (Number(i.cant) || 0), 0);
  const netoSub = pesosDeCentavos(p.subtotal_centavos);
  const descPesos = bruto > netoSub && netoSub > 0 ? bruto - netoSub : 0;
  const prods = (p.items || []).map((i) => `
<tr><td style="padding:12px 0;border-bottom:1px solid ${K.line};font-family:${SANS};font-size:14px;line-height:1.5;color:${K.ink}">${esc(i.nombre)}<br><span style="font-size:12px;color:${K.mute}">Talla ${esc(i.talla)}${i.color ? ' · ' + esc(i.color) : ''} · x${esc(i.cant)}${Number(i.cant) > 1 && Number(i.precio) > 0 ? ' · ' + cop(Number(i.precio)) + ' c/u' : ''}</span></td>
<td align="right" valign="top" style="padding:12px 0;border-bottom:1px solid ${K.line};font-family:${SANS};font-size:14px;color:${K.ink}">${cop((Number(i.precio) || 0) * (Number(i.cant) || 0))}</td></tr>`).join('');
  const dato = (k, v) => (v ? `<tr><td valign="top" width="96" style="padding:5px 0;font-family:${SANS};font-size:12px;color:${K.mute}">${k}</td><td style="padding:5px 0;font-family:${SANS};font-size:13px;line-height:1.6;color:${K.ink}">${v}</td></tr>` : '');
  const entrega = `${esc(c.direccion)}${c.ciudad && !String(c.direccion || '').includes(c.ciudad) ? ', ' + esc(c.ciudad) : ''}${c.nota ? '<br><span style="color:' + K.mute + '">' + esc(c.nota) + '</span>' : ''}`;
  const html = marco(E, `${hero('Compra confirmada', `Gracias por tu compra${primero ? ', ' + primero : ''}`, `Tu pago fue aprobado. Pedido <span style="color:${K.ink};white-space:nowrap">${esc(p.referencia)}</span>.`)}
<tr><td class="px" style="padding:30px 44px 0">${etiqueta('Tu compra')}<table width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px;border-top:1px solid ${K.line}">${prods}
${descPesos ? `<tr><td style="padding:12px 0 0;font-family:${SANS};font-size:13px;color:${K.mute}">Descuento</td><td align="right" style="padding:12px 0 0;font-family:${SANS};font-size:13px;color:${K.mute}">−${cop(descPesos)}</td></tr>` : ''}
<tr><td style="padding:${descPesos ? 4 : 12}px 0 0;font-family:${SANS};font-size:13px;color:${K.mute}">Envío</td><td align="right" style="padding:${descPesos ? 4 : 12}px 0 0;font-family:${SANS};font-size:13px;color:${K.mute}">${envio ? cop(envio) : 'Gratis'}</td></tr>
<tr><td style="padding:8px 0 0;font-family:${SANS};font-size:15px;color:${K.ink}">Total pagado</td><td align="right" style="padding:8px 0 0;font-family:${SANS};font-size:15px;color:${K.ink}">${total}</td></tr></table>
${link ? `<div style="padding-top:16px;font-family:${SANS};font-size:12px"><a href="${esc(link)}" style="color:${K.ink};text-decoration:underline">Ver el estado de mi pedido</a></div>` : ''}</td></tr>
<tr><td class="px" style="padding:32px 44px 0">${etiqueta('Tus datos')}<table width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px">${dato('Nombre', esc(c.nombre))}${dato('Correo', esc(c.email))}${dato('Teléfono', esc(c.tel))}${dato('Entrega', entrega)}</table></td></tr>`, `Compra confirmada · pedido ${p.referencia}`, seguir(E));
  const texto = `Gracias por tu compra${primero ? ', ' + primero : ''}. Tu pago fue aprobado. Pedido ${p.referencia}.\n\n` +
    (p.items || []).map((i) => `- ${i.nombre} · talla ${i.talla}${i.color ? ' · ' + i.color : ''} x${i.cant}: ${cop((Number(i.precio) || 0) * (Number(i.cant) || 0))}`).join('\n') +
    `\n${descPesos ? `Descuento: −${cop(descPesos)}\n` : ''}Envío: ${envio ? cop(envio) : 'Gratis'}\nTotal pagado: ${total}\n` +
    `\nTus datos:\n${[c.nombre, c.email, c.tel, String(c.direccion || '') + (c.ciudad && !String(c.direccion || '').includes(c.ciudad) ? ', ' + c.ciudad : ''), c.nota].filter(Boolean).join('\n')}\n` +
    (link ? `\nEstado de tu pedido: ${link}\n` : '') + ((E.ig || E.site) ? `\n¿Ya nos sigues? ${E.ig || E.site}\n` : '') + (E.wa ? `\n¿Dudas? WhatsApp: https://wa.me/${E.wa}\n` : '') + '\nMarlon Footwear';
  return { subject: `Compra confirmada · pedido ${p.referencia}`, html, text: texto };
}

// Línea de tiempo del seguimiento. Solo se marca lo que el pedido realmente tiene (pago aprobado y estado de envío guardado):
// recibido siempre (el pedido existe), pago confirmado, preparación, despachado, en tránsito y entregado.
const PASOS_SEGUIMIENTO = ['Recibido', 'Pago confirmado', 'Preparación', 'Despachado', 'En tránsito', 'Entregado'];
function lineaTiempo(p) {
  const e = p.estado_envio || 'EN_CAMINO'; // este correo solo se manda con el pedido ya despachado
  const despachado = e !== 'PREPARANDO';
  const transito = !['PREPARANDO', 'ENTREGADO', 'DEVUELTO'].includes(e);
  return [
    'ok',
    p.estado_pago === 'APPROVED' ? 'ok' : '',
    e === 'PREPARANDO' ? 'act' : 'ok',
    despachado ? 'ok' : '',
    e === 'ENTREGADO' ? 'ok' : transito ? 'act' : '',
    e === 'ENTREGADO' ? 'ok' : '',
  ];
}

function correoEnvio(E, p) {
  const c = p.cliente || {};
  const primero = esc(String(c.nombre || '').trim().split(/\s+/)[0] || '');
  const link = enlacePedido(E, p);
  const rastreo = p.link_rastreo && /^https:\/\//i.test(p.link_rastreo) ? p.link_rastreo : '';
  const fila = (k, v) => (v ? `<tr><td style="padding:11px 0;font-family:${SANS};font-size:12px;letter-spacing:1px;text-transform:uppercase;color:${K.mute};border-bottom:1px solid ${K.line}">${k}</td><td align="right" style="padding:11px 0;font-family:${SERIF};font-size:18px;color:${K.ink};border-bottom:1px solid ${K.line}">${esc(v)}</td></tr>` : '');
  // El texto sigue el estado real del pedido (también si el correo se reenvía más adelante).
  const est = p.estado_envio === 'ENTREGADO' ? 'ENTREGADO' : p.estado_envio === 'EN_DESTINO' ? 'EN_DESTINO' : 'EN_CAMINO';
  const cab = {
    EN_CAMINO: { sobre: 'Pedido enviado', titulo: 'Tu pedido va <i>en camino</i>', frase: 'ya salió. Con estos datos puedes seguirlo en todo momento.', asunto: 'va en camino', pre: 'va en camino' },
    EN_DESTINO: { sobre: 'Pedido en destino', titulo: 'Tu pedido llegó a <i>tu ciudad</i>', frase: 'ya llegó a tu ciudad. Con estos datos puedes seguirlo en todo momento.', asunto: 'llegó a tu ciudad', pre: 'llegó a tu ciudad' },
    ENTREGADO: { sobre: 'Pedido entregado', titulo: 'Tu pedido fue <i>entregado</i>', frase: 'figura como entregado. Estos son los datos del envío.', asunto: 'fue entregado', pre: 'fue entregado' },
  }[est];
  const html = marco(E, `${hero(cab.sobre, cab.titulo, `${primero ? primero + ', t' : 'T'}u pedido ${esc(p.referencia)} ${cab.frase}`)}
<tr><td class="px" style="padding:28px 40px 0">${progreso(lineaTiempo(p), PASOS_SEGUIMIENTO)}</td></tr>
<tr><td class="px" style="padding:26px 40px 0"><table width="100%" cellpadding="0" cellspacing="0" style="border-top:2px solid ${K.ink}">${fila('Transportadora', p.transportadora)}${fila('Número de guía', p.guia)}${fila('Pedido', p.referencia)}</table></td></tr>
${rastreo ? `<tr><td align="center" class="px" style="padding:28px 40px 0">${boton(rastreo, 'Rastrear pedido')}</td></tr>` : ''}
<tr><td class="px" style="padding:26px 40px 0;font-family:${SANS};font-size:13px;line-height:1.75;color:${K.mute}">${etiqueta('Enviamos a')}<br>${direccion(p)}</td></tr>
<tr><td class="px" style="padding:20px 40px 0;font-family:${SANS};font-size:13px;line-height:1.7;color:${K.mute}">Cuando llegue, ten a la mano tu número de guía. Si algo no está bien, escríbenos y lo resolvemos contigo.</td></tr>
${link ? `<tr><td align="center" class="px" style="padding:20px 40px 0;font-family:${SANS};font-size:13px"><a href="${esc(link)}" style="color:${K.ink};text-decoration:underline">Ver el estado de mi pedido</a></td></tr>` : ''}`, `Tu pedido ${p.referencia} ${cab.pre}${p.guia ? ' · guía ' + p.guia : ''}`);
  const texto = `Tu pedido ${p.referencia} ${cab.pre}.\n` + `Progreso: ${PASOS_SEGUIMIENTO.map((n, i) => n + (lineaTiempo(p)[i] === 'ok' ? ' ✓' : lineaTiempo(p)[i] === 'act' ? ' (ahora)' : '')).join(' > ')}\n` + (p.transportadora ? `Transportadora: ${p.transportadora}\n` : '') + (p.guia ? `Guía: ${p.guia}\n` : '') + (rastreo ? `Rastrear: ${rastreo}\n` : '') + (link ? `Estado de tu pedido: ${link}\n` : '') +
    (E.wa ? `\n¿Dudas? WhatsApp: https://wa.me/${E.wa}\n` : '') + '\nMarlon Footwear';
  return { subject: `Tu pedido ${p.referencia} ${cab.asunto}`, html, text: texto };
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

// tipo: 'pago' | 'envio' | 'destino' (el mismo correo de envío, con el texto "llegó a tu ciudad"; se manda una sola vez).  opciones.forzar: reenvío manual desde el panel (no usa ni cambia la marca de "ya enviado").
// Devuelve: 'enviado' | 'omitido' | 'ya_enviado' | 'no_aplica' | 'sin_correo' | 'no_encontrado' | 'fallo'
async function avisar(c, referencia, tipo, opciones) {
  const forzar = !!(opciones && opciones.forzar);
  let reclamado = false, clave = tipo === 'pago' ? 'pago_correo' : tipo === 'destino' ? 'destino_correo' : 'envio_correo';
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

module.exports = { avisar, config, correoPago, correoEnvio, lineaTiempo };
