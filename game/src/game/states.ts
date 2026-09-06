import { World } from './world';
import { MISSION_01 } from '../data/mission01';
import { drawHud, drawBanner, loadHiScore, saveHiScore } from './hud';
import { SCREEN_W, SCREEN_H } from '../render/screen';
import { drawText } from '../render/text';
import { PAL } from '../render/palette';
import { px, disc, limb } from '../render/art';
import { drawSky, drawParallax } from '../render/background';
import { drawActor, HERO_SKIN } from '../render/actor';
import { input } from '../core/input';
import { sfx } from '../core/audio';
import { TICK_HZ } from '../core/loop';

export type Scene = 'title' | 'briefing' | 'playing' | 'paused' | 'continue' | 'gameover' | 'tally';

const BRIEFING_TICKS = 150;
const CONTINUE_SECONDS = 10;
const POW_BONUS = 10_000;
const SLUG_BONUS = 20_000;

/**
 * Top-level scene machine: title screen, mission briefing, play, the ten
 * second continue countdown and the end-of-mission tally. Everything the
 * player sees outside the world itself lives here.
 */
export class Game {
  scene: Scene = 'title';
  world: World;
  hiScore = loadHiScore();

  private sceneTicks = 0;
  private continueTicks = 0;
  private tallyStep = 0;
  private tallyTimer = 0;
  private tallyScore = 0;

  constructor() {
    this.world = new World(structuredClone(MISSION_01));
  }

  private go(scene: Scene): void {
    this.scene = scene;
    this.sceneTicks = 0;
  }

  private startRun(): void {
    this.world = new World(structuredClone(MISSION_01));
    this.go('briefing');
  }

  update(): void {
    this.sceneTicks++;
    if (input.pressed('start') || input.pressed('shoot')) sfx.resume();
    if (input.pressed('mute')) sfx.toggleMute();

    switch (this.scene) {
      case 'title': this.updateTitle(); break;
      case 'briefing': this.updateBriefing(); break;
      case 'playing': this.updatePlaying(); break;
      case 'paused': this.updatePaused(); break;
      case 'continue': this.updateContinue(); break;
      case 'gameover': this.updateGameOver(); break;
      case 'tally': this.updateTally(); break;
    }
  }

  private updateTitle(): void {
    if (input.pressed('start') || input.pressed('shoot')) {
      sfx.tone(660, 0.1, 'square', 0.3, 990);
      this.startRun();
    }
  }

  private updateBriefing(): void {
    if (this.sceneTicks === 1) sfx.startMusic();
    if (this.sceneTicks >= BRIEFING_TICKS || input.pressed('start')) this.go('playing');
  }

  private updatePlaying(): void {
    if (input.pressed('pause')) {
      this.go('paused');
      return;
    }
    this.world.update();

    if (this.world.phase === 'gameover') {
      this.continueTicks = CONTINUE_SECONDS * TICK_HZ;
      this.go(this.world.credits > 0 ? 'continue' : 'gameover');
      return;
    }
    // Let the boss's death throes play out before the tally.
    if (this.world.phase === 'clear' && this.world.clearAge > 90) {
      this.beginTally();
    }
  }

  private updatePaused(): void {
    if (input.pressed('pause') || input.pressed('start')) this.go('playing');
  }

  private updateContinue(): void {
    this.continueTicks--;
    if (input.pressed('start') || input.pressed('shoot')) {
      this.world.continueRun();
      this.go('playing');
      return;
    }
    if (this.continueTicks <= 0) this.go('gameover');
  }

  private updateGameOver(): void {
    if (this.sceneTicks === 1) {
      saveHiScore(this.world.score);
      this.hiScore = loadHiScore();
      sfx.stopMusic();
    }
    if (this.sceneTicks > 90 && (input.pressed('start') || input.pressed('shoot'))) {
      this.go('title');
    }
  }

  private beginTally(): void {
    this.tallyStep = 0;
    this.tallyTimer = 0;
    this.tallyScore = this.world.score;
    sfx.stopMusic();
    this.go('tally');
  }

