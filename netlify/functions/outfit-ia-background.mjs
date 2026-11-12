// Fotos de outfit con IA: TU modelo (foto real) con las prendas y el tacón MF elegidos, como foto de estudio de la pasarela.
// Función de fondo (Gemini por el AI Gateway de Netlify): responde 202 al instante y trabaja hasta 15 min.
// La llama el botón "✨ Crear las fotos con IA" del editor de looks (Outfits) con la clave del panel (ADMIN_TOKEN):
//   POST /api/outfit-ia-background { trabajo: "IA-xxxx", modelo: <foto de la modelo>, tacon: <foto del tacón>,
//                                    prendas: [<foto de prenda>, ...] (0 a 3), vistas: ["frente","lado","espalda","editorial"] }
// Sigue las reglas del "MF AI Model Studio": el calzado de la foto es la referencia definitiva, la modelo es siempre la misma,
// fondo de estudio, sin textos. Sin prendas, la modelo conserva su ropa y solo cambian los zapatos.
//
// Trabaja por pasos, como un estudio real (cada paso hace UNA cosa, así la IA se equivoca menos):
//   0) Modelos: consulta la lista en vivo del AI Gateway y usa el mejor modelo de imagen disponible (si uno falla, el siguiente).
//   1) Fichas: un experto describe el tacón y cada prenda con precisión.
//   2) Prenda limpia: de cada foto de prenda saca SOLO la prenda (sin otra modelo, bolso, gancho ni fondo).
//   3) Vestir: edita la foto de TU modelo y le pone las prendas (conserva su cara, cuerpo y pose).
//   4) Zapatos: cambia SOLO los zapatos por el tacón MF, con fondo de estudio y cuerpo completo → foto de frente.
//   5) Vistas: lado, espalda y editorial a partir de la foto de frente ya aprobada.
// Un revisor califica cada intento (persona, ropa, zapatos, realismo, de 1 a 10); si algo queda por debajo de 8 se rehace
// con la corrección y se queda el mejor intento.
// El resultado queda en eventos (tipo "fotos_ia", referencia = trabajo) y se consulta con /api/fotos-ia-estado.
// Comparte con las fotos de producto el límite diario de fotos con IA (cuentan solo las fotos entregadas).
import crypto from 'crypto';
import process from 'process';
import { GoogleGenAI } from '@google/genai';
import configMod from '../../lib/config.js';
import db from '../../lib/db.js';

const { cfg } = configMod;
const RE_TRABAJO = /^IA-[a-z0-9]{6,24}$/;
const MAX_FOTOS_DIA = 40;
const MAX_PRENDAS = 3;
const VISTAS = ['frente', 'lado', 'espalda', 'editorial'];
const LIMITE_MS = 13 * 60 * 1000; // la función de fondo vive 15 min: después de 13 no se rehacen fotos
const NOTA_OK = 8;                 // calificación mínima del revisor (1 a 10)
// Intentos por paso (modo equilibrado, para cuidar los créditos): cada intento es una imagen cobrada.
// La foto de frente es la que más importa (de ella salen las demás vistas y el video): se permite un reintento.
const INTENTOS = { vestir: 1, frente: 2, vista: 1 };

// Respaldo si la lista en vivo no responde (en orden de preferencia)
const IMAGEN_RESPALDO = ['gemini-3-pro-image-preview', 'gemini-3.1-flash-image-preview', 'gemini-2.5-flash-image'];
const TEXTO_RESPALDO = ['gemini-3-flash-preview', 'gemini-3-pro-preview', 'gemini-2.5-flash', 'gemini-2.5-pro'];

