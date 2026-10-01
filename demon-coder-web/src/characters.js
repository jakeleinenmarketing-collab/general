// Characters are built from primitives at load time: cel-shaded, ink-outlined, lit by the world.
// The original designs are a starting point; clean and readable beats faithful.
import * as THREE from 'three';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const INK = 0x0b0a10;

// Cold rim light on every lit surface; battle code may tint it.
export const RIM = { value: new THREE.Color(0.20, 0.30, 0.42) };

// Shared shader patch: a burn-in/burn-out dissolve for every material, rim light for lit ones,
// and the inverted-hull push for outlines.
const DIS_GLSL = `uniform float dissolve; varying vec3 vDis;
float dh(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float dn3(vec3 p){ vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(dh(i), dh(i + vec3(1,0,0)), f.x), mix(dh(i + vec3(0,1,0)), dh(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(dh(i + vec3(0,0,1)), dh(i + vec3(1,0,1)), f.x), mix(dh(i + vec3(0,1,1)), dh(i + vec3(1,1,1)), f.x), f.y), f.z); }
`;
function patch(m, rig, { lit = false, thickness = 0 } = {}) {
  m.onBeforeCompile = (sh) => {
    sh.uniforms.dissolve = rig.dissolve;
    if (lit) sh.uniforms.rimColor = RIM;
    if (thickness) sh.uniforms.thickness = { value: thickness };
    sh.vertexShader = 'varying vec3 vDis;\n' + (thickness ? 'uniform float thickness;\n' : '') + sh.vertexShader.replace('#include <begin_vertex>',
      (thickness ? 'vec3 transformed = position + normalize(normal) * thickness;' : '#include <begin_vertex>') +
      '\nvDis = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = DIS_GLSL + (lit ? 'uniform vec3 rimColor;\n' : '') + sh.fragmentShader
      .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\nfloat dnv = dn3(vDis * 9.0) * 0.7 + dn3(vDis * 23.0) * 0.3;\nif (dnv < dissolve) discard;')
      .replace('#include <opaque_fragment>',
        (lit ? 'outgoingLight += rimColor * pow(1.0 - clamp(abs(dot(normalize(normal), normalize(vViewPosition))), 0.0, 1.0), 2.5);\n' : '') +
        'if (dissolve > 0.0) outgoingLight += vec3(1.0, 0.3, 0.85) * 3.0 * (1.0 - smoothstep(dissolve, dissolve + 0.07, dnv));\n#include <opaque_fragment>');
  };
  m.customProgramCacheKey = () => (lit ? 'rigL' : 'rigF') + (thickness ? 'O' : '');
}

// One Rig per character instance, so hit flashes and dissolves never bleed into another model.
class Rig {
  constructor(T, name) {
    this.T = T; this.name = name;
    this.root = new THREE.Group();
    this.body = new THREE.Group();
    this.root.add(this.body);
    this.mats = [];
    this.outlines = new Map();
    this.dissolve = { value: 0 };
    this.flashAmt = 0; this.flashColor = new THREE.Color(1, 1, 1);
  }
  mat(color, opts = {}) {
    const m = new THREE.MeshToonMaterial({ color, gradientMap: this.T.ramp, ...opts });
    m.userData.baseEmissive = m.emissive.clone();
    m.userData.baseIntensity = m.emissiveIntensity;
    patch(m, this, { lit: true });
    this.mats.push(m);
    return m;
  }
  flat(color, opts = {}) {
    const m = new THREE.MeshBasicMaterial({ color, ...opts });
    patch(m, this);
    return m;
  }
  outline(thickness) {
    const key = thickness.toFixed(4);
    if (!this.outlines.has(key)) {
      const m = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide });
      patch(m, this, { thickness });
      this.outlines.set(key, m);
    }
    return this.outlines.get(key);
  }
  add(geo, mat, parent, pos, { outline = 0.014, scale, rot } = {}) {
    const mesh = new THREE.Mesh(geo, typeof mat === 'number' ? this.mat(mat) : mat);
    if (pos) mesh.position.copy(pos);
    if (scale) mesh.scale.set(...(Array.isArray(scale) ? scale : [scale, scale, scale]));
    if (rot) mesh.rotation.set(...rot);
    mesh.castShadow = !mesh.material.transparent;
    if (outline > 0) mesh.add(new THREE.Mesh(geo, this.outline(outline * 1.2)));
    (parent || this.body).add(mesh);
    return mesh;
  }
  group(parent, pos) {
    const g = new THREE.Group();
    if (pos) g.position.copy(pos);
    (parent || this.body).add(g);
    return g;
  }
  setFlash(amt, color) {
    if (color) this.flashColor.set(color);
    this.flashAmt = amt;
    for (const m of this.mats) {
      m.emissive.copy(m.userData.baseEmissive).lerp(this.flashColor, amt);
      m.emissiveIntensity = m.userData.baseIntensity + amt * 1.4;
    }
  }
}

const sphere = (r, w = 20, h = 14, ...arc) => new THREE.SphereGeometry(r, w, h, ...arc);
const cyl = (rt, rb, h, s = 14) => new THREE.CylinderGeometry(rt, rb, h, s);
const capsule = (r, l) => new THREE.CapsuleGeometry(r, l, 6, 12);
const cone = (r, h, s = 14) => new THREE.ConeGeometry(r, h, s);
const lathe = (pts, s = 24) => new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), s);

