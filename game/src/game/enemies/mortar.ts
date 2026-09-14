import { Enemy, EnemyShot } from './base';
import type { World } from '../world';
import { PAL } from '../../render/palette';
import { px, limb, disc } from '../../render/art';
import { drawActor, REBEL_SKIN } from '../../render/actor';
import { sfx } from '../../core/audio';
import { rng } from '../../core/rng';

const RELOAD = 110;
/** Fixed launch speed; the firing angle is solved for the player's position. */
const MUZZLE_SPEED = 5.2;
const SHELL_GRAVITY = 0.16;

/**
 * A dug-in mortar crew. It never moves, but it drops shells onto wherever the
 * player is standing, which is what keeps the player advancing.
 */
export class MortarPit extends Enemy {
  private timer: number;
  private barrelAngle = -1.1;

  constructor(x: number, y: number, facing: -1 | 1 = -1) {
    super(x, y, 6);
    this.w = 22;
    this.h = 16;
    this.facing = facing;
    this.score = 800;
    this.contactKills = false;
    this.timer = rng.int(40, RELOAD);
  }

  protected think(world: World): void {
    if (!this.sees(world, 260)) return;
    this.faceTowardPlayer(world);
    if (--this.timer > 0) return;
    this.timer = RELOAD;
    this.fire(world);
  }

  private fire(world: World): void {
    const p = world.player;
    const dx = p.x - this.x;
    const dy = (p.y - 6) - (this.y - 12);
    const angle = solveLobAngle(dx, dy, MUZZLE_SPEED, SHELL_GRAVITY);
    this.barrelAngle = angle;
    world.enemyShots.push(
      new EnemyShot(
        this.x + Math.cos(angle) * 12,
        this.y - 12 + Math.sin(angle) * 12,
        Math.cos(angle) * MUZZLE_SPEED,
        Math.sin(angle) * MUZZLE_SPEED,
        'shell',
        400,
        SHELL_GRAVITY,
      ),
    );
    world.fx.smoke(this.x, this.y - 14, 4);
    sfx.burst({ kind: 'brown', filter: 'lowpass', dur: 0.16, peak: 0.3, freq: 900, freqTo: 200 });
  }

  protected paint(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    const bx = Math.round(x);
    const by = Math.round(y);

    // Sandbag emplacement
    for (let i = 0; i < 3; i++) {
      px(ctx, bx - 12 + i * 8, by - 5, 9, 5, PAL.sandDark);
      px(ctx, bx - 12 + i * 8, by - 5, 9, 2, PAL.sand);
    }
    px(ctx, bx - 13, by - 1, 27, 2, PAL.sandDeep);

    if (!this.dying) {
      // Crew member behind the tube
      drawActor(ctx, bx - this.facing * 9, by - 4, REBEL_SKIN, {
        facing: this.facing, aim: -0.9, legPhase: 0, moving: false,
        crouch: true, airborne: false, melee: 0, gun: 'none',
      });
    }

    // Mortar tube
    const ax = bx;
    const ay = by - 8;
    limb(ctx, ax, ay, ax + Math.cos(this.barrelAngle) * 14, ay + Math.sin(this.barrelAngle) * 14, 5, PAL.steelDark);
    limb(ctx, ax, ay, ax + Math.cos(this.barrelAngle) * 9, ay + Math.sin(this.barrelAngle) * 9, 3, PAL.steel);
    disc(ctx, ax, ay, 3, PAL.steelDark);
    px(ctx, bx - 5, by - 8, 10, 3, PAL.rust);
  }
}

/**
 * Firing solution for a lobbed shell: the flatter of the two arcs that reach
 * (dx, dy) at a fixed speed, falling back to a 45-degree shot when the target
 * is simply out of range.
 */
export function solveLobAngle(dx: number, dy: number, speed: number, gravity: number): number {
  const dir = Math.sign(dx) || 1;
  const x = Math.abs(dx);
  const v2 = speed * speed;
  // Screen-space y grows downwards, so the usual "height above" term is -dy.
  const root = v2 * v2 - gravity * (gravity * x * x - 2 * dy * v2);
  if (root < 0 || x < 1) {
    return dir > 0 ? -Math.PI / 4 : -Math.PI * 3 / 4;
  }
  const angle = Math.atan((v2 - Math.sqrt(root)) / (gravity * x));
  return dir > 0 ? -angle : Math.PI + angle;
}
