// Floor 1 of the school: the grid, its geometry, lights, props and things to read.
import * as THREE from 'three';
import { rand } from './textures.js';
import { ROSTER } from './characters.js';

export const CELL = 2;
export const WALL_H = 3;

// #: wall  B: blackboard  W: window  L: shoe lockers  S: fire shutter
// .: corridor lino  ,: wood floor
export const MAP = [
  '###BBB#####BBB#####BBB########',
  '#,,,,,,,#,,,,,,,#,,,,,,,######',
  '#,,,,,,,#,,,,,,,#,,,,,,,######',
  '#,,,,,,,#,,,,,,,#,,,,,,,#,,,,#',
  '#,,,,,,,#,,,,,,,#,,,,,,,#,,,,#',
  '####.########.########.##,,,,#',
  '#.......................S,,,,#',
  '#.......................S,,,,#',
  '#WWWWWW..WWWWWWWW..WWWW##,,,,#',
  '#######..#######,,,,##########',
  '#LLLLL...#######,,,,##########',
  '#........#######,,,,##########',
  '##############################',
];
export const W = MAP[0].length, Hh = MAP.length;
export const START = { x: 2, y: 11, dir: 1 };
export const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];   // N E S W

export const at = (x, y) => (y < 0 || y >= Hh || x < 0 || x >= W) ? '#' : MAP[y][x];
export const isFloorCh = (c) => c === '.' || c === ',' || c === 'S';
export const cellCenter = (x, y) => new THREE.Vector3(x * CELL + CELL / 2, 0, y * CELL + CELL / 2);

export function zoneOf(x, y) {
  if (x >= 25) return 'ARENA';
  if (y <= 4) return x < 8 ? '1-A' : x < 16 ? '1-B' : '1-C';
  if (y >= 9 && x >= 16) return 'NURSE';
  if (y >= 9) return 'ENTRANCE';
  return 'HALL';
}

// Things the player can read or use. Wall items need you to stand on cell and face dir.
export const INTERACT = [
  { id: 'lockers', x: 5, y: 11, dir: 0, label: 'Look', note: 'lockers' },
  { id: 'ranking', x: 11, y: 6, dir: 0, label: 'Read', note: 'ranking' },
  { id: 'phone', x: 15, y: 7, floor: true, label: 'Pick up', note: 'phone' },
  { id: 'nurse', x: 18, y: 11, floor: true, label: 'Read', note: 'nurse' },
  { id: 'bed', x: 16, y: 10, floor: true, label: 'Rest', action: 'rest' },
  { id: 'vase', x: 11, y: 2, floor: true, label: 'Look', note: 'vase' },
  { id: 'page', x: 23, y: 6, dir: 1, label: 'Read', note: 'page' },
  { id: 'page2', x: 23, y: 7, dir: 1, label: 'Read', note: 'page' },
];

// ------------------------------------------------------------------ geometry helpers
class QuadBatch {
  constructor() { this.pos = []; this.nor = []; this.uv = []; }
  // corner + two edge vectors, normal faces the viewer
  quad(o, u, v, n, uv = [0, 0, 1, 1]) {
    const p = [o, o.clone().add(u), o.clone().add(u).add(v), o.clone().add(v)];
    const t = [[uv[0], uv[1]], [uv[2], uv[1]], [uv[2], uv[3]], [uv[0], uv[3]]];
    for (const i of [0, 1, 2, 0, 2, 3]) {
      this.pos.push(p[i].x, p[i].y, p[i].z); this.nor.push(n.x, n.y, n.z); this.uv.push(...t[i]);
    }
  }
  mesh(mat) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    return new THREE.Mesh(g, mat);
  }
}

