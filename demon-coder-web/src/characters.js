// Characters are built from sculpted primitives at load time and lit like everything else in the world.
// Humans are proportioned like people; demons are meant to be wrong to look at.
import * as THREE from 'three';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

// Cold rim light on every lit surface; battle code may tint it.
export const RIM = { value: new THREE.Color(0.20, 0.30, 0.42) };

// Shared shader patch: a burn-in/burn-out dissolve for every material and rim light for lit ones.
const DIS_GLSL = `uniform float dissolve; varying vec3 vDis;
float dh(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float dn3(vec3 p){ vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(dh(i), dh(i + vec3(1,0,0)), f.x), mix(dh(i + vec3(0,1,0)), dh(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(dh(i + vec3(0,0,1)), dh(i + vec3(1,0,1)), f.x), mix(dh(i + vec3(0,1,1)), dh(i + vec3(1,1,1)), f.x), f.y), f.z); }
`;
function patch(m, rig, { lit = false } = {}) {
  m.onBeforeCompile = (sh) => {
    sh.uniforms.dissolve = rig.dissolve;
    if (lit) sh.uniforms.rimColor = RIM;
    sh.vertexShader = 'varying vec3 vDis;\n' + sh.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\nvDis = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = DIS_GLSL + (lit ? 'uniform vec3 rimColor;\n' : '') + sh.fragmentShader
      .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\nfloat dnv = dn3(vDis * 9.0) * 0.7 + dn3(vDis * 23.0) * 0.3;\nif (dnv < dissolve) discard;')
      .replace('#include <opaque_fragment>',
        (lit ? 'outgoingLight += rimColor * pow(1.0 - clamp(abs(dot(normalize(normal), normalize(vViewPosition))), 0.0, 1.0), 3.0);\n' : '') +
        'if (dissolve > 0.0) outgoingLight += vec3(1.0, 0.3, 0.85) * 3.0 * (1.0 - smoothstep(dissolve, dissolve + 0.07, dnv));\n#include <opaque_fragment>');
  };
  m.customProgramCacheKey = () => (lit ? 'rigL' : 'rigF');
}

// One Rig per character instance, so hit flashes and dissolves never bleed into another model.
class Rig {
  constructor(T, name) {
    this.T = T; this.name = name;
    this.root = new THREE.Group();
    this.body = new THREE.Group();
    this.root.add(this.body);
    this.mats = [];
    this.dissolve = { value: 0 };
    this.flashColor = new THREE.Color(1, 1, 1);
  }
  mat(color, opts = {}) {
    const m = new THREE.MeshStandardMaterial({ color, roughness: 0.7, ...opts });
    m.userData.baseEmissive = m.emissive.clone();
    m.userData.baseIntensity = m.emissiveIntensity;
    patch(m, this, { lit: true });
    this.mats.push(m);
    return m;
  }
  glow(color, opts = {}) {
    const m = new THREE.MeshBasicMaterial({ color, ...opts });
    patch(m, this);
    return m;
  }
  add(geo, mat, parent, pos, { scale, rot, shadow = true } = {}) {
    const mesh = new THREE.Mesh(geo, typeof mat === 'number' ? this.mat(mat) : mat);
    if (pos) mesh.position.copy(pos);
    if (scale) mesh.scale.set(...(Array.isArray(scale) ? scale : [scale, scale, scale]));
    if (rot) mesh.rotation.set(...rot);
    mesh.castShadow = shadow && !mesh.material.transparent;
    mesh.receiveShadow = true;
    (parent || this.body).add(mesh);
    return mesh;
  }
  group(parent, pos, rot) {
    const g = new THREE.Group();
    if (pos) g.position.copy(pos);
    if (rot) g.rotation.set(...rot);
    (parent || this.body).add(g);
    return g;
  }
  setFlash(amt, color) {
    if (color) this.flashColor.set(color);
    for (const m of this.mats) {
      m.emissive.copy(m.userData.baseEmissive).lerp(this.flashColor, amt);
      m.emissiveIntensity = m.userData.baseIntensity + amt * 1.4;
    }
  }
}

const sphere = (r, w = 24, h = 18, ...arc) => new THREE.SphereGeometry(r, w, h, ...arc);
const cyl = (rt, rb, h, s = 16, open = false, ts, tl) => new THREE.CylinderGeometry(rt, rb, h, s, 1, open, ts, tl);
const cone = (r, h, s = 12, hs = 1) => new THREE.ConeGeometry(r, h, s, hs);
const lathe = (pts, s = 28) => new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), s);
const gauss = (dx, dy, s) => Math.exp(-(dx * dx + dy * dy) / (s * s));

// Push every vertex through fn, then rebuild normals.
function sculpt(geo, fn) {
  const p = geo.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); fn(v); p.setXYZ(i, v.x, v.y, v.z); }
  geo.computeVertexNormals();
  return geo;
}
// A tapered limb segment, top at the origin, hanging down -y.
function limb(r0, r1, len, s = 12) {
  const g = new THREE.CylinderGeometry(r0, r1, len, s, 4);
  g.translate(0, -len / 2, 0);
  return g;
}

// ---------------------------------------------------------------- human head
// A sphere pushed into a face: longer skull, tapered jaw, sockets, brow, nose, cheekbones, lips.
function headGeometry({ gaunt = 0, wide = 0 } = {}) {
  const r = 0.1;
  return sculpt(new THREE.SphereGeometry(r, 64, 48), (v) => {
    v.y *= 1.15; v.x *= 0.84 + wide * 0.05;
    if (v.y < 0) {
      const t = -v.y / (r * 1.15);
      v.x *= 1 - (0.36 + gaunt * 0.08) * t * t;
      v.z *= 1 - 0.1 * t * t;
      if (v.z > 0) v.z += 0.01 * t;
    }
    if (v.z < 0) v.z *= 1.07;
    if (v.z > 0) {
      v.z *= 0.93;
      const f = Math.min(1, v.z / 0.05);
      for (const s of [-1, 1]) v.z -= (0.011 + gaunt * 0.004) * gauss(v.x - s * 0.033, v.y - 0.008, 0.019) * f;
      v.z += 0.006 * gauss(v.x * 0.55, v.y - 0.033, 0.028) * f;                         // brow ridge
      const nose = gauss(v.x, 0, 0.011) * (v.y < 0.026 && v.y > -0.032 ? Math.pow((0.026 - v.y) / 0.058, 0.8) : 0);
      v.z += nose * 0.024 * f;
      v.z += 0.008 * gauss(v.x, v.y + 0.032, 0.014) * f;                                   // nose tip
      for (const s of [-1, 1]) {
        const c = gauss(v.x - s * 0.048, v.y + 0.012, 0.022) * f;
        v.z += 0.004 * c; v.x += s * 0.003 * c;
        v.z -= gaunt * 0.006 * gauss(v.x - s * 0.045, v.y + 0.045, 0.02) * f;              // hollow cheeks
      }
      v.z += 0.005 * gauss(v.x * 0.45, v.y + 0.06, 0.009) * f;                            // lips
      v.z -= 0.003 * gauss(v.x * 0.5, v.y + 0.07, 0.006) * f;                             // under the lip
    }
  });
}
// Find the face surface in front of a point, so eyes and brows sit on it.
function surfaceZ(geo, x, y) {
  const p = geo.attributes.position; let best = -1, bz = 0;
  for (let i = 0; i < p.count; i++) {
    const z = p.getZ(i); if (z <= 0) continue;
    const d = (p.getX(i) - x) ** 2 + (p.getY(i) - y) ** 2;
    if (best < 0 || d < best) { best = d; bz = z; }
  }
  return bz;
}

