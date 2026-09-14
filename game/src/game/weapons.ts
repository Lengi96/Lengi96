import { Entity } from './entity';
import type { World } from './world';
import type { Camera } from '../render/camera';
import { PAL } from '../render/palette';
import { px, limb, disc } from '../render/art';
import { overlaps, clamp } from './geom';

/**
 * The weapon roster follows the arcade original's line-up: the pistol plus
 * the nine special weapons, five of which also come in a "Big" variant whose
 * crate letter pulses. Ammo counts match the values documented for the
 * arcade release.
 */
export type WeaponId =
  | 'pistol'
  | 'hmg' | 'hmgBig'
  | 'shotgun' | 'shotgunBig'
  | 'rocket' | 'rocketBig'
  | 'flame' | 'flameBig'
  | 'laser' | 'laserBig'
  | 'chaser'
  | 'lizard'
  | 'sgrenade'
  | 'dropshot';

export type ProjKind =
  | 'bullet' | 'pellet' | 'rocket' | 'flame' | 'laser'
  | 'homing' | 'lizard' | 'shell' | 'bouncer';

export interface WeaponDef {
  id: WeaponId;
  /** Shown on the HUD. */
  name: string;
  /** Letter stencilled on the supply crate. */
  letter: string;
  /** Rounds granted by one crate; Infinity for the sidearm. */
  ammo: number;
  /** Ticks between shots at 60 Hz. */
  cooldown: number;
  damage: number;
  /** Projectiles launched per shot. */
  shots: number;
  /** Total spread across those projectiles, in radians. */
  spread: number;
  speed: number;
  /** Ticks before the projectile expires. */
  life: number;
  /** Cap on this weapon's live projectiles, arcade-style. */
  maxLive: number;
  kind: ProjKind;
  /** How many enemies a shot passes through before stopping. */
  pierce: number;
  /** Blast radius for the explosive kinds. */
  blast: number;
  big: boolean;
  /** The standard-size weapon this is the Big version of. */
  baseOf?: WeaponId;
}

function def(d: Partial<WeaponDef> & Pick<WeaponDef, 'id' | 'name' | 'letter' | 'kind'>): WeaponDef {
  return {
    ammo: 30,
    cooldown: 8,
    damage: 1,
    shots: 1,
    spread: 0,
    speed: 6,
    life: 90,
    maxLive: 8,
    pierce: 0,
    blast: 0,
    big: false,
    ...d,
  } as WeaponDef;
}

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  pistol: def({
    id: 'pistol', name: 'HANDGUN', letter: 'P', kind: 'bullet',
    ammo: Infinity, cooldown: 9, damage: 1, speed: 6.4, maxLive: 3, life: 70,
  }),

  hmg: def({
    id: 'hmg', name: 'HEAVY MACHINE GUN', letter: 'H', kind: 'bullet',
    ammo: 200, cooldown: 3, damage: 1, speed: 7.2, maxLive: 12, life: 70,
  }),
  hmgBig: def({
    id: 'hmgBig', name: 'BIG HEAVY MACHINE GUN', letter: 'H', kind: 'bullet',
    ammo: 200, cooldown: 3, damage: 3, speed: 7.2, maxLive: 12, life: 70,
    big: true, baseOf: 'hmg', pierce: 1,
  }),

  shotgun: def({
    id: 'shotgun', name: 'SHOTGUN', letter: 'S', kind: 'pellet',
    ammo: 30, cooldown: 16, damage: 4, shots: 5, spread: 0.42, speed: 7,
    life: 16, maxLive: 20, pierce: 2,
  }),
  shotgunBig: def({
    id: 'shotgunBig', name: 'BIG SHOTGUN', letter: 'S', kind: 'pellet',
    ammo: 15, cooldown: 16, damage: 7, shots: 8, spread: 0.5, speed: 7.4,
    life: 20, maxLive: 32, pierce: 4, big: true, baseOf: 'shotgun',
  }),

  rocket: def({
    id: 'rocket', name: 'ROCKET LAUNCHER', letter: 'R', kind: 'rocket',
    ammo: 30, cooldown: 18, damage: 6, speed: 4.6, life: 110, maxLive: 4, blast: 20,
  }),
  rocketBig: def({
    id: 'rocketBig', name: 'BIG ROCKET LAUNCHER', letter: 'R', kind: 'rocket',
    ammo: 30, cooldown: 20, damage: 12, speed: 4.4, life: 110, maxLive: 4, blast: 34,
    big: true, baseOf: 'rocket',
  }),

  flame: def({
    id: 'flame', name: 'FLAME SHOT', letter: 'F', kind: 'flame',
    ammo: 30, cooldown: 12, damage: 2, speed: 4.2, life: 42, maxLive: 18, pierce: 99,
  }),
  flameBig: def({
    id: 'flameBig', name: 'BIG FLAME SHOT', letter: 'F', kind: 'flame',
    ammo: 30, cooldown: 12, damage: 4, speed: 4.6, life: 52, maxLive: 26, pierce: 99,
    big: true, baseOf: 'flame',
  }),

  laser: def({
    id: 'laser', name: 'LASER GUN', letter: 'L', kind: 'laser',
    ammo: 200, cooldown: 2, damage: 2, speed: 13, life: 40, maxLive: 24, pierce: 99,
  }),
  laserBig: def({
    id: 'laserBig', name: 'BIG LASER GUN', letter: 'L', kind: 'laser',
    ammo: 200, cooldown: 2, damage: 4, speed: 14, life: 40, maxLive: 30, pierce: 99,
    big: true, baseOf: 'laser',
  }),

  chaser: def({
    id: 'chaser', name: 'ENEMY CHASER', letter: 'C', kind: 'homing',
    ammo: 40, cooldown: 14, damage: 3, shots: 2, spread: 0.9, speed: 3.2,
    life: 130, maxLive: 8, blast: 12,
  }),

  lizard: def({
    id: 'lizard', name: 'IRON LIZARD', letter: 'I', kind: 'lizard',
    ammo: 30, cooldown: 16, damage: 8, speed: 3.6, life: 180, maxLive: 4, blast: 22,
  }),

  sgrenade: def({
    id: 'sgrenade', name: 'SUPER GRENADE', letter: 'G', kind: 'shell',
    ammo: 20, cooldown: 22, damage: 14, speed: 4.4, life: 150, maxLive: 3, blast: 38,
  }),

  dropshot: def({
    id: 'dropshot', name: 'DROP SHOT', letter: 'D', kind: 'bouncer',
    ammo: 30, cooldown: 15, damage: 5, speed: 3.4, life: 200, maxLive: 6, blast: 18,
  }),
};

