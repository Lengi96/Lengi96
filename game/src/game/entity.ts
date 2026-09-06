import type { World } from './world';
import type { Camera } from '../render/camera';
import { rect, type Rect } from './geom';

/**
 * Everything in the world is anchored at the bottom-centre of its hitbox:
 * `x` is the horizontal centre, `y` is the feet line. That makes ground
 * contact, crouching and sprite flipping all trivially symmetric.
 */
export abstract class Entity {
  x = 0;
  y = 0;
  vx = 0;
  vy = 0;
  /** Hitbox width. */
  w = 8;
  /** Hitbox height, measured upwards from `y`. */
  h = 8;
  /** Set to true to have the world drop this entity after the tick. */
  dead = false;
  /** Draw order; higher draws on top. */
  depth = 0;

  get box(): Rect {
    return rect(this.x - this.w / 2, this.y - this.h, this.w, this.h);
  }

  get cx(): number {
    return this.x;
  }

  get cy(): number {
    return this.y - this.h / 2;
  }

  abstract update(world: World): void;
  abstract draw(ctx: CanvasRenderingContext2D, cam: Camera, world: World): void;
}

/** Anything the player's shots can damage. */
export interface Damageable {
  /**
   * `ignoreArmour` is set by attacks that get around a shield: the knife,
   * which reaches around it, and explosions, which go through it.
   */
  hurt(amount: number, world: World, fromX: number, ignoreArmour?: boolean): void;
  readonly box: Rect;
  readonly dead: boolean;
  /** Enemies that block bullets (shield carriers) absorb without dying. */
  readonly armoured?: boolean;
  /** Player-side objects. The player's own fire never damages these. */
  readonly friendly?: boolean;
}

export function isDamageable(e: unknown): e is Damageable & Entity {
  return e instanceof Entity && typeof (e as unknown as Damageable).hurt === 'function';
}
