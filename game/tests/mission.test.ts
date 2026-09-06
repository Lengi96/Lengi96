import { describe, expect, it } from 'vitest';
import { MISSION_01 } from '../src/data/mission01';
import { SCREEN_W } from '../src/render/screen';
import { WEAPONS, type WeaponId } from '../src/game/weapons';

const level = MISSION_01;

describe('mission 1 layout', () => {
  it('starts the player on solid ground', () => {
    const { x, y } = level.playerStart;
    const under = level.solids.some(
      (s) => s.kind === 'ground' && x >= s.x && x <= s.x + s.w && s.y === y,
    );
    expect(under).toBe(true);
  });

  /**
   * A spawn point with nothing underneath it drops its enemy into the scene
   * from above the screen, which reads as unfair because the player has no way
   * to see it coming. Every one of them has to stand on something.
   */
  it('places every spawn on solid footing rather than in mid-air', () => {
    const airborne = ['boss'];
    for (const s of level.spawns) {
      if (airborne.includes(s.kind)) continue;
      const under = level.solids.some(
        (p) => s.x >= p.x && s.x <= p.x + p.w && p.y === s.y,
      );
      expect(under, `${s.kind} at ${s.x}/${s.y} has no ground under it`).toBe(true);
    }
  });

  it('never scrolls past the end of the level', () => {
    expect(level.bossCamX).toBeLessThanOrEqual(level.width - SCREEN_W);
  });

  it('triggers every spawn before the camera can outrun it', () => {
    const maxCam = level.width - SCREEN_W;
    for (const s of level.spawns) {
      expect(s.at).toBeLessThanOrEqual(maxCam);
    }
  });

  /**
   * The camera is pinned while a gate is shut, so a wave placed outside that
   * frozen 320px window could never be reached and the gate would never open.
   * This is the check that catches a soft-locked level before a player does.
   */
  it('keeps every gated spawn inside the viewport its gate pins', () => {
    for (const gate of level.gates) {
      const wave = level.spawns.filter((s) => s.gate === gate.id);
      expect(wave.length).toBeGreaterThan(0);
      for (const s of wave) {
        expect(s.x).toBeGreaterThan(gate.camX);
        expect(s.x).toBeLessThan(gate.camX + SCREEN_W - 8);
        // The spawn also has to have fired by the time the camera is pinned.
        expect(s.at).toBeLessThanOrEqual(gate.camX);
      }
    }
  });

  it('gives each gate a distinct id and a forward-only ordering', () => {
    const ids = level.gates.map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
    const xs = level.gates.map((g) => g.camX);
    expect([...xs].sort((a, b) => a - b)).toEqual(xs);
  });

  it('only references weapon ids that exist', () => {
    const known = new Set([...Object.keys(WEAPONS), 'grenade', 'food', 'antidote', 'pow']);
    for (const item of level.items) expect(known.has(item.kind)).toBe(true);
    for (const prop of level.props) {
      if (prop.drop) expect(known.has(prop.drop)).toBe(true);
    }
    for (const spawn of level.spawns) {
      const gift = spawn.opts?.gift;
      if (typeof gift === 'string') expect(known.has(gift)).toBe(true);
    }
  });

  it('supplies enough firepower and prisoners to be worth playing', () => {
    const weaponCrates = level.items.filter((i) => i.kind in WEAPONS);
    expect(weaponCrates.length).toBeGreaterThanOrEqual(4);
    const pows = level.spawns.filter((s) => s.kind === 'pow').length
      + level.items.filter((i) => i.kind === 'pow').length;
    expect(pows).toBeGreaterThanOrEqual(4);
    expect(level.spawns.some((s) => s.kind === 'slug')).toBe(true);
    expect(level.spawns.filter((s) => s.kind === 'boss')).toHaveLength(1);
  });

  it('places at least one Big weapon, whose crate letter pulses', () => {
    const big = level.items.filter((i) => WEAPONS[i.kind as WeaponId]?.big);
    expect(big.length).toBeGreaterThan(0);
  });
});
