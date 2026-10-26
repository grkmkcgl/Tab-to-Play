// Tab-to-Play: kütüphane ve çalar.
// __SURUM__ yayınlanırken (tools/build.mjs) yapı numarasıyla değiştirilir. Sayfa, css ve betikler hep
// aynı numarayla istenir; böylece önbellekten eski bir betik yeni sayfayla karışamaz.
import { db } from './db.js?v=__SURUM__';
import { EXERCISES, EX_BPM_MAX, EX_BPM_MIN, EX_INST, LEVELS, exTempo, exerciseTex, findExercise, tsLabel } from './egzersiz.js?v=__SURUM__';
import { PLANS, isToday, pick, stageIds } from './plan.js?v=__SURUM__';
import { Metronome, tapper } from './metronom.js?v=__SURUM__';
import { makeBackup, restoreBackup } from './yedek.js?v=__SURUM__';

const VERSION = '0.6.0';
const BUILD = '__SURUM__';
window.ttpBuild = BUILD;
const at = window.alphaTab;
const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
const LIB = new URL('lib/', document.baseURI).href;

const KIND_LABEL = { gitar: 'Gitar', bas: 'Bas', davul: 'Davul', diger: 'Diğer' };
const KIND_ICON = { gitar: '🎸', bas: '🎸', davul: '🥁', diger: '🎹' };
const SPEED_MIN = 25;
const SPEED_MAX = 150;

// ---------------------------------------------------------------- tercihler (cihaza özel)
const prefs = loadPrefs();
function loadPrefs() {
  const d = {
    instrument: null,
    scale: matchMedia('(max-width: 600px)').matches ? 0.8 : 1,
    layout: 'page',
    stave: 'tab',
    follow: true,
    wake: true,
    metro: false,
    countIn: false,
    metroVol: 100, // çalardaki metronomun sesi (%)
    sort: 'recent',
    // Egzersizler: metronom ve sayma varsayılan açık, şarkılardaki tercihten ayrı
    exMetro: true,
    exCountIn: true,
    exInst: null,
    exLevel: 'baslangic',
    exOlcu: false,
    // Çalışma planı: seçili aşama (0–2), enstrümana göre (gitarınki eski adıyla)
    planStage: 0,
    planStageDavul: 0,
    // Tema: acik | koyu | gece (nota alanı da koyu). Boşsa eski "siyah arka plan" (dark) tercihinden.
    theme: null,
    dark: false,
    // Son yedeğin alındığı an (Ayarlar'da hatırlatmak için)
    lastBackup: 0,
    // Tek başına metronom
    mBpm: 80,
    mBeats: 4,
    mSub: 1,
    mAccent: true,
    mVol: 80,
  };
  try { return { ...d, ...JSON.parse(localStorage.getItem('ttp-prefs') || '{}') }; } catch { return d; }
}
function savePrefs() {
  try { localStorage.setItem('ttp-prefs', JSON.stringify(prefs)); } catch { /* gizli sekme vb. */ }
}

// ---------------------------------------------------------------- yardımcılar
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const norm = (s) => (s || '').toLocaleLowerCase('tr').replace(/ı/g, 'i').normalize('NFD').replace(/[̀-ͯ]/g, '');
const stripExt = (name) => name.replace(/\.[^.]+$/, '');
// Dosyalardaki bölünmez boşlukları vb. düz boşluğa çevir (arama ve görünüm için)
const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();
function fmtTime(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
function el(tag, props = {}, ...children) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') e.className = v;
    else if (k === 'text') e.textContent = v;
    else if (k.startsWith('data-') || k.startsWith('aria-') || k === 'type' || k === 'for') e.setAttribute(k, v);
    else e[k] = v;
  }
  for (const c of children) if (c != null) e.append(c);
  return e;
}
function icon(name) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('class', 'ic');
  const use = document.createElementNS(ns, 'use');
  use.setAttribute('href', `#i-${name}`);
  svg.append(use);
  return svg;
}

let toastTimer = 0;
function toast(msg, ms = 2600) {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, ms);
}

async function hashId(bytes) {
  try {
    const h = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
    return [...h.slice(0, 12)].map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  }
}

// Partinin türü: davul / bas / gitar / diğer
function kindOf(track) {
  const staff = track.staves[0];
  const name = `${track.name || ''} ${track.shortName || ''}`;
  if (staff?.isPercussion || /dav|drum|perc|bateri/i.test(name)) return 'davul';
  const program = track.playbackInfo?.program ?? -1;
  if ((program >= 32 && program <= 39) || /\bbas\b|bass/i.test(name)) return 'bas';
  if ((program >= 24 && program <= 31) || /gitar|guitar|gtr/i.test(name)) return 'gitar';
  const tuning = staff?.tuning || [];
  if (tuning.length >= 4) return Math.min(...tuning) < 36 && tuning.length <= 5 ? 'bas' : 'gitar';
  return 'diger';
}

// Kayıtta tutulan parti bilgisi. tab: partinin tel/akort bilgisi var mı (yoksa tab çizilemez)
function trackInfo(t) {
  const staff = t.staves[0];
  return {
    name: clean(t.name || t.shortName) || 'Parti',
    kind: kindOf(t),
    tab: !staff?.isPercussion && t.staves.some((st) => st.isStringed),
  };
}

// ---------------------------------------------------------------- dosya ekleme
function readScore(bytes) {
  return at.importer.ScoreLoader.loadScoreFromBytes(new Uint8Array(bytes), new at.Settings());
}

async function importFiles(fileList, { open = false } = {}) {
  const files = [...fileList];
  if (!files.length) return;
  let added = 0;
  let dup = 0;
  const bad = [];
  let lastId = null;
  for (const f of files) {
    let buf;
    try { buf = await f.arrayBuffer(); } catch { bad.push(f.name); continue; }
    let score;
    try { score = readScore(buf); } catch (e) {
      console.warn('Okunamadı', f.name, e);
      bad.push(f.name);
      continue;
    }
    const id = await hashId(buf);
    lastId = id;
    if (await db.getSong(id)) { dup++; continue; }
    const song = {
      id,
      file: f.name,
      title: clean(score.title) || clean(stripExt(f.name)),
      artist: clean(score.artist),
      tracks: score.tracks.map(trackInfo),
      bars: score.masterBars.length,
      tempo: score.tempo,
      size: buf.byteLength,
      added: Date.now(),
      opened: 0,
      fav: false,
      s: {},
    };
    await db.addSong(song, buf);
    added++;
  }
  navigator.storage?.persist?.().catch(() => {});
  const parts = [];
  if (added) parts.push(`${added} şarkı eklendi`);
  if (dup) parts.push(`${dup} şarkı zaten kütüphanede`);
  if (bad.length) parts.push(`${bad.length} dosya açılamadı (${bad.slice(0, 2).join(', ')}${bad.length > 2 ? '…' : ''})`);
  toast(parts.join(' · ') || 'Dosya eklenmedi', bad.length ? 5000 : 2600);
  if (open && lastId && files.length === 1 && !bad.length) location.hash = `#/sarki/${lastId}`;
  else if (!$('#libView').hidden) await showLibrary();
}

// Android paylaş menüsünden gelen dosyalar (sw.js bunları geçici olarak saklar)
async function checkInbox() {
  if (!('caches' in window)) return;
  try {
    const cache = await caches.open('ttp-gelen');
    const keys = await cache.keys();
    if (!keys.length) return;
    const files = [];
    for (const k of keys) {
      const res = await cache.match(k);
      if (res) files.push(new File([await res.arrayBuffer()], decodeURIComponent(res.headers.get('x-name') || 'dosya.gp')));
      await cache.delete(k);
    }
    await importFiles(files, { open: true });
  } catch (e) {
    console.warn('Paylaşılan dosya alınamadı', e);
  }
}

// ---------------------------------------------------------------- görünümler
const VIEWS = ['libView', 'exView', 'planView', 'histView', 'metroView', 'playerView'];
// Başka bir görünüme geçerken çalanı durdur
function showView(id) {
  if (id !== 'playerView') {
    pause();
    practiceStop(); // durma olayını beklemeden: açılan ekran az önce çalınanı görsün
    closePanels();
    if (trainer.on) stopTrainer(false);
  }
  if (id !== 'metroView') metro.stop();
  if (id !== 'playerView' && id !== 'metroView') releaseWake();
  for (const v of VIEWS) $(`#${v}`).hidden = v !== id;
}

// ---------------------------------------------------------------- kütüphane
let songs = [];
let favOnly = false;

async function showLibrary() {
  showView('libView');
  document.title = 'Tab-to-Play';
  songs = await db.allSongs();
  renderList();
}

function renderList() {
  const q = norm($('#q').value.trim());
  let list = songs.filter((s) => (!favOnly || s.fav) && (!q || norm(`${s.title} ${s.artist} ${s.file}`).includes(q)));
  const sort = prefs.sort;
  if (sort === 'title') list.sort((a, b) => a.title.localeCompare(b.title, 'tr'));
  else if (sort === 'added') list.sort((a, b) => b.added - a.added);
  else list.sort((a, b) => (b.opened || b.added) - (a.opened || a.added));
  $('#songList').replaceChildren(...list.map(songItem));
  $('#welcome').hidden = songs.length > 0;
  $('#libTools').hidden = songs.length === 0;
  $('#noResult').hidden = !(songs.length > 0 && list.length === 0);
}

function songItem(s) {
  const counts = {};
  for (const t of s.tracks) counts[t.kind] = (counts[t.kind] || 0) + 1;
  const kinds = el('span', { class: 'kinds' }, ...Object.entries(counts).map(([k, n]) =>
    el('span', { class: `kind${k === prefs.instrument ? ' mine' : ''}`, text: `${KIND_LABEL[k]}${n > 1 ? ` ×${n}` : ''}` })));
  const sub = el('span', { class: 'song-sub' });
  if (s.artist) sub.append(el('span', { text: s.artist }));
  sub.append(kinds);
  return el('li', { class: 'song', 'data-id': s.id },
    el('button', { class: 'song-main', type: 'button', 'data-act': 'open' }, el('span', { class: 'song-title', text: s.title }), sub),
    el('button', { class: 'icon-btn fav', type: 'button', 'data-act': 'fav', 'aria-pressed': String(!!s.fav), 'aria-label': 'Favori' }, icon('star')),
    el('button', { class: 'icon-btn', type: 'button', 'data-act': 'more', 'aria-label': 'Diğer işlemler', 'aria-expanded': 'false' }, icon('more')),
    el('div', { class: 'song-actions', hidden: true },
      el('button', { class: 'btn', type: 'button', 'data-act': 'share', text: 'Paylaş' }),
      el('button', { class: 'btn danger', type: 'button', 'data-act': 'del', text: 'Sil' })));
}

