// Fotos de producto con IA (Gemini por el AI Gateway de Netlify). Función de fondo (formato moderno de Netlify,
// que es el que recibe las credenciales del AI Gateway): responde 202 al instante y trabaja hasta 15 min.
// La llama el botón "Crear fotos con IA" del panel, con la clave del panel (ADMIN_TOKEN):
//   POST /api/fotos-ia-background  { src: <foto principal>, trabajo: "IA-xxxx", colores: [{n,h}], porColor: 1|2|3, soloPar: bool }
// Por cada color crea 1 foto (misma pose), 2 (+ vista lateral) o 3 (+ el par junto sin piernas, fondo blanco de catálogo).
// soloPar: solo el par junto. Prompt fijo que sirve para cualquier zapato.
// Logo MF en la plantilla: solo si la foto original muestra el zapato SIN pies/piernas y con la plantilla vacía a la vista
// (una revisión previa con IA lo decide). Si no, el logo ni se envía, así que no puede aparecer en la piel ni en el fondo.
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
  'heel shape and heel height, sole and proportions. Do not add, remove or redesign any detail. Soft professional lighting. ' +
  'If legs or feet appear, keep them natural and realistic. ' +
  'Photorealistic, sharp focus, high detail, full shoe visible. ';
// Marca: el logo MF estampado en la plantilla, como en los zapatos de lujo. Si no llega el logo, no se pide.
const MARCA = 'BRAND STAMP: the second attached image is the MF brand logo (the letters M and F joined, thin lines). Print this exact ' +
  'logo ONCE on the empty inner insole (footbed), in the heel area (the back part of the insole where the heel rests), never near the toe. ' +
  'Style: a small, discreet, thin black print like a fine screen-printed luxury brand mark, about one fifth of the insole width, ' +
  'upright and readable (not mirrored, not rotated sideways), sitting naturally on the insole surface with the insole perspective. ' +
  'Use black print (gold only if the insole is black or very dark). Only one logo per image: if two shoes appear, put it only on the ' +
  'shoe whose insole is most visible. Copy the logo shape exactly; do not redraw, rename or add letters. Never put it on skin, feet, ' +
  'legs, straps, the outer sole, the heel, the box or the background. If no empty insole is visible, do not add the logo anywhere. ' +
  'No other text, logos or watermarks anywhere in the image. ';
const SIN_MARCA = 'No text, logos or watermarks. ';
const LOGO_URL = `${process.env.URL || 'https://tienda.mfcol.com'}/assets/brand/avatar-blanco-512.png`;
const COLOR = (n, h) => `Make the shoe in the color ${n} (approximately ${h}): recolor ONLY the main material of the shoe (upper, straps, ` +
  'insole and sole edge). Parts that are transparent or clear stay transparent; metal hardware, rhinestones and other embellishments ' +
  'keep their finish unless they are obviously the same material as the main color. ';
const FONDO = 'Keep the same soft neutral background as the reference. ';
const VISTAS = [
  FONDO + 'Keep the same pose, camera angle and framing as the reference photo.',
  FONDO + 'Show the shoe from a different angle: a clean side profile (outer side) of one shoe, heel on the left and toe on the right, centered with margin.',
  // El par junto: sin personas, de catálogo. Sirve aunque la foto original tenga piernas.
  'Create a new catalog photo of the PAIR of shoes together, without any person: no feet, no legs, no hands, no clothing. ' +
  'Both shoes stand side by side on the floor in a three-quarter front view, toes pointing to the front-left, one shoe slightly behind ' +
  'the other so the platform, the straps and the heel of both are clearly visible. Pure white seamless studio background with a soft ' +
  'natural contact shadow under the shoes, like a luxury e-commerce catalog photo. Ignore the original background, floor, box, props ' +
  'and any text from the reference.',
];
const RE_HEX = /^#[0-9a-fA-F]{6}$/;
const MAX_COLORES = 6;

