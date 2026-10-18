# Preparación de la integración (sin activar cobros)

Esta rama es de integración. No desplegar a producción ni usar claves de producción hasta completar las verificaciones.

## Supabase

1. Abre el proyecto Supabase de pruebas y entra en SQL Editor.
2. Revisa y ejecuta `supabase/schema.sql`.
3. Confirma que existan `productos`, `pedidos` y la función RPC `aprobar_pedido`; RLS debe estar habilitado.
4. Ejecuta `supabase/importar-catalogo-inicial.sql`: contiene los 55 productos y precios del catálogo actual, pero los crea con stock cero y `visible=false`. Después verifica IDs, precios COP e inventario real por talla. No cargues stock ficticio. Solo habilita un producto después de confirmar su disponibilidad.
5. No crees políticas públicas para pedidos. La clave de servicio solo se configura en el servidor.

## Variables de entorno de prueba

Configura en el entorno de pruebas: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `WOMPI_PUBLIC_KEY` (debe comenzar por `pub_test_`), `WOMPI_INTEGRITY_SECRET`, `WOMPI_EVENTS_SECRET`, `SITE_URL` y `ADMIN_TOKEN` (mínimo 24 caracteres aleatorios). No pegues secretos en GitHub ni en el chat.

La función de creación de pedidos rechaza claves públicas que no sean de prueba.

## Endpoints

- `POST /api/crear-pedido`: valida productos y stock en el servidor, calcula subtotal y añade envío fijo de **17.500 COP**, registra el pedido pendiente y genera checkout de prueba.
- `POST /api/webhook-wompi`: valida la firma, moneda COP, referencia y monto; la función SQL gestiona aprobación idempotente.
- `GET /api/seguimiento?t=<token>` o `?id=<transacción>`: devuelve estado guardado en base de datos; no declara pagado a partir del retorno del navegador.
- `GET/POST /api/admin-pedidos`: requiere `Authorization: Bearer <ADMIN_TOKEN>`.

## Antes de probar

- No activar checkout real ni configurar un webhook de producción.
- Ejecutar pruebas unitarias e integración contra base de pruebas para aprobación, rechazo, evento repetido, importe incorrecto, stock insuficiente, seguimiento y panel.
- Configurar el webhook solo con URL y secreto del mismo entorno de pruebas.
- No confiar en importes enviados por el navegador.

## Limitaciones conocidas

- El backend valida existencias al crear el pedido, pero no reserva stock mientras la persona permanece en el checkout. Antes de recibir tráfico real, debe implementarse reserva con expiración o una operación atómica para evitar ventas concurrentes de la última unidad.
- El catálogo inicial está preparado en `supabase/importar-catalogo-inicial.sql`, con stock cero y visibilidad desactivada; la verificación manual de existencias por talla sigue siendo obligatoria.
- Las tablas y variables de Supabase deben configurarse manualmente en el proyecto de pruebas.
