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
  foto:{src:"vestidos/look-1.jpg",w:1179,h:2096,video:"vestidos/look-1.mp4",poster:"vestidos/look-1-poster.jpg",
    /* dónde cae el primer y el último cuadro del video dentro de la foto (centro y ancho), para empalmar sin corte */
    vidIni:{c:[588,691],w:760},vidFin:{c:[603.5,1040],w:1166},vidW:1066,vidH:1894,
    disparos:[1.0,2.2,3.4,5.2,6.6]},
  /* la prenda colgada (cuello y=175, ruedo y=1065) cae sobre la modelo (cuello y=380, ruedo y=1200) */
  encaje:{x:208,y:219,w:715},
  puntoPrenda:[560,860],
  tacon:{id:"tacones-alessia-noir",n:"Tacones Alessia Noir",p:210000,colores:["Negro","Plata"],tallas:["34","35","36","37","38","39","40"],agotadas:[],punto:[652,1812],mini:"vestidos/alessia-mini.jpg",
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
  /* sin video: la sesión es de fotos (primer plano, perfil y al final la foto de frente) */
  foto:{src:"vestidos/celeste-2.jpg",w:768,h:1376,sesion:["vestidos/celeste-1.jpg","vestidos/celeste-3.jpg"]},
  /* la prenda colgada (cuello y=135, ruedo y=960) cae sobre la modelo (cuello y=215, ruedo y=705) */
  encaje:{x:146,y:135,w:459},
  puntoPrenda:[375,560],
  tacon:null /* pendiente: ¿cuál sandalia dorada MF es? */
}];
