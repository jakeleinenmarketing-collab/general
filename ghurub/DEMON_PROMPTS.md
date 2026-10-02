# Demon art prompt pack

Ready-to-paste prompts for generating the first demon set in one consistent style. They work in any image generator, including free ones, so you aren't tied to Higgsfield credits.

**Free or cheap places to run them:**
- **Gemini.** You already use it, and it can generate images.
- **Microsoft Designer / Bing Image Creator.** Free daily boosts.
- **Leonardo.ai.** Free daily tokens. It lets you reuse a style reference and seed, which helps consistency.
- **Stable Diffusion run locally** (ComfyUI or Forge) if you have a decent GPU. Free and unlimited.

Check each tool's terms. For a free portfolio project, all of these are normally fine.

---

## 0. Using ChatGPT (recommended)

ChatGPT's built-in image generation (**ChatGPT Images 2.0**, as of April 2026) is strong at following detailed descriptions and remembering earlier images in the same chat, which is exactly what a consistent set needs. You don't pick a separate image model; just ask for an image in a chat. On a paid plan, using a **thinking** model gets you "images with thinking," which plans the image before drawing it and follows long prompts more closely.

**Workflow:**
1. Start **one dedicated chat** for the whole demon set and keep every demon in it.
2. First message: paste the style block (section 2) and say "This is the art style for every image in this chat." Then ask for the angel.
3. Iterate on the angel in plain language ("make the mask smoother," "cloak more tattered") until it's right. That image becomes the style reference.
4. For each next demon: "Same art style, framing and background as the angel. Now: [creature description from section 3]."
5. If the style drifts, re-upload the approved angel image and say "match this style exactly."
6. Ask for a **transparent background** if you want cut-outs ready for Godot. If that comes out wrong, keep the plain gray background and remove it later.

---

## 1. How to keep the set consistent

1. **Make the angel first.** Regenerate until one image nails the look.
2. **Use that image as the style reference** for every other demon, if the tool supports image or style references.
3. **Paste the same style block** (below) into every prompt, word for word. Only the creature part changes.
4. **Same size every time:** 3:4 portrait (for example 768×1024).
5. **Plain background** so the demon is easy to cut out and drop into a battle scene in Godot.

---

## 2. The style block (paste into every prompt)

```
full-body creature portrait for a 1990s Japanese dark-fantasy RPG demon compendium,
bold confident ink linework, cel shading with subtle painterly gradients,
strong readable silhouette, limited palette with one dominant accent color,
mythological design with a slightly unsettling modern edge,
centered, entire figure visible head to toe, neutral flat light-gray background,
no text, no logo, no watermark, no frame
```

**Negative prompt** (if the tool has one):
```
photorealistic, 3D render, chibi, cute anime style, cropped limbs, cut off head,
busy background, scenery, text, signature, watermark, multiple creatures, extra limbs
```

---

## 3. Act I demons

Each prompt is: **[creature description]** + the style block.

### The angel (Scene 1)
```
a tall solemn angel warrior in a long flowing white hooded cloak, face hidden behind a smooth expressionless polished gold mask with no mouth, small white wings folded behind, a slender straight sword held low, thin streaks of gold blood on the cloak, regal and wounded,
```
Accent color: **gold**.

### The Imp (Scene 1)
```
a small wiry red imp demon, crouched and ready to pounce, oversized grinning mouth full of needle teeth, short curved black horns, long thin tail with a barbed tip, clawed hands and feet, lean ribs visible, mischievous and vicious,
```
Accent color: **red**.

### Pixie
```
a tiny pixie fairy with translucent dragonfly wings, sharp knowing eyes, wild short hair, a ragged leaf-and-wire outfit, hovering with one leg tucked, playful but feral, a faint sand-colored glow,
```
Accent color: **cyan**.

### Gaki (hungry ghost)
```
a gaki hungry ghost from Japanese Buddhist myth, emaciated gray body, huge swollen belly, thin stick limbs, long stringy hair, wide desperate mouth, crawling on all fours, pitiful and grotesque but not gory,
```
Accent color: **sickly green**.

### Sandman
```
a sandman spirit made of drifting yellow desert sand, loose humanoid form that blurs into a dust cloud at the legs, hollow glowing eyes, a sack slung over one shoulder leaking sand, sleepy and eerie,
```
Accent color: **ochre yellow**.

### Lilim
```
a lilim night demoness, pale skin, long black hair, small bat wings at her lower back, sharp predatory smile, dark minimal bodysuit, slender and dangerous, tasteful and non-explicit,
```
Accent color: **violet**.

### Kobold
```
a kobold mine goblin from German folklore, short stocky body, mining helmet with a cracked lamp, pickaxe over one shoulder, big ears and a sly squint, patched work clothes,
```
Accent color: **orange lamp-light**.

### Nekomata
```
a nekomata two-tailed cat demon from Japanese folklore, standing upright, slim and graceful, two long forked tails curling, sly half-closed eyes, a red neck tassel, claws out,
```
Accent color: **crimson**.

### Scout's boss demon: Orthrus
```
orthrus, a huge two-headed hound from Greek myth, muscular black body, two snarling heads with glowing eyes, a serpent for a tail, spiked collar, braced to charge, menacing boss presence,
```
Accent color: **burning orange**.

*(Alternative boss: Yaksha.)*
```
a yaksha guardian demon, tall and muscular, blue-gray skin, fierce fanged face, ornate gold armlets and crown, holding a heavy club, imposing temple-guardian pose,
```
Accent color: **blue**.

---

## 4. Notes

- **Myths, not copies.** Every creature here is real-world mythology. The prompts describe *our* versions, so the set reads as SMT-inspired rather than traced from Atlus.
- **Keep the angel original.** It's inspired by SMT V's gold-masked angels, but the prompt describes it in our own terms.
- **If a demon comes out off-style,** regenerate with the angel as the reference image instead of rewriting the prompt.
- **Saving files:** keep generated art in `ghurub/art/demons/` as `angel.png`, `imp.png`, and so on, and the game can load them directly.
