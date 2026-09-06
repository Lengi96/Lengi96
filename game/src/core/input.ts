/**
 * Arcade-shaped input: an 8-way stick plus three actions (shoot, jump,
 * grenade). Keyboard, mouse and gamepad all funnel into the same abstract
 * button set, so gameplay code never asks which device the player used.
 */
export type Button =
  | 'left' | 'right' | 'up' | 'down'
  | 'shoot' | 'jump' | 'grenade'
  | 'start' | 'pause' | 'mute';

export const BUTTONS: readonly Button[] = [
  'left', 'right', 'up', 'down', 'shoot', 'jump', 'grenade', 'start', 'pause', 'mute',
];

export type Bindings = Record<Button, string[]>;

/**
 * Source codes are `KeyboardEvent.code` values, plus `Mouse<n>` for mouse
 * buttons - so a mouse button is bound and remapped exactly like a key.
 */
export const MOUSE_LEFT = 'Mouse0';
export const MOUSE_RIGHT = 'Mouse2';

export const DEFAULT_BINDINGS: Bindings = {
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  // Fire on the mouse, with the space bar as the keyboard-only equivalent.
  shoot: [MOUSE_LEFT, 'Space'],
  jump: ['KeyX'],
  grenade: ['KeyG'],
  start: ['Enter'],
  pause: ['KeyP', 'Escape'],
  mute: ['KeyM'],
};

/** Standard-gamepad button indices mapped onto our abstract buttons. */
const PAD_BUTTONS: Partial<Record<number, Button>> = {
  0: 'jump',     // A / cross
  1: 'shoot',    // B / circle
  2: 'shoot',    // X / square
  3: 'grenade',  // Y / triangle
  5: 'grenade',  // R1
  7: 'shoot',    // R2
  9: 'start',
  8: 'pause',
  12: 'up',
  13: 'down',
  14: 'left',
  15: 'right',
};

const STICK_DEADZONE = 0.45;
const BINDINGS_KEY = 'desert-slug.bindings.v2';

export class Input {
  /**
   * Physical sources currently down. Buttons are derived from this each tick
   * rather than being toggled directly, so two keys bound to the same button
   * (or a key and the mouse) can be held and released independently without
   * one release cancelling the other.
   */
  private heldCodes = new Set<string>();
  /**
   * Sources that went down since the last tick, even if they are already back
   * up. A mouse click can be shorter than a 16 ms frame, so without this a
   * quick tap that opened and closed between two ticks would be swallowed.
   */
  private tappedCodes = new Set<string>();
  private padButtons = new Set<Button>();

  private held = new Set<Button>();
  private prev = new Set<Button>();
  /** What the previous tick observed; the basis for edge detection. */
  private lastSeen = new Set<Button>();

  private bindings: Bindings = loadBindings();
  private codeToButtons = new Map<string, Button[]>();
  /** When set, replaces all real input — used by the scripted demo runner. */
  private scripted: Set<Button> | null = null;

  constructor() {
    this.rebuildCodeMap();
  }

  /** Marks a source as down. Public so the input path is testable without a DOM. */
  keyDown(code: string): boolean {
    if (!this.codeToButtons.has(code)) return false;
    this.heldCodes.add(code);
    this.tappedCodes.add(code);
    return true;
  }

  keyUp(code: string): boolean {
    if (!this.codeToButtons.has(code)) return false;
    this.heldCodes.delete(code);
    return true;
  }

  clear(): void {
    this.heldCodes.clear();
    this.tappedCodes.clear();
  }

