/* Página de confirmación y seguimiento del pedido.
   Wompi vuelve a gracias.html?id=<transacción>. Con ese id (o con ?t=<token privado>) se consulta /api/seguimiento. */
(function () {
  'use strict';
  var API = window.MF_API_BASE || '';
  var INTERVALO = window.MF_POLL_MS || 3000;
  var INTENTOS_MAX = 20;
  // Si tu carrito de index.html guarda en otra clave de localStorage, agrégala aquí:
  var CLAVES_CARRITO = ['cart', 'carrito', 'mf_cart', 'mf-cart', 'mf_carrito'];

  var tarjeta = document.getElementById('tarjeta');
  var params = new URLSearchParams(location.search);
  var token = params.get('t'), idTx = params.get('id');
  var intentos = 0, carritoLimpio = false;

  function el(tag, props, hijos) {
    var n = document.createElement(tag);
    Object.keys(props || {}).forEach(function (k) {
      if (k === 'text') n.textContent = props[k]; else if (k === 'class') n.className = props[k]; else n.setAttribute(k, props[k]);
    });
    (hijos || []).forEach(function (h) { if (h) n.appendChild(h); });
    return n;
  }
  function pesos(centavos) { return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number(centavos) / 100); }
  function vaciar() { while (tarjeta.firstChild) tarjeta.removeChild(tarjeta.firstChild); }
  function limpiarCarrito() {
    if (carritoLimpio) return; carritoLimpio = true;
    try { CLAVES_CARRITO.forEach(function (k) { localStorage.removeItem(k); }); } catch (e) { /* sin acceso a storage */ }
  }

  function pintarSinPedido() {
    vaciar();
    tarjeta.className = 'tarjeta estado-mal';
    tarjeta.appendChild(el('h1', { text: 'No encontramos tu pedido' }));
    tarjeta.appendChild(el('p', { class: 'suave', text: 'Si acabas de pagar, espera un momento y recarga la página. Si el problema continúa, escríbenos por WhatsApp con tu comprobante.' }));
    tarjeta.appendChild(el('a', { class: 'boton', href: '/', text: 'Volver a la tienda' }));
  }

  function pintar(p) {
    vaciar();
    var pago = p.estado_pago;
    var ok = pago === 'APPROVED';
    var mal = pago === 'DECLINED' || pago === 'ERROR' || pago === 'VOIDED';
    tarjeta.className = 'tarjeta ' + (ok ? 'estado-ok' : mal ? 'estado-mal' : '');

    if (ok) {
      tarjeta.appendChild(el('h1', { text: '¡Pago recibido!' }));
      tarjeta.appendChild(el('p', { text: 'Gracias por tu compra. Ya estamos preparando tu pedido.' }));
    } else if (mal) {
      tarjeta.appendChild(el('h1', { text: 'El pago no fue aprobado' }));
      tarjeta.appendChild(el('p', { text: 'No se hizo ningún cobro. Puedes intentarlo de nuevo con otro medio de pago.' }));
    } else {
      tarjeta.appendChild(el('h1', { text: 'Estamos confirmando tu pago' }));
      tarjeta.appendChild(el('p', { text: 'Esto puede tardar unos segundos. No cierres esta página.' }));
      tarjeta.appendChild(el('div', { class: 'giro', role: 'status', 'aria-label': 'Confirmando' }));
    }

    tarjeta.appendChild(el('p', { class: 'suave' }, [document.createTextNode('Pedido '), el('span', { class: 'ref', text: p.reference })]));
    tarjeta.appendChild(el('hr'));

    var ul = el('ul');
    (p.items || []).forEach(function (i) {
      ul.appendChild(el('li', {}, [el('span', { text: i.nombre + ' · talla ' + i.talla }), el('span', { text: '× ' + i.cant })]));
    });
    tarjeta.appendChild(ul);
    tarjeta.appendChild(el('div', { class: 'total' }, [el('span', { text: 'Total' }), el('span', { text: pesos(p.amount_in_cents) })]));

    if (ok) {
      limpiarCarrito();
      var etapas = [['PREPARANDO', 'Preparando'], ['EN_CAMINO', 'En camino'], ['ENTREGADO', 'Entregado']];
      var idx = Math.max(0, etapas.map(function (e) { return e[0]; }).indexOf(p.estado_envio));
      tarjeta.appendChild(el('hr'));
      var pasos = el('div', { class: 'pasos' });
      etapas.forEach(function (e, n) { pasos.appendChild(el('div', { class: 'paso' + (n <= idx ? ' on' : ''), text: e[1] })); });
      tarjeta.appendChild(pasos);
      if (p.estado_envio === 'DEVUELTO') tarjeta.appendChild(el('p', { class: 'suave', text: 'Este envío fue devuelto. Escríbenos por WhatsApp para ayudarte.' }));
      if (p.transportadora || p.guia) {
        tarjeta.appendChild(el('p', { class: 'suave', text: 'Transportadora: ' + (p.transportadora || '—') + (p.guia ? ' · Guía: ' + p.guia : '') }));
      }
      if (p.token) {
        // A partir de aquí el pedido se consulta con su enlace privado
        try { history.replaceState(null, '', '?t=' + p.token); } catch (e) { /* ignorar */ }
        tarjeta.appendChild(el('p', { class: 'suave', text: 'Guarda esta página: con su enlace puedes ver el estado de tu envío cuando quieras.' }));
        if (navigator.clipboard && navigator.clipboard.writeText) {
          var copiar = el('button', { class: 'boton claro', type: 'button', text: 'Copiar enlace de seguimiento' });
          copiar.onclick = function () {
            navigator.clipboard.writeText(location.origin + location.pathname + '?t=' + p.token).then(function () { copiar.textContent = '¡Enlace copiado!'; }, function () {});
          };
          tarjeta.appendChild(copiar);
        }
      }
    }
    if (mal) tarjeta.appendChild(el('a', { class: 'boton', href: '/', text: 'Volver a la tienda' }));
  }

  function consultar() {
    var q = token ? 't=' + encodeURIComponent(token) : 'id=' + encodeURIComponent(idTx);
    fetch(API + '/api/seguimiento?' + q, { cache: 'no-store' })
      .then(function (r) { return r.status === 404 ? null : r.json(); })
      .then(function (p) {
        intentos++;
        if (!p) { if (intentos < 6) return setTimeout(consultar, INTERVALO); return pintarSinPedido(); }
        pintar(p);
        if (p.estado_pago === 'PENDING' && intentos < INTENTOS_MAX) setTimeout(consultar, INTERVALO);
      })
      .catch(function () {
        intentos++;
        if (intentos < INTENTOS_MAX) setTimeout(consultar, INTERVALO * 2); else pintarSinPedido();
      });
  }

  if (!token && !idTx) pintarSinPedido(); else consultar();
})();
