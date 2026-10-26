// Egzersizler: elektro gitar ve davul için, seviyelere göre. Her egzersiz alphaTex olarak burada
// üretilir (dosya yok), çalarda şarkı gibi açılır.
//
// Tempo: egzersizler 100 BPM yazılır, çalarda hız yüzdesi doğrudan BPM olur
// (hız %72 = 72 BPM). Böylece BPM'i değiştirmek için notaları yeniden çizmek gerekmez.
// Metronom ölçünün alt sayısına göre tıklar (5/8'de her sekizlik). Bu yüzden x/8 ölçülerde
// nota dörtlük = 50 yazılır (sekizlik = 100): orada da BPM metronomun dakikadaki tık sayısıdır.
export const EX_TEMPO = 100;
export const exTempo = (ex) => ex.tempo ?? EX_TEMPO;
export const EX_BPM_MIN = 30;
export const EX_BPM_MAX = 240;

export const LEVELS = { baslangic: 'Başlangıç', orta: 'Orta', ileri: 'İleri', olcu: 'Ölçüler' };
export const EX_INST = { gitar: 'Elektro gitar', davul: 'Davul' };

// ---------------------------------------------------------------- yardımcılar
const n = (fret, str) => `${fret}.${str}`;
const tu = (beat, t = 3) => `${beat}{tu ${t}}`;

// Notaları ölçülere böler: her ölçüde `per` nota, süre `dur`, istenirse triole/altılık
function bars(notes, per, dur, tuplet = 0) {
  const out = [];
  for (let i = 0; i < notes.length; i += per) {
    const chunk = notes.slice(i, i + per).map((x) => (tuplet ? tu(x, tuplet) : x));
    out.push(`:${dur} ${chunk.join(' ')}`);
  }
  return out;
}

// Her telde verilen perdeler: tel 6'dan 1'e çıkış, 1'den 6'ya iniş (iniş perdeleri ters sırada)
function acrossStrings(up, down = [...up].reverse()) {
  const notes = [];
  for (let s = 6; s >= 1; s--) for (const f of up) notes.push(n(f, s));
  for (let s = 1; s <= 6; s++) for (const f of down) notes.push(n(f, s));
  return notes;
}

const repeat = (arr, k) => Array.from({ length: k }, () => arr).flat();

// Notaya etki ekle: `5.6` → `5.6{ac}`, `0.6{pm}` → `0.6{pm ac}`
const fx = (tok, e) => (tok.endsWith('}') ? `${tok.slice(0, -1)} ${e}}` : `${tok}{${e}}`);
// Vurgu: tek nota ya da akorun bütün notaları
const accent = (x) => {
  if (x === 'r') return x;
  if (x.startsWith('(')) return `(${x.slice(1, -1).split(' ').map((t) => fx(t, 'ac')).join(' ')})`;
  return fx(x, 'ac');
};
// Grupların ilk notası vurgulu (ör. 7/8'de [2, 2, 3]); istenirse ilk notanın üstüne grup yazısı
function grouped(notes, groups, label = '') {
  const starts = new Set();
  let i = 0;
  for (const g of groups) { starts.add(i); i += g; }
  return notes.map((x, k) => {
    let t = starts.has(k % i) ? accent(x) : x;
    if (label && k === 0) t = t.startsWith('(') ? `${t}{txt "${label}"}` : fx(t, `txt "${label}"`);
    return t;
  });
}
// Ölçü: süre, gruplar, notalar; `ts` verilirse ölçü başında ölçü değişimi
function gBar(dur, groups, notes, { ts = null, label = '' } = {}) {
  const sum = groups.reduce((a, b) => a + b, 0);
  if (notes.length !== sum) throw new Error(`ölçüde ${sum} nota olmalı: ${notes.join(' ')}`);
  return `${ts ? `\\ts ${ts[0]} ${ts[1]} ` : ''}:${dur} ${grouped(notes, groups, label).join(' ')}`;
}

// La minör pentatonik, 5. perde kutusu (çıkış ve iniş)
const PENTA_UP = ['5.6', '8.6', '5.5', '7.5', '5.4', '7.4', '5.3', '7.3', '5.2', '8.2', '5.1', '8.1'];
const PENTA_DOWN = [...PENTA_UP].reverse();

// ---------------------------------------------------------------- elektro gitar
const CLEAN = 27; // Elektro gitar (temiz)
const DRIVE = 29; // Elektro gitar (overdrive)

const E5 = '(0.6 2.5)';
const G5 = '(3.6 5.5)';
const A5 = '(5.6 7.5)';
const C5 = '(8.6 10.5)';
const B5 = '(7.6 9.5)';
const EM = '(0.6 2.5 2.4 0.3 0.2 0.1)';
const C = '(3.5 2.4 0.3 1.2 0.1)';
const G = '(3.6 2.5 0.4 0.3 0.2 3.1)';
const D = '(0.4 2.3 3.2 2.1)';
const pm = (f, s) => `${f}.${s}{pm}`;

// Arpej: [a b c] [d c b] [a b c] [d c b] triole
const tripArp = ([a, b, c, d]) => `:8 ${[a, b, c, d, c, b, a, b, c, d, c, b].map((x) => tu(x)).join(' ')}`;

// Legato çifti: ilk nota penalanır, ikincisi hammer-on / pull-off ile
const leg = (s, lo, hi) => [`${lo}.${s}{h}`, `${hi}.${s}`, `${hi}.${s}{h}`, `${lo}.${s}`];
const PENTA_FRETS = { 6: [5, 8], 5: [5, 7], 4: [5, 7], 3: [5, 7], 2: [5, 8], 1: [5, 8] };
const legBar = (s1, s2) => `:8 ${[...leg(s1, ...PENTA_FRETS[s1]), ...leg(s2, ...PENTA_FRETS[s2])].join(' ')}`;

// Sol majör, tel başına üç nota
const G3NPS = ['3.6', '5.6', '7.6', '3.5', '5.5', '7.5', '4.4', '5.4', '7.4', '4.3', '5.3', '7.3', '5.2', '7.2', '8.2', '5.1', '7.1', '8.1'];

// Sweep arpej: bir vuruşta çıkış, bir vuruşta iniş (altılık)
const SWEEP = {
  Am: ['12.5', '15.5', '14.4', '14.3', '13.2', '12.1', '17.1'],
  Dm: ['5.5', '8.5', '7.4', '7.3', '6.2', '5.1', '10.1'],
  E: ['7.5', '11.5', '9.4', '9.3', '9.2', '7.1', '12.1'],
};
function sweepBar(name) {
  const [r, r2, s4, s3, s2, s1, top] = SWEEP[name];
  const cycle = [r, r2, s4, s3, s2, s1, top, s1, s2, s3, s4, r2];
  return `:16 ${[...cycle, ...cycle].map((x) => tu(x)).join(' ')}`;
}

// Ritim merdiveni: aynı nota dizisi sekizlik, triole, onaltılık, altılık
function ladder() {
  const seq = [...PENTA_UP, ...PENTA_DOWN];
  const take = (k) => Array.from({ length: k }, (_, i) => seq[i % seq.length]);
  return [
    `:8 ${take(8).join(' ')}`,
    `:8 ${take(12).map((x) => tu(x)).join(' ')}`,
    `:16 ${take(16).join(' ')}`,
    `:16 ${take(24).map((x) => tu(x)).join(' ')}`,
  ];
}

// Mi minör pentatonik, açık pozisyon
const E_PENTA_OPEN = ['0.6', '3.6', '0.5', '2.5', '0.4', '2.4', '0.3', '2.3', '0.2', '3.2', '0.1', '3.1'];
const AM = '(0.5 2.4 2.3 1.2 0.1)';
const F = '(3.4 2.3 1.2 1.1)';

