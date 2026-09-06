import { px, limb, disc, mirrored, drawOutlined } from './art';
import { PAL } from './palette';

/**
 * A parametric humanoid. Both the hero and the rebel infantry are drawn by
 * this one routine with different palettes and poses, which is why the cast
 * looks like it belongs to the same game without a single sprite sheet.
 *
 * Proportions are deliberately chunky - a big head on a short, wide body -
 * because at 22 pixels tall a realistic figure turns into an unreadable
 * smudge. Every part is shaded in three tones and the whole silhouette gets a
 * hard keyline so the character stays legible against the scenery.
 */
export interface ActorSkin {
  cloth: string;
  clothDark: string;
  clothLight: string;
  skin: string;
  skinDark: string;
  hat: string;
  hatDark: string;
  boot: string;
  outline: string;
  /** Webbing, belt and glove colour. */
  gear?: string;
}

export const HERO_SKIN: ActorSkin = {
  cloth: PAL.hero,
  clothDark: PAL.heroDark,
  clothLight: PAL.heroLight,
  skin: PAL.skin,
  skinDark: PAL.skinDark,
  hat: PAL.bandana,
  hatDark: PAL.bandanaDark,
  boot: '#3b2a20',
  outline: PAL.outline,
  gear: '#33301f',
};

export const REBEL_SKIN: ActorSkin = {
  cloth: PAL.foe,
  clothDark: PAL.foeDark,
  clothLight: PAL.foeLight,
  skin: PAL.skin,
  skinDark: PAL.skinDark,
  hat: PAL.foeAccent,
  hatDark: '#3d2748',
  boot: '#241c18',
  outline: PAL.outline,
  gear: '#2b2419',
};

export const POW_SKIN: ActorSkin = {
  cloth: PAL.bone,
  clothDark: PAL.sandDark,
  clothLight: PAL.white,
  skin: PAL.skin,
  skinDark: PAL.skinDark,
  hat: PAL.sandDark,
  hatDark: PAL.sandDeep,
  boot: '#3b2a20',
  outline: PAL.outline,
  gear: '#6b5a3c',
};

export type GunKind = 'pistol' | 'rifle' | 'heavy' | 'none';

export interface ActorPose {
  facing: -1 | 1;
  /** Aim angle in radians in *facing space*: 0 = forward, -PI/2 = up. */
  aim: number;
  /** Run-cycle position, 0..1. */
  legPhase: number;
  moving: boolean;
  crouch: boolean;
  airborne: boolean;
  /** Knife swing progress, 0 = not swinging. */
  melee: number;
  gun: GunKind;
  /** Body width multiplier - used by the "fat" transformation. */
  girth?: number;
  /** Arms-up surrender pose for prisoners. */
  bound?: boolean;
  /** Set while hurt/dying to slump the pose. */
  falling?: boolean;
}

const STAND_H = 22;
const CROUCH_H = 14;

export function actorHeight(pose: ActorPose): number {
  return pose.crouch ? CROUCH_H : STAND_H;
}

/** Vertical landmarks of the figure, measured up from the feet. */
interface Metrics {
  headTop: number;
  headBottom: number;
  shoulder: number;
  waist: number;
  hip: number;
  bootTop: number;
  halfW: number;
}

function metrics(pose: ActorPose): Metrics {
  const g = pose.girth ?? 1;
  if (pose.crouch) {
    return { headTop: 14, headBottom: 7, shoulder: 6, waist: 4, hip: 3, bootTop: 3, halfW: Math.round(4 * g) };
  }
  return { headTop: 22, headBottom: 14, shoulder: 13, waist: 8, hip: 7, bootTop: 3, halfW: Math.round(4 * g) };
}

/**
 * Draws the actor with its feet at (x, y). All coordinates are rounded, so the
 * result stays on the pixel grid at any camera position.
 */
