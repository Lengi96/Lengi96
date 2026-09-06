/**
 * Headless verification run.
 *
 * Serves the production build, opens it in Chromium and drives the game
 * through the test hook exposed on `window.__slug`. Two runs are performed:
 *
 *   1. a normal autopilot run, which proves the opening of the mission plays
 *      without errors under ordinary rules, and
 *   2. an invulnerable run, which plays mission 1 through to the boss kill and
 *      the score tally so the whole mission is exercised end to end.
 *
 * Screenshots are written to tools/shots/.
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { mkdir } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DIST = join(ROOT, 'dist');
const SHOTS = join(ROOT, 'tools', 'shots');
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
};

function serve() {
  const server = createServer(async (req, res) => {
    const path = (req.url ?? '/').split('?')[0];
    const file = join(DIST, normalize(path === '/' ? '/index.html' : path));
    try {
      const body = await readFile(file);
      res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
      res.end(body);
    } catch {
      res.writeHead(404).end('not found');
    }
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}

/** The autopilot, injected into the page. Returns the state after the run. */
const AUTOPLAY = `(opts) => {
  const s = window.__slug;
  const w = () => s.game.world;
  let lastX = -1, stuck = 0, ticks = 0, jumpHold = 0, jumpCool = 0;
  const log = [];

  const press = (buttons) => { s.hold(buttons); s.step(1); ticks++; };

  // Picks something to walk toward: whatever is currently holding the screen
  // (a gate wave or the boss), else simply "keep going right".
  const target = () => {
    const world = w();
    const live = world.actors.filter((a) => !a.dead);
    const gated = live.filter((a) => a.gate !== undefined);
    if (gated.length) {
      return gated.reduce((best, a) =>
        Math.abs(a.x - world.player.x) < Math.abs(best.x - world.player.x) ? a : best);
    }
    if (world.boss && !world.boss.dead) return world.boss;
    return null;
  };

  let sawSlug = false;
  const reachedStop = () => {
    const world = w();
    if (world.player.ridingSlug && !sawSlug) { sawSlug = true; log.push('MOUNTED SLUG at tick ' + ticks); }
    if (opts.stopCam !== undefined && world.camera.x >= opts.stopCam) return true;
    if (opts.stopOnSlug && world.player.ridingSlug) return true;
    if (opts.stopOnBoss && world.boss && !world.boss.dead && world.boss.hp < world.boss.maxHp * 0.9) return true;
    return false;
  };

  while (ticks < opts.maxTicks) {
    const st = s.state();
    if (st.scene === 'playing' && reachedStop()) break;

    if (st.scene === 'title' || st.scene === 'briefing') { press(['start']); continue; }
    if (st.scene === 'continue') { press(['start']); continue; }
    if (st.scene === 'gameover') { log.push('GAME OVER at tick ' + ticks); break; }
    if (st.scene === 'tally') {
      log.push('TALLY reached at tick ' + ticks);
      if (opts.stopOnTally) break;
      for (let i = 0; i < 900 && s.state().scene === 'tally'; i++) press([]);
      break;
    }

    if (opts.invulnerable) {
      w().player.iframes = 999;
      w().lives = 9;
    }

    const buttons = ['shoot'];
    const t = target();
    const px = w().player.x;
    if (t && Math.abs(t.x - px) > 14) buttons.push(t.x < px ? 'left' : 'right');
    else if (!t) buttons.push('right');
    // Aim upward at anything perched above the street.
    if (t && t.y < w().player.y - 26) buttons.push('up');

    if (st.playerX === lastX) stuck++; else stuck = 0;
    lastX = st.playerX;
    // Look ahead for a missing floor, and notice when progress has stalled.
    const dir = buttons.includes('left') ? -1 : 1;
    const gapAhead = !Number.isFinite(w().level.groundBelow(px + dir * 22, w().player.y - 6));
    if (jumpCool > 0) jumpCool--;
    if (jumpHold === 0 && jumpCool === 0 && (stuck > 8 || (gapAhead && w().player.onGround))) {
      // Commit to a full-length jump: the game shortens a tapped one on purpose,
      // so a one-tick press would never clear a ledge.
      jumpHold = 16;
      jumpCool = 26;
      stuck = 0;
    }
    // One long hold is a single press, so the tank fires its jets instead of
    // reading a double tap and ejecting the driver.
    if (jumpHold > 0) { jumpHold--; buttons.push('jump'); }
    if (ticks % 40 === 0) buttons.push('grenade');

    if (ticks % 1200 === 0) {
      const holding = w().actors
        .filter((a) => !a.dead && a.gate !== undefined)
        .map((a) => a.constructor.name + '@' + Math.round(a.x) + '/g' + a.gate);
      log.push('t' + ticks + ' camX=' + st.camX + ' hp=' + st.bossHp + ' holding=[' + holding.join(',') + ']');
    }

    press(buttons);
  }

  return { ticks, state: s.state(), log };
}`;

