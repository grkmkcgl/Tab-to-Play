// Uçtan uca testler: gerçek index.html'i başsız Chromium'da açar.
//   npm test                 → hepsi
//   npm test -- döngü        → adında "döngü" geçenler
//   VERBOSE=1 npm test       → hata ayrıntıları
import { chromium } from 'playwright';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { serve } from '../tools/serve.mjs';

const require = createRequire(import.meta.url);
const fixtures = require('./fixtures.cjs');
fixtures.make();
const F = (name) => join(fixtures.OUT, name);
const PORT = Number(process.env.PORT) || 8199;
const BASE = `http://localhost:${PORT}/`;
const filter = process.argv.slice(2).join(' ').toLocaleLowerCase('tr');

const tests = [];
const test = (name, fn, opts = {}) => tests.push({ name, fn, ...opts });

function assert(cond, msg) { if (!cond) throw new Error(msg); }
// alphaTab konumu bir iki tik sapabiliyor
function near(a, b, msg, tol = 5) {
  if (Math.abs(a - b) > tol) throw new Error(`${msg}: beklenen ~${b}, gelen ${a}`);
}
function eq(a, b, msg) {
  const show = (v) => JSON.stringify(v).replace(/[^\x20-\x7e]/g, (c) => (/[\p{L}\p{N}–]/u.test(c) ? c : `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`));
  if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${msg}: beklenen ${show(b)}, gelen ${show(a)}`);
}

// Sayfa açılmadan önce: tercihleri yaz, alphaTab'ın parti seslerini değiştiren çağrılarını kaydet,
// CSP ihlallerini topla.
function initScript({ prefs }) {
  if (prefs && !localStorage.getItem('ttp-prefs')) localStorage.setItem('ttp-prefs', JSON.stringify(prefs));
  window.__csp = [];
  document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(`${e.violatedDirective} ${e.blockedURI}`));
  window.__calls = [];
  document.addEventListener('readystatechange', () => {
    if (document.readyState !== 'interactive' || !window.alphaTab) return;
    const P = window.alphaTab.AlphaTabApiBase.prototype;
    for (const m of ['changeTrackMute', 'changeTrackSolo', 'changeTrackVolume']) {
      const orig = P[m];
      P[m] = function (tracks, v) { window.__calls.push([m, tracks.map((t) => t.index), v]); return orig.call(this, tracks, v); };
    }
  });
}

class App {
  constructor(browser, ctx, page, t) {
    Object.assign(this, { browser, ctx, page, t });
  }

  static async open(browser, t, { inst = 'gitar', prefs = {}, viewport = { width: 390, height: 844 }, noPrefs = false } = {}) {
    const ctx = await browser.newContext({ viewport, hasTouch: true, isMobile: true, acceptDownloads: true });
    const page = await ctx.newPage();
    const app = new App(browser, ctx, page, t);
    app.errors = [];
    app.external = [];
    page.on('pageerror', (e) => app.errors.push(`pageerror: ${e.message}`));
    page.on('console', (m) => {
      if (m.type() !== 'error') return;
      if (t.allowCsp && /Content Security Policy/.test(m.text())) return;
      app.errors.push(`console: ${m.text()}`);
    });
    page.on('dialog', (d) => (app.onDialog ? app.onDialog(d) : d.dismiss()));
    ctx.on('request', (r) => { if (!r.url().startsWith(BASE) && !r.url().startsWith('blob:') && !r.url().startsWith('data:')) app.external.push(r.url()); });
    await page.addInitScript(initScript, { prefs: noPrefs ? null : { instrument: inst, ...prefs } });
    await page.goto(BASE);
    await page.waitForSelector('#libView:not([hidden])');
    return app;
  }

  async close() {
    const csp = await this.page.evaluate(() => window.__csp).catch(() => []);
    await this.ctx.close();
    if (!this.t.allowCsp && csp.length) this.errors.push(`CSP ihlali: ${csp.join(', ')}`);
    if (this.external.length) this.errors.push(`dış istek: ${this.external.join(', ')}`);
    if (this.errors.length) throw new Error(this.errors.join('\n'));
  }

  ev(fn, arg) { return this.page.evaluate(fn, arg); }
  text(sel) { return this.page.textContent(sel); }
  click(sel) { return this.page.click(sel); }

  async ready() {
    await this.page.waitForSelector('#playerView:not([hidden])');
    await this.page.waitForFunction(() => !document.querySelector('#btnPlay').disabled && window.ttpApi?.score, null, { timeout: 30000 });
    await this.page.waitForFunction(() => document.querySelector('#loading').hidden && !!window.ttpApi.boundsLookup);
    await this.page.waitForTimeout(150);
  }

  async addDemo() {
    await this.click('#btnDemo');
    await this.ready();
  }

  async addFiles(...names) {
    await this.page.setInputFiles('#fileIn', names.map(F));
  }

  async toast(re) {
    await this.page.waitForFunction((src) => {
      const t = document.querySelector('#toast');
      return !t.hidden && new RegExp(src).test(t.textContent);
    }, re.source, { timeout: 10000 });
    return this.text('#toast');
  }

  async panel(name) {
    await this.click(`.ctl[data-panel="${name}"]`);
    await this.page.waitForSelector(`#p-${name}:not([hidden])`);
  }

  async closePanels() {
    await this.ev(() => document.querySelectorAll('.panel').forEach((p) => { if (!p.hidden) p.querySelector('[data-close]').click(); }));
  }

  titles() {
    return this.page.$$eval('#songList .song-title', (els) => els.map((e) => e.textContent));
  }

  // Ölçü i (0'dan) için beklenen döngü aralığı
  barTicks(from, to) {
    return this.ev(([a, b]) => {
      const tc = ttpApi.tickCache;
      const mb = ttpApi.score.masterBars;
      return [tc.getMasterBarStart(mb[a]), tc.getMasterBarStart(mb[b]) + mb[b].calculateDuration() - 1];
    }, [from, to]);
  }

  range() {
    return this.ev(() => (ttpApi.playbackRange ? [ttpApi.playbackRange.startTick, ttpApi.playbackRange.endTick] : null));
  }

  beatTick(bar, beat) {
    return this.ev(([bi, ki]) => ttpApi.tickCache.getBeatStart(ttpApi.tracks[0].staves[0].bars[bi].voices[0].beats[ki]), [bar, beat]);
  }

  // Gösterilen partide ölçü/vuruşa dokun (alphaTab'ın tıklama işleyicisi fareyle çalışır).
  // Önce notayı görünür alanın üstüne kaydırır (paneller alttan açılır).
  async tapBeat(bar, beat) {
    const where = ([bi, ki]) => {
      const b = ttpApi.tracks[0].staves[0].bars[bi].voices[0].beats[ki];
      const r = ttpApi.boundsLookup.findBeat(b).visualBounds;
      const s = document.querySelector('#sheet .at-surface').getBoundingClientRect();
      return { x: s.x + r.x + r.w / 2, y: s.y + r.y + r.h / 2 };
    };
    await this.ev(([bi, ki, src]) => {
      const pos = (0, eval)(src)([bi, ki]);
      const wrap = document.querySelector('#sheetWrap');
      wrap.scrollTop += pos.y - wrap.getBoundingClientRect().top - 120;
    }, [bar, beat, `(${where})`]);
    await this.page.waitForTimeout(100);
    const pos = await this.ev(([bi, ki, src]) => (0, eval)(src)([bi, ki]), [bar, beat, `(${where})`]);
    await this.page.mouse.click(pos.x, pos.y);
  }
}

