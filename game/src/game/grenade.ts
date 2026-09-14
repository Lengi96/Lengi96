import { Entity } from './entity';
import type { World } from './world';
import type { Camera } from '../render/camera';
import { PAL } from '../render/palette';
import { px, disc } from '../render/art';
import { overlaps } from './geom';

const GRAVITY = 0.28;

/**
 * The hand grenade: a lobbed arc that detonates on contact with an enemy or
 * the ground. It is a separate button from the weapon on purpose, exactly as
 * on the cabinet, so the player always has an answer to armoured targets.
 */
export class Grenade extends Entity {
  private spin = 0;
  private ttl = 240;
  readonly damage: number;
  readonly blast: number;

  constructor(x: number, y: number, dir: -1 | 1, aimUp: boolean, damage = 10, blast = 26) {
    super();
    this.x = x;
    this.y = y;
    this.w = 6;
    this.h = 6;
    this.depth = 45;
    this.damage = damage;
    this.blast = blast;
    this.vx = aimUp ? dir * 1.1 : dir * 2.9;
    this.vy = aimUp ? -5.4 : -3.2;
  }

  override update(world: World): void {
    this.vy += GRAVITY;
    this.x += this.vx;
    this.y += this.vy;
    this.spin += 0.35;

    if (--this.ttl <= 0) {
      this.detonate(world);
      return;
    }

    if (this.y > 400 || this.x < world.camera.x - 40 || this.x > world.camera.x + 360) {
      this.dead = true;
      return;
    }

    const ground = world.level.groundBelow(this.x, this.y - 3);
    if (ground !== Infinity && this.y >= ground) {
      this.y = ground;
      this.detonate(world);
      return;
    }

    if (world.level.isSolidAt(this.x + Math.sign(this.vx) * 3, this.y - 3)) {
      this.detonate(world);
      return;
    }

    const box = this.box;
    for (const e of world.enemyTargets()) {
      if (!e.dead && overlaps(box, e.box)) {
        this.detonate(world);
        return;
      }
    }
  }

  private detonate(world: World): void {
    if (this.dead) return;
    this.dead = true;
    world.explode(this.x, this.y - 3, this.blast, this.damage, 'player');
  }

  override draw(ctx: CanvasRenderingContext2D, cam: Camera): void {
    const x = Math.round(this.x - cam.ox);
    const y = Math.round(this.y - cam.oy - 3);
    disc(ctx, x, y, 3, PAL.heroDark);
    disc(ctx, x, y, 2, PAL.hero);
    // A little spinning highlight so the arc reads clearly in motion.
    const hx = Math.round(Math.cos(this.spin) * 2);
    const hy = Math.round(Math.sin(this.spin) * 2);
    px(ctx, x + hx, y + hy, 1, 1, PAL.heroLight);
    px(ctx, x - 1, y - 4, 2, 2, PAL.steel);
  }
}
