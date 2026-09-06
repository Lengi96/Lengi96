import { Entity, type Damageable } from '../entity';
import { EnemyShot } from '../enemies/base';
import { overlaps, clamp } from '../geom';
import type { World } from '../world';
import type { Camera } from '../../render/camera';
import { PAL } from '../../render/palette';
import { px, limb, disc, drawTinted } from '../../render/art';
import { sfx } from '../../core/audio';
import { rng } from '../../core/rng';

export const BOSS_NAME = 'IRON JACKAL';

const MAX_HP = 260;
const ENTRY_TICKS = 110;

type Phase = 'entry' | 'guns' | 'missiles' | 'ram' | 'dying';

/**
 * Mission 1's boss: a rebel land cruiser with a fixed cannon, two gun pods
 * and a missile bay. The pods can be shot off individually, which is the
 * player's lever on the fight; the hull core only opens up in the last phase.
 */
export class IronJackal extends Entity implements Damageable {
  hp = MAX_HP;
  readonly maxHp = MAX_HP;
  phase: Phase = 'entry';
  /** Parts are registered with the world so shots can hit them separately. */
  readonly parts: JackalPod[] = [];

  private timer = ENTRY_TICKS;
  private flash = 0;
  private flashCooldown = 0;
  private tread = 0;
  private cannonAngle = Math.PI;
  private hatch = 0;
  private deathTicks = 0;
  private anchorX: number;

  constructor(x: number, y: number) {
    super();
    this.x = x;
    this.y = y;
    this.w = 96;
    this.h = 58;
    this.depth = 58;
    this.anchorX = x;
    // Offsets place the pods on the roof, clear of the superstructure.
    this.parts.push(new JackalPod(this, -24, -72), new JackalPod(this, 22, -72));
  }

  get armoured(): boolean {
    // The hull shrugs off nothing, but the pods soak most of the incoming fire.
    return false;
  }

  get defeated(): boolean {
    return this.phase === 'dying';
  }

  hurt(amount: number, world: World, _fromX: number): void {
    if (this.phase === 'entry' || this.phase === 'dying') return;
    // Armour plating: full damage only once the hull is exposed in phase 3.
    const scale = this.phase === 'ram' ? 1 : 0.5;
    this.hp -= amount * scale;
    // Strobe rather than stay lit: under sustained fire a per-hit flash would
    // simply erase the sprite.
    if (this.flashCooldown === 0) {
      this.flash = 2;
      this.flashCooldown = 9;
    }
    if (this.hp <= 0) this.beginDeath(world);
    else sfx.hit();
  }

  private beginDeath(world: World): void {
    this.hp = 0;
    this.phase = 'dying';
    this.deathTicks = 150;
    for (const p of this.parts) p.dead = true;
    world.camera.shake(4, 40);
    world.onBossDefeated();
  }

  override update(world: World): void {
    if (this.flash > 0) this.flash--;
    if (this.flashCooldown > 0) this.flashCooldown--;
    this.tread += this.vx;

    switch (this.phase) {
      case 'entry': this.updateEntry(world); break;
      case 'guns': this.updateGuns(world); break;
      case 'missiles': this.updateMissiles(world); break;
      case 'ram': this.updateRam(world); break;
      case 'dying': this.updateDying(world); return;
    }

    this.x += this.vx;
    if (this.phase !== 'entry') {
      this.x = clamp(this.x, this.anchorX - 46, this.anchorX + 30);
    }

    // Advance to the next phase as the hull gives way.
    if (this.phase === 'guns' && this.hp < MAX_HP * 0.66) this.enter('missiles', 40, world);
    else if (this.phase === 'missiles' && this.hp < MAX_HP * 0.33) this.enter('ram', 40, world);

    if (world.player.alive && overlaps(this.box, world.player.box)) {
      world.player.kill(world);
    }
  }

  private enter(phase: Phase, timer: number, world: World): void {
    this.phase = phase;
    this.timer = timer;
    world.camera.shake(2, 12);
    sfx.tone(140, 0.3, 'sawtooth', 0.24, 70);
  }

  private updateEntry(world: World): void {
    this.vx = -1.2;
    world.fx.smoke(this.x + 40, this.y - 38, 1);
    if (--this.timer <= 0) {
      this.anchorX = this.x;
      this.vx = 0;
      this.phase = 'guns';
      this.timer = 40;
    }
  }

  private updateGuns(world: World): void {
    this.vx = Math.sin(this.tread * 0.004) * 0.5;
    this.aimCannon(world);
    if (--this.timer > 0) return;
    this.timer = 70;
    this.fireCannon(world, 3);
  }