// ======================================================================= senaryolar

test('ilk açılış: enstrüman sorusu, boş kütüphane yardımı', async (b, t) => {
  const app = await App.open(b, t, { noPrefs: true });
  const p = app.page;
  assert(await p.evaluate(() => document.querySelector('#instDlg').open), 'enstrüman sorusu açılmadı');
  assert(await p.isVisible('#welcome'), 'boş kütüphane yardımı yok');
  assert(!(await p.isVisible('#libTools')), 'boşken arama kutusu görünmemeli');
  await app.click('[data-inst="davul"]');
  eq(await app.ev(() => JSON.parse(localStorage.getItem('ttp-prefs')).instrument), 'davul', 'enstrüman kaydı');
  assert(!(await p.evaluate(() => document.querySelector('#instDlg').open)), 'soru kapanmadı');
  await p.reload();
  await p.waitForSelector('#libView:not([hidden])');
  assert(!(await p.evaluate(() => document.querySelector('#instDlg').open)), 'ikinci açılışta tekrar soruldu');
  await app.close();
});

test('örnek şarkı: gitarist gitar tabını görür, çalar ve duraklatır', async (b, t) => {
  const app = await App.open(b, t, { inst: 'gitar' });
  await app.addDemo();
  assert((await app.text('#btnTrack')).includes('Elektro Gitar'), 'gitar partisi seçilmedi');
  eq(await app.text('#posBar'), 'Ölçü 1/9', 'ölçü etiketi');
  eq(await app.ev(() => ttpApi.settings.display.staveProfile), 3, 'tab görünümü');
  assert(await app.ev(() => document.querySelectorAll('#sheet svg').length > 0), 'nota çizilmedi');
  await app.click('#btnPlay');
  await app.page.waitForFunction(() => ttpApi.playerState === 1 && ttpApi.timePosition > 1300, null, { timeout: 10000 });
  eq(await app.ev(() => document.querySelector('#btnPlay').getAttribute('aria-label')), 'Duraklat', 'düğme etiketi');
  assert(!(await app.text('#posTime')).startsWith('0:00 /'), 'süre ilerlemedi');
  await app.click('#btnPlay');
  await app.page.waitForFunction(() => ttpApi.playerState === 0);
  await app.close();
});

