'use strict';
// Llamadas a la API de Wompi que solo necesitan la llave PÚBLICA (consultar, aceptación y cobrar con tarjeta tokenizada).
// Los datos de la tarjeta NUNCA pasan por este servidor: el navegador los manda directo a Wompi y aquí solo llega el token.

const base = (pub) => `https://${String(pub).startsWith('pub_test') ? 'sandbox' : 'production'}.wompi.co/v1`;

// Devuelve los datos de la transacción, null si no existe (404) y lanza error en cualquier otro fallo.
async function consultarTransaccion(pub, id) {
  const r = await fetch(`${base(pub)}/transactions/${encodeURIComponent(id)}`, { signal: AbortSignal.timeout(6000) });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error('Wompi API ' + r.status);
  const j = await r.json();
  return j && j.data ? j.data : null;
}

// Contratos que la clienta debe aceptar antes de pagar con tarjeta (reglamento de Wompi y tratamiento de datos).
async function aceptacion(pub) {
  const r = await fetch(`${base(pub)}/merchants/${encodeURIComponent(pub)}`, { signal: AbortSignal.timeout(6000) });
  if (!r.ok) throw new Error('Wompi API ' + r.status);
  const d = ((await r.json()) || {}).data || {};
  const a = d.presigned_acceptance || {}, p = d.presigned_personal_data_auth || {};
  if (!a.acceptance_token) throw new Error('Wompi sin token de aceptación');
  return {
    terminos: { token: a.acceptance_token, url: a.permalink || '' },
    datos: p.acceptance_token ? { token: p.acceptance_token, url: p.permalink || '' } : null,
  };
}

// Cobra con una tarjeta ya tokenizada. Lanza un error con .cliente (mensaje para mostrar) si Wompi la rechaza de entrada.
async function cobrarTarjeta(pub, t) {
  const cuerpo = {
    acceptance_token: t.aceptacion, amount_in_cents: t.centavos, currency: 'COP', signature: t.firma,
    customer_email: t.email, reference: t.referencia, redirect_url: t.redirect,
    payment_method: { type: 'CARD', token: t.token, installments: t.cuotas },
    customer_data: { full_name: t.nombre, phone_number: '57' + t.tel, ...(t.documento ? { legal_id: t.documento, legal_id_type: 'CC' } : {}) },
  };
  if (t.datos) cuerpo.accept_personal_auth = t.datos;
  const r = await fetch(`${base(pub)}/transactions`, {
    method: 'POST', signal: AbortSignal.timeout(15000),
    headers: { Authorization: `Bearer ${pub}`, 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.data || !j.data.id) {
    const e = new Error('Wompi rechazó la transacción ' + r.status + ' ' + JSON.stringify((j && j.error) || {}).slice(0, 300));
    e.cliente = r.status === 422 ? 'Revisa los datos de la tarjeta e inténtalo de nuevo.' : 'No pudimos procesar la tarjeta. Inténtalo de nuevo en un momento.';
    throw e;
  }
  return j.data;
}

module.exports = { consultarTransaccion, aceptacion, cobrarTarjeta, base };
