import { Entity } from './entity';
import { moveBody, type Body } from './level';
import { clamp, overlaps, rect } from './geom';
import { WEAPONS, aimVector, fireWeapon, consumeAmmo, type WeaponId } from './weapons';
import { Grenade } from './grenade';
import type { World } from './world';
import type { Camera } from '../render/camera';
import { drawActor, HERO_SKIN, type ActorPose, type GunKind } from '../render/actor';
import { PAL } from '../render/palette';
import { px, disc, drawTinted } from '../render/art';
import { input } from '../core/input';
import { sfx } from '../core/audio';

const WALK_SPEED = 1.5;
const CRAWL_SPEED = 0.75;
const JUMP_VELOCITY = -4.7;
const GRAVITY = 0.27;
const MAX_FALL = 7;
const STAND_H = 22;
const CROUCH_H = 14;
const MELEE_TICKS = 14;
const MELEE_REACH = 18;
const RESPAWN_IFRAMES = 120;
export const MAX_GRENADES = 10;

/**
 * Transformation states carried over from the arcade original. Only `normal`
 * is reachable in mission 1; the modifiers are wired up here so the later
 * missions can trigger them without touching movement code again.
 */
export type Status = 'normal' | 'mummy' | 'fat';

const STATUS_MODIFIERS: Record<Status, { speed: number; girth: number; damage: number; canShoot: boolean }> = {
  normal: { speed: 1, girth: 1, damage: 1, canShoot: true },
  mummy: { speed: 0.45, girth: 1, damage: 1, canShoot: false },
  fat: { speed: 0.78, girth: 1.6, damage: 2, canShoot: true },
};

export class Player extends Entity implements Body {
  onGround = false;
  dropThrough = false;
  facing: -1 | 1 = 1;

  weapon: WeaponId = 'pistol';
  ammo = Infinity;
  grenades = MAX_GRENADES;
  lives = 2;

  status: Status = 'normal';
  statusTicks = 0;

  /** Ticks of post-respawn invulnerability; the sprite blinks while > 0. */
  iframes = 0;
  /** Ticks remaining of the death animation. */
  dyingTicks = 0;
  /** True from the moment of death until the world spends a life on a respawn. */
  awaitingRespawn = false;
  /** Set while the player is inside a Slug; input is handled by the vehicle. */
  ridingSlug = false;

  private cooldown = 0;
  private meleeTicks = 0;
  private legPhase = 0;
  private crouching = false;
  private jumpHeld = false;
  private grenadeHeld = false;
  private liveShots = 0;

  constructor(x: number, y: number) {
    super();
    this.x = x;
    this.y = y;
    this.w = 10;
    this.h = STAND_H;
    this.depth = 60;
  }

  get alive(): boolean {
    return !this.awaitingRespawn && !this.dead;
  }

  get invulnerable(): boolean {
    return this.iframes > 0 || this.awaitingRespawn || this.ridingSlug;
  }

  get mods(): { speed: number; girth: number; damage: number; canShoot: boolean } {
    return STATUS_MODIFIERS[this.status];
  }

  setStatus(status: Status, ticks = 0): void {
    this.status = status;
    this.statusTicks = ticks;
    if (status === 'normal') this.statusTicks = 0;
  }

  giveWeapon(id: WeaponId): void {
    const def = WEAPONS[id];
    // Picking up the weapon you already hold tops the magazine back up.
    this.ammo = this.weapon === id && Number.isFinite(this.ammo) ? this.ammo + def.ammo : def.ammo;
    this.weapon = id;
    if (!Number.isFinite(def.ammo)) this.ammo = Infinity;
  }

  giveGrenades(n: number): void {
    this.grenades = clamp(this.grenades + n, 0, MAX_GRENADES);
  }

  /**
   * Called by the world when something lethal touches the player. `force`
   * bypasses invulnerability, which is what a bottomless pit does.
   */
  kill(world: World, force = false): void {
    if ((this.invulnerable && !force) || !this.alive) return;
    if (force && this.ridingSlug) this.ridingSlug = false;
    this.dyingTicks = 90;
    this.awaitingRespawn = true;
    this.vx = -this.facing * 1.4;
    this.vy = -3.2;
    this.weapon = 'pistol';
    this.ammo = Infinity;
    this.setStatus('normal');
    sfx.death();
    world.camera.shake(3, 14);
    world.fx.spark(this.cx, this.cy, 10, PAL.bandana);
  }