function humanFace(rig, head, geo, { skin, iris = 0x2b1f1a, brow = 0x16120f, sclera = 0xcfc9be, eyes = true }) {
  rig.add(geo, skin, head);
  const parts = { eyes: [], lids: [], brows: [] };
  for (const s of [-1, 1]) {
    const ex = s * 0.033, ey = 0.008;
    const z = surfaceZ(geo, ex, ey);
    const eye = rig.group(head, V(ex, ey, z - 0.009));
    if (eyes) {
      rig.add(sphere(0.0125, 16, 12), rig.mat(sclera, { roughness: 0.25 }), eye, V(0, 0, 0), { scale: [1.15, 0.85, 1] });
      const iris_ = rig.add(sphere(0.0068, 12, 10), rig.mat(iris, { roughness: 0.1 }), eye, V(0, 0, 0.0108), { scale: [1, 1, 0.45] });
      rig.add(sphere(0.0013, 6, 4), rig.glow(0xd8dcd8), iris_, V(0.002, 0.002, 0.003));
      parts.eyes.push({ g: eye, iris: iris_ });
    }
    // upper lid: a skin shell that rotates down to blink, a little lowered by default
    const lid = rig.group(eye, V(0, 0, 0));
    rig.add(sphere(0.0138, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), skin, lid, V(0, 0, 0), { scale: [1.15, 1, 1.05], rot: [0.2, 0, 0] });
    lid.rotation.x = eyes ? -0.55 : 1.4;
    parts.lids.push(lid);
    const bz = surfaceZ(geo, s * 0.034, 0.03);
    const b = rig.add(new THREE.BoxGeometry(0.034, 0.0045, 0.006), rig.mat(brow), head, V(s * 0.034, 0.031, bz + 0.001), { rot: [0, s * 0.25, s * -0.08] });
    b.userData.side = s;
    parts.brows.push(b);
  }
  const mz = surfaceZ(geo, 0, -0.058);
  parts.mouth = rig.add(new THREE.BoxGeometry(0.03, 0.0025, 0.004), rig.mat(0x5a2a2a), head, V(0, -0.058, mz + 0.0015));
  return parts;
}

