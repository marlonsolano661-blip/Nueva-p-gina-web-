#!/usr/bin/env python3
"""Arma la copia de la tienda para Shopify (carpeta shopify/tema) a partir de index.html.

La copia se ve igual que la tienda de Netlify porque usa el mismo HTML, CSS y JS. Cambia solo:
- el catálogo sale de Shopify (snippets/mf-catalogo.liquid) en lugar de DATA/catalogo_tienda.js;
- el pago va al checkout de la misma tienda Shopify (shopify-checkout.js);
- las páginas legales apuntan a /pages/... de Shopify;
- lo que necesita servidor (contenido, descuentos, outfits) se pide a la tienda de Netlify.

Uso:  python3 shopify/construir.py      (no toca index.html ni nada de la tienda de Netlify)
"""
import os
import re
import shutil

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SALIDA = os.path.join(RAIZ, 'shopify', 'tema')
NETLIFY = 'https://tienda.mfcol.com'

PAGINAS = {
    'terminos.html': '/pages/terminos',
    'privacidad.html': '/pages/privacidad',
    'cambios-y-devoluciones.html': '/pages/cambios-y-devoluciones',
    'envios.html': '/pages/envios',
    'preguntas-frecuentes.html': '/pages/preguntas-frecuentes',
    'nosotros.html': '/pages/nosotros',
}
# Se quitan de la copia: el catálogo y las variantes los arma Shopify con Liquid
QUITAR = {'DATA/catalogo_tienda.js', 'DATA/shopify-variantes.js'}
# Scripts que la tienda carga sola después (vitrina, botón de outfits): se suben como assets y se cargan desde su URL de Shopify
DINAMICOS = ['DATA/recortes.js', 'vitrina.js', 'outfits-boton.js']


def nombre_asset(ruta):
    return ruta.replace('/', '-')


def leer(ruta):
    with open(os.path.join(RAIZ, ruta), encoding='utf-8') as f:
        return f.read()


def escribir(ruta, texto):
    destino = os.path.join(SALIDA, ruta)
    os.makedirs(os.path.dirname(destino), exist_ok=True)
    with open(destino, 'w', encoding='utf-8') as f:
        f.write(texto)


def main():
    if os.path.isdir(SALIDA):
        shutil.rmtree(SALIDA)
    html = leer('index.html')
    if '{{' in html or '{%' in html:
        raise SystemExit('index.html tiene {{ o {%: habría que envolverlo en {% raw %}')

    assets = []

    def cambiar(m):
        attr, ruta = m.group(1), m.group(2)
        if ruta in QUITAR:
            return m.group(0)
        assets.append(ruta)
        return '%s="{{ %r | asset_url }}"' % (attr, nombre_asset(ruta))

    html = re.sub(r'(src|href)="((?:DATA/)?[\w\-]+\.(?:js|css))"', cambiar, html)
    html = html.replace('<script src="DATA/catalogo_tienda.js"></script>', "{% render 'mf-catalogo' %}")
    # Sin parpadeo del diseño viejo: la página se muestra cuando ya está dibujada con lo actual (no a los 2,5 s fijos).
    # En un celular lento los scripts tardan más de 2,5 s y se alcanzaba a ver el inicio antiguo. Queda un respaldo de 12 s.
    viejo = "setTimeout(function(){document.documentElement.classList.remove('mf-espera')},2500)"
    if viejo not in html:
        raise SystemExit('index.html cambió: no encuentro el tiempo de espera de la portada')
    html = html.replace(viejo, viejo.replace('2500', '12000'))
    html = html.replace('<script src="DATA/shopify-variantes.js"></script>', '')
    for viejo, nuevo in PAGINAS.items():
        html = html.replace('href="%s"' % viejo, 'href="%s"' % nuevo)

    mapa = ','.join("%r:'{{ %r | asset_url }}'" % (r, nombre_asset(r)) for r in DINAMICOS)
    cabeza = ('<head>{{ content_for_header }}'
              '<script>window.MF_API_BASE=%r;window.MF_SHOPIFY={tienda:location.host,activo:true};window.MF_ASSETS={%s};</script>' % (NETLIFY, mapa))
    assets.extend(DINAMICOS)
    assert html.count('<head>') == 1 and html.count('</body>') == 1
    inicio, resto = html.split('<head>', 1)
    medio, final = resto.split('</body>', 1)

    # Shopify no acepta archivos Liquid de más de 256 KB: el contenido de la
    # página se reparte en varios snippets y el layout solo los une.
    partes, actual = [], ''
    for linea in medio.splitlines(keepends=True):
        if actual and len((actual + linea).encode('utf-8')) > 200000:
            partes.append(actual)
            actual = ''
        actual += linea
    partes.append(actual)
    for i, parte in enumerate(partes, 1):
        escribir('snippets/mf-pagina-%d.liquid' % i, parte)
    renders = ''.join("{%% render 'mf-pagina-%d' %%}\n" % i for i in range(1, len(partes) + 1))

    escribir('layout/mf.liquid', inicio + cabeza + '\n' + renders + '{{ content_for_layout }}</body>' + final)
    # Producto, colección, bolsa, búsqueda y 404 también abren dentro del diseño de la tienda (no con el tema base):
    # la sección mf-ruta deja la dirección como la entiende la tienda (/?producto=… o la colección) y la abre.
    escribir('sections/mf-ruta.liquid', leer('shopify/ruta.liquid'))
    for plantilla in ('product', 'collection', 'list-collections', 'cart', 'search', '404'):
        escribir('templates/%s.json' % plantilla,
                 '{"layout":"mf","sections":{"mf":{"type":"mf-ruta","settings":{}}},"order":["mf"]}\n')
    escribir('sections/mf-vacio.liquid',
             '{% comment %}La página la dibuja layout/mf.liquid{% endcomment %}\n'
             '{% schema %}{"name":"MF Netlify","settings":[]}{% endschema %}\n')
    escribir('templates/index.json',
             '{"layout":"mf","sections":{"mf":{"type":"mf-vacio","settings":{}}},"order":["mf"]}\n')
    escribir('snippets/mf-catalogo.liquid', leer('shopify/catalogo.liquid'))

    for ruta in sorted(set(assets)):
        texto = leer(ruta)
        # scripts que se cargan solos: desde su URL en Shopify; fotos de assets/: desde la tienda de Netlify
        texto = texto.replace("s.src = src;", "s.src = (window.MF_ASSETS && window.MF_ASSETS[src]) || src;")
        texto = texto.replace("s.src = 'outfits-boton.js';", "s.src = (window.MF_ASSETS && window.MF_ASSETS['outfits-boton.js']) || 'outfits-boton.js';")
        texto = texto.replace("'assets/", "'%s/assets/" % NETLIFY).replace('"assets/', '"%s/assets/' % NETLIFY)
        if ruta == 'meta-pixel.js':  # en la copia de Shopify el píxel también se activa en el dominio de Shopify
            texto = texto.replace("var DOMINIOS = ['tienda.mfcol.com', 'mfcol.com', 'www.mfcol.com'];",
                                  "var DOMINIOS = ['tienda.mfcol.com', 'mfcol.com', 'www.mfcol.com', 'npckie-04.myshopify.com'];")
        if ruta == 'vitrina.js':  # la vitrina se arma cuando ya están el catálogo y la lista del panel (si no, sale vacía)
            texto = texto.replace("    if (!LISTA) {\n", "    if (!LISTA) {\n      if (!window.MF_API_OK) return;\n", 1)
        texto = texto.replace('"vestidos.html', '"/pages/vestidos')
        texto = texto.replace('"outfits.html', '"%s/outfits.html' % NETLIFY).replace("'outfits.html", "'%s/outfits.html" % NETLIFY)
        for viejo, nuevo in PAGINAS.items():
            texto = texto.replace('"%s"' % viejo, '"%s"' % nuevo).replace("'%s'" % viejo, "'%s'" % nuevo)
        escribir('assets/' + nombre_asset(ruta), texto)

    vestidos()

    print('Listo:', len(set(assets)), 'archivos de estilo y código en', os.path.relpath(SALIDA, RAIZ))