async function shareSong(s) {
  const bytes = await db.getFile(s.id);
  const name = s.file || `${s.title}.gp`;
  const file = new File([bytes], name, { type: 'application/octet-stream' });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: s.title }); } catch (e) {
      if (e.name !== 'AbortError') toast('Paylaşılamadı');
    }
    return;
  }
  const a = el('a', { href: URL.createObjectURL(file), download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
}

$('#songList').addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-act]');
  if (!btn) return;
  const li = btn.closest('.song');
  const s = songs.find((x) => x.id === li.dataset.id);
  if (!s) return;
  const act = btn.dataset.act;
  if (act === 'open') location.hash = `#/sarki/${s.id}`;
  else if (act === 'fav') {
    s.fav = !s.fav;
    btn.setAttribute('aria-pressed', String(s.fav));
    await db.putSong(s);
    if (favOnly) renderList();
  } else if (act === 'more') {
    const box = $('.song-actions', li);
    box.hidden = !box.hidden;
    btn.setAttribute('aria-expanded', String(!box.hidden));
  } else if (act === 'share') shareSong(s);
  else if (act === 'del') {
    if (!confirm(`“${s.title}” kütüphaneden silinsin mi?`)) return;
    await db.deleteSong(s.id);
    songs = songs.filter((x) => x.id !== s.id);
    renderList();
    toast('Şarkı silindi');
  }
});
$('#q').addEventListener('input', renderList);
$('#sort').value = prefs.sort;
$('#sort').addEventListener('change', () => { prefs.sort = $('#sort').value; savePrefs(); renderList(); });
$('#favOnly').addEventListener('click', () => {
  favOnly = !favOnly;
  $('#favOnly').setAttribute('aria-pressed', String(favOnly));
  renderList();
});
$('#fileIn').addEventListener('change', async (e) => {
  const files = [...e.target.files];
  e.target.value = '';
  await importFiles(files, { open: true });
});
async function addDemo() {
  $('#settingsDlg').close();
  try {
    const res = await fetch('ornek.gp');
    if (!res.ok) throw new Error(res.status);
    await importFiles([new File([await res.arrayBuffer()], 'ornek.gp')], { open: true });
  } catch {
    toast('Örnek şarkı yüklenemedi');
  }
}
$('#btnDemo').addEventListener('click', addDemo);
$('#btnDemo2').addEventListener('click', addDemo);

// İnternette tab bulma: bağlantılar tarayıcıda yeni sekmede açılır. Uygulama bu sitelere kendisi
// bağlanmaz (CSP connect-src 'self' aynen kalır); siteye yalnızca yazılan şarkı/sanatçı adı gider.
// Ultimate Guitar'ın kendi araması şarkı adıyla eşleşir (sanatçı eklenirse sonuç çıkmıyor).
// GProTab ve 911tabs'in arama adres biçimi doğrulanamadığı için şimdilik DuckDuckGo'da site: araması.
const ddg = (...words) => `https://duckduckgo.com/?q=${encodeURIComponent(clean(words.join(' ')))}`;
const FIND_SITES = {
  ug: (t) => `https://www.ultimate-guitar.com/search.php?search_type=title&value=${encodeURIComponent(t)}`,
  gprotab: (t, a) => ddg(t, a, 'site:gprotab.net'),
  '911tabs': (t, a) => ddg(t, a, 'guitar pro site:911tabs.com'),
  web: (t, a) => ddg(t, a, 'guitar pro tab gp5'),
};
function findUrl(site, title, artist = '') {
  return FIND_SITES[site](title, artist);
}
function updateFindLinks() {
  const title = clean($('#findQ').value);
  const artist = clean($('#findArtist').value);
  $$('#findList a').forEach((a) => {
    if (title) a.href = findUrl(a.dataset.site, title, artist); else a.removeAttribute('href');
    a.setAttribute('aria-disabled', String(!title));
  });
  $('#findEmpty').hidden = !!title;
}
function openFind() {
  const typed = $('#q').value.trim();
  if (typed) $('#findQ').value = typed;
  updateFindLinks();
  $('#findDlg').showModal();
  if (!$('#findQ').value) $('#findQ').focus();
}
$('#btnFind').addEventListener('click', openFind);
$('#findQ').addEventListener('input', updateFindLinks);
$('#findArtist').addEventListener('input', updateFindLinks);
$('#findQ').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#findArtist').focus(); });
$('#findArtist').addEventListener('keydown', (e) => { if (e.key === 'Enter') e.target.blur(); });
$('#findDlg [data-close-dlg]').addEventListener('click', () => $('#findDlg').close());
$('#findDlg').addEventListener('click', (e) => { if (e.target === e.currentTarget) e.currentTarget.close(); });

// Sürükle-bırak (bilgisayar, iPad)
let dragDepth = 0;
addEventListener('dragenter', (e) => {
  if (![...(e.dataTransfer?.types || [])].includes('Files')) return;
  dragDepth++;
  $('#dropHint').hidden = false;
});
addEventListener('dragleave', () => { if (--dragDepth <= 0) { dragDepth = 0; $('#dropHint').hidden = true; } });
addEventListener('dragover', (e) => { if ([...(e.dataTransfer?.types || [])].includes('Files')) e.preventDefault(); });
addEventListener('drop', (e) => {
  if (!e.dataTransfer?.files?.length) return;
  e.preventDefault();
  dragDepth = 0;
  $('#dropHint').hidden = true;
  importFiles(e.dataTransfer.files, { open: true });
});

// ---------------------------------------------------------------- çalar
let api = null;
let score = null;
let cur = null; // açık şarkının kaydı
let shown = 0; // ekranda gösterilen parti
let curBar = 0;
let playing = false;
let endTime = 0;
let seeking = false;
const trainer = { on: false, speed: 100, turns: 0 };

function songState(song) {
  song.s ||= {};
  const s = song.s;
  s.speed ??= 100;
  s.mute ||= {};
  s.solo ||= {};
  s.vol ||= {};
  s.loop ||= { on: false, from: 0, to: Math.max(0, (song.bars || 1) - 1) };
  s.tr ||= { start: 60, target: 100, step: 5, every: 1 };
  return s;
}

// Şarkı ayarlarını kaydet. Kaydırıcılar sürüklenirken (later) kısa bir gecikmeyle yazılır.
let saveTimer = 0;
let pendingSave = null;
function saveSong(later = false) {
  if (!cur) return;
  pendingSave = cur;
  clearTimeout(saveTimer);
  if (later) saveTimer = setTimeout(flushSave, 250);
  else flushSave();
}
const exRecord = (song) => ({ id: song.id, s: song.s, opened: song.opened, played: song.played, done: song.done, best: song.best });
function flushSave() {
  clearTimeout(saveTimer);
  const song = pendingSave;
  pendingSave = null;
  if (!song) return;
  // Egzersizin kendisi kodda; yalnızca ilerlemesi (tempo, döngü, antrenör…) saklanır
  const put = song.ex ? db.putEx(exRecord(song)) : db.putSong(song);
  put.catch((e) => console.warn('Kaydedilemedi', e));
}
addEventListener('pagehide', flushSave);
document.addEventListener('visibilitychange', () => { if (document.hidden) flushSave(); });

function setLoading(text) {
  $('#loading').hidden = !text;
  if (text) $('#loadingText').textContent = text;
}

// Tab'ı olmayan partiler (davul, piyano, akortsuz MusicXML…) dosyadaki haliyle çizilir;
// onlara "yalnızca tab" demek alphaTab'ı boş/bozuk çizime götürüyor.
function staveFor(info) {
  if (!info?.tab) return at.StaveProfile.Default;
  return { tab: at.StaveProfile.Tab, nota: at.StaveProfile.Score, ikisi: at.StaveProfile.ScoreTab }[prefs.stave] ?? at.StaveProfile.Tab;
}

// Tema. Gecede nota da koyu zeminde: alphaTab notayı CSS ile değil kendi renkleriyle çizer, renkler
// burada (saf beyaz değil, kırık beyaz; çizgiler yumuşak). Açık ve koyu temada nota kağıdı açık,
// alphaTab'ın kendi renkleri.
const THEME_BAR = { acik: '#f7f2eb', koyu: '#1c1814', gece: '#1c1814' };
if (!THEME_BAR[prefs.theme]) prefs.theme = prefs.dark ? 'gece' : 'koyu';
const SHEET_LIGHT = new at.Settings().display.resources;
const SHEET_GECE = {
  staffLineColor: [119, 111, 102], barSeparatorColor: [149, 140, 130], barNumberColor: [242, 154, 107],
  mainGlyphColor: [228, 221, 211], secondaryGlyphColor: [163, 154, 144], scoreInfoColor: [228, 221, 211],
};
function applySheetColors(res) {
  for (const [k, rgb] of Object.entries(SHEET_GECE)) res[k] = prefs.theme === 'gece' ? new at.model.Color(...rgb, 255) : SHEET_LIGHT[k];
}

function applyTheme() {
  const root = document.documentElement;
  root.classList.toggle('gece', prefs.theme === 'gece');
  root.classList.toggle('acik', prefs.theme === 'acik');
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_BAR[prefs.theme]);
  $$('[data-theme-seg] button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === prefs.theme)));
}
applyTheme();

function applyDisplay() {
  const st = api.settings;
  applySheetColors(st.display.resources);
  st.display.staveProfile = staveFor(cur?.tracks[shown]);
  // Yalnızca tab gösterilirken ritim (sap ve kirişler) tabın altına çizilsin
  st.notation.rhythmMode = st.display.staveProfile === at.StaveProfile.Tab ? at.TabRhythmMode.ShowWithBars : at.TabRhythmMode.Automatic;
  st.display.layoutMode = prefs.layout === 'yatay' ? at.LayoutMode.Horizontal : at.LayoutMode.Page;
  st.display.scale = prefs.scale;
  st.player.scrollMode = prefs.follow ? at.ScrollMode.Continuous : at.ScrollMode.Off;
  // Egzersizler hep 100 BPM yazılı (hız = BPM); nota üstündeki tempo işareti yanıltmasın.
  // Başlık üst çubukta var; akort ve dinamik işareti egzersizde yalnızca kalabalık.
  for (const k of ['EffectTempo', 'ScoreTitle', 'GuitarTuning', 'EffectDynamics']) {
    st.notation.elements.set(at.NotationElement[k], !cur?.ex);
  }
  api.updateSettings();
}