test('örnek şarkı: davulcu davul notasını görür, tab seçenekleri kapalı', async (b, t) => {
  const app = await App.open(b, t, { inst: 'davul' });
  await app.addDemo();
  assert((await app.text('#btnTrack')).includes('Davul'), 'davul partisi seçilmedi');
  eq(await app.ev(() => ttpApi.tracks[0].index), 2, 'gösterilen parti');
  eq(await app.ev(() => ttpApi.settings.display.staveProfile), 0, 'davul dosyadaki gibi (nota) gösterilmeli');
  await app.panel('view');
  assert(await app.page.isVisible('#staveNote'), 'davul açıklaması yok');
  assert(await app.ev(() => [...document.querySelectorAll('#segStave button')].every((x) => x.disabled)), 'tab/nota düğmeleri kapalı olmalı');
  await app.close();
});

test('dosya ekleme: Guitar Pro, MusicXML, bozuk dosya ve aynı dosya', async (b, t) => {
  const app = await App.open(b, t, { inst: 'gitar' });
  await app.addFiles('test-sarki.gp', 'xml-deneme.musicxml', 'bozuk.gp');
  const msg = await app.toast(/eklendi/);
  assert(msg.includes('2 şarkı eklendi'), `mesaj: ${msg}`);
  assert(msg.includes('1 dosya açılamadı (bozuk.gp)'), `bozuk dosya mesajı: ${msg}`);
  await app.page.waitForFunction(() => document.querySelectorAll('#songList .song').length === 2);
  eq((await app.titles()).sort(), ['Test Şarkısı', 'XML Deneme'], 'liste');
  const sub = await app.page.textContent('#songList .song:has-text("Test Şarkısı") .song-sub');
  assert(sub.includes('Örnek Grup') && sub.includes('Gitar') && sub.includes('Davul'), `alt satır: ${sub}`);
  assert(await app.page.isVisible('#songList .song:has-text("Test Şarkısı") .kind.mine'), 'kendi enstrümanı vurgulanmadı');
  // Aynı dosya tekrar: eklenmez, mevcut şarkı açılır
  await app.addFiles('test-sarki.gp');
  assert((await app.toast(/zaten/)).includes('1 şarkı zaten kütüphanede'), 'tekrar mesajı');
  await app.ready();
  eq(await app.text('#pTitle'), 'Test Şarkısı', 'mevcut şarkı açılmalı');
  await app.click('#btnBack');
  await app.page.waitForSelector('#libView:not([hidden])');
  eq((await app.titles()).length, 2, 'tekrar eklenmemeli');
  // MusicXML açılır ve çalınabilir
  await app.click('#songList .song:has-text("XML Deneme") .song-main');
  await app.ready();
  eq(await app.text('#posBar'), 'Ölçü 1/1', 'MusicXML ölçü sayısı');
  eq(await app.ev(() => ttpApi.settings.display.staveProfile), 0, 'tabsız parti nota olarak çizilmeli');
  await app.panel('view');
  assert((await app.text('#staveNote')).includes('tabı yok'), 'tabsız parti açıklaması');
  await app.close();
});

