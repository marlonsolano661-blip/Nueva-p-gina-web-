'use strict';
// TEMPORAL (solo para la vista previa): lee la página pública de rastreo de Interrapidísimo y lista de qué
// servicio saca el estado del envío, para poder actualizar los pedidos solos. Solo acepta enlaces de
// *.interrapidisimo.com. Se borra cuando la integración quede lista.
const PERMITIDO = /(^|\.)interrapidisimo\.com$/i;

async function traer(url, ms) {
  const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (MF Colombia seguimiento)' }, signal: AbortSignal.timeout(ms || 6000) });
  return { status: r.status, tipo: r.headers.get('content-type') || '', texto: (await r.text()).slice(0, 4000000) };
}

exports.handler = async (event) => {
  const T0 = Date.now();
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
    while (cola.length && vistos.size < 40 && Date.now() - T0 < 9000) {
      const lote = cola.splice(0, 6).filter((s) => !vistos.has(s));
      lote.forEach((s) => vistos.add(s));
      const res = await Promise.all(lote.map((s) => traer(s).then((r) => ({ s, r })).catch(() => ({ s, r: null }))));
      for (const { s, r } of res) {
        if (!r) { out.leidos.push(s + ' (error)'); continue; }
        out.leidos.push(s + ' (' + r.status + ', ' + r.tipo.split(';')[0] + ', ' + r.texto.length + ')');
        if (r.status !== 200 || (/^\s*</.test(r.texto) && !/javascript|json/i.test(r.tipo))) continue;
        const sb = new URL('.', s).href;
        const agregar = (x, b) => { try { const n = new URL(x, b || sb).href; if (!vistos.has(n) && !cola.includes(n)) cola.push(n); } catch (e) { /* nada */ } };
        // Manifiestos de micro-frontends (JSON): nombre -> remoteEntry, y remoteEntry -> archivos expuestos
        if (/json/i.test(r.tipo) || /^\s*[{[]/.test(r.texto)) {
          out.json = out.json || {}; out.json[s] = r.texto.slice(0, 1500);
          try {
            const j = JSON.parse(r.texto);
            if (j && typeof j === 'object' && !Array.isArray(j)) {
              Object.values(j).forEach((v) => { if (typeof v === 'string' && /^https?:|\.m?js(on)?$/.test(v)) agregar(v); });
              (j.exposes || []).forEach((e) => { if (e && e.outFileName) agregar(e.outFileName); });
            }
          } catch (e) { /* no es JSON */ }
          buscar(r.texto);
          continue;
        }
        buscar(r.texto);
        if (!out.fragmentos) out.fragmentos = {};
        if (Object.keys(out.fragmentos).length < 3) out.fragmentos[s] = [...r.texto.matchAll(/.{0,120}(?:manifest|remoteEntry|loadRemote|initFederation|\.json).{0,120}/g)].map((m) => m[0]).slice(0, 8);
        for (const m of r.texto.matchAll(/["'`]((?:\.{0,2}\/)?[\w\-./]+\.(?:m?js|json))["'`]/g)) if (!/^(?:\.\.?\/)?(?:node_modules|@)/.test(m[1])) agregar(m[1]);
        for (const m of r.texto.matchAll(/https:\/\/[a-z0-9.\-]+interrapidisimo\.com[\w\-./]*\.(?:m?js|json)/gi)) agregar(m[0]);
        // Pedazos de webpack: el nombre se arma como <id>.<hash>.js a partir de un mapa {id:"hash"}
        for (const m of r.texto.matchAll(/(?:^|[{,])\s*("?[\w-]+"?)\s*:\s*"([a-f0-9]{16,20})"/g)) agregar(m[1].replace(/"/g, '') + '.' + m[2] + '.js', base);
        if (!out.muestra) out.muestra = r.texto.length < 20000 ? r.texto.slice(0, 6000) : '';
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
