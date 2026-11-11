// Fotos de outfit con IA: TU modelo (foto real) con las prendas y el tacón MF elegidos, como foto de estudio de la pasarela.
// Función de fondo (Gemini por el AI Gateway de Netlify): responde 202 al instante y trabaja hasta 15 min.
// La llama el botón "✨ Crear fotos con IA" del editor de looks (Outfits) con la clave del panel (ADMIN_TOKEN):
//   POST /api/outfit-ia-background { trabajo: "IA-xxxx", modelo: <foto de la modelo>, tacon: <foto del tacón>,
//                                    prendas: [<foto de prenda>, ...] (0 a 3), vistas: ["frente","lado","espalda","editorial"] }
// Sin prendas, la modelo conserva la ropa de su foto y solo se cambian los zapatos (reglas del "MF AI Model Studio").
// Pasos ("varios cerebros", igual que las fotos de producto):
//   1) un experto describe el tacón y cada prenda con precisión (fichas que se suman al prompt),
//   2) el modelo de imagen crea la foto de frente; lado y espalda se crean a partir de esa misma foto (misma persona y ropa),
//   3) un revisor compara cada foto con las referencias y, si falla, se rehace una vez.
// El resultado queda en eventos (tipo "fotos_ia", referencia = trabajo) y se consulta con /api/fotos-ia-estado.
// Comparte con las fotos de producto el límite diario de fotos con IA.
import crypto from 'crypto';
import process from 'process';
import { GoogleGenAI } from '@google/genai';
import configMod from '../../lib/config.js';
import db from '../../lib/db.js';

const { cfg } = configMod;
const MODELOS = ['gemini-3-pro-image-preview', 'gemini-2.5-flash-image'];
const MODELOS_TEXTO = ['gemini-3-flash-preview', 'gemini-3-pro-preview', 'gemini-3-pro-image-preview', 'gemini-2.5-flash-image'];
const RE_TRABAJO = /^IA-[a-z0-9]{6,24}$/;
const MAX_FOTOS_DIA = 40;
const MAX_PRENDAS = 3;
const VISTAS = ['frente', 'lado', 'espalda', 'editorial'];

const ESTUDIO = 'You are a fashion creative director and professional footwear photographer shooting the premium international catalog of ' +
  'the shoe brand MARLON FOOTWEAR (MF). Photorealistic professional photo, shot on a full-frame camera with a 50mm lens, high resolution, ' +
  'natural skin texture, correct anatomy, realistic fabric folds and drape, realistic perspective, natural realistic shadows. White ' +
  'seamless studio background in a soft off-white (#F6F6F4, almost pure white, the same tone in every photo) with a soft natural floor shadow, professional even lighting, no props. Vertical 3:4 framing, the WHOLE body visible ' +
  'from the top of the head to the soles of the shoes, centered, with a small margin above the head and below the feet, camera at waist ' +
  'height. Relaxed natural model stance, arms relaxed. No text, logos or watermarks. ';
const PERSONA = 'IDENTITY: the person in the MODEL photo must stay exactly the same person: same face and facial features, same skin tone, ' +
  'same hair (color, length, style), same body shape and proportions. Do not beautify, slim or change her. ';
const ROPA = 'OUTFIT: dress her ONLY in the GARMENT photos, copied exactly: same cut, length, neckline, sleeves, fabric, texture, color, ' +
  'print and details. Ignore any hanger, mannequin, background or other person in the garment photos. Remove the clothes she wears in ' +
  'the MODEL photo. Do not add other clothes, jewelry or bags that are not in the garment photos. ';