// Shuffle (boogie): bas teli `s`, perde `f`; üst telde f+2 / f+4, her vuruş triole "TAM-(sus)-ta"
function boogie(s, f) {
  const lo = `(${f}.${s} ${f + 2}.${s - 1})`;
  const hi = `(${f}.${s} ${f + 4}.${s - 1})`;
  return `:8 ${[lo, 'r', lo, lo, 'r', lo, hi, 'r', hi, lo, 'r', lo].map((x) => tu(x)).join(' ')}`;
}
// 12/8 ağır blues: dört grupta dörtlük + sekizlik (uzun-kısa)
function blues12(s, f) {
  const lo = `(${f}.${s} ${f + 2}.${s - 1})`;
  const hi = `(${f}.${s} ${f + 4}.${s - 1})`;
  return [lo, lo, hi, lo].map((x, i) => `:4 ${i % 2 ? x : accent(x)} :8 ${x}`).join(' ');
}
// Dörtlü dizi: her grup bir sonraki notadan başlar (8 grup = 32 nota)
const fours = (seq) => Array.from({ length: 8 }, (_, i) => seq.slice(i, i + 4)).flat();
// Gallop: her vuruşta sekizlik + iki onaltılık
const gallop = (beats) => beats.map((x) => `:8 ${x} :16 ${x} ${x}`).join(' ');
// Tel başına üç nota legato: her üçlünün ilk iki notası çekiç/çekme ile bağlı
const legato3 = (seq) => seq.map((x, i) => (i % 3 === 2 ? x : `${x}{h}`));
// Hicaz akorları (La ve Si bemol majör, 5. ve 6. perde)
const HA = '(5.6 7.5 6.3)';
const HBB = '(6.6 8.5 7.3)';
// 6/8 arpejleri (hemiola)
const AM_ARP6 = ['0.5', '2.4', '2.3', '1.2', '2.3', '2.4'];
const E_ARP6 = ['0.6', '2.5', '2.4', '1.3', '2.4', '2.5'];

