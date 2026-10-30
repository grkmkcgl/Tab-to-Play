// Testler için yapay dosyalar üretir (tests/out/ altına). Gerçek şarkı yok; içerik test için yazıldı.
const fs = require('node:fs');
const path = require('node:path');
const alphaTab = require('../node_modules/@coderline/alphatab/dist/alphaTab.js');

const OUT = path.join(__dirname, 'out');

function gpFromTex(tex) {
  const settings = new alphaTab.Settings();
  const importer = new alphaTab.importer.AlphaTexImporter();
  importer.initFromString(tex, settings);
  return new alphaTab.exporter.Gp7Exporter().export(importer.readScore(), settings);
}

// 16 bit tek kanal WAV
function wav(freq, harm, rate, seconds) {
  const n = rate * seconds;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(rate, 24); buf.writeUInt32LE(rate * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    let v = 0;
    harm.forEach((a, k) => { v += a * Math.sin((2 * Math.PI * freq * (k + 1) * i) / rate); });
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, v * 0.25)) * 32767), 44 + i * 2);
  }
  return buf;
}

function make() {
  fs.mkdirSync(OUT, { recursive: true });
  const bar = ':4 0.6 2.6 3.6 5.6';
  const drum = ':4 (kickhit hihatclosed) (snarehit hihatclosed) (kickhit hihatclosed) (snarehit hihatclosed)';
  fs.writeFileSync(path.join(OUT, 'test-sarki.gp'), gpFromTex(`
\\title "Test Şarkısı"
\\artist "Örnek Grup"
\\tempo 120
.
\\track "Ritim Gitar"
\\staff {score tabs}
\\instrument 30
${bar} | ${bar} | ${bar} | ${bar}
\\track "Bateri"
\\staff {score}
\\instrument percussion
\\clef neutral
\\articulation defaults
${drum} | ${drum} | ${drum} | ${drum}
`));
  fs.writeFileSync(path.join(OUT, 'baska.gp'), gpFromTex(`
\\title "Akşam Provası"
\\artist "Deneme Topluluğu"
\\tempo 90
.
\\track "Gitar"
\\staff {tabs}
:2 0.1 0.2 | :2 0.3 0.4
`));
  fs.writeFileSync(path.join(OUT, 'xml-deneme.musicxml'), `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="3.1">
  <work><work-title>XML Deneme</work-title></work>
  <part-list><score-part id="P1"><part-name>Gitar</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <attributes><divisions>1</divisions><time><beats>4</beats><beat-type>4</beat-type></time><clef><sign>G</sign><line>2</line></clef></attributes>
      <note><pitch><step>E</step><octave>4</octave></pitch><duration>4</duration><type>whole</type></note>
    </measure>
  </part>
</score-partwise>
`);
  fs.writeFileSync(path.join(OUT, 'bozuk.gp'), Buffer.from('bu bir guitar pro dosyası değil'.repeat(20)));
  // Akort testi için mikrofon yerine verilen ses: La (A2, 110 Hz) ve harmonikleri, 48 kHz, 3 sn
  fs.writeFileSync(path.join(OUT, 'la-110.wav'), wav(110, [1, 0.6, 0.35, 0.2], 48000, 3));
}

module.exports = { make, OUT };
if (require.main === module) make();