function ensureApi() {
  if (api) return;
  const s = new at.Settings();
  s.core.scriptFile = `${LIB}alphaTab.min.js`;
  s.core.fontDirectory = `${LIB}font/`;
  s.core.smuflFontSources = new Map([
    [at.FontFileFormat.Woff2, `${LIB}font/Bravura.woff2`],
    [at.FontFileFormat.Woff, `${LIB}font/Bravura.woff`],
  ]);
  s.core.logLevel = at.LogLevel.Warning;
  s.player.playerMode = at.PlayerMode.EnabledSynthesizer;
  s.player.soundFont = `${LIB}soundfont/sonivox.sf3`;
  s.player.scrollElement = $('#sheetWrap');
  s.player.scrollOffsetY = -30;
  s.player.enableCursor = true;
  s.player.enableAnimatedBeatCursor = true;
  s.player.enableElementHighlighting = true;
  s.player.enableUserInteraction = true;
  s.display.padding = [12, 12, 12, 12];
  // Tek parti gösterildiği için soldaki parti adı gereksiz (dar ekranda kesik görünüyordu)
  s.notation.elements.set(at.NotationElement.TrackNames, false);
  api = new at.AlphaTabApi($('#sheet'), s);
  window.ttpApi = api; // testler ve hata ayıklama için

  api.scoreLoaded.on((sc) => {
    score = sc;
    buildMix();
    updateAll();
  });
  api.renderStarted.on(() => { if (!score) setLoading('Notalar hazırlanıyor…'); });
  api.renderFinished.on(() => setLoading(null));
  api.postRenderFinished.on(() => highlightLoop());
  api.soundFontLoad.on((e) => {
    if (e.total) $('#loadingText').textContent = `Ses yükleniyor %${Math.round((e.loaded / e.total) * 100)}`;
  });
  api.soundFontLoaded.on(updatePlayButton);
  // Her şarkı yüklenişinde (ses bankası hazırsa) tetiklenir. midiLoaded'a abone olmuyoruz:
  // alphaTab 1.8.4'te worker'lı çalarda o olaya abone olmak sonsuz döngüye giriyor.
  api.playerReady.on(() => {
    applyPlayer();
    updatePlayButton();
  });
  api.playerStateChanged.on((e) => {
    playing = e.state === at.synth.PlayerState.Playing;
    updatePlayButton();
    if (playing) requestWake(); else releaseWake();
    if (playing) practiceStart(); else practiceStop();
  });
  api.playerPositionChanged.on(onPosition);
  api.playedBeatChanged.on((beat) => {
    curBar = beat.voice.bar.index;
    updateBarLabel();
  });
  api.playbackRangeChanged.on((e) => onRangeChanged(e.playbackRange));
  api.beatMouseDown.on((beat) => {
    lastTap = { tick: api.tickCache?.getBeatStart(beat) ?? null, bar: beat.voice.bar.index, at: Date.now() };
  });
  api.beatMouseUp.on(onBeatTap);
  api.playerFinished.on(() => { if (api.isLooping) onLoopTurn(); });
  api.error.on((e) => {
    console.error(e);
    setLoading(null);
    toast('Bir sorun oldu, dosya açılamadı', 4000);
  });
}

async function openSong(id) {
  const song = await db.getSong(id);
  if (!song) { location.replace('#/'); return; }
  const bytes = await db.getFile(id);
  if (!bytes) { toast('Dosya bulunamadı'); location.replace('#/'); return; }
  let sc;
  try { sc = readScore(bytes); } catch (e) {
    console.warn(e);
    toast('Bu dosya açılamadı', 4000);
    location.replace('#/');
    return;
  }
  song.tracks = sc.tracks.map(trackInfo); // eski kayıtları da günceller
  showPlayer(song, sc);
}

// alphaTex metninden nota (egzersizler)
function texScore(tex) {
  const imp = new at.importer.AlphaTexImporter();
  imp.initFromString(tex, new at.Settings());
  return imp.readScore();
}

async function openExercise(id) {
  const ex = findExercise(id);
  if (!ex) { location.replace('#/egzersiz'); return; }
  let sc;
  try { sc = texScore(exerciseTex(ex)); } catch (e) {
    console.warn(e);
    toast('Egzersiz açılamadı', 4000);
    location.replace('#/egzersiz');
    return;
  }
  const saved = await db.getEx(id).catch(() => null);
  const rec = {
    id,
    ex,
    title: ex.title,
    artist: `${EX_INST[ex.inst]} · ${ex.level === 'olcu' ? `${tsLabel(ex)} · ${LEVELS[ex.diff]}` : LEVELS[ex.level]}`,
    file: '',
    tempo: exTempo(ex),
    tracks: sc.tracks.map(trackInfo),
    s: saved?.s || {
      speed: ex.bpm,
      loop: { on: true, from: 0, to: sc.masterBars.length - 1 },
      tr: { start: ex.bpm, target: ex.max, step: 5, every: 2 },
    },
    // Gerçekten çalındığı son an, o gün yeterince çalışıldığı son an, en yüksek çalınan tempo
    played: saved?.played,
    done: saved?.done,
    best: saved?.best,
  };
  showPlayer(rec, sc);
}

// Şarkıyı ya da egzersizi çalarda aç
function showPlayer(song, sc) {
  practiceStop(); // çalan süre önceki şarkıya yazılsın
  flushSave(); // önceki şarkının bekleyen kaydı kaybolmasın
  clearTimeout(pauseTimer);
  if (api) api.stop();
  cur = song;
  song.bars = sc.masterBars.length;
  songState(song);
  song.opened = Date.now();
  saveSong();

  showView('playerView');
  $('#playerView').classList.toggle('ex', !!song.ex);
  $('#pTitle').textContent = song.title;
  $('#pArtist').textContent = song.artist || stripExt(song.file || '');
  document.title = `${song.title} · Tab-to-Play`;
  renderPresets();

  shown = pickTrack(song);
  score = null;
  curBar = 0;
  trainer.on = false;
  endTime = 0;
  $('#seek').value = 0;
  setLoading('Notalar hazırlanıyor…');
  ensureApi();
  applyDisplay();
  updateAll();
  resetSelection(sc.tracks[shown]);
  api.renderScore(sc, [shown]);
}

// alphaTab son seçimi (döngü vurgusu) hatırlar ve her çizimden sonra yeniden çizer; yeni nota ya da
// başka parti çizildiğinde eski vuruşlar yeni çizimde bulunamaz ve hata verir. Seçimi çizilecek
// partinin ilk vuruşuna çekmek bunu zararsız kılar (tek vuruşluk seçim çizilmez). Döngü vurgusu
// çizim bitince highlightLoop ile yeniden gelir.
function resetSelection(track) {
  const b0 = track?.staves[0]?.bars[0]?.voices[0]?.beats[0];
  if (api && b0) api.highlightPlaybackRange(b0, b0);
}

function pickTrack(song) {
  const n = song.tracks.length;
  if (Number.isInteger(song.s.track) && song.s.track < n) return song.s.track;
  const i = song.tracks.findIndex((t) => t.kind === prefs.instrument);
  return i >= 0 ? i : 0;
}

function applyPlayer() {
  if (!api || !cur) return;
  const s = cur.s;
  api.playbackSpeed = (trainer.on ? trainer.speed : s.speed) / 100;
  api.metronomeVolume = metroVolume();
  api.countInVolume = prefs[countKey()] ? 1 : 0;
  applyMix();
  applyLoop();
}

function updatePlayButton() {
  const b = $('#btnPlay');
  const ready = !!api?.isReadyForPlayback;
  b.disabled = !ready;
  $('use', b).setAttribute('href', playing ? '#i-pause' : '#i-play');
  b.setAttribute('aria-label', playing ? 'Duraklat' : 'Çal');
}

let playRequestedAt = 0;
let pauseTimer = 0;
function play() {
  if (!api?.isReadyForPlayback) return;
  clearTimeout(pauseTimer);
  playRequestedAt = Date.now();
  api.play();
}
function whenSafe(fn) {
  clearTimeout(pauseTimer);
  const wait = 500 - (Date.now() - playRequestedAt);
  if (wait > 0) pauseTimer = setTimeout(fn, wait);
  else fn();
}
function pause() { if (api) whenSafe(() => api.pause()); }
function stop() { if (api) whenSafe(() => api.stop()); }
function togglePlay() {
  if (playing || Date.now() - playRequestedAt < 500) pause();
  else play();
}

function onPosition(e) {
  endTime = e.endTime;
  if (!seeking) $('#seek').value = e.endTime ? Math.round((e.currentTime / e.endTime) * 1000) : 0;
  $('#posTime').textContent = `${fmtTime(e.currentTime)} / ${fmtTime(e.endTime)}`;
  if (e.isSeek && api?.tickCache && score) {
    const r = api.tickCache.findBeat(new Set([shown]), e.currentTick);
    if (r?.beat) { curBar = r.beat.voice.bar.index; updateBarLabel(); }
  }
}

function updateBarLabel() {
  $('#posBar').textContent = score ? `Ölçü ${curBar + 1}/${score.masterBars.length}` : 'Ölçü –';
}

function goBar(i) {
  if (!score || !api?.tickCache) return;
  const idx = clamp(i, 0, score.masterBars.length - 1);
  api.tickPosition = api.tickCache.getMasterBarStart(score.masterBars[idx]);
  curBar = idx;
  updateBarLabel();
}

// ---------------------------------------------------------------- hız
// Şarkıda hız yüzde; egzersizde yüzde = BPM (egzersizler 100 BPM yazılı), sınırlar da BPM.
const spMin = () => (cur?.ex ? EX_BPM_MIN : SPEED_MIN);
const spMax = () => (cur?.ex ? EX_BPM_MAX : SPEED_MAX);
const fmtSp = (v) => (cur?.ex ? `${v} BPM` : `%${v}`);
// Metronom ve sayma: egzersizlerde ayrı tercih (varsayılan açık)
const metroKey = () => (cur?.ex ? 'exMetro' : 'metro');
const countKey = () => (cur?.ex ? 'exCountIn' : 'countIn');
const metroVolume = () => (prefs[metroKey()] ? prefs.metroVol / 100 : 0);

function renderPresets() {
  const ex = cur?.ex;
  const vals = ex
    ? [...new Set([ex.min, ex.bpm, Math.round((ex.bpm + ex.max) / 2 / 5) * 5, ex.max])].sort((a, b) => a - b)
    : [50, 75, 90, 100];
  $('#spPresets').replaceChildren(...vals.map((v) => el('button', { type: 'button', class: 'chip', 'data-spv': v, text: ex ? String(v) : `%${v}` })));
  $('#spRange').min = spMin();
  $('#spRange').max = spMax();
  $('#spRange').step = ex ? 1 : 5;
  for (const id of ['#trStart', '#trTarget']) {
    $(id).min = spMin();
    $(id).max = spMax();
    $(id).step = ex ? 1 : 5;
  }
  $$('#trainerBox .u').forEach((u) => { u.textContent = ex ? 'BPM' : '%'; });
  $('[data-sp="-5"]').textContent = ex ? '−5' : '−';
  $('[data-sp="5"]').textContent = ex ? '+5' : '+';
  $('#exDesc').textContent = ex?.desc || '';
}

function setSpeed(v, later = false) {
  if (!cur) return;
  const s = cur.s;
  s.speed = clamp(Math.round(v), spMin(), spMax());
  if (trainer.on) stopTrainer(false);
  if (api) api.playbackSpeed = s.speed / 100;
  saveSong(later);
  updateSpeedUi();
}

function currentSpeed() {
  return trainer.on ? trainer.speed : cur?.s.speed ?? 100;
}

