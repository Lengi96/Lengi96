# DESERT SLUG

Ein Run-and-Gun-Arcadespiel für den Browser — eine eigenständige Hommage an die
Neo-Geo-Klassiker, mit denen man früher am Spielautomaten Münzen versenkt hat.
Läuft in 320×224 (die sichtbare Neo-Geo-MVS-Auflösung), ganzzahlig hochskaliert,
mit 8-Wege-Stick-Logik und drei Knöpfen: **Schuss, Sprung, Granate**.

> **Rechtliches:** Dies ist *keine* Portierung und enthält keinerlei Material von
> SNK. Sämtliche Grafik wird zur Laufzeit aus eigenen Zeichenroutinen erzeugt,
> der Sound wird per WebAudio synthetisiert. Nachgebaut sind die *Mechaniken*
> eines Genres, nicht die Assets eines konkreten Spiels. Charaktere, Gegner,
> Level und der Boss sind eigene Entwürfe.

## Spielen

```bash
npm install
npm run dev      # http://localhost:5173
```

Produktionsbuild: `npm run build` → `dist/` (relative Pfade, also auch aus einem
Unterordner heraus lauffähig, z. B. GitHub Pages).

## Steuerung

| Aktion | Tastatur | Gamepad |
|---|---|---|
| Bewegen / Zielen (8 Wege) | Pfeiltasten oder WASD | D-Pad / linker Stick |
| Schießen (halten = Dauerfeuer) | **Linksklick** oder `J` | B |
| Messer (Nahkampf) | **Rechtsklick** oder `K` | X |
| Springen | `Leertaste` oder `X` | A |
| Granate | `G` | Y / R1 |
| Start / Continue | `Enter` | Start |
| Pause | `P` oder `Esc` | Select |
| Ton an/aus | `M` | – |

Feinheiten, die das Spielgefühl ausmachen:

- **Ducken und Kriechen** über Stick nach unten — kleinere Trefferfläche.
- **Nahkampf:** Das Messer liegt auf der rechten Maustaste und schlägt zu, ob
  etwas in Reichweite steht oder nicht. Zusätzlich wird der Schussknopf direkt
  am Gegner automatisch zum Messer.
  Das Messer geht um Schilde herum, Kugeln nicht.
- **Variabler Sprung:** Knopf früh loslassen → kürzerer Sprung. Runter + Sprung
  fällt durch Holzstege hindurch.
- **Ein Treffer tötet.** Danach Respawn mit blinkender Unverwundbarkeit,
  ansonsten Continue mit 10-Sekunden-Countdown.

## Waffen

Die Pistole plus neun Spezialwaffen, fünf davon zusätzlich als **Big**-Variante
(erkennbar am pulsierenden Buchstaben auf der Kiste). Munitionsmengen sind an
den Arcade-Vorlagen orientiert:

| Kiste | Waffe | Munition | Verhalten |
|---|---|---|---|
| — | Handgun | ∞ | Einzelschuss, max. 3 Kugeln gleichzeitig |
| `H` | Heavy Machine Gun | 200 | Schnellfeuer |
| `S` | Shotgun | 30 (Big: 15) | Streuung, kurze Reichweite, hoher Schaden |
| `R` | Rocket Launcher | 30 | Explosiv mit Rauchfahne |
| `F` | Flame Shot | 30 | Durchdringend, wird beim Fliegen größer |
| `L` | Laser Gun | 200 | Durchdringender Strahl |
| `C` | Enemy Chaser | 40 | Zwei zielsuchende Raketen |
| `I` | Iron Lizard | 30 | Bodendrohne, explodiert beim Aufprall |
| `G` | Super Grenade | 20 | Große Wurfgranate mit weitem Radius |
| `D` | Drop Shot | 30 | Hüpfende Feuerkugel |
| Bombe | Granaten | +10 (max. 10) | Eigener Knopf, geht durch Schilde |

## Mission 1 — „Dusty Bazaar"

Eine Wüstenstadt im Morgengrauen. Vier **Kampf-Tore** halten die Kamera an, bis
die jeweilige Welle geräumt ist; dazwischen läuft das Level frei durch.