test('kütüphane: Türkçe arama, favori, sıralama, silme onayı', async (b, t) => {
  const app = await App.open(b, t);
  await app.addFiles('test-sarki.gp', 'baska.gp', 'xml-deneme.musicxml');
  await app.toast(/3 şarkı eklendi/);
  await app.page.waitForFunction(() => document.querySelectorAll('#songList .song').length === 3);
  await app.page.fill('#q', 'AKSAM');
  eq(await app.titles(), ['Akşam Provası'], 'şapkasız arama');
  await app.page.fill('#q', 'örnek GRUP');
  eq(await app.titles(), ['Test Şarkısı'], 'sanatçıya göre arama');
  await app.page.fill('#q', 'yok böyle bir şey');
  assert(await app.page.isVisible('#noResult'), 'sonuç yok mesajı');
  await app.page.fill('#q', '');
  await app.click('#songList .song:has-text("XML Deneme") .fav');
  await app.click('#favOnly');
  eq(await app.titles(), ['XML Deneme'], 'favoriler');
  await app.click('#favOnly');
  await app.page.selectOption('#sort', 'title');
  eq(await app.titles(), ['Akşam Provası', 'Test Şarkısı', 'XML Deneme'], 'A–Z');
  // Sil: önce vazgeç, sonra onayla
  await app.click('#songList .song:has-text("Akşam Provası") [data-act="more"]');
  app.onDialog = (d) => d.dismiss();
  await app.click('#songList .song:has-text("Akşam Provası") [data-act="del"]');
  eq((await app.titles()).length, 3, 'vazgeçince silinmemeli');
  app.onDialog = (d) => { app.lastDialog = d.message(); d.accept(); };
  await app.click('#songList .song:has-text("Akşam Provası") [data-act="del"]');
  await app.toast(/silindi/);
  assert(app.lastDialog.includes('Akşam Provası'), 'onay sorusu şarkı adını içermeli');
  await app.page.reload();
  await app.page.waitForFunction(() => document.querySelectorAll('#songList .song').length === 2);
  eq((await app.titles()).sort(), ['Test Şarkısı', 'XML Deneme'], 'silme kalıcı');
  eq(await app.page.inputValue('#sort'), 'title', 'sıralama tercihi kalıcı');
  assert(await app.page.isVisible('#songList .song:has-text("XML Deneme") .fav[aria-pressed="true"]'), 'favori kalıcı');
  await app.close();
});

test('paylaş: paylaşım menüsü yoksa dosya aynen indirilir', async (b, t) => {
  const app = await App.open(b, t);
  await app.addFiles('test-sarki.gp', 'baska.gp');
  await app.page.waitForFunction(() => document.querySelectorAll('#songList .song').length === 2);
  await app.click('#songList .song:has-text("Test Şarkısı") [data-act="more"]');
  const [dl] = await Promise.all([app.page.waitForEvent('download'), app.click('#songList .song:has-text("Test Şarkısı") [data-act="share"]')]);
  eq(dl.suggestedFilename(), 'test-sarki.gp', 'dosya adı');
  const got = readFileSync(await dl.path());
  assert(got.equals(readFileSync(F('test-sarki.gp'))), 'indirilen dosya aynı değil');
  await app.close();
});

test('hız: hazır değerler, +/−, sınırlar, BPM bilgisi', async (b, t) => {
  const app = await App.open(b, t);
  await app.addDemo();
  await app.panel('speed');
  await app.click('[data-spv="75"]');
  eq(await app.ev(() => ttpApi.playbackSpeed), 0.75, 'hız %75');
  eq(await app.text('#lblSpeed'), '%75', 'düğme etiketi');
  assert((await app.text('#bpmInfo')).includes('104 BPM') && (await app.text('#bpmInfo')).includes('şu an 78 BPM'), 'BPM bilgisi');
  await app.click('[data-sp="-5"]');
  eq(await app.ev(() => ttpApi.playbackSpeed), 0.7, 'hız %70');
  await app.ev(() => { const r = document.querySelector('#spRange'); r.value = 150; r.dispatchEvent(new Event('input', { bubbles: true })); });
  eq(await app.ev(() => ttpApi.playbackSpeed), 1.5, 'kaydırıcı %150');
  await app.click('[data-sp="5"]');
  eq(await app.ev(() => ttpApi.playbackSpeed), 1.5, 'üst sınır %150');
  for (let i = 0; i < 30; i++) await app.click('[data-sp="-5"]');
  eq(await app.ev(() => ttpApi.playbackSpeed), 0.25, 'alt sınır %25');
  assert(await app.ev(() => document.querySelector('[data-panel="speed"]').classList.contains('on')), 'hız değişince düğme vurgulanmalı');
  await app.close();
});

