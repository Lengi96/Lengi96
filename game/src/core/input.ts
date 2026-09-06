/**
 * Arcade-shaped input: an 8-way stick plus three buttons (shoot, jump,
 * grenade), exactly like the cabinet this game is an homage to. Keyboard and
 * gamepad both funnel into the same abstract button set, so gameplay code
 * never asks which device the player used.
 */
export type Button =
  | 'left' | 'right' | 'up' | 'down'
  | 'shoot' | 'jump' | 'grenade'
  | 'start' | 'pause';

export const BUTTONS: readonly Button[] = [
  'left', 'right', 'up', 'down', 'shoot', 'jump', 'grenade', 'start', 'pause',
];

export type Bindings = Record<Button, string[]>;

export const DEFAULT_BINDINGS: Bindings = {
  left: ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
  up: ['ArrowUp', 'KeyW'],
  down: ['ArrowDown', 'KeyS'],
  shoot: ['KeyX', 'KeyJ'],
  jump: ['KeyC', 'KeyK'],
  grenade: ['KeyV', 'KeyL'],
  start: ['Enter', 'Space'],
  pause: ['KeyP', 'Escape'],
};

/** Standard-gamepad button indices mapped onto our abstract buttons. */
const PAD_BUTTONS: Partial<Record<number, Button>> = {
  0: 'jump',     // A / cross
  1: 'shoot',    // B / circle
  2: 'shoot',    // X / square
  3: 'grenade',  // Y / triangle
  5: 'grenade',  // R1
  9: 'start',
  8: 'pause',
  12: 'up',
  13: 'down',
  14: 'left',
  15: 'right',
};

const STICK_DEADZONE = 0.45;
const BINDINGS_KEY = 'desert-slug.bindings.v1';

export class Input {
  private held = new Set<Button>();
  private prev = new Set<Button>();
  private bindings: Bindings = loadBindings();
  private keyToButtons = new Map<string, Button[]>();
  /** When set, replaces all real input — used by the scripted demo runner. */
  private scripted: Set<Button> | null = null;

  constructor() {
    this.rebuildKeyMap();
  }

  attach(target: Window = window): () => void {
    const down = (e: KeyboardEvent) => {
      const bs = this.keyToButtons.get(e.code);
      if (!bs) return;
      e.preventDefault();
      for (const b of bs) this.held.add(b);
    };
    const up = (e: KeyboardEvent) => {
      const bs = this.keyToButtons.get(e.code);
      if (!bs) return;
      e.preventDefault();
      for (const b of bs) this.held.delete(b);
    };
    const blur = () => this.held.clear();
    target.addEventListener('keydown', down as EventListener);
    target.addEventListener('keyup', up as EventListener);
    target.addEventListener('blur', blur);
    return () => {
      target.removeEventListener('keydown', down as EventListener);
      target.removeEventListener('keyup', up as EventListener);
      target.removeEventListener('blur', blur);
    };
  }

  /** Call once per simulation tick, before the world updates. */
  beginTick(): void {
    this.prev = new Set(this.held);
    this.pollGamepad();
    if (this.scripted) {
      this.held = new Set(this.scripted);
    }
  }

  private pollGamepad(): void {
    if (typeof navigator === 'undefined' || !navigator.getGamepads) return;
    const pads = navigator.getGamepads();
    // Digital gamepad state is rebuilt each tick; keyboard state is retained
    // so the two sources can be used interchangeably mid-session.
    for (const b of ['left', 'right', 'up', 'down'] as Button[]) {
      if (this.padHeld.has(b)) this.held.delete(b);
    }
    for (const b of ['shoot', 'jump', 'grenade', 'start', 'pause'] as Button[]) {
      if (this.padHeld.has(b)) this.held.delete(b);
    }
    this.padHeld.clear();

    for (const pad of pads) {
      if (!pad || !pad.connected) continue;
      pad.buttons.forEach((btn, i) => {
        const mapped = PAD_BUTTONS[i];
        if (mapped && btn.pressed) this.padHeld.add(mapped);
      });
      const [ax = 0, ay = 0] = pad.axes;
      if (ax < -STICK_DEADZONE) this.padHeld.add('left');
      if (ax > STICK_DEADZONE) this.padHeld.add('right');
      if (ay < -STICK_DEADZONE) this.padHeld.add('up');
      if (ay > STICK_DEADZONE) this.padHeld.add('down');
    }
    for (const b of this.padHeld) this.held.add(b);
  }

  private padHeld = new Set<Button>();

  down(b: Button): boolean {
    return this.held.has(b);
  }

  /** True only on the tick the button went from released to held. */
  pressed(b: Button): boolean {
    return this.held.has(b) && !this.prev.has(b);
  }

  released(b: Button): boolean {
    return !this.held.has(b) && this.prev.has(b);
  }

  anyPressed(): boolean {
    return BUTTONS.some((b) => this.pressed(b));
  }

  /** Horizontal stick axis as -1 / 0 / +1. */
  get ax(): -1 | 0 | 1 {
    const l = this.down('left') ? 1 : 0;
    const r = this.down('right') ? 1 : 0;
    return (r - l) as -1 | 0 | 1;
  }

  /** Vertical stick axis as -1 (up) / 0 / +1 (down). */
  get ay(): -1 | 0 | 1 {
    const u = this.down('up') ? 1 : 0;
    const d = this.down('down') ? 1 : 0;
    return (d - u) as -1 | 0 | 1;
  }

  getBindings(): Bindings {
    return structuredClone(this.bindings);
  }

  setBinding(button: Button, keys: string[]): void {
    this.bindings[button] = keys;
    this.rebuildKeyMap();
    try {
      localStorage.setItem(BINDINGS_KEY, JSON.stringify(this.bindings));
    } catch {
      // Private-mode browsers reject storage; the session-local binding stands.
    }
  }

  /** Drive the game from a script (headless verification runs, attract demo). */
  setScripted(state: Set<Button> | null): void {
    this.scripted = state;
  }

  private rebuildKeyMap(): void {
    this.keyToButtons.clear();
    for (const b of BUTTONS) {
      for (const code of this.bindings[b] ?? []) {
        const list = this.keyToButtons.get(code) ?? [];
        list.push(b);
        this.keyToButtons.set(code, list);
      }
    }
  }
}

function loadBindings(): Bindings {
  const base = structuredClone(DEFAULT_BINDINGS);
  try {
    const raw = localStorage.getItem(BINDINGS_KEY);
    if (!raw) return base;
    const saved = JSON.parse(raw) as Partial<Bindings>;
    for (const b of BUTTONS) {
      const keys = saved[b];
      if (Array.isArray(keys) && keys.every((k) => typeof k === 'string')) {
        base[b] = keys;
      }
    }
  } catch {
    // Corrupt or unavailable storage: fall back to the defaults.
  }
  return base;
}

export const input = new Input();