// ---------------------------------------------------------------- student (Touma/Naomi, Anna, bodies)
export function makeStudent(T, o = {}) {
  const opt = {
    name: 'student', coat: false, hair: 0x0b0a0d, skin: 0xc9a594, ponytail: false, male: false, closedEyes: false, laptop: false, ...o,
  };
  const rig = new Rig(T, opt.name);
  const b = rig.body;
  const skin = rig.mat(opt.skin, { roughness: 0.62 });
  const tights = rig.mat(opt.male ? 0x121318 : 0x0d0d10, { roughness: 0.45 });
  const shoe = rig.mat(0x16100c, { roughness: 0.3 });

  const legs = [];
  for (const s of [-1, 1]) {
    const hip = rig.group(b, V(s * 0.075, 0.84, 0), [0, 0, s * 0.03]);
    rig.add(limb(0.068, 0.05, 0.42), tights, hip);
    const knee = rig.group(hip, V(0, -0.42, 0), [0.04, 0, 0]);
    rig.add(limb(0.05, 0.032, 0.37), tights, knee);
    rig.add(sculpt(sphere(0.05, 16, 10), (v) => { v.z *= 2.1; v.y *= 0.55; if (v.y < 0) v.y *= 0.3; }), shoe, knee, V(0, -0.39, 0.035));
    legs.push(hip);
  }

  if (opt.male) {
    rig.add(cyl(0.16, 0.17, 0.2), rig.mat(0x121318, { roughness: 0.6 }), b, V(0, 0.84, 0));
  } else {
    // skirt with knife pleats
    const skirt = sculpt(cyl(0.155, 0.235, 0.3, 64, true), (v) => {
      const a = Math.atan2(v.z, v.x), k = (0.15 - v.y) / 0.3;
      const pleat = Math.abs(((a / (Math.PI * 2)) * 28 % 1 + 1) % 1 - 0.5) * 2;
      const r = Math.hypot(v.x, v.z) * (1 + pleat * 0.06 * k);
      v.x = Math.cos(a) * r; v.z = Math.sin(a) * r;
    });
    rig.add(skirt, rig.mat(0x1a1f2e, { roughness: 0.8, side: THREE.DoubleSide }), b, V(0, 0.76, 0));
  }

  const torso = rig.group(b, V(0, 0.94, 0));
  let sleeve;
  if (opt.coat) {
    // a rain-slick mustard coat, too big for her
    const coat = rig.mat(0x9c7a2a, { roughness: 0.42 });
    sleeve = coat;
    rig.add(sculpt(lathe([[0.001, -0.36], [0.235, -0.36], [0.215, -0.15], [0.18, 0.04], [0.195, 0.22], [0.205, 0.31], [0.12, 0.39], [0.001, 0.4]], 40), (v) => { v.z *= 0.78; }), coat, torso);
    rig.add(new THREE.BoxGeometry(0.012, 0.72, 0.01), rig.mat(0x3a2e14, { roughness: 0.5 }), torso, V(0.025, 0.01, 0.168), { rot: [-0.05, 0, 0] });
    for (let i = 0; i < 4; i++) rig.add(cyl(0.011, 0.011, 0.008, 10), rig.mat(0x1c1610, { roughness: 0.3, metalness: 0.4 }), torso, V(0.045, 0.27 - i * 0.15, 0.17 - i * 0.004), { rot: [Math.PI / 2, 0, 0] });
    rig.add(sculpt(new THREE.TorusGeometry(0.1, 0.03, 10, 28), (v) => { v.y *= 0.6; }), coat, torso, V(0, 0.385, -0.005), { rot: [Math.PI / 2 + 0.12, 0, 0] });
    rig.add(sphere(0.15, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), coat, torso, V(0, 0.35, -0.11), { scale: [0.95, 0.45, 0.7], rot: [-0.7, 0, 0] });
  } else if (opt.male) {
    const jacket = rig.mat(0x121318, { roughness: 0.65 });
    sleeve = jacket;
    rig.add(sculpt(lathe([[0.001, -0.16], [0.19, -0.16], [0.18, 0.08], [0.2, 0.3], [0.1, 0.4], [0.001, 0.41]]), (v) => { v.z *= 0.75; }), jacket, torso);
    for (let i = 0; i < 4; i++) rig.add(cyl(0.01, 0.01, 0.008, 10), rig.mat(0x8a7230, { metalness: 0.8, roughness: 0.3 }), torso, V(0, 0.3 - i * 0.11, 0.142), { rot: [Math.PI / 2, 0, 0] });
  } else {
    const blouse = rig.mat(0xb9b8b2, { roughness: 0.75 });
    sleeve = blouse;
    rig.add(sculpt(lathe([[0.001, -0.12], [0.175, -0.12], [0.165, 0.08], [0.19, 0.28], [0.1, 0.4], [0.001, 0.41]]), (v) => { v.z *= 0.74; }), blouse, torso);
    rig.add(new THREE.BoxGeometry(0.3, 0.2, 0.012), rig.mat(0x1a1f2e, { roughness: 0.8 }), torso, V(0, 0.29, -0.13), { rot: [0.3, 0, 0] });
    rig.add(new THREE.BoxGeometry(0.04, 0.12, 0.012), rig.mat(0x5e161c, { roughness: 0.6 }), torso, V(0, 0.27, 0.142), { rot: [-0.15, 0, 0] });
  }

  const arms = [];
  for (const s of [-1, 1]) {
    const arm = rig.group(torso, V(s * 0.185, 0.33, -0.01), [0, 0, s * 0.1]);
    rig.add(limb(0.05, 0.042, 0.28), sleeve, arm);
    const elbow = rig.group(arm, V(0, -0.28, 0), [-0.15, 0, 0]);
    rig.add(limb(0.042, opt.coat ? 0.048 : 0.033, 0.25), sleeve, elbow);
    rig.add(sculpt(sphere(0.035, 14, 10), (v) => { v.y *= 1.5; v.z *= 0.6; }), skin, elbow, V(0, -0.29, 0));
    arm.userData.elbow = elbow;
    arms.push(arm);
  }
  if (opt.laptop) {
    const lap = rig.add(new THREE.BoxGeometry(0.32, 0.022, 0.23), rig.mat(0x1b1d22, { roughness: 0.35, metalness: 0.5 }), arms[0].userData.elbow, V(0.04, -0.26, 0.09), { rot: [0.25, 0, 1.45] });
    rig.add(new THREE.BoxGeometry(0.05, 0.003, 0.03), rig.glow(0x5dffb0), lap, V(0.1, 0.012, 0.07));
  }

  const neck = rig.group(torso, V(0, 0.4, 0));
  rig.add(cyl(0.038, 0.045, 0.11), skin, neck, V(0, 0.035, 0));
  const head = rig.group(neck, V(0, 0.155, 0.01));
  const hg = headGeometry({ gaunt: opt.male ? 0.3 : 0.15, wide: opt.male ? 0.5 : 0 });
  const face = humanFace(rig, head, hg, { skin, eyes: !opt.closedEyes, iris: opt.iris || 0x241a16 });

  // hair: a cap, a curtain down the back, and a fringe with a ragged edge
  const hair = rig.mat(opt.hair, { roughness: 0.32, side: THREE.DoubleSide });
  rig.add(sculpt(sphere(0.112, 40, 24, 0, Math.PI * 2, 0, Math.PI * 0.56), (v) => { v.y *= 1.1; v.x *= 0.97; if (v.z > 0) v.y += 0.01 * (v.z / 0.1); }), hair, head, V(0, 0.008, -0.008), { rot: [-0.3, 0, 0] });
  if (opt.male) {
    rig.add(sculpt(cyl(0.1, 0.095, 0.07, 32, true, Math.PI * 0.55, Math.PI * 0.9), (v) => { if (v.y < 0) v.y += (Math.random() - 0.5) * 0.01; }), hair, head, V(0, 0.05, 0.004));
  } else {
    const len = opt.ponytail ? 0.12 : 0.34;
    rig.add(sculpt(cyl(0.108, 0.125, len, 40, true, Math.PI * 0.36, Math.PI * 1.28), (v) => {
      if (v.y < 0) v.y += (Math.sin(Math.atan2(v.z, v.x) * 13) * 0.5 + 0.5) * 0.03 - 0.015;
    }), hair, head, V(0, 0.02 - len / 2 + 0.03, -0.01));
    // fringe: hangs to the brows, uneven
    rig.add(sculpt(cyl(0.088, 0.112, 0.07, 40, true, -Math.PI * 0.42, Math.PI * 0.84), (v) => {
      if (v.y < 0) v.y += Math.abs(Math.sin(Math.atan2(v.x, v.z) * 9)) * -0.018 + 0.012;
    }), hair, head, V(0, 0.072, 0.004), { rot: [0.12, 0, 0] });
    for (const s of [-1, 1]) rig.add(sculpt(new THREE.PlaneGeometry(0.03, 0.22, 1, 6), (v) => { v.z += (v.y * v.y) * 0.6; v.x += s * Math.max(0, -v.y) * 0.04; }), hair, head, V(s * 0.085, -0.06, 0.05), { rot: [0, s * 0.5, 0] });
    if (opt.ponytail) rig.add(sculpt(cone(0.05, 0.36, 16, 6), (v) => { v.z += Math.pow(Math.max(0, -v.y + 0.18), 2) * 0.4; }), hair, head, V(0, -0.12, -0.15), { rot: [Math.PI + 0.3, 0, 0] });
  }

  rig.parts = { torso, head, neck, arms, legs, ...face };
  rig.height = 1.62;
  rig.faceY = 1.5;

  let blinkT = 0, nextBlink = 2, glance = 0, glanceTarget = 0, nextGlance = 3;
  rig.update = (t, dt, st) => {
    const breathe = Math.sin(t * 1.7) * 0.008;
    torso.scale.set(1 + breathe * 0.4, 1 + breathe, 1 + breathe * 0.6);
    nextBlink -= dt;
    if (nextBlink < 0) { blinkT = 0.13; nextBlink = 2 + Math.random() * 4; }
    blinkT = Math.max(0, blinkT - dt);
    nextGlance -= dt;
    if (nextGlance < 0) { glanceTarget = (Math.random() - 0.5) * 0.7; nextGlance = 1.5 + Math.random() * 3; if (Math.random() < 0.4) glanceTarget = 0; }
    glance += (glanceTarget - glance) * Math.min(1, dt * 6);
    const hurt = st?.hurt || 0, low = st?.low ? 1 : 0, attack = st?.attack || 0, scared = st?.scared || 0;
    head.rotation.y = glance * (1 - hurt);
    head.rotation.z = Math.sin(t * 0.7) * 0.02 + hurt * 0.15;
    head.rotation.x = 0.1 - hurt * 0.2 + low * 0.18 - attack * 0.12 - scared * 0.1;
    for (const e of face.eyes) e.iris.position.x = glance * 0.004;
    const shut = blinkT > 0 ? 1 : Math.min(1, hurt * 0.9 + low * 0.3);
    for (const lid of face.lids) lid.rotation.x = opt.closedEyes ? 1.4 : -0.55 + shut * 1.9 - scared * 0.3;
    for (const bw of face.brows) { const s = bw.userData.side; bw.rotation.z = s * (-0.08 + hurt * 0.35 + low * 0.2 - scared * 0.3); bw.position.y = 0.031 - hurt * 0.004 + scared * 0.004; }
    face.mouth.scale.set(1 - scared * 0.2, 1 + hurt * 4 + scared * 5, 1);
    torso.rotation.x = attack * 0.2 - hurt * 0.1;
    arms[1].rotation.x = -attack * 1.4 - scared * 1.2;
    arms[0].rotation.x = -scared * 1.1;
    arms[0].rotation.z = -0.1 + scared * 0.55; arms[1].rotation.z = 0.1 - scared * 0.55;
    arms[0].userData.elbow.rotation.x = -0.15 - scared * 1.2; arms[1].userData.elbow.rotation.x = -0.15 - scared * 1.2 - attack * 0.4;
  };
  return rig;
}

