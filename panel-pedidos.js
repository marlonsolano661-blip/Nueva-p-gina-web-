/* Panel interno de pedidos. La clave se pide al abrir y solo se guarda en esta pestaña (sessionStorage).
   Este archivo NO contiene ningún secreto: la clave real vive en la variable ADMIN_TOKEN del servidor. */
(function () {
  'use strict';
  var API = window.MF_API_BASE || '';
  var $ = function (id) { return document.getElementById(id); };
  var lista = $('lista'), msg = $('msg');

  function token() { try { return sessionStorage.getItem('mf_admin') || ''; } catch (e) { return ''; } }
  function guardar(t) { try { if (t) sessionStorage.setItem('mf_admin', t); else sessionStorage.removeItem('mf_admin'); } catch (e) { /* ignorar */ } }
  function aviso(t, tipo) { msg.textContent = t || ''; msg.className = tipo || ''; }
  function el(tag, props, hijos) {
    var n = document.createElement(tag);
    Object.keys(props || {}).forEach(function (k) {
      if (k === 'text') n.textContent = props[k]; else if (k === 'class') n.className = props[k]; else n.setAttribute(k, props[k]);
    });
    (hijos || []).forEach(function (h) { if (h) n.appendChild(h); });
    return n;
  }
  function pesos(c) { return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number(c) / 100); }
  function fecha(s) { return s ? new Date(s).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' }) : '—'; }

  function llamar(ruta, opciones) {
    opciones = opciones || {};
    opciones.headers = Object.assign({ Authorization: 'Bearer ' + token() }, opciones.headers || {});
    return fetch(API + ruta, opciones).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) {
        if (r.status === 401) { guardar(''); mostrar(false); throw new Error('Clave incorrecta'); }
        if (!r.ok) throw new Error(d.error || 'Error ' + r.status);
        return d;
      });
    });
  }

  function mostrar(dentro) {
    $('filtros').hidden = !dentro; $('salir').hidden = !dentro; $('entrar').hidden = dentro; $('token').hidden = dentro;
    if (!dentro) lista.textContent = '';
  }

  function tarjeta(p) {
    var cli = p.cliente || {};
    var tel = String(cli.tel || '').replace(/\D/g, '');
    var sel = el('select', { 'aria-label': 'Estado de envío' });
    [['PREPARANDO', 'Preparando'], ['EN_CAMINO', 'Enviado (en camino)'], ['EN_DESTINO', 'En destino (llegó a la ciudad)'], ['ENTREGADO', 'Entregado'], ['DEVUELTO', 'Devuelto']].forEach(function (o) {
      var op = el('option', { value: o[0], text: o[1] }); if (o[0] === p.estado_envio) op.selected = true; sel.appendChild(op);
    });
    var transp = el('input', { type: 'text', placeholder: 'Transportadora', maxlength: '40', 'aria-label': 'Transportadora' }); transp.value = p.transportadora || '';
    var guia = el('input', { type: 'text', placeholder: 'Número de guía', maxlength: '60', 'aria-label': 'Número de guía' }); guia.value = p.guia || '';
    var link = el('input', { type: 'url', placeholder: 'Link de rastreo (https://…)', maxlength: '300', 'aria-label': 'Link de rastreo', inputmode: 'url', autocapitalize: 'off' }); link.value = p.link_rastreo || '';
    var boton = el('button', { type: 'button', text: 'Guardar envío' });
    var aprobado = p.estado_pago === 'APPROVED';
    [sel, transp, guia, link, boton].forEach(function (x) { x.disabled = !aprobado; });
    boton.onclick = function () {
      boton.disabled = true;
      llamar('/api/admin-pedidos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: p.id, estado_envio: sel.value, transportadora: transp.value, guia: guia.value, link_rastreo: link.value }) })
        .then(function () { aviso('Envío actualizado (' + p.referencia + ')', 'ok'); })
        .catch(function (e) { aviso(e.message, 'mal'); })
        .then(function () { boton.disabled = false; });
    };

    var items = (p.items || []).map(function (i) { return i.cant + ' × ' + i.nombre + ' (talla ' + i.talla + ')'; }).join(' · ');
    var contacto = el('p', {}, [
      document.createTextNode((cli.nombre || '—') + (cli.documento ? ' · CC ' + cli.documento : '') + ' · '),
      tel ? el('a', { href: 'https://wa.me/57' + tel.replace(/^57/, ''), target: '_blank', rel: 'noopener', text: cli.tel }) : document.createTextNode('—'),
    ]);
    return el('article', { class: 'pedido' }, [
      el('div', { class: 'fila' }, [
        el('span', { class: 'ref', text: p.referencia }),
        el('span', { class: 'etiqueta ' + p.estado_pago, text: p.estado_pago }),
        el('strong', { text: pesos(p.monto_centavos) }),
      ]),
      el('p', { class: 'suave', text: 'Creado ' + fecha(p.creado_en) + ' · Pagado ' + fecha(p.pagado_en) + (p.metodo ? ' · ' + p.metodo : '') + (p.consent_wa ? ' · Aceptó WhatsApp' : '') }),
      p.alerta ? el('div', { class: 'alerta', text: 'Revisar: ' + p.alerta }) : null,
      contacto,
      cli.email ? el('p', { class: 'suave', text: cli.email }) : null,
      el('p', { class: 'suave', text: (cli.direccion || '') + (cli.nota ? ' · Nota: ' + cli.nota : '') }),
      el('p', { text: items }),
      el('div', { class: 'envio' }, [sel, transp, guia, link, boton]),
    ]);
  }

  function cargar() {
    aviso('Cargando…');
    var q = new URLSearchParams({ limite: '100' });
    if ($('f-pago').value) q.set('pago', $('f-pago').value);
    if ($('f-envio').value) q.set('envio', $('f-envio').value);
    llamar('/api/admin-pedidos?' + q).then(function (d) {
      lista.textContent = '';
      (d.pedidos || []).forEach(function (p) { lista.appendChild(tarjeta(p)); });
      aviso((d.pedidos || []).length ? '' : 'No hay pedidos con ese filtro.');
    }).catch(function (e) { aviso(e.message, 'mal'); });
  }

  $('entrar').onclick = function () {
    var t = $('token').value.trim(); if (!t) return aviso('Escribe la clave', 'mal');
    guardar(t); $('token').value = ''; mostrar(true); cargar();
  };
  $('token').addEventListener('keydown', function (e) { if (e.key === 'Enter') $('entrar').click(); });
  $('salir').onclick = function () { guardar(''); mostrar(false); aviso(''); };
  $('recargar').onclick = cargar; $('f-pago').onchange = cargar; $('f-envio').onchange = cargar;

  if (token()) { mostrar(true); cargar(); } else mostrar(false);
})();