test('metronom ve girişte sayma açılır, tercih kalıcıdır', async (b, t) => {
  const app = await App.open(b, t);
  await app.addDemo();
  eq(await app.ev(() => [ttpApi.metronomeVolume, ttpApi.countInVolume]), [0, 0], 'başta kapalı');
  await app.panel('speed');
  await app.click('#metro');
  await app.click('#countIn');
  eq(await app.ev(() => [ttpApi.metronomeVolume, ttpApi.countInVolume]), [1, 1], 'açıldı');
  await app.page.reload();
  await app.ready();
  eq(await app.ev(() => [ttpApi.metronomeVolume, ttpApi.countInVolume]), [1, 1], 'yeniden açılışta uygulandı');
  await app.close();
});

test('döngü: ölçü aralığı, imleçten, dokunma, iki dokunuşla seçme, kaldırma', async (b, t) => {
  const app = await App.open(b, t);
  await app.addDemo();
  await app.panel('loop');
  for (let i = 0; i < 5; i++) await app.click('[data-lt="-1"]');
  assert(await app.page.isChecked('#loopOn'), 'döngü kendiliğinden açılmalı');
  eq(await app.text('#lblLoop'), '1–4', 'etiket');
  eq(await app.range(), await app.barTicks(0, 3), 'aralık 1–4');
  eq(await app.ev(() => ttpApi.isLooping), true, 'tekrar açık');
  // Klavyeyle 3. ölçüye git, "İmleçten" ile başlangıç yap
  await app.closePanels();
  await app.page.keyboard.press('ArrowRight');
  await app.page.keyboard.press('ArrowRight');
  eq(await app.text('#posBar'), 'Ölçü 3/9', 'ok tuşları');
  await app.panel('loop');
  await app.click('#lfCur');
  eq(await app.text('#lblLoop'), '3–4', 'imleçten başlangıç');
  eq(await app.range(), await app.barTicks(2, 3), 'aralık 3–4');
  await app.closePanels();
  // Döngünün içine dokununca oradan devam eder, döngü yerinde kalır
  await app.tapBeat(3, 2);
  await app.page.waitForTimeout(400);
  eq(await app.range(), await app.barTicks(2, 3), 'içeri dokununca döngü yerinde');
  near(await app.ev(() => ttpApi.tickPosition), await app.beatTick(3, 2), 'dokunulan vuruştan devam');
  eq(await app.text('#posBar'), 'Ölçü 4/9', 'ölçü etiketi');
  // Dışına dokununca döngü yine yerinde, imleç döngünün başında
  await app.tapBeat(0, 2);
  await app.page.waitForTimeout(400);
  eq(await app.range(), await app.barTicks(2, 3), 'dışarı dokununca döngü yerinde');
  near(await app.ev(() => ttpApi.tickPosition), (await app.barTicks(2, 3))[0], 'imleç döngü başında');
  assert(await app.ev(() => document.querySelectorAll('.at-selection div').length > 0), 'döngü vurgusu görünmeli');
  // Döngü paneli açıkken iki dokunuş: bitiş önce seçilse de sıralanır
  await app.panel('loop');
  await app.tapBeat(4, 0);
  await app.toast(/Başlangıç 5\. ölçü/);
  assert((await app.text('#loopTapHint')).includes('5. ölçü seçildi'), 'ipucu güncellenmeli');
  await app.tapBeat(1, 1);
  await app.toast(/Döngü: 2–5/);
  eq(await app.text('#lblLoop'), '2–5', 'iki dokunuşla döngü');
  eq(await app.range(), await app.barTicks(1, 4), 'aralık 2–5');
  await app.page.waitForTimeout(300);
  eq(await app.range(), await app.barTicks(1, 4), 'dokunuşlardan sonra aralık bozulmadı');
  await app.click('#loopClear');
  eq(await app.range(), null, 'döngü kaldırıldı');
  eq(await app.ev(() => ttpApi.isLooping), false, 'tekrar kapalı');
  eq(await app.text('#lblLoop'), 'Döngü', 'etiket sıfırlandı');
  await app.close();
});

