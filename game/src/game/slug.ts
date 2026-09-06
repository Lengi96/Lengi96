import { Entity, type Damageable } from './entity';
import { moveBody, type Body } from './level';
import { overlaps, clamp } from './geom';
import type { World } from './world';
import type { Camera } from '../render/camera';
import { PAL } from '../render/palette';
import { px, limb, disc, drawTinted } from '../render/art';
import { input } from '../core/input';
import { sfx } from '../core/audio';
import { WEAPONS, aimVector, fireWeapon } from './weapons';
import { EnemyShot } from './enemies/base';

const ARMOUR = 3;
const VULCAN_COOLDOWN = 4;
const CANNON_COOLDOWN = 26;
const JET_THRUST = -4.4;
const GRAVITY = 0.3;
const DRIVE_SPEED = 1.9;
/** Two jump presses inside this window eject the driver. */
const EJECT_WINDOW = 14;

const VULCAN = { ...WEAPONS.hmg, id: 'hmg' as const, damage: 2, speed: 8, maxLive: 24, cooldown: VULCAN_COOLDOWN };
const CANNON = { ...WEAPONS.rocket, id: 'rocket' as const, damage: 16, blast: 30, speed: 5.2, maxLive: 3 };

/**
 * The SV-class assault tank: the series' signature ride. Three hits of
 * armour, a vulcan on the fire button, a cannon on the grenade button and
 * jump jets. Bailing out sends the empty hull forward as a bomb.
 */
export class Slug extends Entity implements Body, Damageable {
  onGround = false;
  facing: -1 | 1 = 1;
  armour = ARMOUR;
  /** Set while the player is aboard. */
  occupied = false;
  /** Set once the driver has bailed out: the hull drives off and detonates. */
  private ramming = false;
  private ramTicks = 0;

  private vulcanAngle = 0;
  private vulcanCd = 0;
  private cannonCd = 0;
  private jumpTaps = 0;
  private tapTimer = 0;
  private tread = 0;
  private flash = 0;
  private jetTicks = 0;

  constructor(x: number, y: number) {
    super();
    this.x = x;
    this.y = y;
    this.w = 30;
    this.h = 20;
    this.depth = 55;
  }

  get armoured(): boolean {
    return false;
  }

  /** The driver's own shots pass straight through the hull. */
  get friendly(): boolean {
    return true;
  }

  hurt(amount: number, world: World, _fromX: number): void {
    if (this.ramming || this.dead) return;
    this.flash = 5;
    // Armour is measured in hits, not points, so one shell is one plate.
    this.armour -= amount >= 6 ? 2 : 1;
    world.fx.spark(this.cx, this.cy, 5, PAL.steelLight);
    sfx.hit();
    if (this.armour <= 0) this.destroy(world);
  }

  private destroy(world: World): void {
    if (this.dead) return;
    this.dead = true;
    world.fx.explosion(this.cx, this.cy, 30);
    world.camera.shake(4, 22);
    sfx.explosion(true);
    if (this.occupied) {
      // Losing the tank does not kill the driver; they are thrown clear.
      this.occupied = false;
      const p = world.player;
      p.ridingSlug = false;
      p.x = this.x;
      p.y = this.y - 4;
      p.vy = -3.4;
      p.iframes = 90;
    }
    world.explode(this.cx, this.cy, 30, 12, 'player');
  }

  override update(world: World): void {
    if (this.flash > 0) this.flash--;
    if (this.vulcanCd > 0) this.vulcanCd--;
    if (this.cannonCd > 0) this.cannonCd--;
    if (this.tapTimer > 0) this.tapTimer--;
    else this.jumpTaps = 0;
    if (this.jetTicks > 0) this.jetTicks--;

    if (this.ramming) {
      this.updateRamming(world);
      return;
    }

    if (!this.occupied) {
      this.updateIdle(world);
      return;
    }

    this.drive(world);
  }

  private updateIdle(world: World): void {
    this.vx = 0;
    this.vy = Math.min(this.vy + GRAVITY, 7);
    moveBody(this, world.level);
    const p = world.player;
    if (p.alive && !p.ridingSlug && overlaps(this.box, p.box)) {
      this.mount(world);
    }
  }

  private mount(world: World): void {
    this.occupied = true;
    world.player.ridingSlug = true;
    this.facing = world.player.facing;
    sfx.tone(180, 0.14, 'square', 0.24, 420);
    world.fx.popup(this.x, this.y - 30, 'SLUG!', PAL.hud);
  }

