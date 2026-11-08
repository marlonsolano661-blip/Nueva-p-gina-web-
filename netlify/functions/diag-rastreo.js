'use strict';
// TEMPORAL (solo para la vista previa): lee la página pública de rastreo de Interrapidísimo y lista de qué
// servicio saca el estado del envío, para poder actualizar los pedidos solos. Solo acepta enlaces de
// *.interrapidisimo.com. Se borra cuando la integración quede lista.
const PERMITIDO = /(^|\.)interrapidisimo\.com$/i;
const T0 = Date.now();

async function traer(url, ms) {
  const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (MF Colombia seguimiento)' }, signal: AbortSignal.timeout(ms || 6000) });
  return { status: r.status, tipo: r.headers.get('content-type') || '', texto: (await r.text()).slice(0, 4000000) };
}

exports.handler = async (event) => {
  const q = event.queryStringParameters || {};
  let u;
  try { u = new URL(String(q.u || '')); } catch (e) { u = null; }
  if (!u || u.protocol !== 'https:' || !PERMITIDO.test(u.hostname)) {
    return { statusCode: 400, headers: { 'Content-Type': 'text/plain; charset=utf-8' }, body: 'Falta ?u= con un enlace https de interrapidisimo.com' };
  }
  const out = { pagina: u.href, leidos: [], urls: [], api: [] };
  const urls = new Set(), api = new Set(), vistos = new Set();
  const buscar = (t) => {
    for (const m of t.matchAll(/https?:\/\/[a-z0-9.\-]+(?::\d+)?(?:\/[\w\-./{}$?=&]*)?/gi)) if (!/\.(png|jpe?g|svg|gif|woff2?|ttf|css)(\?|$)/i.test(m[0]) && !/w3\.org|googleapis|gstatic|google\.com|googletagmanager|facebook|angular\.io|github|mozilla|reactjs|tailwind/i.test(m[0])) urls.add(m[0].slice(0, 200));
    for (const m of t.matchAll(/["'`]([^"'`\s]{0,100}(?:api|Api|API|rastreo|Rastreo|Rastreos|Guia|guia|Seguimiento|seguimiento|Tracking|tracking|Estado|estado)[^"'`\s]{0,100})["'`]/g)) if (/[/.]/.test(m[1])) api.add(m[1].slice(0, 220));
  };
  try {
    const p = await traer(u.href);
    const html = p.texto;
    const baseM = /<base[^>]+href=["']([^"']+)["']/i.exec(html);
    const base = new URL(baseM ? baseM[1] : '/', u.href).href;
    out.base = base;
    buscar(html);
    let cola = [...html.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)].map((m) => new URL(m[1], base).href);
    // Lee los archivos de la app y los pedazos que estos cargan (máx. 30 archivos o ~8 segundos)
    while (cola.length && vistos.size < 30 && Date.now() - T0 < 8000) {
      const lote = cola.splice(0, 6).filter((s) => !vistos.has(s));
      lote.forEach((s) => vistos.add(s));
      const res = await Promise.all(lote.map((s) => traer(s).then((r) => ({ s, r })).catch(() => ({ s, r: null }))));
      for (const { s, r } of res) {
        if (!r) { out.leidos.push(s + ' (error)'); continue; }
        out.leidos.push(s + ' (' + r.status + ', ' + r.tipo.split(';')[0] + ', ' + r.texto.length + ')');
        if (!/javascript|ecmascript/i.test(r.tipo) && /^\s*</.test(r.texto)) continue;
        buscar(r.texto);
        const sb = new URL('.', s).href;
        for (const m of r.texto.matchAll(/["'`]((?:[\w\-./]*\/)?[\w\-.]+\.[a-f0-9]{8,20}\.(?:m?js))["'`]/g)) {
          try { const n = new URL(m[1], sb).href; if (PERMITIDO.test(new URL(n).hostname) && !vistos.has(n)) cola.push(n); } catch (e) { /* nada */ }
        }
        for (const m of r.texto.matchAll(/https:\/\/[a-z0-9.\-]+interrapidisimo\.com[\w\-./]*remoteEntry\.m?js/gi)) if (!vistos.has(m[0])) cola.push(m[0]);
      }
    }
    out.pendientes = cola.length;
    out.urls = [...urls].slice(0, 200);
    out.api = [...api].slice(0, 250);
  } catch (e) {
    out.error = String(e && e.message || e).slice(0, 300);
  }
  return { statusCode: 200, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }, body: JSON.stringify(out, null, 1) };
};
