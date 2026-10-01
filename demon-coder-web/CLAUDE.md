# Demon;Coder web test: rules for Claude sessions

Jake directs; Claude builds. Jake has no game dev background, so explain choices in plain words and show results (screenshots) instead of describing them.

## Working method
- One feature per change, then look at it. Take a screenshot with Playwright (Chromium is at `/opt/pw-browsers`; launch with `--use-gl=angle --use-angle=swiftshader`) and check it before saying it works.
- Use the URL test hooks to jump straight to what changed: `?skip`, `?at=x,y,dir`, `?battle=a,b`, `?open`.
- Headless Chromium runs at a few frames per second. Key taps are buffered in `Input.tap`; keep it that way so quick presses are never dropped.
- Check characters in `tools/preview.html` (`?n=name1,name2`, `&face=1` for a close-up, `&hurt=1`, `&atk=1`).

## Style rules
- Characters: primitives only, `MeshToonMaterial` with `T.ramp`, ink outlines via `rig.add(..., { outline })`. Clean and attractive over faithful to Jake's original drawings.
- Every model gets its own `Rig` so hit flashes don't leak between characters.
- World: Lambert materials, canvas textures, 640x360 render. Don't add image or audio files unless Jake asks.
- No em or en dashes in anything Jake reads (UI text, notes, docs).

## Content
- Numbers, enemies, notes, intro lines: `src/data.js`. Map: `MAP` in `src/level.js`.
- Story text is placeholder until Jake's script is final. Don't invent new story beats; use lines from the script or the story session, and flag anything new.
- Names in use: Naomi (dead twin), Touma (player, believes she is Naomi), Gibbles, Sparkles (cat), Anna, Gabrielle, Jason, Yuki. Town: Kagemori (placeholder).
