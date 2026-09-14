/**
 * Hand-authored 5x7 bitmap font. Authored as pixel art rather than rendered
 * from a system font so the text looks identical on every machine and needs
 * no font files.
 */
const GLYPH_W = 5;
const GLYPH_H = 7;

const FONT: Record<string, string> = {
  A: '.###.|#...#|#...#|#####|#...#|#...#|#...#',
  B: '####.|#...#|#...#|####.|#...#|#...#|####.',
  C: '.###.|#...#|#....|#....|#....|#...#|.###.',
  D: '####.|#...#|#...#|#...#|#...#|#...#|####.',
  E: '#####|#....|#....|####.|#....|#....|#####',
  F: '#####|#....|#....|####.|#....|#....|#....',
  G: '.###.|#...#|#....|#.###|#...#|#...#|.###.',
  H: '#...#|#...#|#...#|#####|#...#|#...#|#...#',
  I: '.###.|..#..|..#..|..#..|..#..|..#..|.###.',
  J: '..###|...#.|...#.|...#.|...#.|#..#.|.##..',
  K: '#...#|#..#.|#.#..|##...|#.#..|#..#.|#...#',
  L: '#....|#....|#....|#....|#....|#....|#####',
  M: '#...#|##.##|#.#.#|#...#|#...#|#...#|#...#',
  N: '#...#|##..#|#.#.#|#..##|#...#|#...#|#...#',
  O: '.###.|#...#|#...#|#...#|#...#|#...#|.###.',
  P: '####.|#...#|#...#|####.|#....|#....|#....',
  Q: '.###.|#...#|#...#|#...#|#.#.#|#..#.|.##.#',
  R: '####.|#...#|#...#|####.|#.#..|#..#.|#...#',
  S: '.####|#....|#....|.###.|....#|....#|####.',
  T: '#####|..#..|..#..|..#..|..#..|..#..|..#..',
  U: '#...#|#...#|#...#|#...#|#...#|#...#|.###.',
  V: '#...#|#...#|#...#|#...#|#...#|.#.#.|..#..',
  W: '#...#|#...#|#...#|#.#.#|#.#.#|##.##|#...#',
  X: '#...#|#...#|.#.#.|..#..|.#.#.|#...#|#...#',
  Y: '#...#|#...#|.#.#.|..#..|..#..|..#..|..#..',
  Z: '#####|....#|...#.|..#..|.#...|#....|#####',
  '0': '.###.|#...#|#..##|#.#.#|##..#|#...#|.###.',
  '1': '..#..|.##..|..#..|..#..|..#..|..#..|.###.',
  '2': '.###.|#...#|....#|...#.|..#..|.#...|#####',
  '3': '#####|...#.|..#..|...#.|....#|#...#|.###.',
  '4': '...#.|..##.|.#.#.|#..#.|#####|...#.|...#.',
  '5': '#####|#....|####.|....#|....#|#...#|.###.',
  '6': '..##.|.#...|#....|####.|#...#|#...#|.###.',
  '7': '#####|....#|...#.|..#..|.#...|.#...|.#...',
  '8': '.###.|#...#|#...#|.###.|#...#|#...#|.###.',
  '9': '.###.|#...#|#...#|.####|....#|...#.|.##..',
  ' ': '.....|.....|.....|.....|.....|.....|.....',
  '.': '.....|.....|.....|.....|.....|.##..|.##..',
  ',': '.....|.....|.....|.....|.##..|.##..|.#...',
  ':': '.....|.##..|.##..|.....|.##..|.##..|.....',
  '-': '.....|.....|.....|#####|.....|.....|.....',
  '_': '.....|.....|.....|.....|.....|.....|#####',
  '!': '..#..|..#..|..#..|..#..|..#..|.....|..#..',
  '?': '.###.|#...#|....#|...#.|..#..|.....|..#..',
  '/': '....#|....#|...#.|..#..|.#...|#....|#....',
  "'": '..#..|..#..|.....|.....|.....|.....|.....',
  '(': '...#.|..#..|.#...|.#...|.#...|..#..|...#.',
  ')': '.#...|..#..|...#.|...#.|...#.|..#..|.#...',
  '%': '##..#|##.#.|..#..|.#...|#.##.|..##.|.....',
  '*': '.....|#.#.#|.###.|#####|.###.|#.#.#|.....',
  '+': '.....|..#..|..#..|#####|..#..|..#..|.....',
  '=': '.....|.....|#####|.....|#####|.....|.....',
  '<': '...#.|..#..|.#...|#....|.#...|..#..|...#.',
  '>': '.#...|..#..|...#.|....#|...#.|..#..|.#...',
  '#': '.#.#.|.#.#.|#####|.#.#.|#####|.#.#.|.#.#.',
  '"': '.#.#.|.#.#.|.....|.....|.....|.....|.....',
  '@': '.###.|#...#|#.###|#.#.#|#.###|#....|.###.',
};

