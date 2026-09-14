import { Entity, type Damageable } from './entity';
import { moveBody, type Body } from './level';
import { overlaps } from './geom';
import type { World } from './world';
import type { Camera } from '../render/camera';
import { drawActor, POW_SKIN } from '../render/actor';
import { PAL } from '../render/palette';
import { px, disc } from '../render/art';
import { drawText } from '../render/text';
import { sfx } from '../core/audio';
import { Pickup } from './items';
import type { WeaponId } from './weapons';

/** The rescue chain: each prisoner freed in a row is worth more than the last. */
export const RESCUE_CHAIN = [100, 200, 400, 800, 1600, 3200, 6400, 10000] as const;

export function rescueValue(chainIndex: number): number {
  return RESCUE_CHAIN[Math.min(chainIndex, RESCUE_CHAIN.length - 1)];
}

type PowState = 'bound' | 'salute' | 'flee' | 'gone';

/**
 * A prisoner of war. Cut the ropes with the knife or shoot them off, and the
 * prisoner salutes, hands over supplies and runs for the rear. Rescues pay
 * out again as a lump sum when the mission ends.
 */
export class Pow extends Entity implements Body, Damageable {
  onGround = false;
  facing: -1 | 1 = 1;
  private state: PowState = 'bound';
  private timer = 0;
  private legPhase = 0;
  /** Weapon handed over on rescue, if any. */
  readonly gift: WeaponId | 'grenade' | null;

  constructor(x: number, y: number, gift: WeaponId | 'grenade' | null = null) {
    super();
    this.x = x;
    this.y = y;
    this.w = 10;
    this.h = 22;
    this.depth = 48;
    this.gift = gift;
  }

  get rescued(): boolean {
    return this.state !== 'bound';
  }

  /** Any player damage cuts the ropes; the prisoner is never hurt by it. */
  hurt(_amount: number, world: World, _fromX: number): void {
    this.rescue(world);
  }

  rescue(world: World): void {
    if (this.state !== 'bound') return;
    this.state = 'salute';
    this.timer = 50;
    this.facing = world.player.x < this.x ? -1 : 1;
    world.onPowRescued(this);
    sfx.rescue();

    if (this.gift) {
      world.items.push(new Pickup(this.x, this.y - 6, this.gift));
    }
  }

  override update(world: World): void {
    switch (this.state) {
      case 'bound':
        // A knife swing or any shot frees them; walking into them does too.
        if (overlaps(this.box, world.player.box) && world.player.alive) {
          this.rescue(world);
        }
        break;
      case 'salute':
        this.vx = 0;
        if (--this.timer <= 0) {
          this.state = 'flee';
          this.facing = -1;
        }
        break;
      case 'flee':
        this.vx = -1.9;
        this.legPhase = (this.legPhase + 0.14) % 1;
        if (this.x < world.camera.x - 24) {
          this.state = 'gone';
          this.dead = true;
        }
        break;
      case 'gone':
        this.dead = true;
        break;
    }

    this.vy = Math.min(this.vy + 0.3, 7);
    moveBody(this, world.level);
  }

  override draw(ctx: CanvasRenderingContext2D, cam: Camera): void {
    const x = this.x - cam.ox;
    const y = this.y - cam.oy;
    disc(ctx, x, y + 1, 5, 'rgba(0,0,0,0.25)');

    drawActor(ctx, x, y, POW_SKIN, {
      facing: this.facing,
      aim: 0,
      legPhase: this.legPhase,
      moving: this.state === 'flee',
      crouch: false,
      airborne: !this.onGround,
      melee: 0,
      gun: 'none',
      bound: this.state === 'bound',
    });

    if (this.state === 'bound') {
      // A stake and rope so a bound prisoner reads at a glance.
      px(ctx, Math.round(x) - 1, Math.round(y) - 30, 2, 12, PAL.brickDark);
      px(ctx, Math.round(x) - 4, Math.round(y) - 30, 8, 2, PAL.bone);
      if (Math.floor(cam.x / 8) % 2 === 0) {
        drawText(ctx, 'HELP', x, y - 40, { color: PAL.white, align: 'center', shadow: PAL.black });
      }
    } else if (this.state === 'salute') {
      drawText(ctx, 'THANKS', x, y - 34, { color: PAL.hud, align: 'center', shadow: PAL.black });
    }
  }
}
