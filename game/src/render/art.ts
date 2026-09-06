/**
 * Drawing primitives for the game's art.
 *
 * Every sprite in DESERT SLUG is composed at draw time from integer-snapped
 * primitives rather than loaded from image files. That keeps the whole game a
 * single self-contained bundle, lets poses aim freely instead of being locked
 * to pre-drawn frames, and means all of the art is original work.
 */

/** Axis-aligned filled rect, snapped to whole pixels. */
export function px(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  color: string,
): void {
  if (w <= 0 || h <= 0) return;
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

/** Filled rect with a 1px border drawn just outside it. */
export function outlined(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  fill: string, outline: string,
): void {
  px(ctx, x - 1, y - 1, w + 2, h + 2, outline);
  px(ctx, x, y, w, h, fill);
}

/** Pixel-stepped line of the given thickness (Bresenham with square nibs). */
export function limb(
  ctx: CanvasRenderingContext2D,
  x0: number, y0: number, x1: number, y1: number,
  thickness: number, color: string,
): void {
  let ax = Math.round(x0);
  let ay = Math.round(y0);
  const bx = Math.round(x1);
  const by = Math.round(y1);
  const dx = Math.abs(bx - ax);
  const dy = -Math.abs(by - ay);
  const sx = ax < bx ? 1 : -1;
  const sy = ay < by ? 1 : -1;
  let err = dx + dy;
  const t = Math.max(1, Math.round(thickness));
  const off = Math.floor(t / 2);

  ctx.fillStyle = color;
  // Guard against pathological input so a bad call can never hang a frame.
  for (let guard = 0; guard < 512; guard++) {
    ctx.fillRect(ax - off, ay - off, t, t);
    if (ax === bx && ay === by) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; ax += sx; }
    if (e2 <= dx) { err += dx; ay += sy; }
  }
}

/** Filled circle rasterised row by row so the edge stays chunky. */
export function disc(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, r: number,
  color: string,
): void {
  const icx = Math.round(cx);
  const icy = Math.round(cy);
  const ir = Math.max(0, Math.round(r));
  ctx.fillStyle = color;
  for (let dy = -ir; dy <= ir; dy++) {
    const w = Math.floor(Math.sqrt(Math.max(0, ir * ir - dy * dy)));
    if (w <= 0 && ir > 0) continue;
    ctx.fillRect(icx - w, icy + dy, w * 2 + 1, 1);
  }
}

/** Hollow circle, one pixel thick. */
export function ring(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, r: number,
  color: string,
): void {
  const icx = Math.round(cx);
  const icy = Math.round(cy);
  const ir = Math.max(1, Math.round(r));
  ctx.fillStyle = color;
  let x = ir;
  let y = 0;
  let err = 1 - ir;
  while (x >= y) {
    for (const [px_, py] of [
      [x, y], [y, x], [-y, x], [-x, y], [-x, -y], [-y, -x], [y, -x], [x, -y],
    ] as const) {
      ctx.fillRect(icx + px_, icy + py, 1, 1);
    }
    y++;
    if (err < 0) err += 2 * y + 1;
    else { x--; err += 2 * (y - x) + 1; }
  }
}

/**
 * Bakes a pixel-map string grid into a canvas. Used for the handful of small
 * emblems (crate letters, icons) where an exact silhouette matters.
 */
export function bakePixels(
  rows: readonly string[],
  map: Record<string, string>,
): HTMLCanvasElement {
  const h = rows.length;
  const w = rows.reduce((m, r) => Math.max(m, r.length), 0);
  const cv = document.createElement('canvas');
  cv.width = Math.max(1, w);
  cv.height = Math.max(1, h);
  const ctx = cv.getContext('2d');
  if (!ctx) return cv;
  for (let y = 0; y < h; y++) {
    const row = rows[y];
    for (let x = 0; x < row.length; x++) {
      const color = map[row[x]];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  return cv;
}

/**
 * Runs `body` with the canvas mirrored around `pivotX`, so a right-facing
 * drawing routine can serve both directions.
 */
export function mirrored(
  ctx: CanvasRenderingContext2D,
  pivotX: number,
  flip: boolean,
  body: () => void,
): void {
  if (!flip) {
    body();
    return;
  }
  ctx.save();
  ctx.translate(Math.round(pivotX) * 2, 0);
  ctx.scale(-1, 1);
  body();
  ctx.restore();
}

let scratch: HTMLCanvasElement | null = null;

function scratchFor(w: number, h: number): CanvasRenderingContext2D | null {
  if (!scratch) scratch = document.createElement('canvas');
  if (scratch.width < w || scratch.height < h) {
    scratch.width = Math.max(scratch.width, w);
    scratch.height = Math.max(scratch.height, h);
  }
  const c = scratch.getContext('2d');
  if (!c) return null;
  c.clearRect(0, 0, scratch.width, scratch.height);
  return c;
}

/**
 * Draws `body` recoloured to a single flat colour, for the white damage flash
 * and for drop shadows. `body` receives its own context and must draw within
 * the given box.
 */
export function drawTinted(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  tint: string,
  body: (c: CanvasRenderingContext2D) => void,
  alpha = 1,
): void {
  const bx = Math.floor(x);
  const by = Math.floor(y);
  const bw = Math.ceil(w);
  const bh = Math.ceil(h);
  const c = scratchFor(bw, bh);
  if (!c) return;

  c.save();
  c.translate(-bx, -by);
  body(c);
  c.restore();

  c.globalCompositeOperation = 'source-in';
  c.fillStyle = tint;
  c.fillRect(0, 0, bw, bh);
  c.globalCompositeOperation = 'source-over';

  const prev = ctx.globalAlpha;
  ctx.globalAlpha = prev * alpha;
  ctx.drawImage(c.canvas, 0, 0, bw, bh, bx, by, bw, bh);
  ctx.globalAlpha = prev;
}