// ---------------------------------------------------------------- Gibbles: a masked thing that counts
export function makeGibbles(T) {
  const rig = new Rig(T, 'gibbles');
  const b = rig.group(rig.body, V(0, 1.15, 0));
  const cloth = rig.mat(0x0c0a0e, { roughness: 0.9, side: THREE.DoubleSide });
  // a ragged black shroud that ends in tatters
  rig.add(sculpt(new THREE.CylinderGeometry(0.14, 0.3, 0.75, 48, 8, true), (v) => {
    const a = Math.atan2(v.z, v.x);
    if (v.y < -0.2) v.y -= Math.abs(Math.sin(a * 7)) * 0.16 + Math.abs(Math.sin(a * 17)) * 0.05;
    const r = Math.hypot(v.x, v.z) * (1 + Math.sin(a * 5 + v.y * 9) * 0.06);
    v.x = Math.cos(a) * r; v.z = Math.sin(a) * r;
  }), cloth, b, V(0, -0.3, 0));
  rig.add(sphere(0.15, 24, 16), cloth, b, V(0, 0.08, -0.02), { scale: [1, 1.05, 0.95] });
  // the mask: smooth porcelain, eye holes, a carved smile that is too wide
  const maskMat = rig.mat(0xd6d0c4, { roughness: 0.25, metalness: 0.05 });
  const mask = rig.group(b, V(0, 0.09, 0.07));
  const mg = sculpt(sphere(0.13, 48, 32, 0, Math.PI, 0, Math.PI), (v) => {
    v.y *= 1.25; v.x *= 0.85;
    if (v.z > 0) {
      for (const s of [-1, 1]) v.z -= 0.022 * gauss(v.x - s * 0.045, v.y - 0.03, 0.025);
      v.z += 0.012 * gauss(v.x, v.y, 0.012);
      v.z -= 0.012 * gauss(v.x * 0.25, v.y + 0.07, 0.01);
    }
  });
  rig.add(mg, maskMat, mask);
  const eyes = [];
  for (const s of [-1, 1]) {
    const z = surfaceZ(mg, s * 0.045, 0.03);
    rig.add(sculpt(new THREE.CircleGeometry(0.026, 20), (v) => { v.y *= 0.6; v.y += (v.x * s) * 0.25; }), rig.glow(0x000000), mask, V(s * 0.045, 0.03, z + 0.007));
    eyes.push(rig.add(sphere(0.006, 8, 6), rig.glow(0xffd54a), mask, V(s * 0.045, 0.03, z + 0.009)));
  }
  const smile = new THREE.Shape();
  smile.moveTo(-0.075, -0.045); smile.quadraticCurveTo(0, -0.12, 0.075, -0.045); smile.quadraticCurveTo(0, -0.098, -0.075, -0.045);
  const mz = surfaceZ(mg, 0, -0.075);
  rig.add(new THREE.ShapeGeometry(smile, 16), rig.glow(0x2a0004), mask, V(0, 0, mz + 0.002));
  for (let i = -3; i <= 3; i++) rig.add(new THREE.BoxGeometry(0.003, 0.016, 0.004), rig.glow(0x0a0002), mask, V(i * 0.018, -0.07 - (1 - Math.abs(i) / 4) * 0.018, mz + 0.004), { rot: [0, 0, i * 0.12] });
  rig.add(new THREE.BoxGeometry(0.002, 0.07, 0.003), rig.glow(0x120c08), mask, V(0.03, 0.09, surfaceZ(mg, 0.03, 0.09) + 0.001), { rot: [0, 0, 0.5] });
  // horns, long and back-swept, tapering to points
  const horn = rig.mat(0x2a221c, { roughness: 0.4 });
  for (const s of [-1, 1]) {
    const pts = []; for (let i = 0; i <= 10; i++) { const k = i / 10; pts.push(V(s * (0.07 + k * 0.08), 0.12 + k * 0.18, -0.02 - k * k * 0.16)); }
    const curve = new THREE.CatmullRomCurve3(pts);
    const tg = new THREE.TubeGeometry(curve, 16, 0.02, 8);
    const p = tg.attributes.position, v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) { const k = Math.floor(i / 9) / 16; const c = curve.getPoint(Math.min(1, k)); v.fromBufferAttribute(p, i).sub(c).multiplyScalar(1 - k * 0.85).add(c); p.setXYZ(i, v.x, v.y, v.z); }
    tg.computeVertexNormals();
    rig.add(tg, horn, b);
  }
  // long arms ending in black claws
  const skin = rig.mat(0x1a1520, { roughness: 0.5 });
  const arms = [];
  for (const s of [-1, 1]) {
    const sh = rig.group(b, V(s * 0.16, -0.02, 0), [0.4, 0, s * 0.5]);
    rig.add(limb(0.025, 0.018, 0.3), skin, sh);
    const el = rig.group(sh, V(0, -0.3, 0), [-0.9, 0, 0]);
    rig.add(limb(0.018, 0.012, 0.28), skin, el);
    for (let f = 0; f < 3; f++) rig.add(cone(0.006, 0.09, 6), rig.mat(0x0a080c, { roughness: 0.3 }), el, V((f - 1) * 0.012, -0.32, 0), { rot: [Math.PI, 0, (f - 1) * 0.2] });
    sh.userData.el = el;
    arms.push(sh);
  }

  rig.parts = { b, mask, eyes, arms };
  rig.height = 1.5; rig.faceY = 1.24;
  let off = 0, next = 3;
  rig.update = (t, dt, st) => {
    const hurt = st?.hurt || 0, attack = st?.attack || 0;
    b.position.y = 1.15 + Math.sin(t * 1.3) * 0.035;
    b.rotation.y = Math.sin(t * 0.4) * 0.2;
    mask.rotation.z = Math.sin(t * 0.6) * 0.1 + hurt * Math.sin(t * 60) * 0.1;
    mask.rotation.x = attack * 0.3 - Math.sin(t * 0.8) * 0.05;
    next -= dt; if (next < 0) { off = 0.15; next = 2 + Math.random() * 4; }
    off = Math.max(0, off - dt);
    for (const e of eyes) e.visible = off <= 0 && hurt < 0.6;
    arms.forEach((a, i) => { a.rotation.x = 0.4 + Math.sin(t * 1.1 + i) * 0.15 - attack * 1.2; a.userData.el.rotation.x = -0.9 - attack * 0.6 + Math.sin(t * 1.7 + i) * 0.1; });
  };
  return rig;
}

