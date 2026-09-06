import { PAL } from './palette';
import { px, disc, limb } from './art';
import { SCREEN_W, SCREEN_H } from './screen';
import type { Camera } from './camera';
import type { Level } from '../game/level';

/**
 * The mission-1 backdrop: a desert town at first light. Everything is
 * generated from the camera position, so an arbitrarily long level costs
 * nothing to store.
 */

const SKY_BANDS: Array<[number, string]> = [
  [0.0, '#20304f'],
  [0.28, '#3f5878'],
  [0.5, '#7d7e8d'],
  [0.66, '#c08a63'],
  [0.82, '#dcae74'],
];

export function drawSky(ctx: CanvasRenderingContext2D): void {
  for (let i = 0; i < SKY_BANDS.length; i++) {
    const [t, color] = SKY_BANDS[i];
    const next = SKY_BANDS[i + 1]?.[0] ?? 1;
    px(ctx, 0, t * SCREEN_H, SCREEN_W, (next - t) * SCREEN_H + 1, color);
  }
  // Low sun sitting just above the skyline.
  disc(ctx, SCREEN_W - 74, SCREEN_H * 0.5, 13, '#f2c27a');
  disc(ctx, SCREEN_W - 74, SCREEN_H * 0.5, 9, '#fbe3ae');
}

/** Deterministic hash so the same x always produces the same scenery. */
function hash(n: number): number {
  let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}

export function drawParallax(ctx: CanvasRenderingContext2D, cam: Camera): void {
  // Layer order back to front. The skylines are tall enough to reach well up
  // into the sky so the frame does not read as an empty band over a strip of
  // ground, which is how the arcade backdrops are composed.
  drawDunes(ctx, cam.x * 0.1, SCREEN_H * 0.46, '#6d5636', 24, 210);
  drawDunes(ctx, cam.x * 0.18, SCREEN_H * 0.56, '#5b482c', 18, 160);
  drawSkyline(ctx, cam.x * 0.32, 180);
  drawSkyline(ctx, cam.x * 0.55, 194, true);
}

function drawDunes(
  ctx: CanvasRenderingContext2D,
  offset: number, baseY: number, color: string,
  amp: number, period: number,
): void {
  ctx.fillStyle = color;
  for (let sx = 0; sx < SCREEN_W; sx++) {
    const wx = sx + offset;
    const h = Math.sin(wx / period) * amp + Math.sin(wx / (period * 0.37)) * (amp * 0.3);
    const top = Math.round(baseY - h * 0.5);
    ctx.fillRect(sx, top, 1, SCREEN_H - top);
  }
}

function drawSkyline(
  ctx: CanvasRenderingContext2D,
  offset: number, baseY: number, near = false,
): void {
  const cell = near ? 46 : 62;
  const start = Math.floor(offset / cell) - 1;
  for (let i = start; i < start + Math.ceil(SCREEN_W / cell) + 3; i++) {
    const r = hash(i * (near ? 977 : 613));
    const bw = Math.round(26 + r * (near ? 34 : 24));
    const bh = Math.round((near ? 54 : 44) + hash(i * 31 + 7) * (near ? 66 : 52));
    const bx = Math.round(i * cell - offset);
    const by = Math.round(baseY - bh);
    // The backdrop is kept dark and low-contrast on purpose: the play plane
    // and the characters have to be the brightest things on screen.
    const body = near ? '#4a3626' : '#38291f';
    const roof = near ? '#5a422e' : '#443127';

    px(ctx, bx, by, bw, bh, body);
    px(ctx, bx, by, bw, 3, roof);

    // A dome or a minaret on some of them, for the town silhouette.
    const flavour = hash(i * 53 + 3);
    if (flavour > 0.72) {
      disc(ctx, bx + bw / 2, by, Math.round(bw * 0.36), roof);
      px(ctx, bx + Math.round(bw / 2) - 1, by - Math.round(bw * 0.36) - 5, 2, 6, roof);
    } else if (flavour > 0.52) {
      const tw = 9;
      const tx = bx + Math.round(bw * 0.58);
      px(ctx, tx, by - 34, tw, 34, body);
      px(ctx, tx, by - 34, tw, 3, roof);
      px(ctx, tx + 2, by - 41, 5, 7, roof);
      px(ctx, tx + 3, by - 46, 3, 5, roof);
    }

    // Windows
    for (let wy = by + 7; wy < by + bh - 5; wy += 9) {
      for (let wx = bx + 4; wx < bx + bw - 5; wx += 9) {
        if (hash(wx * 7 + wy * 13) > 0.55) px(ctx, wx, wy, 3, 4, '#241b1b');
        else px(ctx, wx, wy, 3, 4, near ? '#8a6a37' : '#6d5330');
      }
    }
  }
}

/**
 * Paints the collision geometry as actual terrain: sand-capped rock for solid
 * ground, timber for the one-way platforms the player can jump up through.
 */
export function drawTerrain(ctx: CanvasRenderingContext2D, cam: Camera, level: Level): void {
  for (const s of level.solids) {
    const x = Math.round(s.x - cam.ox);
    const y = Math.round(s.y - cam.oy);
    if (x > SCREEN_W || x + s.w < 0) continue;

    if (s.kind === 'platform') {
      // A timber walkway: capped plank, plank seams, and a shadow underneath.
      px(ctx, x, y - 1, s.w, 6, PAL.outline);
      px(ctx, x, y, s.w, 4, PAL.rust);
      px(ctx, x, y, s.w, 1, PAL.sandDark);
      for (let i = 4; i < s.w; i += 11) px(ctx, x + i, y, 1, 4, PAL.brickDark);
      for (let i = 6; i < s.w - 6; i += 26) px(ctx, x + i, y + 5, 3, 5, PAL.brickDark);
      continue;
    }

    px(ctx, x, y, s.w, s.h, PAL.sandDeep);
    px(ctx, x, y, s.w, 6, PAL.sandDark);
    px(ctx, x, y, s.w, 3, PAL.sand);
    px(ctx, x, y, s.w, 1, '#f0d59a');
    // Masonry courses so long ground blocks do not read as a flat slab.
    for (let row = 6; row < s.h; row += 8) {
      for (let col = (row % 16 === 6 ? 0 : 8); col < s.w; col += 16) {
        px(ctx, x + col, y + row, 14, 6, PAL.brickDark);
        px(ctx, x + col, y + row, 14, 1, PAL.brick);
      }
    }
    px(ctx, x, y + s.h - 1, s.w, 1, PAL.black);
  }
}

/** A few foreground details that scroll slightly faster than the play plane. */
export function drawForeground(ctx: CanvasRenderingContext2D, cam: Camera): void {
  const offset = cam.x * 1.15;
  const cell = 120;
  const start = Math.floor(offset / cell) - 1;
  for (let i = start; i < start + 5; i++) {
    if (hash(i * 271) < 0.55) continue;
    const x = Math.round(i * cell - offset);
    const y = SCREEN_H - 4;
    limb(ctx, x, y, x - 6, y - 12, 2, '#3a2c22');
    limb(ctx, x, y, x + 5, y - 9, 2, '#3a2c22');
    limb(ctx, x, y, x + 1, y - 15, 2, '#3a2c22');
  }
}
