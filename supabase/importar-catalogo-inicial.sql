-- Catálogo inicial derivado de DATA/catalogo_tienda.js (55 productos).
-- Seguro por defecto: stock cero y visible=false. No habilita ventas.
-- Ejecutar DESPUÉS de supabase/schema.sql en Supabase de pruebas.
-- Al reejecutar, actualiza nombre/precio sin pisar stock ni visibilidad ya revisados.

insert into public.productos (id, nombre, precio, stock, visible)
values
  ('sin-nombre-20oct_14-48', 'SET AURORA', 170000, '{"34":0,"35":0,"36":0,"37":0,"38":0,"39":0,"40":0}'::jsonb, false),
  ('plataforma', 'Plataforma', 170000, '{"34":0,"35":0,"36":0,"37":0,"38":0,"39":0,"40":0}'::jsonb, false),
  ('tacon-cristal-accesorio', 'TACÓN CRISTAL ACCESORIO', 169000, '{"34":0,"35":0,"36":0,"37":0,"38":0,"39":0,"40":0}'::jsonb, false),
  ('tacon-cristal', 'TACÓN CRISTAL', 175000, '{"34":0,"35":0,"36":0,"37":0,"38":0,"39":0,"40":0}'::jsonb, false),
  ('tacon-transparente-y-cuna-acrilica', 'tacón transparente y cuña acrílica', 249000, '{"34":0,"35":0,"36":0,"37":0,"38":0,"39":0,"40":0}'::jsonb, false),
  ('negro-clasico', 'Negro Clásico', 179000, '{"34":0,"35":0,"36":0,"37":0,"38":0,"39":0,"40":0}'::jsonb, false),
  ('luxury', 'Luxury', 220000, '{"34":0,"35":0,"36":0,"37":0,"38":0,"39":0,"40":0}'::jsonb, false),
  ('product', 'Transparencia Elegante', 210000, '{"34":0,"35":0,"36":0,"37":0,"38":0,"39":0,"40":0}'::jsonb, false),
  ('mediterranea', 'Mediterránea', 189000, '{"34":0,"35":0,"36":0,"37":0,"38":0,"39":0,"40":0}'::jsonb, false),
  ('rustica-soft-beige', 'rústica Soft Beige', 210000, '{"34":0,"35":0,"36":0,"37":0,"38":0,"39":0,"40":0}'::jsonb, false),
  ('dorada-glam', 'Dorada Glam', 195000, '{"34":0,"35":0,"36":0,"37":0,"38":0,"39":0,"40":0}'::jsonb, false),
  ('sandalias-glam', 'Sandalias Glam', 190000, '{"34":0,"35":0,"36":0,"37":0,"38":0,"39":0,"40":0}'::jsonb, false),
  ('confort', 'Confort', 189000, '{"34":0,"35":0,"36":0,"37":0,"38":0,"39":0,"40":0}'::jsonb, false),
  ('sandalias-destello', 'Sandalias Destello', 135000, '{"34":0,"35":0,"36":0,"37":0,"38":0,"39":0,"40":0}'::jsonb, false),
  ('golden-curve-1', 'Golden curve', 210000, '{"34":0,"35":0,"36":0,"37":0,"38":0,"39":0,"40":0}'::jsonb, false),
  ('elegancia-transparente', 'Elegancia transparente', 265000, '{"34":0,"35":0,"36":0,"37":0,"38":0,"39":0,"40":0}'::jsonb, false),
  ('naked', 'Naked', 249000, '{"34":0,"35":0,"36":0,"37":0,"38":0,"39":0,"40":0}'::jsonb, false),
  ('ebano-transparente', 'Ébano transparente', 219000, '{"34":0,"35":0,"36":0,"37":0,"38":0,"39":0,"40":0}'::jsonb, false),
  ('altissima', 'ALTISSIMA', 239000, '{"34":0,"35":0,"36":0,"37":0,"38":0,"39":0,"40":0}'::jsonb, false),
  ('diosa', 'Diosa', 220000, '{"34":0,"35":0,"36":0,"37":0,"38":0,"39":0,"40":0}'::jsonb, false),
  ('black-diva-heel', 'Black diva heel', 230000, '{"34":0,"35":0,"36":0,"37":0,"38":0,"39":0,"40":0}'::jsonb, false),
  ('venus', 'VENUS', 219000, '{"34":0,"35":0,"36":0,"37":0,"38":0,"39":0,"40":0}'::jsonb, false),
  ('atenea', 'Atenea', 289000, '{"34":0,"35":0,"36":0,"37":0,"38":0,"39":0,"40":0}'::jsonb, false),
  ('nude-elegance', 'Nude Elegance', 255000, '{"34":0,"35":0,"36":0,"37":0,"38":0,"39":0,"40":0}'::jsonb, false),
  ('black-soul', 'BLACK SOUL', 195000, '{"34":0,"35":0,"36":0,"37":0,"38":0,"39":0,"40":0}'::jsonb, false),
  ('noir-diva', 'Noir Diva', 265000, '{"34":0,"35":0,"36":0,"37":0,"38":0,"39":0,"40":0}'::jsonb, false),
  ('new-stile', 'New Era', 255000, '{"34":0,"35":0,"36":0,"37":0,"38":0,"39":0,"40":0}'::jsonb, false),
  ('mery', 'MERY', 270000, '{"34":0,"35":0,"36":0,"37":0,"38":0,"39":0,"40":0}'::jsonb, false),
  ('cristal', 'CRISTAL', 220000, '{"34":0,"35":0,"36":0,"37":0,"38":0,"39":0,"40":0}'::jsonb, false),
  ('pink-venom', 'Pink venom', 219000, '{"34":0,"35":0,"36":0,"37":0,"38":0,"39":0,"40":0}'::jsonb, false),
  ('alttisima', 'ZELENA', 235000, '{"34":0,"35":0,"36":0,"37":0,"38":0,"39":0,"40":0}'::jsonb, false),
  ('cielo-de-cristal', 'Cielo de Cristal', 255000, '{"34":0,"35":0,"36":0,"37":0,"38":0,"39":0,"40":0}'::jsonb, false),
  ('luz-de-venus', 'Brillos autentic', 255000, '{"34":0,"35":0,"36":0,"37":0,"38":0,"39":0,"40":0}'::jsonb, false),
  ('seda-de-cristal', 'Seda de Cristal', 249000, '{"34":0,"35":0,"36":0,"37":0,"38":0,"39":0,"40":0}'::jsonb, false),
  ('brisa-metalica', 'Brisa Metálica', 210000, '{"34":0,"35":0,"36":0,"37":0,"38":0,"39":0,"40":0}'::jsonb, false),
  ('silver-one', 'Silver one', 239000, '{"34":0,"35":0,"36":0,"37":0,"38":0,"39":0,"40":0}'::jsonb, false),
  ('gold-silver', 'GOLD & SILVER', 195000, '{"34":0,"35":0,"36":0,"37":0,"38":0,"39":0,"40":0}'::jsonb, false),
  ('sin-nombre-3jul_1-29', 'Onyx plataforma', 230000, '{"34":0,"35":0,"36":0,"37":0,"38":0,"39":0,"40":0}'::jsonb, false),
  ('aura', 'Aura', 230000, '{"34":0,"35":0,"36":0,"37":0,"38":0,"39":0,"40":0}'::jsonb, false),
  ('brillo-rose', 'Brillo Rosé', 218000, '{"34":0,"35":0,"36":0,"37":0,"38":0,"39":0,"40":0}'::jsonb, false),
  ('alma-carmesi', 'ALMA CARMESÍ', 259000, '{"34":0,"35":0,"36":0,"37":0,"38":0,"39":0,"40":0}'::jsonb, false),
  ('brillo-stelar', 'BRILLO STELAR', 259000, '{"34":0,"35":0,"36":0,"37":0,"38":0,"39":0,"40":0}'::jsonb, false),
  ('sin-nombre-13jul_2-38', 'LUZ DE CRISTAL KARINA G.', 255000, '{"34":0,"35":0,"36":0,"37":0,"38":0,"39":0,"40":0}'::jsonb, false),
  ('ivory-queen', 'Ivory Queen', 230000, '{"34":0,"35":0,"36":0,"37":0,"38":0,"39":0,"40":0}'::jsonb, false),
  ('centella', 'Centella', 289000, '{"34":0,"35":0,"36":0,"37":0,"38":0,"39":0,"40":0}'::jsonb, false),
  ('luz-serena', 'Luz serena', 235000, '{"34":0,"35":0,"36":0,"37":0,"38":0,"39":0,"40":0}'::jsonb, false),
  ('latido-de-cristal', 'Latido de cristal', 235000, '{"34":0,"35":0,"36":0,"37":0,"38":0,"39":0,"40":0}'::jsonb, false),
  ('rojo-ilusion', 'Rojo Ilusión', 210000, '{"34":0,"35":0,"36":0,"37":0,"38":0,"39":0,"40":0}'::jsonb, false),
  ('cadena-ebano', 'CADENA ÉBANO!', 245000, '{"34":0,"35":0,"36":0,"37":0,"38":0,"39":0,"40":0}'::jsonb, false),
  ('velvet-black', 'velvet black', 195000, '{"34":0,"35":0,"36":0,"37":0,"38":0,"39":0,"40":0}'::jsonb, false),
  ('gloria-nitida', 'Gloria nítida', 230000, '{"34":0,"35":0,"36":0,"37":0,"38":0,"39":0,"40":0}'::jsonb, false),
  ('cristal-de-altura', 'Cristal de Altura', 235000, '{"34":0,"35":0,"36":0,"37":0,"38":0,"39":0,"40":0}'::jsonb, false),
  ('diva-eleve', 'Diva Elevé', 230000, '{"34":0,"35":0,"36":0,"37":0,"38":0,"39":0,"40":0}'::jsonb, false),
  ('stella-grace', 'Stella', 185000, '{"34":0,"35":0,"36":0,"37":0,"38":0,"39":0,"40":0}'::jsonb, false),
  ('cielo-marfil', 'Cielo marfil', 179000, '{"34":0,"35":0,"36":0,"37":0,"38":0,"39":0,"40":0}'::jsonb, false)
on conflict (id) do update
set nombre = excluded.nombre,
    precio = excluded.precio;

-- Antes de habilitar un producto, verifica el precio y el inventario real por talla.
-- Solo entonces actualiza stock y visible=true para ese producto.