const ROPA_PROPIA = 'OUTFIT: keep EXACTLY the same clothes, accessories and overall look she wears in the MODEL photo. Only her shoes change. ';
// La regla más importante de la marca: el calzado de la foto es la referencia definitiva y no se rediseña.
const ZAPATO = 'SHOES — THE MOST IMPORTANT RULE: replace only the shoes she wears with the exact product in the SHOE photo, on both feet, ' +
  'as if she really wore that same pair during the photo shoot. The product photo is the definitive visual reference. Reproduce it faithfully: ' +
  'same heel design, same heel height and geometry, same platform height and shape, same toe shape, same number and position of straps, ' +
  'same buckles and embellishments, same materials, colors, textures and finishes, same proportions. FORBIDDEN: changing the heel, the ' +
  'platform or the toe; inventing, removing or moving straps, buckles or embellishments; changing materials, colors or finishes; simplifying ' +
  'or reinterpreting the product; creating a similar shoe instead of the original. Respect foot anatomy and fit the shoe naturally to the ' +
  'position of the foot without deforming the product. The shoes must be clearly visible, sharp and in focus, without distortion. ';
const POSE = {
  frente: 'PHOTO 1, FRONT VIEW: full body facing the camera, elegant and confident pose, both shoes fully visible, focus on the front design of the shoes.',
  lado: 'PHOTO 2, SIDE VIEW: the same person in the same outfit and shoes, turned 90 degrees in a full side profile, clearly showing the ' +
    'height, shape and structure of the heel, shoes fully visible.',
  espalda: 'PHOTO 3, BACK VIEW: the same person in the same outfit and shoes, with her back to the camera, showing the back of the shoes ' +
    'with the original heel and strap structure, both shoes visible.',
  editorial: 'PHOTO 4, EDITORIAL POSE: the same person in the same outfit and shoes, professional, attractive and sophisticated fashion pose, ' +
    'one leg slightly forward to highlight the shoes, shoes clearly visible, high-end fashion campaign aesthetic, still on the same off-white studio background.',
};

const json = (txt) => JSON.parse(txt.slice(txt.indexOf('{'), txt.lastIndexOf('}') + 1));

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

// Imagen: prueba con proporción 3:4 y, si el modelo no la acepta, sin ella.
async function generar(ai, parts) {
  const fallos = [];
  for (const model of MODELOS) {
    for (const config of [{ responseModalities: ['IMAGE', 'TEXT'], imageConfig: { aspectRatio: '3:4' } }, { responseModalities: ['IMAGE', 'TEXT'] }]) {
      try {
        const r = await ai.models.generateContent({ model, contents: [{ role: 'user', parts }], config });
        const ps = (r.candidates && r.candidates[0] && r.candidates[0].content && r.candidates[0].content.parts) || [];
        const p = ps.find((x) => x.inlineData && x.inlineData.data);
        if (p) return { buf: Buffer.from(p.inlineData.data, 'base64'), mime: p.inlineData.mimeType || 'image/png' };
        fallos.push(`${model}: sin imagen`);
      } catch (e) { fallos.push(`${model}: ${String(e && e.message || e).slice(0, 140)}`); }
    }
  }
  throw new Error(fallos.join(' | '));
}

const FICHA_ZAPATO = 'You are a senior footwear product expert. Study ONLY the shoe in this photo and write a precise description in English ' +
  'for an image generator, 50 to 90 words, plain text: shoe type, toe shape, heel type and approximate height in cm, platform, every strap, ' +
  'closure, materials and finish, color. Do not mention people or background.';
const FICHA_PRENDA = 'You are a senior fashion product expert. Study ONLY the main garment in this photo (ignore hangers, mannequins, people ' +
  'and background) and write a precise description in English for an image generator, 40 to 80 words, plain text: garment type, cut and ' +
  'fit, length, neckline, sleeves, fabric and texture (sheer, satin, knit, denim...), exact color, print, closures and details.';
async function ficha(ai, im, prompt) {
  const t = (await textoIA(ai, [{ inlineData: im }, { text: prompt }], 'outfit-ia ficha')).replace(/\s+/g, ' ').trim();
  return t.length > 30 ? t.slice(0, 900) : '';
}

