# Copia de la tienda en Shopify

La tienda principal sigue en Netlify. Esta carpeta arma una copia idéntica que vive dentro de Shopify, por si Netlify falla.

- `catalogo.liquid`: arma el catálogo con los productos, precios, fotos y tallas de Shopify (mismo formato que `/api/catalogo`).
- `construir.py`: toma `index.html` y sus estilos y scripts, y genera `tema/` (layout, plantilla de inicio, snippet y assets) listo para subir al tema de Shopify.
- `tema/`: lo generado. No se edita a mano: se cambia la tienda y se vuelve a correr `python3 shopify/construir.py`.

Lo que necesita servidor (banners y vitrina del panel, descuentos, comunidad, outfits) se le pide a la tienda de Netlify (`https://tienda.mfcol.com`). Para que eso funcione desde Shopify, en Netlify hay que agregar el dominio de Shopify a la variable `ALLOWED_ORIGIN`.
