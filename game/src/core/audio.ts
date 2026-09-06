/**
 * All sound is synthesised in the browser with WebAudio - no audio files, so
 * nothing to license and nothing to download. Each effect is a short envelope
 * over an oscillator or a noise buffer.
 */

type NoiseKind = 'white' | 'brown';

export class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: Partial<Record<NoiseKind, AudioBuffer>> = {};
  private musicStop: (() => void) | null = null;
  muted = false;

  /** Browsers only allow audio after a gesture; call this from an input handler. */
  resume(): void {
    if (!this.ctx) {
      const Ctor: typeof AudioContext | undefined =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      try {
        this.ctx = new Ctor();
      } catch {
        return;
      }
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.32;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.32;
    return this.muted;
  }

  private noiseBuffer(kind: NoiseKind): AudioBuffer | null {
    const ctx = this.ctx;
    if (!ctx) return null;
    const cached = this.noise[kind];
    if (cached) return cached;
    const len = Math.floor(ctx.sampleRate * 0.6);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (kind === 'white') {
        data[i] = w;
      } else {
        last = (last + 0.02 * w) / 1.02;
        data[i] = last * 3.2;
      }
    }
    this.noise[kind] = buf;
    return buf;
  }

  private env(gain: GainNode, now: number, peak: number, attack: number, decay: number): void {
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(peak, now + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + attack + decay);
  }

  /** Short pitched blip: menus, pickups, POW rescue. */
  tone(freq: number, dur = 0.08, type: OscillatorType = 'square', peak = 0.35, slideTo?: number): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master || this.muted) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (slideTo !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), now + dur);
    }
    this.env(gain, now, peak, 0.005, dur);
    osc.connect(gain).connect(master);
    osc.start(now);
    osc.stop(now + dur + 0.05);
  }

  /** Filtered noise burst: gunfire, explosions, impacts. */
  burst(opts: {
    kind?: NoiseKind;
    dur?: number;
    peak?: number;
    filter?: BiquadFilterType;
    freq?: number;
    freqTo?: number;
    q?: number;
  } = {}): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master || this.muted) return;
    const buf = this.noiseBuffer(opts.kind ?? 'white');
    if (!buf) return;

    const now = ctx.currentTime;
    const dur = opts.dur ?? 0.09;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const biq = ctx.createBiquadFilter();
    biq.type = opts.filter ?? 'bandpass';
    biq.frequency.setValueAtTime(opts.freq ?? 1400, now);
    if (opts.freqTo !== undefined) {
      biq.frequency.exponentialRampToValueAtTime(Math.max(30, opts.freqTo), now + dur);
    }
    biq.Q.value = opts.q ?? 1;
    const gain = ctx.createGain();
    this.env(gain, now, opts.peak ?? 0.4, 0.004, dur);
    src.connect(biq).connect(gain).connect(master);
    src.start(now, Math.random() * 0.3);
    src.stop(now + dur + 0.06);
  }

  pistol(): void {
    this.burst({ dur: 0.05, peak: 0.22, freq: 2600, freqTo: 900, q: 0.9 });
  }

  machineGun(): void {
    this.burst({ dur: 0.04, peak: 0.18, freq: 1900, freqTo: 700, q: 1.4 });
  }

  shotgun(): void {
    this.burst({ dur: 0.14, peak: 0.34, kind: 'brown', filter: 'lowpass', freq: 2200, freqTo: 420 });
  }

  rocket(): void {
    this.burst({ dur: 0.22, peak: 0.26, kind: 'brown', filter: 'lowpass', freq: 900, freqTo: 200 });
    this.tone(220, 0.18, 'sawtooth', 0.16, 90);
  }

  flame(): void {
    this.burst({ dur: 0.11, peak: 0.16, kind: 'brown', filter: 'bandpass', freq: 700, freqTo: 320, q: 0.6 });
  }

  laser(): void {
    this.tone(1500, 0.1, 'sawtooth', 0.2, 420);
  }

  explosion(big = false): void {
    this.burst({
      kind: 'brown',
      filter: 'lowpass',
      dur: big ? 0.7 : 0.34,
      peak: big ? 0.7 : 0.45,
      freq: big ? 1200 : 900,
      freqTo: big ? 60 : 120,
    });
    this.tone(big ? 68 : 110, big ? 0.5 : 0.25, 'triangle', big ? 0.4 : 0.22, 34);
  }

  knife(): void {
    this.burst({ dur: 0.06, peak: 0.3, freq: 5200, freqTo: 2200, q: 3 });
  }

  jump(): void {
    this.tone(420, 0.07, 'square', 0.14, 720);
  }

  pickup(): void {
    this.tone(700, 0.06, 'square', 0.22);
    window.setTimeout(() => this.tone(1050, 0.08, 'square', 0.22), 55);
  }

  rescue(): void {
    this.tone(520, 0.07, 'square', 0.24);
    window.setTimeout(() => this.tone(780, 0.07, 'square', 0.24), 70);
    window.setTimeout(() => this.tone(1040, 0.12, 'square', 0.24), 140);
  }

  death(): void {
    this.tone(400, 0.5, 'sawtooth', 0.3, 60);
    this.burst({ kind: 'brown', filter: 'lowpass', dur: 0.4, peak: 0.3, freq: 700, freqTo: 90 });
  }

  hit(): void {
    this.burst({ dur: 0.05, peak: 0.24, freq: 3000, freqTo: 1200, q: 2 });
  }

  /**
   * A short looping bass-and-arpeggio bed. Deliberately minimal: enough to
   * carry the level, quiet enough to stay out of the way of the effects.
   */
  startMusic(): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master || this.musicStop) return;

    const bus = ctx.createGain();
    bus.gain.value = 0.11;
    bus.connect(master);

    const bass = [55, 55, 73.4, 55, 49, 49, 65.4, 49];
    const arp = [220, 293.7, 349.2, 293.7, 261.6, 329.6, 392, 329.6];
    const step = 0.24;
    let i = 0;
    let stopped = false;

    const timer = window.setInterval(() => {
      if (stopped || !this.ctx || this.muted) return;
      const now = this.ctx.currentTime;
      const play = (freq: number, type: OscillatorType, dur: number, peak: number) => {
        const osc = this.ctx!.createOscillator();
        const g = this.ctx!.createGain();
        osc.type = type;
        osc.frequency.value = freq;
        g.gain.setValueAtTime(0.0001, now);
        g.gain.linearRampToValueAtTime(peak, now + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
        osc.connect(g).connect(bus);
        osc.start(now);
        osc.stop(now + dur + 0.05);
      };
      play(bass[i % bass.length], 'triangle', step * 0.9, 0.6);
      play(arp[i % arp.length], 'square', step * 0.5, 0.22);
      if (i % 4 === 2) this.burst({ dur: 0.05, peak: 0.08, freq: 5000, q: 1 });
      i++;
    }, step * 1000);

    this.musicStop = () => {
      stopped = true;
      window.clearInterval(timer);
      bus.disconnect();
    };
  }

  stopMusic(): void {
    this.musicStop?.();
    this.musicStop = null;
  }
}

export const sfx = new Sfx();