// ---------------------------------------------------------------- Sparkles: Naomi's cat, in the bag
export function makeSparkles(T) {
  const rig = new Rig(T, 'sparkles');
  const bag = rig.group(rig.body, V(0, 0.5, 0));
  const canvas = rig.mat(0x1d2230, { roughness: 0.95 });
  rig.add(sculpt(new THREE.BoxGeometry(0.52, 0.38, 0.26, 8, 6, 4), (v) => { v.x *= 1 - Math.abs(v.y) * 0.1; v.z *= 1 + (v.y + 0.19) * 0.25; v.x += Math.sin(v.y * 30) * 0.004; }), canvas, bag);
  for (const s of [-1, 1]) rig.add(new THREE.TorusGeometry(0.13, 0.012, 6, 18, Math.PI), rig.mat(0x121620, { roughness: 0.8 }), bag, V(s * 0.14, 0.19, 0));
  const fur = rig.mat(0x0d0c0e, { roughness: 0.55 });
  const cat = rig.group(bag, V(0, 0.2, 0.02));
  const head = rig.group(cat, V(0, 0.08, 0));
  rig.add(sculpt(sphere(0.1, 40, 28), (v) => {
    v.x *= 1.12; v.y *= 0.92;
    if (v.z > 0) { v.z += 0.025 * gauss(v.x, v.y + 0.035, 0.035); for (const s of [-1, 1]) v.z -= 0.012 * gauss(v.x - s * 0.04, v.y - 0.01, 0.02); }
  }), fur, head);
  const ears = [];
  for (const s of [-1, 1]) {
    const ear = rig.group(head, V(s * 0.065, 0.075, -0.005), [0, 0, s * -0.35]);
    rig.add(sculpt(cone(0.04, 0.09, 4), (v) => { v.z *= 0.35; }), fur, ear, V(0, 0.035, 0), { rot: [0, Math.PI / 4, 0] });
    ear.userData.side = s;
    ears.push(ear);
  }
  const eyes = [];
  for (const s of [-1, 1]) {
    const e = rig.group(head, V(s * 0.04, 0.012, 0.083), [0, s * 0.3, 0]);
    rig.add(sphere(0.019, 16, 12), rig.mat(0x6a9a2a, { roughness: 0.1, emissive: 0x1a3a08, emissiveIntensity: 0.6 }), e, V(0, 0, 0), { scale: [1.15, 0.9, 0.5] });
    e.userData.pupil = rig.add(new THREE.BoxGeometry(0.005, 0.03, 0.003), rig.glow(0x000000), e, V(0, 0, 0.009));
    eyes.push(e);
  }
  rig.add(sphere(0.007, 8, 6), rig.mat(0x1a1214), head, V(0, -0.02, 0.105));
  for (const s of [-1, 1]) rig.add(sculpt(sphere(0.03, 12, 8), (v) => { v.z *= 1.6; v.y *= 0.6; }), fur, cat, V(s * 0.1, -0.03, 0.11));

  rig.parts = { bag, cat, head, eyes, ears };
  rig.height = 1.0; rig.faceY = 0.78;
  let blink = 0, next = 2, twitch = 0;
  rig.update = (t, dt, st) => {
    const hurt = st?.hurt || 0, attack = st?.attack || 0;
    head.rotation.z = Math.sin(t * 0.5) * 0.08;
    head.rotation.y = Math.sin(t * 0.33) * 0.35;
    next -= dt; if (next < 0) { blink = 0.12; next = 2 + Math.random() * 4; if (Math.random() < 0.5) twitch = 0.2; }
    blink = Math.max(0, blink - dt); twitch = Math.max(0, twitch - dt);
    for (const e of eyes) { e.scale.y = blink > 0 ? 0.1 : 1 - hurt * 0.7; e.userData.pupil.scale.x = 1 + attack * 2; }
    for (const e of ears) e.rotation.z = e.userData.side * (-0.35 - hurt * 0.9 - attack * 0.7) + (twitch > 0 ? Math.sin(t * 60) * 0.15 : 0);
    cat.position.z = 0.02 + attack * 0.1; cat.position.y = 0.2 + attack * 0.06;
  };
  return rig;
}

