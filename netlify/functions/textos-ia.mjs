// Nombre y descripción de producto con IA, a partir de la foto principal (botón del panel, con la clave ADMIN_TOKEN).
//   POST /api/textos-ia  { src: <foto principal> }  →  { nombre, descripcion }
// Estilo de la tienda: descripción corta (una frase con emoji) que termina en "ALTURA - X CM". No repite nombres del catálogo.
// Nada se guarda aquí: el panel llena los campos y la persona revisa antes de tocar "Guardar".
import crypto from 'crypto';
import process from 'process';
import { GoogleGenAI } from '@google/genai';
import configMod from '../../lib/config.js';
import db from '../../lib/db.js';

const { cfg } = configMod;
const json = (status, body) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
});
// Modelos de TEXTO por el AI Gateway de Netlify. Los Gemini 2.5 de texto NO están disponibles en el gateway
// ("unable to find suitable provider"); se prueban los Gemini 3 y, de respaldo, los de imagen (que sí responden texto).
const MODELOS_TEXTO = ['gemini-3-flash-preview', 'gemini-3-pro-preview', 'gemini-3-pro-image-preview', 'gemini-2.5-flash-image'];
async function textoIA(ai, parts, etiqueta) {
  for (const model of MODELOS_TEXTO) {
    try {
      const r = await ai.models.generateContent({ model, contents: [{ role: 'user', parts }], config: model.includes('image') ? { responseModalities: ['TEXT'] } : {} });
      const ps = (r.candidates && r.candidates[0] && r.candidates[0].content && r.candidates[0].content.parts) || [];
      const txt = ps.map((x) => x.text || '').join(' ').trim();
      if (txt) return txt;
    } catch (e) { console.error(`[${etiqueta}] ${model}: ${String(e && e.message || e).slice(0, 160)}`); }
  }
  return '';
}
const jsonDe = (txt) => JSON.parse(txt.slice(txt.indexOf('{'), txt.lastIndexOf('}') + 1));

function fuenteValida(c, src) {
  return src.startsWith(`${c.db}/storage/v1/object/public/productos/`) || /^https:\/\/cdn\.shopify\.com\/[^\s"'<>]{4,400}$/.test(src);
}

const PROMPT = (usados) => 'Eres la redactora de MF Colombia (Marlon Footwear), una tienda colombiana de calzado femenino de lujo. ' +
  'Mira SOLO el zapato de la foto (ignora personas, fondo, cajas y cualquier marca o texto que aparezca) y responde SOLO con JSON ' +
  '{"nombre": "...", "descripcion": "..."} en español.\n' +
  'NOMBRE: elegante y vendedor, de 1 a 3 palabras, en el estilo de la tienda (ejemplos: "Centella", "Black Soul", "Ivory Queen", ' +
  '"Sandalia Verona Platform", "Valentina Crystal", "Luz Serena"). Según el tipo puede empezar con "Sandalia" o "Tacones". ' +
  'No uses nombres de otras marcas ni de famosos. No repitas ninguno de estos nombres que ya existen: ' + usados.join(', ') + '.\n' +
  'DESCRIPCION: súper corta, una sola frase (máximo 22 palabras) que resalte lo que se ve (tipo, tiras, plataforma, transparencia, ' +
  'brillo, color) con un tono femenino y seguro, un emoji al final de la frase, y al final "ALTURA - X CM" con la altura aproximada ' +
  'del tacón en centímetros (número entero o con /2 para medios, ej. 12 o 9/5). Ejemplos del estilo:\n' +
  '"Plataforma tipo mule con tacón aguja y tira transparente: brillo y altura en cada paso. ✨ ALTURA - 12 CM"\n' +
  '"Tacón cristal nude con punta cuadrada – delicada, alta y encantadora. 💫 ALTURA - 8/5 CM"\n' +
  '"Punta fina y correas cruzadas – diseño clásico que enciende miradas. 🔥 ALTURA - 10 CM"';

export default async (req) => {
  try {
    const c = cfg('admin');
    const auth = String(req.headers.get('authorization') || '');
    const t = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
    if (!t || t.length !== c.admin.length || !crypto.timingSafeEqual(Buffer.from(t), Buffer.from(c.admin))) return json(401, { error: 'No autorizado' });
    if (req.method !== 'POST') return json(405, { error: 'Método no permitido' });
    let b = {};
    try { b = await req.json(); } catch (e) { b = {}; }
    const src = String(b.src || '').trim();
    if (!fuenteValida(c, src)) return json(400, { error: 'Primero sube la foto principal del zapato' });
    if (!process.env.GEMINI_API_KEY) return json(503, { error: 'La IA no está disponible en este momento' });
    const r = await fetch(src, { signal: AbortSignal.timeout(15000) });
    if (!r.ok) return json(400, { error: 'No se pudo leer la foto principal' });
    const mime = (r.headers.get('content-type') || 'image/jpeg').split(';')[0];
    if (!/^image\/(jpeg|png|webp)$/.test(mime)) return json(400, { error: 'La foto principal debe ser JPG, PNG o WEBP' });
    const img = Buffer.from(await r.arrayBuffer()).toString('base64');
    const prods = (await db.listarProductosAdmin(c)) || [];
    const usados = prods.map((p) => String(p.nombre || '').trim()).filter(Boolean).slice(0, 200);
    const enUso = new Set(usados.map((n) => n.toLowerCase()));
    const ai = new GoogleGenAI({}); // GEMINI_API_KEY + GOOGLE_GEMINI_BASE_URL los pone el AI Gateway
    const txt = await textoIA(ai, [{ inlineData: { mimeType: mime, data: img } }, { text: PROMPT(usados) }], 'textos-ia');
    try {
      const j = jsonDe(txt);
      let nombre = String(j.nombre || '').replace(/["<>]/g, '').trim().slice(0, 60);
      const descripcion = String(j.descripcion || '').replace(/[<>]/g, '').trim().slice(0, 400);
      if (nombre && descripcion) {
        if (enUso.has(nombre.toLowerCase())) nombre = nombre + ' MF';
        return json(200, { nombre, descripcion });
      }
    } catch (e) { console.error('[textos-ia] respuesta sin JSON válido'); }
    return json(502, { error: 'La IA no pudo escribir el nombre esta vez. Inténtalo de nuevo.' });
  } catch (e) {
    console.error('[textos-ia]', e && e.message ? e.message : e);
    return json(500, { error: 'No se pudo completar' });
  }
};
