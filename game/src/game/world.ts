import { Entity, isDamageable, type Damageable } from './entity';
import { Level, type LevelData, type SpawnDef } from './level';
import { Player } from './player';
import { Camera } from '../render/camera';
import { Fx } from './fx';
import { Projectile } from './weapons';
import { Grenade } from './grenade';
import { Pickup } from './items';
import { Pow, rescueValue } from './pow';
import { Prop } from './props';
import { Slug, RebelTank } from './slug';
import { EnemyShot } from './enemies/base';
import { RebelSoldier } from './enemies/soldier';
import { ShieldMan } from './enemies/shieldman';
import { MortarPit } from './enemies/mortar';
import { Turret } from './enemies/turret';
import { Rival } from './enemies/rival';
import { IronJackal } from './boss/mission01';
import { dist2, overlaps, rect } from './geom';
import { SCREEN_W } from '../render/screen';
import { drawSky, drawParallax, drawTerrain, drawForeground } from '../render/background';
import { sfx } from '../core/audio';
import { PAL } from '../render/palette';

export type MissionPhase = 'playing' | 'boss' | 'clear' | 'gameover';

export interface MissionResult {
  score: number;
  powsRescued: number;
  ticks: number;
  bossKilledInSlug: boolean;
}

const RESPAWN_OFFSET = 70;
const START_LIVES = 2;
/** The rescue chain resets if the player goes this long without a rescue. */
const CHAIN_TIMEOUT = 60 * 12;

export class World {
  readonly level: Level;
  readonly camera = new Camera();
  readonly fx = new Fx();
  player: Player;

  /** Everything that updates and draws but is not a projectile. */
  actors: Entity[] = [];
  playerShots: Projectile[] = [];
  enemyShots: EnemyShot[] = [];
  grenades: Grenade[] = [];
  items: Pickup[] = [];

  score = 0;
  lives = START_LIVES;
  credits = 4;
  powsRescued = 0;
  ticks = 0;
  phase: MissionPhase = 'playing';
  /** Ticks of freeze-frame left after a heavy hit. */
  hitstop = 0;

  boss: IronJackal | null = null;
  bossKilledInSlug = false;

  private pendingSpawns: SpawnDef[];
  private openGates = new Set<number>();
  private activeGate: number | null = null;
  private chainIndex = 0;
  private chainTimer = 0;
  private targetCache: (Entity & Damageable)[] = [];
  private targetCacheTick = -1;
  private clearTicks = 0;

  constructor(data: LevelData) {
    this.level = new Level(data);
    this.player = new Player(data.playerStart.x, data.playerStart.y);
    this.camera.maxX = Math.max(0, data.width - SCREEN_W);
    this.pendingSpawns = [...data.spawns].sort((a, b) => a.at - b.at);

    for (const p of data.props) this.actors.push(new Prop(p));
    for (const it of data.items) {
      if (it.kind === 'pow') this.actors.push(new Pow(it.x, it.y));
      else this.items.push(new Pickup(it.x, it.y, it.kind as Pickup['kind']));
    }
    this.actors.push(this.player);
  }

  // ---------------------------------------------------------------- queries

  /** Everything the player's fire can damage, cached for the current tick. */
  hittables(): (Entity & Damageable)[] {
    if (this.targetCacheTick === this.ticks) return this.targetCache;
    this.targetCache = this.actors.filter(
      (a): a is Entity & Damageable => a !== this.player && !a.dead && isDamageable(a),
    );
    this.targetCacheTick = this.ticks;
    return this.targetCache;
  }

  /**
   * Hittables the player's weapons are allowed to damage - everything except
   * the player's own vehicle, which would otherwise be shot to pieces by its
   * own driver.
   */
  enemyTargets(): (Entity & Damageable)[] {
    return this.hittables().filter((e) => !e.friendly);
  }

  nearestEnemy(x: number, y: number, range: number): Entity | null {
    let best: Entity | null = null;
    let bestD = range * range;
    for (const e of this.enemyTargets()) {
      if (e instanceof Pow || e instanceof Prop) continue;
      const d = dist2(x, y, e.cx, e.cy);
      if (d < bestD) {
        bestD = d;
        best = e;
      }
    }
    return best;
  }

