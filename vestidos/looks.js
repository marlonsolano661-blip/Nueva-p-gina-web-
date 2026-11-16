/* Vestidos de Marlon Footwear: cada look de la sesión.
   Para agregar uno nuevo, copia el bloque { ... } y cambia los datos.
   - prenda: la prenda colgada sin fondo (frente y espalda), su tamaño en píxeles y dónde está el gancho.
   - venta / tacon: el id del producto en la tienda. Precio, tallas, colores y fotos se toman EN VIVO del catálogo;
     lo que se escribe aquí es solo el respaldo si el catálogo no responde.
   - foto: la foto de la modelo, su video y dónde empalman (medido sobre la foto original).
   - encaje: dónde cae la prenda sobre la modelo; tacon.punto: dónde cuelga la etiqueta (en píxeles de la foto). */
window.MF_VESTIDOS=[{
  nombre:"Noche en negro",grupo:"noche-glam",color:{n:"Negro",h:"#151515"},
  prenda:{n:"Noche glam",frente:"vestidos/prenda-frente.webp",espalda:"vestidos/prenda-espalda.webp",w:776,h:1071,gancho:[388,92],
    /* el vestido en la tienda (catálogo: noche-glam) */
    venta:{id:"noche-glam",n:"Noche glam",p:169900,color:"Negro",colores:["Negro","Celeste","Beige"],tallas:["XS","S","M","L","XL"],agotadas:["XS","XL"],
      fotos:[{u:"vestidos/prenda-frente.webp",fit:"contain"},{u:"vestidos/prenda-espalda.webp",fit:"contain"}],fotosColor:{}}},
  foto:{src:"vestidos/look-1-ini.jpg",inicio:"vestidos/look-1-ini.jpg",w:1066,h:1894,video:"vestidos/look-1.mp4",
    /* el video es el escenario: empieza en su primer cuadro (inicio) y termina quieto en el último */
    disparos:[1.0,2.2,3.4,5.2,6.6]},
  /* la prenda colgada cae sobre el vestido del PRIMER cuadro del video (cuello y=500, ruedo y=1666) */
  encaje:{x:46,y:308,w:996},
  /* puntos sobre el ÚLTIMO cuadro del video */
  puntoPrenda:[525,770],
  tacon:{id:"tacones-alessia-noir",n:"Tacones Alessia Noir",p:210000,colores:["Negro","Plata"],tallas:["34","35","36","37","38","39","40"],agotadas:[],punto:[583,1636],mini:"vestidos/alessia-mini.jpg",
    desc:["Aguja negra de tiras delgadas con pulsera al tobillo","Tacón 11 cm"],
    /* fotos propias del look; las del catálogo se agregan solas detrás */
    fotos:[{u:"vestidos/alessia-1.jpg",fit:"contain"},"vestidos/alessia-2.jpg","vestidos/alessia-3.jpg"],
    fotosColor:{Plata:["vestidos/alessia-plata.jpg"]}}
},{
  nombre:"Brisa celeste",grupo:"noche-glam",color:{n:"Celeste",h:"#a9c8ea"},
  prenda:{n:"Noche glam",frente:"vestidos/celeste-frente.webp",espalda:"vestidos/celeste-espalda.webp",w:772,h:1069,gancho:[386,92],
    /* el mismo vestido del catálogo (noche-glam), abierto en color Celeste */
    venta:{id:"noche-glam",n:"Noche glam",p:169900,color:"Celeste",colores:["Negro","Celeste","Beige"],tallas:["XS","S","M","L","XL"],agotadas:["XS","XL"],
      fotos:[{u:"vestidos/celeste-frente.webp",fit:"contain"},{u:"vestidos/celeste-espalda.webp",fit:"contain"}],fotosColor:{Celeste:[{u:"vestidos/celeste-frente.webp",fit:"contain"},{u:"vestidos/celeste-espalda.webp",fit:"contain"}]}}},
  /* sesión en video, en cámara lenta (0,75x): termina en la pose de frente con la mano en la cintura; el primer plano de las sandalias va en la compra del tacón */
  foto:{src:"vestidos/celeste-ini.jpg",inicio:"vestidos/celeste-ini.jpg",w:1080,h:1920,video:"vestidos/celeste.mp4",velocidad:.75,disparos:[0.35,0.85,1.35]},
  /* la prenda colgada cae sobre el vestido del PRIMER cuadro del video (cuello y=318, ruedo y=1089) */
  encaje:{x:188,y:189,w:656},
  /* puntos sobre el ÚLTIMO cuadro del video */
  puntoPrenda:[520,795],
  tacon:{id:"sandalia-miel-elite-mf",n:"Sandalia Miel Élite MF",p:199900,colores:["Camel","Negro"],tallas:["34","35","36","37","38","39","40"],agotadas:[],
    punto:[690,1660],mini:"vestidos/miel-mini.jpg",desc:["Sandalia de tiras cruzadas y tacón aguja"],
    /* primero el video de la sesión con las sandalias de cerca; las fotos del catálogo se agregan solas detrás */
    fotos:[{v:"vestidos/celeste-tacon.mp4"},"vestidos/miel-1.jpg","vestidos/miel-2.jpg"]}
},{
  nombre:"Arena beige",grupo:"noche-glam",color:{n:"Beige",h:"#e9dfcf"},
  /* la prenda en gancho es la misma del celeste, teñida al tono beige de la foto */
  prenda:{n:"Noche glam",frente:"vestidos/beige-frente.webp",espalda:"vestidos/beige-espalda.webp",w:772,h:1069,gancho:[386,92],
    venta:{id:"noche-glam",n:"Noche glam",p:169900,color:"Beige",colores:["Negro","Celeste","Beige"],tallas:["XS","S","M","L","XL"],agotadas:["XS","XL"],
      fotos:[{u:"vestidos/beige-frente.webp",fit:"contain"},{u:"vestidos/beige-espalda.webp",fit:"contain"}],fotosColor:{Beige:[{u:"vestidos/beige-frente.webp",fit:"contain"},{u:"vestidos/beige-espalda.webp",fit:"contain"}]}}},
  /* video 720p con fondo gris claro: los bordes se funden con el blanco de la página (fondo:"gris") */
  foto:{src:"vestidos/beige-ini.jpg",inicio:"vestidos/beige-ini.jpg",w:720,h:1280,video:"vestidos/beige.mp4",fondo:"gris",disparos:[1.6,3.4,5.2,7.0,8.6]},
  /* la prenda colgada cae sobre el vestido del PRIMER cuadro (cuello y=388, ruedo y=1170) */
  encaje:{x:12,y:257,w:666},
  /* puntos sobre el ÚLTIMO cuadro (sonriendo, de frente) */
  puntoPrenda:[350,575],
  /* en el video calza sandalias negras de tira al tobillo: por ahora Alessia Noir (confirmar) */
  tacon:{id:"tacones-alessia-noir",n:"Tacones Alessia Noir",p:210000,colores:["Negro","Plata"],tallas:["34","35","36","37","38","39","40"],agotadas:[],punto:[420,1105],mini:"vestidos/alessia-mini.jpg",
    desc:["Aguja negra de tiras delgadas con pulsera al tobillo","Tacón 11 cm"],
    fotos:[{u:"vestidos/alessia-1.jpg",fit:"contain"},"vestidos/alessia-2.jpg","vestidos/alessia-3.jpg"],fotosColor:{Plata:["vestidos/alessia-plata.jpg"]}}
},{
  nombre:"Esmeralda",grupo:"esmeralda",color:{n:"Verde esmeralda",h:"#0f4d3a"},
  /* vestido de lentejuelas, un hombro, con abertura en la cintura. La espalda en gancho se armó desde el frente
     (espejo, falda lisa y ruedo recto como en la foto de la modelo de espalda): cámbiala si llega la foto real */
  prenda:{n:"Vestido Esmeralda",frente:"vestidos/verde-frente.webp",espalda:"vestidos/verde-espalda.webp",w:684,h:1067,gancho:[342,92],
    /* PENDIENTE: crear el producto en la tienda (id vestido-esmeralda) con su precio y tallas */
    venta:{id:"vestido-esmeralda",n:"Vestido Esmeralda",color:"Verde esmeralda",colores:["Verde esmeralda"],tallas:["XS","S","M","L","XL"],agotadas:[],
      fotos:[{u:"vestidos/verde-frente.webp",fit:"contain"},{u:"vestidos/verde-espalda.webp",fit:"contain"},"vestidos/verde-modelo-frente.jpg","vestidos/verde-modelo-espalda.jpg"],fotosColor:{}}},
  /* video 4K recortado a 1080 de ancho (bordes negros fuera): termina con la mano en el pelo y la otra en la cintura */
  foto:{src:"vestidos/verde-ini.jpg",inicio:"vestidos/verde-ini.jpg",w:1080,h:1938,video:"vestidos/verde.mp4",disparos:[1.0,2.4,3.8,5.4,6.8]},
  /* la prenda colgada cae sobre el vestido del PRIMER cuadro (ruedo y=1127, cadera 333–719) */
  encaje:{x:230,y:228,w:581},
  /* puntos sobre el ÚLTIMO cuadro */
  puntoPrenda:[580,840],
  /* sandalias negras de tira al tobillo: por ahora Alessia Noir (confirmar) */
  tacon:{id:"tacones-alessia-noir",n:"Tacones Alessia Noir",p:210000,colores:["Negro","Plata"],tallas:["34","35","36","37","38","39","40"],agotadas:[],punto:[812,1800],mini:"vestidos/alessia-mini.jpg",
    desc:["Aguja negra de tiras delgadas con pulsera al tobillo","Tacón 11 cm"],
    fotos:[{u:"vestidos/alessia-1.jpg",fit:"contain"},"vestidos/alessia-2.jpg","vestidos/alessia-3.jpg"],fotosColor:{Plata:["vestidos/alessia-plata.jpg"]}}
}];
