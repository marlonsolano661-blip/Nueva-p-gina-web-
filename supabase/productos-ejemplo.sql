-- Plantilla para cargar el catálogo. Ejecuta supabase/schema.sql primero.
-- El "id" debe ser EXACTAMENTE el mismo que usa el carrito de index.html para ese producto.
-- precio: pesos COP enteros, sin puntos (189900 = $189.900).
-- stock: unidades por talla. Si una talla no aparece, se considera sin stock.
-- Puedes volver a ejecutarlo: actualiza los productos que ya existen.

insert into productos (id, nombre, precio, stock, visible) values
  ('plataforma-luna', 'Plataforma Luna', 189900, '{"34":2,"35":3,"36":4,"37":4,"38":3,"39":2,"40":1}', true),
  ('tacon-aurora',    'Tacón Aurora',    169900, '{"34":1,"35":2,"36":3,"37":3,"38":2,"39":1,"40":0}', true)
on conflict (id) do update
  set nombre = excluded.nombre, precio = excluded.precio, stock = excluded.stock, visible = excluded.visible;

-- Ver el catálogo cargado:
-- select id, nombre, precio, stock, visible from productos order by id;
