// Cabina de Vestidos: la modelo se prueba otros tacones MF. Función de fondo: responde 202 al instante y trabaja hasta 15 min.
// La llama el panel (Vestidos › paso 7) con la clave del panel (ADMIN_TOKEN):
//   POST /api/tacones-ia-background { trabajo: "IA-xxxx", cuadro: <recorte de piernas y pies del cuadro final, subido a la tienda>,
//                                     tacones: [{ id, n, foto }] (1 a 8) }
// Por cada tacón, Gemini edita el recorte y cambia SOLO los zapatos por ese tacón MF (la foto del catálogo es la referencia exacta).
// El panel vuelve a pegar el recorte sobre el cuadro final, así cara, vestido y fondo quedan idénticos al video.
// Un revisor compara el zapato con la foto del catálogo; si no se parece, se rehace una vez.
// Se cobra en la cuenta de Google Cloud de la tienda: usa la clave propia GOOGLE_IA_API_KEY (Google AI Studio / Vertex),
// NO el AI Gateway de Netlify, para no gastar créditos de Netlify. Sin la clave responde con un aviso y no gasta nada.
// El resultado queda en eventos (tipo "fotos_ia", referencia = trabajo) y se consulta con /api/fotos-ia-estado.
import crypto from 'crypto';
import process from 'process';
import { GoogleGenAI } from '@google/genai';
import configMod from '../../lib/config.js';
import db from '../../lib/db.js';

const { cfg } = configMod;
const RE_TRABAJO = /^IA-[a-z0-9]{6,24}$/;
const RE_ID = /^[\w.-]{1,64}$/;
const MAX_TACONES = 8;
const MAX_FOTOS_DIA = 40; // compartido con las demás fotos con IA
const LIMITE_MS = 12 * 60 * 1000;
const MODELOS_IMG = (process.env.GOOGLE_IA_MODELO ? [process.env.GOOGLE_IA_MODELO] : [])
  .concat(['gemini-3-pro-image-preview', 'gemini-2.5-flash-image']);
const MODELOS_TXT = ['gemini-2.5-flash', 'gemini-3-flash-preview'];

const PROMPT = 'You are a professional fashion photo retoucher for the shoe brand MARLON FOOTWEAR (MF). ' +
  'IMAGE 1 is a crop of a real studio photo of a model (legs and feet). IMAGE 2 is the exact product photo of an MF shoe sold in the store. ' +
  'TASK: replace ONLY the shoes the model is wearing with the shoe from IMAGE 2, on both feet, as if she had worn this exact pair in the same ' +
  'photo shoot. Keep EVERYTHING else pixel-identical: same framing and crop, same legs, skin tone, pose, feet position and angle, same dress ' +
  'hem, same bag or hands if visible, same background, same lighting and shadows. Do not zoom, reframe, move or resize anything. ' +
  'THE SHOE: reproduce IMAGE 2 faithfully: same heel design, heel height and shape, platform (or none), toe shape, number and position of ' +
  'straps, buckles and embellishments, same materials, colors and finishes. Fit it naturally to her feet with realistic contact shadows on ' +
  'the floor. FORBIDDEN: inventing, removing or simplifying details; changing colors; using a similar shoe instead; adding text or logos. ' +
  'Photorealistic, sharp, same image quality as IMAGE 1.';
const CONTROL = 'IMAGE 1 is the reference product photo of a shoe. IMAGE 2 is a photo of a model wearing shoes. Is the shoe in IMAGE 2 the ' +
  'same model as IMAGE 1 (heel shape and height, platform, toe, straps, color, materials)? Is the photo realistic (feet, legs and floor ' +
  'natural, no deformed anatomy)? Answer ONLY with JSON: {"ok": true|false, "motivo": "short reason in English if not ok"}';

const partes = (r) => (r && r.candidates && r.candidates[0] && r.candidates[0].content && r.candidates[0].content.parts) || [];

async function generar(ai, cuadro, zapato, extra) {
  const fallos = [];
  for (const model of MODELOS_IMG) {
    try {
      const r = await ai.models.generateContent({
        model,
        contents: [{ role: 'user', parts: [
          { inlineData: { mimeType: cuadro.mime, data: cuadro.b64 } },
          { inlineData: { mimeType: zapato.mime, data: zapato.b64 } },
          { text: PROMPT + (extra ? ' IMPORTANT, fix this problem from a previous attempt: ' + extra : '') },
        ] }],
        config: { responseModalities: ['IMAGE', 'TEXT'], imageConfig: { aspectRatio: '3:4' } },
      });
      const p = partes(r).find((x) => x.inlineData && x.inlineData.data);
      if (p) return { model, buf: Buffer.from(p.inlineData.data, 'base64'), mime: p.inlineData.mimeType || 'image/png' };
      fallos.push(`${model}: sin imagen en la respuesta`);
    } catch (e) { fallos.push(`${model}: ${String(e && e.message || e).replace(/\s+/g, ' ').slice(0, 160)}`); }
  }
  throw new Error(fallos.join(' | '));
}
async function revisar(ai, zapato, g) {
  for (const model of MODELOS_TXT) {
    try {
      const r = await ai.models.generateContent({ model, contents: [{ role: 'user', parts: [
        { inlineData: { mimeType: zapato.mime, data: zapato.b64 } },
        { inlineData: { mimeType: g.mime, data: g.buf.toString('base64') } },
        { text: CONTROL },
      ] }] });
      const t = partes(r).map((x) => x.text || '').join(' ');
      const j = JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1));
      return { ok: j.ok !== false, motivo: String(j.motivo || '').slice(0, 200) };
    } catch (e) { console.error(`[tacones-ia revisor] ${model}: ${String(e && e.message || e).slice(0, 120)}`); }
  }
  return { ok: true, motivo: '' }; // sin revisor disponible: la dueña aprueba en el panel
}

