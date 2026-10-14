// Örnek şarkıyı (ornek.gp) üretir. İçerik bu proje için yazılmış kısa bir parçadır.
// Çalıştırma: npm run ornek
const fs = require('node:fs');
const path = require('node:path');
const alphaTab = require('../node_modules/@coderline/alphatab/dist/alphaTab.js');

const riffA = ':8 (0.6 2.5) (0.6 2.5) (0.6 2.5) (0.6 2.5) (3.6 5.5) (3.6 5.5) (5.6 7.5) (5.6 7.5)';
const riffB = ':8 (0.6 2.5) (0.6 2.5) (0.6 2.5) (0.6 2.5) (5.5 7.4) (5.5 7.4) (3.5 5.4) (3.5 5.4)';
const bassA = ':8 0.4 0.4 0.4 0.4 3.4 3.4 5.4 5.4';
const bassB = ':8 0.4 0.4 0.4 0.4 5.3 5.3 3.3 3.3';
const beat = ':8 (kickhit hihatclosed) hihatclosed (snarehit hihatclosed) hihatclosed (kickhit hihatclosed) (kickhit hihatclosed) (snarehit hihatclosed) hihatclosed';
const beatCrash = beat.replace('(kickhit hihatclosed)', '(kickhit crashhighhit)');
const fill = ':8 (kickhit hihatclosed) hihatclosed (snarehit hihatclosed) hihatclosed :16 snarehit snarehit hightomhit hightomhit midtomhit midtomhit lowtomhit lowtomhit';
const ride = ':8 (kickhit ridemiddle) ridemiddle (snarehit ridemiddle) ridemiddle (kickhit ridemiddle) (kickhit ridemiddle) (snarehit ridemiddle) ridemiddle';
const rideCrash = ride.replace('(kickhit ridemiddle)', '(kickhit crashhighhit)');

const tex = `
\\title "Deneme Riffi"
\\artist "Tab-to-Play"
\\tempo 104
.
\\track "Elektro Gitar"
\\staff {score tabs}
\\instrument 29
\\section "Riff"
${riffA} | ${riffB} | ${riffA} | ${riffB} |
\\section "Nakarat"
:4 (3.6 5.5 5.4) (3.6 5.5 5.4) (3.6 5.5 5.4) (3.6 5.5 5.4) |
:4 (5.5 7.4 7.3) (5.5 7.4 7.3) (5.5 7.4 7.3) (5.5 7.4 7.3) |
:4 (5.6 7.5 7.4) (5.6 7.5 7.4) (5.6 7.5 7.4) (5.6 7.5 7.4) |
:2 (3.5 5.4 5.3) (5.5 7.4 7.3) |
:1 (0.6 2.5 2.4)
\\track "Bas"
\\staff {score tabs}
\\tuning g2 d2 a1 e1
\\instrument 33
${bassA} | ${bassB} | ${bassA} | ${bassB} |
:8 3.4 3.4 3.4 3.4 3.4 3.4 3.4 3.4 | :8 5.3 5.3 5.3 5.3 5.3 5.3 5.3 5.3 |
:8 0.3 0.3 0.3 0.3 0.3 0.3 0.3 0.3 | :8 3.3 3.3 3.3 3.3 5.3 5.3 5.3 5.3 |
:1 0.4
\\track "Davul"
\\staff {score}
\\instrument percussion
\\clef neutral
\\articulation defaults
${beatCrash} | ${beat} | ${beat} | ${fill} |
${rideCrash} | ${ride} | ${ride} | ${fill} |
:1 (kickhit crashhighhit)
`;

const settings = new alphaTab.Settings();
const importer = new alphaTab.importer.AlphaTexImporter();
importer.initFromString(tex, settings);
const score = importer.readScore();
const bytes = new alphaTab.exporter.Gp7Exporter().export(score, settings);
const out = path.join(__dirname, '..', 'ornek.gp');
fs.writeFileSync(out, bytes);
console.log(`${out}: ${bytes.length} bayt, ${score.masterBars.length} ölçü, ${score.tracks.map((t) => t.name).join(', ')}`);