/** German characters have no glyph of their own; transliterate instead. */
const TRANSLITERATE: Record<string, string> = {
  'Ä': 'AE', 'Ö': 'OE', 'Ü': 'UE', 'ß': 'SS',
  'ä': 'AE', 'ö': 'OE', 'ü': 'UE',
  'É': 'E', 'È': 'E', 'Ê': 'E',
};

export function normalizeText(text: string): string {
  let out = '';
  for (const ch of text) {
    out += TRANSLITERATE[ch] ?? ch;
  }
  return out.toUpperCase();
}

const cache = new Map<string, HTMLCanvasElement>();

function glyphCanvas(ch: string, color: string): HTMLCanvasElement | null {
  const rows = FONT[ch];
  if (!rows) return null;
  const key = `${ch} ${color}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const cv = document.createElement('canvas');
  cv.width = GLYPH_W;
  cv.height = GLYPH_H;
  const ctx = cv.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = color;
  rows.split('|').forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      if (row[x] === '#') ctx.fillRect(x, y, 1, 1);
    }
  });
  cache.set(key, cv);
  return cv;
}

export interface TextOpts {
  color?: string;
  /** Extra pixels between glyph cells (the cell already includes a 1px gap). */
  tracking?: number;
  scale?: number;
  align?: 'left' | 'center' | 'right';
  /** Draws a 1px drop shadow underneath, the way arcade HUDs do. */
  shadow?: string;
}

export function textWidth(text: string, opts: TextOpts = {}): number {
  const s = opts.scale ?? 1;
  const tracking = opts.tracking ?? 0;
  const n = normalizeText(text).length;
  if (n === 0) return 0;
  return (n * (GLYPH_W + 1 + tracking) - 1 - tracking) * s;
}

export function drawText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  opts: TextOpts = {},
): void {
  const s = opts.scale ?? 1;
  const tracking = opts.tracking ?? 0;
  const color = opts.color ?? '#f4f4ef';
  const str = normalizeText(text);

  let ox = x;
  if (opts.align === 'center') ox = x - Math.floor(textWidth(text, opts) / 2);
  else if (opts.align === 'right') ox = x - textWidth(text, opts);
  ox = Math.round(ox);
  const oy = Math.round(y);

  const step = (GLYPH_W + 1 + tracking) * s;
  for (let i = 0; i < str.length; i++) {
    const gx = ox + i * step;
    if (opts.shadow) {
      const sh = glyphCanvas(str[i], opts.shadow);
      if (sh) ctx.drawImage(sh, gx + s, oy + s, GLYPH_W * s, GLYPH_H * s);
    }
    const g = glyphCanvas(str[i], color);
    if (g) ctx.drawImage(g, gx, oy, GLYPH_W * s, GLYPH_H * s);
  }
}

export const FONT_HEIGHT = GLYPH_H;
