import { Entity } from './entity';
import { moveBody, type Body } from './level';
import { overlaps } from './geom';
import type { World } from './world';
import type { Camera } from '../render/camera';
import { PAL } from '../render/palette';
import { px, disc } from '../render/art';
import { drawText } from '../render/text';
import { sfx } from '../core/audio';
import { WEAPONS, type WeaponId } from './weapons';

export type PickupKind = WeaponId | 'grenade' | 'food' | 'antidote';

const GRENADE_BUNDLE = 10;

/**
 * A supply crate. Weapon crates carry the weapon's stencilled letter, and the
 * letter pulses when the crate holds a "Big" version - the same tell the
 * arcade original uses.
 */
export class Pickup extends Entity implements Body {
  onGround = false;
  readonly kind: PickupKind;
  private bob = 0;
  private life = 60 * 30;

  constructor(x: number, y: number, kind: PickupKind) {
    super();
    this.x = x;
    this.y = y;
    this.w = 16;
    this.h = 14;
    this.kind = kind;
    this.depth = 30;
  }

  override update(world: World): void {
    this.bob++;
    this.vy = Math.min(this.vy + 0.3, 7);
    moveBody(this, world.level);
    if (this.onGround) this.vx *= 0.85;

    if (--this.life <= 0 || this.x < world.camera.x - 40) {
      this.dead = true;
      return;
    }

    if (!world.player.alive) return;
    if (!overlaps(this.box, world.player.box)) return;
    this.collect(world);
  }

  private collect(world: World): void {
    this.dead = true;
    const p = world.player;
    switch (this.kind) {
      case 'grenade':
        p.giveGrenades(GRENADE_BUNDLE);
        world.fx.popup(this.x, this.y - 18, 'BOMB +10');
        break;
      case 'food':
        p.setStatus('fat', 60 * 20);
        world.fx.popup(this.x, this.y - 18, 'HEAVY!', PAL.fireMid);
        break;
      case 'antidote':
        p.setStatus('normal');
        world.fx.popup(this.x, this.y - 18, 'CURED', PAL.laser);
        break;
      default: {
        const def = WEAPONS[this.kind];
        p.giveWeapon(this.kind);
        world.fx.popup(this.x, this.y - 18, def.letter + (def.big ? '!' : ''), def.big ? PAL.danger : PAL.hud);
        break;
      }
    }
    world.addScore(100, this.x, this.y - 24);
    sfx.pickup();
  }

  override draw(ctx: CanvasRenderingContext2D, cam: Camera): void {
    const x = Math.round(this.x - cam.ox);
    const y = Math.round(this.y - cam.oy);
    const lift = this.onGround ? 0 : Math.round(Math.sin(this.bob * 0.15));

    disc(ctx, x, y + 1, 7, 'rgba(0,0,0,0.25)');

    if (this.kind === 'food') {
      this.paintFood(ctx, x, y + lift);
      return;
    }
    if (this.kind === 'antidote') {
      this.paintAntidote(ctx, x, y + lift);
      return;
    }

    // Wooden crate
    const top = y - 14 + lift;
    px(ctx, x - 8, top, 16, 14, PAL.outline);
    px(ctx, x - 7, top + 1, 14, 12, PAL.rust);
    px(ctx, x - 7, top + 1, 14, 2, PAL.sandDark);
    px(ctx, x - 7, top + 11, 14, 2, PAL.brickDark);
    px(ctx, x - 7, top + 6, 14, 1, PAL.brickDark);

    if (this.kind === 'grenade') {
      // Grenade crates carry a painted bomb instead of a letter.
      disc(ctx, x, top + 8, 3, PAL.heroDark);
      px(ctx, x - 1, top + 3, 2, 2, PAL.steel);
      drawText(ctx, 'B', x, top + 1, { color: PAL.bone, align: 'center' });
      return;
    }

    const def = WEAPONS[this.kind as WeaponId];
    // The pulsing letter is what marks a Big weapon.
    const pulse = def.big ? (Math.floor(this.bob / 6) % 2 === 0 ? PAL.danger : PAL.hud) : PAL.bone;
    drawText(ctx, def.letter, x, top + 4, { color: pulse, align: 'center', scale: 1 });
    if (def.big) {
      px(ctx, x - 7, top + 1, 14, 1, pulse);
      px(ctx, x - 7, top + 12, 14, 1, pulse);
    }
  }

  private paintFood(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    px(ctx, x - 7, y - 5, 14, 5, PAL.brickDark);
    px(ctx, x - 6, y - 9, 12, 5, PAL.sandDark);
    px(ctx, x - 6, y - 11, 12, 3, PAL.sand);
    px(ctx, x - 4, y - 8, 3, 2, PAL.danger);
    px(ctx, x + 1, y - 7, 3, 2, PAL.hero);
  }

  private paintAntidote(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    px(ctx, x - 3, y - 12, 6, 12, PAL.outline);
    px(ctx, x - 2, y - 11, 4, 10, PAL.laser);
    px(ctx, x - 2, y - 6, 4, 5, PAL.plasma);
    px(ctx, x - 1, y - 14, 2, 3, PAL.steel);
  }
}
