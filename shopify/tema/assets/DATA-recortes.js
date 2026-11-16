/* LA VITRINA del inicio ya no tiene lista fija: los zapatos y su orden se eligen en el panel (Vitrina). */
window.MF_VITRINA = window.MF_VITRINA || [];

/* Fotos SIN FONDO para "La vitrina" del inicio.
   Formato:  'id-del-producto': 'https://tienda.mfcol.com/assets/recortes/archivo.webp'
   - El id es el mismo de la tienda (el que sale en el enlace: ?producto=<id>).
   - Con 3 o más fotos aquí, la vitrina muestra solo estos zapatos "flotando" sobre la repisa.
     Con menos de 3, la vitrina usa las fotos normales del catálogo (sigue funcionando igual).
   - Las fotos van en assets/recortes/ (PNG o WEBP con fondo transparente, idealmente cuadradas y con el zapato apoyado abajo).
   No cambia precios, tallas, carrito ni pagos. */
window.MF_RECORTES = window.MF_RECORTES || {
  // Pendiente: confirmar a qué producto corresponde cada foto y quitar las dos barras (//) de la línea.
  // 'id-sandalia-tira':   'https://tienda.mfcol.com/assets/recortes/nude-tira.webp',
  // 'id-plataforma-nude': 'https://tienda.mfcol.com/assets/recortes/plataforma-nude.webp',
  // 'id-trenza-plata':    'https://tienda.mfcol.com/assets/recortes/trenza-plata.webp',
  // 'id-trenza-negra':    'https://tienda.mfcol.com/assets/recortes/trenza-negra.webp',
  // 'id-trenza-dorada':   'https://tienda.mfcol.com/assets/recortes/trenza-dorada.webp',
  // 'id-trio-charol':     'https://tienda.mfcol.com/assets/recortes/trio-charol.webp',
};
