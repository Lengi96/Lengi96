/**
 * A small, deliberately limited arcade palette. Every sprite in the game is
 * drawn from these entries, which keeps the mixed hand-authored and
 * procedural art looking like it came off the same board.
 */
export const PAL = {
  transparent: 'rgba(0,0,0,0)',
  black: '#0b0b10',
  outline: '#141019',
  white: '#f4f4ef',
  bone: '#d8cfae',

  skin: '#e8b088',
  skinDark: '#b47454',

  hero: '#4f8f3a',
  heroDark: '#2f5c22',
  heroLight: '#7dbd55',
  bandana: '#c8382e',
  bandanaDark: '#8a221c',

  foe: '#8b6d4a',
  foeDark: '#5a452e',
  foeLight: '#b8946a',
  foeAccent: '#5d3b6d',

  steel: '#9aa3ad',
  steelDark: '#5b626e',
  steelLight: '#c9d1d9',
  rust: '#8a5a35',

  sand: '#d9b878',
  sandDark: '#a8894f',
  sandDeep: '#6f5a33',
  brick: '#9c5f46',
  brickDark: '#6b3d2c',

  sky: '#5aa2c8',
  skyDeep: '#2f6d94',
  dusk: '#c98a55',

  fire: '#ffcf4a',
  fireMid: '#f5843c',
  fireDeep: '#c33a22',
  smoke: '#6b6b75',
  smokeLight: '#a6a6b0',

  bossHull: '#4d5a44',
  bossHullLight: '#74836a',
  bossHullDark: '#2c352a',
  bossTrim: '#b5442f',

  laser: '#7ee8ff',
  plasma: '#c98bff',
  hud: '#ffd75e',
  hudDim: '#8a7434',
  danger: '#e8443a',
} as const;

export type PaletteKey = keyof typeof PAL;
