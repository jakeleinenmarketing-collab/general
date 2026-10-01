// Every texture is painted on a canvas at load time, so the game ships with no image files.
import * as THREE from 'three';

let seed = 1234;
export function rand() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }
const rr = (a, b) => a + rand() * (b - a);

// Surfaces are painted in a 256-unit space and rasterized at 2x for crisper detail.
const RES = 2;
function canvas(w, h, res = RES) {
  const c = document.createElement('canvas');
  c.width = w * res; c.height = h * res;
  const g = c.getContext('2d');
  g.scale(res, res);
  return [c, g];
}

// A normal map from the painted surface: darker paint reads as lower (grout, seams, cracks).
function normalFrom(c, strength = 2, { repeat = false, invert = false } = {}) {
  const w = c.width, h = c.height;
  const src = c.getContext('2d').getImageData(0, 0, w, h).data;
  const H = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) H[i] = (src[i * 4] * 0.3 + src[i * 4 + 1] * 0.59 + src[i * 4 + 2] * 0.11) / 255 * (invert ? -1 : 1);
  const out = document.createElement('canvas'); out.width = w; out.height = h;
  const og = out.getContext('2d'); const img = og.createImageData(w, h);
  const at = (x, y) => H[((y + h) % h) * w + ((x + w) % w)];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = (at(x + 1, y) - at(x - 1, y)) * strength, dy = (at(x, y + 1) - at(x, y - 1)) * strength;
    const l = Math.hypot(dx, dy, 1);
    const i = (y * w + x) * 4;
    img.data[i] = (-dx / l * 0.5 + 0.5) * 255; img.data[i + 1] = (dy / l * 0.5 + 0.5) * 255; img.data[i + 2] = (1 / l * 0.5 + 0.5) * 255; img.data[i + 3] = 255;
  }
  og.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(out);
  t.colorSpace = THREE.NoColorSpace; t.anisotropy = 8;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function finish(c, { repeat = false, srgb = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function noise(g, w, h, amount, alpha = 0.06) {
  for (let i = 0; i < amount; i++) {
    const v = rand() < 0.5 ? 0 : 255;
    g.fillStyle = `rgba(${v},${v},${v},${rand() * alpha})`;
    g.fillRect(rand() * w, rand() * h, rr(1, 3), rr(1, 3));
  }
}

function grime(g, w, h, from) {
  const grad = g.createLinearGradient(0, h * from, 0, h);
  grad.addColorStop(0, 'rgba(20,24,18,0)');
  grad.addColorStop(1, 'rgba(20,24,18,0.45)');
  g.fillStyle = grad;
  g.fillRect(0, h * from, w, h * (1 - from));
}

// Lower panel + rail + plaster upper: the school wall every other texture is painted over.
function wallBase(g, w, h) {
  g.fillStyle = '#c9c2ad'; g.fillRect(0, 0, w, h);
  noise(g, w, h, 2500, 0.05);
  for (let i = 0; i < 6; i++) {           // water stains from the ceiling
    const x = rand() * w, len = rr(20, 90);
    const gr = g.createLinearGradient(0, 0, 0, len);
    gr.addColorStop(0, 'rgba(90,80,50,.25)'); gr.addColorStop(1, 'rgba(90,80,50,0)');
    g.fillStyle = gr; g.fillRect(x, 0, rr(3, 10), len);
  }
  const panelTop = h * 0.66;
  g.fillStyle = '#5f7d6e'; g.fillRect(0, panelTop, w, h - panelTop);
  noise(g, w, h, 1200, 0.07);
  g.fillStyle = '#3e5249'; g.fillRect(0, panelTop - 6, w, 8);
  g.fillStyle = '#93a89c'; g.fillRect(0, panelTop - 6, w, 2);
  g.fillStyle = '#2b3530'; g.fillRect(0, h - 14, w, 14);  // skirting
  grime(g, w, h, 0.75);
}

export function makeTextures() {
  const T = {};

  { // corridor linoleum
    const [c, g] = canvas(256, 256);
    const s = 64;
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
      const l = (x + y) % 2 ? 58 : 66;
      g.fillStyle = `hsl(150, 8%, ${l + rr(-2, 2)}%)`;
      g.fillRect(x * s, y * s, s, s);
    }
    noise(g, 256, 256, 4000, 0.08);
    g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 1;
    for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * s, 0); g.lineTo(i * s, 256); g.moveTo(0, i * s); g.lineTo(256, i * s); g.stroke(); }
    for (let i = 0; i < 14; i++) { // scuffs
      g.strokeStyle = `rgba(30,30,30,${rr(.05, .18)})`; g.lineWidth = rr(1, 3);
      const x = rand() * 256, y = rand() * 256;
      g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + rr(-20, 20), y + rr(-8, 8), x + rr(-30, 30), y + rr(-10, 10)); g.stroke();
    }
    T.lino = finish(c, { repeat: true });
    T.linoN = normalFrom(c, 3, { repeat: true });
    { // wet patches: where the floor is glossy
      const [r, gr] = canvas(256, 256, 1);
      gr.fillStyle = '#9a9a9a'; gr.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 40; i++) { const x = rand() * 256, y = rand() * 256, rad = rr(10, 60); const gg = gr.createRadialGradient(x, y, 0, x, y, rad); gg.addColorStop(0, 'rgba(10,10,10,.8)'); gg.addColorStop(1, 'rgba(10,10,10,0)'); gr.fillStyle = gg; gr.fillRect(0, 0, 256, 256); }
      for (let i = 0; i < 2000; i++) { gr.fillStyle = `rgba(255,255,255,${rand() * .25})`; gr.fillRect(rand() * 256, rand() * 256, 2, 2); }
      T.linoR = finish(r, { repeat: true, srgb: false });
    }
  }

  { // classroom wood floor
    const [c, g] = canvas(256, 256);
    for (let i = 0; i < 8; i++) {
      g.fillStyle = `hsl(28, ${rr(30, 40)}%, ${rr(30, 38)}%)`;
      g.fillRect(0, i * 32, 256, 32);
      for (let k = 0; k < 40; k++) {
        g.fillStyle = `rgba(40,20,5,${rr(.05, .15)})`;
        g.fillRect(rand() * 256, i * 32 + rand() * 32, rr(10, 60), 1);
      }
      g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(0, i * 32, 256, 2);
      const seam = rand() * 256; g.fillRect(seam, i * 32, 2, 32);
    }
    noise(g, 256, 256, 2000, 0.06);
    T.wood = finish(c, { repeat: true });
    T.woodN = normalFrom(c, 2.5, { repeat: true });
  }

  { // ceiling tiles
    const [c, g] = canvas(128, 128);
    g.fillStyle = '#d8d5cb'; g.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 500; i++) { g.fillStyle = 'rgba(60,60,50,.35)'; g.fillRect(rand() * 128, rand() * 128, 1, 1); }
    g.fillStyle = '#8d8a80'; g.fillRect(0, 0, 128, 3); g.fillRect(0, 0, 3, 128);
    const st = g.createRadialGradient(80, 70, 2, 80, 70, 30);
    st.addColorStop(0, 'rgba(120,95,40,.35)'); st.addColorStop(1, 'rgba(120,95,40,0)');
    g.fillStyle = st; g.fillRect(0, 0, 128, 128);
    T.ceiling = finish(c, { repeat: true });
    T.ceilingN = normalFrom(c, 2, { repeat: true });
  }

  { // plain wall
    const [c, g] = canvas(256, 384);
    wallBase(g, 256, 384);
    T.wall = finish(c);
    T.wallN = normalFrom(c, 2.2);
  }

  { // wall with a noticeboard (corridor variety)
    const [c, g] = canvas(256, 384);
    wallBase(g, 256, 384);
    g.fillStyle = '#7a5a3a'; g.fillRect(28, 70, 200, 130);
    g.fillStyle = '#a88a62'; g.fillRect(34, 76, 188, 118);
    const colors = ['#f3efe2', '#ffe7a3', '#cfe6ff', '#ffd1d1'];
    for (let i = 0; i < 5; i++) {
      g.save(); g.translate(rr(44, 170), rr(84, 140)); g.rotate(rr(-.12, .12));
      g.fillStyle = colors[i % 4]; g.fillRect(0, 0, rr(36, 60), rr(40, 56));
      g.fillStyle = 'rgba(0,0,0,.4)';
      for (let l = 0; l < 5; l++) g.fillRect(5, 8 + l * 8, rr(14, 40), 2);
      g.fillStyle = '#c22'; g.beginPath(); g.arc(rr(8, 30), 4, 3, 0, 7); g.fill();
      g.restore();
    }
    g.fillStyle = '#22201a'; g.font = 'bold 18px sans-serif'; g.fillText('文化祭', 96, 104);
    T.board = finish(c);
    T.boardN = normalFrom(c, 2.2);
  }

  { // window wall: lit frame and sill, with an alpha map that cuts the panes out
    const [c, g] = canvas(256, 384);
    wallBase(g, 256, 384);
    const x0 = 18, y0 = 54, x1 = 238, y1 = 250;
    g.fillStyle = '#20251f'; g.fillRect(x0, y0, x1 - x0, y1 - y0);
    g.fillStyle = '#7d847f';
    g.fillRect(x0 - 8, y0 - 8, x1 - x0 + 16, 10); g.fillRect(x0 - 8, y1 - 2, x1 - x0 + 16, 12);
    g.fillRect(x0 - 8, y0 - 8, 10, y1 - y0 + 16); g.fillRect(x1 - 2, y0 - 8, 10, y1 - y0 + 16);
    g.fillRect(125, y0, 8, y1 - y0); g.fillRect(x0, 149, x1 - x0, 6);
    g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(x0 - 8, y1 + 8, x1 - x0 + 16, 3);
    g.fillStyle = '#4c524e'; g.fillRect(x0 - 12, y1 + 10, x1 - x0 + 24, 8);   // sill
    noise(g, 256, 384, 800, 0.06);
    T.window = finish(c);
    T.windowN = normalFrom(c, 2.2);
    const [a, ga] = canvas(256, 384);
    ga.fillStyle = '#fff'; ga.fillRect(0, 0, 256, 384);
    ga.fillStyle = '#000';
    ga.fillRect(x0 + 2, y0 + 2, 125 - x0 - 2, 149 - y0 - 2); ga.fillRect(133, y0 + 2, x1 - 135, 149 - y0 - 2);
    ga.fillRect(x0 + 2, 155, 125 - x0 - 2, y1 - 157); ga.fillRect(133, 155, x1 - 135, y1 - 157);
    T.windowAlpha = finish(a, { srgb: false });
    T.windowRect = { u0: x0 / 256, u1: x1 / 256, v0: 1 - y1 / 384, v1: 1 - y0 / 384 };
  }

  { // soft cloud puff for ground mist
    const [c, g] = canvas(128, 128);
    for (let i = 0; i < 26; i++) {
      const x = rr(30, 98), y = rr(40, 88), r = rr(14, 34);
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, 'rgba(255,255,255,.22)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    }
    T.cloud = finish(c);
  }

  { // blackboard, three cells wide
    const [c, g] = canvas(768, 384);
    wallBase(g, 768, 384);
    g.fillStyle = '#5a4a32'; g.fillRect(24, 66, 720, 170);
    g.fillStyle = '#1f3a2c'; g.fillRect(32, 72, 704, 156);
    for (let i = 0; i < 700; i++) { g.fillStyle = `rgba(220,230,220,${rand() * .06})`; g.fillRect(rr(32, 736), rr(72, 228), rr(2, 18), rr(1, 4)); }
    g.fillStyle = 'rgba(235,240,230,.75)'; g.font = '22px serif';
    ['九月二十九日 (金)', '日直: ', '', '下校 18:00'].forEach((t, i) => g.fillText(t, 52, 104 + i * 30));
    g.font = '40px serif'; g.fillText('文化祭 準備', 290, 150);
    g.font = '18px serif'; g.fillText('2-B', 330, 190);
    g.strokeStyle = 'rgba(235,240,230,.5)'; g.lineWidth = 2;
    g.beginPath(); g.arc(640, 150, 46, 0, 7); g.stroke();      // a circle someone drew and nobody erased
    g.beginPath(); for (let k = 0; k < 6; k++) { const a = k * Math.PI * 4 / 5 - Math.PI / 2; g.lineTo(640 + Math.cos(a) * 46, 150 + Math.sin(a) * 46); } g.stroke();
    g.fillStyle = '#6a5a40'; g.fillRect(28, 228, 712, 8);
    g.fillStyle = '#eee'; g.fillRect(120, 229, 18, 4); g.fillStyle = '#f7a'; g.fillRect(160, 229, 14, 4); g.fillStyle = '#9cf'; g.fillRect(560, 229, 16, 4);
    T.blackboard = finish(c);
    T.blackboardN = normalFrom(c, 1.5);
  }

  { // shoe lockers (getabako)
    const [c, g] = canvas(256, 384);
    g.fillStyle = '#8a8f8c'; g.fillRect(0, 0, 256, 384);
    const cols = 4, rows = 6, cw = 256 / cols, ch = 330 / rows;
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const px = x * cw + 4, py = 20 + y * ch + 4;
      g.fillStyle = '#9da39f'; g.fillRect(px, py, cw - 8, ch - 8);
      g.fillStyle = '#6f7572'; g.fillRect(px, py + ch - 14, cw - 8, 6);
      g.fillStyle = '#f2efe4'; g.fillRect(px + 12, py + 8, cw - 32, 12);
      g.fillStyle = '#333'; g.fillRect(px + 16, py + 12, rr(8, cw - 40), 3);
      g.fillStyle = '#5c625f'; g.fillRect(px + (cw - 8) / 2 - 8, py + 28, 16, 4);
    }
    noise(g, 256, 384, 2500, 0.06);
    grime(g, 256, 384, 0.8);
    T.lockers = finish(c);
    T.lockersN = normalFrom(c, 3);
  }

  { // fire shutter
    const [c, g] = canvas(256, 384);
    for (let y = 0; y < 384; y += 12) {
      const gr = g.createLinearGradient(0, y, 0, y + 12);
      gr.addColorStop(0, '#9a9d9f'); gr.addColorStop(.5, '#6c7073'); gr.addColorStop(1, '#45494c');
      g.fillStyle = gr; g.fillRect(0, y, 256, 12);
    }
    noise(g, 256, 384, 3000, 0.08);
    for (let i = 0; i < 8; i++) {   // rust
      g.fillStyle = `rgba(110,50,20,${rr(.1, .3)})`; g.fillRect(rr(0, 256), rr(200, 384), rr(4, 30), rr(10, 120));
    }
    g.fillStyle = '#b11'; g.fillRect(86, 30, 84, 26);
    g.fillStyle = '#fff'; g.font = 'bold 18px sans-serif'; g.fillText('防火戸', 101, 50);
    // handprints on the inside of the glass that isn't there
    g.fillStyle = 'rgba(30,20,20,.25)';
    for (let i = 0; i < 4; i++) { g.beginPath(); g.ellipse(rr(60, 200), rr(140, 260), 9, 12, 0, 0, 7); g.fill(); }
    T.shutter = finish(c);
    T.shutterN = normalFrom(c, 4);
  }

  { // light panel
    const [c, g] = canvas(64, 32);
    g.fillStyle = '#fffdf2'; g.fillRect(0, 0, 64, 32);
    g.fillStyle = '#bfc4c0'; g.fillRect(0, 0, 64, 3); g.fillRect(0, 29, 64, 3); g.fillRect(31, 0, 2, 32);
    T.panel = finish(c);
  }

  { // blood/stain decal
    const [c, g] = canvas(128, 128);
    for (let i = 0; i < 9; i++) {
      const gr = g.createRadialGradient(64 + rr(-20, 20), 64 + rr(-20, 20), 2, 64, 64, rr(20, 50));
      gr.addColorStop(0, 'rgba(70,6,10,.85)'); gr.addColorStop(1, 'rgba(70,6,10,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    }
    T.stain = finish(c);
  }

  { // paper scrap
    const [c, g] = canvas(64, 64);
    g.fillStyle = '#efe9da'; g.fillRect(4, 2, 56, 60);
    g.fillStyle = 'rgba(40,40,60,.55)';
    for (let i = 0; i < 9; i++) g.fillRect(10, 10 + i * 5.5, rr(18, 40), 1.5);
    T.paper = finish(c);
  }

  { // soft glow sprite for particles
    const [c, g] = canvas(64, 64);
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.3, 'rgba(255,255,255,.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    T.glow = finish(c);
  }

  { // toon ramp: three hard bands
    const data = new Uint8Array([62, 66, 84, 255, 165, 165, 172, 255, 255, 255, 255, 255]);
    const t = new THREE.DataTexture(data, 3, 1, THREE.RGBAFormat);
    t.minFilter = t.magFilter = THREE.NearestFilter; t.generateMipmaps = false; t.needsUpdate = true;
    T.ramp = t;
  }

  { // stripes for the mime's shirt
    const [c, g] = canvas(16, 64);
    for (let y = 0; y < 64; y += 16) { g.fillStyle = '#f4f1ea'; g.fillRect(0, y, 16, 8); g.fillStyle = '#16161c'; g.fillRect(0, y + 8, 16, 8); }
    T.stripes = finish(c, { repeat: true });
  }

  return T;
}
