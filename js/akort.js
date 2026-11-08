// Akort aleti: mikrofondan gelen sesin perdesi (YIN yöntemi), en yakın nota ve sent sapması.
// Ses dosyası ya da ağ yok; perde bulma saf fonksiyon (testler Node'da yapay sesle dener).

export const A4 = 440;
const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const NAMES_TR = ['Do', 'Do#', 'Re', 'Re#', 'Mi', 'Fa', 'Fa#', 'Sol', 'Sol#', 'La', 'La#', 'Si'];

// Standart akort, kalın telden inceye: [tel numarası, MIDI nota]
export const TUNINGS = {
  gitar: [[6, 40], [5, 45], [4, 50], [3, 55], [2, 59], [1, 64]],
  bas: [[4, 28], [3, 33], [2, 38], [1, 43]],
};

export const midiFreq = (m) => A4 * 2 ** ((m - 69) / 12);
export function noteName(midi) {
  const i = ((midi % 12) + 12) % 12;
  return { tr: NAMES_TR[i], en: `${NAMES[i]}${Math.floor(midi / 12) - 1}` };
}

// Frekanstan en yakın nota ve sapma (sent, -50…+50)
export function noteFrom(freq) {
  const exact = 69 + 12 * Math.log2(freq / A4);
  const midi = Math.round(exact);
  return { midi, cents: Math.round((exact - midi) * 1000) / 10, ...noteName(midi) };
}

// Enstrümanın en yakın teli (yarım ses cinsinden en yakın açık tel)
export function nearestString(inst, freq) {
  const exact = 69 + 12 * Math.log2(freq / A4);
  let best = null;
  for (const [n, midi] of TUNINGS[inst] || TUNINGS.gitar) {
    const d = Math.abs(exact - midi);
    if (!best || d < best.d) best = { n, midi, d, cents: Math.round((exact - midi) * 1000) / 10 };
  }
  return best;
}

// YIN: birikimli ortalamayla normalleştirilmiş fark fonksiyonu; eşiğin altına inen ilk çukur
// temel periyottur (harmonikler daha kısa periyot verir ama daha derin çukur yapmaz). Ara değer
// parabolle bulunur. Ses çok kısıksa ya da perde bulunamazsa null.
export function detectPitch(buf, sampleRate, { min = 30, max = 1200, threshold = 0.12 } = {}) {
  let rms = 0;
  for (let i = 0; i < buf.length; i++) rms += buf[i] * buf[i];
  rms = Math.sqrt(rms / buf.length);
  if (rms < 0.01) return null;
  const maxLag = Math.min(Math.floor(sampleRate / min), Math.floor(buf.length / 2));
  const minLag = Math.max(2, Math.floor(sampleRate / max));
  const w = buf.length - maxLag;
  const d = new Float32Array(maxLag + 1);
  for (let lag = 1; lag <= maxLag; lag++) {
    let sum = 0;
    for (let i = 0; i < w; i++) {
      const x = buf[i] - buf[i + lag];
      sum += x * x;
    }
    d[lag] = sum;
  }
  // Birikimli ortalamayla normalleştir
  const cmnd = new Float32Array(maxLag + 1);
  cmnd[0] = 1;
  let run = 0;
  for (let lag = 1; lag <= maxLag; lag++) {
    run += d[lag];
    cmnd[lag] = run ? (d[lag] * lag) / run : 1;
  }
  let lag = -1;
  for (let t = minLag; t <= maxLag; t++) {
    if (cmnd[t] < threshold) {
      while (t + 1 <= maxLag && cmnd[t + 1] < cmnd[t]) t++;
      lag = t;
      break;
    }
  }
  if (lag < 0) return null;
  // Parabolle ara değer
  const a = cmnd[lag - 1] ?? cmnd[lag];
  const b = cmnd[lag];
  const c = cmnd[lag + 1] ?? cmnd[lag];
  const den = a + c - 2 * b;
  const shift = den ? (a - c) / (2 * den) : 0;
  return { freq: sampleRate / (lag + shift), clarity: 1 - b, rms };
}

// Mikrofonu açıp sürekli perde bulur; her karede onPitch({freq, ...} | null) çağrılır
export class Tuner {
  constructor() {
    this.running = false;
    this.onPitch = null;
    this.min = 60; // en düşük aranan frekans (gitar 60, bas 35 Hz)
  }

  async start() {
    if (this.running) return;
    // Akort için tarayıcının ses işlemesi kapalı: yankı/gürültü bastırma perdeyi bozuyor
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
    const AC = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AC();
    await this.ctx.resume?.().catch(() => {});
    this.src = this.ctx.createMediaStreamSource(this.stream);
    this.an = this.ctx.createAnalyser();
    this.an.fftSize = 4096;
    this.src.connect(this.an);
    this.buf = new Float32Array(this.an.fftSize);
    this.half = new Float32Array(this.an.fftSize / 2);
    this.running = true;
    // Saniyede ~15 kez, ikiye seyreltilmiş sesle (telefonda işlemciyi yormasın)
    let last = 0;
    const loop = (now = 0) => {
      if (!this.running) return;
      this.raf = requestAnimationFrame(loop);
      if (now - last < 66) return;
      last = now;
      this.an.getFloatTimeDomainData(this.buf);
      const sr = this.ctx.sampleRate;
      const down = sr > 30000;
      if (down) for (let i = 0; i < this.half.length; i++) this.half[i] = (this.buf[2 * i] + this.buf[2 * i + 1]) / 2;
      this.onPitch?.(detectPitch(down ? this.half : this.buf, down ? sr / 2 : sr, { min: this.min }));
    };
    loop();
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.stream?.getTracks().forEach((t) => t.stop());
    this.ctx?.close().catch(() => {});
    this.stream = null;
    this.ctx = null;
  }
}