/** Weapon ids in HUD/pickup order, Big variants next to their base weapon. */
export const WEAPON_ORDER: WeaponId[] = [
  'pistol', 'hmg', 'hmgBig', 'shotgun', 'shotgunBig', 'rocket', 'rocketBig',
  'flame', 'flameBig', 'laser', 'laserBig', 'chaser', 'lizard', 'sgrenade', 'dropshot',
];

/** Ids that can appear as a crate in a level (everything except the sidearm). */
export const PICKUP_WEAPONS: WeaponId[] = WEAPON_ORDER.filter((id) => id !== 'pistol');

/** Eight-way aim vectors, matching the cabinet's stick. */
export function aimVector(dx: -1 | 0 | 1, dy: -1 | 0 | 1, facing: -1 | 1): { x: number; y: number } {
  let ax = dx;
  let ay = dy;
  if (ax === 0 && ay === 0) {
    ax = facing;
  } else if (ax === 0 && ay !== 0) {
    // Straight up shoots straight up; straight down only when airborne.
    return { x: 0, y: ay };
  }
  const len = Math.hypot(ax, ay) || 1;
  return { x: ax / len, y: ay / len };
}

export class Projectile extends Entity {
  weapon: WeaponDef;
  private ttl: number;
  private hitsLeft: number;
  private hitIds = new Set<Entity>();
  private trailTick = 0;
  private grounded = false;
  /** Homing shots hold their target so they don't jitter between enemies. */
  private target: Entity | null = null;

  constructor(weapon: WeaponDef, x: number, y: number, vx: number, vy: number) {
    super();
    this.weapon = weapon;
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.ttl = weapon.life;
    this.hitsLeft = weapon.pierce + 1;
    this.depth = 40;
    const size = weapon.kind === 'shell' ? 8 : weapon.kind === 'lizard' ? 10 : 5;
    this.w = size;
    this.h = size;
  }