// Solo fotos de la tienda: el almacenamiento propio o rutas del sitio (assets/…)
function resolver(c, u) {
  const s = String(u || '').trim();
  if (s.startsWith(`${c.db}/storage/v1/object/public/productos/`)) return s;
  if (/^(assets|vestidos)\/[\w./-]{1,200}$/.test(s) && !s.includes('..') && process.env.URL) return new URL(s, process.env.URL).href;
  return '';
}
async function bajar(url) {
  const r = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error(`No se pudo leer la foto (${r.status})`);
  const mime = (r.headers.get('content-type') || 'image/jpeg').split(';')[0];
  if (!/^image\/(jpeg|png|webp)$/.test(mime)) throw new Error('La foto debe ser JPG, PNG o WEBP');
  return { mime, b64: Buffer.from(await r.arrayBuffer()).toString('base64') };
}

export default async (req) => {
  const c = cfg('admin');
  const auth = String(req.headers.get('authorization') || '');
  const t = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!t || t.length !== c.admin.length || !crypto.timingSafeEqual(Buffer.from(t), Buffer.from(c.admin))) { console.error('[tacones-ia] no autorizado'); return; }
  let b = {};
  try { b = await req.json(); } catch (e) { b = {}; }
  const trabajo = String(b.trabajo || '');
  if (!RE_TRABAJO.test(trabajo)) { console.error('[tacones-ia] trabajo inválido'); return; }
  const fin = (detalle) => db.registrarEvento(c, 'fotos_ia', trabajo, detalle);
  try {
    const key = String(process.env.GOOGLE_IA_API_KEY || '').trim();
    if (!key) { await fin({ error: 'Falta conectar Google Cloud: agrega la variable GOOGLE_IA_API_KEY en Netlify (no se gastó nada).' }); return; }
    const tacones = (Array.isArray(b.tacones) ? b.tacones : []).slice(0, MAX_TACONES)
      .map((x) => ({ id: String(x && x.id || ''), n: String(x && x.n || '').slice(0, 60), foto: resolver(c, x && x.foto) }))
      .filter((x) => RE_ID.test(x.id) && x.foto);
    if (!tacones.length) { await fin({ error: 'Elige al menos un tacón con foto en el catálogo' }); return; }
    const hoy = Date.now() - 24 * 3600 * 1000;
    const usadas = ((await db.eventosPorTipo(c, ['fotos_ia'], 100)) || []).filter((e) => new Date(e.creado_en).getTime() > hoy)
      .reduce((n, e) => n + ((e.detalle && Array.isArray(e.detalle.fotos)) ? e.detalle.fotos.length : 0), 0);
    if (usadas + tacones.length > MAX_FOTOS_DIA) { await fin({ error: `Límite diario de ${MAX_FOTOS_DIA} fotos con IA: hoy quedan ${Math.max(0, MAX_FOTOS_DIA - usadas)}.` }); return; }
    const src = resolver(c, b.cuadro);
    if (!src) { await fin({ error: 'El cuadro final debe estar subido en la tienda' }); return; }
    const cuadro = await bajar(src);
    const ai = new GoogleGenAI({ apiKey: key, httpOptions: { baseUrl: 'https://generativelanguage.googleapis.com' } });
    const t0 = Date.now(), fotos = [], errores = [];
    for (const z of tacones) {
      if (Date.now() - t0 > LIMITE_MS) { errores.push({ id: z.id, error: 'Se acabó el tiempo; vuelve a pedir este tacón' }); continue; }
      try {
        const zapato = await bajar(z.foto);
        let g = await generar(ai, cuadro, zapato);
        let rev = await revisar(ai, zapato, g);
        if (!rev.ok && Date.now() - t0 < LIMITE_MS - 90000) {
          try { const g2 = await generar(ai, cuadro, zapato, rev.motivo); const r2 = await revisar(ai, zapato, g2); if (r2.ok || !rev.ok) { g = g2; rev = r2; } }
          catch (e) { console.error('[tacones-ia] segundo intento falló; se queda el primero'); }
        }
        const ext = g.mime.includes('jpeg') ? 'jpg' : g.mime.includes('webp') ? 'webp' : 'png';
        const url = await db.subirFoto(c, `vestidos/prueba-${z.id.slice(0, 30)}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${ext}`, g.buf, g.mime);
        fotos.push({ id: z.id, n: z.n, url, revisada: rev.ok, nota: rev.ok ? '' : rev.motivo, modelo: g.model });
      } catch (e) { errores.push({ id: z.id, error: String(e.message || e).slice(0, 300) }); }
    }
    await fin({ cuadro: src, fotos, errores, segundos: Math.round((Date.now() - t0) / 1000) });
  } catch (e) {
    console.error('[tacones-ia]', e && e.message ? e.message : e);
    await fin({ error: 'No se pudieron crear las pruebas: ' + String(e && e.message || e).slice(0, 200) });
  }
};