  private updateMissiles(world: World): void {
    this.hatch = Math.min(1, this.hatch + 0.03);
    this.vx = Math.sin(this.tread * 0.006) * 0.8;
    this.aimCannon(world);
    if (--this.timer > 0) return;
    this.timer = 54;
    if (rng.chance(0.5)) this.fireCannon(world, 2);
    else this.fireMissiles(world);
  }

  private updateRam(world: World): void {
    this.hatch = 1;
    if (--this.timer > 0) {
      this.vx = 0;
      return;
    }
    // Charge back and forth, spraying as it goes.
    this.vx = this.x > this.anchorX - 20 ? -2.2 : 2.2;
    if (this.tread % 14 < 1) {
      this.aimCannon(world);
      this.fireCannon(world, 1);
    }
    if (this.x <= this.anchorX - 44 || this.x >= this.anchorX + 28) {
      this.timer = 34;
      world.camera.shake(2, 10);
    }
  }

  private updateDying(world: World): void {
    this.deathTicks--;
    this.vx = 0;
    if (this.deathTicks % 9 === 0) {
      world.fx.explosion(
        this.x + rng.range(-34, 34),
        this.y - rng.range(4, 56),
        rng.int(10, 20),
      );
      sfx.explosion(this.deathTicks < 30);
      world.camera.shake(2, 10);
    }
    if (this.deathTicks <= 0) {
      this.dead = true;
      world.fx.explosion(this.x, this.y - 28, 60);
      world.camera.shake(6, 40);
      sfx.explosion(true);
    }
  }

  private aimCannon(world: World): void {
    const p = world.player;
    const want = Math.atan2(p.cy - (this.y - 32), p.cx - (this.x - 14));
    let d = want - this.cannonAngle;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    this.cannonAngle += clamp(d, -0.03, 0.03);
  }

  private fireCannon(world: World, count: number): void {
    const ox = this.x - 46;
    const oy = this.y - 32;
    for (let i = 0; i < count; i++) {
      const spread = (i - (count - 1) / 2) * 0.16;
      const a = this.cannonAngle + spread;
      world.enemyShots.push(
        new EnemyShot(ox, oy, Math.cos(a) * 3.6, Math.sin(a) * 3.6, 'bullet', 240),
      );
    }
    world.fx.smoke(ox, oy, 3);
    world.camera.shake(1, 6);
    sfx.burst({ kind: 'brown', filter: 'lowpass', dur: 0.14, peak: 0.3, freq: 900, freqTo: 240 });
  }

  private fireMissiles(world: World): void {
    for (let i = 0; i < 3; i++) {
      world.enemyShots.push(
        new EnemyShot(
          this.x + rng.range(-16, 16),
          this.y - 58,
          rng.range(-1.4, -0.5),
          -rng.range(2.4, 3.4),
          'shell',
          320,
          0.12,
        ),
      );
    }
    world.fx.smoke(this.x, this.y - 58, 5);
    sfx.rocket();
  }

  override draw(ctx: CanvasRenderingContext2D, cam: Camera): void {
    const x = this.x - cam.ox;
    const y = this.y - cam.oy;
    px(ctx, x - 50, y - 2, 100, 3, 'rgba(0,0,0,0.3)');
    this.paint(ctx, x, y);
    if (this.flash > 0) {
      drawTinted(ctx, x - 58, y - 70, 116, 74, PAL.white, (c) => this.paint(c, x, y), 0.5);
    }
  }

