/**
 * Fixed-timestep game loop. The simulation always advances in whole 1/60 s
 * steps so jump arcs, i-frames and fire rates are frame-exact regardless of
 * the display refresh rate; rendering happens once per animation frame.
 */
export const TICK_HZ = 60;
export const TICK_MS = 1000 / TICK_HZ;

/** Never simulate more than this many ticks per frame (tab-switch guard). */
const MAX_CATCHUP_TICKS = 5;

export interface Loop {
  start(): void;
  stop(): void;
  /** Ticks simulated since start. Useful for animation timers and tests. */
  readonly ticks: number;
}

export function createLoop(update: () => void, render: () => void): Loop {
  let raf = 0;
  let running = false;
  let acc = 0;
  let last = 0;
  let ticks = 0;

  const frame = (now: number) => {
    if (!running) return;
    raf = requestAnimationFrame(frame);
    acc += Math.min(now - last, 250);
    last = now;

    let steps = 0;
    while (acc >= TICK_MS && steps < MAX_CATCHUP_TICKS) {
      acc -= TICK_MS;
      steps++;
      ticks++;
      update();
    }
    if (steps === MAX_CATCHUP_TICKS) acc = 0;
    render();
  };

  return {
    start() {
      if (running) return;
      running = true;
      last = performance.now();
      acc = 0;
      raf = requestAnimationFrame(frame);
    },
    stop() {
      running = false;
      cancelAnimationFrame(raf);
    },
    get ticks() {
      return ticks;
    },
  };
}
