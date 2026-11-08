// Yedekleme ve taşıma: bütün veriler tek bir JSON dosyasında. Şarkı dosyaları base64, gerisi
// olduğu gibi. Geri yükleme bu cihazdakilerle birleştirir; aynı yedeği iki kez yüklemek bir şeyi
// ikilemez (şarkının kimliği dosyanın özeti, gün süreleri toplanmaz, en büyüğü kalır).
import { db } from './db.js?v=__SURUM__';

export const BACKUP_APP = 'tab-to-play';
export const BACKUP_FORMAT = 1;

function toBase64(buf) {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
function fromBase64(str) {
  const bin = atob(str);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

export async function makeBackup(prefs, version) {
  const songs = [];
  for (const s of await db.allSongs()) {
    const bytes = await db.getFile(s.id);
    if (bytes) songs.push({ ...s, file64: toBase64(bytes) });
  }
  return {
    app: BACKUP_APP,
    format: BACKUP_FORMAT,
    version,
    created: new Date().toISOString(),
    prefs,
    songs,
    exercises: await db.allEx(),
    days: await db.allDays(),
    lists: await db.allLists(),
  };
}

const later = (a, b, key) => ((b?.[key] || 0) > (a?.[key] || 0) ? b : a);
const max = (a, b) => Math.max(a || 0, b || 0) || undefined;

// Egzersiz ilerlemesi: ayarlar (tempo, döngü…) en son açılan cihazdan; çalışma zamanları ve en
// yüksek tempo ikisinin büyüğü
export function mergeEx(a, b) {
  if (!a || !b) return a || b;
  return { ...later(a, b, 'opened'), played: max(a.played, b.played), done: max(a.done, b.done), best: max(a.best, b.best) };
}

// Gün: iki cihazdaki kalemlerin birleşimi; aynı kalemde süre ve tempo büyük olan (aynı yedeği
// tekrar yüklemek süreyi ikiye katlamasın)
export function mergeDay(a, b) {
  if (!a || !b) return a || b;
  const items = { ...a.items };
  for (const [id, it] of Object.entries(b.items)) {
    const x = items[id];
    items[id] = x ? { ...x, ...it, sec: Math.max(x.sec, it.sec), bpm: max(x.bpm, it.bpm) } : it;
  }
  return { day: a.day, items, sec: Object.values(items).reduce((n, it) => n + it.sec, 0) };
}

// Yedeği okur ve birleştirir; ne kadarının eklendiğini döndürür. Yedek değilse hata verir.
export async function restoreBackup(data) {
  if (data?.app !== BACKUP_APP || !Array.isArray(data.songs)) throw new Error('yedek değil');
  if (data.format > BACKUP_FORMAT) throw new Error('yeni sürüm yedeği');
  const n = { songs: 0, exercises: 0, days: 0, lists: 0 };

  const have = new Map((await db.allSongs()).map((s) => [s.id, s]));
  for (const { file64, ...song } of data.songs) {
    const old = have.get(song.id);
    if (old) {
      // Aynı dosya: ayarlar en son açılandan, favori ikisinden biri favoriyse
      await db.putSong({ ...later(old, song, 'opened'), fav: !!(old.fav || song.fav), added: old.added });
    } else if (file64) {
      await db.addSong(song, fromBase64(file64));
      n.songs++;
    }
  }

  const ex = new Map((await db.allEx()).map((r) => [r.id, r]));
  for (const r of data.exercises || []) {
    if (!ex.has(r.id)) n.exercises++;
    await db.putEx(mergeEx(ex.get(r.id), r));
  }

  const days = new Map((await db.allDays()).map((d) => [d.day, d]));
  for (const d of data.days || []) {
    if (!days.has(d.day)) n.days++;
    await db.putDay(mergeDay(days.get(d.day), d));
  }

  const lists = new Map((await db.allLists()).map((l) => [l.id, l]));
  for (const l of data.lists || []) {
    if (!lists.has(l.id)) n.lists++;
    await db.putList(later(lists.get(l.id) || l, l, 'updated'));
  }
  return n;
}
