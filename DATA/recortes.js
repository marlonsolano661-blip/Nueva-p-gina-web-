/* Fotos SIN FONDO para "La vitrina" del inicio.
   Formato:  'id-del-producto': 'assets/recortes/archivo.webp'
   - El id es el mismo de la tienda (el que sale en el enlace: ?producto=<id>).
   - Con 3 o más fotos aquí, la vitrina muestra solo estos zapatos "flotando" sobre la repisa.
     Con menos de 3, la vitrina usa las fotos normales del catálogo (sigue funcionando igual).
   - Las fotos van en assets/recortes/ (PNG o WEBP con fondo transparente, idealmente cuadradas y con el zapato apoyado abajo).
   No cambia precios, tallas, carrito ni pagos. */
window.MF_RECORTES = window.MF_RECORTES || {
  // Pendiente: confirmar a qué producto corresponde cada foto y quitar las dos barras (//) de la línea.
  // 'id-sandalia-tira':   'assets/recortes/nude-tira.webp',
  // 'id-plataforma-nude': 'assets/recortes/plataforma-nude.webp',
  // 'id-trenza-plata':    'assets/recortes/trenza-plata.webp',
  // 'id-trenza-negra':    'assets/recortes/trenza-negra.webp',
  // 'id-trenza-dorada':   'assets/recortes/trenza-dorada.webp',
  // 'id-trio-charol':     'assets/recortes/trio-charol.webp',
};
