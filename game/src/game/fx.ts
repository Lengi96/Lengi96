import type { Camera } from '../render/camera';
import { PAL } from '../render/palette';
import { px, disc, ring } from '../render/art';
import { drawText } from '../render/text';
import { rng } from '../core/rng';

interface Particle {
  x: number; y: number; vx: number; vy: number;
  life: number; maxLife: number;
  size: number;
  gravity: number;
  colors: readonly string[];
  kind: 'spark' | 'smoke' | 'debris' | 'shell';
}

interface Blast {
  x: number; y: number; r: number; life: number; maxLife: number;
}

interface Flash {
  x: number; y: number; angle: number; size: number; life: number;
}

interface Popup {
  x: number; y: number; text: string; life: number; color: string;
}

/**
 * Non-interactive visual effects. Kept out of the entity list because they
 * never collide with anything and there can be a lot of them at once.
 */
export class Fx {
  private particles: Particle[] = [];
  private blasts: Blast[] = [];
  private popups: Popup[] = [];
  private flashes: Flash[] = [];

  clear(): void {
    this.particles.length = 0;
    this.blasts.length = 0;
    this.popups.length = 0;
    this.flashes.length = 0;
  }

  /**
   * A muzzle flash at the end of the barrel. Three frames is enough - it is
   * the punctuation on every shot, and the thing that makes firing feel like
   * an event rather than a bullet quietly appearing.
   */
  muzzle(x: number, y: number, angle: number, size = 5): void {
    this.flashes.push({ x, y, angle, size, life: 3 });
    this.particles.push({
      x, y,
      vx: Math.cos(angle) * rng.range(0.6, 1.6),
      vy: Math.sin(angle) * rng.range(0.6, 1.6) - 0.2,
      life: 7, maxLife: 7,
      size: 1,
      gravity: 0.02,
      colors: [PAL.white, PAL.fire],
      kind: 'spark',
    });
  }

  spark(x: number, y: number, count: number, color: string = PAL.fire): void {
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x, y,
        vx: rng.range(-1.6, 1.6),
        vy: rng.range(-1.6, 0.6),
        life: rng.int(6, 14), maxLife: 14,
        size: 1,
        gravity: 0.06,
        colors: [PAL.white, color],
        kind: 'spark',
      });
    }
  }

  smoke(x: number, y: number, count: number): void {
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: x + rng.range(-1, 1), y: y + rng.range(-1, 1),
        vx: rng.range(-0.25, 0.25),
        vy: rng.range(-0.5, -0.1),
        life: rng.int(14, 26), maxLife: 26,
        size: rng.int(1, 2),
        gravity: -0.01,
        colors: [PAL.smokeLight, PAL.smoke],
        kind: 'smoke',
      });
    }
  }

  debris(x: number, y: number, count: number, color: string = PAL.steelDark): void {
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x, y,
        vx: rng.range(-2.4, 2.4),
        vy: rng.range(-3.4, -0.6),
        life: rng.int(24, 48), maxLife: 48,
        size: rng.int(1, 2),
        gravity: 0.2,
        colors: [color, PAL.black],
        kind: 'debris',
      });
    }
  }

  /** A single ejected cartridge case, for the machine-gun feel. */
  casing(x: number, y: number, dir: -1 | 1): void {
    this.particles.push({
      x, y,
      vx: -dir * rng.range(0.4, 1.1),
      vy: rng.range(-1.6, -0.9),
      life: 34, maxLife: 34,
      size: 1,
      gravity: 0.22,
      colors: [PAL.hud, PAL.hudDim],
      kind: 'shell',
    });
  }

  explosion(x: number, y: number, radius: number): void {
    this.blasts.push({ x, y, r: radius, life: 18, maxLife: 18 });
    this.spark(x, y, Math.min(20, 4 + Math.floor(radius / 2)), PAL.fire);
    this.smoke(x, y, Math.min(14, 3 + Math.floor(radius / 3)));
    this.debris(x, y, Math.min(12, 2 + Math.floor(radius / 4)), PAL.rust);
  }

  popup(x: number, y: number, text: string, color: string = PAL.hud): void {
    this.popups.push({ x, y, text, life: 48, color });
  }

  update(): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.vy += p.gravity;
      if (p.kind === 'smoke') { p.vx *= 0.96; p.vy *= 0.96; }
      p.x += p.vx;
      p.y += p.vy;
      if (--p.life <= 0) this.particles.splice(i, 1);
    }
    for (let i = this.blasts.length - 1; i >= 0; i--) {
      if (--this.blasts[i].life <= 0) this.blasts.splice(i, 1);
    }
    for (let i = this.popups.length - 1; i >= 0; i--) {
      const p = this.popups[i];
      p.y -= 0.4;
      if (--p.life <= 0) this.popups.splice(i, 1);
    }
    for (let i = this.flashes.length - 1; i >= 0; i--) {
      if (--this.flashes[i].life <= 0) this.flashes.splice(i, 1);
    }
  }

  /** Drawn under the entities: smoke and lingering fire. */
  drawBehind(ctx: CanvasRenderingContext2D, cam: Camera): void {
    for (const p of this.particles) {
      if (p.kind !== 'smoke') continue;
      const t = p.life / p.maxLife;
      const c = t > 0.5 ? p.colors[0] : p.colors[1];
      const s = p.size + (t > 0.6 ? 1 : 0);
      px(ctx, p.x - cam.ox - s / 2, p.y - cam.oy - s / 2, s, s, c);
    }
  }

  /** Drawn over the entities: blasts, sparks, debris and score popups. */
  drawFront(ctx: CanvasRenderingContext2D, cam: Camera): void {
    for (const b of this.blasts) {
      const t = 1 - b.life / b.maxLife;
      const r = b.r * (0.35 + t * 0.9);
      const x = b.x - cam.ox;
      const y = b.y - cam.oy;
      if (t < 0.45) {
        disc(ctx, x, y, r * 0.75, PAL.white);
        disc(ctx, x, y, r * 0.55, PAL.fire);
      } else {
        disc(ctx, x, y, r * 0.8, PAL.fireMid);
        disc(ctx, x, y, r * 0.5, PAL.fireDeep);
      }
      ring(ctx, x, y, r, t < 0.5 ? PAL.fire : PAL.smoke);
    }

    for (const f of this.flashes) {
      const x = Math.round(f.x - cam.ox);
      const y = Math.round(f.y - cam.oy);
      const r = f.size * (f.life / 3);
      const cos = Math.cos(f.angle);
      const sin = Math.sin(f.angle);
      // A short cone of flame along the barrel with a white-hot core.
      disc(ctx, x, y, r, PAL.fireMid);
      disc(ctx, x + cos * r * 0.7, y + sin * r * 0.7, r * 0.7, PAL.fire);
      disc(ctx, x, y, Math.max(1, r * 0.45), PAL.white);
      px(ctx, x + cos * r * 1.5 - 1, y + sin * r * 1.5 - 1, 2, 2, PAL.fire);
    }

    for (const p of this.particles) {
      if (p.kind === 'smoke') continue;
      const t = p.life / p.maxLife;
      const c = t > 0.55 ? p.colors[0] : p.colors[1];
      px(ctx, p.x - cam.ox, p.y - cam.oy, p.size, p.size, c);
    }

    for (const p of this.popups) {
      drawText(ctx, p.text, p.x - cam.ox, p.y - cam.oy, {
        color: p.color, align: 'center', shadow: PAL.black,
      });
    }
  }
}