export function drawActor(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  skin: ActorSkin,
  pose: ActorPose,
): void {
  const bx = Math.round(x);
  const by = Math.round(y);
  const reach = 22;

  drawOutlined(ctx, bx - reach, by - 34, reach * 2, 38, skin.outline, (c) => {
    mirrored(c, bx, pose.facing === -1, () => {
      if (pose.falling) {
        drawSlumped(c, bx, by, skin, pose.girth ?? 1);
        return;
      }
      const m = metrics(pose);
      drawLegs(c, bx, by, skin, pose, m);
      drawTorso(c, bx, by, skin, m);
      drawRearArm(c, bx, by, skin, pose, m);
      drawHead(c, bx, by, skin, pose, m);
      drawFrontArm(c, bx, by, skin, pose, m);
    });
  });
}

// ---------------------------------------------------------------- body parts

function drawLegs(
  ctx: CanvasRenderingContext2D,
  bx: number, by: number,
  skin: ActorSkin, pose: ActorPose, m: Metrics,
): void {
  const hipY = by - m.hip;

  const boot = (fx: number, fy: number) => {
    // Chunky boot with a lighter toe cap, drawn toward the facing direction.
    px(ctx, fx - 3, fy - 4, 7, 4, skin.boot);
    px(ctx, fx - 1, fy - 4, 5, 2, shade(skin.boot, 1.35));
    px(ctx, fx - 3, fy - 1, 7, 1, skin.outline);
  };
  const thigh = (toX: number, toY: number, color: string) => {
    limb(ctx, bx, hipY, toX, toY, 5, color);
  };

  if (pose.airborne) {
    thigh(bx - 4, by - 7, skin.clothDark);
    thigh(bx + 5, by - 5, skin.cloth);
    boot(bx - 5, by - 5);
    boot(bx + 6, by - 3);
    return;
  }

  if (pose.crouch) {
    thigh(bx - 4, by - 3, skin.clothDark);
    thigh(bx + 5, by - 3, skin.cloth);
    boot(bx - 4, by);
    boot(bx + 5, by);
    return;
  }

  if (!pose.moving) {
    thigh(bx - 2, by - 4, skin.clothDark);
    thigh(bx + 3, by - 4, skin.cloth);
    boot(bx - 3, by);
    boot(bx + 3, by);
    return;
  }

  // Run cycle: one leg reaches forward while the other pushes off behind.
  const t = pose.legPhase * Math.PI * 2;
  const swing = Math.sin(t);
  const lift = Math.cos(t);
  const frontX = bx + Math.round(swing * 5);
  const backX = bx - Math.round(swing * 5);
  const frontY = by - Math.round(Math.max(0, lift) * 4);
  const backY = by - Math.round(Math.max(0, -lift) * 4);

  thigh(backX, backY - 3, skin.clothDark);
  boot(backX, backY);
  thigh(frontX, frontY - 3, skin.cloth);
  boot(frontX, frontY);
}

function drawTorso(
  ctx: CanvasRenderingContext2D,
  bx: number, by: number,
  skin: ActorSkin, m: Metrics,
): void {
  const top = by - m.shoulder;
  const bottom = by - m.hip;
  const h = bottom - top;
  const w = m.halfW * 2 + 1;
  const left = bx - m.halfW;

  // Base, then a lit front edge and a shaded back edge to give it volume.
  px(ctx, left, top, w, h, skin.cloth);
  px(ctx, left, top, 2, h, skin.clothDark);
  px(ctx, bx + m.halfW - 2, top, 3, h, skin.clothLight);
  px(ctx, left, top, w, 1, skin.clothLight);

  // Chest webbing and belt.
  const gear = skin.gear ?? skin.clothDark;
  px(ctx, left + 1, top + 2, w - 2, 1, gear);
  px(ctx, left, by - m.waist, w, 2, gear);
  px(ctx, bx + 1, by - m.waist, 2, 2, shade(gear, 1.6));

  // A slung pouch on the back hip reads as kit at this size.
  px(ctx, left - 1, by - m.waist - 1, 3, 4, skin.clothDark);
}

