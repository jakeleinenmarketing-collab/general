# Ghurub: Act I, Part 1 (Godot prototype)

From the field of the dead to the gates of Shinjuku Station. It plays through the opening cinematic, the first shots, Ghurub waking up, the desert crawl with demon negotiation, the scout's ambush in the rail yard, and the arrival at the station.

## Run it

1. Open Godot 4.4 or newer (tested on 4.6.2 and 4.7).
2. **Import**, then pick this folder's `project.godot`.
3. Press **F5**.

The first launch takes a second or two while the desert builds itself.

## Controls

| Key | Action |
| --- | --- |
| W / S or ↑ / ↓ | step forward / back |
| A / D or ← / → | turn |
| Q / E | strafe |
| Space / Enter / Z | confirm, fire, advance text |
| Esc / X | back out of a menu |
| Esc or Enter during the opening | skip the cinematic |
| Tab / C / M | Ghurub's field menu (items, demons) |

## How it plays

- **Ghurub's screen** (bottom right) always shows the bearing and distance to Shinjuku, an auto-map, and the SIG meter. SIG climbs as an encounter gets close.
- **Battles** are first person. Takeya can shoot (GUN), talk (NEGOTIATE), use Medicine, or run. Recruited demons use their skills. Hitting a weakness does 1.5x damage.
- **Negotiation:** answer the demon's question well, then pay what it asks (Medicine or some HP), and it joins. You can hold up to three demons.
- **Orthrus** (the scout's demon) resists fire and is weak to ice. Nekomata knows Frost.
- **Checkpoints:** leaving the battlefield, entering the rail yard, and the supply crate at the yard's south edge (which also heals). Dying sends you back to the last one.

## How it's built

Everything is built in code from primitive shapes and a handful of shaders. There are no image, model or audio files. That keeps demons, bodies and ruins in exactly the same visual style as the desert they stand in.

| File | What it does |
| --- | --- |
| `src/main.gd` | the 640×360 render, post pass, lighting, input, test harness |
| `src/game.gd` | story flow, the opening cinematic, grid movement, events, the scout, the ending |
| `src/battle.gd` | battles, damage and weaknesses, negotiation, recruiting |
| `src/kit.gd` | the demon kit: every demon, body and prop, plus the mesh baker |
| `src/world.gd` | builds the desert from the map in `data.gd` |
| `src/data.gd` | the map, demons, skills, negotiation lines, Ghurub's nudges and log fragments |
| `src/ui.gd` | Ghurub's device, dialogue, LCD menus, battle panels, title cards |
| `src/sfx.gd` | every sound and both battle themes, synthesized at startup |
| `shaders/` | toon light + outline (shared by everything), sand, sky, post pass (dither, haze, grade) |

**Adding a demon:**
1. Write a builder in `kit.gd` (copy `imp()` as a starting point) and add it to `Kit.demon()`.
2. Add its stats to `DEMONS` in `data.gd`.
3. Add it to an `ENCOUNTERS` group.

**Changing the map:** edit the `MAP` strings in `data.gd`. The legend is at the top of the file.

## Test harness

Arguments go after `--` on the command line (or under Project → Project Settings → Run → Main Run Args):

- `--jump=desert|boss|gate` skips ahead.
- `--view=lineup|lineup2|hand|low|crane|wide|fight|desert|yard|gate|battle` shows a still camera view.
- `--auto` lets a bot play the whole thing. Add `--god` to make Takeya unkillable, `--speed=6` to set the time scale, and `--delay=2` to slow its dialogue.
- `--shot=out.png --at=12` saves a screenshot after 12 seconds and quits.
- `--look=sm2` tries the SMT II cover look: a bleached, misty olive duotone with hard blacks and halation.
