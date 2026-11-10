// Fotos de producto con IA (Gemini por el AI Gateway de Netlify). Función de fondo (formato moderno de Netlify,
// que es el que recibe las credenciales del AI Gateway): responde 202 al instante y trabaja hasta 15 min.
// La llama el botón "Crear fotos con IA" del panel, con la clave del panel (ADMIN_TOKEN):
//   POST /api/fotos-ia-background  { src: <foto principal>, trabajo: "IA-xxxx", colores: [{n,h}], porColor: 1|2 }
// Por cada color crea 1 foto (misma pose) o 2 (misma pose + vista lateral) con un prompt fijo que sirve para cualquier zapato.
// Las fotos quedan en el bucket "productos" y el resultado en eventos (tipo "fotos_ia", referencia = trabajo).
import crypto from 'crypto';
import process from 'process';
import { GoogleGenAI } from '@google/genai';
import configMod from '../../lib/config.js';
import db from '../../lib/db.js';

const { cfg } = configMod;
const MODELOS = ['gemini-3-pro-image-preview', 'gemini-2.5-flash-image'];

// Prompt fijo de la tienda: sirve para cualquier zapato. La foto subida es la referencia exacta del modelo.
const BASE = 'You are editing a professional e-commerce product photo of a shoe for an online store. The attached photo is the exact ' +
  'reference of the product. Keep the EXACT same shoe model: same shape, toe, straps, buckles, embellishments, stitching, materials, ' +
  'heel shape and heel height, sole and proportions. Do not add, remove or redesign any detail. Keep the same soft neutral studio ' +
  'background and the same soft professional lighting as the reference. If legs or feet appear, keep them natural and realistic. ' +
  'Photorealistic, sharp focus, high detail, full shoe visible. No text, logos or watermarks. ';
const COLOR = (n, h) => `Make the shoe in the color ${n} (approximately ${h}): recolor ONLY the main material of the shoe (upper, straps, ` +
  'insole and sole edge). Parts that are transparent or clear stay transparent; metal hardware, rhinestones and other embellishments ' +
  'keep their finish unless they are obviously the same material as the main color. ';
const VISTAS = [
  'Keep the same pose, camera angle and framing as the reference photo.',
  'Show the shoe from a different angle: a clean side profile (outer side) of one shoe, heel on the left and toe on the right, centered with margin.',
];
const RE_HEX = /^#[0-9a-fA-F]{6}$/;
const MAX_COLORES = 6;

async function generar(ai, img, mime, prompt) {
  const fallos = [];
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
      fallos.push(`${model}: sin imagen en la respuesta`);
    } catch (e) { fallos.push(`${model}: ${String(e && e.message || e).slice(0, 160)}`); }
  }
  throw new Error(fallos.join(' | '));
}

const RE_TRABAJO = /^IA-[a-z0-9]{6,24}$/;
const MAX_FOTOS_DIA = 40; // fotos por día entre todas las tandas, para no gastar créditos de más

function fuenteValida(c, src) {
  return src.startsWith(`${c.db}/storage/v1/object/public/productos/`) || /^https:\/\/cdn\.shopify\.com\/[^\s"'<>]{4,400}$/.test(src);
}

export default async (req) => {
  const c = cfg('admin');
  const auth = String(req.headers.get('authorization') || '');
  const t = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!t || t.length !== c.admin.length || !crypto.timingSafeEqual(Buffer.from(t), Buffer.from(c.admin))) {
    console.error('[fotos-ia] no autorizado');
    return;
  }
  let b = {};
  try { b = await req.json(); } catch (e) { b = {}; }
  const trabajo = String(b.trabajo || '');
  if (!RE_TRABAJO.test(trabajo)) { console.error('[fotos-ia] trabajo inválido'); return; }
  const fin = (detalle) => db.registrarEvento(c, 'fotos_ia', trabajo, detalle);

  const colores = (Array.isArray(b.colores) ? b.colores : [])
    .map((k) => ({ n: String(k && k.n || '').trim().slice(0, 30), h: String(k && k.h || '') }))
    .filter((k) => k.n && RE_HEX.test(k.h)).slice(0, MAX_COLORES);
  const porColor = Number(b.porColor) === 2 ? 2 : 1;
  if (!colores.length) { await fin({ error: 'Agrega al menos un color sin foto para que la IA lo cree' }); return; }
  const pedidas = colores.length * porColor;

  const hoy = Date.now() - 24 * 3600 * 1000;
  const recientes = (await db.eventosPorTipo(c, ['fotos_ia'], 100)) || [];
  const usadas = recientes.filter((e) => new Date(e.creado_en).getTime() > hoy)
    .reduce((n, e) => n + ((e.detalle && Array.isArray(e.detalle.fotos)) ? e.detalle.fotos.length : 0), 0);
  if (usadas + pedidas > MAX_FOTOS_DIA) {
    await fin({ error: `Límite diario de ${MAX_FOTOS_DIA} fotos con IA: hoy quedan ${Math.max(0, MAX_FOTOS_DIA - usadas)}. Pide menos colores o intenta mañana.` });
    return;
  }
  const src = String(b.src || '').trim();
  if (!fuenteValida(c, src)) { await fin({ error: 'La foto principal debe estar subida en la tienda' }); return; }
  if (!process.env.GEMINI_API_KEY) { await fin({ error: 'La IA no está disponible en este momento (AI Gateway sin credenciales)' }); return; }
  const r = await fetch(src, { signal: AbortSignal.timeout(20000) });
  if (!r.ok) { await fin({ error: `No se pudo leer la foto principal (${r.status})` }); return; }
  const mime = (r.headers.get('content-type') || 'image/jpeg').split(';')[0];
  if (!/^image\/(jpeg|png|webp)$/.test(mime)) { await fin({ error: 'La foto principal debe ser JPG, PNG o WEBP' }); return; }
  const img = Buffer.from(await r.arrayBuffer()).toString('base64');

  const ai = new GoogleGenAI({}); // GEMINI_API_KEY + GOOGLE_GEMINI_BASE_URL los pone el AI Gateway
  const fotos = [], errores = [];
  for (const k of colores) {
    for (let v = 0; v < porColor; v++) {
      try {
        const g = await generar(ai, img, mime, BASE + COLOR(k.n, k.h) + VISTAS[v]);
        const ext = g.mime.includes('jpeg') ? 'jpg' : g.mime.includes('webp') ? 'webp' : 'png';
        const slug = k.n.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').slice(0, 20);
        const url = await db.subirFoto(c, `ia-${Date.now()}-${slug}-${v + 1}-${crypto.randomBytes(4).toString('hex')}.${ext}`, g.buf, g.mime);
        fotos.push({ color: k.n, vista: v + 1, url });
      } catch (e) { errores.push({ color: k.n, vista: v + 1, error: String(e.message || e).slice(0, 300) }); }
    }
  }
  await fin({ src, fotos, errores });
};
