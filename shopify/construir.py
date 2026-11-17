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
# La copia de Shopify no depende de Netlify: fotos en Archivos de Shopify y funciones propias en el navegador
AVATAR = 'https://cdn.shopify.com/s/files/1/1007/3476/3375/files/mf-avatar-negro-512.png?v=1794888780'
# Funciones que reemplazan al servidor de Netlify (se ponen en el <head> de los dos layouts):
#  - mfSuscribir(correo): guarda el correo como cliente suscrito de Shopify (formulario de clientes de la tienda)
#    y entrega el código de bienvenida configurado en Contenido → Metaobjetos → Inicio de la tienda.
#  - mfValidarCodigo(codigo): el código lo valida Shopify al pagar; aquí solo se reconoce el de bienvenida.
SIN_NETLIFY = (
    "window.MF_API_BASE='';"
    "function mfResp(d){return Promise.resolve({ok:true,json:function(){return Promise.resolve(d)}})}"
    "function mfPromo(){var p=(window.MF_SHOPIFY_CONTENIDO||{}).promo||{};return p}"
    "window.mfSuscribir=function(m){var f=new FormData();f.append('form_type','customer');f.append('utf8','\u2713');"
    "f.append('contact[email]',m);f.append('contact[tags]','newsletter,bienvenida');f.append('contact[accepts_marketing]','true');"
    "var p=mfPromo(),d=p.correo&&p.codigo?{ok:true,codigo:p.codigo,pct:p.pct,enviado:false}:{ok:true};"
    "return fetch('/contact',{method:'POST',body:f,credentials:'same-origin'}).catch(function(){}).then(function(){return mfResp(d)})};"
    "window.mfValidarCodigo=function(c){var p=mfPromo();return mfResp({ok:true,codigo:c,pct:p.codigo&&String(p.codigo).toUpperCase()===c?p.pct:0})};"
)

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


MFP_FRANJA = """
/* Copia Shopify: el aviso de bienvenida usa el mismo fondo de la franja del inicio (foto difuminada + tono azul pizarra) */
html body .mfp{background:#5d6f82;color:#fff;isolation:isolate}
html body .mfp .mfp-bg{position:absolute;inset:0;z-index:-2;background:#5d6f82 center/cover no-repeat;filter:blur(18px) saturate(.9)}
html body .mfp::after{content:"";position:absolute;inset:0;z-index:-1;background:rgba(20,28,38,.38);pointer-events:none}
html body .mfp .mfp-ph{background:transparent}
html body .mfp .mfp-x,html body .mfp h2,html body .mfp .mfp-logo,html body .mfp .mfp-cod{color:#fff}
html body .mfp .mfp-ey{color:rgba(255,255,255,.82)}
html body .mfp p.mfp-tx{color:rgba(255,255,255,.88)}
html body .mfp p.mfp-n{color:rgba(255,255,255,.72)}
html body .mfp .mfp-no{color:#fff}
html body .mfp p.mfp-e{color:#ffd6d6}
html body .mfp .mfp-f{border-color:rgba(255,255,255,.9)}
html body .mfp .mfp-cb{border-color:rgba(255,255,255,.8)}
html body .mfp .mfp-cp{background:rgba(255,255,255,.16);color:#fff;border-left-color:rgba(255,255,255,.8)}
html body .mfp .mfp-go.mfp-full{background:#fff;color:#0a0a0a}
"""