  private drive(world: World): void {
    const p = world.player;
    // Keep the player's logical position glued to the hull.
    p.x = this.x;
    p.y = this.y - 2;

    const ax = input.ax;
    if (ax !== 0) {
      this.facing = ax;
      p.facing = ax;
    }
    this.vx = ax * DRIVE_SPEED;

    if (input.pressed('jump')) {
      this.jumpTaps++;
      this.tapTimer = EJECT_WINDOW;
      if (this.jumpTaps >= 2) {
        this.eject(world);
        return;
      }
      if (this.onGround) {
        this.vy = JET_THRUST;
        this.jetTicks = 12;
        sfx.tone(260, 0.12, 'sawtooth', 0.2, 120);
      }
    }

    this.vy = Math.min(this.vy + GRAVITY, 7);
    moveBody(this, world.level);
    this.x = clamp(this.x, world.camera.x + 16, world.camera.x + 320 - 16);
    if (Math.abs(this.vx) > 0.05) this.tread += this.vx;

    // The vulcan aims all the way round; the cannon fires straight ahead.
    const aim = aimVector(input.ax, input.ay, this.facing);
    this.vulcanAngle = Math.atan2(aim.y, aim.x);

    if (input.down('shoot') && this.vulcanCd === 0 && world.playerShots.length < VULCAN.maxLive) {
      this.vulcanCd = VULCAN_COOLDOWN;
      const mx = this.x + Math.cos(this.vulcanAngle) * 18;
      const my = this.y - 14 + Math.sin(this.vulcanAngle) * 18;
      world.playerShots.push(...fireWeapon(VULCAN, mx, my, aim.x, aim.y));
      world.fx.spark(mx, my, 2, PAL.fire);
      sfx.machineGun();
    }

    if (input.pressed('grenade') && this.cannonCd === 0) {
      this.cannonCd = CANNON_COOLDOWN;
      const mx = this.x + this.facing * 20;
      const my = this.y - 15;
      world.playerShots.push(...fireWeapon(CANNON, mx, my, this.facing, -0.06));
      world.fx.smoke(mx, my, 4);
      world.camera.shake(2, 8);
      sfx.rocket();
    }

    if (!world.player.alive) this.eject(world);
  }

  private eject(world: World): void {
    if (!this.occupied) return;
    this.occupied = false;
    const p = world.player;
    p.ridingSlug = false;
    p.x = this.x - this.facing * 10;
    p.y = this.y - 6;
    p.vy = -4.2;
    p.iframes = Math.max(p.iframes, 60);
    this.ramming = true;
    this.ramTicks = 90;
    sfx.tone(520, 0.1, 'square', 0.22, 240);
    world.fx.popup(this.x, this.y - 30, 'BAIL OUT', PAL.danger);
  }

  private updateRamming(world: World): void {
    this.vx = this.facing * 3.4;
    this.vy = Math.min(this.vy + GRAVITY, 7);
    const res = moveBody(this, world.level);
    this.tread += this.vx;
    world.fx.smoke(this.x - this.facing * 14, this.y - 6, 1);

    let hit = res.hitWallX;
    for (const e of world.enemyTargets()) {
      if (!e.dead && overlaps(this.box, e.box)) hit = true;
    }
    if (hit || --this.ramTicks <= 0) {
      this.dead = true;
      world.explode(this.cx, this.cy, 36, 18, 'player');
      world.fx.explosion(this.cx, this.cy, 34);
      world.camera.shake(4, 24);
      sfx.explosion(true);
    }
  }

  override draw(ctx: CanvasRenderingContext2D, cam: Camera, world: World): void {
    const x = this.x - cam.ox;
    const y = this.y - cam.oy;
    disc(ctx, x, y + 1, 14, 'rgba(0,0,0,0.3)');

    if (this.flash > 0) {
      drawTinted(ctx, x - 24, y - 34, 48, 40, PAL.white, (c) => this.paint(c, x, y, world), 0.8);
      return;
    }
    this.paint(ctx, x, y, world);
  }