- Gegner: Rebellensoldaten, Schildträger, Mörserstellungen, Geschütztürme,
  ein Rebellenpanzer und der wiederkehrende Heavy **Sergeant Ashfall**.
- **POWs** befreien (Messer, Schuss oder einfach hinlaufen): Rettungskette
  100 → 200 → 400 → 800 …, plus 10.000 Punkte pro Geisel in der Endabrechnung.
- **Slug:** Ein SV-Sturmpanzer wartet auf der Terrasse. Drei Panzerungstreffer,
  Vulcan auf dem Schussknopf (360° zielbar), Kanone auf dem Granatenknopf,
  Sprungdüsen auf Sprung. **Doppeltipp Sprung = aussteigen** — der leere Panzer
  rammt nach vorn und explodiert.
- **Boss: „Iron Jackal"** — Landkreuzer mit drei Phasen. Die beiden
  Geschützkanzeln auf dem Dach lassen sich einzeln abschießen; der Rumpfkern
  öffnet sich erst in der letzten Phase.

## Aufbau

```
src/
  core/      loop.ts (60-Hz-Fixed-Timestep), input.ts (Tastatur + Gamepad),
             audio.ts (WebAudio-Synthese), rng.ts (deterministisch)
  render/    screen.ts (320x224-Backbuffer), art.ts (Zeichenprimitive),
             actor.ts (parametrischer Humanoid), text.ts (5x7-Bitmap-Font),
             background.ts (Parallax + Terrain), camera.ts, palette.ts
  game/      world.ts (Orchestrator), player.ts, weapons.ts, grenade.ts,
             pow.ts, items.ts, props.ts, slug.ts, level.ts, hud.ts, states.ts,
             enemies/, boss/
  data/      mission01.ts  (Level-Layout als reine Daten)
```

Die gesamte Grafik entsteht in `render/art.ts` und `render/actor.ts` aus
pixelgerasterten Primitiven. Dadurch gibt es keine Asset-Dateien, Posen können
frei zielen statt an vorgezeichnete Frames gebunden zu sein, und der komplette
Build bleibt unter 100 kB.

Statuseffekte für die späteren Missionen (Mumien- und Dick-Verwandlung) sind in
`player.ts` bereits als Modifikatoren angelegt und werden in Mission 1 nur nicht
ausgelöst.

## Prüfen

```bash
npm run typecheck   # tsc --noEmit
npm run test        # Vitest: Waffen, Kollision, Level-Sanity, Score-Kette
npm run verify      # Build + Headless-Durchlauf in Chromium mit Screenshots
npm run check       # alle drei
```

`npm run verify` startet die gebaute Seite in Chromium und steuert das Spiel über
den Test-Hook `window.__slug` (fester Takt statt Echtzeit, damit eine ganze
Mission in Sekunden durchläuft). Es laufen zwei Durchgänge:

1. **Normale Regeln** — ein blinder Autopilot mit zwei Leben; belegt, dass der
   Anfang der Mission ohne Fehler spielbar ist.
2. **Unverwundbar** — spielt Mission 1 komplett bis zum Boss-Kill und zur
   Punkteabrechnung durch, damit jede Station wirklich einmal durchlaufen wird.

Screenshots landen in `tools/shots/`. Der Lauf schlägt fehl, wenn eine
JavaScript-Exception auftritt oder die Mission nicht abgeschlossen wird.

Der Level-Test in `tests/mission.test.ts` prüft unter anderem, dass jede
gattergebundene Gegnerwelle innerhalb des Bildausschnitts liegt, den ihr Tor
festhält — sonst wäre der letzte Gegner unerreichbar und das Level würde
blockieren.

## Was als Nächstes kommt

Missionen 2–6, Zwei-Spieler-Koop, weitere Fahrzeuge, Online-Highscores. Die
Engine ist so gebaut, dass all das additiv dazukommt: ein neues Level ist eine
Datendatei, ein neuer Gegner eine Unterklasse von `Enemy`.