const GUITAR = [
  {
    id: 'g-b1', level: 'baslangic', title: 'Açık teller',
    desc: 'Her açık teli dörtlük notayla dört kez çal. Hepsi aşağı vuruş; amaç metronomla tam birlikte olmak.',
    bpm: 60, min: 50, max: 100, prog: CLEAN,
    bars: [6, 5, 4, 3, 2, 1].map((s) => `:4 ${repeat([n(0, s)], 4).join(' ')}`),
  },
  {
    id: 'g-b2', level: 'baslangic', title: 'Kromatik 1-2-3-4',
    desc: 'Her telde 1, 2, 3 ve 4. perde, her parmak bir perde. Aşağı-yukarı (alternatif) penala, parmakları telin yakınında tut.',
    bpm: 60, min: 50, max: 110, prog: CLEAN,
    bars: bars(acrossStrings([1, 2, 3, 4]), 8, 8),
  },
  {
    id: 'g-b3', level: 'baslangic', title: 'Do majör gam',
    desc: 'Açık pozisyonda Do majör gamı çık ve in. Notaları söyleyerek çalmak gamı ezberlemeye yardım eder.',
    bpm: 70, min: 50, max: 120, prog: CLEAN,
    bars: [
      ':4 3.5 0.4 2.4 3.4', ':4 0.3 2.3 0.2 1.2',
      ':4 1.2 0.2 2.3 0.3', ':4 3.4 2.4 0.4 3.5',
    ],
  },
  {
    id: 'g-b4', level: 'baslangic', title: 'Power chord geçişleri',
    desc: 'E5, G5, A5 ve C5 güç akorları. Elin şeklini bozmadan sapta kaydır; geçişte ses kesilmesin.',
    bpm: 70, min: 50, max: 130, prog: DRIVE,
    bars: [E5, G5, A5, C5].map((ch) => `:4 ${repeat([ch], 4).join(' ')}`),
  },
  {
    id: 'g-b5', level: 'baslangic', title: 'Akor geçişleri: Em – C – G – D',
    desc: 'Her akora dört vuruş. Bir sonraki akora son vuruşta hazırlan, ilk vuruşa geç kalma.',
    bpm: 60, min: 40, max: 100, prog: CLEAN,
    bars: [EM, C, G, D].map((ch) => `:4 ${repeat([ch], 4).join(' ')}`),
  },
  {
    id: 'g-o1', level: 'orta', title: 'Kromatik onaltılık',
    desc: '1-2-3-4 kromatiği onaltılık notalarla. Penalama hep aşağı-yukarı; telden tele geçerken ritim bozulmasın.',
    bpm: 60, min: 50, max: 130, prog: CLEAN,
    bars: bars(acrossStrings([1, 2, 3, 4]), 16, 16),
  },
  {
    id: 'g-o2', level: 'orta', title: 'La minör pentatonik',
    desc: '5. perdedeki pentatonik kutuyu sekizliklerle çık ve in, sonunda kök notada (La) dur.',
    bpm: 80, min: 60, max: 150, prog: CLEAN,
    bars: [...bars([...PENTA_UP, ...PENTA_DOWN], 8, 8), ':1 5.6'],
  },
  {
    id: 'g-o3', level: 'orta', title: 'Triole arpejler',
    desc: 'Am, C, G ve E akorlarını teller üzerinde triole ile çal: her vuruşa üç eşit nota.',
    bpm: 60, min: 50, max: 110, prog: CLEAN,
    bars: [
      tripArp(['0.5', '2.4', '2.3', '1.2']),
      tripArp(['3.5', '2.4', '0.3', '1.2']),
      tripArp(['3.6', '0.4', '0.3', '0.2']),
      tripArp(['0.6', '2.5', '2.4', '1.3']),
    ],
  },
  {
    id: 'g-o4', level: 'orta', title: 'Hammer-on ve pull-off',
    desc: 'Pentatonik kutuda legato: ilk notayı penala, ikincisini yalnızca sol elle (çekiç ya da çekme) çıkar. İki nota eşit yükseklikte duyulsun.',
    bpm: 70, min: 50, max: 130, prog: DRIVE,
    bars: [legBar(6, 5), legBar(4, 3), legBar(2, 1)],
  },
  {
    id: 'g-o5', level: 'orta', title: 'Palm mute riff',
    desc: 'Sağ elin kenarı köprüye yakın tellere hafifçe değsin (palm mute); akorlarda eli kaldır. Sekizlikler eşit olsun.',
    bpm: 90, min: 70, max: 170, prog: DRIVE,
    bars: [
      `:8 ${repeat([pm(0, 6)], 6).join(' ')} ${G5} ${A5}`,
      `:8 ${repeat([pm(0, 6)], 6).join(' ')} ${A5} ${G5}`,
      `:8 ${repeat([pm(0, 6)], 6).join(' ')} ${G5} ${A5}`,
      `:8 ${repeat([pm(0, 6)], 4).join(' ')} ${C5} ${C5} ${B5} ${B5}`,
    ],
  },
  {
    id: 'g-i1', level: 'ileri', title: 'Kromatik 1-3-2-4',
    desc: 'Parmak bağımsızlığı için karışık sıra: çıkarken 1-3-2-4, inerken 4-2-3-1. Onaltılık, alternatif penalama.',
    bpm: 70, min: 60, max: 160, prog: CLEAN,
    bars: bars(acrossStrings([1, 3, 2, 4], [4, 2, 3, 1]), 16, 16),
  },
  {
    id: 'g-i2', level: 'ileri', title: 'Tel başına üç nota (Sol majör)',
    desc: '3/4 ölçüde altılık notalar: her vuruşa altı nota. Her telde üç nota olduğu için penalama yönü her telde değişir.',
    bpm: 60, min: 50, max: 130, prog: CLEAN, ts: [3, 4],
    bars: bars([...G3NPS, ...[...G3NPS].reverse()], 18, 16, 3),
  },
  {
    id: 'g-i3', level: 'ileri', title: 'Sweep arpej: Am – Dm – E',
    desc: 'Beş telli arpej: penayı tek hareketle aşağı, sonra yukarı süpür. Notalar birbirine karışmasın, çalınan telin dışındakileri sustur.',
    bpm: 50, min: 40, max: 110, prog: DRIVE,
    bars: [sweepBar('Am'), sweepBar('Dm'), sweepBar('Am'), sweepBar('E')],
  },
  {
    id: 'g-i4', level: 'ileri', title: 'Ritim merdiveni',
    desc: 'Aynı pentatonik dizi her ölçüde daha sık: sekizlik, triole, onaltılık, altılık. Tempo sabit kalır, yalnızca bölüm değişir.',
    bpm: 60, min: 50, max: 120, prog: CLEAN,
    bars: ladder(),
  },

  // ---- ek egzersizler (kimlikler eskilerden sonra gelir; eski kayıtlı tempolar etkilenmez)
  {
    id: 'g-b6', level: 'baslangic', title: 'Mi minör pentatonik (açık pozisyon)',
    desc: 'Açık tellerle Mi minör pentatonik: çık, in, kök notada (Mi) dur. Perdeye basan parmağı perde telinin hemen arkasına koy.',
    bpm: 70, min: 50, max: 140, prog: CLEAN,
    bars: [...bars([...E_PENTA_OPEN, ...[...E_PENTA_OPEN].reverse()], 8, 8), ':1 0.6'],
  },
  {
    id: 'g-b7', level: 'baslangic', title: 'Sekizlik vuruş: Am – F – C – G',
    desc: 'Her akora sekiz vuruş: aşağı-yukarı-aşağı-yukarı. El hiç durmadan sallanır, akor değişirken de ritim kesilmesin.',
    bpm: 70, min: 50, max: 130, prog: CLEAN,
    bars: [AM, F, C, G].map((ch) => `:8 ${repeat([ch], 8).join(' ')}`),
  },
  {
    id: 'g-b8', level: 'baslangic', title: 'Bas ve akor: G – C – D – Em',
    desc: 'Önce akorun bas notası, sonra üst teller; üçüncü vuruşta başka bir bas notası. Bas notaları biraz daha güçlü çal.',
    bpm: 70, min: 50, max: 130, prog: CLEAN,
    bars: [
      ':4 3.6 (0.4 0.3 0.2) 2.5 (0.4 0.3 0.2)',
      ':4 3.5 (0.3 1.2 0.1) 2.4 (0.3 1.2 0.1)',
      ':4 0.4 (2.3 3.2 2.1) 0.5 (2.3 3.2 2.1)',
      ':4 0.6 (0.3 0.2 0.1) 2.5 (0.3 0.2 0.1)',
    ],
  },
  {
    id: 'g-b9', level: 'baslangic', title: 'Kalın tel riffi',
    desc: 'Açık Mi teli ile perdeler arasında sekizlik riff. Hep aşağı penala, açık teli her seferinde net duyur.',
    bpm: 80, min: 60, max: 160, prog: DRIVE,
    bars: [
      ':8 0.6 0.6 3.6 0.6 5.6 0.6 3.6 2.6',
      ':8 0.6 0.6 3.6 0.6 5.6 0.6 7.6 5.6',
      ':8 0.6 0.6 3.6 0.6 5.6 0.6 3.6 2.6',
      ':8 0.6 0.6 3.6 0.6 (3.6 5.5) (3.6 5.5) (5.6 7.5) (5.6 7.5)',
    ],
  },
  {
    id: 'g-o6', level: 'orta', title: 'Blues shuffle: E – A – E – B',
    desc: 'Her vuruş üçe bölünür, ikinci parça sessiz: “TAM-ta”. Alttaki bas teli sabit, işaret ve yüzük parmağı 2. ile 4. perde arasında gidip gelir.',
    bpm: 80, min: 60, max: 150, prog: DRIVE,
    bars: [boogie(6, 0), boogie(5, 0), boogie(6, 0), boogie(5, 2)],
  },
  {
    id: 'g-o7', level: 'orta', title: 'Bend ve vibrato',
    desc: 'Sol tel 7. perdeyi bir ses (iki perde) yukarı it; çıkan sesin 9. perdeyle aynı olmasını dinle. Uzun notalarda vibrato yap.',
    bpm: 60, min: 50, max: 110, prog: DRIVE,
    bars: [
      ':4 7.3{b (0 4)} 9.3 7.3{b (0 4)} 9.3',
      ':4 8.2{b (0 4)} 10.2 :2 8.2{v}',
      ':4 7.3{b (0 4)} 9.3 7.3{b (0 4)} 9.3',
      ':4 7.3 5.3 7.4 :4 5.4{v}',
    ],
  },
  {
    id: 'g-o8', level: 'orta', title: 'Kaydırarak pozisyon değiştirme',
    desc: 'La minör gamda bir pozisyondan ötekine parmağı kaydırarak (slide) geç. Kayarken teli bırakma, varılan nota da net çıksın.',
    bpm: 70, min: 50, max: 130, prog: CLEAN,
    bars: [
      ':8 5.5 7.5 8.5 5.4 7.4{sl} 9.4 10.4 7.3',
      ':8 9.3 10.3{sl} 12.3 10.2 12.2 13.2{sl} 15.2 12.1',
      ':8 12.1 15.2 13.2{sl} 12.2 10.2 12.3 10.3{sl} 9.3',
      ':8 7.3 10.4 9.4{sl} 7.4 5.4 8.5 7.5 5.5',
    ],
  },
  {
    id: 'g-o9', level: 'orta', title: 'Parmakla arpej: C – Am – F – G',
    desc: 'Başparmak bas notasını, işaret-orta-yüzük parmakları üç ince teli çalar. Notalar birbirinin üstüne çınlasın, akoru bırakma.',
    bpm: 70, min: 50, max: 130, prog: CLEAN,
    bars: [
      ':8 3.5 0.3 1.2 0.1 1.2 0.3 1.2 0.3',
      ':8 0.5 2.3 1.2 0.1 1.2 2.3 1.2 2.3',
      ':8 3.4 2.3 1.2 1.1 1.2 2.3 1.2 2.3',
      ':8 3.6 0.3 0.2 3.1 0.2 0.3 0.2 0.3',
    ],
  },
  {
    id: 'g-o10', level: 'orta', title: 'Ara vuruşta akor (offbeat)',
    desc: 'Vuruşlarda sus, akoru yalnızca “ve”lerde kısa ve yukarı vuruşla çal. Metronomun tıkı senin sustuğun yere düşer.',
    bpm: 80, min: 60, max: 160, prog: CLEAN,
    bars: [AM, G, F, G].map((ch) => `:8 ${repeat(['r', ch], 4).join(' ')}`),
  },
  {
    id: 'g-i5', level: 'ileri', title: 'Tel atlama (pentatonik)',
    desc: 'Pentatonik kutuda her seferinde bir tel atlayarak çal: 6-4, 5-3, 4-2, 3-1. Atlanan teli sağ elinle sustur.',
    bpm: 70, min: 50, max: 150, prog: CLEAN,
    bars: [
      ':16 5.6 8.6 5.4 7.4 5.5 7.5 5.3 7.3 5.4 7.4 5.2 8.2 5.3 7.3 5.1 8.1',
      ':16 8.1 5.1 7.3 5.3 8.2 5.2 7.4 5.4 7.3 5.3 7.5 5.5 7.4 5.4 8.6 5.6',
    ],
  },
  {
    id: 'g-i6', level: 'ileri', title: 'Pentatonik dörtlü dizi',
    desc: 'Pentatonik kutuyu dörtlü gruplarla çık ve in: her grup bir nota ileriden başlar. Onaltılık, alternatif penalama.',
    bpm: 70, min: 50, max: 150, prog: CLEAN,
    bars: bars([...fours(PENTA_UP), ...fours(PENTA_DOWN)], 16, 16),
  },
  {
    id: 'g-i7', level: 'ileri', title: 'Gallop riff',
    desc: 'Her vuruşta bir sekizlik iki onaltılık: “TAM-ta-ta”. Palm mute ile, aşağı-aşağı-yukarı penala. Ölçü sonundaki akorlarda eli kaldır.',
    bpm: 80, min: 60, max: 170, prog: DRIVE,
    bars: [
      gallop(repeat([pm(0, 6)], 4)),
      gallop([...repeat([pm(0, 6)], 3), G5]),
      gallop(repeat([pm(0, 6)], 4)),
      gallop([pm(0, 6), pm(0, 6), A5, G5]),
    ],
  },
  {
    id: 'g-i8', level: 'ileri', title: 'Tel başına üç nota legato',
    desc: 'Sol majörde her telin ilk notasını penala, diğer ikisini çekiç (çıkarken) ya da çekme (inerken) ile çıkar. Triole, notalar eşit sesli.',
    bpm: 60, min: 50, max: 120, prog: DRIVE,
    bars: [...bars(legato3([...G3NPS, ...[...G3NPS].reverse()]), 12, 8, 3), ':1 3.6'],
  },
];

// ---------------------------------------------------------------- ölçü (zaman imzası) egzersizleri
// `level: 'olcu'` ayrı sekmede görünür, zorluk `diff`'te. x/8 ölçülerde `tempo: 50` (yukarıda).
const EIGHTH = 50;