const CONTROL = (vista, conPrendas) => 'Image 1 is the MODEL reference, image 2 the SHOE reference, ' + (conPrendas ? 'the next images are the GARMENT references, ' : '') +
  'and the LAST image was generated. Answer ONLY with JSON like {"ok": true, "motivo": "short reason"}. "ok" must be false if in the last image: ' +
  'the person is clearly not the same person as in image 1 (face, skin tone, hair); the shoes are a different model or color than image 2; ' +
  (conPrendas ? 'the clothes are clearly different from the garment references (type, color, length, neckline); ' : 'the clothes are clearly different from the clothes in image 1; ') +
  'the body is cut off (head or shoes ' +
  `not fully visible); the view is not a ${vista} view; or the image looks broken, deformed (hands, feet) or unrealistic. ` +
  'Be strict with the shoes: different heel height or shape, different platform, different toe, extra or missing straps, buckles or ' +
  'embellishments, or different color or material all mean false. Otherwise true.';
async function revisar(ai, refs, g, vista) {
  const txt = await textoIA(ai, refs.map((im) => ({ inlineData: im })).concat([{ inlineData: { mimeType: g.mime, data: g.buf.toString('base64') } }, { text: CONTROL(vista, refs.length > 2) }]), 'outfit-ia revisión');
  try { const j = json(txt); return { ok: j.ok !== false, motivo: String(j.motivo || '').slice(0, 200) }; } catch (e) { return { ok: true, motivo: 'sin revisión' }; }
}

