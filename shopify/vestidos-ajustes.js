/* Videos nuevos (fondo blanco) de "Arena beige" y "Brisa celeste" en la copia de Shopify:
   tamaño del video, momentos del flash y dónde van los puntos de compra sobre el último cuadro. */
(function () {
  var N = {
    'Arena beige': { w: 1080, h: 1676, puntoPrenda: [510, 600], tacon: [525, 1560] },
    'Brisa celeste': { w: 1080, h: 1606, puntoPrenda: [549, 570], tacon: [594, 1530] }
  };
  (window.MF_VESTIDOS || []).forEach(function (L) {
    var n = N[L.nombre]; if (!n || !L.foto) return;
    L.foto.w = n.w; L.foto.h = n.h;
    delete L.foto.velocidad; delete L.foto.fondo;
    L.foto.disparos = [1.5, 3.5, 5.5, 7.5, 9.2];
    L.encaje = { x: Math.round(n.w * 0.28), y: Math.round(n.h * 0.17), w: Math.round(n.w * 0.44) };
    L.puntoPrenda = n.puntoPrenda;
    if (L.tacon) L.tacon.punto = n.tacon;
  });
})();
