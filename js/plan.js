// Çalışma planı (gitar ve davul): üç aşama, her aşamada egzersizler gruplara ayrılır. Günlük
// çalışma her gruptan en uzun süredir çalışılmayan egzersizi önerir (bugün çalışılanlar listede
// kalır). "Çalışıldı": o gün en az birkaç on saniye gerçekten çalındı (ilerlemedeki `done`).

// Tempo ve ölçü kuralları iki enstrümanda aynı
const TEMPO_RULES = [
  'Her egzersize önerilen en düşük tempoda başla.',
  'Üç tur hatasız çalınca 5 BPM artır. Tempo panelindeki antrenör bunu senin yerine yapar.',
  'Hata artarsa 10 BPM düş. Temiz çalmak hızdan önemli; en yüksek tempoya ulaşmadan da ilerleyebilirsin.',
];
const METER_RULE = 'Ölçü egzersizlerinde önce egzersizin sesini kapat, metronomla yüksek sesle sayıp vurgulu vuruşlarda el çırp; sonra çal.';

const GUITAR = {
  // Günlük çalışmanın adımları: grup, süre, kaç egzersiz
  steps: [
    { key: 'isinma', title: 'Isınma', min: 5, n: 1 },
    { key: 'teknik', title: 'Teknik', min: 10, n: 2 },
    { key: 'akor', title: 'Akor ve ritim', min: 5, n: 1 },
    { key: 'olcu', title: 'Ölçü', min: 5, n: 1 },
  ],
  stages: [
    {
      title: 'Temeller', when: 'İlk 1–2 ay',
      isinma: ['g-b1', 'g-b2'],
      teknik: ['g-b3', 'g-b6', 'g-b9'],
      akor: ['g-b5', 'g-b4', 'g-b8', 'g-b7'],
      olcu: ['g-t2', 'g-t1', 'g-t3'],
      next: 'Akor geçişlerinde 70–80 BPM’de ritim bozulmuyor ve Kromatik 1-2-3-4’ü 80 BPM civarında temiz çalıyorsan.',
    },
    {
      title: 'Orta', when: 'Sonraki 2–4 ay',
      isinma: ['g-b2', 'g-o1'],
      teknik: ['g-o2', 'g-o4', 'g-o8', 'g-o7', 'g-o3'],
      akor: ['g-o5', 'g-o6', 'g-o10', 'g-o9'],
      olcu: ['g-t4', 'g-t5', 'g-t6', 'g-t7', 'g-t10'],
      next: 'Pentatonik ve hammer-on/pull-off 100 BPM civarında temizse ve 5/8 ile 7/8’i sayarak kaçırmadan çalıyorsan.',
    },
    {
      title: 'İleri', when: 'Sonrası',
      isinma: ['g-o1', 'g-i1'],
      teknik: ['g-i5', 'g-i6', 'g-i2', 'g-i8', 'g-i3'],
      akor: ['g-i7', 'g-i4'],
      olcu: ['g-t8', 'g-t9', 'g-t11', 'g-t12', 'g-t13'],
      next: '',
    },
  ],
  rules: [
    ...TEMPO_RULES,
    'Elin ya da bileğin ağrırsa dur. Az ve her gün çalışmak, seyrek ve uzun çalışmaktan iyidir.',
    METER_RULE,
  ],
};