function updateSpeedUi() {
  if (!cur) return;
  const sp = currentSpeed();
  $('#spOut').textContent = fmtSp(sp);
  $('#spRange').value = sp;
  $('#lblSpeed').textContent = fmtSp(sp);
  $('[data-panel="speed"]').classList.toggle('on', cur.ex ? trainer.on : sp !== 100 || trainer.on);
  $$('[data-spv]').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.spv) === sp)));
  const tempo = score?.tempo || cur.tempo;
  if (cur.ex) $('#bpmInfo').textContent = `Önerilen tempo ${cur.ex.min}–${cur.ex.max} BPM`;
  else $('#bpmInfo').textContent = tempo ? `Orijinal tempo ${Math.round(tempo)} BPM · şu an ${Math.round((tempo * sp) / 100)} BPM` : '';
  $('#metro').checked = !!prefs[metroKey()];
  $('#countIn').checked = !!prefs[countKey()];
  $('#metroVol').value = prefs.metroVol;
  $('#metroVol').disabled = !prefs[metroKey()];
  const t = cur.s.tr;
  $('#trStart').value = t.start;
  $('#trTarget').value = t.target;
  $('#trStep').value = t.step;
  $('#trEvery').value = t.every;
  $('#trBtn').textContent = trainer.on ? 'Antrenörü durdur' : 'Antrenörü başlat';
  $('#trBtn').classList.toggle('primary', !trainer.on);
  $('#trStatus').textContent = trainer.on
    ? `Çalışıyor: ${fmtSp(trainer.speed)} (hedef ${fmtSp(t.target)}) · ${trainer.turns}. tur`
    : '';
}

function readTrainerInputs() {
  const t = cur.s.tr;
  const num = (id, lo, hi, d) => {
    const v = Number($(id).value);
    return Number.isFinite(v) && v > 0 ? clamp(Math.round(v), lo, hi) : d;
  };
  t.start = num('#trStart', spMin(), spMax(), 60);
  t.target = num('#trTarget', spMin(), spMax(), 100);
  t.step = num('#trStep', 1, 50, 5);
  t.every = num('#trEvery', 1, 20, 1);
  if (t.target < t.start) [t.start, t.target] = [t.target, t.start];
  saveSong();
}

function startTrainer() {
  readTrainerInputs();
  const t = cur.s.tr;
  trainer.on = true;
  trainer.speed = t.start;
  trainer.turns = 0;
  cur.s.speed = t.start;
  api.playbackSpeed = t.start / 100;
  api.isLooping = true;
  if (cur.s.loop.on) api.tickPosition = api.playbackRange?.startTick ?? api.tickPosition;
  updateSpeedUi();
  if (!playing) play();
  toast(`Antrenör: ${fmtSp(t.start)} → ${fmtSp(t.target)}`);
}

function stopTrainer(announce = true) {
  trainer.on = false;
  if (api) api.isLooping = !!cur?.s.loop.on;
  updateSpeedUi();
  if (announce) toast('Antrenör durdu');
}

function onLoopTurn() {
  if (!trainer.on || !cur) return;
  const t = cur.s.tr;
  trainer.turns++;
  if (trainer.turns % t.every === 0 && trainer.speed < t.target) {
    trainer.speed = Math.min(t.target, trainer.speed + t.step);
    cur.s.speed = trainer.speed;
    api.playbackSpeed = trainer.speed / 100;
    saveSong();
    const v = fmtSp(trainer.speed);
    if (trainer.speed >= t.target) toast(cur.ex ? `Hedef tempoya ulaştın: ${v}` : `Hedef hıza ulaştın: ${v}`);
    else toast(cur.ex ? `Tempo ${v}` : `Hız ${v}`);
  }
  updateSpeedUi();
}

$('#p-speed').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b || !cur) return;
  if (b.dataset.sp) setSpeed(currentSpeed() + Number(b.dataset.sp));
  else if (b.dataset.spv) setSpeed(Number(b.dataset.spv));
  else if (b.id === 'trBtn') {
    if (!api?.isReadyForPlayback) return;
    if (trainer.on) stopTrainer(); else startTrainer();
  }
});
$('#spRange').addEventListener('input', (e) => setSpeed(Number(e.target.value), true));
$('#metro').addEventListener('change', (e) => {
  prefs[metroKey()] = e.target.checked;
  savePrefs();
  if (api) api.metronomeVolume = metroVolume();
  updateSpeedUi();
});
$('#metroVol').addEventListener('input', (e) => {
  prefs.metroVol = clamp(Number(e.target.value) || 100, 20, 200);
  savePrefs();
  if (api) api.metronomeVolume = metroVolume();
});
$('#countIn').addEventListener('change', (e) => {
  prefs[countKey()] = e.target.checked;
  savePrefs();
  if (api) api.countInVolume = prefs[countKey()] ? 1 : 0;
});
// Egzersizde tempoyu dokunarak bulma
$('#tapBtn').addEventListener('click', tapper((bpm, n) => {
  if (!cur?.ex) return;
  if (bpm == null) { toast('Tempoda dokunmaya devam et', 1500); return; }
  setSpeed(bpm);
  if (n >= 3) toast(`Tempo ${bpm} BPM`, 1200);
}, { min: EX_BPM_MIN, max: EX_BPM_MAX }));
for (const id of ['#trStart', '#trTarget', '#trStep', '#trEvery']) {
  $(id).addEventListener('change', () => { if (cur) readTrainerInputs(); });
}

// ---------------------------------------------------------------- döngü (ölçü numarasıyla)
function applyLoop() {
  if (!api || !cur || !score || !api.tickCache) return;
  const L = cur.s.loop;
  const mbs = score.masterBars;
  L.from = clamp(L.from, 0, mbs.length - 1);
  L.to = clamp(L.to, L.from, mbs.length - 1);
  if (L.on) {
    const tc = api.tickCache;
    const r = new at.synth.PlaybackRange();
    r.startTick = tc.getMasterBarStart(mbs[L.from]);
    r.endTick = tc.getMasterBarStart(mbs[L.to]) + mbs[L.to].calculateDuration() - 1;
    // Yeni nota henüz çizilmeden (playerReady çizimden önce gelebiliyor) alphaTab seçimi eski
    // çizimde arıyor ve hata veriyor. Aralık çalara o noktadan önce yazılıyor; vurgu da
    // postRenderFinished'da highlightLoop ile çiziliyor. Bu yüzden hatayı yutmak yeterli.
    try { api.playbackRange = r; } catch { /* yukarıya bak */ }
    api.isLooping = true;
  } else {
    api.playbackRange = null;
    api.isLooping = trainer.on;
  }
  highlightLoop();
  updateLoopUi();
}

function highlightLoop() {
  if (!api || !cur || !score || !api.boundsLookup) return;
  const L = cur.s.loop;
  if (!L.on) { api.clearPlaybackRangeHighlight(); return; }
  const bars = score.tracks[shown]?.staves[0]?.bars;
  const v1 = bars?.[L.from]?.voices[0];
  const v2 = bars?.[L.to]?.voices[0];
  const first = v1?.beats[0];
  const last = v2?.beats[v2.beats.length - 1];
  // Çizim henüz yeni notaya ait değilse bekle (postRenderFinished yeniden çağırır)
  if (!first || !last || !api.boundsLookup.findBeat(first) || !api.boundsLookup.findBeat(last)) return;
  api.highlightPlaybackRange(first, last);
}

// alphaTab notaya dokununca seçimi siler; döngü açıksa geri koyarız ve dokunulan yer döngünün
// içindeyse oradan devam ederiz (dışındaysa döngünün başına). Fareyle sürükleyerek seçilen
// aralık ise ölçülere yuvarlanıp döngü olur.
let lastTap = null; // { tick, bar, at }
let loopTapStart = null; // döngü paneli açıkken ilk dokunulan ölçü
function onRangeChanged(range) {
  if (!cur || !score || !api.tickCache) return;
  const L = cur.s.loop;
  if (!range) {
    if (!L.on) return;
    const tap = lastTap;
    lastTap = null;
    setTimeout(() => {
      applyLoop();
      const r = api.playbackRange;
      if (tap?.tick != null && Date.now() - tap.at < 2000 && r && tap.tick >= r.startTick && tap.tick <= r.endTick) {
        api.tickPosition = tap.tick;
        curBar = tap.bar;
        updateBarLabel();
      }
    }, 0);
    return;
  }
  const set = new Set([shown]);
  const a = api.tickCache.findBeat(set, range.startTick)?.beat;
  const b = api.tickCache.findBeat(set, range.endTick)?.beat;
  if (!a || !b) return;
  const from = Math.min(a.voice.bar.index, b.voice.bar.index);
  const to = Math.max(a.voice.bar.index, b.voice.bar.index);
  if (L.on && from === L.from && to === L.to) return;
  Object.assign(L, { on: true, from, to });
  saveSong();
  applyLoop();
  toast(`Döngü: ${from + 1}–${to + 1}. ölçü`);
}

// Döngü paneli açıkken: ilk dokunuş başlangıç, ikincisi bitiş ölçüsü
function onBeatTap(beat) {
  if (!beat || !score || $('#p-loop').hidden) return;
  const bar = beat.voice.bar.index;
  if (lastTap && lastTap.bar !== bar) return; // sürükleme: aralığı alphaTab'ın seçimi belirler
  if (loopTapStart == null) {
    loopTapStart = bar;
    toast(`Başlangıç ${bar + 1}. ölçü. Şimdi bitiş ölçüsüne dokun.`, 4000);
  } else {
    const from = Math.min(loopTapStart, bar);
    const to = Math.max(loopTapStart, bar);
    loopTapStart = null;
    lastTap = null;
    setLoop({ on: true, from, to });
    toast(`Döngü: ${from + 1}–${to + 1}. ölçü`);
  }
  updateLoopUi();
}

function setLoop(patch) {
  if (!cur || !score) return;
  const L = cur.s.loop;
  Object.assign(L, patch);
  const n = score.masterBars.length;
  L.from = clamp(L.from, 0, n - 1);
  L.to = clamp(L.to, 0, n - 1);
  if (L.to < L.from) {
    if ('to' in patch) L.from = L.to; else L.to = L.from;
  }
  saveSong();
  applyLoop();
  if (L.on && api.tickCache) {
    const start = api.tickCache.getMasterBarStart(score.masterBars[L.from]);
    const end = api.tickCache.getMasterBarStart(score.masterBars[L.to]) + score.masterBars[L.to].calculateDuration();
    if (api.tickPosition < start || api.tickPosition >= end) api.tickPosition = start;
  }
}

function updateLoopUi() {
  if (!cur) return;
  const L = cur.s.loop;
  $('#loopOn').checked = L.on;
  $('#lfOut').textContent = L.from + 1;
  $('#ltOut').textContent = L.to + 1;
  $('#lblLoop').textContent = L.on ? `${L.from + 1}–${L.to + 1}` : 'Döngü';
  $('#loopTapHint').textContent = loopTapStart == null
    ? 'Notalarda önce başlangıç, sonra bitiş ölçüsüne dokun.'
    : `Başlangıç ${loopTapStart + 1}. ölçü seçildi. Şimdi bitiş ölçüsüne dokun.`;
  $('[data-panel="loop"]').classList.toggle('on', L.on);
}

