// أهلًا ABC: offline support.
// Change VERSION whenever you replace a sound or image, so devices fetch the new file.
const VERSION='ahlan-abc-v6';
const CORE=['./','index.html','manifest.webmanifest','images/logo.webp','images/icon-192.png','images/icon-512.png','images/apple-touch-icon.png'];

self.addEventListener('install',e=>{
  e.waitUntil(caches.open(VERSION).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==VERSION).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',e=>{
  const r=e.request,u=new URL(r.url);
  if(r.method!=='GET')return;
  if(r.headers.has('range')){e.respondWith(ranged(r));return}
  const fonts=u.hostname==='fonts.googleapis.com'||u.hostname==='fonts.gstatic.com';
  if(u.origin!==location.origin&&!fonts)return;
  // The page itself: newest when online, cached copy when offline.
  if(r.mode==='navigate'||u.pathname.endsWith('/index.html')){
    e.respondWith(fetch(r).then(res=>{const c=res.clone();caches.open(VERSION).then(x=>x.put('index.html',c));return res})
      .catch(()=>caches.match('index.html')));
    return;
  }
  // Sounds, pictures, fonts: from the cache once fetched, so each file downloads only once.
  e.respondWith(caches.match(r).then(hit=>hit||fetch(r).then(res=>{
    if(res.ok){const c=res.clone();caches.open(VERSION).then(x=>x.put(r,c))}
    return res;
  })));
});

// Audio players ask for byte ranges. Answer them from the cache when the file is there, so sounds play offline.
async function ranged(r){
  const hit=await caches.match(r.url);
  if(!hit)return fetch(r);
  const buf=await hit.arrayBuffer(),n=buf.byteLength;
  const m=/bytes=(\d*)-(\d*)/.exec(r.headers.get('range')||'');
  let a=0,b=n-1;
  if(m){if(m[1]){a=+m[1];if(m[2])b=Math.min(+m[2],n-1)}else if(m[2]){a=Math.max(0,n-m[2])}}
  if(a>=n)return new Response(null,{status:416,headers:{'Content-Range':'bytes */'+n}});
  return new Response(buf.slice(a,b+1),{status:206,headers:{
    'Content-Type':hit.headers.get('Content-Type')||'audio/mpeg',
    'Content-Range':'bytes '+a+'-'+b+'/'+n,'Content-Length':String(b-a+1),'Accept-Ranges':'bytes'}});
}