const GUITAR_TS = [
  {
    id: 'g-t1', diff: 'baslangic', title: '3/4: Vals', ts: [3, 4],
    desc: 'Ölçüde üç vuruş: önce bas notası (vurgulu), sonra iki akor. “BİR-iki-üç” diye sayarak çal.',
    bpm: 90, min: 60, max: 160, prog: CLEAN,
    bars: [
      gBar(4, [3], ['0.5', '(2.4 2.3 1.2)', '(2.4 2.3 1.2)'], { label: '1-2-3' }),
      gBar(4, [3], ['0.4', '(2.3 3.2 1.1)', '(2.3 3.2 1.1)']),
      gBar(4, [3], ['0.6', '(2.5 2.4 1.3)', '(2.5 2.4 1.3)']),
      gBar(4, [3], ['0.5', '(2.4 2.3 1.2)', '(2.4 2.3 1.2)']),
    ],
  },
  {
    id: 'g-t2', diff: 'baslangic', title: '4/4: Bir ve üçte vurgu', ts: [4, 4],
    desc: 'Dört dörtlük vuruş, sekizlik power chord. 1. ve 3. vuruş vurgulu, aradakiler daha hafif: “BİR-ve-iki-ve-ÜÇ-ve-dört-ve”.',
    bpm: 80, min: 60, max: 160, prog: DRIVE,
    bars: [E5, G5, A5, C5].map((ch, i) => gBar(8, [4, 4], repeat([ch], 8), { label: i ? '' : '4+4' })),
  },
  {
    id: 'g-t3', diff: 'baslangic', title: '6/8: İki büyük vuruş', ts: [6, 8], tempo: EIGHTH,
    desc: 'Altı sekizlik, iki gruba ayrılır: 1-2-3 4-5-6. 1. ve 4. sekizlik vurgulu; ölçüyü iki büyük vuruş gibi hisset.',
    bpm: 120, min: 90, max: 220, prog: CLEAN,
    bars: [
      ['0.6', '2.4', '0.3', '0.2', '0.3', '2.4'],
      ['3.5', '2.4', '0.3', '1.2', '0.3', '2.4'],
      ['3.6', '0.4', '0.3', '0.2', '0.3', '0.4'],
      ['0.4', '2.3', '3.2', '2.1', '3.2', '2.3'],
    ].map((x, i) => gBar(8, [3, 3], x, { label: i ? '' : '3+3' })),
  },
  {
    id: 'g-t4', diff: 'orta', title: '5/4: 3 + 2', ts: [5, 4],
    desc: 'Beş dörtlük vuruş, 3 + 2 diye gruplanır: “BİR-iki-üç DÖRT-beş”. Son ikiyi kısaltma, beşinci vuruşu tam say.',
    bpm: 90, min: 60, max: 160, prog: DRIVE,
    bars: [
      gBar(4, [3, 2], ['0.5', '3.5', '5.5', '3.5', '0.5'], { label: '3+2' }),
      gBar(4, [3, 2], ['0.5', '3.5', '5.5', '7.5', '5.5']),
      gBar(4, [3, 2], ['0.5', '3.5', '5.5', '3.5', '0.5']),
      gBar(4, [3, 2], ['(0.5 2.4)', '(0.5 2.4)', '(0.5 2.4)', '(3.5 5.4)', '(5.5 7.4)']),
    ],
  },
  {
    id: 'g-t5', diff: 'orta', title: '5/8: 3 + 2', ts: [5, 8], tempo: EIGHTH,
    desc: 'Beş sekizlik: üçlü grup, sonra ikili grup. “BİR-iki-üç DÖRT-beş”; ölçü 4/4’ten kısa, ikinci grup hemen gelir.',
    bpm: 140, min: 100, max: 240, prog: DRIVE,
    bars: [
      gBar(8, [3, 2], ['0.6', '0.6', '3.6', '0.6', '2.6'], { label: '3+2' }),
      gBar(8, [3, 2], ['0.6', '0.6', '3.6', '5.6', '3.6']),
      gBar(8, [3, 2], ['0.6', '0.6', '3.6', '0.6', '2.6']),
      gBar(8, [3, 2], [E5, E5, E5, G5, A5]),
    ],
  },
  {
    id: 'g-t6', diff: 'orta', title: '5/8: 2 + 3', ts: [5, 8], tempo: EIGHTH,
    desc: 'Aynı beş sekizlik, bu kez önce ikili grup: “BİR-iki ÜÇ-dört-beş”. Vurgunun yeri değişince ritim bambaşka duyulur.',
    bpm: 140, min: 100, max: 240, prog: DRIVE,
    bars: [
      gBar(8, [2, 3], ['5.6', '8.6', '5.5', '7.5', '5.5'], { label: '2+3' }),
      gBar(8, [2, 3], ['5.6', '8.6', '7.5', '5.5', '7.4']),
      gBar(8, [2, 3], ['5.4', '7.4', '5.3', '7.3', '5.3']),
      gBar(8, [2, 3], [A5, A5, C5, C5, G5]),
    ],
  },
  {
    id: 'g-t7', diff: 'orta', title: '7/8: 2 + 2 + 3', ts: [7, 8], tempo: EIGHTH,
    desc: 'Yedi sekizlik: iki, iki, üç. “BİR-iki ÜÇ-dört BEŞ-altı-yedi”. Uzun grup sonda; sayarken son grupta acele etme.',
    bpm: 140, min: 100, max: 240, prog: DRIVE,
    bars: [
      gBar(8, [2, 2, 3], ['0.5', '3.5', '0.5', '3.5', '0.5', '2.5', '3.5'], { label: '2+2+3' }),
      gBar(8, [2, 2, 3], ['5.5', '3.5', '2.5', '0.5', '3.6', '0.6', '0.5']),
      gBar(8, [2, 2, 3], ['0.5', '3.5', '0.5', '3.5', '0.5', '2.5', '3.5']),
      gBar(8, [2, 2, 3], [A5, A5, C5, C5, G5, G5, G5]),
    ],
  },
  {
    id: 'g-t8', diff: 'ileri', title: '7/8: 3 + 2 + 2', ts: [7, 8], tempo: EIGHTH,
    desc: 'Yedi sekizlik, bu kez uzun grup başta: “BİR-iki-üç DÖRT-beş ALTI-yedi”. Türk müziğinde devr-i hindî usulü bu gruplamadır.',
    bpm: 130, min: 100, max: 240, prog: CLEAN,
    bars: [
      gBar(8, [3, 2, 2], ['0.4', '3.4', '5.4', '3.4', '0.4', '3.3', '2.3'], { label: '3+2+2' }),
      gBar(8, [3, 2, 2], ['0.4', '3.4', '5.4', '7.4', '5.4', '3.4', '0.4']),
      gBar(8, [3, 2, 2], ['0.5', '3.5', '5.5', '3.5', '0.5', '3.4', '0.4']),
      gBar(8, [3, 2, 2], ['(0.4 2.3)', '(0.4 2.3)', '(0.4 2.3)', '(3.5 5.4)', '(3.5 5.4)', '(0.5 2.4)', '(0.5 2.4)']),
    ],
  },
  {
    id: 'g-t9', diff: 'ileri', title: '9/8 aksak: 2 + 2 + 2 + 3', ts: [9, 8], tempo: EIGHTH,
    desc: 'Dokuz sekizlik aksak usul (karşılama, roman havası): üç ikili grup ve sonda bir üçlü. La hicaz dizisinde çık ve in.',
    bpm: 150, min: 100, max: 240, prog: CLEAN,
    bars: [
      gBar(8, [2, 2, 2, 3], ['5.6', '6.6', '4.5', '5.5', '7.5', '8.5', '5.4', '7.4', '5.4'], { label: '2+2+2+3' }),
      gBar(8, [2, 2, 2, 3], ['7.4', '5.4', '8.5', '7.5', '5.5', '4.5', '6.6', '5.6', '5.6']),
      gBar(8, [2, 2, 2, 3], [HA, '5.6', HA, '5.6', HA, '5.6', HBB, '6.6', '6.6']),
      gBar(8, [2, 2, 2, 3], [HA, '5.6', HA, '5.6', HBB, '6.6', HA, '5.6', '5.6']),
    ],
  },
  {
    id: 'g-t10', diff: 'orta', title: '12/8: Ağır blues', ts: [12, 8], tempo: EIGHTH,
    desc: 'On iki sekizlik, dört üçlü grup: her grupta uzun-kısa (“TAAM-ta”). Ölçüyü dört ağır vuruş gibi hisset; metronom her sekizliği tıklar.',
    bpm: 120, min: 90, max: 220, prog: DRIVE,
    bars: [blues12(6, 0), blues12(5, 0), blues12(6, 0), blues12(5, 2)],
  },
  {
    id: 'g-t11', diff: 'ileri', title: '6/8’de hemiola: 3 + 3 ve 2 + 2 + 2', ts: [6, 8], tempo: EIGHTH,
    desc: 'Aynı altı sekizlik iki türlü gruplanır: önce 3 + 3 (iki vuruş), sonra 2 + 2 + 2 (üç vuruş). Notalar aynı, yalnızca vurgu yer değiştirir.',
    bpm: 120, min: 90, max: 220, prog: CLEAN,
    bars: [
      gBar(8, [3, 3], AM_ARP6, { label: '3+3' }),
      gBar(8, [2, 2, 2], AM_ARP6, { label: '2+2+2' }),
      gBar(8, [3, 3], E_ARP6, { label: '3+3' }),
      gBar(8, [2, 2, 2], E_ARP6, { label: '2+2+2' }),
    ],
  },
  {
    id: 'g-t12', diff: 'ileri', title: 'Ölçü değişimi: 3/4 – 4/4 – 5/4', tsLabel: '3/4 · 4/4 · 5/4',
    desc: 'Her ölçünün vuruş sayısı değişir: üç, dört, beş, dört. Her ölçünün ilk vuruşu vurgulu; ölçü başlarında sayıyı baştan başlat.',
    bpm: 90, min: 60, max: 160, prog: DRIVE,
    bars: [
      gBar(4, [3], repeat([E5], 3), { ts: [3, 4], label: '3' }),
      gBar(4, [4], repeat([G5], 4), { ts: [4, 4], label: '4' }),
      gBar(4, [5], repeat([A5], 5), { ts: [5, 4], label: '5' }),
      gBar(4, [4], repeat([G5], 4), { ts: [4, 4], label: '4' }),
    ],
  },
  {
    id: 'g-t13', diff: 'ileri', title: 'Ölçü değişimi: 5/8 – 7/8', tsLabel: '5/8 · 7/8', tempo: EIGHTH,
    desc: 'Beş sekizlik (3 + 2) ile yedi sekizlik (2 + 2 + 3) sırayla. Sekizlikler hep eşit; yalnızca ölçünün uzunluğu değişir.',
    bpm: 130, min: 100, max: 240, prog: DRIVE,
    bars: [
      gBar(8, [3, 2], ['0.6', '0.6', '3.6', '0.6', '5.6'], { ts: [5, 8], label: '3+2' }),
      gBar(8, [2, 2, 3], ['0.6', '3.6', '0.6', '5.6', '0.6', '7.6', '5.6'], { ts: [7, 8], label: '2+2+3' }),
      gBar(8, [3, 2], ['0.6', '0.6', '3.6', '0.6', '5.6'], { ts: [5, 8], label: '3+2' }),
      gBar(8, [2, 2, 3], [E5, E5, G5, G5, A5, A5, A5], { ts: [7, 8], label: '2+2+3' }),
    ],
  },
];