// Davul: ısınma trampette el alıştırması (rudiment), teknik koordinasyon ve ayaklar, sonra ritim ve fill
const DRUMS = {
  steps: [
    { key: 'isinma', title: 'Isınma', min: 5, n: 1 },
    { key: 'teknik', title: 'Teknik', min: 10, n: 2 },
    { key: 'ritim', title: 'Ritim ve fill', min: 5, n: 1 },
    { key: 'olcu', title: 'Ölçü', min: 5, n: 1 },
  ],
  stages: [
    {
      title: 'Temeller', when: 'İlk 1–2 ay',
      isinma: ['d-b3', 'd-b5'],
      teknik: ['d-b1', 'd-b9', 'd-b6'],
      ritim: ['d-b2', 'd-b4', 'd-b8', 'd-b7'],
      olcu: ['d-t7', 'd-t1', 'd-t2'],
      next: 'Temel rock ritmini 100 BPM civarında hi-hat’i bozmadan çalıyorsan, sekizlik fill’den sonra 1’e crash ile tam oturuyorsan ve tek ile çift vuruşlar iki elde eşit sesliyse.',
    },
    {
      title: 'Orta', when: 'Sonraki 2–4 ay',
      isinma: ['d-b5', 'd-o10'],
      teknik: ['d-o1', 'd-o2', 'd-o7', 'd-o6', 'd-o8'],
      ritim: ['d-o3', 'd-o4', 'd-o5', 'd-o9'],
      olcu: ['d-t3', 'd-t8', 'd-t9', 'd-t4', 'd-t11'],
      next: 'Onaltılık hi-hat ve kick çeşitlemeleri 90 BPM civarında temizse, fill’den ritme kaçırmadan dönüyorsan ve 5/8 ile 7/8’i sayarak çalıyorsan.',
    },
    {
      title: 'İleri', when: 'Sonrası',
      isinma: ['d-i1', 'd-i7'],
      teknik: ['d-i2', 'd-i5', 'd-i4', 'd-i8'],
      ritim: ['d-i3', 'd-i6'],
      olcu: ['d-t10', 'd-t5', 'd-t12', 'd-t13', 'd-t14', 'd-t6'],
      next: '',
    },
  ],
  rules: [
    ...TEMPO_RULES,
    'Çubukları sıkma, vuruştan sonra sekmelerine izin ver; omuzlar ve bilekler gevşek kalsın. Elin, bileğin ya da bacağın ağrırsa dur. Az ve her gün çalışmak, seyrek ve uzun çalışmaktan iyidir.',
    'Yeni bir ritmi önce yalnızca ellerle çal, sonra ayakları ekle. Vurgusuz notaları alçaktan, vurguluları yüksekten vur.',
    METER_RULE,
  ],
};

export const PLANS = { gitar: GUITAR, davul: DRUMS };

// Günlük süre: adımların dakikası ve kaç egzersiz (sırayla ısınma, teknik, akor/ritim, ölçü), şarkı
export const DURATIONS = {
  15: { steps: [[3, 1], [5, 1], [3, 1], [2, 1]], song: 2 },
  30: { steps: [[5, 1], [10, 2], [5, 1], [5, 1]], song: 5 },
  45: { steps: [[5, 1], [15, 3], [10, 2], [5, 1]], song: 10 },
};
export const dailySteps = (plan, minutes) => {
  const d = DURATIONS[minutes] || DURATIONS[30];
  return plan.steps.map((s, i) => ({ ...s, min: d.steps[i][0], n: d.steps[i][1] }));
};
// Aşamadaki egzersizlerin bu kadarında hedef tempoya ulaşılınca sonraki aşama önerilir
export const READY_SHARE = 0.75;

const sameDay = (a, b) => {
  const x = new Date(a);
  const y = new Date(b);
  return x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth() && x.getDate() === y.getDate();
};
export const isToday = (t, now = Date.now()) => !!t && sameDay(t, now);

// Bir adım için önerilen egzersizler: önce bugün çalışılanlar (çalışılmış olarak kalsın), sonra
// en uzun süredir çalışılmayanlar (hiç çalışılmayan önce; eşitse plandaki sıra).
export function pick(ids, n, progress, now = Date.now()) {
  const done = (id) => progress.get(id)?.done || 0;
  const today = ids.filter((id) => isToday(done(id), now));
  const rest = ids.filter((id) => !today.includes(id))
    .map((id, i) => [id, done(id), i])
    .sort((a, b) => a[1] - b[1] || a[2] - b[2])
    .map(([id]) => id);
  return [...today, ...rest].slice(0, n);
}

// Bir aşamanın bütün egzersizleri (tekrarsız, plandaki sırayla)
export const stageIds = (plan, st) => [...new Set(plan.steps.flatMap((s) => st[s.key]))];
