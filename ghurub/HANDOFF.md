# Ghurub: where we left off

Read this first in any new session. It picks up exactly where the last one stopped.

**Other key files:**
- `ghurub/DESIGN.md`: the story and world bible. The author's own decisions are quoted word for word in section 2, and they always win.
- `ghurub/game/README.md`: how the Godot prototype is built, its controls, and its test harness.
- `ghurub/reference/`: the visual lighthouse and screenshots of the current build.

---

## 1. The project in one breath

A solo, free-to-share portfolio game ("I'm not looking to sell this, I'm looking for this to sell me"). It's a cross between *SMT II* and *Digital Devil Saga*. It opens in a yellow desert that used to be Tokyo, about 2,000 years after 2007. The protagonist **Takeya** wakes among the dead, takes a device whose AI is **Ghurub** (Arthur-like, cold, slowly and very subtly becoming more human), crosses the desert to Shinjuku Station, and later travels back to 2007. Godot 4.7, first-person grid dungeon crawler.

## 2. What exists now

**`ghurub/game/`: a playable Godot prototype of Act I, Part 1.** It covers:
- the opening cinematic
- the first shots and the angel's death
- Ghurub's boot sequence
- the desert crawl, with negotiation and recruiting
- the scout's Orthrus ambush in the rail yard
- the arrival at the Shinjuku Station gates

A bot (`--auto`) plays it start to finish without errors on Godot 4.6.2 and 4.7.

**How it's built:**
- Everything is built in code from primitive shapes, using shared toon, outline and haze shaders.
- Static scenery is baked into chunked meshes.
- Audio is synthesized.
- It renders at 640×360 with a dithered post pass, on the **Compatibility** renderer.

It was built and tested in a cloud container with CPU-only (software) rendering. No one has played it on a real GPU yet, and nobody has heard the audio.

## 3. Where we stopped: the graphics push

The author's verdict on the build: **"The graphics leave so much to be desired... This map just is lackluster as hell."** They want to **push the environment graphics as far as they can go**, setting characters aside for now.

What we agreed:
- **Characters come from outside tools later:** ChatGPT concept art, converted to a 3D model (.glb) with Tripo or Meshy, then run through the shared shaders. Code-built primitive characters have hit their ceiling.
- **The world is what to push now,** on the author's own machine (a real GPU, Godot 4.7).

**The graphics push plan (not started yet):**
1. **Render at full resolution, not 640×360.** Keep the retro dither as an optional toggle. The low resolution is throwing away most of the detail.
2. **Switch to the Forward+ renderer** (`project.godot` → `rendering/renderer/rendering_method="forward_plus"`). That enables:
   - volumetric fog and light shafts
   - SSAO / SSIL
   - SDFGI (global illumination)
   - better shadows and glow

   Check the frame rate on the author's GPU.
3. **Real terrain:** a heightmapped dune mesh with sharp, wind-sculpted crests, flattened under walkable cells. The camera follows the terrain height. This replaces the flat plane plus the sphere "dunes," which look like bubbles.
4. **A sand material:** normal-mapped ripples (not painted stripes), color that changes with slope, cooler shadows in the troughs, and sparkle.
5. **Atmosphere:**
   - blowing sand near the ground
   - sand streaming off dune crests
   - dust devils
   - a better sky with dust layers and sun glare
   - heat haze
6. **Buried city:** building tops, signs, power poles and cars half-sunk in the dunes. Skyscrapers get a facade shader with windows, grime and damage, instead of the current "stacked plates" look.
7. Keep the shared shader approach, so imported character models will match later.

## 4. Visual direction

- **The lighthouse:** `reference/lighthouse_smt2_cover.jpg`, the SMT II cover. Its qualities:
  - washed-out, almost monochrome color (cream, olive, sepia)
  - high-key and misty, with highlights that bloom
  - hard black accents (straps, chains)
  - elegant, elongated figures
  - occult geometry in the fog
- `reference/look_test_sm2.png` shows the current build re-graded toward it (run with `--look=sm2`). The palette worked; the models didn't.
- The author also said the desert is **yellow**. Reconcile the two: a bleached, misty yellow-olive desert, not the saturated orange of v1. Show options and let the author pick.

## 5. How this author likes to work

- **Solo developer.** Keep scope small:
  - one linear story
  - no Law/Chaos route branching (choices can lean Law or Chaos in tone, but all lead to the same place)
  - no paradox explanations
- **Subtle over obvious,** especially for Ghurub's humanity and the antagonist Nagi's hints.
- **Doesn't want over-connection** between 2007 and the future.
- **Values honesty** about limits ("is this the best you can do?" deserved a straight answer).
- **Writes casually and fast.** Ask short questions, make a recommendation, and show screenshots instead of describing them.

## 6. Technical notes for the next session

- **Test harness** (arguments go after `--`):
  - `--view=NAME` shows a still camera view.
  - `--jump=desert|boss|gate` skips ahead.
  - `--auto --god --speed=6` runs the full bot playthrough.
  - `--shot=file.png --at=SECONDS` saves a screenshot and quits.
  - `--look=sm2` uses the cover grade.
- **GDScript pitfalls already hit:**
  - `var x := <untyped expression>` is a parse error. Type it explicitly (`var x: Vector3 = ...`).
  - `await tween.finished` hangs if the tween already finished. Check `is_running()` first.
- **Order in `world.gd`:** `clear_near()` has to run *before* `Kit.bake()`, because baking merges the props into chunked meshes.
- **Project version:** it targets Godot 4.4+ features and has been tested on 4.6.2 and 4.7. The author is on 4.7.

## 6b. Story update (latest)

The Act I story was rewritten. **Use `DESIGN.md` section 11**, not section 6. It covers:
- the Machine (unnamed, called "Father" by its followers)
- the Communion (law-leaning cult, brown)
- the Shinjuku Militia (Takeya's side, green)
- Momo
- the freelance summoner
- the clue chain to Kuzuryu
- the full new Act I dialogue

The dialogue currently in the game is the old version and should be replaced with section 11.

## 7. Open questions still on the table

- Approve the antagonist's proposed name **Nagi Kamiya** and his demon **Loki** (DESIGN.md 5.8).
- When Nagi fuses with Loki, and how his betrayal plays out.
- Act I, Part 2 (Shinjuku: the hub, Kuzuryu's slave floor, the vault) and Part 3 (the time jump).
- Which way to go for demon art: 3D models (ChatGPT → Tripo/Meshy) or 2D painted battle portraits like SMT I and II.