test('döngü gerçekten tekrar çalar; hız antrenörü her turda hızlandırır', async (b, t) => {
  const app = await App.open(b, t);
  await app.addDemo();
  await app.panel('loop');
  for (let i = 0; i < 8; i++) await app.click('[data-lt="-1"]');
  eq(await app.text('#lblLoop'), '1–1', 'tek ölçü');
  const [, end] = await app.barTicks(0, 0);
  await app.ev(() => { window.__maxTick = 0; window.__turns = 0; ttpApi.playerPositionChanged.on((e) => { window.__maxTick = Math.max(window.__maxTick, e.currentTick); }); ttpApi.playerFinished.on(() => window.__turns++); });
  await app.panel('speed');
  await app.click('#trainerBox summary');
  await app.page.fill('#trStart', '140');
  await app.page.fill('#trTarget', '150');
  await app.page.fill('#trStep', '5');
  await app.page.fill('#trEvery', '1');
  await app.click('#trBtn');
  eq(await app.ev(() => ttpApi.playbackSpeed), 1.4, 'antrenör başlangıç hızı');
  assert((await app.text('#trStatus')).includes('Çalışıyor'), 'durum yazısı');
  await app.page.waitForFunction(() => ttpApi.playbackSpeed === 1.5, null, { timeout: 20000 });
  assert(await app.ev(() => window.__turns >= 2), 'iki tur dönmeliydi');
  const maxTick = await app.ev(() => window.__maxTick);
  // Ses tamponu yüzünden konum ölçü sonunu birkaç milisaniye geçebilir (120 tik = 32'lik nota)
  assert(maxTick <= end + 120, `döngü dışına çıktı: en büyük konum ${maxTick}, ölçü sonu ${end}`);
  eq(await app.text('#lblSpeed'), '%150', 'etiket hedef hızda');
  await app.click('#trBtn');
  await app.toast(/Antrenör durdu/);
  eq(await app.ev(() => ttpApi.isLooping), true, 'durunca döngü açık kalmalı');
  await app.click('#btnPlay');
  await app.page.waitForFunction(() => ttpApi.playerState === 0);
  // Hız kaydedildi
  await app.page.reload();
  await app.ready();
  eq(await app.ev(() => ttpApi.playbackSpeed), 1.5, 'son hız kaydedildi');
  await app.close();
});

test('partiler: kendi partimi sessize al, solo, ses düzeyi, parti değiştirme', async (b, t) => {
  const app = await App.open(b, t, { inst: 'gitar' });
  await app.addDemo();
  await app.ev(() => { window.__calls = []; });
  await app.panel('mix');
  eq(await app.page.$$eval('#mixList li .nm', (els) => els.map((e) => e.textContent)), ['Elektro Gitar', 'Bas', 'Davul'], 'parti listesi');
  await app.click('#muteMine');
  eq(await app.ev(() => window.__calls.at(-1)), ['changeTrackMute', [0], true], 'gitar sessiz');
  assert((await app.text('#btnTrack')).includes('sessiz'), 'başlıkta sessiz yazmalı');
  assert(await app.page.isVisible('#mixList li[data-i="0"] [data-mute][aria-pressed="true"]'), 'liste de sessiz göstermeli');
  await app.click('#mixList li[data-i="1"] [data-solo]');
  eq(await app.ev(() => window.__calls.at(-1)), ['changeTrackSolo', [1], true], 'bas solo');
  await app.ev(() => { const r = document.querySelector('#mixList [data-vol="2"]'); r.value = 50; r.dispatchEvent(new Event('input', { bubbles: true })); });
  eq(await app.ev(() => window.__calls.at(-1)), ['changeTrackVolume', [2], 0.5], 'davul ses düzeyi');
  // Davul partisini göster
  await app.click('#mixList li[data-i="2"] .mix-name');
  await app.page.waitForFunction(() => ttpApi.tracks[0].index === 2);
  assert((await app.text('#btnTrack')).includes('Davul'), 'başlık davul');
  assert(!(await app.page.isChecked('#muteMine')), 'davul sessiz değil');
  // Yeniden açınca hepsi geri gelir ve çalara uygulanır
  await app.page.reload();
  await app.ready();
  eq(await app.ev(() => ttpApi.tracks[0].index), 2, 'son gösterilen parti');
  const calls = await app.ev(() => window.__calls);
  assert(calls.some((c) => JSON.stringify(c) === '["changeTrackMute",[0],true]'), 'sessiz uygulanmadı');
  assert(calls.some((c) => JSON.stringify(c) === '["changeTrackSolo",[1],true]'), 'solo uygulanmadı');
  assert(calls.some((c) => JSON.stringify(c) === '["changeTrackVolume",[2],0.5]'), 'ses düzeyi uygulanmadı');
  await app.close();
});

