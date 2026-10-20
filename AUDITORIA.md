# Auditoría del flujo de pagos · MF Colombia

Base auditada: `crear-pedido.js`, `webhook-wompi.js`, `seguimiento.js`, `pago-online.js` y `supabase.sql` que enviaste.
Los hallazgos de la versión original salen de **leer el código** (no la ejecuté). Todo lo corregido sí está probado: ver "Pruebas".

## Lo que ya estaba bien (se conserva)
- El servidor recalcula precios desde la base de datos; el navegador no decide cuánto se paga.
- Firma de integridad de Wompi y verificación de la firma del webhook en tiempo constante.
- Aprobación idempotente (un evento repetido no descuenta stock dos veces).
- Tablas cerradas con RLS; seguimiento por token privado sin datos personales.

## Hallazgos y qué se hizo

| # | Gravedad | Hallazgo en la versión original | Corrección | Prueba |
|---|---|---|---|---|
| 1 | Alta | `aprobar_pedido` se podía ejecutar con la llave pública (anon) por RPC: en Supabase las funciones nuevas quedan abiertas por defecto. Quien conozca la URL del proyecto, una referencia y su monto podría marcar un pedido como pagado sin pagar. | `revoke execute … from public, anon, authenticated`; solo `service_role`. | `anon y authenticated NO pueden ejecutar aprobar_pedido` |
| 2 | Alta | Si el monto pagado no coincidía, la función devolvía `false` y el pedido quedaba PENDING **sin ningún aviso**, aunque la clienta hubiera pagado. | La función devuelve `APROBADO / YA_APROBADO / NO_ENCONTRADO / MONTO_DISTINTO`, deja `alerta` en el pedido y el webhook lo registra en el log. | 3 pruebas de monto y referencia |
| 3 | Media | El webhook confiaba solo en el contenido del evento firmado. | Antes de aprobar consulta la API de Wompi y exige estado `APPROVED`, misma referencia, mismo monto y COP. Si Wompi aún no lo confirma, responde 500 para que reintente. | 8 pruebas de verificación |
| 4 | Media | Filtro `id=in.(…)` armado con `encodeURIComponent`, que no codifica paréntesis: un `id` manipulado podía alterar el filtro. | Los ids deben cumplir `^[\w.-]{1,64}$` y se envían entre comillas. | 15 carritos maliciosos rechazados |
| 5 | Media | Posible fallo con llaves nuevas de Supabase (`sb_secret_…`): no son JWT y la versión original las enviaba también en `Authorization: Bearer`. | Solo se envían en `apikey`; el `Bearer` solo si la llave es un JWT. *(Según la documentación de Supabase; no pude comprobarlo contra tu proyecto: lo cubre la verificación del paso 7.)* | — |
| 6 | Media | Casilla de WhatsApp **premarcada** (`WA_OK = true`). El permiso debe darlo la clienta de forma expresa (Ley 1581 de 2012, habeas data). No soy abogado: confirma con quien te asesore. | Empieza sin marcar; el servidor solo guarda `true` si llega exactamente `true`. | 2 pruebas |
| 7 | Media | Sin freno contra abuso: cualquiera podía llenar la tabla de pedidos PENDING. | Máximo 8 pedidos por IP cada 10 minutos (429). Es un freno básico, **no** un captcha. | `frena a una misma IP…` |
| 8 | Media | Si se vendía la última talla dos veces, `greatest(0, …)` ocultaba el problema. | El pago se registra igual, el stock queda en 0 y el pedido queda con `alerta = STOCK_INSUFICIENTE`. Filas bloqueadas (`for update`) para que no haya carreras. | 4 pruebas, incluida concurrencia |
| 9 | Media | Si Wompi anulaba un pago ya aprobado, nadie se enteraba. | El pedido sigue aprobado pero queda con alerta `ANULADO_DESPUES_DE_APROBAR`. El reembolso/stock sigue siendo manual. | 2 pruebas |
| 10 | Baja | Teléfono validado con 7–15 dígitos y recortado a 10 al enviarlo a Wompi. | Celular colombiano de 10 dígitos (acepta +57, espacios, guiones); se guarda normalizado. | 2 pruebas |
| 11 | Baja | `pago-online.js` declaraba variables globales (`WA_OK`, `cookie`, `ck`): si `index.html` usa un nombre igual, el script entero falla. | Todo dentro de una función. | prueba en Chromium |
| 12 | Baja | Sin protección contra doble clic ni tiempo máximo; redirigía a cualquier URL que devolviera la API. | Una sola solicitud en vuelo, corte a 20 s, y solo redirige a `https://checkout.wompi.co/`. | 4 pruebas en Chromium |
| 13 | Faltante | `gracias.html` no existía: Wompi devuelve ahí a la clienta tras pagar. | Creada, con confirmación en vivo, seguimiento del envío y limpieza del carrito solo si el pago fue aprobado. | 6 pruebas en Chromium |
| 14 | Faltante | El panel `admin.html` no tenía servidor: no había forma de guardar guía ni estado de envío, y una clave en JavaScript de un repo público no protege nada. | `api/admin-pedidos` con `ADMIN_TOKEN` (comparación en tiempo constante, mínimo 24 caracteres) y `panel-pedidos.html`. | 8 pruebas (5 servidor + 3 Chromium) |
| 15 | Baja | Errores internos podían mostrar detalles; sin cabeceras de seguridad. | Mensajes genéricos al cliente (detalle solo en logs), `no-store`, `nosniff`, `noindex` en páginas internas. | pruebas de 500 |