// ---------------------------------------------------------------- faces
function animeEyes(rig, head, { iris = 0x3a2140, y = 0.0, x = 0.048, z = 0.112, size = 1, lashes = true }) {
  const eyes = [];
  for (const s of [-1, 1]) {
    const eye = rig.group(head, V(s * x, y, z));
    eye.rotation.y = s * 0.32;
    const white = rig.add(sphere(0.03, 16, 12), rig.flat(0xfbf8f2), eye, V(0, 0, -0.004), { outline: 0, scale: [1.05 * size, 1.25 * size, 0.35] });
    const irisM = rig.add(sphere(0.024, 16, 12), rig.flat(iris), eye, V(-s * 0.002, -0.002, 0.004), { outline: 0, scale: [0.92 * size, 1.25 * size, 0.3] });
    const shine = rig.add(sphere(0.008, 8, 6), rig.flat(0xffffff), eye, V(s * 0.008, 0.012, 0.012), { outline: 0 });
    if (lashes) rig.add(new THREE.BoxGeometry(0.066 * size, 0.009, 0.01), rig.flat(0x120d14), eye, V(0, 0.036 * size, 0.004), { outline: 0, rot: [0, 0, s * -0.12] });
    eyes.push({ g: eye, white, iris: irisM, shine });
  }
  return eyes;
}

function brows(rig, head, { y = 0.058, x = 0.05, z = 0.122, color = 0x1a1418 }) {
  return [-1, 1].map((s) => {
    const b = rig.add(new THREE.BoxGeometry(0.044, 0.006, 0.008), rig.flat(color), head, V(s * x, y, z), { outline: 0 });
    b.rotation.set(0, s * 0.3, s * -0.05);
    b.userData.side = s;
    return b;
  });
}

function blinkEyes(eyes, amt) {
  for (const e of eyes) e.g.scale.y = Math.max(0.08, 1 - amt);
}