function fuenteValida(c, src) {
  return typeof src === 'string' && (src.startsWith(`${c.db}/storage/v1/object/public/productos/`) || /^https:\/\/cdn\.shopify\.com\/[^\s"'<>]{4,400}$/.test(src));
}
async function leer(src) {
  const r = await fetch(src, { signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error(`No se pudo leer una foto (${r.status})`);
  const mimeType = (r.headers.get('content-type') || 'image/jpeg').split(';')[0];
  if (!/^image\/(jpeg|png|webp)$/.test(mimeType)) throw new Error('Las fotos deben ser JPG, PNG o WEBP');
  return { mimeType, data: Buffer.from(await r.arrayBuffer()).toString('base64') };
}

export default async (req) => {
  const c = cfg('admin');
  const auth = String(req.headers.get('authorization') || '');
  const t = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!t || t.length !== c.admin.length || !crypto.timingSafeEqual(Buffer.from(t), Buffer.from(c.admin))) { console.error('[outfit-ia] no autorizado'); return; }
  let b = {};
  try { b = await req.json(); } catch (e) { b = {}; }
  const trabajo = String(b.trabajo || '');
  if (!RE_TRABAJO.test(trabajo)) { console.error('[outfit-ia] trabajo inválido'); return; }
  const fin = (detalle) => db.registrarEvento(c, 'fotos_ia', trabajo, detalle);
  try {
    const modelo = String(b.modelo || '').trim(), tacon = String(b.tacon || '').trim();
    const prendas = (Array.isArray(b.prendas) ? b.prendas : []).map((x) => String(x || '').trim()).filter(Boolean).slice(0, MAX_PRENDAS);
    const vistas = VISTAS.filter((v) => v === 'frente' || (Array.isArray(b.vistas) && b.vistas.includes(v)));
    if (!fuenteValida(c, modelo)) { await fin({ error: 'Sube la foto de tu modelo' }); return; }
    if (!fuenteValida(c, tacon)) { await fin({ error: 'Elige el tacón del look (con foto en la tienda)' }); return; }
    if (!prendas.every((p) => fuenteValida(c, p))) { await fin({ error: 'Hay una foto de prenda que no está subida en la tienda' }); return; }

    const hoy = Date.now() - 24 * 3600 * 1000;
    const usadas = ((await db.eventosPorTipo(c, ['fotos_ia'], 100)) || []).filter((e) => new Date(e.creado_en).getTime() > hoy)
      .reduce((n, e) => n + ((e.detalle && Array.isArray(e.detalle.fotos)) ? e.detalle.fotos.length : 0), 0);
    if (usadas + vistas.length > MAX_FOTOS_DIA) {
      await fin({ error: `Límite diario de ${MAX_FOTOS_DIA} fotos con IA: hoy quedan ${Math.max(0, MAX_FOTOS_DIA - usadas)}. Pide menos vistas o intenta mañana.` });
      return;
    }
    if (!process.env.GEMINI_API_KEY) { await fin({ error: 'La IA no está disponible en este momento (AI Gateway sin credenciales)' }); return; }

    const [imModelo, imTacon, ...imPrendas] = await Promise.all([modelo, tacon].concat(prendas).map(leer));
    const ai = new GoogleGenAI({}); // GEMINI_API_KEY + GOOGLE_GEMINI_BASE_URL los pone el AI Gateway
    const [fz, ...fps] = await Promise.all([ficha(ai, imTacon, FICHA_ZAPATO)].concat(imPrendas.map((im) => ficha(ai, im, FICHA_PRENDA))));
    const FICHAS = (fz ? 'SHOE DESCRIPTION (follow exactly): ' + fz + ' ' : '') +
      fps.map((f, i) => (f ? `GARMENT ${i + 1} DESCRIPTION (follow exactly): ${f} ` : '')).join('');
    // Referencias en orden fijo: modelo, zapato, prendas (el revisor usa el mismo orden)
    const refs = [imModelo, imTacon].concat(imPrendas);
    const etiquetas = ['MODEL photo (the person):', 'SHOE photo:'].concat(imPrendas.map((_, i) => `GARMENT photo ${i + 1}:`));
    const partesRef = refs.flatMap((im, i) => [{ text: etiquetas[i] }, { inlineData: im }]);

    const t0 = Date.now();
    const fotos = [], errores = [];
    let frente = null;
    for (const v of vistas) {
      try {
        // Lado, espalda y editorial parten de la foto de frente ya creada: así salen con la misma persona, ropa y zapatos
        const base = v !== 'frente' && frente ? [{ text: 'FRONT photo already created of this exact person and outfit (keep the person, clothes and shoes identical, only change the view or pose):' }, { inlineData: frente }] : [];
        const prompt = ESTUDIO + PERSONA + (prendas.length ? ROPA : ROPA_PROPIA) + ZAPATO + FICHAS + POSE[v];
        let g = await generar(ai, partesRef.concat(base, [{ text: prompt }]));
        const vistaEn = { frente: 'front', lado: 'side', espalda: 'back', editorial: 'full-body editorial' }[v];
        let rev = await revisar(ai, refs, g, vistaEn);
        if (!rev.ok && Date.now() - t0 < 10 * 60 * 1000) {
          try {
            const g2 = await generar(ai, partesRef.concat(base, [{ text: prompt + ' IMPORTANT, fix this problem from a previous attempt: ' + rev.motivo }]));
            const rev2 = await revisar(ai, refs, g2, vistaEn);
            g = g2; rev = rev2;
          } catch (e) { console.error('[outfit-ia] el segundo intento falló; se queda el primero'); }
        }
        if (v === 'frente') frente = { mimeType: g.mime, data: g.buf.toString('base64') };
        const ext = g.mime.includes('jpeg') ? 'jpg' : g.mime.includes('webp') ? 'webp' : 'png';
        const url = await db.subirFoto(c, `outfit-ia-${Date.now()}-${v}-${crypto.randomBytes(4).toString('hex')}.${ext}`, g.buf, g.mime);
        fotos.push({ vista: v, url, revisada: rev.ok, nota: rev.ok ? '' : rev.motivo });
      } catch (e) { errores.push({ vista: v, error: String(e.message || e).slice(0, 300) }); }
    }
    await fin({ fotos, errores });
  } catch (e) {
    console.error('[outfit-ia]', e && e.message ? e.message : e);
    await fin({ error: String(e && e.message || e).slice(0, 300) });
  }
};