// ---------------------------------------------------------------- davul
const K = 'kickhit';
const S = 'snarehit';
const H = 'hihatclosed';
const RD = 'ridemiddle';
const CR = 'crashhighhit';
const T1 = 'hightomhit';
const T2 = 'lowtomhit';
const FT = 'lowfloortomhit'; // GP adları yanıltıcı: highfloortomhit en tiz tom (MIDI 50)
const HO = 'hihatopen';
const HP = 'pedalhihathit'; // ayakla hi-hat
const hit = (...xs) => (xs.length > 1 ? `(${xs.join(' ')})` : xs[0]);

// Sekizlik hi-hat üzerinde kick (k) ve trampet (s) konumları (0–7); `open`daki konumlarda açık hi-hat
function rock8(kicks, { top = H, crash = false, snares = [2, 6], open = [] } = {}) {
  return `:8 ${Array.from({ length: 8 }, (_, i) => {
    const parts = [];
    if (kicks.includes(i)) parts.push(K);
    if (snares.includes(i)) parts.push(S);
    parts.push(crash && i === 0 ? CR : open.includes(i) ? HO : top);
    return hit(...parts);
  }).join(' ')}`;
}

const sn = (txt, accent = false) => `${S}{${accent ? 'ac ' : ''}txt "${txt}"}`;
const paradiddle = ['R', 'L', 'R', 'R', 'L', 'R', 'L', 'L'];

// Onaltılık ızgara: sekizlik hi-hat, kick ve trampet konumları (0–15), boş yerde sus
function groove16(kicks, { snares = [4, 12], crash = false } = {}) {
  return `:16 ${Array.from({ length: 16 }, (_, i) => {
    const parts = [];
    if (kicks.includes(i)) parts.push(K);
    if (snares.includes(i)) parts.push(S);
    if (i % 2 === 0) parts.push(crash && i === 0 ? CR : H);
    return parts.length ? hit(...parts) : 'r';
  }).join(' ')}`;
}
// Flam: küçük nota vuruşun üstünde (asıl notadan pay alır, ölçü süresi değişmez), asıl nota vurgulu
const flam = (x, dur) => `:8 ${S}{gr ob} :${dur} ${sn(x, true)}`;
// Swing ride: “ding, ding-ga”; ayak hi-hat 2 ve 4’te, istenirse kick 1 ve 3’te
function swing(kick) {
  const one = kick ? hit(K, RD) : RD;
  return `:8 ${[one, 'r', 'r', hit(RD, HP), 'r', RD, one, 'r', 'r', hit(RD, HP), 'r', RD].map((x) => tu(x)).join(' ')}`;
}

