/* "Llévate el look perfecto" (copia de Shopify): al terminar el video, el botón principal deja de ser "Comprar vestido"
   y abre UNA sola ficha con el vestido y los tacones: la clienta elige las dos tallas y agrega todo a la bolsa de una vez.
   Para comprar solo una prenda siguen las tarjetas "Viste" y "Calza". Este bloque va dentro del script del perchero. */
var LKT={L:null,items:[]};
(function(){
  var css=document.createElement("style");
  css.textContent='#lkVeil{position:fixed;inset:0;z-index:52;background:rgba(255,255,255,.6);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);opacity:0;pointer-events:none;transition:opacity .3s}'+
    '#lkVeil.on{opacity:1;pointer-events:auto}'+
    '#lkSheet{position:fixed;left:0;right:0;bottom:0;z-index:53;background:#fff;border-radius:18px 18px 0 0;padding:1.1rem 1.2rem calc(1rem + env(safe-area-inset-bottom));max-height:92vh;overflow-y:auto;transform:translateY(105%);transition:transform .45s cubic-bezier(.2,.8,.2,1);box-shadow:0 -10px 30px rgba(0,0,0,.08)}'+
    '#lkSheet.on{transform:none}@media (min-width:700px){#lkSheet{max-width:560px;margin:0 auto}}'+
    '#lkSheet .lkh{display:flex;justify-content:space-between;align-items:center;margin-bottom:.2rem}'+
    '#lkSheet .lkh h2{font:300 1.3rem/1.2 Jost,sans-serif;margin:0}'+
    '#lkSheet .lkx{width:38px;height:38px;border:0;border-radius:50%;background:#f4f4f4;font-size:1.3rem;line-height:1;color:var(--k)}'+
    '#lkSheet .lks{font-size:.8rem;color:var(--g);margin:0 0 .9rem}'+
    '#lkSheet .lki{display:grid;grid-template-columns:62px 1fr;gap:.8rem;padding:.8rem 0;border-top:1px solid #f0f0f0}'+
    '#lkSheet .lki img{width:62px;height:72px;object-fit:contain;background:#fafafa;border-radius:10px}'+
    '#lkSheet .lki small{display:block;font:300 .64rem Jost,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:var(--g)}'+
    '#lkSheet .lki b{display:block;font:300 .98rem/1.2 Jost,sans-serif}'+
    '#lkSheet .lki .pp{font-size:.86rem;font-variant-numeric:tabular-nums;margin:.1rem 0 .5rem}'+
    '#lkSheet .row{margin-bottom:.5rem}#lkSheet .lbl{margin-bottom:.3rem}'+
    '#lkSheet .lkt{display:flex;justify-content:space-between;align-items:baseline;border-top:1px solid #f0f0f0;padding:.8rem 0 .7rem;font-size:.95rem}'+
    '#lkSheet .lkt b{font-weight:400;font-variant-numeric:tabular-nums;font-size:1.1rem}'+
    '#lkSheet .btn{width:100%}#lkSheet .lkn{font-size:.74rem;color:var(--g);text-align:center;margin:.6rem 0 0}';
  document.head.appendChild(css);
  var veil=document.createElement("div");veil.id="lkVeil";
  var sh=document.createElement("div");sh.id="lkSheet";sh.setAttribute("role","dialog");sh.setAttribute("aria-label","Llévate el look perfecto");
  document.body.appendChild(veil);document.body.appendChild(sh);
  veil.addEventListener("click",cerrarLook);
})();
function lkListo(L){var V=L&&L.prenda&&L.prenda.venta,T=L&&L.tacon;return !!(V&&T&&V.p>0&&T.p>0)}
function lkBoton(L,on){
  var b=$("buy");if(!b)return;
  if(on&&lkListo(L)){b.dataset.look="1";b.textContent="Llévate el look perfecto"}
  else{delete b.dataset.look;b.textContent="Comprar vestido"}
}
function lkPintar(){
  var L=LKT.L,sh=$("lkSheet"),total=0;
  var h='<div class="lkh"><h2>Llévate el look perfecto</h2><button class="lkx" type="button" data-lkx aria-label="Cerrar">×</button></div>'+
    '<p class="lks">'+(L.nombre||"")+' · elige tus tallas y agrégalo todo de una vez</p>';
  LKT.items.forEach(function(s,k){
    var it=s.it;total+=it.p;
    var img=k===0?(L.prenda.frente||it.catImg||""):(it.mini||it.catImg||"");
    h+='<div class="lki"><img src="'+img+'" alt=""><div><small>'+(k===0?"Viste":"Calza")+'</small><b>'+it.n+'</b><p class="pp">'+fmt(it.p)+'</p>'+
      ((it.colores||[]).length>1?'<p class="lbl">Color</p><div class="row">'+it.colores.map(function(c){return '<button class="opt" type="button" data-k="'+k+'" data-c="'+c+'" aria-pressed="'+(c===s.color)+'">'+c+'</button>'}).join("")+'</div>':'')+
      '<p class="lbl">Talla</p><div class="row">'+(it.tallas||[]).map(function(t){return '<button class="opt" type="button" data-k="'+k+'" data-s="'+t+'" aria-pressed="'+(t===s.size)+'"'+((it.agotadas||[]).indexOf(t)>-1?" disabled":"")+'>'+t+'</button>'}).join("")+'</div>'+
      '</div></div>';
  });
  h+='<div class="lkt"><span>Total del look</span><b>'+fmt(total)+'</b></div>'+
    '<button class="btn" type="button" data-lkadd>Agregar el look a la bolsa</button>'+
    '<p class="lkn">¿Solo una prenda? Toca la tarjeta "Viste" o "Calza" para comprarla por separado.</p>';
  sh.innerHTML=h;
}
function abrirLook(){
  var L=LOOKS[cur];if(!lkListo(L))return;
  LKT.L=L;LKT.items=[L.prenda.venta,L.tacon].map(function(it){
    var c=it.color&&(it.colores||[]).indexOf(it.color)>-1?it.color:(it.colores||[])[0]||"";
    return {it:it,size:null,color:c};
  });
  lkPintar();$("lkVeil").classList.add("on");$("lkSheet").classList.add("on");$("lkSheet").scrollTop=0;
}
function cerrarLook(){$("lkVeil").classList.remove("on");$("lkSheet").classList.remove("on")}
$("buy").addEventListener("click",function(e){
  if(this.dataset.look!=="1")return;
  e.stopImmediatePropagation();e.preventDefault();abrirLook();
},true);
$("lkSheet").addEventListener("click",function(e){
  if(e.target.closest("[data-lkx]")){cerrarLook();return}
  var b=e.target.closest("[data-k]");
  if(b&&!b.disabled){var s=LKT.items[+b.dataset.k];if(b.dataset.s!=null)s.size=b.dataset.s;if(b.dataset.c!=null)s.color=b.dataset.c;lkPintar();return}
  if(e.target.closest("[data-lkadd]")){
    var falta=LKT.items.filter(function(s){return !s.size})[0];
    if(falta){toast(falta===LKT.items[0]?"Elige la talla del vestido":"Elige la talla de los tacones");return}
    var cart=[];try{cart=JSON.parse(localStorage.getItem("mf_cart"))||[]}catch(x){}
    LKT.items.forEach(function(s){
      var it=s.it,col=(it.catColors||[]).filter(function(c){return String(c.n).toLowerCase()===String(s.color).toLowerCase()})[0]||{};
      var l=cart.filter(function(x){return String(x.id)===String(it.id)&&x.talla===s.size&&(x.color||"")===(s.color||"")})[0];
      if(l)l.q++;else cart.push({id:it.id,name:it.n,price:it.p,img:col.img||it.catImg||"",talla:s.size,color:s.color||"",q:1});
    });
    try{localStorage.setItem("mf_cart",JSON.stringify(cart))}catch(x){}
    cerrarLook();toast("Look añadido a la bolsa",true);
  }
});
var _lkCreditos=creditos;creditos=function(L,v,t){_lkCreditos(L,v,t);lkBoton(L,!!t)};
