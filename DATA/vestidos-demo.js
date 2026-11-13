/* Prendas de PRUEBA para "El perchero" (solo para revisar en la vista previa).
   Salen de primeras en el perchero aunque todavía no estén en el catálogo; no se pueden comprar hasta cargarlas en el panel.
   Las fotos y el video van en assets/vestidos/. Fotos de prenda: PNG/WEBP sin fondo. Modelo: fondo blanco. Video: .mp4 vertical.
   Cada color puede tener: img (frente colgado), espalda, modelo (lista de fotos puesta) y video. */
window.MF_PRODUCTOS_EXTRA = window.MF_PRODUCTOS_EXTRA || [
  {
    id: 'vestido-camisero', name: 'Vestido camisero', price: 0, coleccion: 'vestidos',
    desc: 'Cuello en punta, botones al frente, fajón drapeado en la cintura y falda con volantes.',
    tallas: ['XS', 'S', 'M', 'L', 'XL'],
    img: 'assets/vestidos/marfil-frente.webp', imgs: ['assets/vestidos/marfil-frente.webp'],
    colors: [
      { n: 'Marfil', h: '#efe8da', img: 'assets/vestidos/marfil-frente.webp', espalda: 'assets/vestidos/marfil-espalda.webp',
        modelo: ['assets/vestidos/marfil-modelo-1.webp', 'assets/vestidos/marfil-modelo-2.webp'] },
      { n: 'Negro', h: '#111111', img: 'assets/vestidos/negro-frente.webp', espalda: 'assets/vestidos/negro-espalda.webp',
        modelo: ['assets/vestidos/negro-modelo-1.webp', 'assets/vestidos/negro-modelo-2.webp'], video: 'assets/vestidos/negro-video.mp4' },
      { n: 'Celeste', h: '#a9cbea', img: 'assets/vestidos/celeste-frente.webp', espalda: 'assets/vestidos/celeste-espalda.webp',
        modelo: ['assets/vestidos/celeste-modelo-1.webp'] }
    ]
  }
];