// ---------- Modelos disponibles (lista en vivo del AI Gateway) ----------
const version = (id) => parseFloat((id.match(/gemini-(\d+(?:\.\d+)?)/) || [])[1] || '0');
const puntajeImagen = (id) => version(id) * 10 + (/pro/.test(id) ? 6 : 0) - (/lite/.test(id) ? 40 : 0);
const puntajeTexto = (id) => version(id) * 10 + (/flash/.test(id) ? 3 : 0) + (/pro/.test(id) ? 2 : 0) - (/lite/.test(id) ? 20 : 0);
async function modelosDisponibles() {
  try {
    const r = await fetch('https://api.netlify.com/api/v1/ai-gateway/providers', { signal: AbortSignal.timeout(8000), headers: { Accept: 'application/json' } });
    if (!r.ok) throw new Error(String(r.status));
    const ids = [...new Set(((await r.text()).match(/gemini-[a-z0-9.-]+/gi) || []).map((x) => x.toLowerCase()))];
    const img = ids.filter((x) => x.includes('image')).sort((a, b) => puntajeImagen(b) - puntajeImagen(a));
    const txt = ids.filter((x) => !x.includes('image') && !x.includes('embed') && !x.includes('tts') && !x.includes('audio') && !x.includes('live'))
      .sort((a, b) => puntajeTexto(b) - puntajeTexto(a));
    return { imagen: img.length ? img : IMAGEN_RESPALDO, texto: (txt.length ? txt : TEXTO_RESPALDO).slice(0, 5) };
  } catch (e) {
    console.error('[outfit-ia] lista de modelos no disponible, uso la de respaldo:', String(e && e.message || e).slice(0, 120));
    return { imagen: IMAGEN_RESPALDO, texto: TEXTO_RESPALDO };
  }
}

// ---------- Instrucciones (reglas de la marca) ----------
// Set de la marca ("Loft MF"): estudio tipo loft cálido, como las campañas de moda en línea.
const ESTUDIO = 'Photorealistic professional e-commerce fashion campaign photo for the shoe brand MARLON FOOTWEAR (MF), as shot by a professional ' +
  'fashion photographer on a full-frame camera with a 50mm lens: high resolution, natural skin texture, correct anatomy, realistic fabric ' +
  'folds and drape, realistic perspective and natural soft shadows. SET ("MF loft"): a bright minimalist loft studio with warm beige ' +
  'limewash plaster walls, exposed white-painted ceiling beams and pipes, a low curved beige velvet sofa behind her, polished light-grey ' +
  'concrete floor, soft natural window daylight from the side, warm neutral color grading, background slightly out of focus. No text, no logos, ' +
  'no watermarks. Vertical 3:4 framing with the WHOLE body visible from the top of the head to the soles of the shoes, centered, small margin ' +
  'above the head and below the feet. ';
const PERSONA = 'IDENTITY: it must be exactly the same woman as in the MODEL photo: same face and facial features, same skin tone, same hair ' +
  '(color, length, style), same body shape and proportions. Do not beautify, slim, age or change her. ';
const ZAPATO = 'SHOES, THE MOST IMPORTANT RULE: the SHOE photo is the definitive reference of a product sold in the store. Reproduce it ' +
  'faithfully on both feet, as if she really wore that same pair in the photo shoot: same heel design, heel height and geometry, same platform ' +
  'height and shape (or no platform if it has none), same toe shape, same number and position of straps, same buckles and embellishments, ' +
  'same materials, colors, textures and finishes, same proportions. FORBIDDEN: changing the heel, the platform or the toe; inventing, removing ' +
  'or moving straps, buckles or embellishments; changing colors, materials or finishes; simplifying or reinterpreting the product; using a ' +
  'similar shoe instead of this one. Fit the shoe naturally to the foot without deforming it. Both shoes sharp, in focus and clearly visible. ';