$('#loopOn').addEventListener('change', (e) => setLoop({ on: e.target.checked }));
$('#p-loop').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b || !cur || !score) return;
  const L = cur.s.loop;
  if (b.dataset.lf) setLoop({ from: L.from + Number(b.dataset.lf), on: true });
  else if (b.dataset.lt) setLoop({ to: L.to + Number(b.dataset.lt), on: true });
  else if (b.id === 'lfCur') setLoop({ from: curBar, to: Math.max(curBar, L.to), on: true });
  else if (b.id === 'ltCur') setLoop({ to: curBar, from: Math.min(curBar, L.from), on: true });
  else if (b.id === 'loopClear') {
    setLoop({ on: false, from: 0, to: score.masterBars.length - 1 });
    toast('Döngü kaldırıldı');
  }
});

// ---------------------------------------------------------------- partiler (göster / sessiz / solo / ses)
function applyMix() {
  if (!api || !score || !cur) return;
  const s = cur.s;
  score.tracks.forEach((t, i) => {
    api.changeTrackMute([t], !!s.mute[i]);
    api.changeTrackSolo([t], !!s.solo[i]);
    api.changeTrackVolume([t], (s.vol[i] ?? 100) / 100);
  });
}

function buildMix() {
  const ul = $('#mixList');
  ul.replaceChildren(...score.tracks.map((t, i) => {
    const kind = cur.tracks[i]?.kind || kindOf(t);
    const name = cur.tracks[i]?.name || t.name || `Parti ${i + 1}`;
    return el('li', { 'data-i': i },
      el('label', { class: 'mix-name' },
        el('input', { type: 'radio', name: 'shownTrack', value: String(i) }),
        el('span', { text: KIND_ICON[kind] }),
        el('span', { class: 'nm' }, el('span', { text: name }),
          norm(name).includes(norm(KIND_LABEL[kind])) ? null : el('small', { text: ` ${KIND_LABEL[kind]}` }))),
      el('button', { class: 'btn tog', type: 'button', 'data-mute': i, 'aria-pressed': 'false', text: 'Sessiz' }),
      el('button', { class: 'btn tog', type: 'button', 'data-solo': i, 'aria-pressed': 'false', text: 'Solo' }),
      el('label', { class: 'mix-vol' }, el('span', { text: 'Ses' }),
        el('input', { type: 'range', min: '0', max: '150', step: '5', 'data-vol': i, 'aria-label': `${name} ses düzeyi` })));
  }));
}

function updateMixUi() {
  if (!cur) return;
  const s = cur.s;
  $$('#mixList li').forEach((li) => {
    const i = Number(li.dataset.i);
    $('input[type=radio]', li).checked = i === shown;
    $('[data-mute]', li).setAttribute('aria-pressed', String(!!s.mute[i]));
    $('[data-solo]', li).setAttribute('aria-pressed', String(!!s.solo[i]));
    $('[data-vol]', li).value = s.vol[i] ?? 100;
  });
  $('#muteMine').checked = !!s.mute[shown];
  const t = cur.tracks[shown];
  const chip = $('#btnTrack');
  chip.textContent = t ? `${KIND_ICON[t.kind]} ${t.name}${s.mute[shown] ? ' · sessiz' : ''}` : '';
  const anySolo = Object.values(s.solo).some(Boolean);
  const anyMute = Object.values(s.mute).some(Boolean);
  $('[data-panel="mix"].ctl').classList.toggle('on', anySolo || anyMute);
}

function showTrack(i) {
  if (!score || i === shown || !score.tracks[i]) return;
  shown = i;
  cur.s.track = i;
  saveSong();
  applyDisplay();
  resetSelection(score.tracks[i]);
  api.renderTracks([score.tracks[i]]);
  updateMixUi();
  updateViewUi();
}

function setMute(i, on) {
  cur.s.mute[i] = on;
  api?.changeTrackMute([score.tracks[i]], on);
  saveSong();
  updateMixUi();
}

$('#mixList').addEventListener('change', (e) => {
  if (e.target.name === 'shownTrack') showTrack(Number(e.target.value));
});
$('#mixList').addEventListener('input', (e) => {
  const i = e.target.dataset.vol;
  if (i == null || !score) return;
  cur.s.vol[i] = Number(e.target.value);
  api.changeTrackVolume([score.tracks[i]], cur.s.vol[i] / 100);
  saveSong(true);
});
$('#mixList').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b || !score) return;
  if (b.dataset.mute != null) {
    const i = Number(b.dataset.mute);
    setMute(i, !cur.s.mute[i]);
  } else if (b.dataset.solo != null) {
    const i = Number(b.dataset.solo);
    cur.s.solo[i] = !cur.s.solo[i];
    api.changeTrackSolo([score.tracks[i]], cur.s.solo[i]);
    saveSong();
    updateMixUi();
  }
});
$('#muteMine').addEventListener('change', (e) => { if (score) setMute(shown, e.target.checked); });

// ---------------------------------------------------------------- görünüm
function updateViewUi() {
  const info = cur?.tracks[shown];
  const kind = info?.kind;
  const fixed = !!info && !info.tab;
  $$('#segStave button').forEach((b) => {
    b.setAttribute('aria-pressed', String(b.dataset.v === prefs.stave));
    b.disabled = fixed;
  });
  $('#staveNote').hidden = !fixed;
  $('#staveNote').textContent = kind === 'davul' ? 'Davul partisi her zaman nota olarak gösterilir.' : 'Bu partinin tabı yok, dosyadaki haliyle (nota) gösterilir.';
  $$('#segLayout button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === prefs.layout)));
  $('#zoomOut').textContent = `%${Math.round(prefs.scale * 100)}`;
  $('#follow').checked = prefs.follow;
  $('#wake').checked = prefs.wake;
}

function rerender() {
  if (!api || !score) return;
  applyDisplay();
  api.render();
}

$('#segStave').addEventListener('click', (e) => {
  const v = e.target.closest('button')?.dataset.v;
  if (!v || v === prefs.stave) return;
  prefs.stave = v;
  savePrefs();
  updateViewUi();
  rerender();
});
$('#segLayout').addEventListener('click', (e) => {
  const v = e.target.closest('button')?.dataset.v;
  if (!v || v === prefs.layout) return;
  prefs.layout = v;
  savePrefs();
  updateViewUi();
  rerender();
});
$('#p-view').addEventListener('click', (e) => {
  const z = e.target.closest('[data-zoom]')?.dataset.zoom;
  if (!z) return;
  prefs.scale = Math.round(clamp(prefs.scale + Number(z), 0.5, 2) * 10) / 10;
  savePrefs();
  updateViewUi();
  rerender();
});
$$('[data-theme-seg]').forEach((seg) => seg.addEventListener('click', (e) => {
  const v = e.target.closest('button')?.dataset.v;
  if (!v) return;
  prefs.theme = v;
  prefs.dark = v === 'gece'; // aynı adresteki eski sürüm (önizleme) de koyu notayı göstersin
  savePrefs();
  applyTheme();
  rerender();
}));
$('#follow').addEventListener('change', (e) => {
  prefs.follow = e.target.checked;
  savePrefs();
  if (api) applyDisplay();
});
$('#wake').addEventListener('change', (e) => {
  prefs.wake = e.target.checked;
  savePrefs();
  if (!prefs.wake) releaseWake(); else if (playing) requestWake();
});

// ---------------------------------------------------------------- paneller ve kontroller
function closePanels() {
  $$('.panel').forEach((p) => { p.hidden = true; });
  if (loopTapStart != null) { loopTapStart = null; if (cur) updateLoopUi(); }
  $$('[data-panel]').forEach((b) => b.setAttribute('aria-expanded', 'false'));
}
function togglePanel(name) {
  const p = $(`#p-${name}`);
  const open = p.hidden;
  closePanels();
  if (!open) return;
  p.hidden = false;
  $$(`[data-panel="${name}"]`).forEach((b) => b.setAttribute('aria-expanded', 'true'));
}
$$('[data-panel]').forEach((b) => b.addEventListener('click', () => togglePanel(b.dataset.panel)));
$$('.panel [data-close]').forEach((b) => b.addEventListener('click', closePanels));

function updateAll() {
  updateSpeedUi();
  updateLoopUi();
  updateMixUi();
  updateViewUi();
  updateBarLabel();
  updatePlayButton();
}

$('#btnPlay').addEventListener('click', togglePlay);
$('#btnStart').addEventListener('click', () => {
  if (!api) return;
  if (cur?.s.loop.on && api.playbackRange) api.tickPosition = api.playbackRange.startTick;
  else { stop(); curBar = 0; updateBarLabel(); }
});
// Listeden açıldıysa geri düğmesi tarayıcı geçmişini kullanır (Android geri tuşuyla aynı davranır).
// Şarkı kütüphaneye, egzersiz egzersiz listesine döner.
let cameFromList = false;
$('#btnBack').addEventListener('click', () => {
  if (cameFromList) history.back();
  else location.hash = cur?.ex ? '#/egzersiz' : '#/';
});

const seek = $('#seek');
seek.addEventListener('input', () => {
  seeking = true;
  if (endTime) $('#posTime').textContent = `${fmtTime((seek.value / 1000) * endTime)} / ${fmtTime(endTime)}`;
});
seek.addEventListener('change', () => {
  if (api && endTime) api.timePosition = (seek.value / 1000) * endTime;
  seeking = false;
});

addEventListener('keydown', (e) => {
  if (!$('#metroView').hidden && e.key === ' ' && !e.target.closest('input, select, textarea, dialog, button')) {
    e.preventDefault();
    toggleMetro();
    return;
  }
  if ($('#playerView').hidden || !api) return;
  if (e.target.closest('input, select, textarea, dialog') || e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key === ' ' || e.key === 'PageDown' || e.key === 'MediaPlayPause') {
    e.preventDefault();
    togglePlay();
  } else if (e.key === 'ArrowRight') { e.preventDefault(); goBar(curBar + 1); }
  else if (e.key === 'ArrowLeft') { e.preventDefault(); goBar(curBar - 1); }
  else if (e.key === 'Home') { e.preventDefault(); $('#btnStart').click(); }
  else if (e.key === 'Escape') closePanels();
  else if (e.key === '+' || e.key === '=') setSpeed(currentSpeed() + 5);
  else if (e.key === '-') setSpeed(currentSpeed() - 5);
});

// Ekranı açık tut
let wakeLock = null;
async function requestWake() {
  if (!prefs.wake || wakeLock || !('wakeLock' in navigator) || document.hidden) return;
  try {
    wakeLock = await navigator.wakeLock.request('screen');
    wakeLock.addEventListener('release', () => { wakeLock = null; });
  } catch { /* desteklenmiyor ya da izin yok */ }
}
function releaseWake() {
  wakeLock?.release().catch(() => {});
  wakeLock = null;
}
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && (playing || metro.running)) requestWake();
});