  respawn(x: number, y: number): void {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.dyingTicks = 0;
    this.awaitingRespawn = false;
    this.iframes = RESPAWN_IFRAMES;
    this.crouching = false;
    this.h = STAND_H;
    this.grenades = MAX_GRENADES;
  }

  override update(world: World): void {
    if (this.iframes > 0) this.iframes--;
    if (this.statusTicks > 0 && --this.statusTicks === 0) this.setStatus('normal');
    if (this.cooldown > 0) this.cooldown--;
    if (this.meleeTicks > 0) this.meleeTicks--;
    this.liveShots = world.playerShots.length;

    if (this.ridingSlug) return;

    if (this.awaitingRespawn) {
      this.updateDying(world);
      return;
    }

    this.handleMovement(world);
    this.handleWeapons(world);
  }

  private updateDying(world: World): void {
    if (this.dyingTicks > 0) this.dyingTicks--;
    this.vy = Math.min(this.vy + GRAVITY, MAX_FALL);
    // Stop the corpse once it is well off the bottom of the stage, so a death
    // over a pit cannot run the coordinates away while the world waits.
    if (this.y > 300) this.vy = 0;
    else moveBody(this, world.level);
    if (this.onGround) this.vx *= 0.8;
  }

  private handleMovement(world: World): void {
    const mods = this.mods;
    const ax = input.ax;
    const ay = input.ay;

    const wantCrouch = this.onGround && ay > 0;
    if (wantCrouch !== this.crouching) {
      this.crouching = wantCrouch;
      this.h = wantCrouch ? CROUCH_H : STAND_H;
    }

    if (ax !== 0) this.facing = ax;

    const speed = (this.crouching ? CRAWL_SPEED : WALK_SPEED) * mods.speed;
    this.vx = ax * speed;

    // A one-way platform is dropped through with down + jump.
    this.dropThrough = this.onGround && ay > 0 && input.pressed('jump');

    if (input.pressed('jump') && this.onGround && !this.dropThrough) {
      this.vy = JUMP_VELOCITY;
      this.onGround = false;
      this.jumpHeld = true;
      sfx.jump();
    }
    // Releasing jump early clips the arc, which makes precise hops possible.
    if (this.jumpHeld && !input.down('jump') && this.vy < -1.6) {
      this.vy = -1.6;
      this.jumpHeld = false;
    }
    if (this.onGround) this.jumpHeld = false;

    this.vy = Math.min(this.vy + GRAVITY, MAX_FALL);
    moveBody(this, world.level);

    // Keep the player inside the visible playfield.
    const left = world.camera.x + 6;
    const right = world.camera.x + 320 - 6;
    this.x = clamp(this.x, left, right);
    // Falling off the stage always kills, invulnerable or not.
    if (this.y > 260) this.kill(world, true);

    if (ax !== 0 && this.onGround) {
      this.legPhase = (this.legPhase + (this.crouching ? 0.06 : 0.11)) % 1;
    } else if (!this.onGround) {
      this.legPhase = 0.25;
    } else {
      this.legPhase = 0;
    }
  }

