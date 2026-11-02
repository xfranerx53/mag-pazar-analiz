const C="mag-v34",V="mag-veri-v1",F=["./","index.html","manifest.webmanifest","icon.svg","icon-192.png","icon-512.png","icon-maskable-512.png"];
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

// v12: sabah raporu bildirimi (gece ajanı gönderir)
self.addEventListener("push",e=>{let d={};try{d=e.data.json()}catch(x){d={body:e.data?e.data.text():""}}
 e.waitUntil(self.registration.showNotification(d.title||"👔 Müdür raporu",{body:d.body||"",icon:"icon-192.png",badge:"icon-192.png",tag:"mag-ajan",renotify:true,data:{url:d.url||"./?git=akis"}}))});
self.addEventListener("notificationclick",e=>{e.notification.close();const u=new URL((e.notification.data&&e.notification.data.url)||"./?git=akis",self.registration.scope).href;
 e.waitUntil(clients.matchAll({type:"window",includeUncontrolled:true}).then(l=>{for(const c of l){if(c.url.startsWith(self.registration.scope)){c.focus();return c.navigate(u)}}return clients.openWindow(u)}))});
