// icons/icon.svg'den PNG ikonları üretir (Playwright ile). Çalıştırma: node tools/icons.mjs
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const svg = readFileSync(join(root, 'icons/icon.svg'), 'utf8');
const sizes = [
  ['icon-192.png', 192, 1], ['icon-512.png', 512, 1],
  ['maskable-512.png', 512, 0.78], ['apple-touch-icon.png', 180, 0.86], ['favicon-32.png', 32, 1],
];
const browser = await chromium.launch();
const page = await browser.newPage();
for (const [name, size, inner] of sizes) {
  await page.setViewportSize({ width: size, height: size });
  const pad = (size * (1 - inner)) / 2;
  await page.setContent(`<style>html,body{margin:0;background:#17130f}div{position:absolute;left:${pad}px;top:${pad}px;width:${size - 2 * pad}px;height:${size - 2 * pad}px}svg{width:100%;height:100%;display:block}</style><div>${svg}</div>`);
  await page.screenshot({ path: join(root, 'icons', name), omitBackground: false });
  console.log(name);
}
await browser.close();