// ---------------------------------------------------------------- student (Touma/Naomi, Anna, bodies)
export function makeStudent(T, o = {}) {
  const opt = {
    name: 'student', coat: false, hair: 0x18141d, hairShine: 0x2c2840, skin: 0xf6d8c6, iris: 0x3a2140,
    uniform: 'sailor', ponytail: false, male: false, closedEyes: false, laptop: false, ...o,
  };
  const rig = new Rig(T, opt.name);
  const b = rig.body;
  const skin = rig.mat(opt.skin, { emissive: 0x3a2018 });
  const legs = rig.mat(opt.male ? 0x15161c : 0x1c1b24);

  // legs + shoes
  const legL = rig.group(b, V(-0.075, 0.8, 0)), legR = rig.group(b, V(0.075, 0.8, 0));
  for (const leg of [legL, legR]) {
    rig.add(capsule(0.055, 0.62), legs, leg, V(0, -0.38, 0), { outline: 0.01 });
    rig.add(new THREE.BoxGeometry(0.11, 0.07, 0.2), rig.mat(0x241812), leg, V(0, -0.76, 0.03), { outline: 0.01 });
  }

  // lower body
  if (opt.male) {
    rig.add(cyl(0.16, 0.17, 0.22), 0x15161c, b, V(0, 0.82, 0));
  } else {
    rig.add(cyl(0.145, 0.27, 0.3, 16), rig.mat(0x1d2742), b, V(0, 0.78, 0));
  }

  // torso
  const torso = rig.group(b, V(0, 0.92, 0));
  let coatMat;
  if (opt.coat) {
    coatMat = rig.mat(0xf3c22c);
    rig.add(lathe([[0.001, -0.3], [0.24, -0.3], [0.22, -0.05], [0.18, 0.18], [0.16, 0.3], [0.12, 0.38], [0.001, 0.4]]), coatMat, torso, V(0, 0, 0));
    for (let i = 0; i < 4; i++) rig.add(sphere(0.016, 8, 6), rig.mat(0x3a2a14), torso, V(0.02, 0.28 - i * 0.13, 0.18 + i * 0.012), { outline: 0 });
    rig.add(new THREE.BoxGeometry(0.012, 0.6, 0.012), rig.mat(0xc59a1c), torso, V(0, 0.02, 0.2), { outline: 0, rot: [-0.13, 0, 0] });
    rig.add(new THREE.TorusGeometry(0.105, 0.035, 8, 20), coatMat, torso, V(0, 0.36, 0), { rot: [Math.PI / 2, 0, 0] });
    // hood resting on the shoulders
    rig.add(sphere(0.15, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), coatMat, torso, V(0, 0.38, -0.12), { scale: [1, 0.55, 0.8], rot: [-0.5, 0, 0] });
  } else if (opt.male) {
    rig.add(lathe([[0.001, -0.18], [0.2, -0.18], [0.19, 0.1], [0.16, 0.3], [0.1, 0.38], [0.001, 0.4]]), 0x15161c, torso);
    for (let i = 0; i < 4; i++) rig.add(sphere(0.013, 8, 6), rig.mat(0xd8b24a), torso, V(0, 0.3 - i * 0.12, 0.17), { outline: 0 });
    rig.add(cyl(0.085, 0.1, 0.06), 0x15161c, torso, V(0, 0.39, 0));
  } else {
    rig.add(lathe([[0.001, -0.1], [0.19, -0.1], [0.18, 0.1], [0.155, 0.3], [0.1, 0.38], [0.001, 0.4]]), 0xf1f0ea, torso);
    // sailor collar + bow
    rig.add(new THREE.BoxGeometry(0.3, 0.2, 0.02), rig.mat(0x1d2742), torso, V(0, 0.27, -0.14), { rot: [0.35, 0, 0] });
    rig.add(sphere(0.04, 10, 8), rig.mat(0xc8283a), torso, V(0, 0.25, 0.15), { scale: [1.6, 0.8, 0.6] });
  }

  // arms (pivot at shoulder so they can swing)
  const arms = [];
  for (const s of [-1, 1]) {
    const arm = rig.group(torso, V(s * 0.19, 0.32, 0));
    const sleeve = opt.coat ? coatMat : rig.mat(opt.male ? 0x15161c : 0xf1f0ea);
    rig.add(capsule(0.048, 0.36), sleeve, arm, V(0, -0.22, 0));
    rig.add(sphere(0.045, 12, 10), skin, arm, V(0, -0.47, 0.01));
    arm.rotation.z = s * 0.12;
    arms.push(arm);
  }
  if (opt.laptop) {
    const lap = rig.add(new THREE.BoxGeometry(0.3, 0.02, 0.22), rig.mat(0x2a2d34), arms[0], V(0.02, -0.45, 0.1), { rot: [0.2, 0, 1.4] });
    rig.add(new THREE.BoxGeometry(0.06, 0.003, 0.04), rig.mat(0x5dffb0, { emissive: 0x2a9963 }), lap, V(0.08, 0.012, 0.06), { outline: 0 });
  }

  // head
  const neck = rig.group(torso, V(0, 0.4, 0));
  rig.add(cyl(0.04, 0.045, 0.1), skin, neck, V(0, 0.03, 0), { outline: 0.008 });
  const head = rig.group(neck, V(0, 0.18, 0.005));
  rig.add(sphere(0.13, 24, 18), skin, head, V(0, 0, 0), { scale: [1, 1.04, 0.98] });
  let eyes = [];
  if (opt.closedEyes) {
    for (const s of [-1, 1]) rig.add(new THREE.BoxGeometry(0.05, 0.007, 0.01), rig.flat(0x2a1a20), head, V(s * 0.047, -0.01, 0.123), { outline: 0, rot: [0, s * 0.3, s * 0.15] });
  } else {
    eyes = animeEyes(rig, head, { iris: opt.iris, size: opt.male ? 0.8 : 1, lashes: !opt.male });
  }
  const br = brows(rig, head, { color: opt.hair });
  const mouth = rig.add(new THREE.BoxGeometry(0.028, 0.006, 0.01), rig.flat(0x7a2a34), head, V(0, -0.075, 0.122), { outline: 0 });
  if (!opt.male) for (const s of [-1, 1]) rig.add(new THREE.CircleGeometry(0.022, 12), rig.flat(0xff8a9a, { transparent: true, opacity: 0.35 }), head, V(s * 0.07, -0.045, 0.118), { outline: 0, rot: [0, s * 0.45, 0] });

  // hair
  const hair = rig.mat(opt.hair);
  rig.add(sphere(0.142, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.5), hair, head, V(0, 0.012, -0.006), { rot: [-0.32, 0, 0] });
  if (opt.male) {
    for (let i = 0; i < 5; i++) rig.add(cone(0.035, 0.09, 6), hair, head, V(-0.08 + i * 0.04, 0.085, 0.1), { rot: [2.6, 0, (i - 2) * 0.15], outline: 0.008 });
  } else {
    rig.add(sphere(0.145, 20, 14), hair, head, V(0, -0.015, -0.05), { scale: [1.02, 1.0, 0.9] });     // back volume
    for (let i = 0; i < 7; i++) {                                                                      // bangs
      const x = -0.1 + i * 0.033;
      rig.add(cone(0.03, 0.07 + (i % 2) * 0.02, 6), hair, head, V(x, 0.088, 0.108 - Math.abs(x) * 0.3), { rot: [2.95, 0, x * 1.4], outline: 0.006 });
    }
    for (const s of [-1, 1]) {
      const len = opt.ponytail ? 0.16 : 0.28;
      rig.add(cone(0.05, len, 8), hair, head, V(s * 0.125, -0.05 - len * 0.25, 0.03), { rot: [Math.PI, 0, s * -0.12] });
    }
    if (opt.ponytail) {
      rig.add(sphere(0.03, 8, 6), rig.mat(0xc8283a), head, V(0, 0.02, -0.15), { outline: 0.006 });
      rig.add(cone(0.06, 0.32, 10), hair, head, V(0, -0.12, -0.19), { rot: [Math.PI + 0.25, 0, 0] });
    } else {
      const bob = new THREE.CylinderGeometry(0.15, 0.16, 0.2, 20, 1, true, Math.PI * 0.32, Math.PI * 1.36);
      rig.add(bob, rig.mat(opt.hair, { side: THREE.DoubleSide }), head, V(0, -0.1, -0.015), { scale: [1, 1, 0.92] });     // bob, open at the face
    }
  }
  const shine = rig.add(new THREE.TorusGeometry(0.1, 0.008, 4, 20, Math.PI * 0.7), rig.flat(opt.hairShine), head, V(0, 0.09, 0.07), { outline: 0, rot: [-0.9, 0, Math.PI * 0.15] });

  rig.parts = { torso, head, neck, arms, legs: [legL, legR], eyes, brows: br, mouth, shine };
  rig.height = 1.62;
  rig.faceY = 1.5;

  let blinkT = 0, nextBlink = 2, glance = 0, glanceTarget = 0, nextGlance = 3;
  rig.update = (t, dt, st) => {
    const breathe = Math.sin(t * 2.1) * 0.012;
    torso.scale.y = 1 + breathe * 0.6;
    head.position.y = 0.18 + breathe * 0.4;
    // blink
    nextBlink -= dt;
    if (nextBlink < 0) { blinkT = 0.14; nextBlink = 1.5 + Math.random() * 3; }
    blinkT = Math.max(0, blinkT - dt);
    // glance around like the old status-bar faces
    nextGlance -= dt;
    if (nextGlance < 0) { glanceTarget = (Math.random() - 0.5) * 0.9; nextGlance = 1.2 + Math.random() * 2.5; if (Math.random() < 0.35) glanceTarget = 0; }
    glance += (glanceTarget - glance) * Math.min(1, dt * 7);
    head.rotation.y = glance;
    head.rotation.z = Math.sin(t * 0.9) * 0.03;
    const hurt = st?.hurt || 0, low = st?.low ? 1 : 0, attack = st?.attack || 0, scared = st?.scared || 0;
    blinkEyes(eyes, blinkT > 0 ? 1 : hurt * 0.75 + low * 0.25);
    for (const bw of br) {
      const s = bw.userData.side;
      bw.rotation.z = s * (-0.05 + (hurt * 0.45 + low * 0.25 + scared * 0.35));
      bw.position.y = 0.058 - hurt * 0.008 + scared * 0.01;
    }
    mouth.scale.set(1 + scared * 0.3, 1 + hurt * 3 + scared * 4, 1);
    head.rotation.x = -hurt * 0.25 + low * 0.12 - attack * 0.1;
    torso.rotation.x = attack * 0.25 - hurt * 0.12;
    arms[1].rotation.x = -attack * 1.6 - scared * 1.15;
    arms[0].rotation.x = -scared * 1.05;
    arms[0].rotation.z = -0.12 + scared * 0.6; arms[1].rotation.z = 0.12 - scared * 0.6;
  };
  return rig;
}

