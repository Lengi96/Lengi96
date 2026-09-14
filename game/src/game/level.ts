import { overlaps, rect, type Rect } from './geom';
import type { Entity } from './entity';

export type SolidKind = 'ground' | 'platform';

export interface Solid extends Rect {
  kind: SolidKind;
}

/** A prop is scenery; give it `hp` to make it shootable. */
export interface PropDef {
  x: number;
  y: number;
  kind: 'barrel' | 'crate' | 'sandbag' | 'palm' | 'lamp' | 'sign' | 'wreck';
  hp?: number;
  /** Item id dropped when destroyed. */
  drop?: string;
}

export interface SpawnDef {
  /** Camera x at which this spawn fires. */
  at: number;
  kind: string;
  x: number;
  y: number;
  /** Gate this spawn belongs to; the gate stays shut until they are all dead. */
  gate?: number;
  facing?: -1 | 1;
  opts?: Record<string, number | string | boolean>;
}

export interface GateDef {
  id: number;
  /** Camera x the view is held at while the gate is shut. */
  camX: number;
}

export interface ItemDef {
  x: number;
  y: number;
  /** Weapon id, 'grenade' or 'pow'. */
  kind: string;
}

export interface LevelData {
  name: string;
  subtitle: string;
  /** Total scrollable width in world pixels. */
  width: number;
  /** Baseline ground height used by the background painter. */
  groundY: number;
  solids: Solid[];
  props: PropDef[];
  items: ItemDef[];
  spawns: SpawnDef[];
  gates: GateDef[];
  /** Camera x where the boss fight locks the screen. */
  bossCamX: number;
  playerStart: { x: number; y: number };
}

export class Level {
  readonly data: LevelData;
  readonly solids: Solid[];

  constructor(data: LevelData) {
    this.data = data;
    this.solids = data.solids;
  }

  get width(): number {
    return this.data.width;
  }

  /** Solids whose bounds intersect the query rect. */
  query(r: Rect): Solid[] {
    return this.solids.filter((s) => overlaps(s, r));
  }

  /** True if a solid ground block covers this point. */
  isSolidAt(x: number, y: number): boolean {
    const probe = rect(x, y, 1, 1);
    return this.solids.some((s) => s.kind === 'ground' && overlaps(s, probe));
  }

  /** Height of the first surface under (x, y), or Infinity if there is none. */
  groundBelow(x: number, y: number): number {
    let best = Infinity;
    for (const s of this.solids) {
      if (x < s.x || x > s.x + s.w) continue;
      if (s.y < y - 0.01) continue;
      if (s.y < best) best = s.y;
    }
    return best;
  }
}

export interface Body extends Entity {
  onGround: boolean;
  /** Ignore one-way platforms this tick (dropping through). */
  dropThrough?: boolean;
}

export interface MoveResult {
  hitWallX: boolean;
  landed: boolean;
  hitCeiling: boolean;
}

/**
 * Moves a body by its velocity and resolves it against the level, X first and
 * then Y. One-way platforms only stop a body that is falling onto them from
 * above, so the player can jump up through a ledge and then stand on it.
 */
export function moveBody(body: Body, level: Level): MoveResult {
  const res: MoveResult = { hitWallX: false, landed: false, hitCeiling: false };

  // --- Horizontal ---
  body.x += body.vx;
  if (body.vx !== 0) {
    const b = body.box;
    for (const s of level.solids) {
      if (s.kind !== 'ground' || !overlaps(b, s)) continue;
      // Ignore blocks the body is standing on top of (a 1px lip shouldn't grab).
      if (body.y - 1 <= s.y) continue;
      if (body.vx > 0) body.x = s.x - body.w / 2;
      else body.x = s.x + s.w + body.w / 2;
      body.vx = 0;
      res.hitWallX = true;
      break;
    }
  }

  // --- Vertical ---
  const prevBottom = body.y;
  body.y += body.vy;
  body.onGround = false;

  if (body.vy >= 0) {
    let landY = Infinity;
    for (const s of level.solids) {
      if (s.kind === 'platform' && body.dropThrough) continue;
      const left = body.x - body.w / 2;
      const right = body.x + body.w / 2;
      if (right <= s.x || left >= s.x + s.w) continue;
      // Only land on a surface we were above at the start of the step.
      if (prevBottom > s.y + 0.01) continue;
      if (body.y < s.y) continue;
      if (s.y < landY) landY = s.y;
    }
    if (landY !== Infinity) {
      body.y = landY;
      body.vy = 0;
      body.onGround = true;
      res.landed = true;
    }
  } else {
    const head = body.y - body.h;
    for (const s of level.solids) {
      if (s.kind !== 'ground') continue;
      const left = body.x - body.w / 2;
      const right = body.x + body.w / 2;
      if (right <= s.x || left >= s.x + s.w) continue;
      const bottomOfSolid = s.y + s.h;
      const prevHead = head - body.vy;
      if (!(head < bottomOfSolid && prevHead >= bottomOfSolid)) continue;
      if (head < s.y) continue;
      body.y = s.y + s.h + body.h;
      body.vy = 0;
      res.hitCeiling = true;
      break;
    }
  }

  return res;
}
