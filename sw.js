const C="mag-v13",V="mag-veri-v1",F=["./","index.html","manifest.webmanifest","icon.svg"];
const EXT=/^https:\/\/(www\.gstatic\.com\/firebasejs\/|cdnjs\.cloudflare\.com\/ajax\/libs\/(leaflet|xlsx)\/)/;
const VERI=/\/mag-veri\/data\//;
self.addEventListener("install",e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(F)));self.skipWaiting()});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C&&x!==V).map(x=>caches.delete(x)))).then(()=>self.clients.claim()))});
self.addEventListener("fetch",e=>{
 const r=e.request;if(r.method!=="GET")return;
 // kendi veri parçalarımız: önce telefondaki kopya (anında), arkada güncelini indir
 if(VERI.test(r.url)){e.respondWith(caches.open(V).then(c=>c.match(r).then(h=>{const net=fetch(r).then(res=>{if(res.ok)c.put(r,res.clone());return res}).catch(()=>h);return h||net})));return}
 if(EXT.test(r.url)){e.respondWith(caches.match(r).then(h=>h||fetch(r).then(res=>{if(res.ok||res.type==="opaque"){const cp=res.clone();caches.open(C).then(c=>c.put(r,cp))}return res})));return}
 if(new URL(r.url).origin!==location.origin)return;
 e.respondWith(fetch(r).then(res=>{if(res.ok){const cp=res.clone();caches.open(C).then(c=>c.put(r,cp))}return res}).catch(()=>caches.match(r).then(h=>h||caches.match("index.html"))));
});
