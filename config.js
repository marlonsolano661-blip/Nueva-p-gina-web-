'use strict';
// Lee las variables de entorno EN CADA LLAMADA (no al cargar el módulo) y falla con un
// mensaje claro si falta alguna. Nunca se registran los valores, solo los nombres.

class ConfigError extends Error {
  constructor(missing) {
    super('Faltan variables de entorno: ' + missing.join(', '));
    this.missing = missing;
  }
}

const REQUERIDAS = {
  crear: ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY', 'WOMPI_PUBLIC_KEY', 'WOMPI_INTEGRITY_SECRET', 'SITE_URL'],
  webhook: ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY', 'WOMPI_PUBLIC_KEY', 'WOMPI_EVENTS_SECRET'],
  seguimiento: ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY', 'WOMPI_PUBLIC_KEY'],
  admin: ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY', 'ADMIN_TOKEN'],
};

function cfg(tipo) {
  const e = process.env;
  const faltan = REQUERIDAS[tipo].filter((k) => !String(e[k] || '').trim());
  if (faltan.length) throw new ConfigError(faltan);
  if (tipo === 'admin' && String(e.ADMIN_TOKEN).trim().length < 24) {
    throw new ConfigError(['ADMIN_TOKEN (mínimo 24 caracteres)']);
  }
  return {
    db: String(e.SUPABASE_URL).trim().replace(/\/+$/, ''),
    key: String(e.SUPABASE_SERVICE_KEY).trim(),
    pub: String(e.WOMPI_PUBLIC_KEY || '').trim(),
    integrity: String(e.WOMPI_INTEGRITY_SECRET || '').trim(),
    events: String(e.WOMPI_EVENTS_SECRET || '').trim(),
    site: String(e.SITE_URL || '').trim().replace(/\/+$/, ''),
    admin: String(e.ADMIN_TOKEN || '').trim(),
    // Por defecto el webhook confirma cada pago aprobado consultando a la API de Wompi.
    verificarWompi: String(e.WOMPI_VERIFY_API == null ? '1' : e.WOMPI_VERIFY_API).trim() !== '0',
  };
}

module.exports = { cfg, ConfigError };
