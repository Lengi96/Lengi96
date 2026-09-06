/**
 * Composes the production build into one self-contained page.
 *
 * The Vite output is an HTML shell plus a module script; a hosted Artifact has
 * to be a single file with no external requests, so the bundle is inlined and
 * wrapped in the arcade-cabinet chrome. The result is written to
 * tools/desert-slug.html and is playable by opening it directly.
 */
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DIST = join(ROOT, 'dist');
const OUT = join(ROOT, 'tools', 'desert-slug.html');

const assets = await readdir(join(DIST, 'assets'));
const jsName = assets.find((f) => f.endsWith('.js'));
if (!jsName) throw new Error('no bundle in dist/assets - run vite build first');
const js = await readFile(join(DIST, 'assets', jsName), 'utf8');

// A literal closing script tag anywhere in the bundle would end the inline
// block early, so refuse rather than emit a page that silently breaks.
if (/<\/script/i.test(js)) {
  throw new Error('bundle contains a closing script tag; inlining is unsafe');
}

const page = `<title>Desert Slug Cabinet</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Oswald:wght@400;600&family=IBM+Plex+Mono:wght@400;600&display=swap">
<style>
  /* A cabinet is a dark object under a lit marquee. The page commits to that
     single world rather than following the viewer's theme, so every colour is
     painted explicitly and nothing is inherited from the host ground. */
  :root {
    --cabinet: #0a0910;
    --bezel: #17141f;
    --bezel-edge: #2a2436;
    --marquee: #ffd75e;
    --rebel: #e8443a;
    --label: #6b6478;
    --label-bright: #a79dbb;
  }

  html, body {
    margin: 0;
    height: 100%;
    background: var(--cabinet);
    color: var(--label-bright);
    font-family: 'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
    overflow: hidden;
  }

  #cabinet {
    position: fixed;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 14px;
    padding: 16px;
    box-sizing: border-box;
    /* Light pooling under the marquee, falling off toward the cabinet sides. */
    background:
      radial-gradient(120% 70% at 50% -10%, #241d33 0%, rgba(36,29,51,0) 60%),
      var(--cabinet);
  }

  #marquee {
    display: flex;
    align-items: baseline;
    gap: 14px;
    flex-wrap: wrap;
    justify-content: center;
    text-align: center;
  }

  #marquee h1 {
    margin: 0;
    font-family: Oswald, 'Arial Narrow', system-ui, sans-serif;
    font-weight: 600;
    font-size: clamp(20px, 3.4vw, 34px);
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--marquee);
    text-wrap: balance;
  }
  #marquee h1 em {
    font-style: normal;
    color: var(--rebel);
  }

  /* The cabinet's real spec line: player count, native resolution, tick rate. */
  #spec {
    font-size: 11px;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: var(--label);
    font-variant-numeric: tabular-nums;
  }

  #bezel {
    padding: 10px;
    border-radius: 4px;
    background: var(--bezel);
    border: 1px solid var(--bezel-edge);
    box-shadow:
      inset 0 0 0 1px rgba(255, 215, 94, 0.14),
      0 18px 50px rgba(0, 0, 0, 0.6);
    line-height: 0;
  }

  canvas {
    image-rendering: pixelated;
    image-rendering: crisp-edges;
    display: block;
    background: #000;
    outline: none;
  }
  #bezel:focus-within {
    box-shadow:
      inset 0 0 0 1px rgba(255, 215, 94, 0.5),
      0 18px 50px rgba(0, 0, 0, 0.6);
  }

  #legend {
    display: flex;
    align-items: center;
    gap: 18px;
    flex-wrap: wrap;
    justify-content: center;
    font-size: 11px;
    letter-spacing: 0.08em;
    color: var(--label);
  }
  #legend .control {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  #legend .sep {
    width: 1px;
    height: 14px;
    background: var(--bezel-edge);
  }
  kbd {
    font: 600 11px/1 'IBM Plex Mono', ui-monospace, monospace;
    color: var(--marquee);
    background: #201b2c;
    border: 1px solid var(--bezel-edge);
    border-bottom-width: 2px;
    border-radius: 3px;
    padding: 4px 6px;
    min-width: 10px;
    text-align: center;
  }
  #legend .control.fire kbd { color: var(--rebel); }

  #tap {
    font-size: 11px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--label);
  }
  #tap[hidden] { display: none !important; }

  @media (prefers-reduced-motion: no-preference) {
    #tap { animation: pulse 1.8s ease-in-out infinite; }
    @keyframes pulse { 50% { opacity: 0.35; } }
  }
</style>

<div id="cabinet">
  <div id="marquee">
    <h1>Desert <em>Slug</em></h1>
    <span id="spec">1 Player &middot; 320 &times; 224 &middot; 60 Hz</span>
  </div>

  <div id="bezel">
    <canvas id="screen" tabindex="0" aria-label="Desert Slug game screen"></canvas>
  </div>

  <div id="legend">
    <span class="control"><kbd>&larr;</kbd><kbd>&uarr;</kbd><kbd>&darr;</kbd><kbd>&rarr;</kbd> Bewegen &amp; Zielen</span>
    <span class="sep"></span>
    <span class="control fire"><kbd>X</kbd> Schie&szlig;en</span>
    <span class="control"><kbd>C</kbd> Springen</span>
    <span class="control"><kbd>V</kbd> Granate</span>
    <span class="sep"></span>
    <span class="control"><kbd>Enter</kbd> Start</span>
    <span class="control"><kbd>P</kbd> Pause</span>
  </div>

  <p id="tap">Ins Bild klicken, dann Enter dr&uuml;cken</p>
</div>

<script type="module">
${js}
</script>

<script>
  // The page runs inside a frame, so key events only arrive once it has focus.
  // Focus the screen on load and on any click, and drop the prompt once the
  // player has actually taken control.
  (function () {
    var screenEl = document.getElementById('screen');
    var tap = document.getElementById('tap');
    if (!screenEl) return;

    function grab() {
      try { window.focus(); } catch (e) { /* cross-origin parent, ignore */ }
      screenEl.focus({ preventScroll: true });
    }
    grab();
    document.addEventListener('pointerdown', grab);
    window.addEventListener('keydown', function () {
      if (tap) tap.hidden = true;
    }, { once: true });
  })();
</script>
`;

await writeFile(OUT, page, 'utf8');
console.log(`wrote ${OUT} (${Math.round(page.length / 1024)} kB, bundle ${jsName})`);
