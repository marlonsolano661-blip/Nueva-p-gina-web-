-- PEDIDOS NUEVOS · MF Colombia
-- Pégalo en Supabase > SQL Editor y pulsa Run. Se puede ejecutar más de una vez sin problema.
-- Agrega la marca "visto" a cada pedido: en el panel, los pedidos pagados que no hayas visto salen como NUEVO.

alter table pedidos add column if not exists visto_en timestamptz;

-- Los pedidos que ya existen se marcan como vistos: solo los que lleguen desde ahora saldrán como NUEVO.
update pedidos set visto_en = now() where visto_en is null;
