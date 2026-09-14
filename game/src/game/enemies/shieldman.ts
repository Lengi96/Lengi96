import { Enemy, ENEMY_GRAVITY } from './base';
import { moveBody } from '../level';
import type { World } from '../world';
import { drawActor, REBEL_SKIN } from '../../render/actor';
import { PAL } from '../../render/palette';
import { px } from '../../render/art';

/**
 * A rebel behind a riot shield. Frontal fire is deflected, so the player has
 * to flank it, hop over it, or answer with a grenade or a blast weapon -
 * the classic reason to keep grenades in reserve.
 */
export class ShieldMan extends Enemy {
  private legPhase = 0;
  private bashTimer = 0;

  constructor(x: number, y: number, facing: -1 | 1 = -1) {
    super(x, y, 8);
    this.w = 14;
    this.h = 22;
    this.facing = facing;
    this.armoured = true;
    this.score = 500;
  }

  protected think(world: World): void {
    this.faceTowardPlayer(world);
    const dx = world.player.x - this.x;

    if (this.bashTimer > 0) {
      this.bashTimer--;
      this.vx = this.facing * 2.1;
    } else {
      this.vx = this.facing * 0.5;
      if (Math.abs(dx) < 30 && this.sees(world, 120)) this.bashTimer = 24;
    }

    this.vy = Math.min(this.vy + ENEMY_GRAVITY, 7);
    moveBody(this, world.level);
    if (Math.abs(this.vx) > 0.05 && this.onGround) {
      this.legPhase = (this.legPhase + 0.07) % 1;
    }
  }

  protected paint(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    drawActor(ctx, x, y, REBEL_SKIN, {
      facing: this.facing,
      aim: 0,
      legPhase: this.legPhase,
      moving: Math.abs(this.vx) > 0.05 && this.onGround,
      crouch: false,
      airborne: !this.onGround && !this.dying,
      melee: 0,
      gun: 'none',
      falling: this.dying,
    });

    if (this.dying) return;

    // The shield is drawn last so it always reads as being in front.
    const sx = Math.round(x + this.facing * 6);
    const top = Math.round(y - 21);
    px(ctx, sx - 3, top, 6, 21, PAL.outline);
    px(ctx, sx - 2, top + 1, 4, 19, PAL.steel);
    px(ctx, sx - 2, top + 1, 2, 19, PAL.steelLight);
    px(ctx, sx - 2, top + 8, 4, 2, PAL.steelDark);
    px(ctx, sx - 1, top + 4, 2, 3, PAL.black);
  }
}
