# Demon;Coder web test: rules for Claude sessions

Jake directs; Claude builds. Jake has no game dev background, so explain choices in plain words and show results (screenshots) instead of describing them.

## Working method
- One feature per change, then look at it. Take a screenshot with Playwright (Chromium is at `/opt/pw-browsers`; launch with `--use-gl=angle --use-angle=swiftshader`) and check it before saying it works.
- Use the URL test hooks to jump straight to what changed: `?skip`, `?at=x,y,dir`, `?battle=a,b`, `?open`.
- Headless Chromium runs at a few frames per second. Key taps are buffered in `Input.tap`; keep it that way so quick presses are never dropped.
- Check characters in `tools/preview.html` (`?n=name1,name2`, `&face=1` for a close-up, `&hurt=1`, `&atk=1`).

## Style rules
- Characters: sculpted primitives (`sculpt()`, `headGeometry()`), `MeshStandardMaterial` via `rig.mat()`, no outlines. Tone is serious and unsettling, never cute: realistic human proportions, small eyes, no blush; demons should be wrong to look at. Jake's drawings are inspiration only.
- Every model gets its own `Rig` so hit flashes don't leak between characters.
- World: `MeshStandardMaterial` with canvas textures and generated normal maps, a dim captured environment for reflections, 640x360 render. Props go in `src/props.js`, merged with `Bundle` so each kind is one draw call. Don't add image or audio files unless Jake asks.
- GTAOPass was tried and broke the image (everything black, transparent effects lost); don't re-add it without testing.
- Look target is SMT Nocturne: dark first. Light comes from a few sources (moonlight through windows, a handful of working tubes, the laptop). Check new rooms in screenshots for a grey veil; blacks should stay black.
- Characters use `rig.dissolve` for burn in/out and share `RIM` for rim light; battle code tints `RIM`.
- No em or en dashes in anything Jake reads (UI text, notes, docs).

## Content
- Numbers, enemies, notes, intro lines: `src/data.js`. Map: `MAP` in `src/level.js`.
- Story text is placeholder until Jake's script is final. Don't invent new story beats; use lines from the script or the story session, and flag anything new.
- Names in use: Naomi (dead twin), Touma (player, believes she is Naomi), Gibbles, Sparkles (cat), Anna, Gabrielle, Jason, Yuki. Town: Kagemori (placeholder).
