# MF Colombia · flujo de pagos (Wompi + Supabase)

Cliente paga en `checkout.wompi.co` → Wompi avisa a `/api/webhook-wompi` → el pedido se aprueba y se descuenta el stock → la clienta ve su pedido en `gracias.html`.

```
api/                    funciones para Vercel (adaptadores de 2 líneas)
netlify/functions/      las mismas funciones para Netlify
lib/                    la lógica (una sola copia)
supabase/schema.sql     tablas, permisos y función de aprobación (se ejecuta en Supabase)
supabase/productos-ejemplo.sql   plantilla para cargar el catálogo
pago-online.js          botón "Pagar" en la tienda (se agrega a index.html)
gracias.html / .js      página de regreso de Wompi y seguimiento
panel-pedidos.html / .js   panel para guía y estado de envío
scripts/verificar-despliegue.js   comprobación del sitio ya publicado
test/                   85 pruebas
.env.example            nombres de las variables de entorno (sin valores)
```

Guía completa: `PASOS.md`. Auditoría: `AUDITORIA.md`.
Pruebas locales: `TEST_DATABASE_URL=postgresql://… npm test` (necesita un PostgreSQL vacío) y `NODE_PATH=$(npm root -g) npm run test:front` (necesita Playwright).
