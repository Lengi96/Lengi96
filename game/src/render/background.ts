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
  [0.0, '#141d34'],
  [0.22, '#24365a'],
  [0.42, '#3d5478'],
  [0.6, '#6d6a7d'],
  [0.72, '#a2715a'],
  [0.82, '#c98f5f'],
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
  // Layer order back to front, each one darker and cooler than the last.
  // Value separation is what keeps the backdrop behind the action: the town
  // is scenery, and it has to lose every contest for the eye against a
  // 22-pixel character standing in front of it.
  drawDunes(ctx, cam.x * 0.1, SCREEN_H * 0.46, '#4a4038', 24, 210);
  drawDunes(ctx, cam.x * 0.18, SCREEN_H * 0.56, '#3b332e', 18, 160);
  drawSkyline(ctx, cam.x * 0.32, 180);
  drawSkyline(ctx, cam.x * 0.55, 196, true);
  // Warm haze pooling at the base of the town, tying it to the ground plane.
  px(ctx, 0, 168, SCREEN_W, 10, 'rgba(150,96,58,0.22)');
  px(ctx, 0, 178, SCREEN_W, 14, 'rgba(120,74,44,0.28)');
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
    const body = near ? '#3a2c26' : '#2b2226';
    const roof = near ? '#48372d' : '#362a2c';

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

    // Windows. Most are dark; only a few are lit, and the lit ones stay dim -
    // a full grid of bright squares reads as wallpaper, not as a town.
    const shutter = near ? '#241c1e' : '#1d1719';
    const lit = near ? '#6b4f2a' : '#4e3a22';
    for (let wy = by + 7; wy < by + bh - 5; wy += 9) {
      for (let wx = bx + 4; wx < bx + bw - 5; wx += 9) {
        const r = hash(wx * 7 + wy * 13);
        // Leave gaps so the facade has blank stretches of wall.
        if (r < 0.22) continue;
        px(ctx, wx, wy, 3, 4, r > 0.82 ? lit : shutter);
        if (r > 0.82) px(ctx, wx, wy, 3, 1, shade(lit, 1.3));
      }
    }

    // A few awnings and doorways at street level to break up the base.
    if (hash(i * 97) > 0.5) {
      const dx = bx + Math.round(bw * 0.3);
      px(ctx, dx, baseY - 12, 7, 12, shutter);
      px(ctx, dx - 1, baseY - 14, 9, 2, roof);
    }
  }
}

/** Multiplies an #rrggbb colour, for quick lighter/darker variants. */
function shade(hex: string, factor: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const ch = (shift: number) =>
    Math.max(0, Math.min(255, Math.round(((n >> shift) & 0xff) * factor)));
  return `#${((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, '0')}`;
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

    drawGroundBlock(ctx, x, y, s.w, s.h, Math.round(s.x));
  }
}

/**
 * One block of solid ground: a bright sand cap, a band of brickwork, and then
 * a fade into darkness toward the bottom of the screen. The falloff matters -
 * a evenly lit slab this large would pull the eye straight off the action.
 */
function drawGroundBlock(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, worldX: number,
): void {
  px(ctx, x, y, w, h, PAL.sandDeep);

  // Sand cap with an irregular top lip so the edge is not a ruled line.
  px(ctx, x, y, w, 6, PAL.sandDark);
  px(ctx, x, y, w, 3, PAL.sand);
  px(ctx, x, y, w, 1, '#f0d59a');
  for (let i = 0; i < w; i++) {
    const r = hash(worldX + i);
    if (r > 0.86) px(ctx, x + i, y - 1, 1, 1, PAL.sand);
    else if (r < 0.1) px(ctx, x + i, y + 1, 1, 1, PAL.sandDark);
  }

  // Brick courses, offset row to row, with the odd cracked or missing brick.
  const brickH = 7;
  const brickW = 22;
  for (let row = 0; (row + 1) * brickH + 6 < h; row++) {
    const top = y + 6 + row * brickH;
    if (top > SCREEN_H) break;
    const offset = row % 2 === 0 ? 0 : brickW / 2;
    for (let col = -1; col * brickW + offset < w; col++) {
      const bx = x + col * brickW + offset;
      const r = hash(worldX + col * 71 + row * 149);
      if (r < 0.06) continue;
      const face = r > 0.8 ? PAL.brick : PAL.brickDark;
      px(ctx, bx, top, brickW - 2, brickH - 2, face);
      px(ctx, bx, top, brickW - 2, 1, r > 0.8 ? '#b8765a' : '#7d4a35');
      if (r > 0.93) px(ctx, bx + 4, top + 2, 5, 2, PAL.sandDeep);
    }
  }

  // Depth falloff: successive translucent bands rather than one flat overlay.
  const from = y + 10;
  for (let band = 0; from + band * 8 < y + h && from + band * 8 < SCREEN_H; band++) {
    px(ctx, x, from + band * 8, w, 8, `rgba(10,6,10,${Math.min(0.5, 0.07 * band)})`);
  }
  px(ctx, x, y + 6, w, 1, PAL.black);
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
