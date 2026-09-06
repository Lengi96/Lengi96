import { Enemy, EnemyShot, ENEMY_GRAVITY } from './base';
import { moveBody } from '../level';
import type { World } from '../world';
import { drawActor, REBEL_SKIN, type ActorPose } from '../../render/actor';
import { rng } from '../../core/rng';
import { sfx } from '../../core/audio';

type SoldierState = 'advance' | 'aim' | 'fire' | 'throw' | 'back';

/**
 * The rank-and-file rebel: closes the distance, stops at rifle range and
 * fires, and switches to thrown knives when the player gets right on top of
 * it. Dies to a single hit from almost anything, exactly as it should.
 */
export class RebelSoldier extends Enemy {
  private state: SoldierState = 'advance';
  private timer = 0;
  private legPhase = 0;
  private aimAngle = 0;

  constructor(x: number, y: number, facing: -1 | 1 = -1) {
    super(x, y, 3);
    this.w = 12;
    this.h = 22;
    this.facing = facing;
    this.score = 200;
    this.timer = rng.int(10, 40);
  }

  protected think(world: World): void {
    const p = world.player;
    const dx = p.x - this.x;
    const dist = Math.abs(dx);

    if (this.state !== 'back') this.faceTowardPlayer(world);
    if (this.timer > 0) this.timer--;

    switch (this.state) {
      case 'advance':
        this.vx = this.facing * 0.72;
        if (dist < 26) this.enter('throw', 16);
        else if (dist < 96 && this.sees(world)) this.enter('aim', 16);
        break;

      case 'aim':
        this.vx = 0;
        this.aimAngle = Math.atan2(p.cy - (this.y - 15), Math.abs(dx) || 1);
        if (this.timer === 0) this.enter('fire', 8);
        break;

      case 'fire': {
        this.vx = 0;
        if (this.timer === 7) this.shoot(world);
        if (this.timer === 0) {
          // Back off a little after firing so fights keep moving.
          this.enter(dist < 40 ? 'back' : 'advance', 30);
        }
        break;
      }

      case 'throw':
        this.vx = 0;
        if (this.timer === 8) this.throwKnife(world);
        if (this.timer === 0) this.enter('back', 26);
        break;

      case 'back':
        this.vx = -this.facing * 0.9;
        if (this.timer === 0) this.enter('advance', 0);
        break;
    }

    this.vy = Math.min(this.vy + ENEMY_GRAVITY, 7);
    const res = moveBody(this, world.level);
    if (res.hitWallX && this.onGround) this.vy = -3.4;

    if (Math.abs(this.vx) > 0.05 && this.onGround) {
      this.legPhase = (this.legPhase + 0.09) % 1;
    }
  }

  private enter(state: SoldierState, timer: number): void {
    this.state = state;
    this.timer = timer;
  }

  private shoot(world: World): void {
    const speed = 3.1;
    const a = this.aimAngle;
    world.enemyShots.push(
      new EnemyShot(
        this.x + this.facing * 9,
        this.y - 14,
        Math.cos(a) * speed * this.facing,
        Math.sin(a) * speed,
        'bullet',
      ),
    );
    sfx.burst({ dur: 0.05, peak: 0.15, freq: 1500, freqTo: 600 });
  }

  private throwKnife(world: World): void {
    world.enemyShots.push(
      new EnemyShot(this.x + this.facing * 8, this.y - 15, this.facing * 2.4, -1.4, 'knife', 120, 0.09),
    );
    sfx.burst({ dur: 0.05, peak: 0.14, freq: 4200, freqTo: 2000, q: 3 });
  }

  private get pose(): ActorPose {
    return {
      facing: this.facing,
      aim: this.state === 'aim' || this.state === 'fire' ? this.aimAngle : 0,
      legPhase: this.legPhase,
      moving: Math.abs(this.vx) > 0.05 && this.onGround,
      crouch: false,
      airborne: !this.onGround && !this.dying,
      melee: this.state === 'throw' ? 0.6 : 0,
      gun: 'rifle',
      falling: this.dying,
    };
  }

  protected paint(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    drawActor(ctx, x, y, REBEL_SKIN, this.pose);
  }
}
