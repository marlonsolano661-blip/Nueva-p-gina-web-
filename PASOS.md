# Pasos para dejar el flujo funcionando (GitHub + Vercel + Supabase + Wompi)

Haz los pasos **en orden y primero con llaves de PRUEBA de Wompi**. Solo al final se pasa a producción.
Nada de esto toca tu `main` ni tus tiendas actuales hasta que tú lo decidas.

## Antes de empezar: dónde corre el servidor
GitHub Pages **no sirve**: solo publica archivos estáticos y no puede recibir el webhook de Wompi. Las funciones corren en un hosting:
- **Vercel (recomendado aquí):** funciona sin configuración. Ojo: según sus términos, el plan gratuito *Hobby* es para uso **no comercial**; una tienda con ventas normalmente requiere el plan de pago. Verifícalo en vercel.com/pricing antes de salir a producción.
- **Netlify:** el proyecto ya incluye `netlify.toml` y `netlify/functions/`. Tus proyectos están pausados hasta el 1 de noviembre; después puedes usar esta opción.
El código es el mismo en ambos; solo cambia dónde pegas las variables.

## 1. Supabase (base de datos)
1. Supabase → tu proyecto → **SQL Editor → New query**. Pega todo `supabase/schema.sql` → **Run**. (Se puede ejecutar más de una vez sin perder datos, incluso sobre tu esquema anterior.)
2. Carga tu catálogo: abre `supabase/productos-ejemplo.sql`, reemplaza los ejemplos por tus modelos y ejecútalo. Reglas: `id` **igual** al que usa el carrito de tu `index.html`; `precio` en pesos enteros sin puntos; `stock` como `{"36":3,"37":2}`.
   Si me envías tu Excel (`marlon-footwear-productos.xlsx`) te genero este archivo con tus 32 productos.
3. **Project Settings → API**: copia la *Project URL* y la llave **secreta** (`service_role` o `sb_secret_…`). Esa llave solo va en el servidor, nunca en GitHub ni en el navegador.

## 2. Wompi (modo prueba)
En el panel de Wompi → **Desarrolladores**: copia la llave pública de prueba (`pub_test_…`), el *secreto de integridad* y el *secreto de eventos* (de prueba).

## 3. Subir el código a GitHub (sin tocar `main`)
1. En tu repo → botón **main ▾** → escribe `pagos` → **Create branch**.
2. **Add file → Upload files** y arrastra el contenido de la carpeta `mf-pagos` (las carpetas `api`, `lib`, `netlify`, `supabase`, `scripts`, `test` y los archivos sueltos, incluido `.gitignore`). GitHub conserva las carpetas al arrastrarlas.
   **No subas** ningún archivo `.env` con valores reales: solo `.env.example`.
3. **Commit changes** → "Commit directly to the `pagos` branch".
4. Tus archivos actuales `index.html`, `admin.html` y `seguridad.js` no se tocan todavía.

## 4. Conectar Vercel
1. vercel.com → **Add New → Project** → importa `marlonsolano661-blip/Nueva-p-gina-web-`.
2. **Production Branch:** déjala en `main`. La rama `pagos` generará una **vista previa** con su propia URL (la que usarás para probar).
3. *Framework Preset:* **Other**. No pongas comando de build.
4. **Environment Variables** (marca *Production* y *Preview*):

| Variable | Valor |
|---|---|
| `SUPABASE_URL` | Project URL de Supabase |
| `SUPABASE_SERVICE_KEY` | llave secreta de Supabase |
| `WOMPI_PUBLIC_KEY` | `pub_test_…` |
| `WOMPI_INTEGRITY_SECRET` | secreto de integridad de prueba |
| `WOMPI_EVENTS_SECRET` | secreto de eventos de prueba |
| `SITE_URL` | la URL de la vista previa, sin `/` final (luego será `https://tienda.mfcol.com`) |
| `ADMIN_TOKEN` | una clave larga inventada (mínimo 24 caracteres; usa un generador de contraseñas) |

5. **Deploy**. Cada vez que cambies una variable, hay que redesplegar.