// ---------------------------------------------------------------- çalışma süresi
// Gerçek çalma süresi (sayma dahil): çalar çalarken geçen zaman. Her 15 sn'de ve durunca günün
// kaydına eklenir (db.addPractice). Egzersizde: çalınınca `played` (listede "Son: … BPM" ancak o
// zaman görünür), o gün en az PRACTICED_SEC çalınınca `done` (plandaki ✓ ve öneri sırası), en az
// BPM_SEC aynı tempoda çalınınca `best` (hedef tempoya ulaşıldı mı).
const PRACTICED_SEC = 20;
const BPM_SEC = 8;
let playClock = 0; // çalmanın başladığı ya da son yazıldığı an (performance.now); 0 = durmuş
let practiceTimer = 0;
// Yazmalar sırayla; listeler okumadan önce bekler (yoksa az önce çalınan görünmeyebilir)
let practiceQueue = Promise.resolve();
const pad2 = (n) => String(n).padStart(2, '0');
const dayKey = (t = Date.now()) => { const d = new Date(t); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; };

function practiceStart() {
  if (playClock) return;
  playClock = performance.now();
  practiceTimer = setInterval(practiceTick, 15000);
}
function practiceStop() {
  practiceTick();
  playClock = 0;
  clearInterval(practiceTimer);
}
function practiceTick() {
  if (!playClock || !cur) return;
  const now = performance.now();
  // Cihaz uyuyup uyanınca aradaki süre sayılmasın (yazma aralığı 15 sn)
  const sec = Math.min(30, (now - playClock) / 1000);
  playClock = now;
  const song = cur;
  practiceQueue = practiceQueue.then(() => addPractice(song, sec));
}

async function addPractice(song, sec) {
  if (!song || sec < 0.5) return;
  const ex = song.ex;
  const bpm = Math.round(ex ? song.s.speed : ((song.tempo || 0) * song.s.speed) / 100);
  const steady = sec >= BPM_SEC && bpm > 0;
  let item;
  try {
    item = await db.addPractice(dayKey(), song.id, {
      sec, bpm: steady ? bpm : 0, title: song.title, kind: ex ? 'ex' : 'song', inst: ex?.inst,
    });
  } catch (e) {
    console.warn('Çalışma süresi kaydedilemedi', e);
    return;
  }
  if (!ex) return;
  song.played = Date.now();
  if (steady) song.best = Math.max(song.best || 0, bpm);
  if (item.sec >= PRACTICED_SEC) song.done = Date.now();
  await db.putEx(exRecord(song)).catch((e) => console.warn('Kaydedilemedi', e));
}
// Testler için: açık şarkı ya da egzersiz o kadar süre çalınmış gibi
window.ttpPractice = (sec) => { const song = cur; practiceQueue = practiceQueue.then(() => addPractice(song, sec)); return practiceQueue; };
document.addEventListener('visibilitychange', () => { if (document.hidden) practiceTick(); });
addEventListener('pagehide', practiceTick);

// ---------------------------------------------------------------- egzersizler
const exInst = () => prefs.exInst || (prefs.instrument === 'davul' ? 'davul' : 'gitar');
let exProgress = new Map();

async function showExercises() {
  showView('exView');
  document.title = 'Egzersizler · Tab-to-Play';
  renderExList();
  await practiceQueue;
  try { exProgress = new Map((await db.allEx()).map((r) => [r.id, r])); } catch { exProgress = new Map(); }
  renderExList();
}

function renderExList() {
  const inst = exInst();
  // Ölçüler sekmesi ayrı tercihte (exOlcu): exLevel hep eski üç seviyeden biri kalır, Ölçüler'i
  // bilmeyen eski sürüm (aynı adresteki önizleme ya da önbellekteki eski sayfa) boş liste göstermez.
  const level = prefs.exOlcu ? 'olcu' : (LEVELS[prefs.exLevel] ? prefs.exLevel : 'baslangic');
  $$('#segExInst button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === inst)));
  $$('#segExLevel button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === level)));
  const list = EXERCISES.filter((x) => x.inst === inst && x.level === level);
  $('#exList').replaceChildren(...list.map((x) => exRow(x)));
}

// Egzersiz satırı; planda hedef tempo ve bugün çalışıldıysa ✓
const exTarget = (x) => Math.round((x.bpm + x.max) / 2 / 5) * 5;
function exRow(x, { plan = false } = {}) {
  const rec = exProgress.get(x.id);
  // Yalnızca açıp çıkmak "son tempo" sayılmaz; gerçekten çalınmış olmalı
  const last = rec?.played ? rec.s?.speed : null;
  const meta = el('span', { class: 'ex-meta' });
  const ts = tsLabel(x);
  if (ts) meta.append(el('span', { class: 'ts', text: ts }));
  if (x.diff) meta.append(el('span', { class: 'diff', text: LEVELS[x.diff] }));
  meta.append(el('span', { text: `Önerilen ${x.min}–${x.max} BPM` }));
  if (last) meta.append(el('span', { class: 'last', text: `Son: ${last} BPM` }));
  const main = el('button', { class: 'ex-main', type: 'button', 'data-id': x.id },
    el('span', { class: 'ex-title', text: x.title }),
    el('span', { class: 'ex-desc-l', text: x.desc }),
    meta);
  if (last) {
    const pct = clamp(Math.round(((last - x.min) / (x.max - x.min)) * 100), 0, 100);
    main.append(el('span', { class: 'ex-prog', 'aria-hidden': 'true' }, el('i', { style: `width:${pct}%` })));
  }
  if (plan) {
    const t = exTarget(x);
    const ok = (rec?.best || 0) >= t; // hedef tempoda en az birkaç saniye çalındı
    meta.append(el('span', { class: ok ? 'last' : '', text: ok ? `Hedef ${t} BPM ✓` : `Hedef ${t} BPM` }));
    // ✓ ekran okuyucuda "onay işareti" diye okunmasın: görünmez metinle anlatılır
    if (isToday(rec?.done)) {
      main.querySelector('.ex-title').append(el('span', { class: 'done', 'aria-hidden': 'true', text: ' ✓' }), el('span', { class: 'sr-only', text: ' (bugün çalışıldı)' }));
    }
  }
  return el('li', { class: 'ex-item' }, main);
}

$('#btnEx').addEventListener('click', () => { location.hash = '#/egzersiz'; });
$('#exBack').addEventListener('click', () => {
  if (lastView === 'exlist' && cameToExFrom === 'lib') history.back();
  else location.hash = '#/';
});
$('#segExInst').addEventListener('click', (e) => {
  const v = e.target.closest('button')?.dataset.v;
  if (!v) return;
  prefs.exInst = v;
  savePrefs();
  renderExList();
});
$('#segExLevel').addEventListener('click', (e) => {
  const v = e.target.closest('button')?.dataset.v;
  if (!v) return;
  prefs.exOlcu = v === 'olcu';
  if (v !== 'olcu') prefs.exLevel = v;
  savePrefs();
  renderExList();
});
$('#exList').addEventListener('click', (e) => {
  const id = e.target.closest('[data-id]')?.dataset.id;
  if (id) location.hash = `#/egzersiz/${id}`;
});

// ---------------------------------------------------------------- çalışma planı
// Egzersiz listesinde seçili enstrümanın planı; seçili aşama her enstrüman için ayrı
const stageKey = (inst) => (inst === 'davul' ? 'planStageDavul' : 'planStage');
async function showPlan() {
  showView('planView');
  const title = `${KIND_LABEL[exInst()]} çalışma planı`;
  $('#planTitle').textContent = title;
  document.title = `${title} · Tab-to-Play`;
  renderPlan();
  await practiceQueue;
  try { exProgress = new Map((await db.allEx()).map((r) => [r.id, r])); } catch { exProgress = new Map(); }
  renderPlan();
}

function renderPlan() {
  const inst = exInst();
  const plan = PLANS[inst];
  const k = clamp(Math.round(prefs[stageKey(inst)]) || 0, 0, plan.stages.length - 1);
  const st = plan.stages[k];
  $$('#segStage button').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.v) === k)));
  const ids = stageIds(plan, st);
  const reached = ids.filter((id) => (exProgress.get(id)?.best || 0) >= exTarget(findExercise(id))).length;
  $('#planWhen').textContent = `${st.when} · Hedef tempoya ulaştığın egzersiz: ${reached}/${ids.length}`;

  let n = 0;
  const steps = plan.steps.map((step) => el('li', { class: 'plan-step' },
    el('div', { class: 'plan-step-h' }, el('b', { text: `${++n}. ${step.title}` }), el('span', { class: 'muted', text: ` · ${step.min} dk` })),
    el('ul', { class: 'ex-list' }, ...pick(st[step.key], step.n, exProgress).map((id) => exRow(findExercise(id), { plan: true })))));
  steps.push(el('li', { class: 'plan-step' },
    el('div', { class: 'plan-step-h' }, el('b', { text: `${++n}. Şarkı` }), el('span', { class: 'muted', text: ' · 5+ dk' })),
    el('p', { class: 'muted small', text: 'Bugün çalıştığın tekniği kütüphanendeki bir şarkıda dene. Zor bölümü döngüye al, hızı düşür, aynı kurallarla yavaş yavaş artır.' }),
    el('button', { class: 'btn', type: 'button', 'data-go': 'lib', text: 'Kütüphaneye git' })));
  $('#planToday').replaceChildren(...steps);

  $('#planRules').replaceChildren(...plan.rules.map((r) => el('li', { text: r })));
  $('#planNext').replaceChildren(...(st.next
    ? [el('b', { text: 'Sonraki aşamaya ne zaman geçmeli? ' }), st.next]
    : [el('b', { text: 'Bundan sonra: ' }), 'şarkılarda zorlandığın bölümleri döngüye al ve aynı kurallarla çalış; zorlandığın tekniğin egzersizine geri dön.']));
  $('#planAll').replaceChildren(...plan.steps.map((step) => el('section', { class: 'plan-group' },
    el('h3', { text: step.title }),
    el('ul', { class: 'ex-list' }, ...st[step.key].map((id) => exRow(findExercise(id), { plan: true }))))));
}

$('#btnPlan').addEventListener('click', () => { location.hash = '#/plan'; });
$('#planBack').addEventListener('click', () => {
  if (lastView === 'plan' && cameToPlanFrom === 'exlist') history.back();
  else location.hash = '#/egzersiz';
});
$('#segStage').addEventListener('click', (e) => {
  const v = e.target.closest('button')?.dataset.v;
  if (v == null) return;
  prefs[stageKey(exInst())] = Number(v);
  savePrefs();
  renderPlan();
});
$('#planView').addEventListener('click', (e) => {
  if (e.target.closest('[data-go="lib"]')) { location.hash = '#/'; return; }
  const id = e.target.closest('[data-id]')?.dataset.id;
  if (id) location.hash = `#/egzersiz/${id}`;
});

