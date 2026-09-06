import { describe, expect, it } from 'vitest';
import { Entity } from '../src/game/entity';
import { Level, moveBody, type Body, type LevelData } from '../src/game/level';
import { overlaps, rect, clamp, approach } from '../src/game/geom';
import { solveLobAngle } from '../src/game/enemies/mortar';
import { rescueValue, RESCUE_CHAIN } from '../src/game/pow';

/** A minimal movable body; the real actors only add behaviour on top of this. */
class TestBody extends Entity implements Body {
  onGround = false;
  dropThrough = false;
  constructor(x: number, y: number, w = 10, h = 22) {
    super();
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
  }
  override update(): void {}
  override draw(): void {}
}

function makeLevel(): Level {
  const data = {
    name: 'T', subtitle: 'T', width: 1000, groundY: 200,
    playerStart: { x: 0, y: 200 }, bossCamX: 0,
    solids: [
      { x: 0, y: 200, w: 400, h: 40, kind: 'ground' },
      { x: 400, y: 160, w: 100, h: 80, kind: 'ground' },
      { x: 120, y: 140, w: 80, h: 6, kind: 'platform' },
      { x: 0, y: 100, w: 60, h: 10, kind: 'ground' },
    ],
    props: [], items: [], spawns: [], gates: [],
  } satisfies LevelData;
  return new Level(data);
}

describe('geometry helpers', () => {
  it('detects overlapping rectangles and rejects touching ones', () => {
    expect(overlaps(rect(0, 0, 10, 10), rect(5, 5, 10, 10))).toBe(true);
    expect(overlaps(rect(0, 0, 10, 10), rect(10, 0, 10, 10))).toBe(false);
  });

  it('clamps and approaches without overshooting', () => {
    expect(clamp(15, 0, 10)).toBe(10);
    expect(clamp(-3, 0, 10)).toBe(0);
    expect(approach(0, 5, 2)).toBe(2);
    expect(approach(4, 5, 2)).toBe(5);
    expect(approach(9, 5, 2)).toBe(7);
  });
});

describe('level queries', () => {
  const level = makeLevel();

  it('finds the surface under a point', () => {
    expect(level.groundBelow(50, 0)).toBe(100);
    expect(level.groundBelow(150, 0)).toBe(140);
    expect(level.groundBelow(150, 150)).toBe(200);
    expect(level.groundBelow(250, 0)).toBe(200);
    expect(level.groundBelow(900, 0)).toBe(Infinity);
  });

  it('reports solid ground but not one-way platforms', () => {
    expect(level.isSolidAt(200, 210)).toBe(true);
    expect(level.isSolidAt(150, 142)).toBe(false);
    expect(level.isSolidAt(700, 210)).toBe(false);
  });
});

describe('moveBody', () => {
  const level = makeLevel();

  it('lands a falling body on the ground and zeroes its fall speed', () => {
    const b = new TestBody(250, 196);
    b.vy = 6;
    const res = moveBody(b, level);
    expect(res.landed).toBe(true);
    expect(b.onGround).toBe(true);
    expect(b.y).toBe(200);
    expect(b.vy).toBe(0);
  });

  it('stops a body against a wall without pushing it through', () => {
    const b = new TestBody(390, 200);
    b.vx = 6;
    const res = moveBody(b, level);
    expect(res.hitWallX).toBe(true);
    expect(b.x).toBe(400 - b.w / 2);
  });

  it('lets a body rise through a one-way platform', () => {
    const b = new TestBody(150, 160);
    b.vy = -5;
    moveBody(b, level);
    expect(b.onGround).toBe(false);
    expect(b.y).toBe(155);
  });

  it('lands a body on a one-way platform when it falls onto it', () => {
    const b = new TestBody(150, 138);
    b.vy = 5;
    const res = moveBody(b, level);
    expect(res.landed).toBe(true);
    expect(b.y).toBe(140);
  });

  it('drops through a one-way platform when asked to', () => {
    const b = new TestBody(150, 138);
    b.vy = 5;
    b.dropThrough = true;
    const res = moveBody(b, level);
    expect(res.landed).toBe(false);
    expect(b.y).toBe(143);
  });

  it('stops a jumping body against a ceiling', () => {
    const b = new TestBody(30, 136);
    b.vy = -6;
    const res = moveBody(b, level);
    expect(res.hitCeiling).toBe(true);
    expect(b.y).toBe(110 + b.h);
    expect(b.vy).toBe(0);
  });
});

describe('mortar firing solution', () => {
  /** Steps a shell with the same integration the game uses. */
  function simulate(angle: number, speed: number, gravity: number, steps = 400) {
    let x = 0;
    let y = 0;
    let vx = Math.cos(angle) * speed;
    let vy = Math.sin(angle) * speed;
    const path: Array<[number, number]> = [];
    for (let i = 0; i < steps; i++) {
      vy += gravity;
      x += vx;
      y += vy;
      path.push([x, y]);
    }
    return path;
  }

  it('lands a shell on a target ahead and level with the pit', () => {
    const speed = 5.2;
    const gravity = 0.16;
    const angle = solveLobAngle(120, 0, speed, gravity);
    const path = simulate(angle, speed, gravity);
    const near = path.find(([x, y]) => Math.abs(x - 120) < 6 && Math.abs(y) < 8);
    expect(near).toBeDefined();
  });

  it('mirrors the solution for a target behind the pit', () => {
    const right = solveLobAngle(120, 0, 5.2, 0.16);
    const left = solveLobAngle(-120, 0, 5.2, 0.16);
    expect(Math.cos(right)).toBeGreaterThan(0);
    expect(Math.cos(left)).toBeLessThan(0);
  });

  it('falls back to a 45-degree shot when the target is out of range', () => {
    const angle = solveLobAngle(10_000, 0, 5.2, 0.16);
    expect(angle).toBeCloseTo(-Math.PI / 4, 6);
  });
});

describe('POW rescue chain', () => {
  it('doubles the payout for each prisoner freed in a row', () => {
    expect(rescueValue(0)).toBe(100);
    expect(rescueValue(1)).toBe(200);
    expect(rescueValue(2)).toBe(400);
    expect(rescueValue(3)).toBe(800);
  });

  it('caps at the last chain value instead of running away', () => {
    const last = RESCUE_CHAIN[RESCUE_CHAIN.length - 1];
    expect(rescueValue(RESCUE_CHAIN.length)).toBe(last);
    expect(rescueValue(999)).toBe(last);
  });
});
