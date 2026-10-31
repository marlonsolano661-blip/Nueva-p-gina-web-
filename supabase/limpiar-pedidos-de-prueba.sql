-- LIMPIAR PEDIDOS DE PRUEBA · MF Colombia
-- Se pega en Supabase > SQL Editor. Está hecho para que NO borre nada hasta que tú lo decidas:
--   PASO 1 solo MIRA (no cambia nada).  PASO 2 y 3 vienen comentados: quita los "--" solo de lo que quieras ejecutar.
-- Los borrados no se pueden deshacer. Si dudas, descarga antes una copia: Table Editor > pedidos > Export.

-- PASO 1 · Mira todos tus pedidos (los más nuevos primero) y anota cuáles son de prueba.
select id, referencia, estado_pago, estado_envio, monto_centavos / 100 as total_pesos,
       cliente->>'nombre' as cliente, creado_en at time zone 'America/Bogota' as creado_bogota
from pedidos
order by creado_en desc;

-- PASO 2 · Borrar SOLO los pedidos que tú elijas por su id (cambia los números por los ids de prueba del paso 1).
-- delete from eventos where referencia in (select referencia from pedidos where id in (1, 2, 3));
-- delete from pedidos where id in (1, 2, 3);

-- PASO 3 (alternativa) · Borrar todos los pedidos creados ANTES de una fecha (por ejemplo, el día que lanzas).
-- Cambia la fecha y la hora. Revisa primero con este conteo que sean los que esperas:
-- select count(*) from pedidos where creado_en < '2026-10-31 00:00:00-05';
-- delete from eventos where referencia in (select referencia from pedidos where creado_en < '2026-10-31 00:00:00-05');
-- delete from pedidos where creado_en < '2026-10-31 00:00:00-05';

-- OJO con el inventario: si algún pedido de prueba estaba APPROVED, el pago descontó pares del stock.
-- Borrar el pedido NO devuelve esos pares. Revisa y corrige cada talla en el panel > Inventario.
