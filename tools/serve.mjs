// Yerel deneme sunucusu: node tools/serve.mjs [port]  →  http://localhost:8080
// Aynı ağdaki telefondan denemek için bilgisayarın IP adresini kullan (service worker yalnızca
// localhost ya da https'te çalışır, ama uygulamanın geri kalanı http'de de açılır).
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.woff': 'font/woff',
  '.sf2': 'application/octet-stream', '.sf3': 'application/octet-stream', '.gp': 'application/octet-stream',
};

// opts.root: sunulacak klasör (varsayılan repo kökü; çalışırken değiştirilebilir: server.opts.root = …)
// opts.cdn: true ise GitHub Pages'in CDN'i gibi davranır: sayfa ve sw.js dışındaki her adresin
// (sorgu dahil) ilk yanıtını saklar ve sonra hep onu verir. Testlerde eski/yeni sürüm karışmasını
// yeniden üretmek için.
export function serve(port = 8080, opts = {}) {
  const cdn = new Map();
  const server = createServer(async (req, res) => {
    try {
      const base = server.opts.root || root;
      const url = new URL(req.url, 'http://x');
      let path = decodeURIComponent(url.pathname);
      if (path.endsWith('/')) path += 'index.html';
      const file = normalize(join(base, path));
      if (!file.startsWith(base) || /[\\/](node_modules|tests|\.git)[\\/]/.test(file.slice(base.length))) throw new Error('yasak');
      const cacheable = server.opts.cdn && !/\/(index\.html|sw\.js)$/.test(path);
      let body = cacheable ? cdn.get(url.pathname + url.search) : null;
      if (!body) {
        if (!(await stat(file)).isFile()) throw new Error('yok');
        body = await readFile(file);
        if (cacheable) cdn.set(url.pathname + url.search, body);
      }
      res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream', 'cache-control': 'no-cache' });
      res.end(body);
    } catch {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('bulunamadı');
    }
  });
  server.opts = opts;
  return new Promise((resolve) => server.listen(port, () => resolve(server)));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.argv[2]) || 8080;
  await serve(port);
  console.log(`http://localhost:${port}`);
}