// ---------------------------------------------------------------- Gibbles: the thing that counts
export function makeGibbles(T) {
  const rig = new Rig(T, 'gibbles');
  const b = rig.group(rig.body, V(0, 1.2, 0));
  const skin = rig.mat(0x6a35a8, { emissive: 0x1a0830 });
  rig.add(sphere(0.26, 28, 20), skin, b, V(0, 0, 0), { scale: [1, 0.92, 0.95], outline: 0.016 });
  rig.add(sphere(0.17, 20, 14), rig.mat(0xb48ce0), b, V(0, -0.07, 0.13), { scale: [1, 0.9, 0.5], outline: 0 });
  const horn = rig.mat(0xf1e6c8);
  for (const s of [-1, 1]) {
    const h = rig.group(b, V(s * 0.14, 0.18, 0));
    rig.add(cone(0.05, 0.16, 10), horn, h, V(0, 0.07, 0), { rot: [0, 0, s * -0.5] });
    rig.add(cone(0.028, 0.08, 8), horn, h, V(s * 0.06, 0.16, 0), { rot: [0, 0, s * -1.2] });
  }
  const eyes = [];
  for (const s of [-1, 1]) {
    const e = rig.group(b, V(s * 0.09, 0.06, 0.22));
    e.rotation.y = s * 0.35;
    rig.add(sphere(0.062, 16, 12), rig.flat(0xfff3a0), e, V(0, 0, 0), { scale: [1, 1.1, 0.45], outline: 0.008 });
    const pupil = rig.add(sphere(0.02, 10, 8), rig.flat(0x120814), e, V(0, 0, 0.022), { outline: 0, scale: [0.6, 2.2, 0.4] });
    eyes.push({ g: e, pupil });
  }
  const mouth = rig.group(b, V(0, -0.07, 0.235));
  rig.add(sphere(0.12, 20, 10, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.5), rig.flat(0x2a0718), mouth, V(0, 0.01, -0.02), { outline: 0, scale: [1, 0.6, 0.35] });
  for (let i = 0; i < 7; i++) {
    const x = -0.09 + i * 0.03;
    rig.add(cone(0.013, 0.035, 4), rig.flat(0xffffff), mouth, V(x, 0.0, 0.01 - Math.abs(x) * 0.3), { outline: 0, rot: [Math.PI, 0, 0] });
  }
  const wings = [];
  const wingShape = new THREE.Shape();
  wingShape.moveTo(0, 0); wingShape.lineTo(0.34, 0.2); wingShape.quadraticCurveTo(0.36, 0.05, 0.3, -0.04);
  wingShape.quadraticCurveTo(0.24, 0.02, 0.2, -0.06); wingShape.quadraticCurveTo(0.14, 0.0, 0.1, -0.08); wingShape.lineTo(0, 0);
  const wingGeo = new THREE.ShapeGeometry(wingShape);
  const wingMat = rig.mat(0x3a1a64, { side: THREE.DoubleSide });
  for (const s of [-1, 1]) {
    const w = rig.group(b, V(s * 0.18, 0.06, -0.12));
    const m = rig.add(wingGeo, wingMat, w, V(0, 0, 0), { outline: 0, scale: [s, 1, 1] });
    wings.push(w);
  }
  const tailCurve = new THREE.CatmullRomCurve3([V(0, -0.15, -0.2), V(0, -0.3, -0.35), V(0.1, -0.25, -0.5), V(0.15, -0.1, -0.55)]);
  rig.add(new THREE.TubeGeometry(tailCurve, 16, 0.022, 6), skin, b, V(0, 0, 0), { outline: 0.008 });
  rig.add(cone(0.05, 0.1, 4), skin, b, V(0.17, -0.04, -0.55), { rot: [0, 0, -0.6], outline: 0.008 });
  for (const s of [-1, 1]) rig.add(sphere(0.05, 10, 8), skin, b, V(s * 0.1, -0.24, 0.05), { scale: [1, 0.7, 1.2] });

  rig.parts = { b, eyes, mouth, wings };
  rig.height = 1.5; rig.faceY = 1.25;
  let blink = 0, next = 2;
  rig.update = (t, dt, st) => {
    b.position.y = 1.2 + Math.sin(t * 2.6) * 0.04;
    b.rotation.z = Math.sin(t * 1.3) * 0.06;
    b.rotation.y = Math.sin(t * 0.7) * 0.25;
    for (const [i, w] of wings.entries()) w.rotation.y = (i ? -1 : 1) * (0.3 + Math.sin(t * 14) * 0.5);
    next -= dt; if (next < 0) { blink = 0.12; next = 2 + Math.random() * 3; }
    blink = Math.max(0, blink - dt);
    const hurt = st?.hurt || 0, attack = st?.attack || 0;
    for (const e of eyes) { e.g.scale.y = blink > 0 ? 0.1 : 1 - hurt * 0.6; e.pupil.position.x = Math.sin(t * 0.8) * 0.012; }
    mouth.scale.set(1 + attack * 0.3, 1 + attack * 1.2 - hurt * 0.5, 1);
    b.scale.setScalar(1 + attack * 0.12);
  };
  return rig;
}

