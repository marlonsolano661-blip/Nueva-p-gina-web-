// Pasarela en video con IA (Google Veo 3.1): la foto de frente del look cobra vida y la modelo camina como en un desfile.
// Función de fondo: responde 202 al instante y trabaja hasta 15 min. La llama el botón "🎬 Crear pasarela en video" del editor
// de looks (Outfits) con la clave del panel (ADMIN_TOKEN):
//   POST /api/pasarela-ia-background { trabajo: "IA-xxxx", foto: <foto de frente del look>, tacon?: <foto del tacón>,
//                                      formato: "vertical" | "horizontal", calidad: "rapida" | "alta",
//                                      tipo: "pasarela" | "mano" }
// tipo "mano": video estilo UGC (como los de TikTok/Instagram): unas manos con uñas cuidadas y anillos dorados sostienen el
// tacón MF y lo giran despacio para mostrarlo por todos lados. Primero la IA de fotos (AI Gateway) crea el cuadro inicial con el
// zapato EXACTO de la tienda en las manos, y luego Veo lo anima. Solo necesita la foto del tacón ("tacon").
// El resultado queda en eventos (tipo "fotos_ia", referencia = trabajo, detalle.videos) y se consulta con /api/fotos-ia-estado.
//
// IMPORTANTE: el AI Gateway de Netlify no ofrece video. Esta función usa una clave propia de Google AI Studio
// en la variable GOOGLE_VEO_API_KEY (Netlify → Project configuration → Environment variables). Los videos se cobran
// en esa cuenta de Google, no en créditos de Netlify. Sin la clave, la función responde con un aviso claro y no gasta nada.
// No se usa GEMINI_API_KEY a propósito: esa la pone el AI Gateway para las fotos y no debe pisarse.
import crypto from 'crypto';
import process from 'process';
import { GoogleGenAI } from '@google/genai';
import configMod from '../../lib/config.js';
import db from '../../lib/db.js';

const { cfg } = configMod;
const RE_TRABAJO = /^IA-[a-z0-9]{6,24}$/;
const MAX_VIDEOS_DIA = 6;               // tope diario para que el gasto en Google no se dispare
const LIMITE_MS = 13 * 60 * 1000;
// Modelos de video en orden de preferencia. GOOGLE_VEO_MODEL permite fijar otro sin tocar el código.
const MODELOS = {
  rapida: ['veo-3.1-fast-generate-preview', 'veo-3.1-fast-generate-001', 'veo-3.1-generate-preview'],
  alta: ['veo-3.1-generate-preview', 'veo-3.1-generate-001', 'veo-3.1-fast-generate-preview'],
};

const PROMPT = 'Professional fashion runway video for the shoe brand MARLON FOOTWEAR. The woman from the image walks a catwalk toward the camera ' +
  'with a confident, elegant model walk, natural arm swing and realistic weight shift, then pauses, poses for a beat and turns slightly so the ' +
  'heels are seen from the side. She is EXACTLY the same woman with the same face, hair, body, clothes and shoes as in the image for the whole ' +
  'video. The shoes are the hero: keep their exact design, heel height and shape, platform, straps and color in every frame, sharp and in focus, ' +
  'feet and heels fully visible, correct anatomy, heels touching the floor naturally. Set: a bright minimalist loft studio with warm beige plaster ' +
  'walls, exposed white ceiling beams, a low curved beige sofa and a polished concrete floor, soft natural window daylight; smooth slow camera ' +
  'tracking backward, shallow depth of field, photorealistic like a real fashion campaign video, 24fps cinematic look. At the end she glances back ' +
  'over her shoulder at the camera. ' +
  'Audio: subtle elegant runway music and the sound of heels on the floor. No text, no logos, no captions, no extra people.';
const PROMPT_MANO = 'Realistic handheld UGC-style product video, first-person point of view, filmed on a phone in vertical format. A woman with ' +
  'long almond-shaped chrome/silver manicured nails and chunky gold rings holds the shoe from the image with both hands over her lap (light-wash ' +
  'blue jeans), and slowly turns and tilts it to show it from every angle: the side profile, the heel, the toe and the back, then brings it a ' +
  'little closer to the camera. Smooth, natural, unhurried hand movements, slight natural handheld camera sway, soft daylight from a window, ' +
  'cozy aesthetic home background softly out of focus. The shoe is EXACTLY the shoe in the image in every frame: same design, heel height and ' +
  'shape, platform, toe, straps, material, color and finish; it never changes or deforms; correct finger anatomy (five fingers per hand). ' +
  'Audio: quiet room ambience and soft sounds of handling the shoe. No text, no logos, no captions, no faces.';
