'use strict';
// Fotos de producto con IA (Gemini por el AI Gateway de Netlify). Función de fondo: responde 202 al instante
// y trabaja hasta 15 min. Toma UNA foto del producto (ya subida al bucket 'productos') y crea variantes
// de color y de ángulo. Cada foto queda en el bucket y las URLs se guardan en eventos (tipo 'fotos_ia').
//   GET /.netlify/functions/fotos-ia-background?t=<token>&src=<url de la foto>
// El token es de un solo uso: vive en ajustes (clave 'fotos_ia_token') y se borra al empezar.
const crypto = require('crypto');
const { cfg } = require('../../lib/config');
const db = require('../../lib/db');

const MODELOS = ['gemini-3-pro-image-preview', 'gemini-2.5-flash-image'];

const BASE = 'Edit this product photo of a women\'s high-heel sandal. Keep the EXACT same shoe design: square open toe, ' +
  'clear transparent vinyl toe strap, thin diagonal strap covered in small silver rhinestones crossing the instep, thin ankle strap ' +
  'with a small metal buckle, and a thin clear transparent acrylic stiletto heel (about 10 cm). Keep the same model\'s legs and skin, ' +
  'the same soft light-grey studio background and the same soft professional lighting. Photorealistic e-commerce product photography, ' +
  'sharp focus, high detail. Do not add text, logos or watermarks. ';

const PEDIDOS = [
  { id: 'negro', prompt: BASE + 'Change ONLY the color of the insole, sole edge and ankle strap from nude/beige to glossy black. Rhinestones stay silver, toe strap and heel stay transparent. Same pose and framing.' },
  { id: 'dorado', prompt: BASE + 'Change ONLY the color of the insole, sole edge and ankle strap from nude/beige to metallic gold, and make the rhinestones golden-champagne. Toe strap and heel stay transparent. Same pose and framing.' },
  { id: 'lateral', prompt: BASE + 'Show ONE foot wearing the nude sandal in a clean side profile view (outer side), heel on the left, toes on the right, the full shoe visible including the whole clear heel, centered with margin.' },
  { id: 'trasera', prompt: BASE + 'Show the nude sandal worn on one foot from a three-quarter back view so the heel counter, the ankle strap with buckle and the clear stiletto heel are clearly visible, full shoe in frame, centered with margin.' },
];

async function generar(ai, img, mime, prompt) {
  let ultimo;
  for (const model of MODELOS) {
    try {
      const r = await ai.models.generateContent({
        model,
        contents: [{ role: 'user', parts: [{ inlineData: { mimeType: mime, data: img } }, { text: prompt }] }],
        config: { responseModalities: ['IMAGE', 'TEXT'] },
      });
      const parts = (r.candidates && r.candidates[0] && r.candidates[0].content && r.candidates[0].content.parts) || [];
      const p = parts.find((x) => x.inlineData && x.inlineData.data);
      if (p) return { model, buf: Buffer.from(p.inlineData.data, 'base64'), mime: p.inlineData.mimeType || 'image/png' };
      ultimo = new Error(`${model}: sin imagen en la respuesta`);
    } catch (e) { ultimo = new Error(`${model}: ${String(e && e.message || e).slice(0, 200)}`); }
  }
  throw ultimo;
}

exports.handler = async (event) => {
  const c = cfg('admin');
  const q = event.queryStringParameters || {};
  const guardado = await db.getAjuste(c, 'fotos_ia_token');
  const token = guardado && typeof guardado.token === 'string' ? guardado.token : '';
  const t = String(q.t || '');
  if (token.length < 24 || t.length !== token.length || !crypto.timingSafeEqual(Buffer.from(t), Buffer.from(token))) {
    console.error('[fotos-ia] token inválido');
    return;
  }
  await db.setAjuste(c, 'fotos_ia_token', { token: '', usado: new Date().toISOString() }); // un solo uso

  const src = String(q.src || '');
  if (!src.startsWith(`${c.db}/storage/v1/object/public/productos/`)) {
    await db.registrarEvento(c, 'fotos_ia', null, { error: 'Foto de origen inválida' });
    return;
  }
  const r = await fetch(src, { signal: AbortSignal.timeout(20000) });
  if (!r.ok) { await db.registrarEvento(c, 'fotos_ia', null, { error: `No se pudo leer la foto (${r.status})` }); return; }
  const mime = (r.headers.get('content-type') || 'image/jpeg').split(';')[0];
  const img = Buffer.from(await r.arrayBuffer()).toString('base64');

  const { GoogleGenAI } = await import('@google/genai');
  const ai = new GoogleGenAI({}); // GEMINI_API_KEY + GOOGLE_GEMINI_BASE_URL los pone el AI Gateway
  const fotos = [], errores = [];
  for (const p of PEDIDOS) {
    try {
      const g = await generar(ai, img, mime, p.prompt);
      const ext = g.mime.includes('jpeg') ? 'jpg' : g.mime.includes('webp') ? 'webp' : 'png';
      const url = await db.subirFoto(c, `ia-${Date.now()}-${p.id}-${crypto.randomBytes(4).toString('hex')}.${ext}`, g.buf, g.mime);
      fotos.push({ id: p.id, url, modelo: g.model });
    } catch (e) { errores.push({ id: p.id, error: String(e.message || e).slice(0, 250) }); }
  }
  await db.registrarEvento(c, 'fotos_ia', null, { src, fotos, errores });
};
