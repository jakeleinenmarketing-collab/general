// Demon;Coder web test: renderer, exploration, story beats. Battles live in battle.js.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { makeTextures } from './textures.js';
import { buildLevel, MAP, START, DIRS, CELL, at, isFloorCh, cellCenter, zoneOf, INTERACT } from './level.js';
import { ROSTER } from './characters.js';
import { Hud } from './hud.js';
import { Particles } from './fx.js';
import { runBattle } from './battle.js';
import { PARTY, NOTES, ENCOUNTERS, DOS } from './data.js';
import { initAudio, startAmbience, sound, playMusic, stopMusic } from './audio.js';

const params = new URLSearchParams(location.search);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const VIEW_W = 640, VIEW_H = 360;     // internal resolution; the canvas is scaled up with crisp pixels
const EYE = 1.55;

// ------------------------------------------------------------------ input
const KEYMAP = {
  ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
  KeyQ: 'strafeL', KeyE: 'strafeR', Space: 'ok', Enter: 'ok', NumpadEnter: 'ok', Escape: 'back', Backspace: 'back', KeyX: 'back', KeyY: 'y', KeyN: 'n',
};
class Input {
  constructor() {
    this.held = new Set();
    this.waiters = [];
    addEventListener('keydown', (e) => {
      const k = KEYMAP[e.code] || 'other';
      if (k !== 'other') e.preventDefault();
      if (e.repeat && this.waiters.length) return;
      this.held.add(k);
      if (!this.waiters.length) this.tap = k;     // remember quick taps that release before the next frame
      initAudio();
      const w = this.waiters.find((w) => !w.keys || w.keys.includes(k));
      if (w) { this.waiters.splice(this.waiters.indexOf(w), 1); w.res(k); }
    });
    addEventListener('keyup', (e) => this.held.delete(KEYMAP[e.code] || 'other'));
    addEventListener('blur', () => this.held.clear());
  }
  next(keys) { return new Promise((res) => this.waiters.push({ keys, res })); }
  get waiting() { return this.waiters.length > 0; }
}

// ------------------------------------------------------------------ game
const game = window.game = {
  input: new Input(),
  shake: 0,
  busy: true,
  read: new Set(),
  flags: {},
  stepsSinceFight: 0,
  onFrame: null,
  enemies: [],
};

const frame = document.getElementById('frame');
const canvas = document.getElementById('view');
const hudEl = document.getElementById('hud');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
renderer.setPixelRatio(1);
renderer.setSize(VIEW_W, VIEW_H, false);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
renderer.outputColorSpace = THREE.SRGBColorSpace;

function fit() {
  const s = Math.min(innerWidth / 16, innerHeight / 9);
  frame.style.width = s * 16 + 'px'; frame.style.height = s * 9 + 'px';
  hudEl.style.transform = `scale(${(s * 16) / 1280})`;
}
addEventListener('resize', fit); fit();

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x04060a);
scene.fog = new THREE.FogExp2(0x05070c, 0.075);
const T = makeTextures();
game.T = T; game.scene = scene;

// The view is pushed up so the horizon sits above the laptop.
const camera = new THREE.PerspectiveCamera(78, VIEW_W / (VIEW_H * 1.24), 0.05, 80);
camera.setViewOffset(VIEW_W, VIEW_H * 1.24, 0, VIEW_H * 0.24, VIEW_W, VIEW_H);
game.camera = camera;
scene.add(camera);

const hemi = new THREE.HemisphereLight(0x8aa0c8, 0x2a2420, 0.9);
scene.add(hemi);
const lantern = new THREE.PointLight(0xffd9a8, 6, 9, 1.0);
lantern.position.set(0, 0.2, 0.4);
camera.add(lantern);

const L = buildLevel(scene, T);
game.level = L;
const fx = new Particles(scene, T.glow);
game.fx = fx;

// a brief point light for fire and lightning bursts
const burstLight = new THREE.PointLight(0xffffff, 0, 6, 1.5);
scene.add(burstLight);
game.burst = (pos, color, intensity) => { burstLight.position.copy(pos); burstLight.color.set(color); burstLight.intensity = intensity; };