## 5. Conectar la tienda
En `index.html` (en la rama `pagos`), justo antes de `</body>`, agrega:
`<script src="pago-online.js"></script>`
Tu carrito debe exponer `CART` (con `id`, `talla`, `q`), `FRM` (datos de entrega) y el botón con `data-n="topay"`, como ya hace tu página actual. Si hay algo distinto, dímelo y lo ajusto.

## 6. Avisarle a Wompi dónde enviar los pagos
Wompi → Desarrolladores → **URL de eventos** (modo prueba): `https://TU-URL/api/webhook-wompi`

## 7. Verificación automática del sitio publicado
En tu computador con Node.js:
```
node scripts/verificar-despliegue.js https://TU-URL ID_DE_UN_PRODUCTO 36 TU_ADMIN_TOKEN
```
Debe terminar en "Todo en orden". Crea un pedido de prueba sin pagar (puedes borrarlo en Supabase → Table Editor → `pedidos`).

## 8. Compra de prueba (modo prueba)
Haz una compra desde la tienda con los medios de prueba de Wompi (están en docs.wompi.co, sección de ambiente de pruebas). Comprueba:
- [ ] Wompi te lleva a `gracias.html` y dice "¡Pago recibido!" en pocos segundos.
- [ ] En Supabase → `pedidos`: `estado_pago = APPROVED`, `wompi_tx` con valor, y `alerta` vacía.
- [ ] En `productos`, el stock de esa talla bajó.
- [ ] En `panel-pedidos.html` aparece el pedido; guarda una guía y recarga `gracias.html?t=…` para ver "En camino".
- [ ] Repite con un pago **rechazado**: la página dice "El pago no fue aprobado" y el stock no cambia.
- [ ] Repite el evento desde el panel de Wompi (reenviar): el stock **no** vuelve a bajar.

## 9. Pasar a producción
1. Fusiona la rama: en GitHub, **Pull requests → New** (`pagos` → `main`) → revisa → **Merge**. Haz esto con la tienda sin tráfico.
2. En Vercel cambia las 3 variables de Wompi por las de **producción** (`pub_prod_…` y sus dos secretos) y `SITE_URL` por `https://tienda.mfcol.com`; conecta el dominio; redespliega.
3. En Wompi, registra la **URL de eventos de producción**: `https://tienda.mfcol.com/api/webhook-wompi`.
4. Repite `verificar-despliegue.js` con el dominio real y haz **una compra real pequeña**; después revisa en Wompi que se liquide y anúlala si quieres.
5. Revisa cada semana pedidos con `alerta` (en el panel aparecen resaltados): stock insuficiente, pagos anulados, montos distintos.

## Seguridad: no olvides
- Tu repo es **público**: nada de llaves, contraseñas ni claves dentro. `admin.html` y `seguridad.js` con contraseñas escritas en JavaScript **no protegen nada**; usa `panel-pedidos.html` (la clave vive en `ADMIN_TOKEN`, en el servidor) y retira el panel viejo del repo público.
- Si alguna llave se llegó a publicar, regenérala en Supabase/Wompi.

## Si algo falla
| Síntoma | Causa probable |
|---|---|
| `crear-pedido` responde 500 | Falta una variable de entorno (los logs de Vercel dicen cuál) o no redesplegaste tras agregarla |
| "Producto inválido" | El `id` del carrito no existe en la tabla `productos` o está `visible = false` |
| "Sin stock" siempre | El `stock` de esa talla no está cargado (debe ser un JSON con la talla como texto) |
| Pago aprobado pero el pedido sigue PENDING | URL de eventos mal puesta o secretos de eventos equivocados; mira Wompi → Eventos y los logs de `/api/webhook-wompi` |
| El webhook responde 401 | `WOMPI_EVENTS_SECRET` no corresponde al ambiente (prueba vs producción) |
| `gracias.html` queda "Estamos confirmando…" | El webhook no está llegando (ver fila anterior) |
| El carrito no se vacía tras pagar | Tu tienda guarda el carrito en otra clave: agrégala en `CLAVES_CARRITO` de `gracias.js` |