const POSE = {
  frente: 'POSE: full-body front view facing the camera, confident fashion-catalog stance: one hand resting on her hip, weight on one leg, ' +
    'chin slightly down, direct gaze to the camera, feet slightly apart so both shoes are fully visible.',
  lado: 'POSE: full side profile, turned 90 degrees (her left side to the camera), one knee slightly bent, clearly showing the height, shape and ' +
    'structure of the heel; shoes fully visible.',
  espalda: 'POSE: full-body back view, her back to the camera, looking back over her shoulder at the camera with a soft confident expression, ' +
    'showing the back of both shoes with the original heel and strap structure.',
  editorial: 'POSE: relaxed high-end catalog pose, both hands casually in the pockets (or one hand in a pocket), one leg slightly forward to ' +
    'highlight the shoes, shoes clearly visible, full body.',
};
const VISTA_EN = { frente: 'front', lado: 'side profile', espalda: 'back', editorial: 'editorial full-body' };

// ---------- Llamadas a la IA ----------
const jsonDe = (txt) => JSON.parse(txt.slice(txt.indexOf('{'), txt.lastIndexOf('}') + 1));
function crearIA(modelos) {
  const ai = new GoogleGenAI({}); // GEMINI_API_KEY + GOOGLE_GEMINI_BASE_URL los pone el AI Gateway
  const caidos = new Set();       // modelos que el gateway no tiene: no se reintentan en este trabajo
  const sinProveedor = (m) => /suitable provider|not found|not supported|unknown model|404/i.test(m);

  async function texto(parts, etiqueta) {
    for (const model of modelos.texto) {
      if (caidos.has(model)) continue;
      try {
        const r = await ai.models.generateContent({ model, contents: [{ role: 'user', parts }] });
        const ps = (r.candidates && r.candidates[0] && r.candidates[0].content && r.candidates[0].content.parts) || [];
        const t = ps.map((x) => x.text || '').join(' ').trim();
        if (t) return t;
      } catch (e) {
        const m = String(e && e.message || e);
        if (sinProveedor(m)) caidos.add(model);
        console.error(`[outfit-ia ${etiqueta}] ${model}: ${m.slice(0, 160)}`);
      }
    }
    return '';
  }

  // Imagen: el mejor modelo disponible; con proporción 3:4 y, si no la acepta, sin ella. Guarda el motivo real de cada fallo.
  async function imagen(parts) {
    const fallos = [];
    for (const model of modelos.imagen) {
      if (caidos.has(model)) continue;
      for (const config of [{ responseModalities: ['IMAGE', 'TEXT'], imageConfig: { aspectRatio: '3:4' } }, { responseModalities: ['IMAGE', 'TEXT'] }]) {
        try {
          const r = await ai.models.generateContent({ model, contents: [{ role: 'user', parts }], config });
          const c = r.candidates && r.candidates[0];
          const ps = (c && c.content && c.content.parts) || [];
          const p = ps.find((x) => x.inlineData && x.inlineData.data);
          if (p) return { buf: Buffer.from(p.inlineData.data, 'base64'), mime: p.inlineData.mimeType || 'image/png', model };
          const porque = (c && c.finishReason) || (r.promptFeedback && r.promptFeedback.blockReason) || 'sin imagen';
          const dijo = ps.map((x) => x.text || '').join(' ').trim().slice(0, 100);
          fallos.push(`${model}: ${porque}${dijo ? ' (' + dijo + ')' : ''}`);
          break; // respondió sin imagen: no sirve repetir con otra proporción
        } catch (e) {
          const m = String(e && e.message || e);
          if (sinProveedor(m)) { caidos.add(model); fallos.push(`${model}: no disponible en el AI Gateway`); break; }
          if (config.imageConfig && /imageConfig|aspect|invalid/i.test(m)) continue; // prueba sin proporción
          fallos.push(`${model}: ${m.replace(/\s+/g, ' ').slice(0, 140)}`);
          break;
        }
      }
    }
    throw new Error(fallos.join(' | ') || 'Ningún modelo de imagen disponible');
  }
  return { texto, imagen };
}

const im = (x) => ({ inlineData: { mimeType: x.mimeType, data: x.data } });
const deGen = (g) => ({ mimeType: g.mime, data: g.buf.toString('base64') });

