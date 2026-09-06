import { Entity, type Damageable } from './entity';
import type { World } from './world';
import type { Camera } from '../render/camera';
import type { PropDef } from './level';
import { PAL } from '../render/palette';
import { px, disc, limb, drawTinted } from '../render/art';
import { sfx } from '../core/audio';
import { Pickup, type PickupKind } from './items';

/**
 * Scenery. Props with hit points blow up and can hide a supply crate, which
 * rewards players who shoot everything that looks suspicious.
 */
export class Prop extends Entity implements Damageable {
  readonly kind: PropDef['kind'];
  hp: number;
  private drop: PickupKind | null;
  private flash = 0;
  readonly breakable: boolean;

  constructor(d: PropDef) {
    super();
    this.x = d.x;
    this.y = d.y;
    this.kind = d.kind;
    this.hp = d.hp ?? 0;
    this.breakable = (d.hp ?? 0) > 0;
    this.drop = (d.drop as PickupKind | undefined) ?? null;
    this.depth = this.kind === 'palm' || this.kind === 'lamp' ? 20 : 25;

    const size = SIZES[this.kind];
    this.w = size[0];
    this.h = size[1];
  }

  hurt(amount: number, world: World, _fromX: number): void {
    if (!this.breakable || this.dead) return;
    this.hp -= amount;
    this.flash = 3;
    if (this.hp > 0) {
      sfx.hit();
      return;
    }
    this.dead = true;
    world.addScore(50, this.cx, this.cy);
    if (this.kind === 'barrel') {
      // Barrels cook off and hurt whatever is standing next to them.
      world.explode(this.cx, this.cy, 26, 6, 'player');
      world.camera.shake(2, 10);
      sfx.explosion(true);
    } else {
      world.fx.explosion(this.cx, this.cy, 12);
      world.fx.debris(this.cx, this.cy, 8, PAL.rust);
      sfx.explosion(false);
    }
    if (this.drop) world.items.push(new Pickup(this.x, this.y - this.h, this.drop));
  }

  override update(world: World): void {
    if (this.flash > 0) this.flash--;
    if (this.x < world.camera.x - 80) this.dead = true;
  }

  override draw(ctx: CanvasRenderingContext2D, cam: Camera): void {
    const x = Math.round(this.x - cam.ox);
    const y = Math.round(this.y - cam.oy);
    const paint = (c: CanvasRenderingContext2D) => PAINTERS[this.kind](c, x, y);
    if (this.flash > 0) {
      drawTinted(ctx, x - this.w, y - this.h - 24, this.w * 2, this.h + 28, PAL.white, paint);
      return;
    }
    paint(ctx);
  }
}

const SIZES: Record<PropDef['kind'], [number, number]> = {
  barrel: [12, 16],
  crate: [16, 16],
  sandbag: [26, 10],
  palm: [10, 44],
  lamp: [6, 34],
  sign: [18, 26],
  wreck: [30, 16],
};

type Painter = (ctx: CanvasRenderingContext2D, x: number, y: number) => void;

const PAINTERS: Record<PropDef['kind'], Painter> = {
  barrel(ctx, x, y) {
    px(ctx, x - 6, y - 16, 12, 16, PAL.outline);
    px(ctx, x - 5, y - 15, 10, 14, PAL.danger);
    px(ctx, x - 5, y - 15, 3, 14, '#f06a5c');
    px(ctx, x - 5, y - 11, 10, 2, PAL.black);
    px(ctx, x - 5, y - 5, 10, 2, PAL.black);
    px(ctx, x - 2, y - 13, 4, 3, PAL.bone);
  },
  crate(ctx, x, y) {
    px(ctx, x - 8, y - 16, 16, 16, PAL.outline);
    px(ctx, x - 7, y - 15, 14, 14, PAL.rust);
    px(ctx, x - 7, y - 15, 14, 2, PAL.sandDark);
    px(ctx, x - 7, y - 9, 14, 2, PAL.brickDark);
    limb(ctx, x - 7, y - 15, x + 6, y - 2, 1, PAL.brickDark);
  },
  sandbag(ctx, x, y) {
    for (let i = 0; i < 3; i++) {
      px(ctx, x - 13 + i * 9, y - 10, 10, 5, PAL.sandDark);
      px(ctx, x - 13 + i * 9, y - 10, 10, 2, PAL.sand);
    }
    for (let i = 0; i < 2; i++) {
      px(ctx, x - 9 + i * 9, y - 5, 10, 5, PAL.sandDark);
      px(ctx, x - 9 + i * 9, y - 5, 10, 2, PAL.sand);
    }
  },
  palm(ctx, x, y) {
    limb(ctx, x, y, x - 3, y - 34, 4, PAL.brickDark);
    limb(ctx, x - 3, y - 34, x - 4, y - 42, 3, PAL.brickDark);
    for (const [dx, dy] of [[-14, -6], [-10, -12], [12, -6], [9, -13], [0, -14]] as const) {
      limb(ctx, x - 4, y - 42, x - 4 + dx, y - 42 + dy, 3, PAL.heroDark);
      limb(ctx, x - 4, y - 42, x - 4 + dx * 0.6, y - 42 + dy * 0.6, 2, PAL.hero);
    }
    disc(ctx, x - 4, y - 42, 2, PAL.sandDark);
  },
  lamp(ctx, x, y) {
    limb(ctx, x, y, x, y - 30, 3, PAL.steelDark);
    limb(ctx, x, y - 30, x + 7, y - 33, 2, PAL.steelDark);
    px(ctx, x + 6, y - 33, 5, 4, PAL.steel);
    px(ctx, x + 7, y - 30, 3, 2, PAL.hud);
  },
  sign(ctx, x, y) {
    limb(ctx, x, y, x, y - 18, 3, PAL.brickDark);
    px(ctx, x - 9, y - 26, 18, 10, PAL.outline);
    px(ctx, x - 8, y - 25, 16, 8, PAL.sand);
    px(ctx, x - 6, y - 23, 12, 2, PAL.brickDark);
    px(ctx, x - 6, y - 20, 8, 2, PAL.brickDark);
  },
  wreck(ctx, x, y) {
    px(ctx, x - 15, y - 10, 30, 10, PAL.outline);
    px(ctx, x - 14, y - 9, 28, 8, PAL.steelDark);
    px(ctx, x - 10, y - 16, 16, 7, PAL.outline);
    px(ctx, x - 9, y - 15, 14, 5, PAL.rust);
    disc(ctx, x - 9, y - 2, 3, PAL.black);
    disc(ctx, x + 8, y - 2, 3, PAL.black);
    limb(ctx, x + 4, y - 14, x + 16, y - 20, 2, PAL.steelDark);
  },
};