// ---------------------------------------------------------------- Bowl of Calamari
export function makeCalamari(T) {
  const rig = new Rig(T, 'calamari');
  const root = rig.group(rig.body, V(0, 0.5, 0));
  const glaze = rig.mat(0x1e2a2c, { roughness: 0.15, metalness: 0.1 });
  rig.add(lathe([[0.001, -0.28], [0.18, -0.3], [0.2, -0.26], [0.38, -0.12], [0.5, 0.08], [0.53, 0.14], [0.5, 0.15], [0.36, -0.05], [0.001, -0.17]], 48), glaze, root);
  rig.add(new THREE.TorusGeometry(0.515, 0.012, 6, 48), rig.mat(0x6a1a14, { roughness: 0.3 }), root, V(0, 0.13, 0), { rot: [Math.PI / 2, 0, 0] });
  // broth: black and glossy, faintly lit from below
  rig.add(new THREE.CircleGeometry(0.47, 40), rig.mat(0x140804, { roughness: 0.05, emissive: 0x2a0800, emissiveIntensity: 0.6 }), root, V(0, 0.1, 0), { rot: [-Math.PI / 2, 0, 0] });
  for (const s of [0, 1]) rig.add(cyl(0.006, 0.011, 0.75, 6), rig.mat(0x3a2a1a, { roughness: 0.6 }), root, V(-0.3 + s * 0.05, 0.36, -0.22), { rot: [0.25, 0, 0.5 + s * 0.08] });
  const flesh = rig.mat(0xb7a4a0, { roughness: 0.22, emissive: 0x100406 });
  const sucker = rig.mat(0x6e4a4c, { roughness: 0.3 });
  // the mantle: long and pale, with a cluster of black eyes and a ring of teeth
  const head = rig.group(root, V(0, 0.3, 0));
  rig.add(sculpt(lathe([[0.001, -0.2], [0.16, -0.17], [0.19, 0.05], [0.15, 0.32], [0.07, 0.52], [0.001, 0.58]], 40), (v) => {
    v.x += Math.sin(v.y * 22) * 0.004; if (v.z > 0 && v.y < 0.02 && v.y > -0.15) v.z -= 0.03 * gauss(v.x, v.y + 0.07, 0.06);
  }), flesh, head);
  for (const s of [-1, 1]) rig.add(sculpt(new THREE.CircleGeometry(0.18, 20, 0, Math.PI), (v) => { v.z = v.x * v.x * 0.8; }), rig.mat(0x9a8682, { roughness: 0.3, side: THREE.DoubleSide }), head, V(s * 0.1, 0.42, 0), { rot: [0, s * Math.PI / 2, s * -0.4] });
  const eyes = [];
  const eyeMat = rig.mat(0x020203, { roughness: 0.02 });
  for (const [x, y, r] of [[-0.07, 0.1, 0.03], [0.07, 0.1, 0.03], [-0.11, 0.17, 0.018], [0.11, 0.17, 0.018], [0, 0.2, 0.022], [-0.04, 0.23, 0.012], [0.05, 0.24, 0.013], [-0.13, 0.07, 0.014], [0.13, 0.06, 0.015]]) {
    const z = Math.sqrt(Math.max(0, 0.16 * 0.16 - x * x)) * 0.98;
    eyes.push(rig.add(sphere(r, 12, 10), eyeMat, head, V(x, y, z)));
  }
  const mouth = rig.group(head, V(0, -0.07, 0.14));
  rig.add(new THREE.CircleGeometry(0.045, 20), rig.glow(0x120204), mouth, V(0, 0, 0));
  for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2; rig.add(cone(0.006, 0.025, 4), rig.mat(0xcfc6b0, { roughness: 0.3 }), mouth, V(Math.cos(a) * 0.04, Math.sin(a) * 0.04, 0.004), { rot: [0, 0, a + Math.PI / 2] }); }
  const tentacles = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.2;
    const segs = [];
    for (let k = 0; k < 14; k++) {
      const r = 0.055 * (1 - k / 14 * 0.82);
      const m = rig.add(sphere(r, 12, 8), flesh, root, V(0, 0, 0));
      if (k % 2 === 1) rig.add(sphere(r * 0.35, 6, 5), sucker, m, V(0, -r * 0.65, r * 0.55));
      segs.push(m);
    }
    tentacles.push({ a, segs, phase: Math.random() * 6 });
  }
  rig.parts = { root, head, eyes, tentacles };
  rig.height = 1.45; rig.faceY = 0.95;
  rig.update = (t, dt, st) => {
    const hurt = st?.hurt || 0, attack = st?.attack || 0;
    root.position.y = 0.5 + Math.sin(t * 1.4) * 0.04;
    root.rotation.z = Math.sin(t * 0.9) * 0.04 + hurt * Math.sin(t * 50) * 0.06;
    head.position.y = 0.3 + Math.sin(t * 1.8) * 0.025 + attack * 0.15;
    head.rotation.x = -attack * 0.45 + Math.sin(t * 0.7) * 0.05;
    const pulse = Math.sin(t * 2.6);
    head.scale.set(1 + pulse * 0.025, 1 - pulse * 0.02, 1 + pulse * 0.025);
    mouth.scale.setScalar(1 + attack * 0.8 + Math.max(0, pulse) * 0.1);
    eyes.forEach((e, i) => e.scale.setScalar(Math.sin(t * 3 + i * 1.7) > 0.97 ? 0.2 : 1));
    for (const ten of tentacles) {
      let x = Math.cos(ten.a) * 0.2, z = Math.sin(ten.a) * 0.2, y = 0.12, pitch = 0.95;
      const dir = Math.atan2(z, x);
      for (let k = 0; k < ten.segs.length; k++) {
        const w = Math.sin(t * 1.9 + ten.phase + k * 0.45) * 0.4 * (k / ten.segs.length + 0.25);
        pitch -= 0.14 - attack * 0.06;
        const step = 0.065 * (1 - k / ten.segs.length * 0.4) * (1 + attack * 0.5);
        x += Math.cos(dir + w) * Math.cos(pitch) * step; z += Math.sin(dir + w) * Math.cos(pitch) * step; y += Math.sin(pitch) * step;
        ten.segs[k].position.set(x, y, z);
      }
    }
  };
  return rig;
}

