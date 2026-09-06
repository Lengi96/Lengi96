import type { LevelData } from '../game/level';

const GROUND_Y = 190;
const WIDTH = 4240;

/**
 * MISSION 1 - "DUSTY BAZAAR"
 *
 * A desert town at dawn. The mission opens with loose infantry, tightens into
 * two held fights behind sandbags, hands the player a tank before the last
 * stretch, and finishes against the Iron Jackal in the market square.
 *
 * `at` on a spawn is the camera x that triggers it; `gate` ties the spawn to a
 * combat gate, and the camera will not scroll past that gate until every
 * enemy tagged with it is gone.
 */
export const MISSION_01: LevelData = {
  name: 'MISSION 1',
  subtitle: 'DUSTY BAZAAR',
  width: WIDTH,
  groundY: GROUND_Y,
  playerStart: { x: 40, y: GROUND_Y },
  bossCamX: WIDTH - 320,

  solids: [
    // Main street, broken by two gaps the player has to jump.
    { x: -60, y: GROUND_Y, w: 960, h: 40, kind: 'ground' },
    { x: 950, y: GROUND_Y, w: 700, h: 40, kind: 'ground' },
    { x: 1700, y: GROUND_Y, w: 900, h: 40, kind: 'ground' },
    // Raised terrace over the market.
    { x: 2600, y: GROUND_Y - 22, w: 500, h: 62, kind: 'ground' },
    { x: 3100, y: GROUND_Y, w: 1200, h: 40, kind: 'ground' },

    // Low walls to duck behind.
    { x: 660, y: GROUND_Y - 18, w: 26, h: 18, kind: 'ground' },
    { x: 1490, y: GROUND_Y - 22, w: 26, h: 22, kind: 'ground' },
    { x: 2340, y: GROUND_Y - 18, w: 26, h: 18, kind: 'ground' },
    { x: 3420, y: GROUND_Y - 20, w: 26, h: 20, kind: 'ground' },

    // Rooftops and the planks over the gaps: jump up through, stand on top.
    { x: 360, y: 140, w: 96, h: 6, kind: 'platform' },
    { x: 880, y: 168, w: 92, h: 6, kind: 'platform' },
    { x: 1180, y: 132, w: 110, h: 6, kind: 'platform' },
    { x: 1630, y: 166, w: 96, h: 6, kind: 'platform' },
    { x: 2140, y: 148, w: 110, h: 6, kind: 'platform' },
    { x: 2820, y: 126, w: 120, h: 6, kind: 'platform' },
    { x: 3520, y: 142, w: 110, h: 6, kind: 'platform' },
  ],

  props: [
    { x: 150, y: GROUND_Y, kind: 'palm' },
    { x: 230, y: GROUND_Y, kind: 'barrel', hp: 4, drop: 'grenade' },
    { x: 300, y: GROUND_Y, kind: 'crate', hp: 4 },
    { x: 420, y: GROUND_Y, kind: 'sandbag' },
    { x: 520, y: GROUND_Y, kind: 'lamp' },
    { x: 610, y: GROUND_Y, kind: 'sign' },
    { x: 700, y: GROUND_Y, kind: 'crate', hp: 4, drop: 'shotgun' },
    { x: 840, y: GROUND_Y, kind: 'wreck' },
    { x: 1020, y: GROUND_Y, kind: 'palm' },
    { x: 1100, y: GROUND_Y, kind: 'barrel', hp: 4 },
    { x: 1120, y: GROUND_Y, kind: 'barrel', hp: 4 },
    { x: 1290, y: GROUND_Y, kind: 'sandbag' },
    { x: 1420, y: GROUND_Y, kind: 'crate', hp: 4, drop: 'grenade' },
    { x: 1590, y: GROUND_Y, kind: 'lamp' },
    { x: 1760, y: GROUND_Y, kind: 'wreck' },
    { x: 1900, y: GROUND_Y, kind: 'barrel', hp: 4, drop: 'flame' },
    { x: 2050, y: GROUND_Y, kind: 'palm' },
    { x: 2200, y: GROUND_Y, kind: 'sandbag' },
    { x: 2430, y: GROUND_Y, kind: 'sign' },
    { x: 2520, y: GROUND_Y, kind: 'crate', hp: 4 },
    { x: 2700, y: GROUND_Y - 22, kind: 'palm' },
    { x: 2900, y: GROUND_Y - 22, kind: 'lamp' },
    { x: 3000, y: GROUND_Y - 22, kind: 'barrel', hp: 4, drop: 'chaser' },
    { x: 3200, y: GROUND_Y, kind: 'wreck' },
    { x: 3320, y: GROUND_Y, kind: 'sandbag' },
    { x: 3600, y: GROUND_Y, kind: 'palm' },
    { x: 3700, y: GROUND_Y, kind: 'barrel', hp: 4, drop: 'grenade' },
    { x: 3980, y: GROUND_Y, kind: 'sign' },
  ],

  items: [
    { x: 400, y: 134, kind: 'hmg' },
    { x: 960, y: GROUND_Y - 30, kind: 'grenade' },
    { x: 1230, y: 126, kind: 'rocket' },
    { x: 1810, y: GROUND_Y - 30, kind: 'grenade' },
    { x: 2190, y: 142, kind: 'laser' },
    { x: 2870, y: 120, kind: 'shotgunBig' },
    { x: 3560, y: 136, kind: 'sgrenade' },
    { x: 3760, y: GROUND_Y - 30, kind: 'grenade' },
  ],

  // The camera stops at each of these until the tagged wave is wiped out.
  gates: [
    { id: 1, camX: 520 },
    { id: 2, camX: 1180 },
    // Each gate is placed so its whole wave fits inside the 320px viewport
    // the camera is pinned to; otherwise the player cannot reach the last
    // enemy and the gate never opens.
    { id: 3, camX: 2000 },
    { id: 4, camX: 3060 },
  ],

  spawns: [
    // --- Opening skirmish: loose infantry, no gate. ---
    { at: 60, kind: 'soldier', x: 300, y: GROUND_Y },
    { at: 120, kind: 'soldier', x: 380, y: GROUND_Y },
    { at: 150, kind: 'pow', x: 470, y: GROUND_Y, opts: { gift: 'grenade' } },
    { at: 200, kind: 'soldier', x: 520, y: GROUND_Y },

    // --- Gate 1: a squad behind the low wall. ---
    { at: 430, kind: 'soldier', x: 760, y: GROUND_Y, gate: 1 },
    { at: 430, kind: 'soldier', x: 830, y: GROUND_Y, gate: 1 },
    { at: 460, kind: 'shield', x: 700, y: GROUND_Y, gate: 1 },
    { at: 470, kind: 'mortar', x: 812, y: GROUND_Y, gate: 1 },
    { at: 500, kind: 'soldier', x: 640, y: 134, facing: 1, gate: 1 },

    // --- Between gates: pit crossing under fire. ---
    { at: 700, kind: 'turret', x: 1080, y: GROUND_Y },
    { at: 760, kind: 'soldier', x: 1160, y: GROUND_Y },
    { at: 820, kind: 'pow', x: 1240, y: GROUND_Y },

    // --- Gate 2: rooftop crossfire. ---
    { at: 1120, kind: 'soldier', x: 1420, y: GROUND_Y, gate: 2 },
    { at: 1120, kind: 'soldier', x: 1470, y: GROUND_Y, gate: 2 },
    { at: 1130, kind: 'soldier', x: 1300, y: 126, facing: 1, gate: 2 },
    { at: 1140, kind: 'shield', x: 1380, y: GROUND_Y, gate: 2 },
    { at: 1160, kind: 'mortar', x: 1470, y: GROUND_Y, gate: 2 },
    { at: 1160, kind: 'turret', x: 1330, y: 126, gate: 2 },

    // --- Approach to the rival. ---
    { at: 1450, kind: 'soldier', x: 1780, y: GROUND_Y },
    { at: 1500, kind: 'pow', x: 1860, y: GROUND_Y, opts: { gift: 'hmg' } },
    { at: 1560, kind: 'soldier', x: 1900, y: GROUND_Y },
    { at: 1600, kind: 'shield', x: 1960, y: GROUND_Y },

    // --- Gate 3: Sergeant Ashfall with backup. ---
    { at: 1960, kind: 'rival', x: 2180, y: GROUND_Y, gate: 3 },
    { at: 1960, kind: 'soldier', x: 2100, y: GROUND_Y, gate: 3 },
    { at: 1970, kind: 'soldier', x: 2240, y: GROUND_Y, gate: 3 },
    { at: 1980, kind: 'turret', x: 2200, y: 142, gate: 3 },

    // --- Terrace climb, and the tank that is waiting for the player. ---
    { at: 2200, kind: 'soldier', x: 2540, y: GROUND_Y },
    { at: 2260, kind: 'mortar', x: 2680, y: GROUND_Y - 22 },
    { at: 2320, kind: 'pow', x: 2760, y: GROUND_Y - 22, opts: { gift: 'rocket' } },
    { at: 2400, kind: 'slug', x: 2960, y: GROUND_Y - 22 },

    // --- Gate 4: armoured push. ---
    { at: 3040, kind: 'tank', x: 3300, y: GROUND_Y, gate: 4 },
    { at: 3040, kind: 'soldier', x: 3180, y: GROUND_Y, gate: 4 },
    { at: 3050, kind: 'soldier', x: 3350, y: GROUND_Y, gate: 4 },
    { at: 3050, kind: 'shield', x: 3240, y: GROUND_Y, gate: 4 },

    // --- Final stretch into the market square. ---
    { at: 3100, kind: 'soldier', x: 3660, y: GROUND_Y },
    { at: 3140, kind: 'pow', x: 3720, y: GROUND_Y },
    { at: 3200, kind: 'soldier', x: 3800, y: GROUND_Y },
    { at: 3260, kind: 'turret', x: 3880, y: GROUND_Y },

    // --- Boss. ---
    { at: WIDTH - 340, kind: 'boss', x: WIDTH - 60, y: GROUND_Y },
  ],
};
