import { px, limb, disc, mirrored } from './art';
import { PAL } from './palette';

/**
 * A parametric humanoid. Both the hero and the rebel infantry are drawn by
 * this one routine with different palettes and poses, which is why the cast
 * looks like it belongs to the same game without a single sprite sheet.
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
}

export const HERO_SKIN: ActorSkin = {
  cloth: PAL.hero,
  clothDark: PAL.heroDark,
  clothLight: PAL.heroLight,
  skin: PAL.skin,
  skinDark: PAL.skinDark,
  hat: PAL.bandana,
  hatDark: PAL.bandanaDark,
  boot: PAL.brickDark,
  outline: PAL.outline,
};

export const REBEL_SKIN: ActorSkin = {
  cloth: PAL.foe,
  clothDark: PAL.foeDark,
  clothLight: PAL.foeLight,
  skin: PAL.skin,
  skinDark: PAL.skinDark,
  hat: PAL.foeAccent,
  hatDark: PAL.foeDark,
  boot: PAL.black,
  outline: PAL.outline,
};

export const POW_SKIN: ActorSkin = {
  cloth: PAL.bone,
  clothDark: PAL.sandDark,
  clothLight: PAL.white,
  skin: PAL.skin,
  skinDark: PAL.skinDark,
  hat: PAL.sandDark,
  hatDark: PAL.sandDeep,
  boot: PAL.brickDark,
  outline: PAL.outline,
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

export function actorHeight(pose: ActorPose): number {
  return pose.crouch ? 14 : STAND_H;
}

/**
 * Draws the actor with its feet at (x, y). All coordinates are rounded, so
 * the result stays on the pixel grid at any camera position.
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
  const g = pose.girth ?? 1;

  mirrored(ctx, bx, pose.facing === -1, () => {
    if (pose.falling) {
      drawSlumped(ctx, bx, by, skin, g);
      return;
    }
    const crouch = pose.crouch;
    const hipY = by - (crouch ? 6 : 9);
    const chestY = by - (crouch ? 12 : 17);
    const headY = by - (crouch ? 15 : 20);
    const halfW = Math.round(3 * g);

    drawLegs(ctx, bx, by, hipY, skin, pose, halfW);
    drawTorso(ctx, bx, hipY, chestY, skin, halfW);
    drawHead(ctx, bx, headY, skin, pose);
    drawArms(ctx, bx, chestY + 2, skin, pose, halfW);
  });
}

function drawLegs(
  ctx: CanvasRenderingContext2D,
  bx: number, by: number, hipY: number,
  skin: ActorSkin, pose: ActorPose, halfW: number,
): void {
  const bootTop = by - 4;

  if (pose.airborne) {
    // Tucked legs while jumping.
    limb(ctx, bx - 1, hipY, bx - 3, by - 5, 3, skin.clothDark);
    limb(ctx, bx + 1, hipY, bx + 4, by - 3, 3, skin.cloth);
    px(ctx, bx - 5, by - 6, 4, 3, skin.boot);
    px(ctx, bx + 2, by - 4, 5, 3, skin.boot);
    return;
  }

  if (pose.crouch) {
    limb(ctx, bx - 1, hipY, bx - 3, by - 2, 4, skin.clothDark);
    limb(ctx, bx + 1, hipY, bx + 4, by - 2, 4, skin.cloth);
    px(ctx, bx - 5, by - 3, 5, 3, skin.boot);
    px(ctx, bx + 2, by - 3, 5, 3, skin.boot);
    return;
  }

  if (!pose.moving) {
    limb(ctx, bx - 2, hipY, bx - 2, bootTop, 3, skin.clothDark);
    limb(ctx, bx + 2, hipY, bx + 2, bootTop, 3, skin.cloth);
    px(ctx, bx - 4, by - 3, 5, 3, skin.boot);
    px(ctx, bx, by - 3, 5, 3, skin.boot);
    return;
  }

  const swing = Math.sin(pose.legPhase * Math.PI * 2);
  const lift = Math.max(0, Math.cos(pose.legPhase * Math.PI * 2));
  const frontX = bx + Math.round(swing * 4);
  const backX = bx - Math.round(swing * 4);
  const frontFootY = by - Math.round(lift * 3);
  const backFootY = by - Math.round(Math.max(0, -Math.cos(pose.legPhase * Math.PI * 2)) * 3);

  limb(ctx, bx - 1, hipY, backX, backFootY - 3, 3, skin.clothDark);
  px(ctx, backX - 2, backFootY - 3, 5, 3, skin.boot);
  limb(ctx, bx + 1, hipY, frontX, frontFootY - 3, 3, skin.cloth);
  px(ctx, frontX - 2, frontFootY - 3, 5, 3, skin.boot);
  void halfW;
}

function drawTorso(
  ctx: CanvasRenderingContext2D,
  bx: number, hipY: number, chestY: number,
  skin: ActorSkin, halfW: number,
): void {
  const h = hipY - chestY;
  px(ctx, bx - halfW - 1, chestY - 1, halfW * 2 + 3, h + 2, skin.outline);
  px(ctx, bx - halfW, chestY, halfW * 2 + 1, h, skin.cloth);
  // Webbing and a shoulder highlight give the torso some read at this size.
  px(ctx, bx - halfW, chestY + 2, halfW * 2 + 1, 1, skin.clothDark);
  px(ctx, bx - halfW, chestY, 2, h, skin.clothLight);
  px(ctx, bx + halfW - 1, chestY + 1, 1, h - 2, skin.clothDark);
}

function drawHead(
  ctx: CanvasRenderingContext2D,
  bx: number, headY: number,
  skin: ActorSkin, pose: ActorPose,
): void {
  // Neck
  px(ctx, bx - 1, headY + 3, 3, 2, skin.skinDark);
  // Skull
  px(ctx, bx - 4, headY - 4, 9, 9, skin.outline);
  px(ctx, bx - 3, headY - 3, 7, 7, skin.skin);
  px(ctx, bx - 3, headY + 2, 7, 1, skin.skinDark);
  // Bandana / helmet band
  px(ctx, bx - 4, headY - 4, 9, 3, skin.hatDark);
  px(ctx, bx - 3, headY - 4, 7, 2, skin.hat);
  px(ctx, bx - 6, headY - 3, 3, 2, skin.hat);
  // Eye, offset forward. Looking up when aiming up.
  const eyeY = headY + (pose.aim < -0.7 ? -2 : -1);
  px(ctx, bx + 1, eyeY, 2, 2, PAL.outline);
  px(ctx, bx + 2, eyeY, 1, 1, PAL.white);
}

function drawArms(
  ctx: CanvasRenderingContext2D,
  bx: number, shoulderY: number,
  skin: ActorSkin, pose: ActorPose, halfW: number,
): void {
  if (pose.bound) {
    // Hands tied above the head.
    limb(ctx, bx - 1, shoulderY, bx - 2, shoulderY - 9, 3, skin.skin);
    limb(ctx, bx + 1, shoulderY, bx + 2, shoulderY - 9, 3, skin.skin);
    px(ctx, bx - 3, shoulderY - 11, 7, 2, PAL.bone);
    return;
  }

  const swing = pose.melee;
  const aim = swing > 0 ? -0.5 + swing * 1.4 : pose.aim;
  const len = pose.gun === 'none' ? 7 : 8;
  const hx = bx + Math.cos(aim) * len;
  const hy = shoulderY + Math.sin(aim) * len;

  // Rear arm stays tucked; front arm holds the weapon.
  limb(ctx, bx - 1, shoulderY + 1, bx - 3, shoulderY + 6, 3, skin.clothDark);
  limb(ctx, bx + halfW - 2, shoulderY, hx, hy, 3, skin.cloth);
  px(ctx, Math.round(hx) - 1, Math.round(hy) - 1, 3, 3, skin.skin);

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
  const len = gun === 'heavy' ? 11 : gun === 'rifle' ? 9 : 6;
  const th = gun === 'heavy' ? 4 : gun === 'rifle' ? 3 : 2;
  const tipX = hx + Math.cos(aim) * len;
  const tipY = hy + Math.sin(aim) * len;
  limb(ctx, hx, hy, tipX, tipY, th, PAL.steelDark);
  limb(ctx, hx, hy, hx + Math.cos(aim) * (len * 0.55), hy + Math.sin(aim) * (len * 0.55), Math.max(1, th - 1), PAL.steel);
  if (gun === 'heavy') {
    px(ctx, Math.round(hx) - 1, Math.round(hy) + 2, 4, 3, PAL.steelDark);
  }
}

function drawKnife(ctx: CanvasRenderingContext2D, hx: number, hy: number, aim: number): void {
  const tipX = hx + Math.cos(aim) * 9;
  const tipY = hy + Math.sin(aim) * 9;
  limb(ctx, hx, hy, tipX, tipY, 2, PAL.steelLight);
  px(ctx, Math.round(hx) - 1, Math.round(hy) - 1, 3, 3, PAL.rust);
}

function drawSlumped(
  ctx: CanvasRenderingContext2D,
  bx: number, by: number, skin: ActorSkin, g: number,
): void {
  // A simple knocked-back pose used for the death animation.
  const halfW = Math.round(3 * g);
  px(ctx, bx - halfW - 1, by - 11, halfW * 2 + 3, 10, skin.outline);
  px(ctx, bx - halfW, by - 10, halfW * 2 + 1, 8, skin.cloth);
  limb(ctx, bx, by - 8, bx - 8, by - 14, 3, skin.skin);
  limb(ctx, bx, by - 8, bx + 7, by - 13, 3, skin.skin);
  limb(ctx, bx - 1, by - 3, bx - 7, by - 1, 3, skin.clothDark);
  limb(ctx, bx + 1, by - 3, bx + 6, by - 2, 3, skin.cloth);
  px(ctx, bx - 2, by - 17, 8, 7, skin.outline);
  px(ctx, bx - 1, by - 16, 6, 5, skin.skin);
  px(ctx, bx - 2, by - 17, 8, 3, skin.hat);
  disc(ctx, bx + 3, by - 15, 1, PAL.outline);
}
