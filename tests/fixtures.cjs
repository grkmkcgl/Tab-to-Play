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
}

module.exports = { make, OUT };
if (require.main === module) make();
