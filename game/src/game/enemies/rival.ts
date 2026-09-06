import { Enemy, EnemyShot, ENEMY_GRAVITY } from './base';
import { moveBody } from '../level';
import type { World } from '../world';
import { drawActor, type ActorSkin } from '../../render/actor';
import { PAL } from '../../render/palette';
import { px } from '../../render/art';
import { drawText } from '../../render/text';
import { sfx } from '../../core/audio';
import { rng } from '../../core/rng';

const RIVAL_SKIN: ActorSkin = {
  cloth: '#6c6f4a',
  clothDark: '#41432c',
  clothLight: '#9a9d6b',
  skin: PAL.skin,
  skinDark: PAL.skinDark,
  hat: '#b03028',
  hatDark: '#6d1c17',
  boot: PAL.black,
  outline: PAL.outline,
};

type RivalState = 'walk' | 'burst' | 'leap' | 'lob' | 'taunt';

/**
 * "Sergeant Ashfall" - the recurring heavy who blocks the halfway point.
 * He is not a boss: no health bar, no arena, just a soldier who takes a lot
 * of hits and fights back properly.
 */
export class Rival extends Enemy {
  private state: RivalState = 'taunt';
  private timer = 40;
  private legPhase = 0;
  private shotsLeft = 0;
  private aimAngle = 0;

  constructor(x: number, y: number, facing: -1 | 1 = -1) {
    super(x, y, 46);
    this.w = 14;
    this.h = 24;
    this.facing = facing;
    this.score = 5000;
  }

  protected override get deathTicks(): number {
    return 70;
  }

  protected override die(world: World): void {
    super.die(world);
    // A heavier death: several blasts instead of one.
    world.camera.shake(3, 20);
    for (let i = 0; i < 4; i++) {
      world.fx.explosion(this.x + rng.range(-10, 10), this.y - rng.range(4, 22), 12);
    }
  }

  protected think(world: World): void {
    const p = world.player;
    const dist = Math.abs(p.x - this.x);
    if (this.state !== 'leap') this.faceTowardPlayer(world);
    if (this.timer > 0) this.timer--;

    switch (this.state) {
      case 'taunt':
        this.vx = 0;
        if (this.timer === 0) this.enter('walk', 50);
        break;

      case 'walk':
        this.vx = this.facing * (dist > 110 ? 1.25 : 0.8);
        if (dist < 34 && this.onGround) this.enter('leap', 0);
        else if (this.timer === 0) {
          this.enter(rng.chance(0.35) ? 'lob' : 'burst', 20);
          this.shotsLeft = 5;
        }
        break;

      case 'burst': {
        this.vx = 0;
        this.aimAngle = Math.atan2(p.cy - (this.y - 16), Math.max(8, dist));
        if (this.timer % 5 === 0 && this.shotsLeft > 0) {
          this.shotsLeft--;
          this.fire(world);
        }
        if (this.timer === 0) this.enter('walk', 46);
        break;
      }

      case 'lob':
        this.vx = 0;
        if (this.timer === 12) this.lobGrenade(world);
        if (this.timer === 0) this.enter('walk', 40);
        break;

      case 'leap':
        if (this.onGround && this.vy >= 0 && this.timer === 0) {
          // Backflip away from the player, firing on the way over.
          this.vy = -5.2;
          this.vx = -this.facing * 2.4;
          this.timer = 40;
          sfx.tone(300, 0.1, 'square', 0.16, 160);
        } else if (this.onGround && this.timer > 0 && this.timer < 34) {
          this.enter('walk', 30);
        }
        break;
    }

    this.vy = Math.min(this.vy + ENEMY_GRAVITY, 7);
    const res = moveBody(this, world.level);
    // Hop the low walls rather than grinding against them.
    if (res.hitWallX && this.onGround) this.vy = -4.2;
    if (Math.abs(this.vx) > 0.05 && this.onGround) {
      this.legPhase = (this.legPhase + 0.12) % 1;
    }
  }

  private enter(state: RivalState, timer: number): void {
    this.state = state;
    this.timer = timer;
  }

  private fire(world: World): void {
    const speed = 3.6;
    const a = this.aimAngle;
    world.enemyShots.push(
      new EnemyShot(this.x + this.facing * 11, this.y - 16, Math.cos(a) * speed * this.facing, Math.sin(a) * speed),
    );
    world.fx.spark(this.x + this.facing * 12, this.y - 16, 2, PAL.fire);
    sfx.burst({ dur: 0.04, peak: 0.16, freq: 1800, freqTo: 700 });
  }

  private lobGrenade(world: World): void {
    world.enemyShots.push(
      new EnemyShot(this.x + this.facing * 8, this.y - 18, this.facing * 2.6, -4.2, 'shell', 300, 0.19),
    );
    sfx.tone(240, 0.06, 'square', 0.16, 400);
  }

  protected paint(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    drawActor(ctx, x, y, RIVAL_SKIN, {
      facing: this.facing,
      aim: this.state === 'burst' ? this.aimAngle : 0,
      legPhase: this.legPhase,
      moving: Math.abs(this.vx) > 0.05 && this.onGround,
      crouch: false,
      airborne: !this.onGround && !this.dying,
      melee: 0,
      gun: 'heavy',
      girth: 1.25,
      falling: this.dying,
    });

    if (this.dying) return;

    // A compact damage pip strip above him instead of a full boss bar.
    const bx = Math.round(x);
    const top = Math.round(y - this.h - 8);
    const width = 22;
    px(ctx, bx - width / 2 - 1, top - 1, width + 2, 4, PAL.black);
    px(ctx, bx - width / 2, top, Math.max(0, Math.round((this.hp / this.maxHp) * width)), 2, PAL.danger);
    if (this.state === 'taunt') {
      drawText(ctx, 'ASHFALL', bx, top - 10, { color: PAL.hud, align: 'center', shadow: PAL.black });
    }
  }
}
