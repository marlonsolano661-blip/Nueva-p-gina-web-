(()=>{
const K='mf_auth_v2';
if(sessionStorage.getItem('mf_ok')==='1')return;
const d=document.documentElement,te=new TextEncoder();
const b64=a=>btoa(String.fromCharCode(...new Uint8Array(a)));
const kdf=async(p,s)=>{const k=await crypto.subtle.importKey('raw',te.encode(p),'PBKDF2',false,['deriveBits']);return b64(await crypto.subtle.deriveBits({name:'PBKDF2',salt:s,iterations:310000,hash:'SHA-256'},k,256))};
let rec=null;try{rec=JSON.parse(localStorage.getItem(K))}catch(e){}
d.style.visibility='hidden';
addEventListener('DOMContentLoaded',()=>{
 const I='display:block;width:100%;margin:.5rem 0;padding:.8rem;border-radius:1rem;border:2px solid #333;background:#111;color:#fff;font-size:16px;text-align:center',nuevo=!rec,o=document.createElement('div');
 o.style.cssText='position:fixed;inset:0;z-index:99999;visibility:visible;background:#000;color:#fff;display:grid;place-items:center;font:500 16px system-ui,sans-serif;padding:1rem;text-align:center';
 o.innerHTML=`<form style="max-width:20rem;width:100%"><h2 style="font-size:1.6rem;margin:0 0 .5rem">🔒 Marlon Admin</h2><p id="m" style="opacity:.8;margin:0 0 1rem">${nuevo?'Crea tu contraseña (mínimo 8 caracteres)':'Escribe tu contraseña'}</p><input id="p1" type="password" autocomplete="${nuevo?'new-password':'current-password'}" aria-label="Contraseña" style="${I}">${nuevo?`<input id="p2" type="password" autocomplete="new-password" placeholder="Repítela" aria-label="Repetir contraseña" style="${I}">`:''}<button id="b" style="margin-top:.8rem;padding:.8rem 1.6rem;border:0;border-radius:999px;background:#fff;color:#000;font:600 16px system-ui;cursor:pointer">${nuevo?'Guardar y entrar':'Entrar'}</button></form>`;
 document.body.appendChild(o);
 const f=o.querySelector('form'),m=o.querySelector('#m'),b=o.querySelector('#b');let n=0;
 const abrir=()=>{sessionStorage.setItem('mf_ok','1');o.remove();d.style.visibility=''};
 f.p1.focus();
 f.onsubmit=async e=>{e.preventDefault();const p=f.p1.value;
  if(nuevo){
   if(p.length<8){m.textContent='Usa al menos 8 caracteres';return}
   if(p!==f.p2.value){m.textContent='Las contraseñas no coinciden';return}
   const s=crypto.getRandomValues(new Uint8Array(16));
   localStorage.setItem(K,JSON.stringify({s:b64(s),h:await kdf(p,s)}));return abrir()}
  b.disabled=true;
  const s=Uint8Array.from(atob(rec.s),c=>c.charCodeAt(0));
  if(await kdf(p,s)===rec.h)return abrir();
  n++;f.p1.value='';m.textContent='Contraseña incorrecta';
  let t=Math.min(30,2**n);b.textContent='Espera '+t+' s';
  const i=setInterval(()=>{t--;if(t>0)b.textContent='Espera '+t+' s';else{clearInterval(i);b.disabled=false;b.textContent='Entrar'}},1000)};
});
})();