// ---------- Revisor: califica de 1 a 10 y dice qué corregir ----------
async function calificar(IA, refs, g, que) {
  const parts = [];
  refs.forEach((r) => { parts.push({ text: r.etiqueta }); parts.push(im(r.img)); });
  parts.push({ text: 'GENERATED photo to evaluate:' }); parts.push(im(deGen(g)));
  parts.push({ text: 'You are a strict quality reviewer for a fashion e-commerce catalog. Compare the GENERATED photo with the references. ' +
    `Expected: ${que}. Score each item from 1 to 10 and answer ONLY with JSON like ` +
    '{"persona": 9, "ropa": 9, "zapatos": 9, "realismo": 9, "corregir": "short precise instruction to fix the biggest problem, in English"}. ' +
    '"persona": same woman as the MODEL reference (face, skin tone, hair, body); 10 if no MODEL reference is given. ' +
    '"ropa": clothes identical to the GARMENT references (type, cut, length, neckline, sleeves, fabric, sheerness, color, ruffles and details), ' +
    'and NO leftover or extra clothing from other photos (for example a white shirt visible under a sheer blouse); if no GARMENT reference, the clothes must match the base photo. ' +
    '"zapatos": identical to the SHOE reference (heel height and shape, platform, toe, every strap, buckles, color, material); be very strict. ' +
    '"realismo": photorealistic, correct anatomy (hands, feet, legs), whole body visible head to shoes, the warm beige loft studio set, correct view.' });
  const t = await IA.texto(parts, 'revisión');
  try {
    const j = jsonDe(t);
    const n = (v) => Math.max(1, Math.min(10, Number(v) || 0));
    const notas = { persona: n(j.persona), ropa: n(j.ropa), zapatos: n(j.zapatos), realismo: n(j.realismo) };
    return { ...notas, min: Math.min(notas.persona, notas.ropa, notas.zapatos, notas.realismo), corregir: String(j.corregir || '').slice(0, 300) };
  } catch (e) { return { persona: 8, ropa: 8, zapatos: 8, realismo: 8, min: 8, corregir: '', sinRevision: true }; }
}

// Genera, califica y rehace con la corrección hasta lograr la nota o agotar intentos; se queda el mejor.
async function mejorIntento(IA, { partes, prompt, refs, que, intentos, t0 }) {
  let mejor = null, correccion = '';
  for (let i = 0; i < intentos; i++) {
    if (i > 0 && Date.now() - t0 > LIMITE_MS) break;
    let g;
    try { g = await IA.imagen(partes.concat([{ text: prompt + (correccion ? ' IMPORTANT, fix this problem found in a previous attempt: ' + correccion : '') }])); }
    catch (e) { if (!mejor) throw e; break; }
    const nota = await calificar(IA, refs, g, que);
    if (!mejor || nota.min > mejor.nota.min) mejor = { g, nota };
    if (nota.min >= NOTA_OK) break;
    correccion = nota.corregir || 'match the references more exactly';
  }
  return mejor;
}

// ---------- Utilidades ----------
const FICHA_ZAPATO = 'You are a senior footwear product expert. Study ONLY the shoe in this photo and write a precise description in English ' +
  'for an image generator, 50 to 90 words, plain text: shoe type, toe shape, heel type and approximate height in cm, platform (or none), ' +
  'every strap and where it goes, closure, materials and finish, exact color. Do not mention people or background.';
const FICHA_PRENDA = 'You are a senior fashion product expert. Describe ONLY the main garment(s) worn in this photo (ignore the person, ' +
  'bags, jewelry, hangers and background) precisely in English for an image generator, 50 to 90 words, plain text: garment type, cut and fit, ' +
  'length, neckline and collar, sleeves (shape and volume), fabric and sheerness, exact color, ruffles, tiers, gathers, buttons and details.';
