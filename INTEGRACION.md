# Integración tienda + pagos + administración (rama `productos`)

## Qué se encontró (inspección)
- La rama `productos` contiene a `pagos` y suma el catálogo real (`DATA/`). **No se modificó `pagos`.**
- **Defecto raíz:** los archivos de pagos estaban subidos "planos" en la raíz. Los adaptadores de 2 líneas
  (`crear-pedido.js`, `webhook-wompi.js`, `seguimiento.js`, `admin-pedidos.js`) pisaron a la lógica real y faltaban
  `lib/`, `api/`, `netlify/functions/` y `supabase/`. Resultado: ninguna función de pago podía ejecutarse.
  Corregido moviendo cada archivo a su carpeta (los movimientos conservan el historial) y restaurando la lógica en `lib/`.
- El catálogo vivía en 3 sitios: `DATA/catalogo_tienda.js`, `DEMO` dentro de `index.html` y `localStorage` del `admin.html`
  antiguo (solo existe en el navegador de quien lo usa). Los precios que se cobraban salían de la tabla `productos` de Supabase.

## Fuente única de verdad
Supabase: `productos` (catálogo), `ajustes` (tarifa de envío `envio`, contenido `contenido`), `pedidos`, `eventos`.
La tienda lee `/api/catalogo`; si el servidor no responde, cae al catálogo estático de `DATA/` (solo para mostrar: el servidor
siempre recalcula precios, stock y envío al crear el pedido).

## Qué se agregó
| Pieza | Archivo |
|---|---|
| Envío fijo $17.500 (en `ajustes`, sumado en servidor, guardado por pedido: `subtotal_centavos`, `envio_centavos`) | `lib/crear-pedido.js`, `supabase/schema.sql` |
| Catálogo público | `lib/catalogo.js` → `/api/catalogo` |
| Centro de control (productos, envío, textos/secciones/colecciones, pedidos y despacho, registro) | `admin-tienda.html/.js`, `lib/admin-tienda.js` → `/api/admin-tienda` |
| Autorización de servidor (Bearer `ADMIN_TOKEN`, comparación en tiempo constante) | `lib/auth.js` |
| Despacho: preparado, transportadora, guía, incidencia, nota | `lib/admin-pedidos.js` |
| Anti-duplicados: clave de idempotencia + índice único | `pago-online.js`, `crear-pedido`, `schema.sql` |
| Registro de eventos reales | tabla `eventos` |
| Tienda: envío visible, catálogo/contenido del servidor | `tienda-api.js`, `index.html` (10 cambios puntuales) |

No se tocaron: firma de integridad, verificación del webhook, referencias, secretos ni `aprobar_pedido`.
Los montos del webhook siguen validándose contra `monto_centavos`, que ahora ya incluye el envío.

## Cómo activarlo (en este orden)
1. Supabase → SQL Editor: ejecutar `supabase/schema.sql` (idempotente; no borra pedidos) y luego, una sola vez,
   `supabase/productos-catalogo.sql` (55 productos; `on conflict do nothing`). Revisar precios e inventario en el panel.
2. Variables de entorno: **ninguna nueva** (`SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `WOMPI_*`, `SITE_URL`, `ADMIN_TOKEN`).
3. Abrir `/admin-tienda.html` con la clave `ADMIN_TOKEN`.

## Pruebas (qué es automático, qué simulado, qué no se hizo)
- `npm test` — 102 pruebas automáticas con PostgreSQL 16 real y el esquema real; Supabase y Wompi simulados por `fetch`.
- `npm run test:front` — 17 pruebas en Chromium (checkout, gracias, panel de pedidos), API simulada.
- `npm run test:tienda` — 13 pruebas en Chromium de punta a punta: `index.html` real + `admin-tienda.html` + funciones reales + PostgreSQL.
- **No verificado con servicios reales:** Supabase en la nube, Netlify desplegado y Wompi (pagos y webhooks reales). Sin despliegues, sin pagos reales.

## Límites conocidos
- Imágenes: se guardan como URL (`https://…` o `assets/…`). No hay almacenamiento de archivos subidos.
- Despacho manual: las guías y transportadoras las escribe el administrador; no hay consulta automática a transportadoras.
- `admin.html` (administrador antiguo, solo `localStorage`) se deja intacto pero **ya no gobierna el catálogo** de la tienda.
- `panel-pedidos.html` sigue funcionando; el centro de control incluye la misma información (más envío y despacho).
- Los inventarios del archivo `DATA/` (p. ej. 1 unidad por talla) se cargan tal cual: confírmalos antes de publicar.