FT_FRANJA = """
/* Copia Shopify: "Únete a la comunidad MF" con el fondo de la franja del inicio (foto difuminada + azul pizarra), de borde a borde */
html body .ft3-nlw{position:relative;isolation:isolate;overflow:hidden;max-width:none;border-bottom:0;background:#3e4c5c;
  padding-left:max(1.5rem,calc((100% - 1100px) / 2 + 1.5rem));padding-right:max(1.5rem,calc((100% - 1100px) / 2 + 1.5rem))}
html body .ft3-nlw::before{content:"";position:absolute;inset:0;z-index:-2;background:#5d6f82 var(--mf-tira-foto,none) center/cover no-repeat;filter:blur(18px) saturate(.9);transform:scale(1.15)}
html body .ft3-nlw::after{content:"";position:absolute;inset:0;z-index:-1;background:rgba(20,28,38,.38)}
html body .ft3-nlw .ft3-f input{border-color:rgba(255,255,255,.75)!important;background:rgba(255,255,255,.06)!important;color:#fff!important}
html body .ft3-nlw .ft3-f input::placeholder{color:rgba(255,255,255,.75)}
"""


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
    for viejo, nuevo in [
        ("fetch((window.MF_API_BASE||'')+'/api/bienvenida',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:m})})",
         "window.mfSuscribir(m)"),
        # Video del producto (metacampo "Video del producto"): en la galería se ve como video en bucle, sin sonido
        ("const imgH=p=>p.img?`<img src=\"${p.img}\"",
         "const imgH=p=>p.img&&/\\.mp4(\\?|$)/i.test(p.img)?`<video src=\"${p.img}\" autoplay muted loop playsinline preload=\"metadata\" style=\"width:100%;height:100%;object-fit:cover;display:block\"></video>`:p.img?`<img src=\"${p.img}\""),
        ('aria-label="Foto ${i+1}"><img src="${u}" alt="" loading="lazy"></button>',
         'aria-label="Foto ${i+1}">${/\\.mp4(\\?|$)/i.test(u)?`<video src="${u}#t=0.5" muted playsinline preload="metadata" style="width:100%;height:100%;object-fit:cover"></video>`:`<img src="${u}" alt="" loading="lazy">`}</button>'),
        # "Comparte tus MF": sin servidor para guardar fotos, la clienta la manda por WhatsApp
        ("fetch((window.MF_API_BASE||'')+'/api/look',",
         "(function(){return Promise.resolve({ok:false,json:function(){return Promise.resolve({error:'Envíanos tu foto por WhatsApp'})}})})("),
        ("function openSheet(){",
         "function openSheet(){window.open('https://wa.me/'+WA+'?text='+encodeURIComponent('Hola MF 👋 Quiero compartir mi outfit con mis MF para Comunidad Marlon'),'_blank');return;"),
    ]:
        if html.count(viejo) != 1:
            raise SystemExit('index.html cambió, no encuentro: ' + viejo[:60])
        html = html.replace(viejo, nuevo)
    for viejo, nuevo in PAGINAS.items():
        html = html.replace('href="%s"' % viejo, 'href="%s"' % nuevo)

    mapa = ','.join("%r:'{{ %r | asset_url }}'" % (r, nombre_asset(r)) for r in DINAMICOS)
    cabeza = ('<head>{{ content_for_header }}'
              '<script>%swindow.MF_SHOPIFY={tienda:location.host,activo:true};window.MF_ASSETS={%s};</script>' % (SIN_NETLIFY, mapa))
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
        PARCHES = {
            'descuento.js': [
                ("fetch(API + '/api/descuento', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ codigo: codigo, items: items }) })",
                 "window.mfValidarCodigo(codigo)"),
                ("fetch(API + '/api/bienvenida', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email }) })",
                 "window.mfSuscribir(email)"),
                ("'</b> aplicado · −' + S.pct + '%</span>",
                 "'</b> ' + (S.pct ? 'aplicado · −' + S.pct + '%' : 'se aplica al pagar') + '</span>"),
                ("toast('Descuento del ' + d.pct + '% aplicado')",
                 "toast(d.pct ? 'Descuento del ' + d.pct + '% aplicado' : 'Código guardado: se aplica al pagar')"),
                # fondo del aviso = el mismo de la franja del inicio (su foto difuminada)
                ("fl.innerHTML = '<button type=\"button\" class=\"mfp-x\" data-mfx aria-label=\"Cerrar\">×</button>' +",
                 "var tb = document.querySelector('.mf-tira-bg'), tf = tb && tb.getAttribute('data-src');\n"
                 "    fl.innerHTML = '<div class=\"mfp-bg\" aria-hidden=\"true\"' + (tf ? ' style=\"background-image:url(&quot;' + E(tf) + '&quot;)\"' : '') + '></div><button type=\"button\" class=\"mfp-x\" data-mfx aria-label=\"Cerrar\">×</button>' +"),
            ],
            # InitiateCheckout lo manda la app Facebook & Instagram (checkout de Shopify): aquí no, para no contarlo doble
            'shopify-checkout.js': [("    try { if (window.fbq) fbq('track', 'InitiateCheckout', { currency: 'COP', num_items: items.length }); } catch (err) {}\n", "")],
            'galeria.js': [
                ("var th = gal.querySelectorAll('.th img'); if (th.length < 2) return;",
                 "var th = gal.querySelectorAll('.th img, .th video'); if (th.length < 2) return;"),
                ("var srcs = Array.prototype.map.call(th, function (i) { return i.getAttribute('src'); }).filter(Boolean);",
                 "var srcs = Array.prototype.map.call(th, function (i) { return String(i.getAttribute('src') || '').replace(/#t=[\\d.]+$/, ''); }).filter(Boolean);"),
                ("return '<div class=\"gsl-s\"><img src=\"' + E(s) + '\"",
                 "if (/\\.mp4(\\?|$)/i.test(s)) return '<div class=\"gsl-s\"><video src=\"' + E(s) + '\" autoplay muted loop playsinline preload=\"metadata\" style=\"display:block;width:100%;height:100%;object-fit:cover\"></video></div>';\n      return '<div class=\"gsl-s\"><img src=\"' + E(s) + '\""),("fetch((window.MF_API_BASE || '') + '/api/outfits')", "Promise.resolve({ ok: false })")],
            'outfits-boton.js': [("fetch((window.MF_API_BASE || '') + '/api/outfits')", "Promise.resolve({ ok: false })")],
        }
        for viejo, nuevo in PARCHES.get(ruta, []):
            if texto.count(viejo) != 1:
                raise SystemExit(ruta + ' cambió, no encuentro: ' + viejo[:60])
            texto = texto.replace(viejo, nuevo)
        if ruta == 'meta-pixel.js':  # en la copia de Shopify el píxel también se activa en el dominio de Shopify
            texto = texto.replace("var DOMINIOS = ['tienda.mfcol.com', 'mfcol.com', 'www.mfcol.com'];",
                                  "var DOMINIOS = ['tienda.mfcol.com', 'mfcol.com', 'www.mfcol.com', 'npckie-04.myshopify.com'];")
            # La app Facebook & Instagram ya manda PageView, InitiateCheckout y Purchase (web + servidor):
            # aquí solo quedan ViewContent y AddToCart, con el id de producto de Shopify (coincide con el catálogo de la app).
            for viejo, nuevo in [
                ("  window.fbq('track', 'PageView');\n", "  /* PageView: lo manda la app Facebook & Instagram */\n"),
                ("else if (p === 'out') {", "else if (false) {"),
                ("ev('AddToCart', { content_ids: [String(p.id)], content_name: p.name, content_type: 'product',",
                 "ev('AddToCart', { content_ids: [String(p.sid || p.id)], content_name: p.name, content_type: 'product_group',"),
                ("ev('ViewContent', { content_ids: [String(q.id)], content_name: q.name, content_type: 'product',",
                 "ev('ViewContent', { content_ids: [String(q.sid || q.id)], content_name: q.name, content_type: 'product_group',")]:
                if texto.count(viejo) != 1:
                    raise SystemExit('meta-pixel.js cambió, no encuentro: ' + viejo[:60])
                texto = texto.replace(viejo, nuevo)
        if ruta == 'vitrina.js':  # la vitrina se arma cuando ya están el catálogo y la lista del panel (si no, sale vacía)
            texto = texto.replace("    if (!LISTA) {\n", "    if (!LISTA) {\n      if (!window.MF_API_OK) return;\n", 1)
        texto = texto.replace('"vestidos.html', '"/pages/mf-closet')
        texto = texto.replace('"/pages/mf-closet">Vestidos</button>', '"/pages/mf-closet">MF Clóset</button>')
        texto = texto.replace('"outfits.html', '"/pages/mf-closet').replace("'outfits.html", "'/pages/mf-closet")
        texto = texto.replace('https://tienda.mfcol.com/outfits.html', '/pages/mf-closet')
        for viejo, nuevo in PAGINAS.items():
            texto = texto.replace('"%s"' % viejo, '"%s"' % nuevo).replace("'%s'" % viejo, "'%s'" % nuevo)
        # Botones verdes → azul pizarra de la franja del inicio (mismo tono que "Paga como quieras · 15 % OFF")
        for verde, pizarra in (('#02836f', '#3e4c5c'), ('#3a8273', '#3e4c5c'), ('#016a5a', '#2f3b48'), ('#2f6c5f', '#2f3b48')):
            texto = texto.replace(verde, pizarra).replace(verde.upper(), pizarra)
        texto = texto.replace('rgba(2,131,111,', 'rgba(62,76,92,').replace('#1d5c45', '#3e4c5c')
        if ruta == 'footer.css':  # "Únete a la comunidad MF" con el mismo fondo de la franja del inicio
            texto += FT_FRANJA
        if ruta == 'tira.js':  # la foto de la franja queda disponible para el pie (--mf-tira-foto)
            viejo = "bg.style.backgroundImage = 'url(\"' + src.replace(/\"/g, '%22') + '\")'; }"
            if texto.count(viejo) != 1:
                raise SystemExit('tira.js cambió, no encuentro el fondo de la franja')
            texto = texto.replace(viejo, viejo[:-2] + " document.documentElement.style.setProperty('--mf-tira-foto', bg.style.backgroundImage); }")
        if ruta == 'descuento.css':  # aviso de bienvenida con el fondo de la franja del inicio
            texto += MFP_FRANJA
        escribir('assets/' + nombre_asset(ruta), texto)

    vestidos()
    revisar_sin_netlify()

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
    html = html.replace('href="assets/brand/avatar-negro-512.png"', 'href="%s"' % AVATAR)
    html = html.replace('<head>', '<head>{{ content_for_header }}<script>' + SIN_NETLIFY + '</script>', 1).replace('</body>', '{{ content_for_layout }}</body>', 1)
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