const FRAME_MANO = 'Create the FIRST FRAME of a vertical 9:16 handheld phone video, first-person point of view looking down: a woman\'s hands with ' +
  'long almond-shaped chrome/silver manicured nails and chunky gold rings hold EXACTLY the shoe from the SHOE photo, shown in side profile, over her lap ' +
  'in light-wash blue jeans; cozy aesthetic home interior softly out of focus behind (rug, framed art), soft natural window daylight, photorealistic ' +
  'iPhone photo, real skin texture. The shoe is the definitive product reference: same design, heel height and shape, platform, toe, straps, ' +
  'buckles, material, color and finish; do not change or simplify anything. Correct hand anatomy, five fingers per hand. No text, no logos.';
const IMAGEN_IA = ['gemini-3-pro-image-preview', 'gemini-3.1-flash-image-preview', 'gemini-2.5-flash-image'];
const NEGATIVO = 'cartoon, CGI look, plastic skin, morphing face, changing outfit, changing shoes, extra limbs, deformed feet, floating, ' +
  'flat shoes, sneakers, text, watermark, logo, blurry feet, cropped feet';

function fuenteValida(c, src) {
  return typeof src === 'string' && src.startsWith(`${c.db}/storage/v1/object/public/productos/`) && !/["'<>\s]/.test(src);
}
async function leer(src) {
  const r = await fetch(src, { signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error(`No se pudo leer la foto (${r.status})`);
  const mimeType = (r.headers.get('content-type') || 'image/jpeg').split(';')[0];
  if (!/^image\/(jpeg|png|webp)$/.test(mimeType)) throw new Error('La foto debe ser JPG, PNG o WEBP');
  return { mimeType, imageBytes: Buffer.from(await r.arrayBuffer()).toString('base64') };
}
const esperar = (ms) => new Promise((ok) => setTimeout(ok, ms));
// Sube el .mp4 al bucket público "productos" de Supabase (el mismo de las fotos), con más tiempo que una foto.
async function subirVideo(c, nombre, buf) {
  const h = { apikey: c.key, 'Content-Type': 'video/mp4', 'x-upsert': 'false', 'cache-control': 'max-age=31536000' };
  if (c.key.startsWith('eyJ')) h.Authorization = 'Bearer ' + c.key;
  const r = await fetch(`${c.db}/storage/v1/object/productos/${nombre}`, { method: 'POST', headers: h, body: buf, signal: AbortSignal.timeout(90000) });
  if (!r.ok) throw new Error(`No se pudo guardar el video (${r.status}) ${(await r.text().catch(() => '')).slice(0, 160)}`);
  return `${c.db}/storage/v1/object/public/productos/${nombre}`;
}

// Cuadro inicial del video "en la mano": lo crea la IA de fotos del AI Gateway de Netlify (Nano Banana) con el zapato exacto.
async function cuadroMano(zapato) {
  if (!process.env.GEMINI_API_KEY) throw new Error('La IA de fotos no está disponible (AI Gateway sin credenciales)');
  const ai = new GoogleGenAI({}); // GEMINI_API_KEY + GOOGLE_GEMINI_BASE_URL los pone el AI Gateway
  const parts = [{ text: 'SHOE photo (the exact product):' }, { inlineData: { mimeType: zapato.mimeType, data: zapato.imageBytes } }, { text: FRAME_MANO }];
  const fallos = [];
  for (const model of IMAGEN_IA) {
    for (const config of [{ responseModalities: ['IMAGE', 'TEXT'], imageConfig: { aspectRatio: '9:16' } }, { responseModalities: ['IMAGE', 'TEXT'] }]) {
      try {
        const r = await ai.models.generateContent({ model, contents: [{ role: 'user', parts }], config });
        const ps = (r.candidates && r.candidates[0] && r.candidates[0].content && r.candidates[0].content.parts) || [];
        const p = ps.find((x) => x.inlineData && x.inlineData.data);
        if (p) return { mimeType: p.inlineData.mimeType || 'image/png', imageBytes: p.inlineData.data };
        fallos.push(`${model}: sin imagen`); break;
      } catch (e) {
        const m = String(e && e.message || e);
        if (config.imageConfig && /imageConfig|aspect|invalid/i.test(m)) continue;
        fallos.push(`${model}: ${m.replace(/\s+/g, ' ').slice(0, 120)}`); break;
      }
    }
  }
  throw new Error('No se pudo crear el cuadro inicial: ' + fallos.join(' | '));
}

export default async (req) => {
  const c = cfg('admin');
  const auth = String(req.headers.get('authorization') || '');
  const t = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!t || t.length !== c.admin.length || !crypto.timingSafeEqual(Buffer.from(t), Buffer.from(c.admin))) { console.error('[pasarela-ia] no autorizado'); return; }
  let b = {};
  try { b = await req.json(); } catch (e) { b = {}; }
  const trabajo = String(b.trabajo || '');
  if (!RE_TRABAJO.test(trabajo)) { console.error('[pasarela-ia] trabajo inválido'); return; }
  const fin = (detalle) => db.registrarEvento(c, 'fotos_ia', trabajo, detalle);
  const t0 = Date.now();
  try {
    const clave = String(process.env.GOOGLE_VEO_API_KEY || '').trim();
    if (!clave) { await fin({ error: 'Falta la clave de Google para video (GOOGLE_VEO_API_KEY en Netlify). Las fotos siguen funcionando.' }); return; }
    const mano = b.tipo === 'mano';
    const foto = String(b.foto || '').trim(), tacon = String(b.tacon || '').trim();
    if (mano && !fuenteValida(c, tacon)) { await fin({ error: 'Elige el tacón del look (con foto en la tienda)' }); return; }
    if (!mano && !fuenteValida(c, foto)) { await fin({ error: 'Primero crea o sube la foto de frente del look' }); return; }
    const vertical = mano || b.formato !== 'horizontal';
    const calidad = b.calidad === 'alta' ? 'alta' : 'rapida';

    const hoy = Date.now() - 24 * 3600 * 1000;
    const hechos = ((await db.eventosPorTipo(c, ['fotos_ia'], 100)) || []).filter((e) => new Date(e.creado_en).getTime() > hoy)
      .reduce((n, e) => n + ((e.detalle && Array.isArray(e.detalle.videos)) ? e.detalle.videos.length : 0), 0);
    if (hechos >= MAX_VIDEOS_DIA) { await fin({ error: `Límite diario de ${MAX_VIDEOS_DIA} videos con IA. Intenta mañana.` }); return; }

    const imagen = mano ? await cuadroMano(await leer(tacon)) : await leer(foto);
    const ai = new GoogleGenAI({ apiKey: clave });
    const fijo = String(process.env.GOOGLE_VEO_MODEL || '').trim();
    const lista = fijo ? [fijo] : MODELOS[calidad];
    const fallos = [];
    let op = null, modelo = '';
    for (const m of lista) {
      try {
        op = await ai.models.generateVideos({
          model: m,
          prompt: mano ? PROMPT_MANO : PROMPT,
          image: imagen,
          config: { aspectRatio: vertical ? '9:16' : '16:9', numberOfVideos: 1, negativePrompt: NEGATIVO },
        });
        modelo = m; break;
      } catch (e) {
        const msg = String(e && e.message || e).replace(/\s+/g, ' ').slice(0, 200);
        fallos.push(`${m}: ${msg}`);
        if (!/not found|not supported|404|unknown model|is not available/i.test(msg)) break; // error real (clave, saldo, política): no seguir probando
      }
    }
    if (!op) { await fin({ error: 'Google no aceptó el video: ' + fallos.join(' | ') }); return; }

    while (!op.done) {
      if (Date.now() - t0 > LIMITE_MS) { await fin({ error: 'El video está tardando demasiado. Intenta de nuevo en unos minutos.' }); return; }
      await esperar(10000);
      op = await ai.operations.getVideosOperation({ operation: op });
    }
    if (op.error) { await fin({ error: 'Google no pudo crear el video: ' + String(op.error.message || JSON.stringify(op.error)).slice(0, 300) }); return; }
    const gen = op.response && op.response.generatedVideos && op.response.generatedVideos[0];
    const v = gen && gen.video;
    if (!v) {
      const filtro = op.response && op.response.raiMediaFilteredReasons;
      await fin({ error: 'Google no devolvió video' + (filtro && filtro.length ? ': ' + String(filtro[0]).slice(0, 200) : '. Prueba con otra foto.') });
      return;
    }
    let buf;
    if (v.videoBytes) buf = Buffer.from(v.videoBytes, 'base64');
    else if (v.uri) {
      const r = await fetch(v.uri, { headers: { 'x-goog-api-key': clave }, redirect: 'follow', signal: AbortSignal.timeout(60000) });
      if (!r.ok) throw new Error(`No se pudo descargar el video (${r.status})`);
      buf = Buffer.from(await r.arrayBuffer());
    } else throw new Error('El video llegó vacío');
    const url = await subirVideo(c, `pasarela-ia-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.mp4`, buf);
    await fin({ videos: [{ url, tipo: mano ? 'mano' : 'pasarela', formato: vertical ? 'vertical' : 'horizontal', modelo }], segundos: Math.round((Date.now() - t0) / 1000) });
  } catch (e) {
    console.error('[pasarela-ia]', e && e.message ? e.message : e);
    await fin({ error: String(e && e.message || e).slice(0, 600) });
  }
};