// ------------------------------------------------------------------ post
const composer = new EffectComposer(renderer);
composer.setPixelRatio(1);
composer.setSize(VIEW_W, VIEW_H);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(VIEW_W, VIEW_H), 0.5, 0.5, 0.9);
composer.addPass(bloom);
const grade = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, time: { value: 0 }, hurt: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float time; uniform float hurt; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233)) + time * 7.0) * 43758.5453); }
    void main(){
      vec2 uv = vUv;
      vec2 d = uv - 0.5;
      float ab = 0.0016 + hurt * 0.006;
      vec3 c = vec3(texture2D(tDiffuse, uv + d * ab).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv - d * ab).b);
      c = mix(c, c * vec3(0.92, 1.0, 1.06) + vec3(0.0, 0.006, 0.012), 0.6);   // cool shadows
      float v = smoothstep(0.85, 0.25, length(d * vec2(1.1, 1.0)));
      c *= mix(0.55, 1.0, v);
      c += (h(uv * 640.0) - 0.5) * 0.012 * (0.4 + dot(c, vec3(0.33)));
      c = mix(c, vec3(c.r * 1.4, c.g * 0.5, c.b * 0.5), hurt * 0.5);
      gl_FragColor = vec4(c, 1.0);
    }`,
});
composer.addPass(grade);
composer.addPass(new OutputPass());

// ------------------------------------------------------------------ party + hud
game.party = PARTY.map((p) => ({ ...p, hpNow: p.hp }));
const hud = new Hud(game);
game.hud = hud;
hud.buildParty(game.party);
hud.mode('explore');

// ------------------------------------------------------------------ player
const player = game.player = {
  x: START.x, y: START.y, dir: START.dir,
  pos: cellCenter(START.x, START.y).setY(EYE), yaw: -START.dir * Math.PI / 2, pitch: 0, pitchTarget: 0,
  anim: null,
};
function placeCamera(bob = 0) {
  camera.position.copy(player.pos);
  camera.position.y += bob;
  camera.rotation.set(player.pitch, player.yaw, 0, 'YXZ');
}

function walkable(x, y) {
  const c = at(x, y);
  if (!isFloorCh(c)) return false;
  if (c === 'S' && !game.flags.shutterOpen) return false;
  return true;
}

function tween(ms, fn) {
  return new Promise((res) => {
    const t0 = performance.now();
    player.anim = (now) => {
      const k = Math.min(1, (now - t0) / ms);
      fn(k);
      if (k === 1) { player.anim = null; res(); }
    };
  });
}
const ease = (k) => k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;

async function turnTo(dir) {
  const from = player.yaw;
  let to = -dir * Math.PI / 2;
  while (to - from > Math.PI) to -= Math.PI * 2;
  while (to - from < -Math.PI) to += Math.PI * 2;
  player.dir = (dir + 4) % 4;
  sound.turn();
  await tween(170, (k) => { player.yaw = from + (to - from) * ease(k); placeCamera(); });
  player.yaw = to;
}

async function stepTo(dx, dy) {
  const nx = player.x + dx, ny = player.y + dy;
  if (!walkable(nx, ny)) {
    sound.bump();
    const base = player.pos.clone();
    const dirv = new THREE.Vector3(dx, 0, dy).multiplyScalar(0.18);
    await tween(160, (k) => { player.pos.copy(base).addScaledVector(dirv, Math.sin(k * Math.PI)); placeCamera(); });
    player.pos.copy(base);
    return false;
  }
  const from = player.pos.clone(), to = cellCenter(nx, ny).setY(EYE);
  player.x = nx; player.y = ny;
  await tween(210, (k) => { player.pos.lerpVectors(from, to, ease(k)); placeCamera(Math.sin(k * Math.PI) * 0.045); });
  sound.step();
  hud.markVisited(nx, ny);
  return true;
}

function currentInteract() {
  const [dx, dy] = DIRS[player.dir];
  for (const it of INTERACT) {
    if (it.floor) {
      if ((it.x === player.x && it.y === player.y) || (it.x === player.x + dx && it.y === player.y + dy)) return it;
    } else if (it.x === player.x && it.y === player.y && it.dir === player.dir) return it;
  }
  return null;
}

// ------------------------------------------------------------------ story beats
async function interact(it) {
  game.busy = true;
  hud.prompt(null);
  if (it.action === 'rest') {
    for (const m of game.party) { m.hpNow = m.hp; hud.setHP(m); }
    sound.heal(); hud.toast('RESTED', 1400);
    await hud.dialogue('', 'You lie down behind the curtain for a minute. Nobody comes in. Everyone is healed.');
  } else {
    await hud.note(NOTES[it.note]);
    game.read.add(it.note);
    if (it.note === 'page' && !game.flags.shutterOpen) await openShutter();
  }
  game.busy = false;
}

async function openShutter() {
  await sleep(300);
  hud.toast('THE SHUTTER IS LIFTING', 2200);
  sound.shutter();
  game.shake = 0.08;
  const s = L.shutter, y0 = s.position.y;
  const t0 = performance.now();
  await new Promise((res) => {
    const id = setInterval(() => {
      const k = Math.min(1, (performance.now() - t0) / 2200);
      s.position.y = y0 + k * 2.8; game.shake = Math.max(game.shake, 0.02);
      if (k === 1) { clearInterval(id); res(); }
    }, 16);
  });
  game.flags.shutterOpen = true;
  L.arena.light.intensity = 6;
  L.arena.anna.root.visible = true;
  mime.root.visible = true;
  for (const it of INTERACT) if (it.note === 'page' && it.sprite) it.sprite.visible = false;
}

// The Mime waits behind Anna, hands on glass that isn't there.
const mime = ROSTER.mime(T);
{
  const c = cellCenter(28, 6);
  mime.root.position.set(c.x - 0.2, 0, c.z + 1.0);
  mime.root.rotation.y = -Math.PI / 2;
  mime.root.visible = false;
  scene.add(mime.root);
}

async function bossSequence() {
  game.busy = true;
  game.flags.bossStarted = true;
  await turnTo(1);
  const anna = L.arena.anna;
  anna.root.position.set(27 * CELL + 0.6, 0, 7 * CELL + 1.9);
  anna.root.rotation.y = -Math.PI / 2 - 0.5;
  await hud.dialogue('ANNA', "You're alive.");
  await hud.dialogue('', 'Behind her, something presses its white hands against glass that isn\'t there.');
  game.annaPose = 'scared';
  mime.root.position.set(27.6 * CELL, 0, 7 * CELL);
  const out = await runBattle(game, ['mime'], { rigs: [mime], keep: true });
  if (out === 'lose') return gameOver();
  hud.flash('#ffffff', 1600, 1);
  sound.white();
  await sleep(500);
  anna.root.rotation.order = 'YXZ';
  anna.root.rotation.set(-Math.PI / 2 + 0.02, 0.4, 0);
  anna.root.position.y = 0.12;
  game.annaPose = 'still';
  L.arena.light.intensity = 3;
  await sleep(1400);
  await hud.dialogue('GIBBLES', 'One.');
  await hud.card(`<h1>1F</h1><div>END OF THE WEB TEST SLICE</div><div class="small">Notes read: ${game.read.size} / 6</div><div class="small">[SPACE] keep walking around</div>`);
  game.busy = false;
}

async function gameOver() {
  stopMusic();
  await hud.card(`<h1>DEAD</h1><div>SOULS -600</div><div class="small">[SPACE] wake up at the entrance</div>`);
  const s = document.getElementById('soul-count');
  s.textContent = Math.max(0, parseInt(s.textContent, 10) - 600);
  for (const m of game.party) { m.hpNow = m.hp; hud.setHP(m); }
  player.x = START.x; player.y = START.y; player.dir = START.dir;
  player.pos.copy(cellCenter(START.x, START.y).setY(EYE)); player.yaw = -START.dir * Math.PI / 2;
  placeCamera();
  if (game.flags.bossStarted && !game.flags.bossDone) { game.flags.bossStarted = false; mime.rig?.setFlash?.(0); mime.root.visible = true; mime.root.scale.setScalar(1); }
  game.busy = false;
}

async function maybeEncounter() {
  const scripted = ENCOUNTERS.scripted.find((s) => s.x === player.x && s.y === player.y && !game.flags['enc' + s.x + s.y]);
  let group = null;
  if (scripted) { game.flags['enc' + scripted.x + scripted.y] = true; group = scripted.group; if (scripted.toast) hud.toast(scripted.toast); }
  else {
    const zone = zoneOf(player.x, player.y);
    game.stepsSinceFight++;
    if (zone !== 'NURSE' && zone !== 'ENTRANCE' && zone !== 'ARENA' && game.stepsSinceFight > ENCOUNTERS.graceSteps && Math.random() < ENCOUNTERS.chance) {
      group = ENCOUNTERS.pool[Math.floor(Math.random() * ENCOUNTERS.pool.length)];
    }
  }
  if (!group) return;
  game.busy = true;
  game.stepsSinceFight = 0;
  // face an open direction so the demons have somewhere to stand
  const [dx, dy] = DIRS[player.dir];
  if (!walkable(player.x + dx, player.y + dy)) {
    for (const d of [1, 3, 2]) { const nd = (player.dir + d) % 4; const [ax, ay] = DIRS[nd]; if (walkable(player.x + ax, player.y + ay)) { await turnTo(nd); break; } }
  }
  const out = await runBattle(game, group);
  if (out === 'lose') return gameOver();
  game.busy = false;
}

async function exploreTick() {
  if (game.busy || player.anim || game.input.waiting) return;
  const h = new Set(game.input.held);
  if (game.input.tap) { h.add(game.input.tap); game.input.tap = null; }
  const it = currentInteract();
  hud.prompt(it ? `[SPACE] ${it.label}` : null);
  if (h.has('ok') && it) { game.input.held.delete('ok'); return interact(it); }
  let moved = false;
  if (h.has('left')) { await turnTo(player.dir + 3); }
  else if (h.has('right')) { await turnTo(player.dir + 1); }
  else if (h.has('up')) { const [dx, dy] = DIRS[player.dir]; moved = await stepTo(dx, dy); }
  else if (h.has('down')) { const [dx, dy] = DIRS[(player.dir + 2) % 4]; moved = await stepTo(dx, dy); }
  else if (h.has('strafeL')) { const [dx, dy] = DIRS[(player.dir + 3) % 4]; moved = await stepTo(dx, dy); }
  else if (h.has('strafeR')) { const [dx, dy] = DIRS[(player.dir + 1) % 4]; moved = await stepTo(dx, dy); }
  if (moved) {
    hud.setLoc(zoneOf(player.x, player.y) === 'HALL' ? '1F HALL' : zoneOf(player.x, player.y));
    if (player.x >= 25 && !game.flags.bossStarted) return bossSequence();
    await maybeEncounter();
  }
}

// ------------------------------------------------------------------ intro
async function intro() {
  await hud.card(`<h1>DEMON;CODER</h1><div>web test build &middot; floor 1 slice</div><div class="small">WASD / arrows to move &middot; Q E strafe &middot; SPACE use &middot; X back</div><div class="small" style="margin-top:30px">[SPACE] start</div>`);
  initAudio();
  const dos = document.getElementById('dos'), pre = document.getElementById('dos-text');
  dos.style.display = 'block';
  pre.textContent = '';
  const cursor = () => (pre.dataset.c = '1');
  for (const line of DOS) {
    for (const ch of line.out) { pre.textContent += ch; if (ch.trim()) sound.type(); await sleep(14); }
    if (line.type) {
      await sleep(250);
      for (const ch of line.type) { pre.textContent += ch; sound.type(); await sleep(60 + Math.random() * 60); }
      await sleep(320);
    }
    if (line.key) {
      pre.textContent += '_';
      for (;;) {
        const k = await game.input.next();
        if (k === line.key) break;
        sound.back();
      }
      pre.textContent = pre.textContent.slice(0, -1) + 'Y';
      sound.ok();
      await sleep(400);
    }
  }
  cursor();
  await sleep(500);
  sound.white();
  hud.flash('#ffffff', 2400, 1);
  dos.style.display = 'none';
}

// ------------------------------------------------------------------ loop
let last = performance.now(), lightningAt = 8;
const clock0 = performance.now();
function frameLoop(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  const t = (now - clock0) / 1000;
  player.pitch += (player.pitchTarget - player.pitch) * Math.min(1, dt * 5);
  if (player.anim) player.anim(now);
  else placeCamera();
  // shake
  if (game.shake > 0) {
    camera.position.x += (Math.random() - .5) * game.shake; camera.position.y += (Math.random() - .5) * game.shake;
    game.shake = Math.max(0, game.shake - dt * 0.6);
  }
  burstLight.intensity *= Math.pow(0.02, dt);
  // flickering panels
  for (const f of L.flicker) {
    f.t -= dt;
    if (f.t <= 0) {
      const on = f.mesh.material !== f.off;
      f.mesh.material = on ? f.off : f.on;
      f.t = on ? 0.03 + Math.random() * 0.25 : 0.05 + Math.random() * (Math.random() < 0.3 ? 2.5 : 0.3);
      if (f.light) { f.light.userData.base ??= f.light.intensity; f.light.intensity = on ? f.light.userData.base * 0.15 : f.light.userData.base; }
    }
  }
  // lightning through the windows
  lightningAt -= dt;
  if (lightningAt <= 0) {
    lightningAt = 14 + Math.random() * 18;
    const flashes = [0, 120, 260];
    flashes.forEach((ms) => setTimeout(() => { L.windows.emissiveIntensity = 7; hemi.intensity = 2.2; }, ms));
    flashes.forEach((ms) => setTimeout(() => { L.windows.emissiveIntensity = 0.7; hemi.intensity = 0.9; }, ms + 60));
    setTimeout(() => sound.thunder(), 700);
  }
  for (const it of INTERACT) if (it.sprite?.visible) { it.sprite.position.y = it.sprite.userData.base + Math.sin(t * 2 + it.x) * 0.04; it.sprite.material.opacity = game.read.has(it.note) ? 0.25 : 0.7 + Math.sin(t * 3) * 0.3; }
  // arena
  if (L.arena.anna.root.visible && game.annaPose !== 'still') L.arena.anna.update(t, dt, { scared: 1 });
  if (mime.root.visible && !game.onFrame) mime.update(t, dt, {});
  if (game.onFrame) game.onFrame(t, dt);
  fx.update(dt);
  hud.updatePortraits(t, dt);
  if (!game.onFrame) hud.drawMap(player.x, player.y, player.dir, game.read);
  const low = game.party[0].hpNow / game.party[0].hp < 0.3;
  grade.uniforms.time.value = t;
  grade.uniforms.hurt.value = low ? 0.35 + Math.sin(t * 4) * 0.15 : 0;
  exploreTick();
  composer.render();
  requestAnimationFrame(frameLoop);
}

placeCamera();
hud.markVisited(player.x, player.y);
requestAnimationFrame(frameLoop);

(async () => {
  // test hooks: ?skip skips the intro, ?at=x,y,dir teleports, ?battle=kind starts a fight
  if (params.has('at')) {
    const [x, y, d] = params.get('at').split(',').map(Number);
    player.x = x; player.y = y; player.dir = d; player.pos.copy(cellCenter(x, y).setY(EYE)); player.yaw = -d * Math.PI / 2; hud.markVisited(x, y);
  }
  if (params.has('open')) { game.flags.shutterOpen = true; L.shutter.position.y += 2.8; L.arena.light.intensity = 6; L.arena.anna.root.visible = true; mime.root.visible = true; }
  if (!params.has('skip')) await intro();
  else document.getElementById('card').style.display = 'none';
  startAmbience();
  window.ready = true;
  if (params.has('battle')) {
    game.busy = true;
    const out = await runBattle(game, params.get('battle').split(','));
    if (out === 'lose') return gameOver();
  }
  game.busy = false;
})();