def revisar_sin_netlify():
    """La copia de Shopify debe funcionar aunque se borre Netlify: nada puede pedir datos ni fotos a tienda.mfcol.com o a Supabase."""
    malos = []
    for base, _, archivos in os.walk(SALIDA):
        for n in archivos:
            ruta = os.path.join(base, n)
            if not n.endswith(('.js', '.liquid', '.json', '.css')):
                continue
            t = open(ruta, encoding='utf-8').read()
            t = t.replace("'tienda.mfcol.com', 'mfcol.com', 'www.mfcol.com'", '')  # lista de dominios del píxel (no es una conexión)
            # pago-online.js (Wompi dentro de Netlify) y tienda-api.js (catálogo de Netlify) no se usan en Shopify:
            # el pago es el checkout de Shopify y el catálogo sale de Liquid (if (SH) return;)
            for marca in ('tienda.mfcol.com', 'supabase.co', "/api/"):
                if marca == '/api/' and (n in ('pago-online.js', 'tienda-api.js') or not re.search(r"['\"]/api/", t)):
                    continue
                if marca in t:
                    malos.append((os.path.relpath(ruta, SALIDA), marca))
    if malos:
        raise SystemExit('Todavía depende de Netlify: ' + ', '.join('%s (%s)' % m for m in malos))


if __name__ == '__main__':
    main()