test('görünüm: tab / nota / ikisi, tek satır, boyut, otomatik kaydırma', async (b, t) => {
  const app = await App.open(b, t);
  await app.addDemo();
  await app.panel('view');
  await app.click('#segStave [data-v="nota"]');
  await app.page.waitForFunction(() => ttpApi.settings.display.staveProfile === 2);
  await app.click('#segStave [data-v="ikisi"]');
  await app.page.waitForFunction(() => ttpApi.settings.display.staveProfile === 1);
  await app.click('#segLayout [data-v="yatay"]');
  eq(await app.ev(() => ttpApi.settings.display.layoutMode), 1, 'tek satır');
  const before = await app.ev(() => ttpApi.settings.display.scale);
  await app.click('[data-zoom="0.1"]');
  eq(await app.ev(() => ttpApi.settings.display.scale), Math.round((before + 0.1) * 10) / 10, 'büyütme');
  eq(await app.text('#zoomOut'), `%${Math.round((before + 0.1) * 100)}`, 'boyut etiketi');
  await app.click('#follow');
  eq(await app.ev(() => ttpApi.settings.player.scrollMode), 0, 'kaydırma kapalı');
  const prefs = await app.ev(() => JSON.parse(localStorage.getItem('ttp-prefs')));
  eq([prefs.stave, prefs.layout, prefs.follow], ['ikisi', 'yatay', false], 'tercihler kaydedildi');
  await app.close();
});

test('şarkıya özel ayarlar yeniden açınca geri gelir (hız, döngü, sessiz parti)', async (b, t) => {
  const app = await App.open(b, t);
  await app.addDemo();
  await app.panel('speed');
  await app.click('[data-spv="75"]');
  await app.panel('loop');
  await app.click('[data-lf="1"]');
  for (let i = 0; i < 6; i++) await app.click('[data-lt="-1"]');
  eq(await app.text('#lblLoop'), '2–3', 'döngü');
  await app.panel('mix');
  await app.click('#muteMine');
  await app.page.waitForTimeout(500); // kayıt gecikmesi
  await app.page.goto(BASE);
  await app.page.waitForSelector('#songList .song');
  await app.click('#songList .song-main');
  await app.ready();
  eq(await app.text('#lblSpeed'), '%75', 'hız etiketi');
  eq(await app.ev(() => ttpApi.playbackSpeed), 0.75, 'hız uygulandı');
  eq(await app.text('#lblLoop'), '2–3', 'döngü etiketi');
  eq(await app.range(), await app.barTicks(1, 2), 'döngü uygulandı');
  assert((await app.ev(() => window.__calls)).some((c) => JSON.stringify(c) === '["changeTrackMute",[0],true]'), 'sessiz uygulandı');
  await app.close();
});

test('geri düğmesi kütüphaneye döner ve çalmayı durdurur', async (b, t) => {
  const app = await App.open(b, t);
  await app.addDemo();
  await app.click('#btnPlay');
  await app.page.waitForFunction(() => ttpApi.playerState === 1);
  await app.click('#btnBack');
  await app.page.waitForSelector('#libView:not([hidden])');
  await app.page.waitForFunction(() => ttpApi.playerState === 0);
  eq(await app.titles(), ['Deneme Riffi'], 'liste');
  await app.click('#songList .song-main');
  await app.ready();
  eq(await app.text('#pTitle'), 'Deneme Riffi', 'yeniden açıldı');
  await app.close();
});

test('klavye ve pedal: boşluk / PageDown çalar-durdurur, Home başa sarar', async (b, t) => {
  const app = await App.open(b, t);
  await app.addDemo();
  await app.page.keyboard.press(' ');
  await app.page.waitForFunction(() => ttpApi.playerState === 1);
  await app.page.keyboard.press('PageDown');
  await app.page.waitForFunction(() => ttpApi.playerState === 0);
  await app.page.keyboard.press('ArrowRight');
  eq(await app.text('#posBar'), 'Ölçü 2/9', 'sonraki ölçü');
  await app.page.keyboard.press('Home');
  await app.page.waitForFunction(() => ttpApi.tickPosition <= 5);
  eq(await app.text('#posBar'), 'Ölçü 1/9', 'başa sarıldı');
  await app.close();
});

test('dar ekran (360 px): yatay kaydırma yok, düğmeler ve paneller ekrana sığar', async (b, t) => {
  const app = await App.open(b, t, { viewport: { width: 360, height: 740 } });
  await app.addDemo();
  const fits = () => app.ev(() => {
    const w = innerWidth;
    const out = [...document.querySelectorAll('.ctl, .panel:not([hidden]) button, .panel:not([hidden]) input')]
      .filter((e) => e.offsetParent)
      .filter((e) => { const r = e.getBoundingClientRect(); return r.left < -1 || r.right > w + 1; })
      .map((e) => e.id || e.textContent.trim() || e.className);
    return { scroll: document.documentElement.scrollWidth, w, out };
  });
  let f = await fits();
  assert(f.scroll <= f.w && f.out.length === 0, `taşan: ${JSON.stringify(f)}`);
  for (const name of ['speed', 'loop', 'mix', 'view']) {
    await app.panel(name);
    if (name === 'speed') await app.click('#trainerBox summary');
    f = await fits();
    assert(f.scroll <= f.w && f.out.length === 0, `${name} paneli taşıyor: ${JSON.stringify(f)}`);
    await app.closePanels();
  }
  await app.close();
});