// ---------------------------------------------------------------- Sparkles: Naomi's cat, in the bag
export function makeSparkles(T) {
  const rig = new Rig(T, 'sparkles');
  const bag = rig.group(rig.body, V(0, 0.55, 0));
  const canvasMat = rig.mat(0x3e4f6b);
  rig.add(new THREE.BoxGeometry(0.5, 0.36, 0.26), canvasMat, bag, V(0, 0, 0), { outline: 0.012 });
  rig.add(new THREE.BoxGeometry(0.52, 0.05, 0.28), rig.mat(0x2d3a50), bag, V(0, 0.17, 0), { outline: 0.008 });
  for (const s of [-1, 1]) rig.add(new THREE.TorusGeometry(0.12, 0.014, 6, 16, Math.PI), rig.mat(0x2d3a50), bag, V(s * 0.15, 0.19, 0), { outline: 0.006 });
  const cat = rig.group(bag, V(0, 0.2, 0.02));
  const fur = rig.mat(0xf4efe6);
  const head = rig.group(cat, V(0, 0.1, 0));
  rig.add(sphere(0.14, 22, 16), fur, head, V(0, 0, 0), { scale: [1.15, 0.95, 1], outline: 0.012 });
  for (const s of [-1, 1]) {
    const ear = rig.group(head, V(s * 0.1, 0.1, -0.01));
    ear.rotation.z = s * -0.35;
    rig.add(cone(0.055, 0.11, 4), fur, ear, V(0, 0.04, 0), { outline: 0.008 });
    rig.add(cone(0.032, 0.07, 4), rig.mat(0xffa6b8), ear, V(0, 0.035, 0.018), { outline: 0 });
    ear.userData.side = s;
  }
  const ears = head.children.filter((c) => c.userData.side);
  const eyes = [];
  for (const s of [-1, 1]) {
    const e = rig.group(head, V(s * 0.06, 0.01, 0.115));
    e.rotation.y = s * 0.35;
    rig.add(sphere(0.036, 14, 10), rig.flat(0x56c9a8), e, V(0, 0, 0), { scale: [1, 1.15, 0.4], outline: 0.006 });
    rig.add(sphere(0.018, 10, 8), rig.flat(0x10120f), e, V(0, 0, 0.01), { scale: [0.6, 1.5, 0.4], outline: 0 });
    rig.add(sphere(0.008, 6, 6), rig.flat(0xffffff), e, V(s * 0.01, 0.014, 0.016), { outline: 0 });
    eyes.push({ g: e });
  }
  rig.add(sphere(0.014, 8, 6), rig.flat(0xff8fa8), head, V(0, -0.035, 0.138), { outline: 0, scale: [1.3, 0.8, 0.8] });
  for (const s of [-1, 1]) for (const k of [-1, 1]) {
    rig.add(new THREE.BoxGeometry(0.1, 0.003, 0.003), rig.flat(0x777777), head, V(s * 0.1, -0.045 + k * 0.012, 0.11), { outline: 0, rot: [0, 0, k * s * 0.15] });
  }
  for (const s of [-1, 1]) rig.add(sphere(0.045, 10, 8), fur, cat, V(s * 0.12, -0.02, 0.12), { scale: [1, 0.7, 1.3], outline: 0.008 });
  // the sparkle on her forehead that gives her the name
  rig.add(new THREE.OctahedronGeometry(0.02), rig.flat(0xffe27a), head, V(0, 0.07, 0.12), { outline: 0, scale: [0.6, 1.4, 0.3] });

  rig.parts = { bag, cat, head, eyes, ears };
  rig.height = 1.0; rig.faceY = 0.85;
  let blink = 0, next = 1.5, twitch = 0;
  rig.update = (t, dt, st) => {
    cat.position.y = 0.2 + Math.sin(t * 1.7) * 0.01;
    head.rotation.z = Math.sin(t * 0.8) * 0.12;
    head.rotation.y = Math.sin(t * 0.45) * 0.3;
    next -= dt; if (next < 0) { blink = 0.12; next = 1.5 + Math.random() * 3; if (Math.random() < .5) twitch = 0.25; }
    blink = Math.max(0, blink - dt); twitch = Math.max(0, twitch - dt);
    const hurt = st?.hurt || 0, attack = st?.attack || 0;
    for (const e of eyes) e.g.scale.y = blink > 0 ? 0.1 : 1 - hurt * 0.7;
    ears.forEach((e) => { e.rotation.z = e.userData.side * (-0.35 - hurt * 0.8) + (twitch > 0 ? Math.sin(t * 60) * 0.2 : 0); });
    cat.position.z = 0.02 + attack * 0.12;
    cat.position.y += attack * 0.08;
  };
  return rig;
}

