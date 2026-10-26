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
  var intentos = 0, carritoLimpio = false, ultimaFirma = '', seguimientos = 0, SEGUIMIENTOS_MAX = 2880;  // sigue revisando cada 30 s mientras la página esté abierta

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

  /* ---- Línea de seguimiento: 5 pasos, cada uno con su animación cuando el pedido avanza ---- */
  var ICONOS = {
    recibido: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    preparando: '<path d="M4 8l8-4 8 4v9l-8 4-8-4z"/><path d="M4 8l8 4 8-4M12 12v9"/>',
    enviado: '<path d="M2.5 6.5h11v9h-11zM13.5 9.5h4l3 3v3h-7"/><circle cx="7" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/>',
    destino: '<path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0113 0c0 5.4-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.4"/>',
    entregado: '<path d="M4 10h16v10H4zM3 6.5h18V10H3zM12 6.5V20M12 6.5C10 3 6.5 3.5 7 5.5s3.5 1 5 1c1.5 0 5 1 5-1S14 3 12 6.5z"/>'
  };
  var PASOS = [
    ['recibido', 'Pedido recibido', 'Tu pago fue aprobado.'],
    ['preparando', 'Estamos preparando tu pedido', 'Estamos alistando tu par con cuidado.'],
    ['enviado', 'Pedido enviado', 'Tu pedido salió hacia tu ciudad.'],
    ['destino', 'Pedido en destino', 'Tu pedido llegó a tu ciudad.'],
    ['entregado', 'Pedido entregado', '¡Que lo disfrutes!']
  ];
  var ETAPA = { PREPARANDO: 1, EN_CAMINO: 2, EN_DESTINO: 3, ENTREGADO: 4, DEVUELTO: 2 };
  var etapaVista = null;   // última etapa que el cliente ya vio animada
  function etapaGuardada(ref) { try { var v = localStorage.getItem('mf_seg_' + ref); return v == null ? null : parseInt(v, 10); } catch (e) { return null; } }
  function guardarEtapa(ref, n) { try { localStorage.setItem('mf_seg_' + ref, String(n)); } catch (e) { /* sin storage */ } }
  var NS = 'http://www.w3.org/2000/svg';
  function icono(k) {
    var s = document.createElementNS(NS, 'svg'); s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('class', 'ico'); s.setAttribute('aria-hidden', 'true');
    s.innerHTML = ICONOS[k]; return s;
  }
  function lineaEnvio(p) {
    var actual = ETAPA[p.estado_envio] != null ? ETAPA[p.estado_envio] : 1;
    var previa = etapaVista != null ? etapaVista : etapaGuardada(p.reference);
    var avanzo = previa != null && previa < actual;       // el estado cambió desde la última vez que lo vio
    var ol = el('ol', { class: 'linea', 'aria-label': 'Estado de tu pedido' });
    PASOS.forEach(function (d, n) {
      var cls = 'et ' + (n < actual ? 'hecho' : n === actual ? 'actual' : 'falta');
      var detalle = d[2];
      if (n === 2 && p.transportadora) detalle = 'Va con ' + p.transportadora + (p.guia ? ' · guía ' + p.guia : '') + '.';
      // Animación: pasos nuevos (desde la etapa que ya había visto) o todos en la primera visita
      var anima = previa == null ? n <= actual : (n > previa && n <= actual);
      if (anima) cls += ' anima';
      if (avanzo && n === actual) cls += ' nuevo';
      var li = el('li', n === actual ? { class: cls, 'aria-current': 'step' } : { class: cls }, [
        el('span', { class: 'dot' }, [icono(d[0])]),
        el('div', { class: 'tx' }, [el('b', { text: d[1] }), el('small', { text: n <= actual ? detalle : '' })])
      ]);
      if (anima) li.style.setProperty('--d', (previa == null ? n : n - previa - 1) * 0.55 + 's');
      if (n === 2 && n === actual) li.appendChild(el('span', { class: 'camion', 'aria-hidden': 'true' }));
      ol.appendChild(li);
    });
    ol.style.setProperty('--n', actual);
    etapaVista = actual; guardarEtapa(p.reference, actual);
    var caja = el('div', { class: 'seg' }, [ol]);
    if (actual === 4 && (previa == null || previa < 4)) setTimeout(confeti, 600);
    return caja;
  }
  function confeti() {
    if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    for (var i = 0; i < 40; i++) {
      var c = el('i', { class: 'cf1' }); c.style.left = (Math.random() * 100) + 'vw'; c.style.setProperty('--x', (Math.random() * 120 - 60) + 'px');
      c.style.animationDelay = (Math.random() * .6) + 's'; document.body.appendChild(c);
      setTimeout((function (n) { return function () { n.remove(); }; })(c), 3600);
    }
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
    if (ok) { tarjeta.appendChild(el('hr')); tarjeta.appendChild(lineaEnvio(p)); }
    tarjeta.appendChild(el('hr'));

    tarjeta.appendChild(el('h2', { class: 'sec', text: 'Resumen de tu compra' }));
    var ul = el('ul');
    (p.items || []).forEach(function (i) {
      var det = 'Talla ' + i.talla + (i.color ? ' · ' + i.color : '') + ' · Cant. ' + i.cant;
      var precio = i.precio != null ? pesos(i.precio * i.cant * 100) : '';
      ul.appendChild(el('li', {}, [
        el('span', {}, [el('strong', { text: i.nombre }), el('small', { class: 'suave', text: det })]),
        el('span', { text: precio }),
      ]));
    });
    tarjeta.appendChild(ul);
    var fil = [];
    if (p.subtotal_centavos != null) fil.push(el('div', { class: 'fila-r' }, [el('span', { text: 'Productos' }), el('span', { text: pesos(p.subtotal_centavos) })]));
    if (p.envio_centavos != null) fil.push(el('div', { class: 'fila-r' }, [el('span', { text: 'Envío' }), el('span', { text: pesos(p.envio_centavos) })]));
    // Descuento: los productos valen más que el subtotal guardado (que ya viene con el descuento)
    var bruto = (p.items || []).reduce(function (t, i) { return t + (Number(i.precio) || 0) * (Number(i.cant) || 0) * 100; }, 0);
    var desc = (p.subtotal_centavos != null && bruto > Number(p.subtotal_centavos)) ? bruto - Number(p.subtotal_centavos) : 0;
    if (desc > 0) { fil.length = 0; fil.push(el('div', { class: 'fila-r' }, [el('span', { text: 'Productos' }), el('span', { text: pesos(bruto) })])); fil.push(el('div', { class: 'fila-r' }, [el('span', { text: 'Descuento' }), el('span', { text: '−' + pesos(desc) })])); if (p.envio_centavos != null) fil.push(el('div', { class: 'fila-r' }, [el('span', { text: 'Envío' }), el('span', { text: pesos(p.envio_centavos) })])); }
    fil.forEach(function (f) { tarjeta.appendChild(f); });
    tarjeta.appendChild(el('div', { class: 'total' }, [el('span', { text: 'Total' }), el('span', { text: pesos(p.amount_in_cents) })]));
    if (p.payment_method_type) tarjeta.appendChild(el('p', { class: 'suave', text: 'Medio de pago: ' + ({ CARD: 'Tarjeta', NEQUI: 'Nequi', PSE: 'PSE', BANCOLOMBIA_TRANSFER: 'Bancolombia', BANCOLOMBIA_COLLECT: 'Bancolombia' }[p.payment_method_type] || p.payment_method_type) }));

    var c = p.cliente;
    if (c) {
      tarjeta.appendChild(el('h2', { class: 'sec', text: 'Datos de tu compra' }));
      var dl = el('div', { class: 'datos' });
      [['Nombre', c.nombre], ['WhatsApp', c.tel], ['Correo', c.email], ['Ciudad', c.ciudad], ['Dirección de entrega', c.direccion]].forEach(function (d) {
        if (d[1]) dl.appendChild(el('div', { class: 'fila-r' }, [el('span', { class: 'suave', text: d[0] }), el('span', { text: d[1] })]));
      });
      tarjeta.appendChild(dl);
    }

    if (ok) {
      limpiarCarrito();
      if (p.estado_envio === 'DEVUELTO') tarjeta.appendChild(el('p', { class: 'suave', text: 'Este envío fue devuelto. Escríbenos por WhatsApp para ayudarte.' }));
      if (p.transportadora || p.guia || p.link_rastreo) {
        var envio = el('div', { class: 'datos' });
        if (p.transportadora) envio.appendChild(el('div', { class: 'fila-r' }, [el('span', { class: 'suave', text: 'Transportadora' }), el('span', { text: p.transportadora })]));
        if (p.guia) envio.appendChild(el('div', { class: 'fila-r' }, [el('span', { class: 'suave', text: 'Número de guía' }), el('span', { text: p.guia })]));
        tarjeta.appendChild(envio);
        if (p.link_rastreo && /^https:\/\//i.test(p.link_rastreo)) {
          tarjeta.appendChild(el('a', { class: 'boton', href: p.link_rastreo, target: '_blank', rel: 'noopener noreferrer', text: 'Rastrear pedido' }));
        } else if (p.estado_envio === 'EN_CAMINO') {
          tarjeta.appendChild(el('p', { class: 'suave', text: 'Pronto verás aquí el botón para rastrear tu pedido.' }));
        }
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
      .then(function (r) { if (r.status === 404) return null; if (!r.ok) throw new Error('http ' + r.status); return r.json(); })
      .then(function (p) {
        intentos++;
        // Con ?id= solo llega el token; se vuelve a consultar con el enlace privado para ver también los datos de la compra
        if (p && !token && p.token) { token = p.token; return consultar(); }
        if (!p) { if (ultimaFirma) return setTimeout(consultar, 30000); if (intentos < 6) return setTimeout(consultar, INTERVALO); return pintarSinPedido(); }
        if (!p.estado_pago) throw new Error('respuesta inválida');
        var firma = JSON.stringify(p);
        if (firma !== ultimaFirma) { ultimaFirma = firma; pintar(p); }
        if (p.estado_pago === 'PENDING' && intentos < INTENTOS_MAX) setTimeout(consultar, INTERVALO);
        else if (p.estado_pago === 'APPROVED' && p.estado_envio !== 'ENTREGADO' && p.estado_envio !== 'DEVUELTO' && seguimientos++ < SEGUIMIENTOS_MAX) setTimeout(consultar, window.MF_SEG_MS || 30000);
      })
      .catch(function () {
        if (ultimaFirma) return setTimeout(consultar, 30000);   // ya se mostró el pedido: un fallo de red no lo borra
        intentos++;
        if (intentos < INTENTOS_MAX) setTimeout(consultar, INTERVALO * 2); else pintarSinPedido();
      });
  }

  if (!token && !idTx) pintarSinPedido(); else consultar();
})();