  private paint(ctx: CanvasRenderingContext2D, x: number, y: number, world: World): void {
    const bx = Math.round(x);
    const by = Math.round(y);

    // Jump-jet plume
    if (this.jetTicks > 0) {
      disc(ctx, bx - 8, by + 2, 3, PAL.fireMid);
      disc(ctx, bx + 8, by + 2, 3, PAL.fireMid);
      disc(ctx, bx - 8, by + 1, 2, PAL.fire);
      disc(ctx, bx + 8, by + 1, 2, PAL.fire);
    }

    // Treads
    px(ctx, bx - 16, by - 9, 32, 9, PAL.outline);
    px(ctx, bx - 15, by - 8, 30, 7, PAL.steelDark);
    for (let i = 0; i < 7; i++) {
      const tx = bx - 14 + ((i * 4 + Math.floor(this.tread) % 4) + 28) % 28;
      px(ctx, tx, by - 8, 2, 7, PAL.black);
    }
    disc(ctx, bx - 11, by - 5, 3, PAL.steel);
    disc(ctx, bx + 11, by - 5, 3, PAL.steel);

    // Hull
    px(ctx, bx - 14, by - 20, 28, 12, PAL.outline);
    px(ctx, bx - 13, by - 19, 26, 10, PAL.hero);
    px(ctx, bx - 13, by - 19, 26, 3, PAL.heroLight);
    px(ctx, bx - 13, by - 11, 26, 2, PAL.heroDark);
    px(ctx, bx + this.facing * 9 - 2, by - 17, 4, 4, PAL.steelDark);

    // Armour pips so the driver can see what is left
    for (let i = 0; i < ARMOUR; i++) {
      px(ctx, bx - 12 + i * 5, by - 23, 4, 2, i < this.armour ? PAL.hud : PAL.hudDim);
    }

    // Cannon, fixed forward
    limb(ctx, bx, by - 15, bx + this.facing * 21, by - 15, 5, PAL.steelDark);
    limb(ctx, bx, by - 15, bx + this.facing * 16, by - 15, 3, PAL.steel);

    // Vulcan turret, free-aiming
    const a = this.occupied ? this.vulcanAngle : (this.facing === 1 ? 0 : Math.PI);
    disc(ctx, bx, by - 22, 5, PAL.heroDark);
    disc(ctx, bx, by - 22, 3, PAL.hero);
    limb(ctx, bx, by - 22, bx + Math.cos(a) * 13, by - 22 + Math.sin(a) * 13, 3, PAL.steelDark);
    limb(ctx, bx, by - 22, bx + Math.cos(a) * 9, by - 22 + Math.sin(a) * 9, 1, PAL.steelLight);

    // Driver's head poking out of the hatch
    if (this.occupied && world.player.alive) {
      const hx = bx - this.facing * 3;
      px(ctx, hx - 3, by - 30, 7, 6, PAL.outline);
      px(ctx, hx - 2, by - 29, 5, 4, PAL.skin);
      px(ctx, hx - 3, by - 30, 7, 2, PAL.bandana);
      px(ctx, hx + this.facing, by - 27, 1, 1, PAL.outline);
    }
  }
}

/**
 * Enemy vehicles reuse the tank silhouette in rebel colours. Kept here so the
 * two share their proportions.
 */
export class RebelTank extends Entity implements Body, Damageable {
  onGround = false;
  facing: -1 | 1 = -1;
  hp = 26;
  private tread = 0;
  private cooldown = 60;
  private flash = 0;

  constructor(x: number, y: number) {
    super();
    this.x = x;
    this.y = y;
    this.w = 30;
    this.h = 20;
    this.depth = 52;
  }

  hurt(amount: number, world: World, _fromX: number): void {
    if (this.dead) return;
    this.hp -= amount;
    this.flash = 4;
    sfx.hit();
    if (this.hp <= 0) {
      this.dead = true;
      world.addScore(1500, this.cx, this.y - 30);
      world.fx.explosion(this.cx, this.cy, 26);
      world.camera.shake(3, 16);
      sfx.explosion(true);
    }
  }

  override update(world: World): void {
    if (this.flash > 0) this.flash--;
    const p = world.player;
    this.facing = p.x < this.x ? -1 : 1;
    const dist = Math.abs(p.x - this.x);
    this.vx = dist > 120 ? this.facing * 0.9 : dist < 70 ? -this.facing * 0.7 : 0;
    this.vy = Math.min(this.vy + GRAVITY, 7);
    moveBody(this, world.level);
    this.tread += this.vx;

    if (--this.cooldown <= 0 && dist < 240) {
      this.cooldown = 84;
      world.enemyShots.push(
        new EnemyShot(this.x + this.facing * 22, this.y - 15, this.facing * 4, -0.3, 'shell', 200, 0.05),
      );
      world.fx.smoke(this.x + this.facing * 22, this.y - 15, 3);
      world.camera.shake(1, 6);
      sfx.rocket();
    }

    if (overlaps(this.box, p.box)) p.kill(world);
  }

  override draw(ctx: CanvasRenderingContext2D, cam: Camera): void {
    const x = Math.round(this.x - cam.ox);
    const y = Math.round(this.y - cam.oy);
    disc(ctx, x, y + 1, 14, 'rgba(0,0,0,0.3)');
    const paint = (c: CanvasRenderingContext2D) => {
      px(c, x - 16, y - 9, 32, 9, PAL.outline);
      px(c, x - 15, y - 8, 30, 7, PAL.steelDark);
      for (let i = 0; i < 7; i++) {
        const tx = x - 14 + ((i * 4 + Math.floor(this.tread) % 4) + 28) % 28;
        px(c, tx, y - 8, 2, 7, PAL.black);
      }
      px(c, x - 14, y - 20, 28, 12, PAL.outline);
      px(c, x - 13, y - 19, 26, 10, PAL.foe);
      px(c, x - 13, y - 19, 26, 3, PAL.foeLight);
      px(c, x - 13, y - 11, 26, 2, PAL.foeDark);
      disc(c, x, y - 22, 5, PAL.foeDark);
      limb(c, x, y - 18, x + this.facing * 22, y - 15, 5, PAL.steelDark);
      limb(c, x, y - 18, x + this.facing * 17, y - 15, 3, PAL.steel);
    };
    if (this.flash > 0) drawTinted(ctx, x - 24, y - 30, 48, 34, PAL.white, paint);
    else paint(ctx);
  }
}