function drawHead(
  ctx: CanvasRenderingContext2D,
  bx: number, by: number,
  skin: ActorSkin, pose: ActorPose, m: Metrics,
): void {
  const top = by - m.headTop;
  const bottom = by - m.headBottom;
  const h = bottom - top;

  // Neck
  px(ctx, bx - 1, bottom - 1, 4, 2, skin.skinDark);

  // Skull: 10 wide, with the jaw pulled in on the back side.
  px(ctx, bx - 4, top, 10, h, skin.skin);
  px(ctx, bx - 4, top, 3, h, skin.skinDark);
  px(ctx, bx - 4, bottom - 2, 10, 2, skin.skinDark);
  px(ctx, bx + 4, top + 2, 2, h - 4, shade(skin.skin, 1.12));

  // Ear
  px(ctx, bx - 1, top + 4, 2, 2, skin.skinDark);

  // Headband with two tails streaming off the back.
  px(ctx, bx - 4, top, 10, 3, skin.hat);
  px(ctx, bx - 4, top + 2, 10, 1, skin.hatDark);
  px(ctx, bx - 7, top + 1, 3, 2, skin.hat);
  px(ctx, bx - 9, top + 2, 3, 2, skin.hatDark);

  // Brow and eye. The head tips back when aiming upward.
  const up = pose.aim < -0.7;
  const eyeY = top + (up ? 3 : 4);
  px(ctx, bx + 1, eyeY - 1, 4, 1, skin.skinDark);
  px(ctx, bx + 2, eyeY, 2, 2, PAL.outline);
  px(ctx, bx + 3, eyeY, 1, 1, PAL.white);
  // Set jaw
  px(ctx, bx + 3, bottom - 3, 2, 1, skin.skinDark);
}

function drawRearArm(
  ctx: CanvasRenderingContext2D,
  bx: number, by: number,
  skin: ActorSkin, pose: ActorPose, m: Metrics,
): void {
  if (pose.bound) return;
  const sy = by - m.shoulder + 2;
  // Tucked behind the body, so it is drawn before the torso's front edge.
  limb(ctx, bx - 2, sy, bx - 4, by - m.waist + 1, 4, skin.clothDark);
  px(ctx, bx - 6, by - m.waist, 3, 3, shade(skin.skin, 0.85));
}

function drawFrontArm(
  ctx: CanvasRenderingContext2D,
  bx: number, by: number,
  skin: ActorSkin, pose: ActorPose, m: Metrics,
): void {
  const sy = by - m.shoulder + 2;

  if (pose.bound) {
    // Hands tied above the head.
    limb(ctx, bx - 2, sy, bx - 3, sy - 11, 4, skin.skin);
    limb(ctx, bx + 2, sy, bx + 3, sy - 11, 4, skin.skin);
    px(ctx, bx - 4, sy - 13, 9, 3, PAL.bone);
    px(ctx, bx - 4, sy - 13, 9, 1, PAL.white);
    return;
  }

  const swing = pose.melee;
  const aim = swing > 0 ? -0.6 + swing * 1.5 : pose.aim;
  const len = pose.gun === 'none' ? 8 : 9;
  const ex = bx + 2;
  const hx = ex + Math.cos(aim) * len;
  const hy = sy + Math.sin(aim) * len;

  // Upper arm, then a glove at the wrist.
  limb(ctx, ex, sy, hx, hy, 5, skin.cloth);
  limb(ctx, ex, sy, (ex + hx) / 2, (sy + hy) / 2, 5, skin.clothLight);
  px(ctx, Math.round(hx) - 2, Math.round(hy) - 2, 4, 4, skin.gear ?? skin.clothDark);

  if (swing > 0) {
    drawKnife(ctx, hx, hy, aim);
    return;
  }
  drawGun(ctx, hx, hy, aim, pose.gun);
}

