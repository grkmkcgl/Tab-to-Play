// Tek başına metronom (Web Audio). Ses dosyası yok: tıklar osilatörle üretilir.
// Zamanlama: kısa aralıklarla birkaç yüz milisaniye ilerisi ses saatine (AudioContext) yazılır,
// böylece JavaScript gecikse de tıklar kaymaz. Ekrandaki vuruş ışıkları aynı zamanlara göre yanar.
export class Metronome {
  constructor() {
    this.bpm = 80;
    this.beats = 4; // ölçüdeki vuruş
    this.sub = 1; // vuruşun bölümü: 1 dörtlük, 2 sekizlik, 3 triole, 4 onaltılık
    this.accent = true;
    this.vol = 0.8;
    this.running = false;
    this.played = 0; // çalınan vuruş sayısı (testler için)
    this.clicks = 0; // sese yazılan tık sayısı, ara bölümler dahil (testler için)
    this.onBeat = null; // (vuruş indeksi | -1) => void
    this.ctx = null;
    this.queue = [];
  }

  start() {
    if (this.running) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx ||= new AC();
    this.ctx.resume?.().catch(() => {});
    this.running = true;
    this.tick = 0;
    this.next = this.ctx.currentTime + 0.08;
    this.queue = [];
    this.schedule();
    this.timer = setInterval(() => this.schedule(), 25);
    this.draw();
  }

  stop() {
    if (!this.running) return;
    this.running = false;
    clearInterval(this.timer);
    cancelAnimationFrame(this.raf);
    this.queue = [];
    this.onBeat?.(-1);
  }

  toggle() {
    if (this.running) this.stop(); else this.start();
  }

  // Ölçü ya da bölüm değişince bir sonraki tık yeni ölçünün başı olur
  restartBar() {
    this.tick = 0;
  }

  schedule() {
    if (!this.running) return;
    // Arka planda zamanlayıcılar seyrekleşir; o zaman daha ileriyi yaz
    const ahead = document.hidden ? 1.5 : 0.15;
    const now = this.ctx.currentTime;
    if (this.next < now - 0.2) this.next = now + 0.05; // uzun bir duraklamadan sonra yetişmeye çalışma
    while (this.next < now + ahead) {
      const perBar = this.beats * this.sub;
      const i = this.tick % perBar;
      const onBeat = i % this.sub === 0;
      const beat = Math.floor(i / this.sub);
      const kind = !onBeat ? 'sub' : beat === 0 && this.accent ? 'accent' : 'beat';
      this.click(this.next, kind);
      if (onBeat) this.queue.push({ t: this.next, beat });
      this.next += 60 / this.bpm / this.sub;
      this.tick = (i + 1) % perBar;
    }
  }

  click(t, kind) {
    this.clicks++;
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = kind === 'sub' ? 'triangle' : 'square';
    o.frequency.value = kind === 'accent' ? 1760 : kind === 'beat' ? 1180 : 880;
    const peak = Math.max(0.0002, this.vol * (kind === 'accent' ? 0.5 : kind === 'beat' ? 0.35 : 0.2));
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t + (kind === 'sub' ? 0.03 : 0.05));
    o.connect(g).connect(ctx.destination);
    o.start(t);
    o.stop(t + 0.07);
  }

  draw() {
    if (!this.running) return;
    const now = this.ctx.currentTime;
    let last = null;
    while (this.queue.length && this.queue[0].t <= now) {
      last = this.queue.shift();
      this.played++;
    }
    if (last) this.onBeat?.(last.beat);
    this.raf = requestAnimationFrame(() => this.draw());
  }
}

// Vuruşla tempo bulma: art arda dokunuşların ortalama aralığından BPM.
// 2 saniyeden uzun ara yeni bir ölçüm başlatır. Son 6 dokunuşa bakar.
export function tapper(onBpm, { min = 30, max = 240 } = {}) {
  let taps = [];
  return () => {
    const now = performance.now();
    if (taps.length && now - taps[taps.length - 1] > 2000) taps = [];
    taps.push(now);
    if (taps.length > 6) taps.shift();
    if (taps.length < 2) { onBpm(null, taps.length); return; }
    const avg = (taps[taps.length - 1] - taps[0]) / (taps.length - 1);
    onBpm(Math.min(max, Math.max(min, Math.round(60000 / avg))), taps.length);
  };
}
