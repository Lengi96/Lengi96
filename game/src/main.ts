import { Screen } from './render/screen';
import { createLoop } from './core/loop';
import { input, type Button } from './core/input';
import { sfx } from './core/audio';
import { Game } from './game/states';

const canvas = document.getElementById('screen');
if (!(canvas instanceof HTMLCanvasElement)) {
  throw new Error('#screen canvas not found');
}

const screen = new Screen(canvas);
const game = new Game();
// Mouse presses are read on the canvas so a click on the page chrome around
// it does not fire the weapon; releases are watched on the window.
input.attach(window, canvas);

// Audio can only start from a user gesture, so arm it on the first input.
const arm = () => sfx.resume();
window.addEventListener('keydown', arm, { once: true });
window.addEventListener('pointerdown', arm, { once: true });
canvas.addEventListener('pointerdown', arm);

const loop = createLoop(
  () => {
    input.beginTick();
    game.update();
  },
  () => {
    game.draw(screen.ctx);
    screen.present();
  },
);
loop.start();

/**
 * Test hook. The headless verification run drives the game through this
 * instead of synthesising key events, so a full mission can be played in a
 * few seconds without a real browser window.
 */
declare global {
  interface Window {
    __slug?: {
      game: Game;
      loop: typeof loop;
      hold(buttons: Button[]): void;
      release(): void;
      step(ticks: number): void;
      render(): void;
      state(): Record<string, unknown>;
    };
  }
}

window.__slug = {
  game,
  loop,
  hold(buttons) {
    input.setScripted(new Set(buttons));
  },
  release() {
    input.setScripted(null);
  },
  step(ticks) {
    for (let i = 0; i < ticks; i++) {
      input.beginTick();
      game.update();
    }
  },
  render() {
    game.draw(screen.ctx);
    screen.present();
  },
  state() {
    const w = game.world;
    return {
      scene: game.scene,
      phase: w.phase,
      score: w.score,
      lives: w.lives,
      pows: w.powsRescued,
      camX: Math.round(w.camera.x),
      playerX: Math.round(w.player.x),
      playerY: Math.round(w.player.y),
      weapon: w.player.weapon,
      ammo: Number.isFinite(w.player.ammo) ? w.player.ammo : 'INF',
      grenades: w.player.grenades,
      actors: w.actors.length,
      shots: w.playerShots.length,
      melee: w.player.meleeing,
      bossHp: w.boss?.hp ?? null,
      riding: w.player.ridingSlug,
    };
  },
};
