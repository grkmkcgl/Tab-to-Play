// Çevrimdışı çalışma. Şarkılar IndexedDB'de durur; burada yalnızca uygulamanın kendi dosyaları var.
//
// Sürüm tutarlılığı: yayınlarken tools/build.mjs "__SURUM__"u yapı numarasıyla değiştirir. Sayfa
// css/js'i "?v=<yapı>" ile ister. Sayfa önce ağdan denenir (3 sn), olmazsa önbellekten gelir.
// Sürümlü dosyalar önbellekte yoksa ağdan alınır; yeni adres olduğu için CDN'in eski kopyası
// karışamaz. Eski sayfa her zaman kendi eski dosyalarıyla, yeni sayfa yeni dosyalarıyla çalışır.
//
// Büyük kütüphane dosyaları ayrı önbellekte; yalnızca LIB_VERSION değişince yeniden iner.
const BUILD = '__SURUM__';
const LIB_VERSION = 'alphatab-1.8.4';
const SCOPE = new URL(self.registration.scope).pathname;
const APP_CACHE = `ttp-app-${BUILD}-${SCOPE}`;
const LIB_CACHE = `ttp-lib-${LIB_VERSION}-${SCOPE}`;
const INBOX = 'ttp-gelen';
const v = (p) => `${p}?v=${encodeURIComponent(BUILD)}`;
const APP_FILES = [
  './', v('css/app.css'), v('js/app.js'), v('js/db.js'), 'manifest.webmanifest', 'ornek.gp',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png',
  'icons/apple-touch-icon.png', 'icons/favicon-32.png',
];
const LIB_FILES = ['lib/alphaTab.min.js', 'lib/font/Bravura.woff2', 'lib/font/Bravura.woff', 'lib/soundfont/sonivox.sf3'];
const abs = (p) => new URL(p, self.registration.scope).href;
const APP_URLS = new Set(APP_FILES.map(abs));
const LIB_URLS = new Set(LIB_FILES.map(abs));
const PAGE = abs('./');

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    await (await caches.open(APP_CACHE)).addAll(APP_FILES.map((f) => new Request(abs(f), { cache: 'reload' })));
    const lib = await caches.open(LIB_CACHE);
    for (const f of LIB_FILES) if (!(await lib.match(abs(f)))) await lib.add(new Request(abs(f), { cache: 'reload' }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) {
      if (k.startsWith('ttp-') && k.endsWith(SCOPE) && k !== APP_CACHE && k !== LIB_CACHE) await caches.delete(k);
    }
    await self.clients.claim();
  })());
});

async function networkFirstPage(req) {
  const cache = await caches.open(APP_CACHE);
  try {
    const res = await Promise.race([
      fetch(req, { cache: 'no-cache' }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('zaman aşımı')), 3000)),
    ]);
    if (res.ok && !res.redirected) {
      // Önbellekteki sayfa yalnızca bu service worker'ın sürümüyle aynıysa güncellenir
      const html = await res.clone().text();
      if (html.includes(`content="${BUILD}"`)) await cache.put(PAGE, res.clone());
    }
    return res;
  } catch {
    return (await cache.match(PAGE)) || Response.error();
  }
}

async function cacheFirst(cacheName, req, key) {
  const cache = await caches.open(cacheName);
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
  const path = url.origin + url.pathname;
  if (req.mode === 'navigate' && (path === PAGE || path === abs('index.html'))) {
    e.respondWith(networkFirstPage(req));
  } else if (APP_URLS.has(url.href)) {
    e.respondWith(cacheFirst(APP_CACHE, req, url.href));
  } else if (LIB_URLS.has(path)) {
    e.respondWith(cacheFirst(LIB_CACHE, req, path));
  }
  // Başka sürüm numaralı dosyalar (ör. yeni sayfanın istediği yeni betik) doğrudan ağdan gelir.
});