// ---------------------------------------------------------------- Naked Gnome: starved, grey, wearing only a hat and a beard
export function makeGnome(T) {
  const rig = new Rig(T, 'gnome');
  const g = rig.group(rig.body, V(0, 0, 0));
  g.scale.setScalar(1.35);
  const skin = rig.mat(0x6d7270, { roughness: 0.35 });
  for (const s of [-1, 1]) {
    const hip = rig.group(g, V(s * 0.08, 0.42, 0), [0.25, 0, s * 0.08]);
    rig.add(limb(0.04, 0.025, 0.24), skin, hip);
    const knee = rig.group(hip, V(0, -0.24, 0), [-0.6, 0, 0]);
    rig.add(limb(0.025, 0.02, 0.24), skin, knee);
    rig.add(sculpt(sphere(0.03, 10, 8), (v) => { v.z *= 2.6; v.y *= 0.4; }), skin, knee, V(0, -0.25, 0.04));
  }
  // hunched, ribs showing
  const torso = rig.group(g, V(0, 0.45, 0), [0.5, 0, 0]);
  rig.add(sculpt(sphere(0.13, 32, 24), (v) => {
    v.y *= 1.5; v.x *= 0.9;
    if (v.z > 0 && v.y > -0.02) v.z += Math.max(0, Math.sin(v.y * 95)) * 0.007;
    if (v.y < -0.05) v.z += 0.02 * (-v.y);
  }), skin, torso, V(0, 0.14, 0));
  const arms = [];
  for (const s of [-1, 1]) {
    const sh = rig.group(torso, V(s * 0.11, 0.3, 0), [0.3, 0, s * 0.3]);
    rig.add(limb(0.025, 0.018, 0.3), skin, sh);
    const el = rig.group(sh, V(0, -0.3, 0), [-0.4, 0, 0]);
    rig.add(limb(0.018, 0.014, 0.3), skin, el);
    for (let f = 0; f < 4; f++) rig.add(limb(0.006, 0.003, 0.11, 5), rig.mat(0x2e302f, { roughness: 0.4 }), el, V((f - 1.5) * 0.01, -0.3, 0), { rot: [0.2, 0, (f - 1.5) * 0.12] });
    sh.userData.el = el;
    arms.push(sh);
  }
  // lantern with a sick green flame
  const lantern = rig.group(arms[1].userData.el, V(0, -0.45, 0.03));
  rig.add(cyl(0.04, 0.045, 0.1, 6), rig.mat(0x1a1c18, { roughness: 0.4, metalness: 0.6, transparent: true, opacity: 0.6 }), lantern);
  const flame = rig.add(sphere(0.022, 10, 8), rig.glow(0x9aff6a), lantern, V(0, 0, 0), { scale: [1, 1.6, 1] });
  rig.add(new THREE.TorusGeometry(0.03, 0.004, 4, 10), rig.mat(0x1a1c18, { metalness: 0.7, roughness: 0.4 }), lantern, V(0, 0.09, 0));
  const glowLight = new THREE.PointLight(0x7aff4a, 1.2, 2.5, 1.6);
  lantern.add(glowLight);

  // head: long, narrow, hooked nose, a mouth that doesn't close
  const head = rig.group(torso, V(0, 0.36, 0.06), [-0.5, 0, 0]);
  const hg = sculpt(sphere(0.085, 48, 36), (v) => {
    v.y *= 1.25; v.x *= 0.85;
    if (v.y < 0) v.x *= 1 - (-v.y / 0.1) * 0.3;
    if (v.z > 0) {
      for (const s of [-1, 1]) v.z -= 0.018 * gauss(v.x - s * 0.03, v.y - 0.02, 0.017);
      const nose = gauss(v.x, 0, 0.012) * Math.max(0, Math.min(1, (0.025 - v.y) / 0.06));
      v.z += nose * 0.06; v.y -= nose * 0.02;
      v.z -= 0.015 * gauss(v.x * 0.4, v.y + 0.06, 0.012);
    }
  });
  rig.add(hg, skin, head);
  const eyes = [];
  for (const s of [-1, 1]) {
    const z = surfaceZ(hg, s * 0.03, 0.02);
    rig.add(sphere(0.012, 10, 8), rig.glow(0x000000), head, V(s * 0.03, 0.02, z - 0.006));
    eyes.push(rig.add(sphere(0.0035, 6, 6), rig.glow(0xff3020), head, V(s * 0.03, 0.02, z + 0.004)));
  }
  rig.add(new THREE.BoxGeometry(0.05, 0.012, 0.01), rig.glow(0x050000), head, V(0, -0.062, surfaceZ(hg, 0, -0.062) - 0.003));
  // beard: grey, stringy, hanging past the waist
  const beardMat = rig.mat(0x8a8780, { roughness: 0.85 });
  for (let i = 0; i < 22; i++) {
    const a = (i / 21 - 0.5) * 1.6, len = 0.25 + Math.random() * 0.25;
    rig.add(sculpt(cone(0.012 + Math.random() * 0.01, len, 5, 6), (v) => { v.z += Math.pow(Math.max(0, -v.y + len / 2), 2) * 0.6; }), beardMat, head, V(Math.sin(a) * 0.05, -0.07 - len / 2, 0.04 + Math.cos(a) * 0.03), { rot: [Math.PI + 0.25, 0, a * 0.2] });
  }
  // hat: tall, faded, the tip broken over
  const hat = rig.group(head, V(0, 0.07, -0.01));
  const red = rig.mat(0x4a1210, { roughness: 0.9 });
  rig.add(sculpt(cone(0.11, 0.3, 24, 6), (v) => { v.x += Math.sin(v.y * 20) * 0.004; v.z += Math.cos(v.y * 17) * 0.004; }), red, hat, V(0, 0.15, -0.02), { rot: [-0.2, 0, 0] });
  const tip = rig.group(hat, V(0, 0.28, -0.08));
  rig.add(cone(0.045, 0.2, 12), red, tip, V(0, 0.06, -0.06), { rot: [-1.6, 0, 0.2] });

  rig.parts = { g, torso, head, arms, eyes, tip, flame };
  rig.height = 1.5; rig.faceY = 1.12;
  rig.update = (t, dt, st) => {
    const hurt = st?.hurt || 0, attack = st?.attack || 0;
    const sway = Math.sin(t * 1.3);
    g.rotation.z = sway * 0.04;
    torso.rotation.x = 0.5 + Math.sin(t * 2.0) * 0.03 + attack * 0.4 - hurt * 0.3;
    head.rotation.x = -0.5 + Math.sin(t * 0.9) * 0.08 - attack * 0.2;
    head.rotation.z = Math.sin(t * 0.6) * 0.15 + (Math.sin(t * 7.3) > 0.98 ? 0.4 : 0);           // twitch
    tip.rotation.x = Math.sin(t * 1.8) * 0.15;
    arms[0].rotation.x = 0.3 + sway * 0.1 - attack * 1.4;
    arms[1].rotation.x = 0.3 - sway * 0.1;
    flame.scale.set(1 + Math.sin(t * 13) * 0.15, 1.6 + Math.sin(t * 17) * 0.3, 1);
    glowLight.intensity = 1.0 + Math.sin(t * 13) * 0.25;
    for (const e of eyes) e.visible = hurt < 0.5;
  };
  return rig;
}

