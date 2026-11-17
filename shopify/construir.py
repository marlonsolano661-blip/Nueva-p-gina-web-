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
        texto = texto.replace('"vestidos.html', '"/pages/mf-closet')
        texto = texto.replace('"/pages/mf-closet">Vestidos</button>', '"/pages/mf-closet">MF Clóset</button>')
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
    escribir('snippets/mf-vestidos-looks.liquid', base + '<script>' + looks + '</script>' + leer('shopify/vestidos-looks.liquid')
             + '<script>' + leer('shopify/vestidos-ajustes.js') + '</script>')
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
    # Perchero más real y más rápido (solo en la copia de Shopify): sin la barra gris, llegan más rápido
    # y se mecen como un gancho de verdad (más firme y se detiene pronto, casi sin "viento").
    ajustes = [
        ('t0:reduce?0:500+i*720', 't0:reduce?0:120+i*230'),
        ('(T-it.t0)/950', '(T-it.t0)/560'),
        ('it.om+=(-40*it.th-2*it.om-a*.006+breeze)*dt;', 'it.om+=(-60*it.th-4.5*it.om-a*.0045+breeze)*dt;'),
        ('Math.sin(now/900+i*1.7)*1.1', 'Math.sin(now/1300+i*1.7)*.3'),
        ('transition:transform 1.25s cubic-bezier(.5,0,.25,1)', 'transition:transform .7s cubic-bezier(.5,0,.25,1)'),
        ('transition:transform .8s cubic-bezier(.65,0,.2,1),opacity .5s', 'transition:transform .5s cubic-bezier(.65,0,.2,1),opacity .3s'),
        ('transition:filter .9s', 'transition:filter .5s'),
        # Video de la modelo más grande: puede crecer un 16 % sobre el espacio libre (los bordes ya se difuminan)
        ('var ph=Math.min(h,w*F.h/F.w),pw=ph*F.w/F.h,el=$("photo");', 'var ph=Math.min(h*1.16,w*F.h/F.w),pw=ph*F.w/F.h,el=$("photo"),tp=Math.max(0,(h-ph)/2);'),
        ('top:"+(h-ph)/2+"px;width:"+pw', 'top:"+tp+"px;width:"+pw'),
        ('PH={x:(w-pw)/2,y:(h-ph)/2,k:pw/F.w};', 'PH={x:(w-pw)/2,y:tp,k:pw/F.w};'),
        # Paso a la modelo: el vestido vuela ya sin gancho y se funde con la modelo mientras arranca el video
        # "Ver look completo": en vez del vestido volando con el gancho, un flash de cámara fuerte
        # ilumina toda la pantalla y de la luz sale la modelo con el video ya en marcha.
        ('piece.classList.add("fly","dress");', 'if(window.mfFlash)mfFlash();piece.style.transition="none";piece.style.opacity=0;'),
        ('},180*D);', '},10*D);'),
        ('},650*D);', '},90*D);'),
        ('},1350*D);', '},380*D);'),
        ('},1500*D);', '},420*D);'),
        ('transition:opacity .7s', 'transition:opacity .4s'),
    ]
    for viejo, nuevo in ajustes:
        if viejo not in html:
            raise SystemExit('vestidos.html cambió, no encuentro: ' + viejo)
        html = html.replace(viejo, nuevo)
    html = html.replace('</style>', '.rail{display:none}\n.creditos,#creditos{position:relative;z-index:7}\n'
                        '.piece.dress .face img{clip-path:inset(30% 0 0 0);transition:none}\n'
                        '.piece.fly.dress{opacity:0;transition:transform .5s cubic-bezier(.65,0,.2,1),opacity .28s ease-in .3s}\n'
                        '.mf-flash{position:fixed;inset:0;z-index:9999;pointer-events:none;'
                        'background:radial-gradient(circle at 50% 42%,#fff 0,#fff 55%,#fffaf0 80%,#f3efe6 100%);'
                        'animation:mfFlash 1.25s cubic-bezier(.2,.7,.3,1) forwards}\n'
                        '@keyframes mfFlash{0%{opacity:0}3%{opacity:1}28%{opacity:1}100%{opacity:0}}\n'
                        '#photo{transition:filter 1.1s cubic-bezier(.2,.7,.3,1)}#photo.mf-sobre{filter:brightness(2.4) saturate(.5) contrast(.85);transition:none}\n'
                        '</style><script>window.mfFlash=function(){var f=document.createElement("div");f.className="mf-flash";'
                        'document.body.appendChild(f);var ph=document.getElementById("photo");'
                        'if(ph){ph.classList.add("mf-sobre");setTimeout(function(){ph.classList.remove("mf-sobre")},330)}'
                        'setTimeout(function(){f.remove()},1350)};</script>', 1)
    # Nombre de la sección en Shopify: MF Clóset
    for viejo, nuevo in [('<title>Vestidos · Marlon Footwear</title>', '<title>MF Clóset · Marlon Footwear</title>'),
                         ('content="Vestidos Marlon Footwear:', 'content="MF Clóset de Marlon Footwear:'),
                         ('content="Vestidos · Marlon Footwear"', 'content="MF Clóset · Marlon Footwear"'),
                         ('<h1 class="h1"><span>Vestidos</span></h1>', '<p class="sub" style="letter-spacing:.32em;font-size:.7rem;margin-bottom:.4rem">MF CLÓSET</p><h1 class="h1"><span>Colección Vestidos Glam</span></h1>')]:
        if viejo not in html:
            raise SystemExit('vestidos.html cambió, no encuentro: ' + viejo)
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
        nuevo = os.path.join(RAIZ, 'shopify', 'vestidos-nuevos', nombre)  # videos rehechos (fondo blanco) solo para Shopify
        shutil.copyfile(nuevo if os.path.exists(nuevo) else os.path.join(ruta_dir, nombre), destino)

if __name__ == '__main__':
    main()