  get slug(): Slug | null {
    return (this.actors.find((a) => a instanceof Slug && !a.dead) as Slug) ?? null;
  }

  // ------------------------------------------------------------- world verbs

  addScore(points: number, x?: number, y?: number): void {
    this.score += points;
    if (x !== undefined && y !== undefined) {
      this.fx.popup(x, y, String(points));
    }
  }

  /** Radial damage. `source` decides who it is allowed to hurt. */
  explode(x: number, y: number, radius: number, damage: number, source: 'player' | 'enemy'): void {
    this.fx.explosion(x, y, radius);
    this.camera.shake(Math.min(4, 1 + radius / 12), 12);
    this.hitstop = Math.max(this.hitstop, radius > 28 ? 4 : 2);

    const area = rect(x - radius, y - radius, radius * 2, radius * 2);
    if (source === 'player') {
      for (const e of this.enemyTargets()) {
        if (e.dead || !overlaps(area, e.box)) continue;
        // Blasts ignore shields: that is the point of carrying grenades.
        e.hurt(damage, this, x, true);
      }
    }
    const p = this.player;
    if (p.alive && overlaps(area, p.box)) {
      // The player's own ordnance is harmless, as it is in the original.
      if (source === 'enemy') p.kill(this);
    }
  }

  onPowRescued(pow: Pow): void {
    this.powsRescued++;
    const value = rescueValue(this.chainIndex);
    this.chainIndex++;
    this.chainTimer = CHAIN_TIMEOUT;
    this.addScore(value, pow.x, pow.y - 30);
  }

  onBossDefeated(): void {
    this.bossKilledInSlug = this.player.ridingSlug;
    sfx.stopMusic();
  }

  get result(): MissionResult {
    return {
      score: this.score,
      powsRescued: this.powsRescued,
      ticks: this.ticks,
      bossKilledInSlug: this.bossKilledInSlug,
    };
  }

  // ----------------------------------------------------------------- update

  update(): void {
    if (this.hitstop > 0) {
      this.hitstop--;
      return;
    }
    this.ticks++;
    if (this.chainTimer > 0 && --this.chainTimer === 0) this.chainIndex = 0;

    this.updateCamera();
    this.processSpawns();

    for (const a of this.actors) if (!a.dead) a.update(this);
    for (const p of this.playerShots) if (!p.dead) p.update(this);
    for (const s of this.enemyShots) if (!s.dead) s.update(this);
    for (const g of this.grenades) if (!g.dead) g.update(this);
    for (const i of this.items) if (!i.dead) i.update(this);
    this.fx.update();
    this.camera.tick();

    this.prune();
    this.updatePlayerLife();
    this.updatePhase();
  }

  private updateCamera(): void {
    const anchor = this.player.ridingSlug ? (this.slug?.x ?? this.player.x) : this.player.x;
    this.camera.follow(anchor);
    this.updateGate();
  }

  private updateGate(): void {
    // Close the next gate the camera runs into, then hold until it is cleared.
    if (this.activeGate === null) {
      for (const g of this.level.data.gates) {
        if (this.openGates.has(g.id)) continue;
        if (this.camera.x >= g.camX - 1) {
          this.activeGate = g.id;
          this.camera.gateX = g.camX;
          break;
        }
      }
      return;
    }

    const id = this.activeGate;
    const pendingForGate = this.pendingSpawns.some((s) => s.gate === id);
    const aliveForGate = this.actors.some(
      (a) => !a.dead && (a as { gate?: number }).gate === id,
    );
    if (!pendingForGate && !aliveForGate) {
      this.openGates.add(id);
      this.activeGate = null;
      this.camera.gateX = Infinity;
      this.fx.popup(this.camera.x + SCREEN_W / 2, 70, 'GO!', PAL.hud);
      sfx.tone(880, 0.12, 'square', 0.24, 1320);
    }
  }