function mergeBoxes(list) {   // [{w,h,d,x,y,z,rx,ry,rz}] -> one geometry
  const pos = [], nor = [], uv = [];
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), nm = new THREE.Matrix3();
  for (const b of list) {
    const g = (b.cyl ? new THREE.CylinderGeometry(b.w, b.w, b.h, 6) : new THREE.BoxGeometry(b.w, b.h, b.d)).toNonIndexed();
    e.set(b.rx || 0, b.ry || 0, b.rz || 0);
    m.compose(new THREE.Vector3(b.x, b.y, b.z), q.setFromEuler(e), new THREE.Vector3(1, 1, 1));
    g.applyMatrix4(m);
    pos.push(...g.attributes.position.array); nor.push(...g.attributes.normal.array); uv.push(...g.attributes.uv.array);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return g;
}

function deskParts() {
  const wood = [{ w: 0.62, h: 0.03, d: 0.45, x: 0, y: 0.72, z: 0 }, { w: 0.4, h: 0.03, d: 0.38, x: 0, y: 0.43, z: 0.5 },
    { w: 0.4, h: 0.32, d: 0.025, x: 0, y: 0.72, z: 0.69 }];
  const metal = [{ w: 0.58, h: 0.12, d: 0.4, x: 0, y: 0.63, z: 0 }];
  for (const [x, z] of [[-0.28, -0.2], [0.28, -0.2], [-0.28, 0.2], [0.28, 0.2]]) metal.push({ cyl: 1, w: 0.012, h: 0.72, x, y: 0.36, z });
  for (const [x, z] of [[-0.18, 0.34], [0.18, 0.34], [-0.18, 0.66], [0.18, 0.66]]) metal.push({ cyl: 1, w: 0.012, h: 0.43, x, y: 0.215, z });
  metal.push({ cyl: 1, w: 0.012, h: 0.32, x: -0.18, y: 0.72, z: 0.67 }, { cyl: 1, w: 0.012, h: 0.32, x: 0.18, y: 0.72, z: 0.67 });
  return { wood: mergeBoxes(wood), metal: mergeBoxes(metal) };
}