  private paint(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    const bx = Math.round(x);
    const by = Math.round(y);

    // Running gear
    px(ctx, bx - 49, by - 16, 98, 16, PAL.outline);
    px(ctx, bx - 48, by - 15, 96, 14, PAL.steelDark);
    for (let i = 0; i < 20; i++) {
      const tx = bx - 47 + ((i * 5 + Math.floor(this.tread) % 5) + 94) % 94;
      px(ctx, tx, by - 15, 2, 14, PAL.black);
    }
    for (const wx of [-38, -23, -8, 8, 23, 38]) {
      disc(ctx, bx + wx, by - 8, 5, PAL.steel);
      disc(ctx, bx + wx, by - 8, 3, PAL.steelDark);
    }

    // Hull
    px(ctx, bx - 47, by - 43, 94, 28, PAL.outline);
    px(ctx, bx - 46, by - 42, 92, 26, PAL.bossHull);
    px(ctx, bx - 46, by - 42, 92, 5, PAL.bossHullLight);
    px(ctx, bx - 46, by - 21, 92, 4, PAL.bossHullDark);
    for (let i = 0; i < 8; i++) {
      px(ctx, bx - 40 + i * 11, by - 38, 3, 18, PAL.bossHullDark);
    }

    // Hazard stripe along the skirt: the boss must not read as another
    // brown building in a brown town.
    for (let i = 0; i < 12; i++) {
      px(ctx, bx - 45 + i * 8, by - 20, 4, 3, PAL.bossTrim);
    }

    // Superstructure
    px(ctx, bx - 29, by - 59, 58, 17, PAL.outline);
    px(ctx, bx - 28, by - 58, 56, 15, PAL.bossHull);
    px(ctx, bx - 28, by - 58, 56, 4, PAL.bossTrim);
    px(ctx, bx - 24, by - 53, 14, 6, PAL.black);
    px(ctx, bx - 23, by - 52, 12, 4, PAL.laser);

    // Missile bay, opens from phase 2
    if (this.hatch > 0) {
      const openW = Math.round(32 * this.hatch);
      px(ctx, bx - 4, by - 62, openW, 5, PAL.black);
      for (let i = 0; i < 4; i++) {
        px(ctx, bx - 2 + i * 8, by - 61, 3, 3, PAL.danger);
      }
    }

    // Exposed core once the armour has failed
    if (this.phase === 'ram' || this.phase === 'dying') {
      const glow = Math.floor(this.tread / 3) % 2 === 0 ? PAL.fire : PAL.danger;
      px(ctx, bx - 10, by - 38, 20, 16, PAL.black);
      px(ctx, bx - 7, by - 35, 14, 10, glow);
      px(ctx, bx - 4, by - 32, 8, 4, PAL.white);
    }

    // Main cannon
    const ax = bx - 14;
    const ay = by - 32;
    disc(ctx, ax, ay, 9, PAL.bossHullDark);
    limb(ctx, ax, ay, ax + Math.cos(this.cannonAngle) * 34, ay + Math.sin(this.cannonAngle) * 34, 7, PAL.steelDark);
    limb(ctx, ax, ay, ax + Math.cos(this.cannonAngle) * 25, ay + Math.sin(this.cannonAngle) * 25, 3, PAL.steel);
    disc(ctx, ax, ay, 5, PAL.rust);
  }

}

/**
 * A shootable gun pod on the boss's roof. Destroying both stops the strafing
 * fire, so it is worth spending ammunition on them.
 */
export class JackalPod extends Entity implements Damageable {
  private boss: IronJackal;
  private offX: number;
  private offY: number;
  hp = 22;
  private timer: number;
  private flash = 0;

  constructor(boss: IronJackal, offX: number, offY: number) {
    super();
    this.boss = boss;
    this.offX = offX;
    this.offY = offY;
    this.w = 16;
    this.h = 12;
    this.depth = 59;
    this.timer = rng.int(30, 90);
    this.sync();
  }

  private sync(): void {
    this.x = this.boss.x + this.offX;
    this.y = this.boss.y + this.offY + this.h;
  }

  hurt(amount: number, world: World, _fromX: number): void {
    if (this.dead) return;
    this.hp -= amount;
    this.flash = 2;
    sfx.hit();
    if (this.hp <= 0) {
      this.dead = true;
      world.addScore(1000, this.cx, this.cy);
      world.fx.explosion(this.cx, this.cy, 18);
      sfx.explosion(false);
      // Losing a pod also costs the hull, so the fight always progresses.
      this.boss.hurt(18, world, this.x);
    }
  }

  override update(world: World): void {
    if (this.flash > 0) this.flash--;
    if (this.boss.dead || this.boss.defeated) {
      this.dead = true;
      return;
    }
    this.sync();
    if (this.boss.phase === 'entry') return;
    if (--this.timer > 0) return;
    this.timer = 66;

    const p = world.player;
    const a = Math.atan2(p.cy - this.cy, p.cx - this.cx);
    for (let i = -1; i <= 1; i++) {
      world.enemyShots.push(
        new EnemyShot(this.cx, this.cy, Math.cos(a + i * 0.2) * 3, Math.sin(a + i * 0.2) * 3),
      );
    }
    world.fx.spark(this.cx, this.cy, 2, PAL.fire);
    sfx.burst({ dur: 0.06, peak: 0.16, freq: 1600, freqTo: 600 });
  }

  override draw(ctx: CanvasRenderingContext2D, cam: Camera): void {
    const x = Math.round(this.x - cam.ox);
    const y = Math.round(this.y - cam.oy);
    const paint = (c: CanvasRenderingContext2D) => {
      px(c, x - 8, y - 12, 16, 12, PAL.outline);
      px(c, x - 7, y - 11, 14, 10, PAL.steelDark);
      px(c, x - 7, y - 11, 14, 3, PAL.steel);
      px(c, x - 5, y - 7, 4, 4, PAL.danger);
      limb(c, x, y - 6, x - 12, y - 4, 3, PAL.black);
    };
    if (this.flash > 0) drawTinted(ctx, x - 12, y - 16, 24, 20, PAL.white, paint);
    else paint(ctx);
  }
}