// ---------------------------------------------------------------- The Mime (floor 1 boss)
export function makeMime(T) {
  const rig = new Rig(T, 'mime');
  const g = rig.group(rig.body, V(0, 0, 0));
  const black = rig.mat(0x0b0b0e, { roughness: 0.55 });
  const glove = rig.mat(0xb8b2a6, { roughness: 0.7 });
  for (const s of [-1, 1]) {
    const hip = rig.group(g, V(s * 0.1, 1.1, 0), [0, 0, s * 0.04]);
    rig.add(limb(0.07, 0.045, 0.58), black, hip);
    const knee = rig.group(hip, V(0, -0.58, 0), [0.05, 0, 0]);
    rig.add(limb(0.045, 0.03, 0.5), black, knee);
    rig.add(sculpt(sphere(0.05, 12, 8), (v) => { v.z *= 2.6; v.y *= 0.45; }), black, knee, V(0, -0.52, 0.06));
  }
  const torso = rig.group(g, V(0, 1.18, 0));
  const stripeTex = T.stripes.clone(); stripeTex.repeat.set(1, 5); stripeTex.needsUpdate = true;
  rig.add(sculpt(lathe([[0.001, -0.16], [0.17, -0.16], [0.16, 0.12], [0.22, 0.42], [0.12, 0.55], [0.001, 0.56]], 32), (v) => { v.z *= 0.72; }), rig.mat(0x9a948a, { map: stripeTex, roughness: 0.8 }), torso);
  for (const s of [-1, 1]) rig.add(new THREE.BoxGeometry(0.03, 0.62, 0.01), rig.mat(0x3a0a0e, { roughness: 0.6 }), torso, V(s * 0.09, 0.16, 0.13), { rot: [-0.12, 0, 0] });
  const arms = [];
  for (const s of [-1, 1]) {
    const sh = rig.group(torso, V(s * 0.21, 0.46, 0));
    const upper = rig.group(sh);
    rig.add(limb(0.045, 0.035, 0.42), black, upper);
    const fore = rig.group(upper, V(0, -0.42, 0));
    rig.add(limb(0.035, 0.028, 0.4), black, fore);
    const hand = rig.group(fore, V(0, -0.42, 0));
    rig.add(sculpt(sphere(0.06, 16, 12), (v) => { v.z *= 0.35; v.y *= 1.2; }), glove, hand);
    for (let f = 0; f < 4; f++) rig.add(limb(0.011, 0.008, 0.11, 6), glove, hand, V(-0.033 + f * 0.022, 0.06, 0), { rot: [0, 0, Math.PI + (f - 1.5) * 0.08] });
    arms.push({ sh, upper, fore, hand });
  }
  // head: long, white, cracked paint, a black slit for a mouth that widens
  const head = rig.group(torso, V(0, 0.73, 0.01));
  const hg = sculpt(sphere(0.1, 56, 40), (v) => {
    v.y *= 1.4; v.x *= 0.78;
    if (v.y < 0) v.x *= 1 - (-v.y / 0.14) * 0.35;
    if (v.z > 0) {
      for (const s of [-1, 1]) v.z -= 0.02 * gauss(v.x - s * 0.032, v.y - 0.02, 0.022);
      v.z += 0.01 * gauss(v.x, v.y + 0.02, 0.01);
    }
  });
  rig.add(hg, rig.mat(0xe6e2da, { roughness: 0.3, emissive: 0x0a0a0a }), head);
  const eyes = [];
  for (const s of [-1, 1]) {
    const z = surfaceZ(hg, s * 0.032, 0.02);
    rig.add(sculpt(new THREE.CircleGeometry(0.02, 16), (v) => { v.y *= 1.4; }), rig.glow(0x000000), head, V(s * 0.032, 0.02, z + 0.001), { rot: [0, s * 0.35, 0] });
    eyes.push(rig.add(new THREE.BoxGeometry(0.004, 0.07, 0.002), rig.glow(0x050505), head, V(s * 0.034, -0.03, surfaceZ(hg, s * 0.034, -0.03) + 0.001), { rot: [0, s * 0.35, 0] }));
  }
  const mz = surfaceZ(hg, 0, -0.075);
  const mouth = rig.add(new THREE.BoxGeometry(0.06, 0.004, 0.004), rig.glow(0x1a0004), head, V(0, -0.075, mz + 0.001));
  const grin = new THREE.Shape(); grin.moveTo(-0.07, -0.05); grin.quadraticCurveTo(0, -0.12, 0.07, -0.05); grin.quadraticCurveTo(0, -0.09, -0.07, -0.05);
  const grinM = rig.add(new THREE.ShapeGeometry(grin, 16), rig.glow(0x120003), head, V(0, -0.005, mz + 0.001));
  grinM.visible = false;
  for (const [x, y, r] of [[0.04, 0.09, 0.6], [-0.05, -0.04, -0.4], [0.02, 0.05, 1.2]]) rig.add(new THREE.BoxGeometry(0.0015, 0.05, 0.002), rig.glow(0x3a3630), head, V(x, y, surfaceZ(hg, x, y) + 0.0008), { rot: [0, x * 4, r] });
  rig.add(sculpt(sphere(0.13, 24, 10, 0, Math.PI * 2, 0, Math.PI * 0.45), (v) => { v.y *= 0.45; }), black, head, V(0.025, 0.1, -0.01), { rot: [0, 0, -0.25] });

  // the glass that isn't there
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.6), new THREE.MeshBasicMaterial({
    color: 0x9fe8ff, alphaMap: T.glow, transparent: true, opacity: 0.03, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  }));
  glass.position.set(0, 1.65, 0.7); glass.scale.set(0.8, 0.7, 1);
  rig.body.add(glass);

  rig.parts = { g, torso, head, arms, eyes, mouth, grin: grinM, glass };
  rig.height = 2.25; rig.faceY = 1.95;
  rig.update = (t, dt, st) => {
    const hurt = st?.hurt || 0, attack = st?.attack || 0, enraged = st?.low ? 1 : 0;
    const sway = Math.sin(t * 1.1);
    torso.rotation.z = sway * 0.04;
    torso.position.y = 1.18 + Math.abs(sway) * 0.02;
    head.rotation.z = Math.sin(t * 0.5) * 0.25 + hurt * 0.4;                // the head tilts too far
    head.rotation.y = Math.sin(t * 0.37) * 0.15;
    const slide = Math.sin(t * 0.9);
    arms.forEach((a, i) => {
      const s = i ? 1 : -1;
      a.upper.rotation.x = -1.2 - attack * 0.5;
      a.upper.rotation.z = s * (0.22 + (i ? slide : -slide) * 0.1);
      a.fore.rotation.x = -0.4 + attack * 0.3;
      a.hand.rotation.x = 1.6;
    });
    glass.material.opacity = 0.012 + Math.abs(slide) * 0.025 + attack * 0.05;
    glass.position.z = 0.7 + attack * 0.3;
    mouth.visible = !enraged; grinM.visible = !!enraged;
    torso.rotation.x = attack * 0.3;
  };
  return rig;
}

export const ROSTER = {
  touma: (T) => makeStudent(T, { name: 'touma', coat: true, laptop: true }),
  anna: (T) => makeStudent(T, { name: 'anna', hair: 0x2a1a12, iris: 0x3a2618, ponytail: true, skin: 0xcaa896 }),
  body_f: (T) => makeStudent(T, { name: 'body', hair: 0x14100c, closedEyes: true, skin: 0xa89a92 }),
  body_m: (T) => makeStudent(T, { name: 'body', male: true, hair: 0x0c0a08, closedEyes: true, skin: 0xa0928a }),
  gibbles: makeGibbles,
  sparkles: makeSparkles,
  calamari: makeCalamari,
  gnome: makeGnome,
  mime: makeMime,
};
