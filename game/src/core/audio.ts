/**
 * All sound is synthesised in the browser with WebAudio - no audio files, so
 * nothing to license and nothing to download. Each effect is a short envelope
 * over an oscillator or a noise buffer.
 */

type NoiseKind = 'white' | 'brown';

// --------------------------------------------------------------- music data

/** Sixteenth-note length; 0.15s works out to about 100 BPM. */
const STEP_SECONDS = 0.15;
const BAR_STEPS = 16;
/** How far ahead of the audio clock notes are queued. */
const SCHEDULE_AHEAD = 0.12;

/**
 * Root of each bar: tonic, tonic, VI, V. In a Hijaz scale that VI-V move is
 * the phrase everyone recognises as "desert", and it keeps a four-bar loop
 * from sounding like it is merely repeating.
 */
const D2 = 73.42;
const BARS = [D2 * 2, D2 * 2, D2 * 2 * (233.08 / 146.83), D2 * 2 * (220 / 146.83)];

/** Darbuka: 'D' low stroke, 't' rim, 'T' accented rim. One bar of sixteenths. */
const PERCUSSION = 'D.t...t.D..t.t.T';

/** Bass: 'R' root, '5' fifth. */
const BASS = 'R..R..5...R.5..5';

/**
 * The lead line as scale ratios against each bar's root, zero for a rest.
 * These are the Hijaz degrees: minor second, augmented second, fifth.
 */
const UNISON = 1;
const MIN2 = 16 / 15;
const MAJ3 = 5 / 4;
const P4 = 4 / 3;
const P5 = 3 / 2;
const MIN6 = 8 / 5;
const OCT = 2;

const LEAD = [
  // Bar 1: climb the scale and hang on the fifth.
  UNISON, 0, 0, MIN2, 0, MAJ3, 0, 0, P4, 0, P5, 0, 0, 0, MAJ3, 0,
  // Bar 2: answer, falling back to the tonic.
  P5, 0, MIN6, 0, P5, 0, P4, 0, MAJ3, 0, MIN2, 0, UNISON, 0, 0, 0,
  // Bar 3 over the VI: a held high note.
  OCT, 0, 0, 0, 0, 0, P5, 0, MIN6, 0, 0, 0, P5, 0, 0, 0,
  // Bar 4 over the V: the turn back to the top.
  P4, 0, MAJ3, 0, MIN2, 0, UNISON, 0, 0, 0, MIN2, 0, MAJ3, 0, P4, 0,
];

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

  // ------------------------------------------------------------------ music

  /**
   * The level theme, built from a Hijaz (Phrygian dominant) scale over a
   * darbuka pattern - the sound the setting actually calls for, rather than
   * the generic chiptune arpeggio this replaced. Four bars: two on the tonic,
   * then the VI and the V, so the loop resolves instead of just repeating.
   *
   * Notes are scheduled ahead against the audio clock rather than played the
   * moment a timer fires, because a timer drifts and the resulting music
   * sounds unsteady.
   */
  startMusic(): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master || this.musicStop) return;

    const bus = ctx.createGain();
    bus.gain.value = 0.13;
    bus.connect(master);

    let step = 0;
    let nextStepTime = ctx.currentTime + 0.06;
    let stopped = false;

    const tick = () => {
      const c = this.ctx;
      if (stopped || !c) return;
      // Schedule everything that falls inside the lookahead window.
      while (nextStepTime < c.currentTime + SCHEDULE_AHEAD) {
        if (!this.muted) this.playStep(step, nextStepTime, bus);
        nextStepTime += STEP_SECONDS;
        step++;
      }
    };

    tick();
    const timer = window.setInterval(tick, 25);

    this.musicStop = () => {
      stopped = true;
      window.clearInterval(timer);
      // Let anything already scheduled ring out before tearing the bus down.
      const c = this.ctx;
      if (c) {
        bus.gain.setValueAtTime(bus.gain.value, c.currentTime);
        bus.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.25);
      }
      window.setTimeout(() => bus.disconnect(), 400);
    };
  }

  /** Plays one sixteenth of the loop at an absolute audio-clock time. */
  private playStep(step: number, when: number, bus: GainNode): void {
    const inBar = step % BAR_STEPS;
    const bar = Math.floor(step / BAR_STEPS) % BARS.length;
    const root = BARS[bar];

    const drum = PERCUSSION[inBar];
    if (drum === 'D') this.dum(when, bus);
    else if (drum === 't') this.tek(when, bus, 0.16);
    else if (drum === 'T') this.tek(when, bus, 0.3);

    const bassNote = BASS[inBar];
    if (bassNote === 'R') this.pluck(root / 2, when, bus, 0.22, 0.55);
    else if (bassNote === '5') this.pluck((root / 2) * 1.5, when, bus, 0.18, 0.45);

    const lead = LEAD[bar * BAR_STEPS + inBar];
    if (lead > 0) this.reed(root * lead, when, bus);

    // A quiet sustained fifth under the first beat of each bar holds the key.
    if (inBar === 0) this.drone(root * 1.5, when, bus);
  }

  /** Low hand-drum stroke: a pitch that drops fast into the floor. */
  private dum(when: number, bus: GainNode): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, when);
    osc.frequency.exponentialRampToValueAtTime(48, when + 0.11);
    gain.gain.setValueAtTime(0.9, when);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.22);
    osc.connect(gain).connect(bus);
    osc.start(when);
    osc.stop(when + 0.26);
  }

  /** Rim stroke: a short bright crack of filtered noise. */
  private tek(when: number, bus: GainNode, peak: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const buf = this.noiseBuffer('white');
    if (!buf) return;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 3200;
    filter.Q.value = 1.4;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(peak, when);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.06);
    src.connect(filter).connect(gain).connect(bus);
    src.start(when, Math.random() * 0.3);
    src.stop(when + 0.1);
  }

  /** Plucked bass string. */
  private pluck(freq: number, when: number, bus: GainNode, dur: number, peak: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, when);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1800, when);
    filter.frequency.exponentialRampToValueAtTime(320, when + dur);
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.linearRampToValueAtTime(peak, when + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    osc.connect(filter).connect(gain).connect(bus);
    osc.start(when);
    osc.stop(when + dur + 0.05);
  }

  /** The lead: a reedy double-oscillator line, detuned so it bites. */
  private reed(freq: number, when: number, bus: GainNode): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const dur = STEP_SECONDS * 1.7;
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(freq * 2.4, when);
    filter.Q.value = 2.2;
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.linearRampToValueAtTime(0.3, when + 0.02);
    gain.gain.setValueAtTime(0.3, when + dur * 0.5);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    filter.connect(gain).connect(bus);

    for (const detune of [-7, 7]) {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, when);
      osc.detune.setValueAtTime(detune, when);
      osc.connect(filter);
      osc.start(when);
      osc.stop(when + dur + 0.05);
    }
  }

  /** Sustained fifth under the bar, the way a reed drone sits under a melody. */
  private drone(freq: number, when: number, bus: GainNode): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const dur = STEP_SECONDS * BAR_STEPS;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq / 2, when);
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.linearRampToValueAtTime(0.07, when + 0.12);
    gain.gain.setValueAtTime(0.07, when + dur * 0.7);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    osc.connect(gain).connect(bus);
    osc.start(when);
    osc.stop(when + dur + 0.05);
  }

  stopMusic(): void {
    this.musicStop?.();
    this.musicStop = null;
  }
}

export const sfx = new Sfx();
