'use strict';
// Pruebas del diseño de los correos: no necesitan base de datos.
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { correoPago, correoEnvio, lineaTiempo } = require('../lib/correo');

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
    assert.match(m.html, /https:\/\/tienda\.test\/assets\/brand\/logo-correo\.png/);
    assert.match(m.html, /Compra confirmada/);
    assert.ok(!/background:#0|bgcolor="#0/i.test(m.html), 'sin fondos negros: todo en blanco');
    assert.match(m.html, /https:\/\/tienda\.test\/gracias\.html\?t=tok123/);
    assert.ok(!m.html.includes('<b>Pérez'), 'debe escapar HTML del cliente');
    assert.match(m.html, /Plataforma Luna/);
    assert.match(m.text, /Total pagado: \$263\.000/);
  });
  it('solo lo esencial: invita a seguir (Instagram o la tienda) y nunca inventa datos', () => {
    const con = correoPago(completo, pedido).html;
    assert.match(con, /¿Ya nos sigues\?/); assert.match(con, /Síguenos en Instagram/);
    assert.ok(!/MF10|Comunidad|Pasos|Guárdalas/.test(con), 'sin bloques de marketing extra');
    assert.match(correoPago({ ...minimo, site: 'https://tienda.test' }, pedido).html, /Visitar la tienda/);
    const sin = correoPago(minimo, pedido).html;
    assert.ok(!/Síguenos en Instagram/.test(sin) && !/wa\.me/.test(sin));
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

describe('contenido de los correos (datos reales del pedido)', () => {
  const dos = { ...pedido, items: [{ nombre: 'Plataforma Luna', talla: '37', color: 'Negro', cant: 2, precio: 249000 }, { nombre: 'Ébano', talla: '38', cant: 1, precio: 219000 }], subtotal_centavos: 71700000, envio_centavos: 1750000, monto_centavos: 73450000, cliente: { ...pedido.cliente, nota: 'Dejar con el portero <i>x</i>' } };
  it('confirmación: datos de la compradora, entrega, productos con cantidad y precio, envío y total', () => {
    const m = correoPago(completo, dos);
    for (const t of ['Tus datos', 'ana@correo.com', '3001234567', 'Entrega', 'Calle 1 # 2-3', 'Bogotá', 'Envío', 'Total pagado', 'Plataforma Luna', 'x2', '$249.000 c/u', '$498.000', '$17.500', '$734.500', 'Dejar con el portero', 'Gracias por tu compra'])
      assert.ok(m.html.includes(t), 'falta: ' + t);
    assert.ok(!m.html.includes('<i>x</i>'), 'debe escapar la nota del cliente');
    assert.ok(!/Ébano[^<]*<br>[^<]*c\/u/.test(m.html), 'sin precio unitario cuando es un solo par');
    assert.match(m.text, /Tus datos:\nAna <b>Pérez<\/b>\nana@correo.com/);
    assert.match(m.text, /Total pagado: \$734\.500/);
  });
  it('seguimiento: línea de tiempo de 6 pasos, transportadora, guía y enlace', () => {
    const m = correoEnvio(completo, pedido);
    for (const t of ['Recibido', 'Pago confirmado', 'Preparación', 'Despachado', 'En tránsito', 'Entregado', 'Servientrega', 'GU123', 'https://rastreo.test/GU123', 'Rastrear pedido']) assert.ok(m.html.includes(t), 'falta: ' + t);
    assert.match(m.subject, /va en camino/);
  });
  it('seguimiento: el avance sale del estado real y no inventa pasos', () => {
    const e = (estado_envio, estado_pago = 'APPROVED') => lineaTiempo({ estado_pago, estado_envio });
    assert.deepEqual(e('PREPARANDO'), ['ok', 'ok', 'act', '', '', '']);
    assert.deepEqual(e('EN_CAMINO'), ['ok', 'ok', 'ok', 'ok', 'act', '']);
    assert.deepEqual(e('EN_DESTINO'), ['ok', 'ok', 'ok', 'ok', 'act', '']);
    assert.deepEqual(e('ENTREGADO'), ['ok', 'ok', 'ok', 'ok', 'ok', 'ok']);
    assert.equal(e('EN_CAMINO', 'PENDING')[1], '');
  });
  it('seguimiento: si se reenvía con el pedido en otro estado, el texto lo dice con verdad', () => {
    const d = correoEnvio(completo, { ...pedido, estado_envio: 'EN_DESTINO' });
    assert.match(d.subject, /llegó a tu ciudad/); assert.ok(!/va en camino/.test(d.html));
    const x = correoEnvio(completo, { ...pedido, estado_envio: 'ENTREGADO' });
    assert.match(x.subject, /fue entregado/); assert.ok(!/va en camino/.test(x.html));
  });
  it('seguimiento: sin transportadora, guía ni enlace no muestra filas vacías ni inventa datos', () => {
    const m = correoEnvio(completo, { ...pedido, transportadora: '', guia: '', link_rastreo: '' });
    assert.ok(!/Transportadora|Número de guía|Rastrear pedido/.test(m.html.replace(/<style[\s\S]*?<\/style>/, '')));
    assert.ok(!/undefined|NaN|\[object|null/.test(m.html));
    assert.match(m.html, /Ver el estado de mi pedido/);
  });
  it('la confirmación es corta (sin barra de progreso) y el seguimiento conserva sus 6 pasos, todo en blanco', () => {
    const a = correoPago(completo, pedido).html, b = correoEnvio(completo, pedido).html;
    assert.equal((a.match(/height:3px;line-height:3px;font-size:0;background:/g) || []).length, 0);
    assert.equal((b.match(/height:3px;line-height:3px;font-size:0;background:/g) || []).length, 6);
    for (const h of [a, b]) assert.ok(!/b08d57|f6f2ec|ebe7e0|bgcolor="#0/i.test(h), 'sin dorado, marfil ni fondos negros');
  });
});
