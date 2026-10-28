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

describe('contenido de los correos (datos reales del pedido)', () => {
  const dos = { ...pedido, items: [{ nombre: 'Plataforma Luna', talla: '37', color: 'Negro', cant: 2, precio: 249000 }, { nombre: 'Ébano', talla: '38', cant: 1, precio: 219000 }], subtotal_centavos: 71700000, envio_centavos: 1750000, monto_centavos: 73450000, cliente: { ...pedido.cliente, nota: 'Dejar con el portero <i>x</i>' } };
  it('confirmación: datos del cliente, dirección, productos con cantidad y precio, subtotal, envío y total', () => {
    const m = correoPago(completo, dos);
    for (const t of ['Datos del cliente', 'ana@correo.com', '3001234567', 'Dirección de entrega', 'Calle 1 # 2-3', 'Bogotá', 'Subtotal', 'Envío', 'Total pagado', 'Plataforma Luna', 'x2', '$249.000 c/u', '$498.000', '$717.000', '$17.500', '$734.500', 'Indicaciones: Dejar con el portero'])
      assert.ok(m.html.includes(t), 'falta: ' + t);
    assert.ok(!m.html.includes('<i>x</i>'), 'debe escapar la nota del cliente');
    assert.ok(!/Ébano[^<]*<br>[^<]*c\/u/.test(m.html), 'sin precio unitario cuando es un solo par');
  });
  it('confirmación: avisa al final que llegará otro correo al despachar, y no promete guía antes', () => {
    const m = correoPago(completo, dos);
    const i = m.html.indexOf('otro correo'), dir = m.html.indexOf('Dirección de entrega');
    assert.ok(i > dir, 'el aviso va después de la dirección');
    assert.match(m.html, /transportadora, número de guía y enlace de rastreo/);
    assert.ok(!/te enviaremos la guía de seguimiento/.test(m.html));
    assert.match(m.text, /otro correo con los datos para hacer el seguimiento/);
    assert.match(m.text, /Datos del cliente:\nAna <b>Pérez<\/b>\nana@correo.com/);
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
  it('el correo de confirmación conserva su barra de 4 tramos y el de seguimiento usa 6, con los mismos estilos', () => {
    const a = correoPago(completo, pedido).html, b = correoEnvio(completo, pedido).html;
    assert.equal((a.match(/height:3px;line-height:3px;font-size:0;background:/g) || []).length, 5); // 4 tramos + línea dorada del encabezado
    assert.equal((b.match(/height:3px;line-height:3px;font-size:0;background:/g) || []).length, 7); // 6 tramos + línea dorada
    for (const c of ['#0a0a0a', '#b08d57', '#f6f2ec']) assert.ok(a.includes(c) && b.includes(c));
  });
});