// ---------------------------------------------------------------- Bowl of Calamari
export function makeCalamari(T) {
  const rig = new Rig(T, 'calamari');
  const root = rig.group(rig.body, V(0, 0.55, 0));
  const ceramic = rig.mat(0xf2efe8);
  rig.add(lathe([[0.001, -0.28], [0.18, -0.3], [0.2, -0.26], [0.38, -0.12], [0.5, 0.08], [0.53, 0.14], [0.5, 0.14], [0.36, -0.06], [0.001, -0.18]], 32), ceramic, root, V(0, 0, 0), { outline: 0.016 });
  rig.add(new THREE.TorusGeometry(0.47, 0.022, 6, 40), rig.mat(0x2a56b8), root, V(0, 0.06, 0), { rot: [Math.PI / 2, 0, 0], outline: 0 });
  rig.add(new THREE.TorusGeometry(0.42, 0.012, 6, 40), rig.mat(0xc8283a), root, V(0, -0.0, 0), { rot: [Math.PI / 2, 0, 0], outline: 0, scale: [1, 1, 1] });
  rig.add(new THREE.CircleGeometry(0.47, 32), rig.mat(0xd9862e, { emissive: 0x4a1a00 }), root, V(0, 0.1, 0), { rot: [-Math.PI / 2, 0, 0], outline: 0 });
  for (let i = 0; i < 3; i++) rig.add(new THREE.TorusGeometry(0.05, 0.02, 6, 12), rig.mat(0x7ab84a), root, V(-0.25 + i * 0.12, 0.11, 0.22 - i * 0.05), { rot: [-Math.PI / 2, 0, 0], outline: 0 });
  rig.add(new THREE.CylinderGeometry(0.06, 0.06, 0.012, 16), rig.mat(0xf6f0ee), root, V(0.24, 0.11, -0.12), { outline: 0.006 });
  // chopsticks
  for (const s of [0, 1]) rig.add(cyl(0.008, 0.014, 0.8, 6), rig.mat(0xb5803a), root, V(-0.32 + s * 0.06, 0.38, -0.2), { rot: [0.25, 0, 0.45 + s * 0.08], outline: 0.006 });

  const flesh = rig.mat(0xe98fb0, { emissive: 0x2a0410 });
  const sucker = rig.mat(0xffd0de);
  // mantle (the squid's head) rising out of the broth
  const head = rig.group(root, V(0, 0.38, 0));
  rig.add(lathe([[0.001, -0.2], [0.17, -0.18], [0.2, 0.05], [0.16, 0.28], [0.06, 0.42], [0.001, 0.45]], 24), flesh, head, V(0, 0, 0), { outline: 0.014 });
  for (const s of [-1, 1]) rig.add(new THREE.CircleGeometry(0.16, 3), rig.mat(0xe17aa0, { side: THREE.DoubleSide }), head, V(s * 0.12, 0.32, 0), { rot: [0, s * Math.PI / 2, s * 0.6], outline: 0 });
  const eyes = [];
  for (const s of [-1, 1]) {
    const e = rig.group(head, V(s * 0.09, -0.02, 0.16));
    e.rotation.y = s * 0.4;
    rig.add(sphere(0.07, 16, 12), rig.flat(0xfffbe8), e, V(0, 0, 0), { scale: [1, 1.15, 0.6], outline: 0.008 });
    const p = rig.add(sphere(0.035, 12, 10), rig.flat(0x0c0a10), e, V(0, -0.01, 0.035), { outline: 0, scale: [1, 1, 0.5] });
    rig.add(sphere(0.012, 6, 6), rig.flat(0xffffff), e, V(0.015, 0.02, 0.05), { outline: 0 });
    rig.add(new THREE.BoxGeometry(0.11, 0.02, 0.02), rig.flat(0x5a1028), e, V(0, 0.075, 0.03), { rot: [0, 0, s * 0.45], outline: 0 });
    eyes.push({ g: e, p });
  }

  // tentacles: chains of spheres, waved every frame
  const tentacles = [];
  const N = 8, SEG = 11;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2 + 0.2;
    const segs = [];
    for (let k = 0; k < SEG; k++) {
      const r = 0.06 * (1 - k / SEG * 0.75);
      const m = rig.add(sphere(r, 10, 8), flesh, root, V(0, 0, 0), { outline: 0.008 });
      if (k % 2 === 1) rig.add(sphere(r * 0.38, 6, 6), sucker, m, V(0, -r * 0.6, r * 0.6), { outline: 0 });
      segs.push(m);
    }
    tentacles.push({ a, segs, phase: Math.random() * 6 });
  }
  rig.parts = { root, head, eyes, tentacles };
  rig.height = 1.4; rig.faceY = 0.95;
  const tmp = new THREE.Vector3();
  rig.update = (t, dt, st) => {
    const hurt = st?.hurt || 0, attack = st?.attack || 0;
    root.position.y = 0.55 + Math.sin(t * 1.8) * 0.05;
    root.rotation.z = Math.sin(t * 1.1) * 0.05 + hurt * Math.sin(t * 50) * 0.08;
    head.position.y = 0.38 + Math.sin(t * 2.2) * 0.03 + attack * 0.15;
    head.rotation.x = -attack * 0.4;
    head.scale.set(1 + Math.sin(t * 3) * 0.03, 1 - Math.sin(t * 3) * 0.03, 1);
    for (const e of eyes) { e.g.scale.y = 1 - hurt * 0.8; e.p.position.x = Math.sin(t * 0.7) * 0.012; }
    for (const ten of tentacles) {
      let x = Math.cos(ten.a) * 0.2, z = Math.sin(ten.a) * 0.2, y = 0.12;
      let dir = Math.atan2(z, x), pitch = 0.9;
      for (let k = 0; k < ten.segs.length; k++) {
        const w = Math.sin(t * 2.4 + ten.phase + k * 0.55) * 0.35 * (k / ten.segs.length + 0.3);
        pitch -= 0.17 - attack * 0.08;
        const step = 0.07 * (1 - k / ten.segs.length * 0.4) * (1 + attack * 0.5);
        x += Math.cos(dir + w) * Math.cos(pitch) * step;
        z += Math.sin(dir + w) * Math.cos(pitch) * step;
        y += Math.sin(pitch) * step;
        ten.segs[k].position.set(x, y, z);
      }
    }
  };
  return rig;
}