test('çevrimdışı: uygulama, şarkı ve ses internet olmadan açılır', async (b, t) => {
  const app = await App.open(b, t);
  const p = app.page;
  await p.evaluate(() => navigator.serviceWorker.ready);
  await p.reload();
  await p.waitForFunction(() => !!navigator.serviceWorker.controller);
  await app.addDemo();
  const cached = await p.evaluate(async () => {
    const keys = [];
    for (const n of await caches.keys()) for (const r of await (await caches.open(n)).keys()) keys.push(new URL(r.url).pathname);
    return keys;
  });
  for (const f of ['/', '/js/app.js', '/lib/alphaTab.min.js', '/lib/soundfont/sonivox.sf3', '/lib/font/Bravura.woff2', '/ornek.gp']) {
    assert(cached.includes(f), `önbellekte yok: ${f}`);
  }
  await app.ctx.setOffline(true);
  await p.goto(BASE);
  await p.waitForSelector('#songList .song');
  await app.click('#songList .song-main');
  await app.ready();
  await app.click('#btnPlay');
  await p.waitForFunction(() => ttpApi.playerState === 1 && ttpApi.timePosition > 300, null, { timeout: 10000 });
  await app.ctx.setOffline(false);
  await app.close();
});

test('Android paylaş menüsü: paylaşılan dosya kütüphaneye eklenip açılır', async (b, t) => {
  const app = await App.open(b, t);
  const p = app.page;
  await p.evaluate(() => navigator.serviceWorker.ready);
  await p.reload();
  await p.waitForFunction(() => !!navigator.serviceWorker.controller);
  const bytes = [...readFileSync(F('test-sarki.gp'))];
  const res = await p.evaluate(async (arr) => {
    const fd = new FormData();
    fd.append('dosya', new File([new Uint8Array(arr)], 'test-sarki.gp'));
    const r = await fetch('paylas', { method: 'POST', body: fd });
    return { redirected: r.redirected, url: r.url };
  }, bytes);
  assert(res.url.includes('?gelen=1'), `yönlendirme: ${JSON.stringify(res)}`);
  await p.goto(`${BASE}?gelen=1#/`);
  await app.ready();
  eq(await app.text('#pTitle'), 'Test Şarkısı', 'paylaşılan şarkı açıldı');
  assert(!(await p.evaluate(() => location.search)), 'adres temizlenmeli');
  eq(await p.evaluate(async () => (await (await caches.open('ttp-gelen')).keys()).length), 0, 'geçici kutu boşalmalı');
  await app.close();
});

test('ağ kilidi: başka adrese istek CSP ile engellenir', async (b, t) => {
  const app = await App.open(b, t);
  const r = await app.ev(async () => {
    try { await fetch('https://example.com/'); return 'açık'; } catch { return 'kapalı'; }
  });
  eq(r, 'kapalı', 'dış istek');
  const csp = await app.ev(() => window.__csp);
  assert(csp.some((c) => c.startsWith('connect-src')), `CSP ihlali kaydedilmeli: ${csp}`);
  app.external = []; // istek tarayıcıdan hiç çıkmadı; yine de bu testte beklenen
  await app.close();
}, { allowCsp: true });

// ======================================================================= çalıştırıcı
const server = await serve(PORT);
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const chosen = tests.filter((t) => !filter || t.name.toLocaleLowerCase('tr').includes(filter));
let failed = 0;
const started = Date.now();
for (const t of chosen) {
  const t0 = Date.now();
  try {
    await t.fn(browser, t);
    console.log(`✓ ${t.name} (${((Date.now() - t0) / 1000).toFixed(1)} sn)`);
  } catch (e) {
    failed++;
    console.log(`✗ ${t.name}\n    ${(process.env.VERBOSE ? e.stack : e.message).split('\n').join('\n    ')}`);
  }
}
await browser.close();
server.close();
console.log(`\n${chosen.length - failed}/${chosen.length} test geçti (${((Date.now() - started) / 1000).toFixed(0)} sn)`);
process.exit(failed ? 1 : 0);
