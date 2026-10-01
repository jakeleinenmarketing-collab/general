// Demon;Coder web test: renderer, exploration, story beats. Battles live in battle.js.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { makeTextures } from './textures.js';
import { buildAtmosphere } from './atmosphere.js';
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
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;

function fit() {
  const s = Math.min(innerWidth / 16, innerHeight / 9);
  frame.style.width = s * 16 + 'px'; frame.style.height = s * 9 + 'px';
  hudEl.style.transform = `scale(${(s * 16) / 1280})`;
}
addEventListener('resize', fit); fit();

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x010202);
scene.fog = new THREE.FogExp2(0x010203, 0.105);
const T = makeTextures();
game.T = T; game.scene = scene;

// The view is pushed up so the horizon sits above the laptop.
const camera = new THREE.PerspectiveCamera(78, VIEW_W / (VIEW_H * 1.24), 0.05, 80);
camera.setViewOffset(VIEW_W, VIEW_H * 1.24, 0, VIEW_H * 0.24, VIEW_W, VIEW_H);
game.camera = camera;
scene.add(camera);

const hemi = new THREE.HemisphereLight(0x4a5a66, 0x0c0a0a, 0.22);
scene.add(hemi);
// the only light Naomi carries is her laptop screen, held low and in front
const lantern = new THREE.PointLight(0x9ff0ff, 3.6, 7, 1.1);
lantern.position.set(0.15, -0.75, -0.35);
camera.add(lantern);

const L = buildLevel(scene, T);
game.level = L;
const atmo = buildAtmosphere(scene, T, L);
game.atmo = atmo;
atmo.onStrike = (big) => setTimeout(() => sound.thunder(big), big ? 500 + Math.random() * 500 : 1400 + Math.random() * 900);
const fx = new Particles(scene, T.glow);
game.fx = fx;

// a brief point light for fire and lightning bursts
const burstLight = new THREE.PointLight(0xffffff, 0, 6, 1.5);
scene.add(burstLight);
game.burst = (pos, color, intensity) => { burstLight.position.copy(pos); burstLight.color.set(color); burstLight.intensity = intensity; };