const DRUMS = [
  {
    id: 'd-b1', level: 'baslangic', title: 'Dörtlük ritim',
    desc: 'Her vuruşta hi-hat; 1 ve 3’te kick, 2 ve 4’te trampet. Elleri ve ayağı aynı anda vurmaya odaklan.',
    bpm: 70, min: 50, max: 120,
    bars: repeat([`:4 ${hit(K, H)} ${hit(S, H)} ${hit(K, H)} ${hit(S, H)}`], 4),
  },
  {
    id: 'd-b2', level: 'baslangic', title: 'Temel rock ritmi',
    desc: 'Sekizlik hi-hat, 1 ve 3’te kick, 2 ve 4’te trampet. İlk ölçüde crash. Hi-hat vuruşları eşit sesli olsun.',
    bpm: 80, min: 60, max: 140,
    bars: [rock8([0, 4], { crash: true }), rock8([0, 4]), rock8([0, 4]), rock8([0, 4])],
  },
  {
    id: 'd-b3', level: 'baslangic', title: 'Trampet: dörtlük, sekizlik, onaltılık',
    desc: 'Trampette sağ-sol sırayla: önce dörtlük, sonra sekizlik, sonra onaltılık. Tempo değişmez, yalnızca vuruşlar sıklaşır.',
    bpm: 60, min: 50, max: 110,
    bars: [
      `:4 ${['R', 'L', 'R', 'L'].map((x) => sn(x)).join(' ')}`,
      `:8 ${repeat(['R', 'L'], 4).map((x) => sn(x)).join(' ')}`,
      `:16 ${repeat(['R', 'L'], 8).map((x) => sn(x)).join(' ')}`,
      `:8 ${repeat(['R', 'L'], 4).map((x) => sn(x)).join(' ')}`,
    ],
  },
  {
    id: 'd-b4', level: 'baslangic', title: 'Ride ziliyle ritim',
    desc: 'Temel rock ritmi, bu kez hi-hat yerine ride zilinde. Zilin ortasına vur, çubuğu sektir.',
    bpm: 80, min: 60, max: 140,
    bars: [rock8([0, 4], { top: RD, crash: true }), rock8([0, 4], { top: RD }), rock8([0, 4], { top: RD }), rock8([0, 4], { top: RD })],
  },
  {
    id: 'd-o1', level: 'orta', title: 'Onaltılık hi-hat',
    desc: 'Hi-hat onaltılık (tek elle ya da iki elle), 1 ve 3’te kick, 3’ün “ve”sinde bir kick daha, 2 ve 4’te trampet.',
    bpm: 70, min: 50, max: 110,
    bars: repeat([`:16 ${[
      hit(K, H), H, H, H,
      hit(S, H), H, H, H,
      hit(K, H), H, hit(K, H), H,
      hit(S, H), H, H, H,
    ].join(' ')}`], 4),
  },
  {
    id: 'd-o2', level: 'orta', title: 'Kick çeşitlemeleri',
    desc: 'Her ölçüde kick başka yerde: önce 1-3, sonra 3’ün “ve”si, 1’in “ve”si, 2’nin “ve”si. Eller hiç değişmez.',
    bpm: 80, min: 60, max: 140,
    bars: [rock8([0, 4]), rock8([0, 4, 5]), rock8([0, 1, 4]), rock8([0, 3, 4])],
  },
  {
    id: 'd-o3', level: 'orta', title: 'Tom fill',
    desc: 'Üç ölçü ritim, dördüncü ölçüde onaltılık fill: trampet, tiz tom, orta tom, yer tomu. Döngü başında crash ile ritme dön.',
    bpm: 80, min: 60, max: 130,
    bars: [
      rock8([0, 4], { crash: true }), rock8([0, 4]), rock8([0, 4]),
      `:16 ${[...repeat([S], 4), ...repeat([T1], 4), ...repeat([T2], 4), ...repeat([FT], 4)].join(' ')}`,
    ],
  },
  {
    id: 'd-o4', level: 'orta', title: 'Shuffle (triole)',
    desc: 'Her vuruş üçe bölünür, hi-hat birinci ve üçüncüde: “TA-a-TA”. 1 ve 3’te kick, 2 ve 4’te trampet.',
    bpm: 80, min: 60, max: 140,
    bars: repeat([`:8 ${[
      hit(K, H), 'r', H,
      hit(S, H), 'r', H,
      hit(K, H), 'r', H,
      hit(S, H), 'r', H,
    ].map((x) => tu(x)).join(' ')}`], 4),
  },
  {
    id: 'd-i1', level: 'ileri', title: 'Paradiddle (RLRR LRLL)',
    desc: 'Sağ-sol-sağ-sağ, sol-sağ-sol-sol. Grubun ilk vuruşu vurgulu, diğerleri alçak. Son iki ölçüde ayak dörtlük kick ile eşlik eder.',
    bpm: 60, min: 50, max: 140,
    bars: [
      ...repeat([`:16 ${repeat(paradiddle, 2).map((x, i) => sn(x, i % 4 === 0)).join(' ')}`], 2),
      ...repeat([`:16 ${repeat(paradiddle, 2).map((x, i) => (i % 4 === 0 ? `(${sn(x, true)} ${K})` : sn(x))).join(' ')}`], 2),
    ],
  },
  {
    id: 'd-i2', level: 'ileri', title: 'Ghost note groove',
    desc: 'Küçük notalar “ghost”: trampete çok hafif, neredeyse duyulmadan dokun. Vurgulu 2 ve 4 ile aradaki fark büyük olsun.',
    bpm: 70, min: 50, max: 110,
    bars: repeat([`:16 ${[
      hit(K, H), 'r', H, `${S}{g}`,
      hit(`${S}{ac}`, H), 'r', H, `${S}{g}`,
      hit(K, H), K, H, `${S}{g}`,
      hit(`${S}{ac}`, H), `${S}{g}`, H, 'r',
    ].join(' ')}`], 4),
  },
  {
    id: 'd-i3', level: 'ileri', title: 'Altılık tom fill',
    desc: 'Bir ölçü ritim, bir ölçü altılık fill: her vuruşa altı nota, trampetten yer tomuna inerek. Fill sonunda tempoyu kaçırma.',
    bpm: 60, min: 50, max: 110,
    bars: [
      rock8([0, 4], { crash: true }),
      `:16 ${[S, T1, T2, FT].flatMap((d) => repeat([d], 6)).map((x) => tu(x)).join(' ')}`,
    ],
  },
  {
    id: 'd-i4', level: 'ileri', title: 'Çift pedal onaltılık',
    desc: 'Kick sürekli onaltılık (çift pedal ya da iki ayak), ride dörtlük, 2 ve 4’te trampet. Ayaklar eşit sesli olsun.',
    bpm: 80, min: 60, max: 170,
    bars: repeat([`:16 ${[
      hit(K, RD), K, K, K,
      hit(K, S, RD), K, K, K,
      hit(K, RD), K, K, K,
      hit(K, S, RD), K, K, K,
    ].join(' ')}`], 4),
  },

  // ---- ek egzersizler (kimlikler eskilerden sonra gelir; eski kayıtlı tempolar etkilenmez)
  {
    id: 'd-b5', level: 'baslangic', title: 'Çift vuruş (RRLL)',
    desc: 'Her elle iki vuruş: sağ-sağ-sol-sol. İkinci vuruş birincisi kadar güçlü olsun; önce sekizlik, sonra onaltılık.',
    bpm: 60, min: 50, max: 110,
    bars: [
      ...repeat([`:8 ${repeat(['R', 'R', 'L', 'L'], 2).map((x) => sn(x)).join(' ')}`], 2),
      ...repeat([`:16 ${repeat(['R', 'R', 'L', 'L'], 4).map((x) => sn(x)).join(' ')}`], 2),
    ],
  },
  {
    id: 'd-b6', level: 'baslangic', title: 'Tom turu',
    desc: 'Trampetten yer tomuna kadar her davula sırayla vur, sonra geri dön: önce dörtlük, sonra sekizlik. Kollar davullar arasında rahat dolaşsın, vuruşlar eşit sesli.',
    bpm: 70, min: 50, max: 130,
    bars: [
      `:4 ${S} ${T1} ${T2} ${FT}`, `:4 ${FT} ${T2} ${T1} ${S}`,
      `:8 ${[S, T1, T2, FT].flatMap((d) => [d, d]).join(' ')}`,
      `:8 ${[FT, T2, T1, S].flatMap((d) => [d, d]).join(' ')}`,
    ],
  },
  {
    id: 'd-b7', level: 'baslangic', title: 'Dans ritmi (her vuruşta kick)',
    desc: 'Her vuruşta kick, 2 ve 4’te trampet. Hi-hat vuruşlarda kapalı, aradaki “ve”lerde açık; açık ses kısa ve net olsun.',
    bpm: 80, min: 60, max: 140,
    bars: [true, false, false, false].map((crash) => `:8 ${Array.from({ length: 8 }, (_, i) => {
      if (i % 2) return HO;
      return hit(K, ...(i === 2 || i === 6 ? [S] : []), crash && i === 0 ? CR : H);
    }).join(' ')}`),
  },
  {
    id: 'd-b8', level: 'baslangic', title: 'Sekizlik fill ve crash',
    desc: 'Üç ölçü temel rock ritmi, dördüncü ölçüde sekizlik fill: trampet, tiz tom, orta tom, yer tomu ikişer. Döngü başında crash ve kick ile ritme dön.',
    bpm: 70, min: 50, max: 130,
    bars: [
      rock8([0, 4], { crash: true }), rock8([0, 4]), rock8([0, 4]),
      `:8 ${[S, T1, T2, FT].flatMap((d) => [d, d]).join(' ')}`,
    ],
  },
  {
    id: 'd-b9', level: 'baslangic', title: 'Vurgu: vuruşta ve arada',
    desc: 'Trampette sekizlik, sağ-sol sırayla. Önce vuruşlar (1, 2, 3, 4) vurgulu, sonra aradaki “ve”ler. Vurgusuz notalar alçaktan ve eşit sesli.',
    bpm: 70, min: 50, max: 130,
    bars: [0, 0, 1, 1].map((k) => `:8 ${repeat(['R', 'L'], 4).map((x, i) => sn(x, i % 2 === k)).join(' ')}`),
  },
  {
    id: 'd-o5', level: 'orta', title: 'Yarım zaman (half-time)',
    desc: 'Trampet yalnızca 3. vuruşta, kick 1’de ve 2’nin “ve”sinde. Tempo aynı ama ritim yarı hızda gibi ağır duyulur; hi-hat sekizlik ve düzenli.',
    bpm: 80, min: 60, max: 150,
    bars: [
      rock8([0, 3], { snares: [4], crash: true }), rock8([0, 3], { snares: [4] }),
      rock8([0, 3], { snares: [4] }), rock8([0, 3, 7], { snares: [4] }),
    ],
  },
  {
    id: 'd-o6', level: 'orta', title: 'Açık hi-hat',
    desc: 'Temel rock ritminde hi-hat 2’nin ve 4’ün “ve”sinde açılır, sonraki vuruşta ayakla kapanır. Açık ses tam bir sekizlik sürsün, ne kısa ne uzun.',
    bpm: 80, min: 60, max: 140,
    bars: [
      rock8([0, 4], { crash: true, open: [3, 7] }), rock8([0, 4], { open: [3, 7] }),
      rock8([0, 4, 5], { open: [3, 7] }), rock8([0, 4], { open: [3, 7] }),
    ],
  },
  {
    id: 'd-o7', level: 'orta', title: 'Onaltılık kick',
    desc: 'Hi-hat sekizlik, 2 ve 4’te trampet; kick onaltılığın ara yerlerinde (“e” ve “a”). Her ölçüde kick başka yerde; önce “bir-e-ve-a” diye sayarak yavaş çal.',
    bpm: 70, min: 50, max: 120,
    bars: [groove16([0, 3, 8], { crash: true }), groove16([0, 7, 8]), groove16([0, 8, 11]), groove16([0, 3, 8, 11])],
  },
  {
    id: 'd-o8', level: 'orta', title: 'Swing ride (caz)',
    desc: 'Ride’da “ding, ding-ga, ding, ding-ga”: her vuruş üçe bölünür, 2 ve 4’te üçüncü parçaya da vurulur. Ayak hi-hat 2 ve 4’te kapanır; son iki ölçüde kick 1 ve 3’te hafifçe eklenir.',
    bpm: 90, min: 60, max: 200,
    bars: [swing(false), swing(false), swing(true), swing(true)],
  },
  {
    id: 'd-o9', level: 'orta', title: 'Yarım ölçü fill',
    desc: 'İki vuruş ritim, iki vuruş onaltılık fill (sağ-sol sırayla). Fill’den sonra bir sonraki ölçünün 1’ine crash ve kick ile tam otur.',
    bpm: 70, min: 50, max: 130,
    bars: [
      rock8([0, 4], { crash: true }),
      `:8 ${hit(K, H)} ${H} ${hit(S, H)} ${H} :16 ${[S, S, T1, T1, T2, T2, FT, FT].join(' ')}`,
      rock8([0, 4], { crash: true }),
      `:8 ${hit(K, H)} ${H} ${hit(S, H)} ${H} :16 ${[S, S, S, S, T2, T2, FT, FT].join(' ')}`,
    ],
  },
  {
    id: 'd-o10', level: 'orta', title: 'Flam ve flam tap',
    desc: 'Flam: küçük nota alçaktan, asıl nota yüksekten neredeyse aynı anda; iki ayrı vuruş değil, kalın tek bir ses gibi. Önce dörtlükte eller sırayla, sonra flam tap (lR R, rL L).',
    bpm: 60, min: 40, max: 110,
    bars: [
      ...repeat([['R', 'L', 'R', 'L'].map((x) => flam(x, 4)).join(' ')], 2),
      ...repeat([['R', 'L', 'R', 'L'].map((x) => `${flam(x, 8)} ${sn(x)}`).join(' ')], 2),
    ],
  },
  {
    id: 'd-i5', level: 'ileri', title: 'Lineer groove',
    desc: 'Hiçbir uzuv bir başkasıyla aynı anda vurmaz: hi-hat, kick ve trampet sırayla. Onaltılık; 2 ve 4’te vurgulu trampet, aradakiler ghost.',
    bpm: 70, min: 50, max: 120,
    bars: [
      ...repeat([`:16 ${[K, H, H, `${S}{g}`, `${S}{ac}`, H, K, H, K, H, H, `${S}{g}`, `${S}{ac}`, H, K, H].join(' ')}`], 3),
      `:16 ${[K, H, H, `${S}{g}`, `${S}{ac}`, H, K, H, K, H, `${S}{g}`, K, `${S}{ac}`, T1, T2, FT].join(' ')}`,
    ],
  },
  {
    id: 'd-i6', level: 'ileri', title: 'Yarım zaman shuffle',
    desc: 'Triole üzerinde hi-hat “TA-a-TA”, aradaki boşluklarda trampete ghost; 3. vuruşta vurgulu trampet. Ghost notalar çok hafif, hi-hat düzenli.',
    bpm: 70, min: 50, max: 120,
    bars: repeat([`:8 ${[
      hit(K, H), `${S}{g}`, H,
      H, `${S}{g}`, hit(K, H),
      hit(`${S}{ac}`, H), 'r', H,
      H, `${S}{g}`, hit(K, H),
    ].map((x) => fx(x, 'tu 3')).join(' ')}`], 4),
  },
  {
    id: 'd-i7', level: 'ileri', title: 'Altılık rulo (six stroke roll)',
    desc: 'R-LL-RR-L: tek, iki çift, tek. İlk ve son vuruş vurgulu, çiftler alçak. Her vuruşa altı nota; son iki ölçüde ayak dörtlük kick ile eşlik eder.',
    bpm: 50, min: 40, max: 100,
    bars: [false, false, true, true].map((kick) => `:16 ${repeat(['R', 'L', 'L', 'R', 'R', 'L'], 4)
      .map((x, i) => {
        const s = sn(x, i % 6 === 0 || i % 6 === 5);
        return fx(kick && i % 6 === 0 ? `(${s} ${K})` : s, 'tu 3');
      }).join(' ')}`),
  },
  {
    id: 'd-i8', level: 'ileri', title: 'Çift pedal gallop',
    desc: 'Kick her vuruşta bir sekizlik iki onaltılık: “TAM-ta-ta”. Ride dörtlük, 2 ve 4’te trampet, ilk vuruşta crash. Ayaklar eşit sesli ve tempoda.',
    bpm: 80, min: 60, max: 170,
    bars: [true, false, false, false].map((crash) => [0, 1, 2, 3]
      .map((b) => `:8 ${hit(K, ...(b % 2 ? [S] : []), crash && b === 0 ? CR : RD)} :16 ${K} ${K}`).join(' ')),
  },
];

