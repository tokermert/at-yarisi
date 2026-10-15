/** Oyun sesleri: sentezlenen efektler, arka plan müziği ve yarış anlatımı. */
/** public/muzik.mp3 varsa arka planda döngüyle çalar; yoksa sessizce atlanır. */
const MUSIC_SRC = "/muzik.mp3";
const MUSIC_VOLUME = 0.35;
const MUSIC_DUCKED = 0.08;

/**
 * Yarış anlatımı (kaynağın 0:02–1:00 arası): 0–8 sn giriş bir kez çalar, sonra kaynağın
 * 0:10–1:00 kısmı yarış bitene kadar döner. Dosyanın son 1,5 saniyesi döngü başıyla
 * (0:10–0:11,5) harmanlandığından döngü 9,5. saniyeden dikişsiz devam eder.
 */
const COMMENTARY_SRC = "/sesler/anlatim.mp3";
const COMMENTARY_LOOP_START = 9.5;
const COMMENTARY_LOOP_END = 58;
const WINNER_SRC = "/sesler/kazanan.mp3";
const VOICE_VOLUME = 0.9;

export class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private music: HTMLAudioElement | null = null;
  private voice: GainNode | null = null;
  private clips = new Map<string, Promise<AudioBuffer | null>>();
  private commentary: { src: AudioBufferSourceNode; gain: GainNode } | null = null;
  private commentaryToken = 0;
  private primed = false;
  muted = false;

  constructor() {
    document.addEventListener("visibilitychange", this.onVisibility);
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.voice && this.ctx) this.voice.gain.setValueAtTime(m ? 0 : VOICE_VOLUME, this.ctx.currentTime);
    if (m) this.music?.pause();
    else this.playMusic();
  }

  private loadClip(src: string): Promise<AudioBuffer | null> {
    const ctx = this.ctx;
    if (!ctx) return Promise.resolve(null);
    let p = this.clips.get(src);
    if (!p) {
      p = fetch(src)
        .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
        .then((b) => ctx.decodeAudioData(b))
        .catch(() => null);
      this.clips.set(src, p);
    }
    return p;
  }

  private duckMusic(on: boolean) {
    if (this.music) this.music.volume = on ? MUSIC_DUCKED : MUSIC_VOLUME;
  }

  /** Yarış başladığında anlatımı başlatır; bitene kadar döngüde çalar. */
  startCommentary() {
    this.stopCommentary(0.2);
    const token = ++this.commentaryToken;
    void this.loadClip(COMMENTARY_SRC).then((buf) => {
      const ctx = this.ctx;
      if (!buf || !ctx || !this.voice || token !== this.commentaryToken) return;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      src.loopStart = COMMENTARY_LOOP_START;
      src.loopEnd = Math.min(COMMENTARY_LOOP_END, buf.duration);
      const gain = ctx.createGain();
      src.connect(gain).connect(this.voice);
      src.start();
      this.commentary = { src, gain };
      this.duckMusic(true);
    });
  }

  stopCommentary(fade = 0.6) {
    this.commentaryToken++;
    const c = this.commentary;
    this.commentary = null;
    if (c && this.ctx) {
      const t = this.ctx.currentTime;
      c.gain.gain.setValueAtTime(c.gain.gain.value, t);
      c.gain.gain.linearRampToValueAtTime(0, t + fade);
      c.src.stop(t + fade + 0.05);
    }
    this.duckMusic(false);
  }

  /** Kazanan belli olunca çalan ses; dosya yoksa sentez fanfara düşer. */
  winner() {
    void this.loadClip(WINNER_SRC).then((buf) => {
      const ctx = this.ctx;
      if (!buf || !ctx || !this.voice) {
        this.fanfare();
        return;
      }
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(this.voice);
      src.start();
    });
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
    if (document.hidden) {
      this.music?.pause();
      void this.ctx?.suspend();
    } else if (this.ctx) {
      void this.ctx.resume();
      this.playMusic();
    }
  };

  /** Tarayıcılar sesi bir kullanıcı etkileşiminden sonra açmaya izin verir. */
  unlock() {
    if (!this.ctx) {
      // iPhone'da sessiz düğmesi açıkken Web Audio susar; "playback" oturumu bunu aşar (Safari 16.4+).
      const session = (navigator as unknown as { audioSession?: { type: string } }).audioSession;
      if (session) {
        try {
          session.type = "playback";
        } catch {
          /* desteklenmiyorsa sorun değil */
        }
      }
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      this.voice = this.ctx.createGain();
      this.voice.gain.value = this.muted ? 0 : VOICE_VOLUME;
      this.voice.connect(this.ctx.destination);
      // Yarış başlayınca beklemesin diye sesleri önceden indir.
      void this.loadClip(COMMENTARY_SRC);
      void this.loadClip(WINNER_SRC);
    }
    // iOS "interrupted" durumunu da kapsar; dokunuş anında çağrıldığı için izin verilir.
    if (this.ctx.state !== "running") void this.ctx.resume();
    // Eski iOS sürümleri ses motorunu ancak bir dokunuş içinde çalınan sesle açar.
    if (!this.primed) {
      this.primed = true;
      const src = this.ctx.createBufferSource();
      src.buffer = this.ctx.createBuffer(1, 1, 22050);
      src.connect(this.ctx.destination);
      src.start(0);
    }
    if (this.music?.paused !== false) this.playMusic();
  }

  close() {
    this.stopCommentary(0);
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