// ---------------------------------------------------------------- Naked Gnome
export function makeGnome(T) {
  const rig = new Rig(T, 'gnome');
  const g = rig.group(rig.body, V(0, 0, 0));
  const skin = rig.mat(0xf4b8a0);
  for (const s of [-1, 1]) {
    rig.add(capsule(0.06, 0.1), skin, g, V(s * 0.09, 0.14, 0));
    rig.add(sphere(0.075, 12, 10), rig.mat(0x5a3a24), g, V(s * 0.09, 0.05, 0.04), { scale: [1, 0.6, 1.5] });
  }
  const torso = rig.group(g, V(0, 0.45, 0));
  rig.add(sphere(0.25, 24, 18), skin, torso, V(0, 0, 0), { scale: [1, 1.05, 0.95], outline: 0.014 });
  rig.add(sphere(0.022, 8, 6), rig.mat(0xd08a78), torso, V(0, -0.02, 0.235), { outline: 0 });
  const arms = [];
  for (const s of [-1, 1]) {
    const a = rig.group(torso, V(s * 0.23, 0.08, 0));
    rig.add(capsule(0.05, 0.16), skin, a, V(s * 0.05, -0.1, 0), { rot: [0, 0, s * 0.5] });
    rig.add(sphere(0.055, 10, 8), skin, a, V(s * 0.11, -0.2, 0.02));
    arms.push(a);
  }
  // lantern
  const lantern = rig.group(arms[1], V(0.13, -0.32, 0.04));
  rig.add(cyl(0.05, 0.05, 0.1, 6), rig.mat(0xffe08a, { emissive: 0xffa630, emissiveIntensity: 1.2 }), lantern, V(0, 0, 0), { outline: 0.006 });
  rig.add(cone(0.065, 0.05, 6), rig.mat(0x2a2a2a), lantern, V(0, 0.075, 0), { outline: 0.006 });
  rig.add(new THREE.TorusGeometry(0.03, 0.006, 4, 10), rig.mat(0x2a2a2a), lantern, V(0, 0.12, 0), { outline: 0 });

  const head = rig.group(torso, V(0, 0.3, 0.02));
  rig.add(sphere(0.15, 20, 16), skin, head, V(0, 0, 0), { outline: 0.012 });
  rig.add(sphere(0.06, 14, 10), rig.mat(0xe86a6a), head, V(0, -0.01, 0.15), { outline: 0.008 });     // nose
  for (const s of [-1, 1]) rig.add(new THREE.CircleGeometry(0.03, 10), rig.flat(0xff6a7a, { transparent: true, opacity: 0.4 }), head, V(s * 0.08, -0.03, 0.13), { outline: 0, rot: [0, s * 0.5, 0] });
  const eyes = [];
  for (const s of [-1, 1]) {
    const e = rig.add(sphere(0.024, 10, 8), rig.flat(0x120d10), head, V(s * 0.06, 0.045, 0.135), { outline: 0, scale: [1, 1.3, 0.6] });
    rig.add(sphere(0.006, 6, 6), rig.flat(0xffffff), e, V(0.006, 0.008, 0.015), { outline: 0 });
    const brow = rig.add(new THREE.BoxGeometry(0.07, 0.025, 0.03), rig.mat(0xf6f6f2), head, V(s * 0.06, 0.085, 0.13), { outline: 0.006, rot: [0, 0, s * -0.35] });
    eyes.push({ e, brow });
  }
  // beard, long enough to keep him decent
  const beardMat = rig.mat(0xf6f4ee);
  rig.add(sphere(0.17, 18, 14), beardMat, head, V(0, -0.12, 0.08), { scale: [1, 0.9, 0.7], outline: 0.012 });
  rig.add(cone(0.21, 0.46, 16), beardMat, head, V(0, -0.36, 0.17), { rot: [Math.PI - 0.22, 0, 0], scale: [1, 1, 0.6], outline: 0.012 });
  for (const s of [-1, 1]) rig.add(sphere(0.06, 10, 8), beardMat, head, V(s * 0.06, -0.05, 0.15), { scale: [1.3, 0.6, 0.6], rot: [0, 0, s * -0.3], outline: 0.006 });
  // hat
  const hat = rig.group(head, V(0, 0.105, -0.015));
  const red = rig.mat(0xd8343a);
  rig.add(cone(0.17, 0.32, 18), red, hat, V(0, 0.16, 0), { outline: 0.012, rot: [-0.15, 0, 0] });
  const tip = rig.group(hat, V(0, 0.3, -0.05));
  rig.add(cone(0.07, 0.22, 12), red, tip, V(0, 0.08, -0.04), { outline: 0.01, rot: [-0.9, 0, 0] });
  rig.add(new THREE.TorusGeometry(0.15, 0.03, 8, 20), rig.mat(0xb0262c), hat, V(0, 0.01, 0), { rot: [Math.PI / 2 + 0.15, 0, 0], outline: 0.008 });

  rig.parts = { g, torso, head, arms, eyes, tip };
  rig.height = 1.2; rig.faceY = 0.78;
  rig.update = (t, dt, st) => {
    const hurt = st?.hurt || 0, attack = st?.attack || 0;
    const hop = Math.abs(Math.sin(t * 3.2)) * 0.04;
    g.position.y = hop;
    torso.scale.set(1 + hop * 0.6, 1 - hop * 0.6, 1);
    head.rotation.z = Math.sin(t * 1.6) * 0.1;
    tip.rotation.x = Math.sin(t * 2.2) * 0.3;
    arms[1].rotation.z = 0.3 + Math.sin(t * 3.2) * 0.15 - attack * 1.5;
    arms[0].rotation.z = -0.3 - Math.sin(t * 3.2) * 0.15;
    for (const e of eyes) { e.e.scale.y = 1.3 * (1 - hurt * 0.8); e.brow.position.y = 0.085 - attack * 0.015 + hurt * 0.01; }
    torso.rotation.x = attack * 0.35 - hurt * 0.2;
  };
  return rig;
}

