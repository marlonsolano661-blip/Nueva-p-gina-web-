'use strict';
// TEMPORAL (solo para la vista previa): lee la página pública de rastreo de Interrapidísimo y lista de qué
// servicio saca el estado del envío, para poder actualizar los pedidos solos. Solo acepta enlaces de
// *.interrapidisimo.com. Se borra cuando la integración quede lista.
const PERMITIDO = /(^|\.)interrapidisimo\.com$/i;

async function traer(url, ms) {
  const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (MF Colombia seguimiento)' }, signal: AbortSignal.timeout(ms || 8000) });
  return { status: r.status, tipo: r.headers.get('content-type') || '', texto: (await r.text()).slice(0, 3000000) };
}

exports.handler = async (event) => {
  const q = event.queryStringParameters || {};
  let u;
  try { u = new URL(String(q.u || '')); } catch (e) { u = null; }
  if (!u || u.protocol !== 'https:' || !PERMITIDO.test(u.hostname)) {
    return { statusCode: 400, headers: { 'Content-Type': 'text/plain; charset=utf-8' }, body: 'Falta ?u= con un enlace https de interrapidisimo.com' };
  }
  const out = { pagina: u.href, scripts: [], urls: [], pistas: [] };
  try {
    const p = await traer(u.href);
    out.estado_pagina = p.status;
    const html = p.texto;
    out.html_inicio = html.slice(0, 1500);
    const srcs = [...html.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)].map((m) => new URL(m[1], u.href).href);
    out.scripts = srcs;
    const urls = new Set(), pistas = new Set();
    const buscar = (t) => {
      for (const m of t.matchAll(/https?:\/\/[a-z0-9.\-]+(?:\/[\w\-./{}$]*)?/gi)) if (!/\.(png|jpe?g|svg|woff2?|css)$/i.test(m[0]) && !/w3\.org|googleapis|gstatic|google\.com|facebook|angular\.io/i.test(m[0])) urls.add(m[0]);
      for (const m of t.matchAll(/["'`]([^"'`\s]{0,80}(?:[Rr]astreo|[Gg]uia|[Ee]nvio|[Tt]racking|[Ee]stado)[^"'`\s]{0,80})["'`]/g)) pistas.add(m[1]);
    };
    buscar(html);
    for (const s of srcs.slice(0, 8)) {
      try { const r = await traer(s, 10000); buscar(r.texto); } catch (e) { out.pistas.push('no se pudo leer ' + s); }
    }
    out.urls = [...urls].slice(0, 150);
    out.pistas = out.pistas.concat([...pistas].slice(0, 200));
  } catch (e) {
    out.error = String(e && e.message || e).slice(0, 300);
  }
  console.log('[diag-rastreo]', JSON.stringify(out).slice(0, 60000));
  return { statusCode: 200, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }, body: JSON.stringify(out, null, 1) };
};