  private processSpawns(): void {
    while (this.pendingSpawns.length > 0 && this.pendingSpawns[0].at <= this.camera.x) {
      const def = this.pendingSpawns.shift()!;
      const actor = makeActor(def);
      if (!actor) continue;
      if (def.gate !== undefined) (actor as { gate?: number }).gate = def.gate;
      this.actors.push(actor);
      if (actor instanceof IronJackal) {
        this.boss = actor;
        this.actors.push(...actor.parts);
        this.phase = 'boss';
        this.camera.gateX = this.level.data.bossCamX;
        this.activeGate = null;
        sfx.startMusic();
      }
    }
  }

  private prune(): void {
    this.actors = this.actors.filter((a) => !a.dead || a === this.player);
    this.playerShots = this.playerShots.filter((p) => !p.dead);
    this.enemyShots = this.enemyShots.filter((s) => !s.dead);
    this.grenades = this.grenades.filter((g) => !g.dead);
    this.items = this.items.filter((i) => !i.dead);
    this.targetCacheTick = -1;
  }

  private updatePlayerLife(): void {
    const p = this.player;
    if (!p.awaitingRespawn || p.dyingTicks > 0) return;
    // The death animation has finished: spend a life, or end the run.
    if (this.lives > 0) {
      this.lives--;
      const x = Math.max(this.camera.x + RESPAWN_OFFSET, this.level.data.playerStart.x);
      const y = Math.min(this.level.groundBelow(x, 0), 180);
      p.respawn(x, Number.isFinite(y) ? y : 180);
    } else if (this.phase !== 'gameover') {
      this.phase = 'gameover';
      sfx.stopMusic();
    }
  }

  private updatePhase(): void {
    if (this.phase === 'boss' && this.boss?.dead) {
      this.phase = 'clear';
      this.clearTicks = 0;
    }
    if (this.phase === 'clear') this.clearTicks++;
  }

  get clearAge(): number {
    return this.clearTicks;
  }

  /** Restores the player after the player buys a continue. */
  continueRun(): void {
    if (this.credits <= 0) return;
    this.credits--;
    this.lives = START_LIVES;
    this.score = 0;
    this.powsRescued = 0;
    this.phase = this.boss && !this.boss.dead ? 'boss' : 'playing';
    const x = this.camera.x + RESPAWN_OFFSET;
    const y = this.level.groundBelow(x, 0);
    this.player.respawn(x, Number.isFinite(y) ? y : 180);
    this.player.giveGrenades(10);
    sfx.startMusic();
  }

  // ------------------------------------------------------------------- draw

  draw(ctx: CanvasRenderingContext2D): void {
    drawSky(ctx);
    drawParallax(ctx, this.camera);
    drawTerrain(ctx, this.camera, this.level);
    this.fx.drawBehind(ctx, this.camera);

    const drawables: Entity[] = [
      ...this.actors,
      ...this.items,
      ...this.grenades,
      ...this.playerShots,
      ...this.enemyShots,
    ].filter((e) => !e.dead && Math.abs(e.x - this.camera.x - SCREEN_W / 2) < SCREEN_W);

    drawables.sort((a, b) => a.depth - b.depth || a.y - b.y);
    for (const d of drawables) d.draw(ctx, this.camera, this);

    this.fx.drawFront(ctx, this.camera);
    drawForeground(ctx, this.camera);
  }
}

/** Maps a level's spawn record onto a concrete actor. */
export function makeActor(def: SpawnDef): Entity | null {
  const facing = (def.facing ?? -1) as -1 | 1;
  switch (def.kind) {
    case 'soldier': return new RebelSoldier(def.x, def.y, facing);
    case 'shield': return new ShieldMan(def.x, def.y, facing);
    case 'mortar': return new MortarPit(def.x, def.y, facing);
    case 'turret': return new Turret(def.x, def.y, facing);
    case 'rival': return new Rival(def.x, def.y, facing);
    case 'tank': return new RebelTank(def.x, def.y);
    case 'slug': return new Slug(def.x, def.y);
    case 'pow': return new Pow(def.x, def.y, (def.opts?.gift as string | undefined) as never);
    case 'boss': return new IronJackal(def.x, def.y);
    default: return null;
  }
}