  private handleWeapons(world: World): void {
    if (input.pressed('grenade') && !this.grenadeHeld && this.grenades > 0) {
      this.grenadeHeld = true;
      this.grenades--;
      world.grenades.push(
        new Grenade(this.x, this.y - this.h * 0.6, this.facing, input.ay < 0),
      );
      sfx.tone(300, 0.05, 'square', 0.16, 520);
    }
    if (!input.down('grenade')) this.grenadeHeld = false;

    if (!input.down('shoot')) return;

    // Contact range takes priority: the shoot button becomes the knife.
    const victim = this.meleeTarget(world);
    if (victim && this.meleeTicks <= 0) {
      this.meleeTicks = MELEE_TICKS;
      victim.hurt(20, world, this.x, true);
      world.fx.spark(victim.cx, victim.cy, 6, PAL.white);
      sfx.knife();
      return;
    }

    if (this.cooldown > 0 || !this.mods.canShoot) return;

    const def = WEAPONS[this.weapon];
    if (this.ammo <= 0) {
      this.weapon = 'pistol';
      this.ammo = Infinity;
      return;
    }
    if (this.liveShots >= def.maxLive) return;

    const aim = aimVector(input.ax, input.ay, this.facing);
    // Straight down is only available in the air, as on the cabinet.
    if (aim.y > 0 && aim.x === 0 && this.onGround) return;

    const muzzleY = this.y - (this.crouching ? 8 : 14);
    const muzzleX = this.x + aim.x * 8;
    const shots = fireWeapon(def, muzzleX, muzzleY, aim.x, aim.y);
    if (this.status === 'fat') {
      for (const s of shots) s.weapon = { ...s.weapon, damage: s.weapon.damage * 2 };
    }
    world.playerShots.push(...shots);

    this.ammo = consumeAmmo(def, this.ammo);
    this.cooldown = def.cooldown;
    const flashSize = def.kind === 'pellet' || def.blast > 0 ? 7 : def.big ? 6 : 4;
    world.fx.muzzle(muzzleX + aim.x * 6, muzzleY + aim.y * 6, Math.atan2(aim.y, aim.x), flashSize);
    world.fx.casing(this.x, muzzleY, this.facing);
    this.playShotSound(def.kind);
    if (def.blast > 0 || def.kind === 'pellet') world.camera.shake(1, 4);
  }

  private playShotSound(kind: string): void {
    switch (kind) {
      case 'pellet': sfx.shotgun(); break;
      case 'rocket': case 'shell': case 'homing': sfx.rocket(); break;
      case 'flame': sfx.flame(); break;
      case 'laser': sfx.laser(); break;
      case 'bullet': this.weapon === 'pistol' ? sfx.pistol() : sfx.machineGun(); break;
      default: sfx.machineGun();
    }
  }

  private meleeTarget(world: World) {
    const reach = rect(
      this.facing === 1 ? this.x : this.x - MELEE_REACH,
      this.y - this.h,
      MELEE_REACH,
      this.h,
    );
    for (const e of world.enemyTargets()) {
      // The knife goes around a shield, which is the point of having it.
      if (e.dead) continue;
      if (overlaps(reach, e.box)) return e;
    }
    return null;
  }

  private get gunKind(): GunKind {
    if (this.status === 'mummy') return 'none';
    const def = WEAPONS[this.weapon];
    if (def.big || def.kind === 'rocket' || def.kind === 'lizard' || def.kind === 'shell') return 'heavy';
    if (this.weapon === 'pistol') return 'pistol';
    return 'rifle';
  }

  get pose(): ActorPose {
    const aim = aimVector(input.ax, input.ay, this.facing);
    const facingSpaceAim = Math.atan2(aim.y, aim.x * this.facing);
    return {
      facing: this.facing,
      aim: this.meleeTicks > 0 ? 0 : facingSpaceAim,
      legPhase: this.legPhase,
      moving: Math.abs(this.vx) > 0.05 && this.onGround,
      crouch: this.crouching,
      airborne: !this.onGround && !this.awaitingRespawn,
      melee: this.meleeTicks > 0 ? 1 - this.meleeTicks / MELEE_TICKS : 0,
      gun: this.gunKind,
      girth: this.mods.girth,
      falling: this.awaitingRespawn,
    };
  }

  override draw(ctx: CanvasRenderingContext2D, cam: Camera): void {
    if (this.ridingSlug) return;
    // Blink while invulnerable, the classic two-on/two-off flicker.
    if (this.iframes > 0 && Math.floor(this.iframes / 4) % 2 === 0) return;

    const x = this.x - cam.ox;
    const y = this.y - cam.oy;

    // Contact shadow keeps the character anchored to the ground.
    const shadowY = Math.min(300, this.y + 1);
    disc(ctx, x, shadowY - cam.oy, 5, 'rgba(0,0,0,0.28)');

    const pose = this.pose;
    if (this.status === 'mummy') {
      drawTinted(ctx, x - 14, y - 30, 28, 34, PAL.bone, (c) => {
        drawActor(c, x, y, HERO_SKIN, pose);
      });
      px(ctx, Math.round(x) - 4, Math.round(y) - 20, 3, 2, PAL.outline);
      return;
    }
    drawActor(ctx, x, y, HERO_SKIN, pose);
  }
}
