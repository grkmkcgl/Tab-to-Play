// Yayınlanacak dosyaları bir klasöre kopyalar ve "__SURUM__"u yapı numarasıyla değiştirir.
//   node tools/build.mjs _site [yapı]
// Yapı verilmezse: GitHub Actions'ta çalıştırma numarası + commit, yerelde commit + zaman.
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
export const PUBLISH = ['index.html', 'sw.js', 'manifest.webmanifest', 'ornek.gp', 'css', 'js', 'lib', 'icons'];
const STAMPED = ['index.html', 'sw.js', 'js/app.js', 'js/db.js', 'js/egzersiz.js', 'js/metronom.js', 'js/plan.js'];

function defaultBuild() {
  let sha = 'yerel';
  try { sha = execSync('git rev-parse --short HEAD', { cwd: root }).toString().trim(); } catch { /* git yok */ }
  const run = process.env.GITHUB_RUN_NUMBER;
  return run ? `${run}-${sha}` : `${sha}-${Date.now().toString(36)}`;
}

export function build(out, buildId = defaultBuild()) {
  if (!/^[\w.-]+$/.test(buildId)) throw new Error(`geçersiz yapı numarası: ${buildId}`);
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  for (const f of PUBLISH) cpSync(join(root, f), join(out, f), { recursive: true });
  for (const f of STAMPED) {
    const p = join(out, f);
    writeFileSync(p, readFileSync(p, 'utf8').replaceAll('__SURUM__', buildId));
  }
  return buildId;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const out = resolve(process.argv[2] || '_site');
  console.log(`${out}: yapı ${build(out, process.argv[3])}`);
}
