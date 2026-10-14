// Tab-to-Play: kütüphane ve çalar.
import { db } from './db.js';

const VERSION = '0.1.0';
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
    sort: 'recent',
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

// ---------------------------------------------------------------- kütüphane
let songs = [];
let favOnly = false;

async function showLibrary() {
  pause();
  closePanels();
  releaseWake();
  $('#playerView').hidden = true;
  $('#libView').hidden = false;
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
function flushSave() {
  clearTimeout(saveTimer);
  const song = pendingSave;
  pendingSave = null;
  if (song) db.putSong(song).catch((e) => console.warn('Kaydedilemedi', e));
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

function applyDisplay() {
  const st = api.settings;
  st.display.staveProfile = staveFor(cur?.tracks[shown]);
  // Yalnızca tab gösterilirken ritim (sap ve kirişler) tabın altına çizilsin
  st.notation.rhythmMode = st.display.staveProfile === at.StaveProfile.Tab ? at.TabRhythmMode.ShowWithBars : at.TabRhythmMode.Automatic;
  st.display.layoutMode = prefs.layout === 'yatay' ? at.LayoutMode.Horizontal : at.LayoutMode.Page;
  st.display.scale = prefs.scale;
  st.player.scrollMode = prefs.follow ? at.ScrollMode.Continuous : at.ScrollMode.Off;
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
  clearTimeout(pauseTimer);
  if (api) api.stop();
  cur = song;
  song.tracks = sc.tracks.map(trackInfo); // eski kayıtları da günceller
  song.bars = sc.masterBars.length;
  songState(song);
  song.opened = Date.now();
  db.putSong(song).catch(() => {});

  $('#libView').hidden = true;
  $('#playerView').hidden = false;
  closePanels();
  $('#pTitle').textContent = song.title;
  $('#pArtist').textContent = song.artist || stripExt(song.file || '');
  document.title = `${song.title} · Tab-to-Play`;

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
  api.renderScore(sc, [shown]);
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
  api.metronomeVolume = prefs.metro ? 1 : 0;
  api.countInVolume = prefs.countIn ? 1 : 0;
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
function setSpeed(v, later = false) {
  if (!cur) return;
  const s = cur.s;
  s.speed = clamp(Math.round(v), SPEED_MIN, SPEED_MAX);
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
  $('#spOut').textContent = `%${sp}`;
  $('#spRange').value = sp;
  $('#lblSpeed').textContent = `%${sp}`;
  $('[data-panel="speed"]').classList.toggle('on', sp !== 100 || trainer.on);
  $$('[data-spv]').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.spv) === sp)));
  const tempo = score?.tempo || cur.tempo;
  $('#bpmInfo').textContent = tempo ? `Orijinal tempo ${Math.round(tempo)} BPM · şu an ${Math.round((tempo * sp) / 100)} BPM` : '';
  $('#metro').checked = prefs.metro;
  $('#countIn').checked = prefs.countIn;
  const t = cur.s.tr;
  $('#trStart').value = t.start;
  $('#trTarget').value = t.target;
  $('#trStep').value = t.step;
  $('#trEvery').value = t.every;
  $('#trBtn').textContent = trainer.on ? 'Antrenörü durdur' : 'Antrenörü başlat';
  $('#trBtn').classList.toggle('primary', !trainer.on);
  $('#trStatus').textContent = trainer.on
    ? `Çalışıyor: %${trainer.speed} (hedef %${t.target}) · ${trainer.turns}. tur`
    : '';
}

function readTrainerInputs() {
  const t = cur.s.tr;
  const num = (id, lo, hi, d) => {
    const v = Number($(id).value);
    return Number.isFinite(v) && v > 0 ? clamp(Math.round(v), lo, hi) : d;
  };
  t.start = num('#trStart', SPEED_MIN, SPEED_MAX, 60);
  t.target = num('#trTarget', SPEED_MIN, SPEED_MAX, 100);
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
  toast(`Antrenör: %${t.start} → %${t.target}`);
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
    toast(trainer.speed >= t.target ? `Hedef hıza ulaştın: %${trainer.speed}` : `Hız %${trainer.speed}`);
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
  prefs.metro = e.target.checked;
  savePrefs();
  if (api) api.metronomeVolume = prefs.metro ? 1 : 0;
});
$('#countIn').addEventListener('change', (e) => {
  prefs.countIn = e.target.checked;
  savePrefs();
  if (api) api.countInVolume = prefs.countIn ? 1 : 0;
});
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
    api.playbackRange = r;
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
  if (first && last) api.highlightPlaybackRange(first, last);
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
// Kütüphaneden açıldıysa geri düğmesi tarayıcı geçmişini kullanır (Android geri tuşuyla aynı davranır).
let cameFromLibrary = false;
$('#btnBack').addEventListener('click', () => {
  if (cameFromLibrary) history.back();
  else location.hash = '#/';
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
  if (!document.hidden && playing) requestWake();
});

// ---------------------------------------------------------------- ayarlar ve ilk açılış
function updateInstSeg() {
  $$('#segInst button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === prefs.instrument)));
}
$('#btnSettings').addEventListener('click', async () => {
  updateInstSeg();
  $('#ver').textContent = `v${VERSION}`;
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

// ---------------------------------------------------------------- yönlendirme
let lastView = null;
async function route() {
  const m = location.hash.match(/^#\/sarki\/([\w-]+)/);
  if (m) {
    cameFromLibrary = lastView === 'lib';
    lastView = 'player';
    await openSong(m[1]);
  } else {
    lastView = 'lib';
    await showLibrary();
  }
}
addEventListener('hashchange', route);

// iPhone'da sessiz moddayken de ses gelsin (iOS 17+)
try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch { /* yok */ }

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch((e) => console.warn('Service worker kaydedilemedi', e));
}

(async function start() {
  if (new URLSearchParams(location.search).has('gelen')) history.replaceState(null, '', location.pathname + location.hash);
  await route();
  await checkInbox();
  if (!prefs.instrument) $('#instDlg').showModal();
})();
