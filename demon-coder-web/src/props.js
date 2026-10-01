// Set dressing: the things that make the floor read as a real school after dark.
// Trim, door frames and sliding doors, ceiling fixtures, pipes, signs, lockers, festival debris, puddles.
import * as THREE from 'three';
import { CELL, WALL_H, at, isFloorCh, cellCenter } from './level.js';
import { rand } from './textures.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

// Merge many boxes/cylinders into one geometry so a whole class of prop is one draw call.
class Bundle {
  constructor() { this.parts = []; }
  box(w, h, d, pos, rot = [0, 0, 0]) { this.parts.push({ g: new THREE.BoxGeometry(w, h, d), pos, rot }); return this; }
  cyl(r, h, pos, rot = [0, 0, 0], seg = 10) { this.parts.push({ g: new THREE.CylinderGeometry(r, r, h, seg), pos, rot }); return this; }
  geo(g, pos, rot = [0, 0, 0], scale) { this.parts.push({ g, pos, rot, scale }); return this; }
  build() {
    const pos = [], nor = [], uv = [];
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    for (const p of this.parts) {
      const g = p.g.index ? p.g.toNonIndexed() : p.g;
      m.compose(p.pos, q.setFromEuler(e.set(...p.rot)), p.scale || V(1, 1, 1));
      g.applyMatrix4(m);
      pos.push(...g.attributes.position.array); nor.push(...g.attributes.normal.array);
      uv.push(...(g.attributes.uv ? g.attributes.uv.array : new Float32Array(g.attributes.position.count * 2)));
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    return g;
  }
  mesh(mat, shadow = true) {
    const mesh = new THREE.Mesh(this.build(), mat);
    mesh.castShadow = shadow; mesh.receiveShadow = true;
    return mesh;
  }
}

function signTexture(draw, w = 256, h = 128) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

export function buildProps(scene, T, L) {
  const std = (o) => new THREE.MeshStandardMaterial({ roughness: 0.7, ...o });
  const M = {
    trim: std({ color: 0x2b3530, roughness: 0.5 }),
    rail: std({ color: 0x55665c, roughness: 0.45 }),
    metal: std({ color: 0x4a4f52, roughness: 0.4, metalness: 0.8 }),
    darkMetal: std({ color: 0x1c1f21, roughness: 0.5, metalness: 0.7 }),
    pipe: std({ color: 0x6d6a5e, roughness: 0.55, metalness: 0.5 }),
    doorWood: std({ color: 0x8a6a46, roughness: 0.55 }),
    doorFrame: std({ color: 0x3b3a34, roughness: 0.5, metalness: 0.3 }),
    glassDark: std({ color: 0x0a1014, roughness: 0.05, metalness: 0.2 }),
    plaster: std({ map: T.wall, normalMap: T.wallN, roughness: 0.85 }),
    cardboard: std({ color: 0x8b6a42, roughness: 0.9 }),
    red: std({ color: 0x8e1418, roughness: 0.4, metalness: 0.2 }),
    shoeW: std({ color: 0xd8d6cc, roughness: 0.7 }),
    shoeD: std({ color: 0x24201c, roughness: 0.6 }),
    locker: std({ color: 0x7c827e, roughness: 0.35, metalness: 0.6 }),
    lockerIn: std({ color: 0x1d201f, roughness: 0.8 }),
  };

  // ---------------------------------------------------------------- baseboards and the rail along every wall
  const trim = new Bundle(), rail = new Bundle();
  for (const f of L.wallFaces) {
    if (f.key === 'lockers' || f.key === 'blackboard') continue;
    const mid = f.o.clone().addScaledVector(f.u, CELL / 2);
    const rot = [0, Math.atan2(f.u.z, -f.u.x) + Math.PI, 0];
    trim.box(CELL, 0.12, 0.025, mid.clone().setY(0.06).addScaledVector(f.n, 0.012), rot);
    if (f.key !== 'window') rail.box(CELL, 0.05, 0.035, mid.clone().setY(1.98).addScaledVector(f.n, 0.017), rot);
    // a crown line where wall meets ceiling
    trim.box(CELL, 0.04, 0.04, mid.clone().setY(WALL_H - 0.02).addScaledVector(f.n, 0.02), rot);
  }
  scene.add(trim.mesh(M.trim, false), rail.mesh(M.rail, false));

  // ---------------------------------------------------------------- doorways: header, jambs, sliding doors, class plates
  const doorways = [];
  for (let y = 0; y < MAPH(); y++) for (let x = 0; x < MAPW(); x++) {
    const c = at(x, y);
    if (!isFloorCh(c)) continue;
    // a floor cell in a wall row with walls on both sides along one axis is a doorway
    const ns = !isFloorCh(at(x - 1, y)) && !isFloorCh(at(x + 1, y)) && isFloorCh(at(x, y - 1)) && isFloorCh(at(x, y + 1));
    if (ns && y === 5) doorways.push({ x, y });
  }
  const frames = new Bundle(), doors = new Bundle(), panes = new Bundle(), headers = new Bundle();
  const plateTex = (name) => signTexture((g, w, h) => {
    g.fillStyle = '#e9e6dc'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#3a3a34'; g.lineWidth = 6; g.strokeRect(3, 3, w - 6, h - 6);
    g.fillStyle = '#1d1d1a'; g.font = 'bold 64px serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(name, w / 2, h / 2 + 4);
  });
  const names = ['2-A', '2-B', '2-C'];
  doorways.forEach((d, i) => {
    const x0 = d.x * CELL, zc = d.y * CELL + CELL / 2;   // wall cell spans z = 10..12
    headers.box(CELL, WALL_H - 2.15, CELL, V(x0 + CELL / 2, 2.15 + (WALL_H - 2.15) / 2, zc));
    for (const sx of [0.05, CELL - 0.05]) frames.box(0.1, 2.15, CELL + 0.06, V(x0 + sx, 1.075, zc));
    frames.box(CELL, 0.1, CELL + 0.06, V(x0 + CELL / 2, 2.15, zc));
    // two sliding panels: one shut, one dragged most of the way open
    // both panels slid open and stacked on one side, the way they were left
    for (const k of [0, 1]) {
      const z = zc + 0.86 + k * 0.06, px = x0 + 0.47 + k * 0.03;
      doors.box(0.84, 2.05, 0.04, V(px, 1.03, z));
      panes.box(0.56, 0.55, 0.045, V(px, 1.55, z));
    }
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.03), [M.metal, M.metal, M.metal, M.metal,
      std({ map: plateTex(names[i] || '2-?'), roughness: 0.6 }), std({ map: plateTex(names[i] || '2-?'), roughness: 0.6 })]);
    plate.position.set(x0 + CELL + 0.05, 2.45, zc + CELL / 2 + 0.25);
    plate.rotation.y = Math.PI / 2;
    scene.add(plate);
  });
  // the wide openings to the entrance hall and nurse's office get a header too
  for (const [x, w] of [[7, 2], [17, 2]]) {
    headers.box(w * CELL, WALL_H - 2.3, CELL, V(x * CELL + w * CELL / 2, 2.3 + (WALL_H - 2.3) / 2, 8 * CELL + CELL / 2));
    frames.box(w * CELL, 0.1, CELL + 0.06, V(x * CELL + w * CELL / 2, 2.3, 8 * CELL + CELL / 2));
  }
  scene.add(headers.mesh(M.plaster), frames.mesh(M.doorFrame), doors.mesh(M.doorWood), panes.mesh(M.glassDark, false));

  // ---------------------------------------------------------------- ceiling: fixture housings, cable tray, pipe, sprinklers
  const housings = new Bundle();
  for (const p of L.panels || []) {
    housings.box(1.36, 0.1, 0.44, V(p.position.x, WALL_H - 0.02, p.position.z));
    for (const sx of [-0.66, 0.66]) housings.box(0.04, 0.12, 0.44, V(p.position.x + sx, WALL_H - 0.08, p.position.z));
  }
  scene.add(housings.mesh(M.darkMetal, false));
  const tray = new Bundle(), pipe = new Bundle();
  tray.box(46, 0.06, 0.32, V(25, WALL_H - 0.28, 12.35));
  for (let x = 2; x < 48; x += 2) { tray.box(0.03, 0.26, 0.03, V(x, WALL_H - 0.13, 12.2)); tray.box(0.03, 0.26, 0.03, V(x, WALL_H - 0.13, 12.5)); }
  pipe.cyl(0.06, 46, V(25, WALL_H - 0.16, 15.75), [0, 0, Math.PI / 2], 12);
  for (let x = 3; x < 48; x += 4) { pipe.cyl(0.075, 0.08, V(x, WALL_H - 0.16, 15.75), [0, 0, Math.PI / 2], 12); pipe.cyl(0.015, 0.16, V(x + 2, WALL_H - 0.08, 14), [0, 0, 0], 8); pipe.cyl(0.03, 0.02, V(x + 2, WALL_H - 0.16, 14), [0, 0, 0], 10); }
  scene.add(tray.mesh(M.metal, false), pipe.mesh(M.pipe, false));
  // cables slumping out of the tray
  const cableMat = std({ color: 0x111212, roughness: 0.6 });
  for (const [x0, x1] of [[9, 13.5], [30, 33]]) {
    const curve = new THREE.CatmullRomCurve3([V(x0, WALL_H - 0.3, 12.4), V((x0 + x1) / 2, WALL_H - 0.9, 12.7), V(x1, WALL_H - 0.3, 12.4)]);
    scene.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 20, 0.012, 5), cableMat));
  }

  // ---------------------------------------------------------------- emergency exit signs (green) and fire alarm lamps (red)
  const exitTex = signTexture((g, w, h) => {
    g.fillStyle = '#18c45a'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#f4fff6'; g.fillRect(14, 14, 84, 100);
    g.fillStyle = '#18c45a';
    g.beginPath(); g.arc(70, 34, 10, 0, 7); g.fill();                             // running figure
    g.lineWidth = 11; g.strokeStyle = '#18c45a'; g.lineCap = 'round';
    g.beginPath(); g.moveTo(66, 48); g.lineTo(56, 74); g.lineTo(40, 100); g.moveTo(56, 74); g.lineTo(74, 90); g.lineTo(70, 108); g.moveTo(64, 54); g.lineTo(82, 66); g.moveTo(62, 56); g.lineTo(42, 62); g.stroke();
    g.fillStyle = '#f4fff6'; g.font = 'bold 40px sans-serif'; g.fillText('非常口', 110, 60); g.font = 'bold 34px sans-serif'; g.fillText('EXIT', 128, 104);
  });
  const exitMat = new THREE.MeshBasicMaterial({ map: exitTex, color: 0xb0ffc8 });
  for (const [x, z, ry] of [[16, 15.95, 0], [36, 15.95, 0], [2.1, 14, Math.PI / 2]]) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.3, 0.06), [M.darkMetal, M.darkMetal, M.darkMetal, M.darkMetal, exitMat, exitMat]);
    s.position.set(x, 2.55, z); s.rotation.y = ry;
    scene.add(s);
    const l = new THREE.PointLight(0x30ff80, 1.2, 4, 1.6); l.position.set(x, 2.4, z - (ry === 0 ? 0.4 : 0)); if (ry !== 0) l.position.x += 0.4;
    scene.add(l);
  }
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xff2a1a });
  for (const x of [7, 21, 41]) {
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.9, 0.16), M.red);
    box.position.set(x, 0.85, 12.08); box.castShadow = true; scene.add(box);
    const lbl = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.14), new THREE.MeshBasicMaterial({ map: signTexture((g, w, h) => { g.fillStyle = '#8e1418'; g.fillRect(0, 0, w, h); g.fillStyle = '#fff'; g.font = 'bold 70px sans-serif'; g.textAlign = 'center'; g.fillText('消火栓', w / 2, 92); }), color: 0x777777 }));
    lbl.position.set(x, 1.0, 12.17); scene.add(lbl);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.07, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), lampMat);
    lamp.rotation.x = Math.PI / 2; lamp.position.set(x, 1.55, 12.02); scene.add(lamp);
    const l = new THREE.PointLight(0xff2010, 1.6, 3.5, 1.5); l.position.set(x, 1.55, 12.35); scene.add(l);
  }

  // ---------------------------------------------------------------- shoe lockers with depth, and shoes in them
  {
    const lk = new Bundle(), inner = new Bundle(), shoesW = new Bundle(), shoesD = new Bundle();
    const z = 10 * CELL + CELL - 0.01;          // south face of the locker row
    const cols = 4, rows = 6, depth = 0.38;
    for (let cx = 1; cx <= 5; cx++) {
      const x0 = cx * CELL;
      lk.box(CELL - 0.04, 0.04, depth, V(x0 + CELL / 2, 2.4, z + depth / 2));
      lk.box(CELL - 0.04, 0.12, depth, V(x0 + CELL / 2, 0.06, z + depth / 2));
      for (let i = 0; i <= cols; i++) lk.box(0.025, 2.34, depth, V(x0 + 0.02 + i * (CELL - 0.04) / cols, 1.23, z + depth / 2));
      for (let r = 1; r < rows; r++) lk.box(CELL - 0.04, 0.02, depth, V(x0 + CELL / 2, 0.12 + r * 2.28 / rows, z + depth / 2));
      inner.box(CELL - 0.04, 2.3, 0.01, V(x0 + CELL / 2, 1.25, z + 0.01));
      for (let r = 0; r < rows; r++) for (let i = 0; i < cols; i++) {
        if (rand() < 0.35) continue;
        const sx = x0 + 0.02 + (i + 0.5) * (CELL - 0.04) / cols, sy = 0.12 + r * 2.28 / rows + 0.05;
        const b = rand() < 0.75 ? shoesW : shoesD;
        for (const o of [-0.06, 0.06]) b.box(0.08, 0.07, 0.24, V(sx + o, sy + 0.035, z + 0.16), [0, (rand() - 0.5) * 0.2, 0]);
      }
    }
    scene.add(lk.mesh(M.locker), inner.mesh(M.lockerIn, false), shoesW.mesh(M.shoeW), shoesD.mesh(M.shoeD));
  }

  // ---------------------------------------------------------------- festival debris: paper chains, a torn banner, boxes, a signboard
  {
    const colors = [0x8a2a2a, 0x2a4a7a, 0x8a7a2a, 0x2a6a4a, 0x6a2a6a];
    const N = 900;
    const rings = new THREE.InstancedMesh(new THREE.TorusGeometry(0.035, 0.008, 4, 8), std({ roughness: 0.8 }), N);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), c = new THREE.Color();
    let i = 0;
    for (const zz of [13.2, 14.8]) {
      for (let x = 2.2; x < 46 && i < N; x += 0.065) {
        const seg = ((x - 2.2) % 4.4) / 4.4;
        const torn = zz > 14 && x > 20 && x < 26;                                // one strand has come down
        const y = torn ? Math.max(0.03, 2.75 - (x - 20) * 0.9 + Math.sin(x * 3) * 0.1) : 2.78 - Math.sin(seg * Math.PI) * 0.45;
        e.set(i % 2 ? Math.PI / 2 : 0, 0, torn ? 1.2 : 0);
        m.compose(V(x, y, zz + (torn ? Math.min(1.0, (x - 20) * 0.2) : 0)), q.setFromEuler(e), V(1, 1, 1));
        rings.setMatrixAt(i, m); rings.setColorAt(i, c.set(colors[Math.floor(x / 0.065) % colors.length])); i++;
      }
    }
    rings.count = i;
    scene.add(rings);

    const bannerTex = signTexture((g, w, h) => {
      g.fillStyle = '#7a1418'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#efe6d0'; g.font = 'bold 80px serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('第三十二回 文化祭', w / 2, h / 2);
      g.globalCompositeOperation = 'destination-out';
      g.beginPath(); g.moveTo(w * 0.72, 0); g.lineTo(w * 0.8, h * 0.6); g.lineTo(w * 0.76, h); g.lineTo(w, h); g.lineTo(w, 0); g.fill();
    }, 1024, 160);
    const banner = new THREE.Mesh(new THREE.PlaneGeometry(3.8, 0.6, 12, 2), std({ map: bannerTex, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.9 }));
    const bp = banner.geometry.attributes.position;
    for (let k = 0; k < bp.count; k++) bp.setZ(k, Math.sin((bp.getX(k) + 1.9) / 3.8 * Math.PI) * 0.12);
    banner.geometry.computeVertexNormals();
    banner.position.set(30, 2.45, 14); banner.rotation.set(0, Math.PI / 2, 0.05);
    banner.castShadow = true;
    scene.add(banner);
    L.banner = banner;
    const torn = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.6), banner.material);
    torn.position.set(30, 1.9, 15.6); torn.rotation.set(0.2, Math.PI / 2, 1.2); scene.add(torn);

    const boxes = new Bundle();
    for (const [x, z, s, r] of [[3.4, 12.6, 0.5, 0.2], [3.9, 12.5, 0.4, 0.7], [3.6, 12.55, 0.35, 0.1, 0.45], [26.5, 15.4, 0.55, 0.4], [45, 12.6, 0.5, 1.1], [44.4, 12.7, 0.4, 0.3]]) {
      boxes.box(s, s * 0.7, s * 0.8, V(x, s * 0.35, z), [0, r, 0]);
    }
    boxes.box(0.4, 0.28, 0.32, V(3.65, 0.5 + 0.14, 12.55), [0, 0.5, 0]);
    scene.add(boxes.mesh(M.cardboard));
    // an A-frame sign, knocked flat
    const aSign = new Bundle();
    aSign.box(0.6, 0.9, 0.025, V(0, 0.45, 0)).box(0.6, 0.9, 0.025, V(0, 0.45, -0.25), [0.3, 0, 0]);
    const am = aSign.mesh(std({ color: 0x40362a, roughness: 0.7 }));
    am.position.set(14.5, 0.02, 14.6); am.rotation.set(-Math.PI / 2 + 0.05, 0, 0.7); scene.add(am);
    // a fire extinguisher on its side
    const ext = new Bundle(); ext.cyl(0.08, 0.45, V(0, 0, 0), [0, 0, Math.PI / 2], 14).cyl(0.02, 0.1, V(0.28, 0, 0), [0, 0, Math.PI / 2], 8);
    const em = ext.mesh(M.red); em.position.set(19.3, 0.08, 13.0); em.rotation.y = 0.5; scene.add(em);
    // chairs dragged out into the corridor
    const chair = new Bundle();
    chair.box(0.4, 0.03, 0.38, V(0, 0.43, 0)).box(0.4, 0.3, 0.025, V(0, 0.72, 0.19));
    for (const [cx, cz] of [[-0.18, -0.16], [0.18, -0.16], [-0.18, 0.17], [0.18, 0.17]]) chair.cyl(0.012, 0.43, V(cx, 0.215, cz), [0, 0, 0], 6);
    for (const [x, z, ry, fall] of [[11.2, 15.2, 2.2, 0], [27.6, 12.9, 0.4, 1], [38.5, 15.1, 4.0, 0]]) {
      const ch = chair.mesh(M.metal); ch.position.set(x, fall ? 0.2 : 0, z); ch.rotation.set(fall ? Math.PI / 2 : 0, ry, 0); scene.add(ch);
    }
  }

  // ---------------------------------------------------------------- puddles: black mirrors on the floor
  {
    const puddleMat = std({ color: 0x050607, roughness: 0.02, metalness: 0.1, transparent: true, opacity: 0.85, polygonOffset: true, polygonOffsetFactor: -2 });
    const shape = (r) => { const s = new THREE.Shape(); for (let k = 0; k <= 24; k++) { const a = k / 24 * Math.PI * 2, rr = r * (0.75 + 0.35 * Math.sin(a * 3 + r * 7) * Math.cos(a * 2)); k ? s.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : s.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); } return s; };
    for (const [x, z, r] of [[8.6, 15.2, 0.55], [9.6, 15.0, 0.3], [23, 14.8, 0.7], [33.5, 15.3, 0.45], [42, 14.5, 0.6], [5, 21.5, 0.5]]) {
      const p = new THREE.Mesh(new THREE.ShapeGeometry(shape(r)), puddleMat);
      p.rotation.x = -Math.PI / 2; p.position.set(x, 0.004, z); p.receiveShadow = true;
      scene.add(p);
    }
  }

  // ---------------------------------------------------------------- classrooms: a stopped clock, a lectern, a TV on a bracket
  for (const cx of [4, 12, 20]) {
    const x = cx * CELL + 1;
    const clock = new THREE.Group();
    const face = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.03, 24), [M.darkMetal, std({ color: 0xe8e4d8 }), M.darkMetal]);
    face.rotation.x = Math.PI / 2; clock.add(face);
    for (const [len, ang] of [[0.1, -2.4], [0.14, Math.PI / 2 - 0.15]]) {            // stopped at 4:44
      const hnd = new THREE.Mesh(new THREE.BoxGeometry(0.012, len, 0.005), M.darkMetal);
      hnd.position.set(Math.sin(ang) * len / 2, Math.cos(ang) * len / 2, 0.02); hnd.rotation.z = -ang; clock.add(hnd);
    }
    clock.position.set(x + 2.4, 2.7, 2.03); scene.add(clock);
    const lect = new Bundle(); lect.box(0.9, 1.0, 0.5, V(0, 0.5, 0)).box(1.0, 0.05, 0.6, V(0, 1.02, 0)).box(2.4, 0.2, 1.0, V(0, 0.1, 0.1));
    const lm = lect.mesh(M.doorWood); lm.position.set(x, 0, 3.1); scene.add(lm);
    const tv = new Bundle(); tv.box(0.75, 0.5, 0.45, V(0, 0, 0)).box(0.05, 0.4, 0.05, V(0, 0.45, -0.1)).box(0.3, 0.05, 0.3, V(0, 0.65, -0.1));
    const tm = tv.mesh(M.darkMetal); tm.position.set(x + 4.6, 2.3, 2.5); tm.rotation.y = -0.4; scene.add(tm);
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.4), std({ color: 0x050808, roughness: 0.1, emissive: 0x0a1a12 }));
    screen.position.set(x + 4.6 + Math.sin(-0.4) * 0.23, 2.3, 2.5 + Math.cos(-0.4) * 0.23); screen.rotation.y = -0.4; scene.add(screen);
  }
}

const MAPW = () => 30, MAPH = () => 13;