function drawGun(
  ctx: CanvasRenderingContext2D,
  hx: number, hy: number, aim: number, gun: GunKind,
): void {
  if (gun === 'none') return;
  const len = gun === 'heavy' ? 13 : gun === 'rifle' ? 11 : 7;
  const th = gun === 'heavy' ? 5 : gun === 'rifle' ? 4 : 3;
  const cos = Math.cos(aim);
  const sin = Math.sin(aim);

  // Barrel with a lit top edge, plus a receiver block at the grip.
  limb(ctx, hx, hy, hx + cos * len, hy + sin * len, th, PAL.steelDark);
  limb(ctx, hx + cos * 2, hy + sin * 2 - 1, hx + cos * (len - 1), hy + sin * (len - 1) - 1, 1, PAL.steelLight);
  px(ctx, Math.round(hx) - 2, Math.round(hy) - 2, 5, 5, PAL.steelDark);
  px(ctx, Math.round(hx) - 1, Math.round(hy) - 1, 3, 2, PAL.steel);

  if (gun === 'heavy') {
    // Drum magazine under the receiver.
    disc(ctx, hx + cos * 3, hy + sin * 3 + 3, 3, PAL.steelDark);
    disc(ctx, hx + cos * 3, hy + sin * 3 + 3, 1, PAL.steel);
  } else if (gun === 'rifle') {
    px(ctx, Math.round(hx + cos * 4) - 1, Math.round(hy + sin * 4) + 2, 3, 3, PAL.steelDark);
  }
}

function drawKnife(ctx: CanvasRenderingContext2D, hx: number, hy: number, aim: number): void {
  const cos = Math.cos(aim);
  const sin = Math.sin(aim);
  limb(ctx, hx, hy, hx + cos * 11, hy + sin * 11, 3, PAL.steelLight);
  limb(ctx, hx + cos * 2, hy + sin * 2, hx + cos * 9, hy + sin * 9, 1, PAL.white);
  px(ctx, Math.round(hx) - 2, Math.round(hy) - 2, 4, 4, PAL.rust);
}

function drawSlumped(
  ctx: CanvasRenderingContext2D,
  bx: number, by: number, skin: ActorSkin, g: number,
): void {
  // Knocked off their feet: body low, limbs thrown out, head back.
  const halfW = Math.round(4 * g);
  px(ctx, bx - halfW, by - 11, halfW * 2 + 1, 9, skin.cloth);
  px(ctx, bx - halfW, by - 11, halfW * 2 + 1, 2, skin.clothLight);
  px(ctx, bx - halfW, by - 4, halfW * 2 + 1, 2, skin.clothDark);

  limb(ctx, bx, by - 9, bx - 9, by - 16, 4, skin.skin);
  limb(ctx, bx, by - 9, bx + 8, by - 15, 4, skin.skin);
  limb(ctx, bx - 1, by - 3, bx - 8, by - 1, 5, skin.clothDark);
  limb(ctx, bx + 1, by - 3, bx + 7, by - 2, 5, skin.cloth);
  px(ctx, bx - 11, by - 4, 6, 4, skin.boot);
  px(ctx, bx + 6, by - 5, 6, 4, skin.boot);

  px(ctx, bx - 2, by - 19, 9, 8, skin.skin);
  px(ctx, bx - 2, by - 19, 9, 3, skin.hat);
  px(ctx, bx - 2, by - 17, 9, 1, skin.hatDark);
  // Eyes screwed shut.
  px(ctx, bx + 2, by - 15, 3, 1, PAL.outline);
}

/** Multiplies an #rrggbb colour, for quick lighter/darker variants. */
function shade(hex: string, factor: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const ch = (shift: number) => {
    const v = Math.round(((n >> shift) & 0xff) * factor);
    return Math.max(0, Math.min(255, v));
  };
  return `#${((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, '0')}`;
}