  /**
   * @param target where key events are listened for
   * @param pointerTarget element that receives mouse presses; button-up and
   *   focus loss are watched on the window so a release outside the play area
   *   still counts.
   */
  attach(target: Window = window, pointerTarget: HTMLElement | Window = window): () => void {
    const down = (e: KeyboardEvent) => {
      if (this.keyDown(e.code)) e.preventDefault();
    };
    const up = (e: KeyboardEvent) => {
      if (this.keyUp(e.code)) e.preventDefault();
    };
    const blur = () => this.clear();

    const pointerDown = (e: PointerEvent) => {
      if (this.keyDown(`Mouse${e.button}`)) e.preventDefault();
    };
    const pointerUp = (e: PointerEvent) => {
      this.keyUp(`Mouse${e.button}`);
    };
    // A right-click bound to an action must not also open the browser menu.
    const contextMenu = (e: Event) => {
      if (this.codeToButtons.has(MOUSE_RIGHT)) e.preventDefault();
    };

    target.addEventListener('keydown', down as EventListener);
    target.addEventListener('keyup', up as EventListener);
    target.addEventListener('blur', blur);
    pointerTarget.addEventListener('pointerdown', pointerDown as EventListener);
    pointerTarget.addEventListener('contextmenu', contextMenu);
    target.addEventListener('pointerup', pointerUp as EventListener);
    target.addEventListener('pointercancel', pointerUp as EventListener);

    return () => {
      target.removeEventListener('keydown', down as EventListener);
      target.removeEventListener('keyup', up as EventListener);
      target.removeEventListener('blur', blur);
      pointerTarget.removeEventListener('pointerdown', pointerDown as EventListener);
      pointerTarget.removeEventListener('contextmenu', contextMenu);
      target.removeEventListener('pointerup', pointerUp as EventListener);
      target.removeEventListener('pointercancel', pointerUp as EventListener);
    };
  }

  /**
   * Call once per simulation tick, before the world updates.
   *
   * `prev` has to be the state the *previous* tick actually saw, not a copy of
   * the current one: input events land between ticks, so snapshotting here
   * would compare the state against itself and no button would ever read as
   * newly pressed.
   */
  beginTick(): void {
    this.prev = this.lastSeen;

    if (this.scripted) {
      this.held = new Set(this.scripted);
    } else {
      this.pollGamepad();
      const next = new Set<Button>();
      for (const code of this.heldCodes) {
        for (const b of this.codeToButtons.get(code) ?? []) next.add(b);
      }
      // A tap that has already ended still counts for this one tick.
      for (const code of this.tappedCodes) {
        for (const b of this.codeToButtons.get(code) ?? []) next.add(b);
      }
      this.tappedCodes.clear();
      for (const b of this.padButtons) next.add(b);
      this.held = next;
    }

    this.lastSeen = new Set(this.held);
  }

  private pollGamepad(): void {
    this.padButtons.clear();
    if (typeof navigator === 'undefined' || !navigator.getGamepads) return;

    for (const pad of navigator.getGamepads()) {
      if (!pad || !pad.connected) continue;
      pad.buttons.forEach((btn, i) => {
        const mapped = PAD_BUTTONS[i];
        if (mapped && btn.pressed) this.padButtons.add(mapped);
      });
      const [ax = 0, ay = 0] = pad.axes;
      if (ax < -STICK_DEADZONE) this.padButtons.add('left');
      if (ax > STICK_DEADZONE) this.padButtons.add('right');
      if (ay < -STICK_DEADZONE) this.padButtons.add('up');
      if (ay > STICK_DEADZONE) this.padButtons.add('down');
    }
  }

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

  setBinding(button: Button, codes: string[]): void {
    this.bindings[button] = codes;
    this.rebuildCodeMap();
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

  private rebuildCodeMap(): void {
    this.codeToButtons.clear();
    for (const b of BUTTONS) {
      for (const code of this.bindings[b] ?? []) {
        const list = this.codeToButtons.get(code) ?? [];
        list.push(b);
        this.codeToButtons.set(code, list);
      }
    }
    // Drop anything still held that is no longer bound to anything.
    for (const code of [...this.heldCodes]) {
      if (!this.codeToButtons.has(code)) this.heldCodes.delete(code);
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
      const codes = saved[b];
      if (Array.isArray(codes) && codes.every((k) => typeof k === 'string')) {
        base[b] = codes;
      }
    }
  } catch {
    // Corrupt or unavailable storage: fall back to the defaults.
  }
  return base;
}

export const input = new Input();