async function main() {
  await mkdir(SHOTS, { recursive: true });
  const { server, port } = await serve();
  const browser = await chromium.launch({ executablePath: CHROME });
  const page = await browser.newPage({ viewport: { width: 1280, height: 960 } });

  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push('console: ' + m.text());
  });

  const shot = async (name) => {
    await page.evaluate(() => window.__slug.render());
    await page.screenshot({ path: join(SHOTS, name) });
  };
  const play = (opts) => page.evaluate(`(${AUTOPLAY})(${JSON.stringify(opts)})`);

  await page.goto(`http://127.0.0.1:${port}/`);
  await page.waitForFunction('window.__slug !== undefined');
  // Take control of the clock so the run is deterministic and fast.
  await page.evaluate(() => window.__slug.loop.stop());
  await shot('01-title.png');

  // --- Run 1: ordinary rules. How far does a blind bot get on two lives? ---
  const run1 = await play({ maxTicks: 3000, invulnerable: false });
  await shot('02-fair-run.png');
  console.log('run 1 (fair rules):', JSON.stringify(run1.state));
  console.log('run 1 log:', run1.log.join(' | ') || '(no events)');

  // --- Run 2: the whole mission, captured stage by stage. ---
  await page.reload();
  await page.waitForFunction('window.__slug !== undefined');
  await page.evaluate(() => window.__slug.loop.stop());

  await play({ maxTicks: 4000, invulnerable: true, stopCam: 560 });
  await shot('03-firefight.png');

  await play({ maxTicks: 8000, invulnerable: true, stopCam: 2050 });
  await shot('04-rival.png');

  await play({ maxTicks: 8000, invulnerable: true, stopOnSlug: true });
  await shot('05-slug.png');

  await play({ maxTicks: 8000, invulnerable: true, stopOnBoss: true });
  await shot('06-boss.png');

  const run2 = await play({ maxTicks: 26000, invulnerable: true, stopOnTally: true });
  await shot('07-mission-clear.png');
  // Let the bonus lines count up, then capture the finished tally.
  await page.evaluate(() => window.__slug.step(230));
  await shot('08-tally.png');

  console.log('run 2 (invulnerable, full mission):', run2.ticks, 'ticks', JSON.stringify(run2.state));
  console.log('run 2 log:', run2.log.join(' | ') || '(no events)');

  await browser.close();
  server.close();

  const failures = [];
  if (errors.length) failures.push('page errors: ' + errors.join('; '));
  if (run1.state.camX < 400) failures.push('run 1 barely scrolled: camX=' + run1.state.camX);
  if (run2.state.scene !== 'tally' && run2.state.phase !== 'clear') {
    failures.push('run 2 never cleared the mission: ' + JSON.stringify(run2.state));
  }

  if (failures.length) {
    console.error('\nFAILED:\n- ' + failures.join('\n- '));
    process.exit(1);
  }
  console.log('\nOK: mission 1 plays from title to tally, no page errors.');
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