// ------------------------------------------------------------------ post
// Render, bloom for halation, tone map, then a display-space finish: crushed blacks, a green-amber grade,
// ordered dither, grain, and two effects the game drives (the battle swirl and demon static).
const composer = new EffectComposer(renderer);
composer.setPixelRatio(1);
composer.setSize(VIEW_W, VIEW_H);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(VIEW_W, VIEW_H), 0.5, 0.6, 0.72);
composer.addPass(bloom);
composer.addPass(new OutputPass());
const grade = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, time: { value: 0 }, hurt: { value: 0 }, warp: { value: 0 }, danger: { value: 0 }, flash: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float time, hurt, warp, danger, flash; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    float bayer(vec2 p){ int x = int(mod(p.x, 4.0)), y = int(mod(p.y, 4.0)); int i = x + y * 4;
      int b[16] = int[16](0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5); return float(b[i]) / 16.0 - 0.5; }
    void main(){
      vec2 uv = vUv;
      vec2 d = uv - 0.5;
      // battle swirl: the corridor twists into the dark
      float r = length(d * vec2(1.78, 1.0));
      float ang = warp * warp * 9.0 * (1.0 - smoothstep(0.0, 0.9, r));
      d = mat2(cos(ang), -sin(ang), sin(ang), cos(ang)) * d * (1.0 + warp * 0.6);
      uv = 0.5 + d;
      // demon static: torn scanlines that thicken as an encounter gets close
      float row = floor(uv.y * 120.0);
      float tear = step(1.0 - danger * 0.09, h(vec2(row, floor(time * 14.0))));
      uv.x += (h(vec2(row * 1.7, floor(time * 30.0))) - 0.5) * 0.05 * tear * danger;
      float ab = 0.0012 + length(d) * 0.004 + hurt * 0.006 + danger * tear * 0.01;
      vec3 c = vec3(texture2D(tDiffuse, uv + d * ab).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv - d * ab).b);
      // grade: lift nothing, crush the floor, pull color toward sick green in the darks and amber in the lights
      c = max(c - 0.03, 0.0) * 1.08;
      float l = dot(c, vec3(0.299, 0.587, 0.114));
      c = mix(vec3(l), c, 0.68);
      c *= mix(vec3(0.78, 1.0, 0.92), vec3(1.07, 1.0, 0.86), smoothstep(0.05, 0.55, l));
      c = mix(c, c * c * (3.0 - 2.0 * c), 0.35);
      // vignette, heavy
      float v = smoothstep(0.95, 0.2, length((vUv - 0.5) * vec2(1.25, 1.05)));
      c *= mix(0.18, 1.0, v);
      c *= 1.0 - warp;
      c = mix(c, vec3(l * 1.3, l * 0.25, l * 0.25), hurt * 0.45);
      c += vec3(0.02, 0.0, 0.03) * tear * danger;
      // film grain and a faint line structure
      c += (h(gl_FragCoord.xy + fract(time * 13.0) * 100.0) - 0.5) * 0.045 * (0.35 + l);
      c *= 0.94 + 0.06 * step(0.5, fract(gl_FragCoord.y * 0.5));
      // quantize to a 5-bit-per-channel palette with ordered dither
      c = floor(c * 31.0 + 0.5 + bayer(gl_FragCoord.xy) * 0.9) / 31.0;
      gl_FragColor = vec4(c, 1.0);
    }`,
});
composer.addPass(grade);
game.grade = grade;

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
  L.arena.light.intensity = 2.6;
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
let last = performance.now(), brownout = 25, power = 1;
const clock0 = performance.now();
function frameLoop(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  const t = (now - clock0) / 1000;
  player.pitch += (player.pitchTarget - player.pitch) * Math.min(1, dt * 5);
  if (player.anim) player.anim(now);
  else placeCamera();
  camera.rotation.z = Math.sin(t * 0.6) * 0.004;
  camera.position.y += Math.sin(t * 1.2) * 0.006;
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
      if (f.light) f.light.userData.flickOff = on;
    }
  }
  // weather: clouds over the moon, lightning, mist
  const flash = atmo.update(t, dt);
  hemi.intensity = 0.22 + flash * 1.4;
  // the building's power is failing; now and then every tube browns out at once
  brownout -= dt;
  if (brownout <= 0) { brownout = 35 + Math.random() * 40; power = 0; sound.brownout(); }
  power = Math.min(1, power + dt * (power < 0.12 ? 0.05 : 0.9));
  for (const l of L.lights) { l.userData.base ??= l.intensity; if (l !== L.arena.light) l.intensity = l.userData.base * (0.06 + 0.94 * power) * (l.userData.flickOff ? 0.15 : 1); }
  // the laptop screen breathes a little
  lantern.intensity = 3.6 * (0.92 + Math.sin(t * 3.1) * 0.04 + (Math.random() < 0.01 ? -0.4 : 0));
  // demon static: builds with every step past the grace period, outside the safe rooms
  const z = zoneOf(player.x, player.y);
  const dangerTarget = (z === 'NURSE' || z === 'ENTRANCE' || game.onFrame) ? 0 : THREE.MathUtils.clamp((game.stepsSinceFight - ENCOUNTERS.graceSteps + 3) / 9, 0, 1);
  game.danger = (game.danger || 0) + (dangerTarget - (game.danger || 0)) * Math.min(1, dt * 2);
  grade.uniforms.danger.value = game.danger * (0.5 + 0.5 * Math.sin(t * 7.0) ** 2);
  hud.setSignal(game.danger);
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
  if (params.has('open')) { game.flags.shutterOpen = true; L.shutter.position.y += 2.8; L.arena.light.intensity = 2.6; L.arena.anna.root.visible = true; mime.root.visible = true; }
  if (!params.has('skip')) await intro();
  else document.getElementById('card').style.display = 'none';
  startAmbience();
  game.fight = (group) => runBattle(game, group);     // test hook
  window.ready = true;
  if (params.has('battle')) {
    game.busy = true;
    const out = await runBattle(game, params.get('battle').split(','));
    if (out === 'lose') return gameOver();
  }
  game.busy = false;
})();
