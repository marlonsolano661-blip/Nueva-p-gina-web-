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
    html = html.replace('<script src="DATA/shopify-variantes.js"></script>', '')
    for viejo, nuevo in PAGINAS.items():
        html = html.replace('href="%s"' % viejo, 'href="%s"' % nuevo)

    cabeza = ('<head>{{ content_for_header }}'
              '<script>window.MF_API_BASE=%r;window.MF_SHOPIFY={tienda:location.host,activo:true};</script>' % NETLIFY)
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
    escribir('sections/mf-vacio.liquid',
             '{% comment %}La página la dibuja layout/mf.liquid{% endcomment %}\n'
             '{% schema %}{"name":"MF Netlify","settings":[]}{% endschema %}\n')
    escribir('templates/index.json',
             '{"layout":"mf","sections":{"mf":{"type":"mf-vacio","settings":{}}},"order":["mf"]}\n')
    escribir('snippets/mf-catalogo.liquid', leer('shopify/catalogo.liquid'))

    for ruta in sorted(set(assets)):
        texto = leer(ruta)
        texto = texto.replace('"outfits.html', '"%s/outfits.html' % NETLIFY).replace("'outfits.html", "'%s/outfits.html" % NETLIFY)
        for viejo, nuevo in PAGINAS.items():
            texto = texto.replace('"%s"' % viejo, '"%s"' % nuevo).replace("'%s'" % viejo, "'%s'" % nuevo)
        escribir('assets/' + nombre_asset(ruta), texto)

    print('Listo:', len(set(assets)), 'archivos de estilo y código en', os.path.relpath(SALIDA, RAIZ))


if __name__ == '__main__':
    main()
