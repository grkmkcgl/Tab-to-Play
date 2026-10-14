// Kütüphane dosyalarını node_modules'tan lib/ klasörüne kopyalar.
// alphaTab sürümünü yükseltmek için: package.json'da sürümü değiştir, npm install, npm run vendor.
import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'node_modules/@coderline/alphatab');
const files = [
  ['dist/alphaTab.min.js', 'lib/alphaTab.min.js'],
  ['LICENSE', 'lib/alphaTab-LICENSE.txt'],
  ['dist/font/Bravura.woff2', 'lib/font/Bravura.woff2'],
  ['dist/font/Bravura.woff', 'lib/font/Bravura.woff'],
  ['dist/font/Bravura-OFL.txt', 'lib/font/Bravura-OFL.txt'],
  ['dist/soundfont/sonivox.sf3', 'lib/soundfont/sonivox.sf3'],
  ['dist/soundfont/LICENSE', 'lib/soundfont/LICENSE.txt'],
  ['dist/soundfont/README.md', 'lib/soundfont/README.md'],
];
for (const [from, to] of files) {
  mkdirSync(dirname(join(root, to)), { recursive: true });
  copyFileSync(join(src, from), join(root, to));
  console.log(to);
}
