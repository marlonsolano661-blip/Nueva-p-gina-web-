/* Vestidos de Marlon Footwear: cada look de la sesión.
   Para agregar uno nuevo, copia el bloque { ... } y cambia los datos.
   - prenda: la prenda colgada sin fondo (frente y espalda), su tamaño en píxeles y dónde está el gancho.
   - venta / tacon: el id del producto en la tienda. Precio, tallas, colores y fotos se toman EN VIVO del catálogo;
     lo que se escribe aquí es solo el respaldo si el catálogo no responde.
   - foto: la foto de la modelo, su video y dónde empalman (medido sobre la foto original).
   - encaje: dónde cae la prenda sobre la modelo; tacon.punto: dónde cuelga la etiqueta (en píxeles de la foto). */
window.MF_VESTIDOS=[{
  nombre:"Noche en negro",
  prenda:{n:"Noche glam",frente:"vestidos/prenda-frente.webp",espalda:"vestidos/prenda-espalda.webp",w:776,h:1071,gancho:[388,92],
    /* el vestido en la tienda (catálogo: noche-glam) */
    venta:{id:"noche-glam",n:"Noche glam",p:169900,colores:["Negro","Celeste","Beige"],tallas:["XS","S","M","L","XL"],agotadas:["XS","XL"],
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
  nombre:"Brisa celeste",
  prenda:{n:"Noche glam · Celeste",frente:"vestidos/celeste-frente.webp",espalda:null,w:772,h:1069,gancho:[386,92],
    /* el mismo vestido del catálogo (noche-glam), abierto en color Celeste */
    venta:{id:"noche-glam",n:"Noche glam",p:169900,color:"Celeste",colores:["Negro","Celeste","Beige"],tallas:["XS","S","M","L","XL"],agotadas:["XS","XL"],
      fotos:[{u:"vestidos/celeste-frente.webp",fit:"contain"}],fotosColor:{Celeste:[{u:"vestidos/celeste-frente.webp",fit:"contain"}]}}},
  /* sesión en video (termina en el último cuadro de cuerpo entero; el primer plano de las sandalias va en la compra del tacón) */
  foto:{src:"vestidos/celeste-ini.jpg",inicio:"vestidos/celeste-ini.jpg",w:1080,h:1920,video:"vestidos/celeste.mp4",disparos:[0.9,2.0,3.1,4.3]},
  /* la prenda colgada cae sobre el vestido del PRIMER cuadro del video (cuello y=318, ruedo y=1089) */
  encaje:{x:188,y:189,w:656},
  /* puntos sobre el ÚLTIMO cuadro del video */
  puntoPrenda:[598,775],
  tacon:null /* pendiente: ¿cuál sandalia dorada MF es? */
}];