// ------------------------------------------------------------------ build
export function buildLevel(scene, T) {
  const L = { lights: [], flicker: [], notes: [], shutter: null, bodies: [], arena: {}, windowFaces: [], floorCells: [] };
  const lam = (opts) => new THREE.MeshLambertMaterial({ shadowSide: THREE.DoubleSide, ...opts });
  const pbr = (opts) => new THREE.MeshStandardMaterial({ shadowSide: THREE.DoubleSide, roughness: 0.85, metalness: 0, ...opts });
  const ns = new THREE.Vector2(1, 1);

  const mats = {
    // the corridor floor is waxed lino with wet patches: it should catch every light
    lino: pbr({ map: T.lino, normalMap: T.linoN, normalScale: ns.clone().multiplyScalar(0.6), roughness: 0.55, roughnessMap: T.linoR }),
    wood: pbr({ map: T.wood, normalMap: T.woodN, roughness: 0.48 }),
    ceiling: pbr({ map: T.ceiling, normalMap: T.ceilingN, roughness: 0.95 }),
    wall: pbr({ map: T.wall, normalMap: T.wallN, roughness: 0.82 }),
    board: pbr({ map: T.board, normalMap: T.boardN, roughness: 0.8 }),
    blackboard: pbr({ map: T.blackboard, normalMap: T.blackboardN, roughness: 0.7 }),
    lockers: pbr({ map: T.lockers, normalMap: T.lockersN, roughness: 0.42, metalness: 0.55 }),
    window: pbr({ map: T.window, normalMap: T.windowN, alphaMap: T.windowAlpha, alphaTest: 0.5, roughness: 0.6 }),
  };
  L.pbr = pbr;
  const batches = {};
  const batch = (k) => (batches[k] ||= new QuadBatch());

  const up = new THREE.Vector3(0, 1, 0);
  for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) {
    const c = at(x, y);
    if (!isFloorCh(c)) continue;
    const x0 = x * CELL, z0 = y * CELL;
    const floorKey = c === ',' ? 'wood' : 'lino';
    L.floorCells.push(new THREE.Vector3(x0 + CELL / 2, 0, z0 + CELL / 2));
    batch(floorKey).quad(new THREE.Vector3(x0, 0, z0 + CELL), new THREE.Vector3(CELL, 0, 0), new THREE.Vector3(0, 0, -CELL), up);
    batch('ceiling').quad(new THREE.Vector3(x0, WALL_H, z0), new THREE.Vector3(CELL, 0, 0), new THREE.Vector3(0, 0, CELL), new THREE.Vector3(0, -1, 0), [0, 0, 2, 2]);
    // walls on each solid side, facing into this cell
    const sides = [
      { n: [0, -1], o: [x0 + CELL, z0], u: [-CELL, 0], nn: [0, 1] },     // north wall, faces +z
      { n: [1, 0], o: [x0 + CELL, z0 + CELL], u: [0, -CELL], nn: [-1, 0] },
      { n: [0, 1], o: [x0, z0 + CELL], u: [CELL, 0], nn: [0, -1] },
      { n: [-1, 0], o: [x0, z0], u: [0, CELL], nn: [1, 0] },
    ];
    for (const s of sides) {
      const nc = at(x + s.n[0], y + s.n[1]);
      if (isFloorCh(nc)) continue;
      let key = { '#': 'wall', B: 'blackboard', W: 'window', L: 'lockers' }[nc] || 'wall';
      if (key === 'wall' && c === '.' && ((x * 7 + y * 3) % 5 === 0)) key = 'board';
      if (x === 11 && y === 6 && s.n[1] === -1) key = 'board';
      let uv;
      if (key === 'blackboard') { let rs = x; while (at(rs - 1, y - 1) === 'B') rs--; const i = x - rs; uv = [i / 3, 0, (i + 1) / 3, 1]; }
      (L.wallFaces ||= []).push({ o: new THREE.Vector3(s.o[0] + s.u[0], 0, s.o[1] + s.u[1]), u: new THREE.Vector3(-s.u[0], 0, -s.u[1]).normalize(), n: new THREE.Vector3(s.nn[0], 0, s.nn[1]), key, x, y, floor: c });
      if (key === 'window') L.windowFaces.push({ o: new THREE.Vector3(s.o[0] + s.u[0], 0, s.o[1] + s.u[1]), u: new THREE.Vector3(-s.u[0], 0, -s.u[1]).normalize(), n: new THREE.Vector3(s.nn[0], 0, s.nn[1]) });
      batch(key).quad(new THREE.Vector3(s.o[0] + s.u[0], 0, s.o[1] + s.u[1]), new THREE.Vector3(-s.u[0], 0, -s.u[1]), new THREE.Vector3(0, WALL_H, 0), new THREE.Vector3(s.nn[0], 0, s.nn[1]), uv);
    }
  }
  for (const [k, b] of Object.entries(batches)) { const m = b.mesh(mats[k]); m.castShadow = m.receiveShadow = true; scene.add(m); }

  // ---------------------------------------------------------------- lights
  const panelGeo = new THREE.BoxGeometry(1.2, 0.06, 0.3);
  const panelOn = new THREE.MeshBasicMaterial({ map: T.panel, color: 0xfff6e0 });
  const panelOff = new THREE.MeshLambertMaterial({ color: 0x55574f });
  const addPanel = (x, z, flicker) => {
    const m = new THREE.Mesh(panelGeo, flicker ? panelOn.clone() : panelOn);
    m.position.set(x, WALL_H - 0.03, z);
    scene.add(m); (L.panels ||= []).push(m);
    if (flicker) L.flicker.push({ mesh: m, on: panelOn, off: panelOff, t: 0, light: null });
    return m;
  };
  for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) {
    const c = at(x, y);
    if (c === '.' && (x % 3 === 1) && y === 6) addPanel(x * CELL + CELL, (y + 1) * CELL, x === 13 || x === 19);
    if (c === ',' && y === 2 && x % 4 === 2 && x < 24) addPanel(x * CELL + 1, y * CELL + 2, x === 10);
  }
  addPanel(5 * CELL, 11 * CELL, false); addPanel(18 * CELL, 10 * CELL + 1, false);

  const pl = (x, z, color, intensity, dist, flick) => {
    const l = new THREE.PointLight(color, intensity, dist, 1.6);
    l.position.set(x, WALL_H - 0.35, z);
    scene.add(l); L.lights.push(l);
    if (flick) { const f = L.flicker.find((p) => Math.abs(p.mesh.position.x - x) < 1.5 && Math.abs(p.mesh.position.z - z) < 1.5); if (f) f.light = l; }
    return l;
  };
  // fluorescent tubes gone green with age; most of the building is left dark
  pl(4, 14, 0xc8f0d0, 3.2, 8);
  pl(28, 14, 0xc8e8ff, 3.0, 8, true);
  pl(40, 14, 0xc8f0d0, 3.0, 8, true);
  pl(46, 14, 0xd8ffd8, 1.6, 6);
  pl(10, 22, 0xffd8a0, 3.4, 8);
  pl(36, 21, 0xb8ffe0, 3.4, 8);
  pl(21, 5, 0xc8f0d0, 2.4, 9, true);
  L.arena.light = pl(54, 12, 0xff3b30, 0, 14);
  // tubes with no working light behind them stay dead
  for (const m of L.panels) if (!L.lights.some((l) => l.intensity > 0 && Math.hypot(l.position.x - m.position.x, l.position.z - m.position.z) < 1.6)) m.material = panelOff;

  // ---------------------------------------------------------------- shutter
  const shutterTex = T.shutter.clone(); shutterTex.wrapS = THREE.RepeatWrapping; shutterTex.repeat.set(2, 1); shutterTex.needsUpdate = true;
  const shutter = new THREE.Mesh(new THREE.PlaneGeometry(CELL * 2, WALL_H), new THREE.MeshStandardMaterial({ map: shutterTex, normalMap: T.shutterN, roughness: 0.5, metalness: 0.6, side: THREE.DoubleSide }));
  shutter.rotation.y = -Math.PI / 2;
  shutter.position.set(24 * CELL + 0.02, WALL_H / 2, 7 * CELL);
  scene.add(shutter);
  L.shutter = shutter;

  // ---------------------------------------------------------------- desks
  const dp = deskParts();
  const deskSpots = [];
  for (let y = 1; y <= 4; y++) for (let x = 1; x < 24; x++) {
    if (at(x, y) !== ',') continue;
    if (y === 4 && (x === 4 || x === 13 || x === 22)) continue;   // keep the door paths clear
    if (x === 11 && y === 2) { deskSpots.push({ x, y, special: true }); continue; }
    if (rand() < 0.15) continue;
    deskSpots.push({ x, y });
  }
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x9a7448, roughness: 0.5 });
  const metalMat = new THREE.MeshStandardMaterial({ color: 0x6f787a, roughness: 0.35, metalness: 0.8 });
  const iw = new THREE.InstancedMesh(dp.wood, woodMat, deskSpots.length);
  const im = new THREE.InstancedMesh(dp.metal, metalMat, deskSpots.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  deskSpots.forEach((d, i) => {
    const c = cellCenter(d.x, d.y);
    const knocked = !d.special && rand() < 0.18;
    e.set(knocked ? Math.PI / 2 : 0, d.special ? 0 : (rand() - 0.5) * (knocked ? 0.6 : 0.25), 0);
    // desks sit on the east half of each cell so the walking line down the middle stays clear
    const p = c.clone().add(new THREE.Vector3(0.6 + (d.special ? 0 : (rand() - 0.5) * 0.15), knocked ? 0.25 : 0, d.special ? -0.35 : (rand() - 0.5) * 0.3 - 0.3));
    m4.compose(p, q.setFromEuler(e), new THREE.Vector3(1, 1, 1));
    iw.setMatrixAt(i, m4); im.setMatrixAt(i, m4);
  });
  iw.castShadow = im.castShadow = true; iw.receiveShadow = im.receiveShadow = true;
  scene.add(iw, im);

  // the desk nobody sits at: flowers in a vase
  {
    const c = cellCenter(11, 2);
    const g = new THREE.Group(); g.position.set(c.x + 0.6, 0.735, c.z - 0.35);
    const vase = new THREE.Mesh(new THREE.LatheGeometry([[0.001, 0], [0.05, 0], [0.065, 0.08], [0.04, 0.18], [0.05, 0.22], [0.001, 0.22]].map(([a, b]) => new THREE.Vector2(a, b)), 16),
      new THREE.MeshLambertMaterial({ color: 0xdfe9ef, emissive: 0x1a2228 }));
    g.add(vase);
    const stem = new THREE.MeshLambertMaterial({ color: 0x3f6a34 });
    const petal = new THREE.MeshLambertMaterial({ color: 0xf6f4ec, emissive: 0x333330 });
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * Math.PI * 2, r = 0.05;
      const s = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.25), stem);
      s.position.set(Math.cos(a) * r * 0.5, 0.3, Math.sin(a) * r * 0.5); s.rotation.set(Math.sin(a) * 0.3, 0, Math.cos(a) * 0.3);
      g.add(s);
      const f = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), petal);
      f.position.set(Math.cos(a) * r * 1.4, 0.42 + rand() * 0.04, Math.sin(a) * r * 1.4); f.scale.set(1, 0.6, 1);
      g.add(f);
    }
    scene.add(g);
    const spot = new THREE.SpotLight(0xdde8ff, 6, 5, 0.35, 0.6, 1.5);
    spot.position.set(c.x + 0.6, WALL_H - 0.1, c.z - 0.35); spot.target.position.set(c.x + 0.6, 0.7, c.z - 0.35);
    scene.add(spot, spot.target);
  }

  // ---------------------------------------------------------------- floor clutter
  const papers = [];
  for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) if (isFloorCh(at(x, y)) && x < 24) for (let k = 0; k < 2; k++) if (rand() < 0.45) papers.push([x, y]);
  const paperMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.21, 0.29), new THREE.MeshLambertMaterial({ map: T.paper, side: THREE.DoubleSide }), papers.length);
  papers.forEach(([x, y], i) => {
    const c = cellCenter(x, y);
    e.set(-Math.PI / 2, 0, rand() * 6);
    m4.compose(new THREE.Vector3(c.x + (rand() - .5) * 1.7, 0.004 + i * 0.00002, c.z + (rand() - .5) * 1.7), q.setFromEuler(e), new THREE.Vector3(1, 1, 1));
    paperMesh.setMatrixAt(i, m4);
  });
  scene.add(paperMesh);

  const bagMat = new THREE.MeshLambertMaterial({ color: 0x1f2638 });
  for (const [x, y, r] of [[6, 7, 0.6], [12, 6, 2.1], [20, 7, 1.0], [3, 11, 0.3], [9, 3, 1.4]]) {
    const c = cellCenter(x, y);
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.26, 0.12), bagMat);
    b.position.set(c.x + 0.5, 0.06, c.z + 0.4); b.rotation.set(-Math.PI / 2, 0, r);
    scene.add(b);
  }

  // students who didn't make it out; shown like a ghost story shows them, still and quiet
  const stainMat = new THREE.MeshBasicMaterial({ map: T.stain, transparent: true, depthWrite: false });
  for (const [kind, x, y, rot, dx, dz] of [['body_f', 5, 6, 1.45, 0.1, -0.6], ['body_m', 18, 7, -1.7, -0.2, 0.6], ['body_f', 21, 3, 0.2, -0.65, 0]]) {
    const rig = ROSTER[kind](T);
    rig.update(0, 0, {});
    const c = cellCenter(x, y);
    rig.root.rotation.order = 'YXZ';
    rig.root.rotation.set(-Math.PI / 2 + 0.02, rot, 0);
    rig.root.position.set(c.x + dx, 0.12, c.z + dz);
    rig.parts.arms[0].rotation.z = -0.9; rig.parts.arms[1].rotation.z = 0.4;
    scene.add(rig.root);
    const s = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.4), stainMat);
    s.rotation.x = -Math.PI / 2; s.position.set(c.x + dx, 0.006, c.z + dz);
    scene.add(s);
  }

  // nurse's office: a bed and a desk with the log
  {
    const c = cellCenter(16, 10);
    const bed = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.5, 1.9), new THREE.MeshLambertMaterial({ color: 0xe8ecef }));
    bed.position.set(c.x - 0.5, 0.25, c.z); scene.add(bed);
    const curtain = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 2.1), new THREE.MeshLambertMaterial({ color: 0xbfe0d8, side: THREE.DoubleSide, transparent: true, opacity: 0.85 }));
    curtain.position.set(c.x + 0.25, 1.15, c.z); curtain.rotation.y = Math.PI / 2; scene.add(curtain);
    const d = cellCenter(18, 11);
    const desk = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.75, 0.6), new THREE.MeshLambertMaterial({ color: 0x8a6a4a }));
    desk.position.set(d.x, 0.375, d.z + 0.55); scene.add(desk);
    const book = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.03, 0.24), new THREE.MeshLambertMaterial({ color: 0x2a4a7a }));
    book.position.set(d.x, 0.77, d.z + 0.5); scene.add(book);
  }

  // the black ribbon on the locker next to yours
  {
    const rib = new THREE.MeshLambertMaterial({ color: 0x0c0c10, side: THREE.DoubleSide });
    const g = new THREE.Group(); g.position.set(5 * CELL + 1.25, 1.62, 11 * CELL + 0.39);
    for (const s of [-1, 1]) {
      const loop = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.12, 4), rib);
      loop.rotation.z = s * Math.PI / 2; loop.position.x = s * 0.06; loop.scale.z = 0.3; g.add(loop);
      const tail = new THREE.Mesh(new THREE.PlaneGeometry(0.035, 0.2), rib);
      tail.position.set(s * 0.03, -0.1, 0); tail.rotation.z = s * 0.25; g.add(tail);
    }
    g.add(new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), rib));
    scene.add(g);
  }

  // ---------------------------------------------------------------- readable things glow a little
  const glowMat = new THREE.SpriteMaterial({ map: T.glow, color: 0xffe08a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  for (const it of INTERACT) {
    const c = cellCenter(it.x, it.y);
    let p;
    if (it.floor) p = new THREE.Vector3(c.x + (it.id === 'vase' ? 0.6 : it.id === 'bed' ? -0.5 : 0), { nurse: 0.85, vase: 1.0, bed: 0.7 }[it.id] ?? 0.15, c.z + (it.id === 'nurse' ? 0.5 : it.id === 'vase' ? -0.35 : 0));
    else { const [dx, dz] = DIRS[it.dir]; p = new THREE.Vector3(c.x + dx * 0.95, 1.4, c.z + dz * 0.95); }
    if (it.id === 'phone') {
      const ph = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.012, 0.16), new THREE.MeshBasicMaterial({ color: 0x9fd8ff }));
      ph.position.set(c.x, 0.01, c.z); ph.rotation.y = 0.7; scene.add(ph);
    }
    if (it.id === 'page' || it.id === 'page2') {
      const pg = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.4), new THREE.MeshLambertMaterial({ map: T.paper, emissive: 0x332a18 }));
      pg.position.set(24 * CELL - 0.03, 1.45, 6 * CELL + 1.2); pg.rotation.y = -Math.PI / 2;
      if (it.id === 'page') scene.add(pg);
    }
    const s = new THREE.Sprite(glowMat);
    s.position.copy(p); s.scale.setScalar(0.35);
    s.userData.base = p.y;
    if (it.id !== 'page2') scene.add(s);
    it.sprite = s;
  }

  // ---------------------------------------------------------------- arena: Anna and the Mime
  {
    const c = cellCenter(27, 6);
    const anna = ROSTER.anna(T);
    anna.root.position.set(c.x - 0.2, 0, c.z + 1.0);
    anna.root.rotation.y = -Math.PI / 2;
    anna.root.visible = false;
    scene.add(anna.root);
    L.arena.anna = anna;
  }
  return L;
}