## Pruebas (todas pasan)

| Capa | Pruebas | Cómo |
|---|---|---|
| Servidor: crear pedido, webhook, seguimiento, panel | 63 | Código real contra **PostgreSQL 16 real** con tu `schema.sql` y los roles de Supabase (anon, authenticated, service_role con BYPASSRLS) |
| Adaptadores Vercel / Netlify | 5 | Node |
| Frontend (botón de pago, gracias, panel) | 17 | **Chromium real** (Playwright) |
| Ruta completa por HTTP | 11 comprobaciones | `scripts/verificar-despliegue.js` contra un servidor local |

Incluyen: firmas falsas o alteradas, eventos repetidos y simultáneos, montos distintos, Wompi caído, stock agotado, inyección en ids, migración desde tu esquema anterior, permisos de anon, XSS en datos del servidor.
Las 11 comprobaciones HTTP pasaron salvo `redirect-url`, que en mi servidor local apunta a otro dominio por diseño (es justo lo que detecta si `SITE_URL` está mal).

## Lo que NO pude probar (importante)
1. **Wompi y Supabase reales.** Mi entorno no tiene internet hacia ellos. Los simulé; la base de datos sí fue PostgreSQL real, pero la capa de Supabase (PostgREST) la imité. Por eso **no puedo garantizar "100 % en producción" sin que corras antes el paso 7 y una compra de prueba en sandbox (paso 8)**. Con eso se cierra la brecha.
2. **Tu `index.html` real.** No lo vi. El frontend lo probé con una tienda mínima que tiene la misma interfaz (`[data-n="topay"]`, `FRM`, `CART`). Los `id` de producto de tu carrito deben ser exactamente los de la tabla `productos`.
3. **Clave del carrito en `localStorage`.** `gracias.js` limpia las claves `cart, carrito, mf_cart, mf-cart, mf_carrito`. Si tu tienda usa otra, agrégala en `gracias.js` (línea `CLAVES_CARRITO`).

## Fuera de alcance (no incluido)
- WhatsApp de "pago confirmado" y evento Purchase de Meta CAPI: siguen pendientes, y el error 190 de Meta debe resolverse antes.
- Reembolsos automáticos y reserva de stock con vencimiento.
- Limpieza de pedidos abandonados (opcional, en Supabase):
  `delete from pedidos where estado_pago = 'PENDING' and creado_en < now() - interval '30 days';`
