// Gitar çalışma planı: üç aşama, her aşamada egzersizler gruplara ayrılır. Günlük çalışma
// her gruptan en uzun süredir açılmayan egzersizi önerir (bugün açılanlar listede kalır).

// Günlük çalışmanın adımları: grup, süre, kaç egzersiz
export const STEPS = [
  { key: 'isinma', title: 'Isınma', min: 5, n: 1 },
  { key: 'teknik', title: 'Teknik', min: 10, n: 2 },
  { key: 'akor', title: 'Akor ve ritim', min: 5, n: 1 },
  { key: 'olcu', title: 'Ölçü', min: 5, n: 1 },
];

export const STAGES = [
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
];

export const RULES = [
  'Her egzersize önerilen en düşük tempoda başla.',
  'Üç tur hatasız çalınca 5 BPM artır. Tempo panelindeki antrenör bunu senin yerine yapar.',
  'Hata artarsa 10 BPM düş. Temiz çalmak hızdan önemli; en yüksek tempoya ulaşmadan da ilerleyebilirsin.',
  'Elin ya da bileğin ağrırsa dur. Az ve her gün çalışmak, seyrek ve uzun çalışmaktan iyidir.',
  'Ölçü egzersizlerinde önce egzersizin sesini kapat, metronomla yüksek sesle sayıp vurgulu vuruşlarda el çırp; sonra çal.',
];

const sameDay = (a, b) => {
  const x = new Date(a);
  const y = new Date(b);
  return x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth() && x.getDate() === y.getDate();
};
export const openedToday = (opened, now = Date.now()) => !!opened && sameDay(opened, now);

// Bir adım için önerilen egzersizler: önce bugün açılanlar (çalışılmış olarak kalsın), sonra
// en uzun süredir açılmayanlar (hiç açılmayan önce; eşitse plandaki sıra).
export function pick(ids, n, progress, now = Date.now()) {
  const opened = (id) => progress.get(id)?.opened || 0;
  const today = ids.filter((id) => openedToday(opened(id), now));
  const rest = ids.filter((id) => !today.includes(id))
    .map((id, i) => [id, opened(id), i])
    .sort((a, b) => a[1] - b[1] || a[2] - b[2])
    .map(([id]) => id);
  return [...today, ...rest].slice(0, n);
}

// Bir aşamanın bütün egzersizleri (tekrarsız, plandaki sırayla)
export const stageIds = (st) => [...new Set(STEPS.flatMap((s) => st[s.key]))];