async function generar(ai, img, mime, prompt, logo) {
  const fallos = [];
  for (const model of MODELOS) {
    try {
      const r = await ai.models.generateContent({
        model,
        contents: [{ role: 'user', parts: [{ inlineData: { mimeType: mime, data: img } }]
          .concat(logo ? [{ inlineData: { mimeType: 'image/png', data: logo } }] : [], [{ text: prompt }]) }],
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

// Revisión previa: ¿el zapato está puesto (pies/piernas) y se ve la plantilla vacía? Ante cualquier duda o error: sin logo.
const REVISION = 'Look at this shoe product photo and answer ONLY with JSON like {"pies": true, "plantilla": false}. ' +
  '"pies": true if any human foot, toe or leg is inside, wearing or touching the shoe. ' +
  '"plantilla": true if the inner insole (footbed) of at least one shoe is clearly visible and empty (nothing on it).';
async function admiteLogo(ai, img, mime) {
  for (const model of ['gemini-2.5-flash', 'gemini-2.5-flash-lite']) {
    try {
      const r = await ai.models.generateContent({
        model,
        contents: [{ role: 'user', parts: [{ inlineData: { mimeType: mime, data: img } }, { text: REVISION }] }],
        config: { responseMimeType: 'application/json' },
      });
      const parts = (r.candidates && r.candidates[0] && r.candidates[0].content && r.candidates[0].content.parts) || [];
      const txt = parts.map((x) => x.text || '').join('');
      const j = JSON.parse(txt.slice(txt.indexOf('{'), txt.lastIndexOf('}') + 1));
      return j.pies === false && j.plantilla === true;
    } catch (e) { console.error(`[fotos-ia] revisión ${model}: ${String(e && e.message || e).slice(0, 160)}`); }
  }
  return false;
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
  // Vistas pedidas (índices de VISTAS): 1 = misma pose, 2 = + de lado, 3 = + el par junto; soloPar = solo el par.
  const nv = Number(b.porColor) === 3 ? 3 : Number(b.porColor) === 2 ? 2 : 1;
  const vistas = b.soloPar === true ? [2] : [0, 1, 2].slice(0, nv);
  if (!colores.length) { await fin({ error: 'Agrega al menos un color sin foto para que la IA lo cree' }); return; }
  const pedidas = colores.length * vistas.length;

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

  // Logo de la tienda para estamparlo en la plantilla; si no se puede leer, las fotos se crean sin logo.
  let logo = null;
  try { const l = await fetch(LOGO_URL, { signal: AbortSignal.timeout(10000) }); if (l.ok) logo = Buffer.from(await l.arrayBuffer()).toString('base64'); } catch (e) { logo = null; }
  if (!logo) console.error('[fotos-ia] no se pudo leer el logo; las fotos salen sin marca');
  const ai = new GoogleGenAI({}); // GEMINI_API_KEY + GOOGLE_GEMINI_BASE_URL los pone el AI Gateway
  // Con pies de la modelo o sin plantilla vacía a la vista: sin logo en las vistas que copian la foto original.
  // El par junto no lleva personas, así que ahí siempre puede ir el logo en la plantilla.
  const logoPose = logo && vistas.some((v) => v < 2) && (await admiteLogo(ai, img, mime)) ? logo : null;
  const fotos = [], errores = [];
  for (const k of colores) {
    for (const v of vistas) {
      const lg = v === 2 ? logo : logoPose;
      try {
        const g = await generar(ai, img, mime, BASE + COLOR(k.n, k.h) + VISTAS[v] + ' ' + (lg ? MARCA : SIN_MARCA), lg);
        const ext = g.mime.includes('jpeg') ? 'jpg' : g.mime.includes('webp') ? 'webp' : 'png';
        const slug = k.n.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').slice(0, 20);
        const url = await db.subirFoto(c, `ia-${Date.now()}-${slug}-${v + 1}-${crypto.randomBytes(4).toString('hex')}.${ext}`, g.buf, g.mime);
        fotos.push({ color: k.n, vista: v + 1, url });
      } catch (e) { errores.push({ color: k.n, vista: v + 1, error: String(e.message || e).slice(0, 300) }); }
    }
  }
  await fin({ src, fotos, errores, marca: !!(logo || logoPose) });
};
