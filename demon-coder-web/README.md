# Demon;Coder: web test build

A test of building Demon;Coder the way Danny Limanseta builds his browser games: Three.js in a web page, every character modeled in code, one feature per prompt, and play it after every change.

This build is a floor 1 slice. It covers the title, the DOS intro, the floor 1 school, notes to read, random and scripted fights, a rest point, and the Mime boss.

## Play it

Any static file server works. From this folder:

```
npx serve .
```

Then open the printed address on a desktop browser. Opening `index.html` straight from disk won't work, because browsers block JavaScript modules on `file://`.

| Key | Action |
| --- | --- |
| W / S or arrows | step forward / back |
| A / D or arrows | turn |
| Q / E | strafe |
| Space / Enter | read, use, confirm |
| X / Esc | back |

Test shortcuts (add to the URL): `?skip` skips the intro, `?at=x,y,dir` starts at a cell (dir 0 N, 1 E, 2 S, 3 W), `?battle=calamari,gnome` starts a fight, `?open` opens the fire shutter.

## How it's built

- **No art files.** Textures are painted onto canvases at load (`src/textures.js`), and characters are built from spheres, cones and capsules (`src/characters.js`). Everything is cel shaded with ink outlines and lit by the same lights as the corridor.
- **Live portraits.** The faces on the laptop are the real 3D party models, rendered every frame, so they blink, glance around, flinch when hit and slump at low HP.
- **Retro look.** The game renders at 640x360 and is scaled up with crisp pixels, with bloom, a vignette and a light grain on top.
- **No audio files.** Rain, hum, footsteps, hits and both battle themes are synthesized in `src/audio.js`.
- **Data in one place.** Stats, enemies, encounters, notes and the intro script are in `src/data.js`. The map is the `MAP` strings at the top of `src/level.js`.

| File | What it does |
| --- | --- |
| `src/main.js` | renderer, post effects, movement, story beats, intro |
| `src/level.js` | map, walls, lights, desks, bodies, readable things |
| `src/characters.js` | Touma/Naomi, Gibbles, Sparkles, Anna, Calamari, Gnome, Mime |
| `src/battle.js` | press-turn battles in the corridor itself |
| `src/hud.js` | laptop HUD, portraits, automap, dialogue, notes |
| `src/fx.js` | particles and lightning bolts |
| `tools/preview.html` | character lineup for checking models (`?n=touma&face=1`) |

Three.js r186 is vendored in `vendor/` (MIT, see `vendor/THREE-LICENSE`), so nothing is downloaded at runtime.

## What's placeholder

Note text, Anna's line and the intro lines come from the 9/27 story session and aren't final. Character designs are loose interpretations of the originals, as asked: clean and readable over faithful.