// ---------------------------------------------------------------- The Mime (floor 1 boss)
export function makeMime(T) {
  const rig = new Rig(T, 'mime');
  const g = rig.group(rig.body, V(0, 0, 0));
  const black = rig.mat(0x16161c);
  const white = rig.mat(0xf6f3ee);
  for (const s of [-1, 1]) {
    rig.add(capsule(0.065, 0.95), black, g, V(s * 0.1, 0.55, 0));
    rig.add(new THREE.BoxGeometry(0.13, 0.08, 0.28), black, g, V(s * 0.1, 0.04, 0.05));
  }
  const torso = rig.group(g, V(0, 1.15, 0));
  const stripeTex = T.stripes.clone(); stripeTex.repeat.set(6, 4); stripeTex.needsUpdate = true;
  rig.add(lathe([[0.001, -0.18], [0.19, -0.18], [0.21, 0.1], [0.24, 0.4], [0.14, 0.52], [0.001, 0.54]], 24), rig.mat(0xffffff, { map: stripeTex }), torso);
  for (const s of [-1, 1]) rig.add(new THREE.BoxGeometry(0.035, 0.62, 0.02), rig.mat(0xc8283a), torso, V(s * 0.1, 0.15, 0.2), { rot: [-0.1, 0, 0], outline: 0.005 });
  rig.add(new THREE.TorusGeometry(0.13, 0.05, 8, 18), white, torso, V(0, 0.54, 0), { rot: [Math.PI / 2, 0, 0], scale: [1, 1, 0.6] });
  const arms = [];
  for (const s of [-1, 1]) {
    const sh = rig.group(torso, V(s * 0.25, 0.42, 0));
    const upper = rig.group(sh);
    rig.add(capsule(0.05, 0.32), black, upper, V(0, -0.2, 0));
    const fore = rig.group(upper, V(0, -0.4, 0));
    rig.add(capsule(0.045, 0.28), black, fore, V(0, -0.17, 0));
    const hand = rig.group(fore, V(0, -0.38, 0));
    rig.add(sphere(0.08, 14, 10), white, hand, V(0, 0, 0), { scale: [1, 1.2, 0.45] });
    for (let f = 0; f < 4; f++) rig.add(capsule(0.016, 0.07), white, hand, V(-0.045 + f * 0.03, 0.1, 0), { outline: 0.006 });
    rig.add(capsule(0.016, 0.05), white, hand, V(s * -0.075, 0.03, 0), { rot: [0, 0, s * 0.8], outline: 0.006 });
    arms.push({ sh, upper, fore, hand });
  }
  const head = rig.group(torso, V(0, 0.76, 0));
  rig.add(sphere(0.15, 24, 18), rig.mat(0xe9e6e0, { emissive: 0x111111 }), head, V(0, 0, 0), { scale: [0.92, 1.18, 0.95], outline: 0.012 });
  const eyes = [];
  for (const s of [-1, 1]) {
    const e = rig.add(new THREE.OctahedronGeometry(0.04), rig.flat(0x0a0a0e), head, V(s * 0.055, 0.03, 0.128), { outline: 0, scale: [0.55, 1.4, 0.2], rot: [0, s * 0.3, 0] });
    rig.add(new THREE.OctahedronGeometry(0.03), rig.flat(0x0a0a0e), head, V(s * 0.06, -0.035, 0.127), { outline: 0, scale: [0.25, 1.2, 0.2], rot: [0, s * 0.3, 0] });   // painted tear
    eyes.push(e);
  }
  const mouth = rig.group(head, V(0, -0.1, 0.12));
  rig.add(sphere(0.035, 12, 8), rig.flat(0xc8102a), mouth, V(0, 0, 0), { outline: 0, scale: [1.3, 0.5, 0.4] });
  const grin = rig.add(new THREE.TorusGeometry(0.06, 0.008, 4, 16, Math.PI), rig.flat(0x1a0004), head, V(0, -0.06, 0.13), { outline: 0, rot: [0, 0, Math.PI] });
  grin.visible = false;
  rig.add(sphere(0.165, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.45), black, head, V(0.03, 0.09, -0.01), { scale: [1.25, 0.5, 1.15], rot: [0, 0, -0.25] });     // beret
  rig.add(cyl(0.008, 0.008, 0.04, 6), black, head, V(0.05, 0.2, 0), { outline: 0 });

  // the glass that isn't there
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.6), new THREE.MeshBasicMaterial({
    color: 0x9fe8ff, alphaMap: T.glow, transparent: true, opacity: 0.03, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  }));
  glass.position.set(0, 1.55, 0.62);
  glass.scale.set(0.8, 0.7, 1);
  rig.body.add(glass);

  rig.parts = { g, torso, head, arms, eyes, mouth, grin, glass };
  rig.height = 2.2; rig.faceY = 2.0;
  rig.update = (t, dt, st) => {
    const hurt = st?.hurt || 0, attack = st?.attack || 0, enraged = st?.low ? 1 : 0;
    const sway = Math.sin(t * 1.4);
    torso.rotation.z = sway * 0.05;
    torso.position.y = 1.15 + Math.abs(Math.sin(t * 1.4)) * 0.03;
    head.rotation.z = Math.sin(t * 0.7) * 0.15 + hurt * 0.4;
    head.rotation.y = Math.sin(t * 0.5) * 0.2;
    // palms flat on the invisible pane, sliding to find the edge
    const slide = Math.sin(t * 1.1);
    arms.forEach((a, i) => {
      const s = i ? 1 : -1;
      a.upper.rotation.x = -1.25 - attack * 0.5;
      a.upper.rotation.z = s * (0.25 + (i ? slide : -slide) * 0.12);
      a.fore.rotation.x = -0.35 + attack * 0.3;
      a.hand.rotation.x = 1.55;
    });
    rig.parts.glass.material.opacity = 0.015 + Math.abs(slide) * 0.03 + attack * 0.06 + hurt * 0.05;
    rig.parts.glass.position.z = 0.62 + attack * 0.3;
    for (const e of eyes) e.scale.y = 1.4 * (1 - hurt * 0.7);
    rig.parts.mouth.visible = !enraged; rig.parts.grin.visible = !!enraged;
    torso.rotation.x = attack * 0.3;
  };
  return rig;
}

export const ROSTER = {
  touma: (T) => makeStudent(T, { name: 'touma', coat: true, laptop: true }),
  anna: (T) => makeStudent(T, { name: 'anna', hair: 0x5a3622, hairShine: 0x8a5a3a, iris: 0x4a3020, ponytail: true }),
  body_f: (T) => makeStudent(T, { name: 'body', hair: 0x2a2018, closedEyes: true }),
  body_m: (T) => makeStudent(T, { name: 'body', male: true, hair: 0x14110f, closedEyes: true }),
  gibbles: makeGibbles,
  sparkles: makeSparkles,
  calamari: makeCalamari,
  gnome: makeGnome,
  mime: makeMime,
};
