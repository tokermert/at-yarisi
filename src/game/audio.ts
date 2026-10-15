/** WebAudio ile sentezlenen küçük oyun sesleri (dosya gerektirmez). */
/** public/muzik.mp3 varsa arka planda döngüyle çalar; yoksa sessizce atlanır. */
const MUSIC_SRC = "/muzik.mp3";
const MUSIC_VOLUME = 0.35;

export class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private music: HTMLAudioElement | null = null;
  muted = false;

  constructor() {
    document.addEventListener("visibilitychange", this.onVisibility);
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (m) this.music?.pause();
    else this.playMusic();
  }

  private playMusic() {
    if (this.muted || document.hidden) return;
    if (!this.music) {
      this.music = new Audio(MUSIC_SRC);
      this.music.loop = true;
      this.music.volume = MUSIC_VOLUME;
    }
    this.music.play().catch(() => {
      /* dosya yoksa ya da tarayıcı henüz izin vermediyse sorun değil */
    });
  }

  private onVisibility = () => {
    if (document.hidden) this.music?.pause();
    else if (this.ctx) this.playMusic();
  };

  /** Tarayıcılar sesi bir kullanıcı etkileşiminden sonra açmaya izin verir. */
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    if (this.music?.paused !== false) this.playMusic();
  }

  close() {
    document.removeEventListener("visibilitychange", this.onVisibility);
    this.music?.pause();
    this.music = null;
    void this.ctx?.close();
    this.ctx = null;
  }

  private ready() {
    if (this.muted || !this.ctx || !this.master) return null;
    return { ctx: this.ctx, out: this.master, t: this.ctx.currentTime };
  }

  private tone(freq: number, dur: number, type: OscillatorType, vol: number, delay = 0, slideTo?: number) {
    const a = this.ready();
    if (!a) return;
    const t = a.t + delay;
    const osc = a.ctx.createOscillator();
    const gain = a.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(a.out);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private noise(dur: number, vol: number, freq: number, delay = 0) {
    const a = this.ready();
    if (!a) return;
    const t = a.t + delay;
    const len = Math.floor(a.ctx.sampleRate * dur);
    const buf = a.ctx.createBuffer(1, len, a.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = a.ctx.createBufferSource();
    src.buffer = buf;
    const filter = a.ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = freq;
    const gain = a.ctx.createGain();
    gain.gain.value = vol;
    src.connect(filter).connect(gain).connect(a.out);
    src.start(t);
  }

  roll() {
    this.noise(0.25, 0.25, 900);
  }

  bounce(strength: number) {
    this.tone(180, 0.06, "triangle", Math.min(0.3, 0.05 + strength / 800));
  }

  score(points: number) {
    this.tone(140, 0.08, "sine", 0.4, 0, 70);
    const notes = [523, 659, 784, 1047];
    for (let i = 0; i < points + 1; i++) this.tone(notes[i], 0.14, "square", 0.08, 0.06 + i * 0.07);
  }

  gallop() {
    for (let i = 0; i < 3; i++) this.tone(110 + i * 8, 0.04, "triangle", 0.12, i * 0.07);
  }

  countdown(final: boolean) {
    this.tone(final ? 880 : 440, final ? 0.5 : 0.18, "square", 0.12);
  }

  fanfare() {
    const seq = [523, 659, 784, 1047, 784, 1047];
    seq.forEach((f, i) => this.tone(f, i === seq.length - 1 ? 0.7 : 0.16, "square", 0.1, i * 0.14));
  }
}
