// Estado del botón "Crear fotos con IA" del panel (solo con la clave del panel, ADMIN_TOKEN).
//   GET /api/fotos-ia-estado?trabajo=IA-xxxx  →  { listo:false }  o  { listo:true, fotos:[{id,url}], errores:[...], error? }
//   GET /api/fotos-ia-estado?recientes=1       →  { trabajos:[{trabajo, creado_en, fotos:[{vista,url,…}]}] }
//       Las últimas fotos de modelo creadas para Outfits, para recuperarlas si se cerró la pantalla antes de usarlas.
// El resultado lo deja la función fotos-ia-background en eventos (tipo 'fotos_ia', referencia = trabajo).
import crypto from 'crypto';
import configMod from '../../lib/config.js';
import db from '../../lib/db.js';

const { cfg } = configMod;
const json = (status, body) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
});

export default async (req) => {
  try {
    const c = cfg('admin');
    const auth = String(req.headers.get('authorization') || '');
    const t = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
    if (!t || t.length !== c.admin.length || !crypto.timingSafeEqual(Buffer.from(t), Buffer.from(c.admin))) return json(401, { error: 'No autorizado' });
    const qs = new URL(req.url).searchParams;
    if (qs.get('recientes')) {
      const evs = (await db.eventosPorTipo(c, ['fotos_ia'], 60)) || [];
      const trabajos = evs
        .filter((e) => e.detalle && Array.isArray(e.detalle.fotos) && e.detalle.fotos.some((f) => f && f.vista))
        .slice(0, 10)
        .map((e) => ({ trabajo: e.referencia, creado_en: e.creado_en, fotos: e.detalle.fotos }));
      return json(200, { trabajos });
    }
    const trabajo = qs.get('trabajo') || '';
    if (!/^IA-[a-z0-9]{6,24}$/.test(trabajo)) return json(400, { error: 'Trabajo inválido' });
    const ev = ((await db.eventosPorTipo(c, ['fotos_ia'], 30)) || []).find((e) => e.referencia === trabajo);
    return json(200, ev ? { listo: true, ...(ev.detalle || {}) } : { listo: false });
  } catch (e) {
    console.error('[fotos-ia-estado]', e && e.message ? e.message : e);
    return json(500, { error: 'No se pudo consultar' });
  }
};
