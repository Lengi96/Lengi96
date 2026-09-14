import { drawText } from '../render/text';
import { PAL } from '../render/palette';
import { px, disc } from '../render/art';
import { SCREEN_W, SCREEN_H } from '../render/screen';
import { WEAPONS } from './weapons';
import type { World } from './world';
import { BOSS_NAME } from './boss/mission01';

const HI_KEY = 'desert-slug.hiscore.v1';

export function loadHiScore(): number {
  try {
    return Number(localStorage.getItem(HI_KEY) ?? 0) || 0;
  } catch {
    return 0;
  }
}

export function saveHiScore(score: number): void {
  try {
    if (score > loadHiScore()) localStorage.setItem(HI_KEY, String(score));
  } catch {
    // Storage unavailable; the score simply is not kept between sessions.
  }
}

/** The persistent in-game overlay: score, ammunition, lives, boss health. */
export function drawHud(ctx: CanvasRenderingContext2D, world: World, hiScore: number): void {
  // Thin darkened bands top and bottom so the readouts stay legible over any
  // amount of scenery and explosion.
  px(ctx, 0, 0, SCREEN_W, 22, 'rgba(8,8,14,0.45)');
  px(ctx, 0, SCREEN_H - 26, SCREEN_W, 26, 'rgba(8,8,14,0.45)');

  drawText(ctx, '1P', 6, 5, { color: PAL.danger, shadow: PAL.black });
  drawText(ctx, String(world.score).padStart(7, '0'), 6, 14, { color: PAL.white, shadow: PAL.black });

  drawText(ctx, 'HI', SCREEN_W - 6, 5, { color: PAL.hud, align: 'right', shadow: PAL.black });
  drawText(ctx, String(Math.max(hiScore, world.score)).padStart(7, '0'), SCREEN_W - 6, 14, {
    color: PAL.white, align: 'right', shadow: PAL.black,
  });

  drawWeaponBox(ctx, world);
  drawGrenades(ctx, world);
  drawLives(ctx, world);
  if (world.boss && !world.boss.dead) drawBossBar(ctx, world);
}

function drawWeaponBox(ctx: CanvasRenderingContext2D, world: World): void {
  const def = WEAPONS[world.player.weapon];
  const x = 6;
  const y = SCREEN_H - 19;

  px(ctx, x, y, 14, 14, PAL.black);
  px(ctx, x + 1, y + 1, 12, 12, PAL.hudDim);
  const letterColor = def.big
    ? (Math.floor(world.ticks / 6) % 2 === 0 ? PAL.danger : PAL.white)
    : PAL.white;
  drawText(ctx, def.letter, x + 7, y + 4, { color: letterColor, align: 'center' });

  const ammo = Number.isFinite(world.player.ammo)
    ? String(Math.max(0, Math.floor(world.player.ammo))).padStart(3, '0')
    : '---';
  drawText(ctx, ammo, x + 18, y + 4, { color: PAL.hud, shadow: PAL.black });
  drawText(ctx, def.name, x, y - 9, { color: PAL.hudDim, shadow: PAL.black });
}

function drawGrenades(ctx: CanvasRenderingContext2D, world: World): void {
  const x = 78;
  const y = SCREEN_H - 19;
  disc(ctx, x + 5, y + 8, 4, PAL.heroDark);
  disc(ctx, x + 5, y + 8, 3, PAL.hero);
  px(ctx, x + 4, y + 2, 2, 3, PAL.steel);
  drawText(ctx, String(world.player.grenades).padStart(2, '0'), x + 13, y + 4, {
    color: PAL.hud, shadow: PAL.black,
  });
}

function drawLives(ctx: CanvasRenderingContext2D, world: World): void {
  const y = SCREEN_H - 19;
  drawText(ctx, 'LIFE', SCREEN_W - 64, y, { color: PAL.hudDim, shadow: PAL.black });
  for (let i = 0; i < Math.min(world.lives, 5); i++) {
    const x = SCREEN_W - 36 + i * 7;
    px(ctx, x, y - 1, 5, 6, PAL.outline);
    px(ctx, x + 1, y, 3, 4, PAL.skin);
    px(ctx, x, y - 1, 5, 2, PAL.bandana);
  }
  drawText(ctx, `CREDIT ${world.credits}`, SCREEN_W - 6, SCREEN_H - 9, {
    color: PAL.hudDim, align: 'right', shadow: PAL.black,
  });
}

function drawBossBar(ctx: CanvasRenderingContext2D, world: World): void {
  const boss = world.boss;
  if (!boss) return;
  const w = 180;
  const x = Math.round((SCREEN_W - w) / 2);
  const y = 26;
  drawText(ctx, BOSS_NAME, SCREEN_W / 2, y - 10, {
    color: PAL.danger, align: 'center', shadow: PAL.black,
  });
  px(ctx, x - 1, y - 1, w + 2, 7, PAL.black);
  px(ctx, x, y, w, 5, PAL.hudDim);
  const fill = Math.max(0, Math.round((boss.hp / boss.maxHp) * w));
  px(ctx, x, y, fill, 5, boss.hp / boss.maxHp < 0.34 ? PAL.danger : PAL.fire);
  px(ctx, x, y, fill, 1, PAL.white);
}

/** Big centred banner used for the mission title and the clear message. */
export function drawBanner(
  ctx: CanvasRenderingContext2D,
  title: string,
  subtitle: string,
  alpha = 1,
): void {
  const cy = SCREEN_H / 2 - 20;
  ctx.save();
  ctx.globalAlpha = alpha;
  px(ctx, 0, cy - 12, SCREEN_W, 34, 'rgba(8,8,14,0.72)');
  px(ctx, 0, cy - 12, SCREEN_W, 1, PAL.hud);
  px(ctx, 0, cy + 21, SCREEN_W, 1, PAL.hud);
  drawText(ctx, title, SCREEN_W / 2, cy - 6, {
    color: PAL.hud, align: 'center', scale: 2, shadow: PAL.black,
  });
  drawText(ctx, subtitle, SCREEN_W / 2, cy + 12, {
    color: PAL.white, align: 'center', shadow: PAL.black,
  });
  ctx.restore();
}