// Ölçü egzersizleri: hi-hat sekizlik, grup başlarında kick, aradaki gruplarda trampet; istenirse
// ilk vuruşun üstüne grup yazısı
function meterGroove(groups, { crash = false, label = '' } = {}) {
  const starts = [];
  let i = 0;
  for (const g of groups) { starts.push(i); i += g; }
  return `:8 ${Array.from({ length: i }, (_, k) => {
    const g = starts.indexOf(k);
    const parts = [];
    if (g >= 0) parts.push(g % 2 ? `${S}{ac}` : K);
    parts.push(crash && k === 0 ? CR : H);
    const b = hit(...parts);
    return label && k === 0 ? `${b}{txt "${label}"}` : b;
  }).join(' ')}`;
}

const DRUMS_TS = [
  {
    id: 'd-t1', diff: 'baslangic', title: '3/4: Vals', ts: [3, 4],
    desc: '1’de kick, 2 ve 3’te trampet, her vuruşta hi-hat: “BUM-ça-ça”. Kick vurgulu, trampetler hafif.',
    bpm: 90, min: 60, max: 180,
    bars: [
      `:4 ${hit(K, CR)} ${hit(S, H)} ${hit(S, H)}`,
      ...repeat([`:4 ${hit(K, H)} ${hit(S, H)} ${hit(S, H)}`], 3),
    ],
  },
  {
    id: 'd-t2', diff: 'baslangic', title: '6/8: Ağır groove', ts: [6, 8], tempo: EIGHTH,
    desc: 'Altı sekizlik hi-hat; 1. sekizlikte kick, 4.’de trampet. Ölçüyü iki büyük vuruş gibi hisset: 1-2-3 4-5-6.',
    bpm: 120, min: 90, max: 220,
    bars: [meterGroove([3, 3], { crash: true }), ...repeat([meterGroove([3, 3])], 3)],
  },
  {
    id: 'd-t3', diff: 'orta', title: '5/4: 3 + 2', ts: [5, 4],
    desc: 'Beş dörtlük vuruş, sekizlik hi-hat. 1’de kick, 2’de trampet; 4’te kick, 5’te trampet. “BİR-iki-üç DÖRT-beş”.',
    bpm: 90, min: 60, max: 160,
    bars: repeat([`:8 ${[
      hit(K, H), H, hit(S, H), H, H, H,
      hit(K, H), H, hit(S, H), H,
    ].join(' ')}`], 4),
  },
  {
    id: 'd-t4', diff: 'orta', title: '7/8: 2 + 2 + 3', ts: [7, 8], tempo: EIGHTH,
    desc: 'Yedi sekizlik hi-hat. Grup başlarında sırayla kick, trampet, kick: “BUM-ta TAK-ta BUM-ta-ta”. Son grup bir sekizlik uzun.',
    bpm: 140, min: 100, max: 240,
    bars: [meterGroove([2, 2, 3], { crash: true }), ...repeat([meterGroove([2, 2, 3])], 3)],
  },
  {
    id: 'd-t5', diff: 'ileri', title: '9/8 aksak: 2 + 2 + 2 + 3', ts: [9, 8], tempo: EIGHTH,
    desc: 'Dokuz sekizlik aksak usul (karşılama): “BUM-ta TAK-ta BUM-ta TAK-ta-ta”. Grup başlarında sırayla kick ve trampet, son grup bir sekizlik uzun.',
    bpm: 150, min: 100, max: 240,
    bars: [meterGroove([2, 2, 2, 3], { crash: true }), ...repeat([meterGroove([2, 2, 2, 3])], 3)],
  },
  {
    id: 'd-t6', diff: 'ileri', title: 'Ölçü değişimi: 4/4 – 7/8', tsLabel: '4/4 · 7/8', tempo: EIGHTH,
    desc: 'Bir ölçü 4/4 rock ritmi, bir ölçü 7/8 (2 + 2 + 3). Metronom hep sekizlik tıklar; 7/8 ölçüsü 4/4’ten bir sekizlik kısa.',
    bpm: 140, min: 100, max: 240,
    bars: [
      `\\ts 4 4 ${rock8([0, 4], { crash: true })}`, `\\ts 7 8 ${meterGroove([2, 2, 3])}`,
      `\\ts 4 4 ${rock8([0, 4])}`, `\\ts 7 8 ${meterGroove([2, 2, 3])}`,
    ],
  },

  // ---- ek ölçü egzersizleri (gitardaki ölçülerin davuldaki karşılıkları)
  {
    id: 'd-t7', diff: 'baslangic', title: '4/4: Vuruşları say', ts: [4, 4],
    desc: 'Dört dörtlük vuruş, sekizlik hi-hat. Vuruşlardaki hi-hat vurgulu, aradakiler hafif: “BİR-ve-İKİ-ve-ÜÇ-ve-DÖRT-ve”. 1 ve 3’te kick, 2 ve 4’te trampet.',
    bpm: 80, min: 60, max: 160,
    bars: [0, 1, 2, 3].map((n) => `:8 ${Array.from({ length: 8 }, (_, i) => {
      if (i % 2) return H;
      const b = hit(i % 4 ? S : K, n === 0 && i === 0 ? CR : `${H}{ac}`);
      return n === 0 && i === 0 ? `${b}{txt "1-2-3-4"}` : b;
    }).join(' ')}`),
  },
  {
    id: 'd-t8', diff: 'orta', title: '5/8: 3 + 2', ts: [5, 8], tempo: EIGHTH,
    desc: 'Beş sekizlik hi-hat: üçlü grup kick ile, ikili grup trampetle başlar. “BUM-ta-ta TAK-ta”; ikinci grup hemen gelir, bekleme.',
    bpm: 140, min: 100, max: 240,
    bars: [meterGroove([3, 2], { crash: true, label: '3+2' }), ...repeat([meterGroove([3, 2])], 3)],
  },
  {
    id: 'd-t9', diff: 'orta', title: '5/8: 2 + 3', ts: [5, 8], tempo: EIGHTH,
    desc: 'Aynı beş sekizlik, bu kez önce ikili grup: “BUM-ta TAK-ta-ta”. Vurgunun yeri değişince ritim bambaşka duyulur.',
    bpm: 140, min: 100, max: 240,
    bars: [meterGroove([2, 3], { crash: true, label: '2+3' }), ...repeat([meterGroove([2, 3])], 3)],
  },
  {
    id: 'd-t10', diff: 'ileri', title: '7/8: 3 + 2 + 2', ts: [7, 8], tempo: EIGHTH,
    desc: 'Yedi sekizlik, uzun grup başta: “BUM-ta-ta TAK-ta BUM-ta”. Türk müziğinde devr-i hindî usulü bu gruplamadır.',
    bpm: 130, min: 100, max: 240,
    bars: [meterGroove([3, 2, 2], { crash: true, label: '3+2+2' }), ...repeat([meterGroove([3, 2, 2])], 3)],
  },
  {
    id: 'd-t11', diff: 'orta', title: '12/8: Ağır blues', ts: [12, 8], tempo: EIGHTH,
    desc: 'On iki sekizlik, dört üçlü grup: 1. ve 3. grupta kick, 2. ve 4. grupta trampet. Ölçüyü dört ağır vuruş gibi hisset; metronom her sekizliği tıklar.',
    bpm: 120, min: 90, max: 220,
    bars: [meterGroove([3, 3, 3, 3], { crash: true, label: '3+3+3+3' }), ...repeat([meterGroove([3, 3, 3, 3])], 3)],
  },
  {
    id: 'd-t12', diff: 'ileri', title: '6/8’de hemiola: 3 + 3 ve 2 + 2 + 2', ts: [6, 8], tempo: EIGHTH,
    desc: 'Aynı altı sekizlik iki türlü gruplanır: önce 3 + 3 (iki vuruş), sonra 2 + 2 + 2 (üç vuruş). Hi-hat aynı kalır, yalnızca kick ve trampetin yeri değişir.',
    bpm: 120, min: 90, max: 220,
    bars: repeat([meterGroove([3, 3], { label: '3+3' }), meterGroove([2, 2, 2], { label: '2+2+2' })], 2),
  },
  {
    id: 'd-t13', diff: 'ileri', title: 'Ölçü değişimi: 3/4 – 4/4 – 5/4', tsLabel: '3/4 · 4/4 · 5/4',
    desc: 'Her ölçünün vuruş sayısı değişir: üç, dört, beş, dört. Her ölçünün 1’inde kick; ölçü başlarında sayıyı baştan başlat.',
    bpm: 90, min: 60, max: 160,
    bars: ['KSS', 'KSKS', 'KSSKS', 'KSKS'].map((p, n) => `\\ts ${p.length} 4 :4 ${[...p].map((c, i) => {
      const b = hit(c === 'K' ? K : S, n === 0 && i === 0 ? CR : H);
      return i ? b : `${b}{txt "${p.length}"}`;
    }).join(' ')}`),
  },
  {
    id: 'd-t14', diff: 'ileri', title: 'Ölçü değişimi: 5/8 – 7/8', tsLabel: '5/8 · 7/8', tempo: EIGHTH,
    desc: 'Beş sekizlik (3 + 2) ile yedi sekizlik (2 + 2 + 3) sırayla. Hi-hat sekizlikleri hep eşit; yalnızca ölçünün uzunluğu değişir.',
    bpm: 130, min: 100, max: 240,
    bars: [
      `\\ts 5 8 ${meterGroove([3, 2], { crash: true, label: '3+2' })}`, `\\ts 7 8 ${meterGroove([2, 2, 3], { label: '2+2+3' })}`,
      `\\ts 5 8 ${meterGroove([3, 2], { label: '3+2' })}`, `\\ts 7 8 ${meterGroove([2, 2, 3], { label: '2+2+3' })}`,
    ],
  },
];

