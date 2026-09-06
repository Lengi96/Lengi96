import { describe, expect, it } from 'vitest';
import {
  WEAPONS, WEAPON_ORDER, PICKUP_WEAPONS,
  aimVector, fireWeapon, consumeAmmo,
} from '../src/game/weapons';

describe('weapon roster', () => {
  it('carries the ammunition counts documented for the arcade release', () => {
    expect(WEAPONS.hmg.ammo).toBe(200);
    expect(WEAPONS.shotgun.ammo).toBe(30);
    expect(WEAPONS.shotgunBig.ammo).toBe(15);
    expect(WEAPONS.rocket.ammo).toBe(30);
    expect(WEAPONS.flame.ammo).toBe(30);
    expect(WEAPONS.laser.ammo).toBe(200);
    expect(WEAPONS.chaser.ammo).toBe(40);
    expect(WEAPONS.lizard.ammo).toBe(30);
    expect(WEAPONS.sgrenade.ammo).toBe(20);
    expect(WEAPONS.dropshot.ammo).toBe(30);
  });

  it('gives the sidearm unlimited ammunition and everything else a magazine', () => {
    expect(WEAPONS.pistol.ammo).toBe(Infinity);
    for (const id of PICKUP_WEAPONS) {
      expect(Number.isFinite(WEAPONS[id].ammo)).toBe(true);
    }
  });

  it('lists every weapon exactly once, and the pistol is not a pickup', () => {
    expect(new Set(WEAPON_ORDER).size).toBe(WEAPON_ORDER.length);
    expect(WEAPON_ORDER).toHaveLength(Object.keys(WEAPONS).length);
    expect(PICKUP_WEAPONS).not.toContain('pistol');
  });

  it('makes every Big variant strictly stronger than its base weapon', () => {
    for (const id of WEAPON_ORDER) {
      const def = WEAPONS[id];
      if (!def.big) continue;
      const base = WEAPONS[def.baseOf!];
      expect(base).toBeDefined();
      expect(def.damage).toBeGreaterThan(base.damage);
      expect(def.letter).toBe(base.letter);
    }
  });
});

describe('ammunition', () => {
  it('never depletes the sidearm', () => {
    expect(consumeAmmo(WEAPONS.pistol, Infinity)).toBe(Infinity);
  });

  it('spends one round per shot and stops at zero', () => {
    expect(consumeAmmo(WEAPONS.hmg, 200)).toBe(199);
    expect(consumeAmmo(WEAPONS.hmg, 1)).toBe(0);
    expect(consumeAmmo(WEAPONS.hmg, 0)).toBe(0);
  });
});

describe('eight-way aiming', () => {
  it('shoots forward when the stick is centred', () => {
    expect(aimVector(0, 0, 1)).toEqual({ x: 1, y: 0 });
    expect(aimVector(0, 0, -1)).toEqual({ x: -1, y: 0 });
  });

  it('shoots straight up regardless of facing', () => {
    expect(aimVector(0, -1, 1)).toEqual({ x: 0, y: -1 });
    expect(aimVector(0, -1, -1)).toEqual({ x: 0, y: -1 });
  });

  it('normalises the diagonals', () => {
    const v = aimVector(1, -1, 1);
    expect(Math.hypot(v.x, v.y)).toBeCloseTo(1, 6);
    expect(v.x).toBeGreaterThan(0);
    expect(v.y).toBeLessThan(0);
  });
});

describe('firing', () => {
  it('produces one projectile per shot for single-shot weapons', () => {
    expect(fireWeapon(WEAPONS.pistol, 0, 0, 1, 0)).toHaveLength(1);
    expect(fireWeapon(WEAPONS.rocket, 0, 0, 1, 0)).toHaveLength(1);
  });

  it('spreads the shotgun across its full cone', () => {
    const shots = fireWeapon(WEAPONS.shotgun, 0, 0, 1, 0);
    expect(shots).toHaveLength(WEAPONS.shotgun.shots);
    const angles = shots.map((s) => Math.atan2(s.vy, s.vx));
    const spread = Math.max(...angles) - Math.min(...angles);
    expect(spread).toBeCloseTo(WEAPONS.shotgun.spread, 3);
  });

  it('lobs the arcing weapons upward instead of straight ahead', () => {
    const [shell] = fireWeapon(WEAPONS.sgrenade, 0, 0, 1, 0);
    expect(shell.vy).toBeLessThan(0);
    expect(shell.vx).toBeGreaterThan(0);
  });

  it('sends the Iron Lizard along the ground rather than at the aim angle', () => {
    const [drone] = fireWeapon(WEAPONS.lizard, 0, 0, 0.7, -0.7);
    expect(drone.vy).toBe(0);
    expect(drone.vx).toBeCloseTo(WEAPONS.lizard.speed, 6);
  });

  it('keeps every shot at the weapon speed for non-lobbed weapons', () => {
    const [bullet] = fireWeapon(WEAPONS.laser, 0, 0, 1, 0);
    expect(Math.hypot(bullet.vx, bullet.vy)).toBeCloseTo(WEAPONS.laser.speed, 6);
  });
});