// ---------------------------------------------------------------- çalışma geçmişi ekranı
const MONTHS = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
const WEEKDAYS = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
const keyDate = (key) => { const [y, m, d] = key.split('-').map(Number); return new Date(y, m - 1, d); };
const dayShort = (key) => { const d = keyDate(key); return `${d.getDate()} ${MONTHS[d.getMonth()]}`; };
const dayLong = (key) => `${dayShort(key)} ${WEEKDAYS[keyDate(key).getDay()]}`;
const fmtDur = (sec) => {
  if (sec < 60) return `${Math.round(sec)} sn`;
  if (sec < 3600) return `${Math.round(sec / 60)} dk`;
  const m = Math.round(sec / 60);
  return `${Math.floor(m / 60)} sa ${m % 60} dk`;
};
const daysBack = (n, now = Date.now()) => Array.from({ length: n }, (_, i) => {
  const d = new Date(now);
  d.setDate(d.getDate() - (n - 1 - i));
  return dayKey(d);
});
// Seri: art arda en az bir dakika çalışılan günler. Bugün henüz çalışılmadıysa seri dünden sayılır.
function streak(days, now = Date.now()) {
  const on = new Set(days.filter((d) => d.sec >= 60).map((d) => d.day));
  const t = new Date(now);
  if (!on.has(dayKey(t))) t.setDate(t.getDate() - 1);
  let n = 0;
  while (on.has(dayKey(t))) { n++; t.setDate(t.getDate() - 1); }
  return n;
}

let histDays = [];
let histEx = null; // tempo grafiğinde seçili egzersiz
async function showHistory() {
  showView('histView');
  document.title = 'Çalışma geçmişi · Tab-to-Play';
  await practiceQueue;
  try { histDays = (await db.allDays()).sort((a, b) => (a.day < b.day ? -1 : 1)); } catch { histDays = []; }
  renderHistory();
}

function renderHistory() {
  const byDay = new Map(histDays.map((d) => [d.day, d]));
  const week = daysBack(7).reduce((a, k) => a + (byDay.get(k)?.sec || 0), 0);
  const total = histDays.reduce((a, d) => a + d.sec, 0);
  const n = streak(histDays);
  $('#hStreak').textContent = `${n} gün`;
  // Kutular dar: bir saatten uzunu ondalıklı saat
  const tile = (sec) => (sec >= 3600 ? `${(sec / 3600).toFixed(1).replace('.', ',')} sa` : fmtDur(sec));
  $('#hWeek').textContent = tile(week);
  $('#hTotal').textContent = tile(total);
  $('#hEmpty').hidden = histDays.length > 0;
  $('#hBody').hidden = histDays.length === 0;
  if (!histDays.length) return;

  // Son 14 gün: dakika
  const keys = daysBack(14);
  columnChart($('#hDays'), $('#hDaysSel'), keys.map((k) => ({
    v: (byDay.get(k)?.sec || 0) / 60,
    x: String(keyDate(k).getDate()),
    cap: `${dayLong(k)}: ${fmtDur(byDay.get(k)?.sec || 0)}`,
  })));

  // Tempo gelişimi: en son çalışılan egzersiz önce
  const last = new Map();
  for (const d of histDays) for (const [id, it] of Object.entries(d.items)) if (it.kind === 'ex' && it.bpm && findExercise(id)) last.set(id, d.day);
  const exIds = [...last.keys()].sort((a, b) => (last.get(a) < last.get(b) ? 1 : -1));
  $('#hTempoBox').hidden = !exIds.length;
  if (exIds.length) {
    if (!exIds.includes(histEx)) histEx = exIds[0];
    $('#hEx').replaceChildren(...exIds.map((id) => {
      const x = findExercise(id);
      return el('option', { value: id, text: `${KIND_LABEL[x.inst]} · ${x.title}` });
    }));
    $('#hEx').value = histEx;
    const x = findExercise(histEx);
    const pts = histDays.filter((d) => d.items[histEx]?.bpm).slice(-20)
      .map((d) => ({ v: d.items[histEx].bpm, x: dayShort(d.day), cap: `${dayLong(d.day)}: ${d.items[histEx].bpm} BPM · ${fmtDur(d.items[histEx].sec)}` }));
    lineChart($('#hTempo'), $('#hTempoSel'), pts, { ref: exTarget(x), refLabel: `Hedef ${exTarget(x)}` });
  }

  // Günler (grafiklerin tablo karşılığı): en yeni gün önce
  $('#hList').replaceChildren(...[...histDays].reverse().slice(0, 30).map((d) => el('li', { class: 'hist-day' },
    el('div', { class: 'hist-day-h' }, el('b', { text: dayLong(d.day) }), el('span', { class: 'muted', text: ` · ${fmtDur(d.sec)}` })),
    el('ul', {}, ...Object.values(d.items).sort((a, b) => b.sec - a.sec).map((it) => el('li', {},
      el('span', { text: it.title }),
      el('span', { class: 'muted', text: ` · ${fmtDur(it.sec)}${it.bpm && it.kind === 'ex' ? ` · ${it.bpm} BPM` : ''}` })))))));
}

$('#hEx').addEventListener('change', (e) => { histEx = e.target.value; renderHistory(); });
$('#btnHist').addEventListener('click', () => { location.hash = '#/gecmis'; });
$('#histBack').addEventListener('click', () => {
  if (lastView === 'hist' && cameToHistFrom) history.back();
  else location.hash = '#/egzersiz';
});

// Küçük SVG grafikler (tek seri, gösterge kutusu yok: başlık neyi gösterdiğini söyler). İnce
// işaretler, saç teli ızgara; bir işarete dokununca ya da üzerine gelince değeri alttaki satırda
// yazılır, ekran okuyucu her işaretin etiketini okur. Renkler CSS'ten (temaya uyar).
const SVGNS = 'http://www.w3.org/2000/svg';
function svgEl(tag, attrs = {}, text = null) {
  const e = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (text != null) e.textContent = text;
  return e;
}
// Eksen için yuvarlak adım: 1, 2, 5 × 10^k
function niceStep(range, count = 3) {
  const raw = range / count;
  const p = 10 ** Math.floor(Math.log10(raw || 1));
  return [1, 2, 5, 10].map((m) => m * p).find((x) => x >= raw) || raw;
}
const CW = 340;
const CH = 150;
const PAD = { l: 34, r: 8, t: 12, b: 22 };
function chartFrame(box, ticks, y) {
  const svg = svgEl('svg', { viewBox: `0 0 ${CW} ${CH}`, class: 'chart-svg', role: 'img' });
  for (const t of ticks) {
    svg.append(svgEl('line', { class: 'grid', x1: PAD.l, x2: CW - PAD.r, y1: y(t), y2: y(t) }));
    svg.append(svgEl('text', { class: 'tick', x: PAD.l - 6, y: y(t) + 3.5, 'text-anchor': 'end' }, String(t)));
  }
  box.replaceChildren(svg);
  return svg;
}
// Dokunulabilir alan (işaretten büyük): değeri yazar, seçili işareti belirginleştirir
function hitArea(svg, sel, mark, x, w, cap) {
  const r = svgEl('rect', { class: 'hit', x, y: 0, width: w, height: CH, tabindex: '0', 'aria-label': cap });
  r.append(svgEl('title', {}, cap));
  const on = () => {
    svg.querySelectorAll('.on').forEach((m) => m.classList.remove('on'));
    mark?.classList.add('on');
    sel.textContent = cap;
  };
  for (const ev of ['pointerenter', 'click', 'focus']) r.addEventListener(ev, on);
  svg.append(r);
}

function columnChart(box, sel, data) {
  const max = Math.max(...data.map((d) => d.v), 1);
  const step = niceStep(max);
  const top = Math.ceil(max / step) * step;
  const y0 = CH - PAD.b;
  const y = (v) => y0 - (v / top) * (y0 - PAD.t);
  const svg = chartFrame(box, Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step), y);
  const band = (CW - PAD.l - PAD.r) / data.length;
  const w = Math.min(16, band - 6);
  data.forEach((d, i) => {
    const x = PAD.l + i * band + (band - w) / 2;
    let bar = null;
    const h = y0 - y(d.v);
    if (h >= 1) {
      // Uç yuvarlak (4 px), taban düz
      const r = Math.min(4, h, w / 2);
      const t = y0 - h;
      bar = svgEl('path', { class: 'mark', d: `M${x},${y0}V${t + r}Q${x},${t} ${x + r},${t}H${x + w - r}Q${x + w},${t} ${x + w},${t + r}V${y0}Z` });
      svg.append(bar);
    }
    if (i % 2 === (data.length - 1) % 2) svg.append(svgEl('text', { class: 'tick', x: x + w / 2, y: CH - 6, 'text-anchor': 'middle' }, d.x));
    hitArea(svg, sel, bar, PAD.l + i * band, band, d.cap);
  });
  svg.setAttribute('aria-label', 'Son 14 günde günlük çalışma süresi (dakika)');
  sel.textContent = data.at(-1).cap;
}

function lineChart(box, sel, data, { ref, refLabel }) {
  const vals = [...data.map((d) => d.v), ref];
  const step = niceStep(Math.max(...vals) - Math.min(...vals) + 10, 3);
  const lo = Math.floor((Math.min(...vals) - 2) / step) * step;
  const hi = Math.ceil((Math.max(...vals) + 2) / step) * step;
  const y = (v) => CH - PAD.b - ((v - lo) / (hi - lo)) * (CH - PAD.b - PAD.t);
  const ticks = [];
  for (let t = lo; t <= hi + 1e-9; t += step) ticks.push(t);
  const svg = chartFrame(box, ticks, y);
  const span = CW - PAD.l - PAD.r - 16;
  const x = (i) => PAD.l + 8 + (data.length > 1 ? (i / (data.length - 1)) * span : span / 2);
  // Hedef: ince referans çizgisi, sağda etiket
  svg.append(svgEl('line', { class: 'ref', x1: PAD.l, x2: CW - PAD.r, y1: y(ref), y2: y(ref) }));
  svg.append(svgEl('text', { class: 'tick', x: CW - PAD.r, y: y(ref) - 4, 'text-anchor': 'end' }, refLabel));
  if (data.length > 1) svg.append(svgEl('path', { class: 'line', d: data.map((d, i) => `${i ? 'L' : 'M'}${x(i)},${y(d.v)}`).join('') }));
  const band = data.length > 1 ? span / (data.length - 1) : span;
  data.forEach((d, i) => {
    const dot = svgEl('circle', { class: 'dot', cx: x(i), cy: y(d.v), r: 4 });
    svg.append(dot);
    hitArea(svg, sel, dot, x(i) - band / 2, band, d.cap);
  });
  svg.append(svgEl('text', { class: 'tick', x: x(0), y: CH - 6, 'text-anchor': data.length > 1 ? 'start' : 'middle' }, data[0].x));
  if (data.length > 1) svg.append(svgEl('text', { class: 'tick', x: x(data.length - 1), y: CH - 6, 'text-anchor': 'end' }, data.at(-1).x));
  svg.setAttribute('aria-label', 'Egzersizde gün gün çalınan en yüksek tempo (BPM)');
  sel.textContent = data.at(-1).cap;
}

// ---------------------------------------------------------------- tek başına metronom
const metro = new Metronome();
window.ttpMetro = metro; // testler için