  override update(world: World): void {
    const k = this.weapon.kind;

    if (k === 'shell' || k === 'bouncer') {
      this.vy += k === 'shell' ? 0.22 : 0.26;
    }

    if (k === 'homing') {
      this.steerToTarget(world);
    }

    if (k === 'lizard') {
      this.crawl(world);
    }

    if (k === 'flame') {
      // Flame slows and swells as it travels, like a puff of burning fuel.
      this.vx *= 0.96;
      this.vy = this.vy * 0.96 - 0.012;
      this.w = Math.min(16, this.w + 0.25);
      this.h = this.w;
    }

    this.x += this.vx;
    this.y += this.vy;

    if (--this.ttl <= 0) {
      this.expire(world);
      return;
    }

    // World bounds: a shot that leaves the level is simply gone.
    if (this.x < world.camera.x - 32 || this.x > world.camera.x + 352 || this.y > 400 || this.y < -160) {
      this.dead = true;
      return;
    }

    if (k === 'bouncer' && this.bounce(world)) return;
    if (k !== 'flame' && k !== 'bouncer' && k !== 'lizard' && this.hitsScenery(world)) return;

    this.damageEnemies(world);
    this.emitTrail(world);
  }

  private steerToTarget(world: World): void {
    if (!this.target || this.target.dead) {
      this.target = world.nearestEnemy(this.x, this.y, 220);
    }
    const t = this.target;
    if (!t) return;
    const dx = t.cx - this.x;
    const dy = t.cy - this.y;
    const len = Math.hypot(dx, dy) || 1;
    const speed = this.weapon.speed;
    // Blend the current heading toward the target for a lazy homing arc.
    this.vx += (dx / len) * 0.42;
    this.vy += (dy / len) * 0.42;
    const cur = Math.hypot(this.vx, this.vy) || 1;
    this.vx = (this.vx / cur) * speed;
    this.vy = (this.vy / cur) * speed;
  }

  private crawl(world: World): void {
    // The Iron Lizard drone runs along the ground rather than flying.
    this.vy += 0.4;
    const groundY = world.level.groundBelow(this.x, this.y - 2);
    if (groundY !== Infinity && this.y + this.vy >= groundY) {
      this.y = groundY;
      this.vy = 0;
      this.grounded = true;
    } else {
      this.grounded = false;
    }
    if (this.grounded) {
      this.vx = Math.sign(this.vx) * this.weapon.speed;
      // Walls end the run in a blast.
      if (world.level.isSolidAt(this.x + Math.sign(this.vx) * 6, this.y - 4)) {
        this.explode(world);
      }
    }
  }

  private bounce(world: World): boolean {
    const groundY = world.level.groundBelow(this.x, this.y - 2);
    if (groundY !== Infinity && this.y >= groundY && this.vy > 0) {
      this.y = groundY;
      this.vy = -Math.abs(this.vy) * 0.55;
      if (Math.abs(this.vy) < 1.1) this.vy = -1.1;
      world.fx.spark(this.x, this.y - 2, 3, PAL.fireMid);
    }
    return false;
  }

  private hitsScenery(world: World): boolean {
    if (world.level.isSolidAt(this.x, this.y - this.h / 2)) {
      if (this.weapon.blast > 0) this.explode(world);
      else {
        world.fx.spark(this.x, this.y - this.h / 2, 4, PAL.fire);
        this.dead = true;
      }
      return true;
    }
    return false;
  }

  private damageEnemies(world: World): void {
    const box = this.box;
    for (const e of world.enemyTargets()) {
      if (e.dead || this.hitIds.has(e)) continue;
      if (!overlaps(box, e.box)) continue;
      this.hitIds.add(e);
      e.hurt(this.weapon.damage, world, this.x);
      world.fx.spark(this.x, this.cy, 3, PAL.fire);
      if (this.weapon.blast > 0) {
        this.explode(world);
        return;
      }
      if (--this.hitsLeft <= 0) {
        this.dead = true;
        return;
      }
    }
  }

  private emitTrail(world: World): void {
    if (this.weapon.kind === 'rocket' && ++this.trailTick % 2 === 0) {
      world.fx.smoke(this.x - this.vx, this.y - this.vy, 1);
    }
  }

  private expire(world: World): void {
    if (this.weapon.blast > 0 && this.weapon.kind !== 'homing') this.explode(world);
    else this.dead = true;
  }

  private explode(world: World): void {
    if (this.dead) return;
    this.dead = true;
    world.explode(this.x, this.y - this.h / 2, this.weapon.blast, this.weapon.damage, 'player');
  }

