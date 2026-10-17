'use strict';
// Consulta pública de una transacción en la API de Wompi (no requiere llave privada).

const base = (pub) => `https://${String(pub).startsWith('pub_test') ? 'sandbox' : 'production'}.wompi.co/v1`;

// Devuelve los datos de la transacción, null si no existe (404) y lanza error en cualquier otro fallo.
async function consultarTransaccion(pub, id) {
  const r = await fetch(`${base(pub)}/transactions/${encodeURIComponent(id)}`, { signal: AbortSignal.timeout(6000) });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error('Wompi API ' + r.status);
  const j = await r.json();
  return j && j.data ? j.data : null;
}

module.exports = { consultarTransaccion };