function applyMetroPrefs() {
  metro.bpm = clamp(Math.round(prefs.mBpm) || 80, EX_BPM_MIN, EX_BPM_MAX);
  metro.beats = clamp(Math.round(prefs.mBeats) || 4, 2, 7);
  metro.sub = clamp(Math.round(prefs.mSub) || 1, 1, 4);
  metro.accent = !!prefs.mAccent;
  metro.vol = clamp(prefs.mVol, 10, 100) / 100;
}

function updateMetroUi() {
  $('#mBpm').textContent = metro.bpm;
  $('#mRange').value = metro.bpm;
  $$('#segBeats button').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.v) === metro.beats)));
  $$('#segSub button').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.v) === metro.sub)));
  $('#mAccent').checked = metro.accent;
  $('#mVol').value = Math.round(metro.vol * 100);
  $('use', $('#mPlay')).setAttribute('href', metro.running ? '#i-pause' : '#i-play');
  $('#mPlay span').textContent = metro.running ? 'Durdur' : 'Başlat';
  $('#mPlay').setAttribute('aria-pressed', String(metro.running));
  const dots = $('#mBeats');
  if (dots.children.length !== metro.beats) {
    dots.replaceChildren(...Array.from({ length: metro.beats }, (_, i) => el('i', { class: i === 0 ? 'first' : '' })));
  }
}

metro.onBeat = (beat) => {
  [...$('#mBeats').children].forEach((d, i) => d.classList.toggle('on', i === beat));
};

function showMetronome() {
  showView('metroView');
  document.title = 'Metronom · Tab-to-Play';
  applyMetroPrefs();
  updateMetroUi();
}

function setMetroBpm(v) {
  prefs.mBpm = clamp(Math.round(v), EX_BPM_MIN, EX_BPM_MAX);
  savePrefs();
  applyMetroPrefs();
  updateMetroUi();
}

function toggleMetro() {
  metro.toggle();
  if (metro.running) requestWake(); else releaseWake();
  updateMetroUi();
}

$('#btnMetro').addEventListener('click', () => { location.hash = '#/metronom'; });
$('#mBack').addEventListener('click', () => {
  if (lastView === 'metro' && cameToMetroFrom === 'exlist') history.back();
  else location.hash = '#/egzersiz';
});
$('#mPlay').addEventListener('click', toggleMetro);
$('#metroView').addEventListener('click', (e) => {
  const d = e.target.closest('[data-mb]')?.dataset.mb;
  if (d) setMetroBpm(metro.bpm + Number(d));
});
$('#mRange').addEventListener('input', (e) => setMetroBpm(Number(e.target.value)));
$('#mTap').addEventListener('click', tapper((bpm) => {
  if (bpm == null) { toast('Tempoda dokunmaya devam et', 1500); return; }
  setMetroBpm(bpm);
}, { min: EX_BPM_MIN, max: EX_BPM_MAX }));
$('#segBeats').addEventListener('click', (e) => {
  const v = Number(e.target.closest('button')?.dataset.v);
  if (!v) return;
  prefs.mBeats = v;
  savePrefs();
  applyMetroPrefs();
  metro.restartBar();
  updateMetroUi();
});
$('#segSub').addEventListener('click', (e) => {
  const v = Number(e.target.closest('button')?.dataset.v);
  if (!v) return;
  prefs.mSub = v;
  savePrefs();
  applyMetroPrefs();
  metro.restartBar();
  updateMetroUi();
});
$('#mAccent').addEventListener('change', (e) => {
  prefs.mAccent = e.target.checked;
  savePrefs();
  applyMetroPrefs();
});
$('#mVol').addEventListener('input', (e) => {
  prefs.mVol = Number(e.target.value);
  savePrefs();
  applyMetroPrefs();
});

// ---------------------------------------------------------------- ayarlar ve ilk açılış
function updateInstSeg() {
  $$('#segInst button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === prefs.instrument)));
}
$('#btnSettings').addEventListener('click', async () => {
  updateInstSeg();
  $('#ver').textContent = `v${VERSION} (${BUILD})`;
  $('#backupInfo').textContent = backupInfo();
  const info = $('#storageInfo');
  info.textContent = `${songs.length} şarkı`;
  try {
    const est = await navigator.storage?.estimate?.();
    const persisted = await navigator.storage?.persisted?.();
    if (est?.usage != null) info.textContent += ` · yaklaşık ${(est.usage / 1048576).toFixed(1)} MB kullanılıyor`;
    if (persisted) info.textContent += ' · kalıcı depolama açık';
  } catch { /* yok */ }
  $('#settingsDlg').showModal();
});
$('#settingsDlg [data-close-dlg]').addEventListener('click', () => $('#settingsDlg').close());
$('#settingsDlg').addEventListener('click', (e) => { if (e.target === e.currentTarget) e.currentTarget.close(); });
$('#segInst').addEventListener('click', (e) => {
  const v = e.target.closest('button')?.dataset.v;
  if (!v) return;
  prefs.instrument = v;
  savePrefs();
  updateInstSeg();
  renderList();
});
$('#instGrid').addEventListener('click', (e) => {
  const v = e.target.closest('[data-inst]')?.dataset.inst;
  if (!v) return;
  prefs.instrument = v;
  savePrefs();
  $('#instDlg').close();
  renderList();
});

// ---------------------------------------------------------------- yedekleme ve taşıma
// Bütün veriler tek dosyada (js/yedek.js). Geri yüklenince sayfa yenilenir: tercihler, listeler ve
// açık ekranlar yedekten gelenle baştan kurulsun.
function backupInfo() {
  const t = prefs.lastBackup;
  if (!t) return 'Henüz yedek alınmadı.';
  const days = Math.floor((Date.now() - t) / 864e5);
  return `Son yedek: ${days === 0 ? 'bugün' : days === 1 ? 'dün' : `${days} gün önce`}.`;
}
$('#btnBackup').addEventListener('click', async () => {
  const btn = $('#btnBackup');
  btn.disabled = true;
  try {
    const data = await makeBackup(prefs, VERSION);
    const name = `tab-to-play-yedek-${dayKey()}.json`;
    const file = new File([JSON.stringify(data)], name, { type: 'application/json' });
    // Telefonda paylaşım menüsü (Dosyalara kaydet, AirDrop…), olmazsa indirme
    let shared = false;
    if (navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file], title: 'Tab-to-Play yedeği' }); shared = true; } catch (e) {
        if (e.name === 'AbortError') return;
      }
    }
    if (!shared) {
      const a = el('a', { href: URL.createObjectURL(file), download: name });
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 10000);
    }
    prefs.lastBackup = Date.now();
    savePrefs();
    $('#backupInfo').textContent = backupInfo();
    toast(`Yedek hazır: ${data.songs.length} şarkı`);
  } catch (e) {
    console.warn('Yedek alınamadı', e);
    toast('Yedek alınamadı', 4000);
  } finally {
    btn.disabled = false;
  }
});
$('#backupIn').addEventListener('change', async (e) => {
  const f = e.target.files[0];
  e.target.value = '';
  if (!f) return;
  let data;
  try { data = JSON.parse(await f.text()); } catch { data = null; }
  if (data?.app !== 'tab-to-play') { toast('Bu dosya bir Tab-to-Play yedeği değil', 4000); return; }
  if (!confirm(`Yedekteki ${data.songs.length} şarkı, ilerleme ve geçmiş bu cihazdakilerle birleştirilecek; ayarlar yedektekiyle değişecek. Devam edilsin mi?`)) return;
  try {
    const n = await restoreBackup(data);
    if (data.prefs) Object.assign(prefs, data.prefs, { lastBackup: prefs.lastBackup });
    savePrefs();
    sessionStorage.setItem('ttp-geri-yuklendi', `Yedek yüklendi: ${n.songs} yeni şarkı, ${n.exercises} egzersiz, ${n.days} gün`);
  } catch (err) {
    console.warn('Yedek yüklenemedi', err);
    toast(err.message === 'yeni sürüm yedeği' ? 'Bu yedek daha yeni bir sürümden; önce uygulamayı güncelle' : 'Yedek yüklenemedi', 4000);
    return;
  }
  location.reload();
});

// ---------------------------------------------------------------- yönlendirme
let lastView = null;
let cameToExFrom = null; // egzersiz listesine nereden gelindi (geri düğmesi için)
let cameToMetroFrom = null;
let cameToPlanFrom = null;
let cameToHistFrom = null;
async function route() {
  const h = location.hash;
  let m;
  if ((m = h.match(/^#\/sarki\/([\w-]+)/))) {
    cameFromList = lastView === 'lib';
    lastView = 'player';
    await openSong(m[1]);
  } else if ((m = h.match(/^#\/egzersiz\/([\w-]+)/))) {
    cameFromList = lastView === 'exlist' || lastView === 'plan';
    lastView = 'player';
    await openExercise(m[1]);
  } else if (/^#\/egzersiz\/?$/.test(h)) {
    if (!['player', 'metro', 'plan', 'hist'].includes(lastView)) cameToExFrom = lastView;
    lastView = 'exlist';
    await showExercises();
  } else if (/^#\/plan\/?$/.test(h)) {
    if (lastView !== 'player') cameToPlanFrom = lastView;
    lastView = 'plan';
    await showPlan();
  } else if (/^#\/gecmis\/?$/.test(h)) {
    cameToHistFrom = lastView === 'exlist' || lastView === 'plan' ? lastView : null;
    lastView = 'hist';
    await showHistory();
  } else if (/^#\/metronom\/?$/.test(h)) {
    cameToMetroFrom = lastView;
    lastView = 'metro';
    showMetronome();
  } else {
    lastView = 'lib';
    await showLibrary();
  }
}
addEventListener('hashchange', route);

// iPhone'da sessiz moddayken de ses gelsin (iOS 17+)
try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch { /* yok */ }

// Yeni sürüm: service worker yeni sürümü kurup devralınca açık sayfalara kendi sürümünü bildirir
// (sw.js). Sayfa eski sürümdeyse yenilemesi söylenir; çalarken sayfayı kendiliğinden yenilemeyiz.
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').then((reg) => {
    // Ana ekrandaki uygulama günlerce açık kalabiliyor: öne gelince yeni sürüm var mı diye bak
    document.addEventListener('visibilitychange', () => { if (!document.hidden) reg.update().catch(() => {}); });
  }).catch((e) => console.warn('Service worker kaydedilemedi', e));
  navigator.serviceWorker.addEventListener('message', (e) => {
    if (e.data?.type === 'surum' && e.data.build !== BUILD) $('#updateBar').hidden = false;
  });
}
$('#btnReload').addEventListener('click', () => location.reload());
$('#updateClose').addEventListener('click', () => { $('#updateBar').hidden = true; });

(async function start() {
  if (new URLSearchParams(location.search).has('gelen')) history.replaceState(null, '', location.pathname + location.hash);
  // Yedekten geri yüklendikten sonraki yenileme: ne yüklendiğini söyle
  const restored = sessionStorage.getItem('ttp-geri-yuklendi');
  if (restored) { sessionStorage.removeItem('ttp-geri-yuklendi'); setTimeout(() => toast(restored, 4000), 300); }
  await route();
  await checkInbox();
  if (!prefs.instrument) $('#instDlg').showModal();
})();
