import { Entity, type Damageable } from '../entity';
import type { Body } from '../level';
import { moveBody } from '../level';
import type { World } from '../world';
import type { Camera } from '../../render/camera';
import { PAL } from '../../render/palette';
import { px, disc, limb, drawTinted } from '../../render/art';
import { sfx } from '../../core/audio';
import { overlaps } from '../geom';

export const ENEMY_GRAVITY = 0.3;

/**
 * Shared behaviour for every hostile: hit points, the white damage flash, the
 * death payout and the "which gate am I holding shut" tag the level uses to
 * pace its fights.
 */
export abstract class Enemy extends Entity implements Damageable, Body {
  onGround = false;
  dropThrough = false;
  facing: -1 | 1 = -1;
  hp: number;
  readonly maxHp: number;
  score = 200;
  /** Gate this enemy belongs to; the camera stays put until the gate clears. */
  gate: number | undefined;
  /** Blocks shots from the front (shield carriers). */
  armoured = false;
  /** Touching this enemy kills the player. */
  contactKills = true;

  protected flash = 0;
  protected animTick = 0;
  /** Ticks of the death animation still to play before removal. */
  protected dyingTicks = 0;

  constructor(x: number, y: number, hp: number) {
    super();
    this.x = x;
    this.y = y;
    this.hp = hp;
    this.maxHp = hp;
    this.depth = 50;
  }

  get dying(): boolean {
    return this.dyingTicks > 0;
  }

  hurt(amount: number, world: World, fromX: number, ignoreArmour = false): void {
    if (this.dying || this.dead) return;
    // A shield only stops fire that comes at it head on.
    if (this.armoured && !ignoreArmour && Math.sign(fromX - this.x) === this.facing) {
      world.fx.spark(this.x + this.facing * 6, this.cy, 3, PAL.steelLight);
      sfx.hit();
      return;
    }
    this.hp -= amount;
    this.flash = 4;
    if (this.hp <= 0) this.die(world);
    else sfx.hit();
  }

  protected die(world: World): void {
    if (this.dying) return;
    this.dyingTicks = this.deathTicks;
    this.vy = -2.4;
    this.vx = this.facing * -0.6;
    world.addScore(this.score, this.cx, this.y - this.h - 4);
    world.fx.explosion(this.cx, this.cy, 12);
    sfx.explosion(false);
  }

  protected get deathTicks(): number {
    return 34;
  }

  /** Falls and fades once dead; shared by every ground enemy. */
  protected updateDying(world: World): void {
    this.dyingTicks--;
    this.vy = Math.min(this.vy + ENEMY_GRAVITY, 7);
    moveBody(this, world.level);
    if (this.onGround) this.vx *= 0.82;
    if (this.dyingTicks <= 0) this.dead = true;
  }

  /** True when the player is close enough on screen to be worth reacting to. */
  protected sees(world: World, range = 200): boolean {
    const p = world.player;
    if (!p.alive) return false;
    return Math.abs(p.x - this.x) < range && Math.abs(p.y - this.y) < 120;
  }

  protected faceTowardPlayer(world: World): void {
    const p = world.player;
    if (!p.alive) return;
    this.facing = p.x < this.x ? -1 : 1;
  }

  override update(world: World): void {
    this.animTick++;
    if (this.flash > 0) this.flash--;
    if (this.dying) {
      this.updateDying(world);
      return;
    }
    this.think(world);
    // An enemy holding a gate belongs to that fight: keep it inside the
    // pinned viewport so it can never wander somewhere unreachable and
    // deadlock the gate.
    if (this.gate !== undefined) {
      const left = world.camera.x + 10;
      const right = world.camera.x + 310;
      if (this.x < left) { this.x = left; if (this.vx < 0) this.vx = 0; }
      if (this.x > right) { this.x = right; if (this.vx > 0) this.vx = 0; }
    }
    if (this.contactKills && overlaps(this.box, world.player.box)) {
      world.player.kill(world);
    }
    // Anything that falls far below the stage is gone for good.
    if (this.y > 320) this.dead = true;
  }

  protected abstract think(world: World): void;

  protected abstract paint(ctx: CanvasRenderingContext2D, x: number, y: number, world: World): void;

  override draw(ctx: CanvasRenderingContext2D, cam: Camera, world: World): void {
    const x = this.x - cam.ox;
    const y = this.y - cam.oy;
    disc(ctx, x, y + 1, Math.max(3, this.w / 2), 'rgba(0,0,0,0.25)');
    this.paint(ctx, x, y, world);
    if (this.flash > 0) {
      drawTinted(ctx, x - this.w - 8, y - this.h - 12, this.w * 2 + 16, this.h + 20, PAL.white, (c) => {
        this.paint(c, x, y, world);
      }, 0.7);
    }
  }
}

/** Enemy fire. Anything in this list is lethal to the player on contact. */
export class EnemyShot extends Entity {
  private ttl: number;
  readonly style: 'bullet' | 'shell' | 'knife' | 'plasma';
  private gravity: number;
  private spin = 0;

  constructor(
    x: number, y: number, vx: number, vy: number,
    style: EnemyShot['style'] = 'bullet',
    ttl = 200,
    gravity = 0,
  ) {
    super();
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.style = style;
    this.ttl = ttl;
    this.gravity = gravity;
    this.w = style === 'shell' ? 7 : 5;
    this.h = this.w;
    this.depth = 44;
  }

  override update(world: World): void {
    this.vy += this.gravity;
    this.x += this.vx;
    this.y += this.vy;
    this.spin += 0.4;

    if (--this.ttl <= 0) {
      this.dead = true;
      return;
    }
    if (this.x < world.camera.x - 40 || this.x > world.camera.x + 360 || this.y > 320 || this.y < -120) {
      this.dead = true;
      return;
    }

    if (this.style === 'shell') {
      const ground = world.level.groundBelow(this.x, this.y - 3);
      if (ground !== Infinity && this.y >= ground) {
        this.dead = true;
        world.explode(this.x, ground - 4, 22, 1, 'enemy');
        return;
      }
    } else if (world.level.isSolidAt(this.x, this.y - 2)) {
      this.dead = true;
      world.fx.spark(this.x, this.y - 2, 3, PAL.steelLight);
      return;
    }

    if (overlaps(this.box, world.player.box)) {
      world.player.kill(world);
      this.dead = true;
    }
  }

  override draw(ctx: CanvasRenderingContext2D, cam: Camera): void {
    const x = Math.round(this.x - cam.ox);
    const y = Math.round(this.y - cam.oy);
    switch (this.style) {
      case 'bullet':
        px(ctx, x - 2, y - 3, 4, 3, PAL.danger);
        px(ctx, x - 1, y - 3, 2, 1, PAL.fire);
        break;
      case 'shell':
        disc(ctx, x, y - 3, 3, PAL.steelDark);
        px(ctx, x - 1, y - 7, 2, 3, PAL.danger);
        break;
      case 'knife': {
        const a = this.spin;
        limb(ctx, x - Math.cos(a) * 4, y - 3 - Math.sin(a) * 4, x + Math.cos(a) * 4, y - 3 + Math.sin(a) * 4, 2, PAL.steelLight);
        break;
      }
      case 'plasma':
        disc(ctx, x, y - 3, 3, PAL.plasma);
        disc(ctx, x, y - 3, 1, PAL.white);
        break;
    }
  }
}