  override draw(ctx: CanvasRenderingContext2D, cam: Camera): void {
    const x = Math.round(this.x - cam.ox);
    const y = Math.round(this.y - cam.oy);
    const w = this.weapon;

    switch (w.kind) {
      case 'bullet': {
        const len = w.big ? 7 : 5;
        const th = w.big ? 3 : 2;
        const nx = this.vx / (Math.hypot(this.vx, this.vy) || 1);
        const ny = this.vy / (Math.hypot(this.vx, this.vy) || 1);
        limb(ctx, x, y - 2, x - nx * len, y - 2 - ny * len, th, PAL.hud);
        px(ctx, x - 1, y - 3, 2, 2, PAL.white);
        break;
      }
      case 'pellet': {
        px(ctx, x - 1, y - 3, 3, 3, PAL.fire);
        px(ctx, x, y - 2, 1, 1, PAL.white);
        break;
      }
      case 'laser': {
        const nx = this.vx / (Math.hypot(this.vx, this.vy) || 1);
        const ny = this.vy / (Math.hypot(this.vx, this.vy) || 1);
        limb(ctx, x, y - 2, x - nx * 22, y - 2 - ny * 22, w.big ? 4 : 2, PAL.laser);
        limb(ctx, x, y - 2, x - nx * 12, y - 2 - ny * 12, 1, PAL.white);
        break;
      }
      case 'rocket': {
        const nx = this.vx / (Math.hypot(this.vx, this.vy) || 1);
        const ny = this.vy / (Math.hypot(this.vx, this.vy) || 1);
        limb(ctx, x, y - 3, x - nx * 6, y - 3 - ny * 6, w.big ? 4 : 3, PAL.steel);
        px(ctx, x - 1, y - 4, 2, 2, PAL.danger);
        limb(ctx, x - nx * 6, y - 3 - ny * 6, x - nx * 11, y - 3 - ny * 11, 2, PAL.fireMid);
        break;
      }
      case 'flame': {
        const r = this.w / 2;
        disc(ctx, x, y - r, r, PAL.fireDeep);
        disc(ctx, x, y - r, r * 0.66, PAL.fireMid);
        disc(ctx, x, y - r, r * 0.33, PAL.fire);
        break;
      }
      case 'homing': {
        px(ctx, x - 2, y - 4, 4, 4, PAL.steelLight);
        px(ctx, x - 1, y - 3, 2, 2, PAL.danger);
        disc(ctx, x - this.vx, y - 2 - this.vy, 2, PAL.fireMid);
        break;
      }
      case 'lizard': {
        px(ctx, x - 5, y - 6, 10, 5, PAL.steelDark);
        px(ctx, x - 4, y - 7, 7, 2, PAL.steel);
        px(ctx, x + 3, y - 6, 2, 2, PAL.danger);
        px(ctx, x - 4, y - 1, 2, 1, PAL.black);
        px(ctx, x + 1, y - 1, 2, 1, PAL.black);
        break;
      }
      case 'shell': {
        disc(ctx, x, y - 4, 4, PAL.steelDark);
        disc(ctx, x, y - 4, 2, PAL.steelLight);
        px(ctx, x - 1, y - 9, 2, 3, PAL.danger);
        break;
      }
      case 'bouncer': {
        disc(ctx, x, y - 4, 4, PAL.fireDeep);
        disc(ctx, x, y - 4, 3, PAL.fireMid);
        disc(ctx, x - 1, y - 5, 1, PAL.fire);
        break;
      }
    }
  }
}

/**
 * Builds the projectiles for one trigger pull. Kept as a pure function so the
 * spread maths can be unit-tested without a running world.
 */
export function fireWeapon(
  weapon: WeaponDef,
  x: number,
  y: number,
  aimX: number,
  aimY: number,
): Projectile[] {
  const out: Projectile[] = [];
  const base = Math.atan2(aimY, aimX);
  const n = Math.max(1, weapon.shots);
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0 : i / (n - 1) - 0.5;
    const angle = base + t * weapon.spread;
    let speed = weapon.speed;
    if (weapon.kind === 'pellet') speed *= 0.85 + (i % 3) * 0.12;
    let vx = Math.cos(angle) * speed;
    let vy = Math.sin(angle) * speed;
    if (weapon.kind === 'shell' || weapon.kind === 'bouncer') {
      // Lobbed weapons get an upward kick so they arc instead of dropping.
      vy -= 2.6;
      vx *= 0.9;
    }
    if (weapon.kind === 'lizard') {
      vx = Math.sign(aimX || 1) * weapon.speed;
      vy = 0;
    }
    out.push(new Projectile(weapon, x, y, vx, vy));
  }
  return out;
}

/** Ammo left after firing once; the sidearm never runs dry. */
export function consumeAmmo(weapon: WeaponDef, ammo: number): number {
  if (!Number.isFinite(weapon.ammo)) return ammo;
  return clamp(ammo - 1, 0, Number.MAX_SAFE_INTEGER);
}