// Ölçü egzersizlerinde açıklamanın sonuna tempo notu (x/8'de BPM sekizlik sayısıdır)
const meter = (e) => ({
  ...e,
  level: 'olcu',
  desc: e.tempo === EIGHTH ? `${e.desc} Tempo dakikadaki sekizlik sayısı.` : e.desc,
});

export const EXERCISES = [
  ...GUITAR.map((e) => ({ ...e, inst: 'gitar' })),
  ...GUITAR_TS.map((e) => ({ ...meter(e), inst: 'gitar' })),
  ...DRUMS.map((e) => ({ ...e, inst: 'davul' })),
  ...DRUMS_TS.map((e) => ({ ...meter(e), inst: 'davul' })),
];

// Ölçü etiketi ("5/8", "3/4 · 4/4 · 5/4"); 4/4 ve ölçü egzersizi olmayanlar için boş
export const tsLabel = (ex) => ex.tsLabel || (ex.ts && (ex.level === 'olcu' || ex.ts.join('/') !== '4/4') ? ex.ts.join('/') : '');

export const findExercise = (id) => EXERCISES.find((e) => e.id === id);

// Egzersizin alphaTex metni
export function exerciseTex(ex) {
  const head = ex.inst === 'davul'
    ? '\\track "Davul"\n\\staff {score}\n\\instrument percussion\n\\clef neutral\n\\articulation defaults'
    : `\\track "Elektro gitar"\n\\staff {score tabs}\n\\instrument ${ex.prog ?? CLEAN}`;
  const ts = ex.ts ? `\\ts ${ex.ts[0]} ${ex.ts[1]} ` : '';
  return `\\title "${ex.title}"\n\\tempo ${exTempo(ex)}\n.\n${head}\n${ts}${ex.bars.join(' |\n')}\n`;
}