async function ficha(IA, img, prompt) {
  const t = (await IA.texto([im(img), { text: prompt }], 'ficha')).replace(/\s+/g, ' ').trim();
  return t.length > 30 ? t.slice(0, 900) : '';
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

// ---------- Súper modelo MF: una modelo virtual exclusiva de la marca ----------
// POST { modo: "supermodelo", trabajo, estilo: { piel, cabello, edad, cuerpo, rasgos } }
// Crea 3 opciones de una mujer que NO existe (ficticia, no se parece a nadie real), de cuerpo completo, de frente,
// con ropa básica neutra (se reemplaza al vestirla) y fondo de estudio. La que elijas en el panel queda como la modelo de la marca.
const OPCIONES_MODELO = 3;
const txtCorto = (v, n) => String(v || '').replace(/[<>"`{}]/g, '').replace(/\s+/g, ' ').trim().slice(0, n);
async function superModelo(c, b, fin, t0) {
  const e = b && typeof b.estilo === 'object' && b.estilo ? b.estilo : {};
  const estilo = {
    piel: txtCorto(e.piel, 60) || 'warm golden sun-kissed Latina skin tone',
    cabello: txtCorto(e.cabello, 80) || 'long voluminous brunette hair with soft caramel balayage, glossy loose waves, middle part',
    edad: txtCorto(e.edad, 30) || '25 to 30 years old',
    cuerpo: txtCorto(e.cuerpo, 80) || 'tall, slim and toned fashion-model build',
    rasgos: txtCorto(e.rasgos, 200),
  };
  const hoy = Date.now() - 24 * 3600 * 1000;
  const usadas = ((await db.eventosPorTipo(c, ['fotos_ia'], 100)) || []).filter((x) => new Date(x.creado_en).getTime() > hoy)
    .reduce((n, x) => n + ((x.detalle && Array.isArray(x.detalle.fotos)) ? x.detalle.fotos.length : 0), 0);
  if (usadas + OPCIONES_MODELO > MAX_FOTOS_DIA) {
    await fin({ error: `Límite diario de ${MAX_FOTOS_DIA} fotos con IA: hoy quedan ${Math.max(0, MAX_FOTOS_DIA - usadas)}. Intenta mañana.` });
    return;
  }
  if (!process.env.GEMINI_API_KEY) { await fin({ error: 'La IA no está disponible en este momento (AI Gateway sin credenciales)' }); return; }
  const IA = crearIA(await modelosDisponibles());
  const prompt = 'Create a brand-new, original, FICTIONAL woman who does not exist and does not resemble any real person, celebrity or ' +
    'existing model. She is the exclusive house model of the shoe brand MARLON FOOTWEAR. ' +
    `Appearance: ${estilo.piel}; ${estilo.cabello}; ${estilo.edad}; ${estilo.cuerpo}. ${estilo.rasgos ? 'Extra details: ' + estilo.rasgos + '. ' : ''}` +
    'Glamorous but natural and believable, like a real professional e-commerce fashion model: real skin texture with pores and tiny ' +
    'imperfections, no plastic or airbrushed look, soft glam makeup (warm bronzed skin, defined brows, nude-brown lips), small gold dome earrings, ' +
    'confident relaxed expression, looking at the camera. Her face must be unique and original: do NOT copy or resemble any real model, influencer ' +
    'or celebrity. Wardrobe: a plain fitted black long-sleeve top, a plain fitted black mini skirt and simple nude pointed-toe pumps (basic outfit, ' +
    'no logos). ' + ESTUDIO + POSE.frente + ' True-to-life colors, like a real campaign photo.';
  const fotos = [], errores = [];
  for (let i = 0; i < OPCIONES_MODELO; i++) {
    if (Date.now() - t0 > LIMITE_MS) break;
    try {
      const g = await IA.imagen([{ text: prompt + (i ? ` Variation ${i + 1}: a different face from the other options, same brief.` : '') }]);
      const ext = g.mime.includes('jpeg') ? 'jpg' : g.mime.includes('webp') ? 'webp' : 'png';
      const url = await db.subirFoto(c, `supermodelo-${Date.now()}-${i}-${crypto.randomBytes(4).toString('hex')}.${ext}`, g.buf, g.mime);
      fotos.push({ vista: 'modelo', url });
    } catch (x) { errores.push({ vista: 'modelo', error: String(x && x.message || x).slice(0, 400) }); }
  }
  await fin({ fotos, errores, supermodelo: true, segundos: Math.round((Date.now() - t0) / 1000) });
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
  const t0 = Date.now();
  try {
    if (b.modo === 'supermodelo') { await superModelo(c, b, fin, t0); return; }
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
    const modelos = await modelosDisponibles();
    const IA = crearIA(modelos);

    // 1) Fichas del tacón y de cada prenda
    const [fz, ...fps] = await Promise.all([ficha(IA, imTacon, FICHA_ZAPATO)].concat(imPrendas.map((x) => ficha(IA, x, FICHA_PRENDA))));
    const FICHA_Z = fz ? 'SHOE DESCRIPTION (follow exactly): ' + fz + ' ' : '';
    const FICHA_P = fps.map((f, i) => (f ? `GARMENT ${i + 1} DESCRIPTION (follow exactly): ${f} ` : '')).join('');

    // 2) Prenda limpia: solo la prenda, como foto de producto (sin otra modelo, bolso ni fondo)
    const limpias = await Promise.all(imPrendas.map(async (x, i) => {
      try {
        const g = await IA.imagen([{ text: 'GARMENT photo:' }, im(x), { text: 'Extract ONLY the clothing garment(s) worn in this photo and show them as a ' +
          'clean e-commerce ghost-mannequin product photo on a plain white background, front view, complete and unfolded, exactly the same garment: ' +
          'same cut, length, neckline, collar, sleeves, fabric, sheerness, color, ruffles, tiers and details. Remove the person, skin, hair, bags, ' +
          'jewelry, shoes and background. Do not redesign anything. ' + (fps[i] ? 'Garment description: ' + fps[i] : '') }]);
        return deGen(g);
      } catch (e) { console.error('[outfit-ia] no pude limpiar la prenda; uso la foto original'); return x; }
    }));

    const refModelo = { etiqueta: 'MODEL reference (the woman):', img: imModelo };
    const refZapato = { etiqueta: 'SHOE reference (the exact product):', img: imTacon };
    const refsPrendas = imPrendas.map((x, i) => ({ etiqueta: `GARMENT reference ${i + 1}:`, img: x }));

    // 3) Vestir a la modelo editando SU foto (conserva cara, cuerpo y pose)
    let base = imModelo, notaBase = null;
    if (limpias.length) {
      const partes = [{ text: 'MODEL photo (edit THIS photo):' }, im(imModelo)].concat(limpias.flatMap((x, i) => [{ text: `GARMENT ${i + 1} (clean product photo):` }, im(x)]));
      const prompt = 'Edit the MODEL photo: dress the woman ONLY in the GARMENT(S), copied exactly (cut, length, neckline, collar, sleeves and their ' +
        'volume, fabric, sheerness, color, ruffles, tiers, gathers, buttons). Completely remove ALL the clothes she wears in the MODEL photo: no ' +
        'trace of the old clothes may remain, not even under sheer fabrics (under a sheer garment only skin or the lining shown in the garment reference). ' +
        'Do not add any other clothes, bags or jewelry. Keep her face, hair, skin tone, body, pose, framing and her current shoes exactly the same. ' +
        PERSONA + FICHA_P;
      const r = await mejorIntento(IA, { partes, prompt, refs: [refModelo].concat(refsPrendas), intentos: INTENTOS.vestir, t0,
        que: 'the same woman as the MODEL reference wearing exactly the GARMENT references, nothing else from her original clothes' });
      if (r) { base = deGen(r.g); notaBase = r.nota; }
    }

    // 4) Zapatos: cambiar SOLO los zapatos por el tacón MF, fondo de estudio y cuerpo completo → foto de frente
    const fotos = [], errores = [];
    const subir = async (v, r) => {
      const ext = r.g.mime.includes('jpeg') ? 'jpg' : r.g.mime.includes('webp') ? 'webp' : 'png';
      const url = await db.subirFoto(c, `outfit-ia-${Date.now()}-${v}-${crypto.randomBytes(4).toString('hex')}.${ext}`, r.g.buf, r.g.mime);
      const ok = r.nota.min >= NOTA_OK;
      const bajas = ['persona', 'ropa', 'zapatos', 'realismo'].filter((k) => r.nota[k] < NOTA_OK);
      fotos.push({ vista: v, url, revisada: ok, nota: ok ? '' : `Revisa ${bajas.join(', ')} (${bajas.map((k) => r.nota[k]).join('/')} de 10). ${r.nota.corregir}`.trim(), calificacion: r.nota });
    };
    let frente = null;
    const refsRopa = refsPrendas.length ? refsPrendas : [{ etiqueta: 'BASE photo (her clothes must stay exactly like this):', img: imModelo }];
    try {
      const partes = [{ text: 'BASE photo of the woman (keep her and her clothes exactly):' }, im(base), { text: 'SHOE photo (the exact product to put on her feet):' }, im(imTacon)];
      const prompt = 'Using the BASE photo, replace ONLY the shoes she wears with the exact product from the SHOE photo. Keep the woman, her face, hair, ' +
        'body and her clothes exactly as in the BASE photo. Place her on the studio background described below. ' + ESTUDIO + PERSONA + ZAPATO + FICHA_Z + POSE.frente;
      const r = await mejorIntento(IA, { partes, prompt, refs: [refModelo, refZapato].concat(refsRopa), intentos: INTENTOS.frente, t0,
        que: 'front view, full body, same woman wearing the same clothes as the references and exactly the SHOE reference on both feet' });
      if (r) { frente = r; await subir('frente', r); }
    } catch (e) { errores.push({ vista: 'frente', error: String(e.message || e).slice(0, 600) }); }

    // 5) Vistas a partir de la foto de frente (misma persona, ropa y zapatos)
    for (const v of vistas.filter((x) => x !== 'frente')) {
      if (Date.now() - t0 > LIMITE_MS) { errores.push({ vista: v, error: 'Se acabó el tiempo; pide esta vista en otra tanda' }); continue; }
      try {
        const ancla = frente ? deGen(frente.g) : base;
        const partes = [{ text: 'FRONT photo already approved (same woman, same clothes, same shoes; keep all of it identical):' }, im(ancla),
          { text: 'SHOE photo (the exact product):' }, im(imTacon)].concat(limpias.flatMap((x, i) => [{ text: `GARMENT ${i + 1}:` }, im(x)]));
        const prompt = `Create a new photo of the SAME woman from the FRONT photo, wearing exactly the same clothes and the same shoes, only changing the view and pose. ` +
          ESTUDIO + PERSONA + ZAPATO + FICHA_Z + FICHA_P + POSE[v];
        const r = await mejorIntento(IA, { partes, prompt, refs: [refModelo, refZapato].concat(refsRopa), intentos: INTENTOS.vista, t0,
          que: `${VISTA_EN[v]} view, full body, same woman, same clothes and exactly the SHOE reference` });
        if (r) await subir(v, r);
      } catch (e) { errores.push({ vista: v, error: String(e.message || e).slice(0, 600) }); }
    }
    await fin({ fotos, errores, modelo: frente ? frente.g.model : '', vestido: notaBase ? notaBase.min : null, segundos: Math.round((Date.now() - t0) / 1000) });
  } catch (e) {
    console.error('[outfit-ia]', e && e.message ? e.message : e);
    await fin({ error: String(e && e.message || e).slice(0, 600) });
  }
};
