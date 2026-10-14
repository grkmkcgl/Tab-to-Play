// Çevrimdışı çalışma. Uygulamanın kendi dosyaları önbelleğe alınır; şarkılar IndexedDB'de durur.
// Küçük dosyalar (sayfa, css, js) önce ağdan denenir (3 sn), olmazsa önbellekten gelir: internet varken
// her açılışta en yeni sürüm gelir. Büyük kütüphane dosyaları doğrudan önbellekten gelir;
// bunlar değişince VERSION'ı artır.
const VERSION = 'v1';
const SCOPE = new URL(self.registration.scope).pathname;
const CACHE = `ttp-${VERSION}-${SCOPE}`;
const INBOX = 'ttp-gelen';
const NETWORK_FIRST = ['./', 'index.html', 'css/app.css', 'js/app.js', 'js/db.js', 'manifest.webmanifest'];
const CACHE_FIRST = [
  'lib/alphaTab.min.js', 'lib/font/Bravura.woff2', 'lib/font/Bravura.woff', 'lib/soundfont/sonivox.sf3',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png',
  'icons/apple-touch-icon.png', 'icons/favicon-32.png', 'ornek.gp',
];
const APP_FILES = [...NETWORK_FIRST, ...CACHE_FIRST];
const abs = (p) => new URL(p, self.registration.scope).href;
const NETWORK_FIRST_URLS = new Set(NETWORK_FIRST.map(abs));
const APP_URLS = new Set(APP_FILES.map(abs));

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(APP_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) {
      if (k.startsWith('ttp-') && k.endsWith(SCOPE) && k !== CACHE) await caches.delete(k);
    }
    await self.clients.claim();
  })());
});

async function networkFirst(req, key) {
  const cache = await caches.open(CACHE);
  try {
    const res = await Promise.race([
      fetch(req, { cache: 'no-cache' }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('zaman aşımı')), 3000)),
    ]);
    if (res.ok) await cache.put(key, res.clone());
    return res;
  } catch {
    return (await cache.match(key)) || Response.error();
  }
}

async function cacheFirst(req, key) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(key);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) await cache.put(key, res.clone());
  return res;
}

// Android paylaş menüsü: dosyaları geçici olarak sakla, uygulamayı aç; uygulama içe aktarıp siler.
async function receiveShare(req) {
  try {
    const form = await req.formData();
    const cache = await caches.open(INBOX);
    let n = 0;
    for (const f of form.getAll('dosya')) {
      if (typeof f === 'string') continue;
      await cache.put(abs(`gelen/${Date.now()}-${n++}`), new Response(f, { headers: { 'x-name': encodeURIComponent(f.name || 'dosya.gp') } }));
    }
  } catch { /* boş paylaşım */ }
  return Response.redirect(abs('./?gelen=1#/'), 303);
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method === 'POST' && url.href === abs('paylas')) {
    e.respondWith(receiveShare(req));
    return;
  }
  if (req.method !== 'GET') return;
  const key = url.origin + url.pathname;
  if (req.mode === 'navigate' && (key === abs('./') || key === abs('index.html'))) {
    e.respondWith(networkFirst(req, abs('./')));
  } else if (NETWORK_FIRST_URLS.has(key)) {
    e.respondWith(networkFirst(req, key));
  } else if (APP_URLS.has(key)) {
    e.respondWith(cacheFirst(req, key));
  }
});
