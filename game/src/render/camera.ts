import { SCREEN_W } from './screen';

/**
 * Horizontal scrolling camera with an arcade "combat gate": the view follows
 * the player until it reaches a gate, then holds there until the gate opens
 * (its wave has been cleared), which is how run-and-guns pace their fights.
 */
export class Camera {
  x = 0;
  y = 0;
  /** Right-most camera x allowed by the level (level length - screen width). */
  maxX = 0;
  /** Right-most camera x allowed by the currently closed gate, if any. */
  gateX = Infinity;

  private shakeTicks = 0;
  private shakeMag = 0;
  private shakeSeed = 0;

  reset(): void {
    this.x = 0;
    this.y = 0;
    this.gateX = Infinity;
    this.shakeTicks = 0;
    this.shakeMag = 0;
  }

  get limit(): number {
    return Math.min(this.maxX, this.gateX);
  }

  /** Eases toward keeping the player about 40% into the screen. */
  follow(targetX: number): void {
    const want = targetX - SCREEN_W * 0.4;
    const clamped = Math.max(0, Math.min(this.limit, want));
    // Never scroll backwards: arcade run-and-guns only advance.
    const next = Math.max(this.x, clamped);
    this.x += (next - this.x) * 0.18;
    if (Math.abs(next - this.x) < 0.35) this.x = next;
  }

  shake(magnitude: number, ticks: number): void {
    if (magnitude <= this.shakeMag && this.shakeTicks > 0) return;
    this.shakeMag = magnitude;
    this.shakeTicks = ticks;
    this.shakeSeed = (this.shakeSeed + 7919) & 0xffff;
  }

  tick(): void {
    if (this.shakeTicks > 0) this.shakeTicks--;
  }

  /** Sub-pixel-free offsets to subtract when drawing world objects. */
  get ox(): number {
    return Math.round(this.x - this.shakeOffset(0));
  }

  get oy(): number {
    return Math.round(this.y - this.shakeOffset(1));
  }

  private shakeOffset(axis: 0 | 1): number {
    if (this.shakeTicks <= 0) return 0;
    const t = this.shakeTicks + this.shakeSeed + axis * 31;
    // Cheap deterministic wobble that decays with the remaining ticks.
    const wave = Math.sin(t * (axis === 0 ? 2.7 : 3.9)) * this.shakeMag;
    return wave * (this.shakeTicks / 18);
  }
}
