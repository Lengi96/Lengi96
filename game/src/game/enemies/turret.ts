import { Enemy, EnemyShot } from './base';
import type { World } from '../world';
import { PAL } from '../../render/palette';
import { px, limb, disc } from '../../render/art';
import { sfx } from '../../core/audio';
import { rng } from '../../core/rng';

const BURST_SIZE = 3;
const BURST_GAP = 9;
const RELOAD = 78;

/**
 * A wall-mounted gun that tracks the player and answers with short bursts.
 * It cannot be walked into, so it is purely a shooting problem.
 */
export class Turret extends Enemy {
  private angle = Math.PI;
  private timer: number;
  private burst = 0;

  constructor(x: number, y: number, facing: -1 | 1 = -1) {
    super(x, y, 10);
    this.w = 18;
    this.h = 16;
    this.facing = facing;
    this.score = 700;
    this.contactKills = false;
    this.timer = rng.int(20, RELOAD);
  }

  protected think(world: World): void {
    const p = world.player;
    if (!this.sees(world, 230)) return;

    const tx = p.cx - this.x;
    const ty = p.cy - (this.y - 10);
    const want = Math.atan2(ty, tx);
    // Ease the barrel toward the target so it can be out-run.
    let delta = want - this.angle;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;
    this.angle += Math.max(-0.05, Math.min(0.05, delta));

    if (this.burst > 0) {
      if (--this.timer <= 0) {
        this.fire(world);
        this.burst--;
        this.timer = this.burst > 0 ? BURST_GAP : RELOAD;
      }
      return;
    }
    if (--this.timer <= 0) {
      this.burst = BURST_SIZE;
      this.timer = 0;
    }
  }

  private fire(world: World): void {
    const speed = 3.4;
    const ox = Math.cos(this.angle) * 13;
    const oy = Math.sin(this.angle) * 13;
    world.enemyShots.push(
      new EnemyShot(this.x + ox, this.y - 10 + oy, Math.cos(this.angle) * speed, Math.sin(this.angle) * speed),
    );
    world.fx.spark(this.x + ox, this.y - 10 + oy, 2, PAL.fire);
    sfx.burst({ dur: 0.05, peak: 0.16, freq: 1700, freqTo: 650 });
  }

  protected paint(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    const bx = Math.round(x);
    const by = Math.round(y);
    px(ctx, bx - 9, by - 8, 18, 8, PAL.steelDark);
    px(ctx, bx - 8, by - 7, 16, 3, PAL.steel);
    px(ctx, bx - 9, by - 1, 18, 2, PAL.black);
    const px0 = bx;
    const py0 = by - 10;
    limb(ctx, px0, py0, px0 + Math.cos(this.angle) * 14, py0 + Math.sin(this.angle) * 14, 4, PAL.steelDark);
    limb(ctx, px0, py0, px0 + Math.cos(this.angle) * 10, py0 + Math.sin(this.angle) * 10, 2, PAL.steelLight);
    disc(ctx, px0, py0, 5, PAL.rust);
    disc(ctx, px0, py0, 3, PAL.steel);
    px(ctx, px0 - 1, py0 - 1, 2, 2, PAL.danger);
  }
}
