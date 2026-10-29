const C="mag-v1",F=["./","index.html","manifest.webmanifest","icon.svg"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(F)));self.skipWaiting()});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x)))))});
self.addEventListener("fetch",e=>{e.respondWith(fetch(e.request).catch(()=>caches.match(e.request)))});
