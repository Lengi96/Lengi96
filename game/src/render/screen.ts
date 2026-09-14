/**
 * The virtual arcade screen: a fixed 320x224 backbuffer (the Neo Geo MVS
 * visible resolution) that is blitted to the page at an integer scale so
 * every game pixel stays a crisp square block.
 */
export const SCREEN_W = 320;
export const SCREEN_H = 224;

export class Screen {
  readonly buffer: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  private out: HTMLCanvasElement;
  private outCtx: CanvasRenderingContext2D;
  private scale = 1;

  constructor(out: HTMLCanvasElement) {
    this.out = out;
    const outCtx = out.getContext('2d', { alpha: false });
    if (!outCtx) throw new Error('2D canvas context unavailable');
    this.outCtx = outCtx;

    this.buffer = document.createElement('canvas');
    this.buffer.width = SCREEN_W;
    this.buffer.height = SCREEN_H;
    const ctx = this.buffer.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('2D backbuffer context unavailable');
    this.ctx = ctx;
    this.ctx.imageSmoothingEnabled = false;

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  /** Largest integer scale that still fits the viewport, minimum 1. */
  resize(): void {
    const pad = 8;
    const sx = Math.floor((window.innerWidth - pad) / SCREEN_W);
    const sy = Math.floor((window.innerHeight - pad) / SCREEN_H);
    this.scale = Math.max(1, Math.min(sx, sy));
    this.out.width = SCREEN_W * this.scale;
    this.out.height = SCREEN_H * this.scale;
    this.out.style.width = `${SCREEN_W * this.scale}px`;
    this.out.style.height = `${SCREEN_H * this.scale}px`;
    this.outCtx.imageSmoothingEnabled = false;
  }

  clear(color: string): void {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
  }

  /** Copy the backbuffer to the visible canvas. */
  present(): void {
    this.outCtx.imageSmoothingEnabled = false;
    this.outCtx.drawImage(
      this.buffer, 0, 0, SCREEN_W, SCREEN_H,
      0, 0, SCREEN_W * this.scale, SCREEN_H * this.scale,
    );
  }

  get currentScale(): number {
    return this.scale;
  }
}