def vestidos():
    """Página Vestidos (el perchero) dentro de Shopify: /pages/vestidos con su propio layout.
    Fotos y videos van como assets (vestidos-<archivo>); el catálogo sale de Shopify, la bolsa es la misma."""
    ruta_dir = os.path.join(RAIZ, 'vestidos')
    if not os.path.isdir(ruta_dir):
        return
    base = "{%- assign vb = 'vestidos-looks.js' | asset_url | split: 'vestidos-looks.js' | first -%}"
    looks = leer('vestidos/looks.js').replace("'vestidos/", "'{{ vb }}vestidos-").replace('"vestidos/', '"{{ vb }}vestidos-')
    escribir('snippets/mf-vestidos-looks.liquid', base + '<script>' + looks + '</script>')
    html = leer('vestidos.html')
    if '{{' in html or '{%' in html:
        raise SystemExit('vestidos.html tiene {{ o {%')
    cambios = [
        ('<script src="vestidos/looks.js"></script>', "{% render 'mf-catalogo' %}{% render 'mf-vestidos-looks' %}"),
        ('fetch(API+"/api/catalogo").then(function(r){return r.ok?r.json():null})',
         'Promise.resolve({productos:window.MF_SHOPIFY_CATALOGO||[]})'),
        ('fetch(API+"/api/vestidos").then(function(r){return r.ok?r.json():null})', 'Promise.resolve(null)'),
        ('href="index.html"', 'href="/"'),
    ]
    for viejo, nuevo in cambios:
        if viejo not in html:
            raise SystemExit('vestidos.html cambió, no encuentro: ' + viejo[:60])
        html = html.replace(viejo, nuevo)
    html = html.replace('href="assets/brand/', 'href="%s/assets/brand/' % NETLIFY)
    html = html.replace('<head>', '<head>{{ content_for_header }}', 1).replace('</body>', '{{ content_for_layout }}</body>', 1)
    escribir('layout/mf-vestidos.liquid', html)
    escribir('templates/page.vestidos.json',
             '{"layout":"mf-vestidos","sections":{"mf":{"type":"mf-vacio","settings":{}}},"order":["mf"]}\n')
    for nombre in sorted(os.listdir(ruta_dir)):
        if nombre == 'looks.js':
            escribir('assets/vestidos-looks.js', '/* referencia para la URL de los assets de Vestidos */\n')
            continue
        destino = os.path.join(SALIDA, 'assets', 'vestidos-' + nombre)
        os.makedirs(os.path.dirname(destino), exist_ok=True)
        shutil.copyfile(os.path.join(ruta_dir, nombre), destino)

if __name__ == '__main__':
    main()
