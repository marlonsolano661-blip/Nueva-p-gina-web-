'use strict';
// Pruebas del diseño de los correos: no necesitan base de datos.
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { correoPago, correoEnvio } = require('../lib/correo');

const pedido = {
  referencia: 'MF-261024-2861', token: 'tok123', estado_pago: 'APPROVED', metodo: 'CARD',
  monto_centavos: 26300000, subtotal_centavos: 24900000, envio_centavos: 1400000,
  items: [{ nombre: 'Plataforma Luna', talla: '37', color: 'Negro', cant: 1, precio: 249000 }],
  cliente: { nombre: 'Ana <b>Pérez</b>', email: 'ana@correo.com', tel: '3001234567', direccion: 'Calle 1 # 2-3', ciudad: 'Bogotá' },
  transportadora: 'Servientrega', guia: 'GU123', link_rastreo: 'https://rastreo.test/GU123',
};
const completo = { site: 'https://tienda.test', wa: '573001234567', ig: 'https://instagram.com/mfcol', codigo: 'MF10', codigoTxt: '10% en tu próxima compra' };
const minimo = { site: '', wa: '', ig: '', codigo: '', codigoTxt: '' };

describe('diseño de correos', () => {
  it('pago: incluye logo, progreso, enlace al pedido y escapa los datos del cliente', () => {
    const m = correoPago(completo, pedido);
    assert.match(m.subject, /MF-261024-2861/);
    assert.match(m.html, /https:\/\/tienda\.test\/assets\/brand\/logo-blanco\.png/);
    assert.match(m.html, /Pago confirmado/);
    assert.match(m.html, /https:\/\/tienda\.test\/gracias\.html\?t=tok123/);
    assert.ok(!m.html.includes('<b>Pérez'), 'debe escapar HTML del cliente');
    assert.match(m.html, /Plataforma Luna/);
    assert.match(m.text, /Total pagado: \$263\.000/);
  });
  it('los bloques de marketing son opcionales y nunca inventan datos', () => {
    const con = correoPago(completo, pedido).html;
    assert.match(con, /MF10/); assert.match(con, /Síguenos en Instagram/);
    const sin = correoPago(minimo, pedido).html;
    assert.ok(!/Un detalle para ti/.test(sin) && !/Síguenos en Instagram/.test(sin) && !/wa\.me/.test(sin));
    assert.match(sin, /MF·COL/); // sin SITE_URL el logo cae a texto
    assert.ok(!/undefined|NaN|\[object/.test(sin));
  });
  it('envío: muestra guía y rastreo; ignora enlaces de rastreo que no sean https', () => {
    const m = correoEnvio(completo, pedido);
    assert.match(m.html, /GU123/); assert.match(m.html, /https:\/\/rastreo\.test\/GU123/);
    const raro = correoEnvio(completo, { ...pedido, link_rastreo: 'javascript:alert(1)' });
    assert.ok(!/javascript:/.test(raro.html));
  });
  it('envío gratis se muestra como "Gratis"', () => {
    assert.match(correoPago(completo, { ...pedido, envio_centavos: 0, monto_centavos: 24900000 }).html, /Gratis/);
  });
});