  private updateTally(): void {
    this.tallyTimer++;
    const r = this.world.result;

    // Each bonus line counts up in turn, arcade-style.
    if (this.tallyStep === 0 && this.tallyTimer > 60) {
      this.tallyStep = 1;
      this.tallyTimer = 0;
    } else if (this.tallyStep === 1) {
      const target = this.world.score + r.powsRescued * POW_BONUS;
      if (this.tallyScore < target) {
        this.tallyScore = Math.min(target, this.tallyScore + 500);
        if (this.tallyTimer % 3 === 0) sfx.tone(1200, 0.03, 'square', 0.12);
      } else if (this.tallyTimer > 40) {
        this.tallyStep = 2;
        this.tallyTimer = 0;
      }
    } else if (this.tallyStep === 2) {
      const target = this.world.score + r.powsRescued * POW_BONUS + (r.bossKilledInSlug ? SLUG_BONUS : 0);
      if (this.tallyScore < target) {
        this.tallyScore = Math.min(target, this.tallyScore + 800);
      } else if (this.tallyTimer > 60) {
        this.tallyStep = 3;
        this.tallyTimer = 0;
        saveHiScore(this.tallyScore);
        this.hiScore = loadHiScore();
      }
    } else if (this.tallyStep === 3 && (this.tallyTimer > 90 || input.pressed('start'))) {
      this.go('title');
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    switch (this.scene) {
      case 'title':
        this.drawTitle(ctx);
        break;
      case 'briefing':
        this.world.draw(ctx);
        drawHud(ctx, this.world, this.hiScore);
        drawBanner(ctx, this.world.level.data.name, this.world.level.data.subtitle);
        break;
      case 'playing':
        this.world.draw(ctx);
        drawHud(ctx, this.world, this.hiScore);
        break;
      case 'paused':
        this.world.draw(ctx);
        drawHud(ctx, this.world, this.hiScore);
        this.drawPaused(ctx);
        break;
      case 'continue':
        this.world.draw(ctx);
        drawHud(ctx, this.world, this.hiScore);
        this.drawContinue(ctx);
        break;
      case 'gameover':
        this.world.draw(ctx);
        drawHud(ctx, this.world, this.hiScore);
        this.drawGameOver(ctx);
        break;
      case 'tally':
        this.world.draw(ctx);
        this.drawTally(ctx);
        break;
    }
  }

  private drawTitle(ctx: CanvasRenderingContext2D): void {
    drawSky(ctx);
    drawParallax(ctx, this.world.camera);
    px(ctx, 0, 176, SCREEN_W, SCREEN_H - 176, PAL.sandDeep);
    px(ctx, 0, 176, SCREEN_W, 4, PAL.sand);

    // The hero strikes a pose on the title card.
    drawActor(ctx, 40, 176, HERO_SKIN, {
      facing: 1, aim: -0.4, legPhase: 0, moving: false,
      crouch: false, airborne: false, melee: 0, gun: 'heavy',
    });

    const t = this.sceneTicks;
    drawText(ctx, 'DESERT', SCREEN_W / 2, 30, {
      color: PAL.hud, align: 'center', scale: 4, tracking: 1, shadow: PAL.brickDark,
    });
    drawText(ctx, 'SLUG', SCREEN_W / 2, 64, {
      color: PAL.danger, align: 'center', scale: 4, tracking: 1, shadow: PAL.brickDark,
    });
    drawText(ctx, 'SUPER VEHICLE ASSAULT', SCREEN_W / 2, 100, {
      color: PAL.white, align: 'center', shadow: PAL.black,
    });

    if (Math.floor(t / 30) % 2 === 0) {
      drawText(ctx, 'PRESS START', SCREEN_W / 2, 126, {
        color: PAL.white, align: 'center', scale: 2, shadow: PAL.black,
      });
    }
    drawText(ctx, 'WASD MOVE   CLICK FIRE   X JUMP   G BOMB', SCREEN_W / 2, 148, {
      color: PAL.hudDim, align: 'center', shadow: PAL.black,
    });
    drawText(ctx, `HI ${String(this.hiScore).padStart(7, '0')}`, SCREEN_W / 2, 196, {
      color: PAL.hud, align: 'center', shadow: PAL.black,
    });
    drawText(ctx, 'AN ORIGINAL RUN AND GUN TRIBUTE', SCREEN_W / 2, 210, {
      color: PAL.hudDim, align: 'center',
    });
  }

  private drawPaused(ctx: CanvasRenderingContext2D): void {
    px(ctx, 0, 0, SCREEN_W, SCREEN_H, 'rgba(6,6,12,0.6)');
    drawText(ctx, 'PAUSE', SCREEN_W / 2, SCREEN_H / 2 - 16, {
      color: PAL.hud, align: 'center', scale: 3, shadow: PAL.black,
    });
    drawText(ctx, 'P TO RESUME', SCREEN_W / 2, SCREEN_H / 2 + 12, {
      color: PAL.white, align: 'center', shadow: PAL.black,
    });
  }

  private drawContinue(ctx: CanvasRenderingContext2D): void {
    px(ctx, 0, 0, SCREEN_W, SCREEN_H, 'rgba(6,6,12,0.62)');
    const seconds = Math.max(0, Math.ceil(this.continueTicks / TICK_HZ));
    drawText(ctx, 'CONTINUE?', SCREEN_W / 2, 62, {
      color: PAL.hud, align: 'center', scale: 3, shadow: PAL.black,
    });
    // The countdown flashes red in the last three seconds.
    const color = seconds <= 3 && Math.floor(this.sceneTicks / 8) % 2 === 0 ? PAL.danger : PAL.white;
    drawText(ctx, String(seconds), SCREEN_W / 2, 100, {
      color, align: 'center', scale: 6, shadow: PAL.black,
    });
    drawText(ctx, 'PRESS START', SCREEN_W / 2, 160, {
      color: PAL.white, align: 'center', scale: 2, shadow: PAL.black,
    });
    drawText(ctx, `CREDITS ${this.world.credits}`, SCREEN_W / 2, 182, {
      color: PAL.hudDim, align: 'center',
    });
  }

  private drawGameOver(ctx: CanvasRenderingContext2D): void {
    px(ctx, 0, 0, SCREEN_W, SCREEN_H, 'rgba(6,6,12,0.72)');
    drawText(ctx, 'GAME OVER', SCREEN_W / 2, SCREEN_H / 2 - 20, {
      color: PAL.danger, align: 'center', scale: 3, shadow: PAL.black,
    });
    drawText(ctx, `SCORE ${String(this.world.score).padStart(7, '0')}`, SCREEN_W / 2, SCREEN_H / 2 + 12, {
      color: PAL.white, align: 'center', shadow: PAL.black,
    });
    if (this.sceneTicks > 90 && Math.floor(this.sceneTicks / 30) % 2 === 0) {
      drawText(ctx, 'PRESS START', SCREEN_W / 2, SCREEN_H / 2 + 34, {
        color: PAL.hud, align: 'center', shadow: PAL.black,
      });
    }
  }

  private drawTally(ctx: CanvasRenderingContext2D): void {
    px(ctx, 0, 0, SCREEN_W, SCREEN_H, 'rgba(6,6,12,0.78)');
    const r = this.world.result;

    drawText(ctx, 'MISSION COMPLETE', SCREEN_W / 2, 30, {
      color: PAL.hud, align: 'center', scale: 2, shadow: PAL.black,
    });

    // A little victory salute under the banner.
    drawActor(ctx, SCREEN_W / 2, 92, HERO_SKIN, {
      facing: 1, aim: -1.5, legPhase: 0, moving: false,
      crouch: false, airborne: false, melee: 0, gun: 'none',
    });

    let y = 112;
    const line = (label: string, value: string, show: boolean, color: string = PAL.white) => {
      if (!show) return;
      drawText(ctx, label, 52, y, { color: PAL.hudDim, shadow: PAL.black });
      drawText(ctx, value, SCREEN_W - 52, y, { color, align: 'right', shadow: PAL.black });
      y += 12;
    };

    line('TIME', formatTime(r.ticks), true);
    line('POW RESCUED', `${r.powsRescued} X 10000`, this.tallyStep >= 1, PAL.hud);
    line('SLUG BONUS', r.bossKilledInSlug ? '20000' : '0', this.tallyStep >= 2, PAL.hud);

    px(ctx, 52, y + 2, SCREEN_W - 104, 1, PAL.hudDim);
    drawText(ctx, 'TOTAL', 52, y + 8, { color: PAL.white, shadow: PAL.black });
    drawText(ctx, String(this.tallyScore).padStart(7, '0'), SCREEN_W - 52, y + 8, {
      color: PAL.hud, align: 'right', shadow: PAL.black,
    });

    if (this.tallyStep >= 3) {
      // Mission 1 is where this build ends; say so rather than dumping the
      // player back to the title with no explanation.
      drawText(ctx, 'NEXT MISSION: COMING SOON', SCREEN_W / 2, y + 30, {
        color: PAL.white, align: 'center', shadow: PAL.black,
      });
      disc(ctx, 30, 200, 6, PAL.fireMid);
      limb(ctx, 30, 200, 44, 194, 2, PAL.fire);
    }
  }
}

export function formatTime(ticks: number): string {
  const total = Math.floor(ticks / TICK_HZ);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
