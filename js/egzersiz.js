// Egzersizler: elektro gitar ve davul için, seviyelere göre. Her egzersiz alphaTex olarak burada
// üretilir (dosya yok), çalarda şarkı gibi açılır.
//
// Tempo: egzersizlerin hepsi 100 BPM yazılır, çalarda hız yüzdesi doğrudan BPM olur
// (hız %72 = 72 BPM). Böylece BPM'i değiştirmek için notaları yeniden çizmek gerekmez.
export const EX_TEMPO = 100;
export const EX_BPM_MIN = 30;
export const EX_BPM_MAX = 240;

export const LEVELS = { baslangic: 'Başlangıç', orta: 'Orta', ileri: 'İleri' };
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
const hit = (...xs) => (xs.length > 1 ? `(${xs.join(' ')})` : xs[0]);

// Sekizlik hi-hat üzerinde kick (k) ve trampet (s) konumları (0–7)
function rock8(kicks, { top = H, crash = false } = {}) {
  return `:8 ${Array.from({ length: 8 }, (_, i) => {
    const parts = [];
    if (kicks.includes(i)) parts.push(K);
    if (i === 2 || i === 6) parts.push(S);
    parts.push(crash && i === 0 ? CR : top);
    return hit(...parts);
  }).join(' ')}`;
}

const sn = (txt, accent = false) => `${S}{${accent ? 'ac ' : ''}txt "${txt}"}`;
const paradiddle = ['R', 'L', 'R', 'R', 'L', 'R', 'L', 'L'];

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
];

export const EXERCISES = [
  ...GUITAR.map((e) => ({ ...e, inst: 'gitar' })),
  ...DRUMS.map((e) => ({ ...e, inst: 'davul' })),
];

export const findExercise = (id) => EXERCISES.find((e) => e.id === id);

// Egzersizin alphaTex metni
export function exerciseTex(ex) {
  const head = ex.inst === 'davul'
    ? '\\track "Davul"\n\\staff {score}\n\\instrument percussion\n\\clef neutral\n\\articulation defaults'
    : `\\track "Elektro gitar"\n\\staff {score tabs}\n\\instrument ${ex.prog ?? CLEAN}`;
  const ts = ex.ts ? `\\ts ${ex.ts[0]} ${ex.ts[1]} ` : '';
  return `\\title "${ex.title}"\n\\tempo ${EX_TEMPO}\n.\n${head}\n${ts}${ex.bars.join(' |\n')}\n`;
}
