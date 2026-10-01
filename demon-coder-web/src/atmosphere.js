// Weather and light that move: the storm sky through the windows, rain on the glass,
// moonlight that casts window shadows, light shafts, dust and ground mist.
import * as THREE from 'three';

// Where the moon sits, seen from inside. Moonlight travels the opposite way.
export const MOON_DIR = new THREE.Vector3(-0.25, 0.62, 1).normalize();

const NOISE_GLSL = `
  float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
  float fbm(vec2 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++){ s += a * vn(p); p = p * 2.03 + 11.7; a *= 0.5; } return s; }
`;

export function buildAtmosphere(scene, T, L) {
  const U = {
    time: { value: 0 }, flash: { value: 0 }, moon: { value: 1 }, cloud: { value: 0.5 },
    moonDir: { value: MOON_DIR.clone() }, bolt: { value: new THREE.Vector2(0.2, 0) },
  };

  // ---------------------------------------------------------------- sky, seen through the panes
  // Drawn on a plane just behind each window, but colored by view direction so it reads as infinitely far.
  const skyMat = new THREE.ShaderMaterial({
    uniforms: U,
    vertexShader: `varying vec3 vWorld; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vWorld = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `
      uniform float time, flash, moon, cloud; uniform vec3 moonDir; uniform vec2 bolt; varying vec3 vWorld;
      ${NOISE_GLSL}
      void main(){
        vec3 d = normalize(vWorld - cameraPosition);
        float el = d.y, az = atan(d.x, d.z);
        vec3 col = mix(vec3(0.020, 0.030, 0.034), vec3(0.004, 0.006, 0.010), smoothstep(-0.05, 0.6, el));
        // the moon, too big and too pale
        float md = acos(clamp(dot(d, moonDir), -1.0, 1.0));
        float disc = smoothstep(0.075, 0.068, md);
        float halo = exp(-md * 7.0) * 0.35 + exp(-md * 2.2) * 0.08;
        vec3 moonCol = vec3(0.86, 0.92, 0.80);
        // storm clouds sliding past
        vec2 cp = vec2(az * 2.2, el * 5.0) + vec2(time * 0.035, 0.0);
        float c = fbm(cp * 1.6);
        float cov = smoothstep(0.35 - cloud * 0.25, 0.8, c);
        col += moonCol * (disc * 0.9 + halo) * (1.0 - cov * 0.85) * moon;
        vec3 cloudLit = mix(vec3(0.03, 0.04, 0.045), vec3(0.20, 0.24, 0.22), halo * 2.0);
        col = mix(col, cloudLit * (0.6 + 0.6 * fbm(cp * 3.1 + 4.0)), cov * smoothstep(-0.05, 0.12, el));
        // lightning lights the cloud bellies, and sometimes a bolt shows
        col += vec3(0.55, 0.62, 0.75) * flash * (0.35 + cov * 1.2) * smoothstep(-0.05, 0.3, el);
        float bx = abs(az - bolt.x + (vn(vec2(el * 18.0, bolt.x * 9.0)) - 0.5) * 0.06);
        col += vec3(0.9, 0.95, 1.0) * bolt.y * smoothstep(0.006, 0.0, bx) * step(0.0, el) * step(el, 0.5);
        // the town: rooftops, a few lit windows that blink out
        float sky = step(0.012 + 0.05 * floor(vn(vec2(az * 22.0, 3.0)) * 4.0) / 4.0 * step(0.45, vn(vec2(az * 9.0, 1.0))), el);
        vec3 town = vec3(0.004, 0.005, 0.006);
        vec2 wg = vec2(az * 70.0, el * 110.0);
        vec2 wf = fract(wg);
        float lit = step(0.93, h21(floor(wg))) * step(0.22, wf.x) * step(wf.x, 0.78) * step(0.3, wf.y) * step(wf.y, 0.75) * step(-0.18, el);
        lit *= step(0.25, vn(vec2(floor(wg.x) * 0.1, time * 0.15 + floor(wg.y))));
        town += vec3(1.0, 0.62, 0.28) * lit * 0.32 * smoothstep(-0.18, 0.0, el);
        town += vec3(0.4, 0.45, 0.5) * flash * 0.05;
        col = mix(town, col, sky);
        // rain falling between us and everything
        vec2 rp = vec2(az * 140.0, el * 10.0 + time * 7.0);
        float streak = step(0.965, h21(vec2(floor(rp.x), floor(rp.y * 1.0 + h21(vec2(floor(rp.x), 1.0)) * 40.0))));
        col += vec3(0.10, 0.13, 0.14) * streak * (0.35 + flash * 2.0) * smoothstep(0.7, 0.0, fract(rp.y));
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
    fog: false,
  });

  // ---------------------------------------------------------------- glass with rain running down it
  const glassMat = new THREE.ShaderMaterial({
    uniforms: U,
    transparent: true, depthWrite: false,
    vertexShader: `varying vec2 vUv; varying vec3 vWorld; void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vWorld = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `
      uniform float time, flash, moon; varying vec2 vUv; varying vec3 vWorld;
      ${NOISE_GLSL}
      void main(){
        vec2 p = vUv * vec2(26.0, 38.0);
        // beads that sit still
        vec2 id = floor(p); vec2 f = fract(p) - 0.5;
        float r = h21(id);
        vec2 off = vec2(h21(id + 3.1), h21(id + 7.7)) - 0.5;
        float bead = smoothstep(0.14, 0.05, length(f - off * 0.6)) * step(0.8, r) * 0.6;
        // runnels that slide down and leave a trail
        float col = floor(vUv.x * 40.0);
        float speed = 0.25 + h21(vec2(col, 2.0)) * 0.6;
        float y = fract(vUv.y + time * speed * 0.18 + h21(vec2(col, 9.0)));
        float lane = smoothstep(0.35, 0.0, abs(fract(vUv.x * 40.0) - 0.5 - sin(vUv.y * 30.0 + col) * 0.15));
        float head = smoothstep(0.03, 0.0, abs(y - 0.06)) * lane;
        float trail = smoothstep(0.06, 0.6, y) * (1.0 - y) * lane * 0.35;
        float running = step(0.62, h21(vec2(col, floor(time * 0.1 + h21(vec2(col, 5.0)) * 10.0))));
        float wet = bead + (head + trail) * running;
        float a = 0.05 + wet * (0.5 + flash * 1.5);
        vec3 c = mix(vec3(0.20, 0.26, 0.27), vec3(0.75, 0.85, 0.95), wet) * (0.22 + moon * 0.18 + flash * 2.5);
        gl_FragColor = vec4(c, a);
        #include <colorspace_fragment>
      }`,
  });

  // ---------------------------------------------------------------- shafts of moonlight
  const shaftMat = new THREE.ShaderMaterial({
    uniforms: U,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: `attribute vec3 aS; varying vec3 vS; varying vec3 vWorld; void main(){ vS = aS; vec4 w = modelMatrix * vec4(position, 1.0); vWorld = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `
      uniform float time, flash, moon; varying vec3 vS; varying vec3 vWorld;
      ${NOISE_GLSL}
      void main(){
        float edge = smoothstep(0.0, 0.25, vS.x) * smoothstep(1.0, 0.75, vS.x) * smoothstep(0.0, 0.2, vS.y) * smoothstep(1.0, 0.8, vS.y);
        float fall = pow(1.0 - vS.z, 1.6);
        float dust = 0.55 + 0.45 * fbm(vWorld.xz * 1.3 + vec2(time * 0.08, vWorld.y * 0.8 - time * 0.05));
        float k = edge * fall * dust * (moon * 0.035 + flash * 0.25);
        gl_FragColor = vec4(vec3(0.62, 0.74, 0.70) * k, 1.0);
      }`,
  });

  const r = T.windowRect;
  for (const w of L.windowFaces) {
    // w: o (bottom-left seen from inside), u (unit along the wall), n (into the room)
    const center = w.o.clone().addScaledVector(w.u, 1).setY(1.5);
    const sky = new THREE.Mesh(new THREE.PlaneGeometry(2, 3), skyMat);
    sky.position.copy(center).addScaledVector(w.n, -0.6);
    sky.lookAt(center.clone().addScaledVector(w.n, 5));
    scene.add(sky);
    const gw = (r.u1 - r.u0) * 2, gh = (r.v1 - r.v0) * 3;
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(gw, gh), glassMat);
    const gc = w.o.clone().addScaledVector(w.u, (r.u0 + r.u1)).setY((r.v0 + r.v1) * 1.5);
    glass.position.copy(gc).addScaledVector(w.n, -0.04);
    glass.lookAt(gc.clone().addScaledVector(w.n, 5));
    scene.add(glass);
    scene.add(makeShaft(w, r, shaftMat));
  }

  // ---------------------------------------------------------------- moonlight with real shadows
  const moonLight = new THREE.DirectionalLight(0x9fb8c8, 0.0);
  moonLight.position.copy(new THREE.Vector3(30, 0, 13).addScaledVector(MOON_DIR, 40));
  moonLight.target.position.set(30, 0, 13);
  moonLight.castShadow = true;
  moonLight.shadow.mapSize.set(2048, 2048);
  const sc = moonLight.shadow.camera;
  sc.left = -36; sc.right = 36; sc.top = 24; sc.bottom = -24; sc.near = 5; sc.far = 90;
  moonLight.shadow.bias = -0.0004;
  moonLight.shadow.normalBias = 0.03;
  scene.add(moonLight, moonLight.target);

  // ---------------------------------------------------------------- dust in the air
  const N = 700;
  const pos = new Float32Array(N * 3), seed = new Float32Array(N);
  const floorCells = L.floorCells;
  for (let i = 0; i < N; i++) {
    const c = floorCells[Math.floor(Math.random() * floorCells.length)];
    pos[i * 3] = c.x + (Math.random() - 0.5) * 2; pos[i * 3 + 1] = Math.random() * 2.8; pos[i * 3 + 2] = c.z + (Math.random() - 0.5) * 2;
    seed[i] = Math.random();
  }
  const dg = new THREE.BufferGeometry();
  dg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  dg.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
  const dust = new THREE.Points(dg, new THREE.ShaderMaterial({
    uniforms: { ...U, tex: { value: T.glow } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `
      uniform float time; attribute float seed; varying float vA;
      void main(){
        vec3 p = position;
        p.x += sin(time * 0.21 + seed * 40.0) * 0.25; p.z += cos(time * 0.17 + seed * 23.0) * 0.25;
        p.y = mod(p.y + time * (0.03 + seed * 0.04), 2.9);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = (14.0 + seed * 10.0) / -mv.z;
        vA = (0.25 + 0.75 * fract(seed * 7.3 + time * 0.1)) * smoothstep(9.0, 2.0, -mv.z);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `uniform sampler2D tex; uniform float moon, flash; varying float vA;
      void main(){ float a = texture2D(tex, gl_PointCoord).a * vA * (0.18 + moon * 0.12 + flash); gl_FragColor = vec4(vec3(0.75, 0.82, 0.78) * a, 1.0); }`,
  }));
  dust.frustumCulled = false;
  scene.add(dust);

  // ---------------------------------------------------------------- ground mist
  const mist = [];
  const mistMat = new THREE.SpriteMaterial({ map: T.cloud, color: 0x18221f, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending, fog: true });
  for (let i = 0; i < 90; i++) {
    const c = floorCells[Math.floor(Math.random() * floorCells.length)];
    const s = new THREE.Sprite(mistMat);
    s.position.set(c.x + (Math.random() - .5) * 2, 0.15 + Math.random() * 0.5, c.z + (Math.random() - .5) * 2);
    s.scale.set(2.6 + Math.random() * 2, 1.0 + Math.random() * 0.6, 1);
    s.material.rotation = Math.random() * 6;
    s.userData = { vx: (Math.random() - .5) * 0.12, vz: (Math.random() - .5) * 0.12, home: s.position.clone() };
    scene.add(s); mist.push(s);
  }

  // ---------------------------------------------------------------- weather clock
  let nextStrike = 6 + Math.random() * 6, strike = null;
  const A = {
    U, moonLight,
    onStrike: null,
    strikeNow() { nextStrike = 0; },
    update(t, dt) {
      U.time.value = t;
      // clouds drift across the moon; the light in the room follows
      U.cloud.value = 0.5 + 0.35 * Math.sin(t * 0.07) + 0.15 * Math.sin(t * 0.23 + 1.3);
      const cover = THREE.MathUtils.clamp(U.cloud.value, 0, 1);
      U.moon.value = 1.15 - cover * 0.85;
      // lightning: a few quick pulses, then thunder after a gap
      nextStrike -= dt;
      if (nextStrike <= 0 && !strike) {
        strike = { t: 0, pulses: [0, 0.09 + Math.random() * 0.05, 0.3 + Math.random() * 0.15], big: Math.random() < 0.6 };
        U.bolt.value.set((Math.random() - 0.5) * 1.6, 0);
        nextStrike = 9 + Math.random() * 16;
        A.onStrike?.(strike.big);
      }
      let flash = 0;
      if (strike) {
        strike.t += dt;
        for (const p of strike.pulses) { const k = strike.t - p; if (k >= 0 && k < 0.16) flash = Math.max(flash, (1 - k / 0.16) * (strike.big ? 1 : 0.5)); }
        U.bolt.value.y = strike.big && strike.t < 0.35 ? 1 : 0;
        if (strike.t > 0.6) strike = null;
      }
      U.flash.value = flash;
      moonLight.intensity = U.moon.value * 1.3 + flash * 10;
      moonLight.color.setRGB(0.62 + flash * 0.3, 0.72 + flash * 0.25, 0.78 + flash * 0.22);
      for (const s of mist) {
        const d = s.userData;
        s.position.x += d.vx * dt; s.position.z += d.vz * dt;
        if (s.position.distanceTo(d.home) > 1.6) { d.vx *= -1; d.vz *= -1; }
        s.material.rotation += dt * 0.02;
      }
      return flash;
    },
  };
  return A;
}

// Crossed slices from the window panes into the room, following the moonlight. Additive slices read as a volume.
function makeShaft(w, r, mat) {
  const travel = MOON_DIR.clone().negate();
  const len = 7;
  const at = (a, b, far) => {
    const p = w.o.clone().addScaledVector(w.u, (r.u0 + (r.u1 - r.u0) * a) * 2).setY((r.v0 + (r.v1 - r.v0) * b) * 3);
    if (far) p.addScaledVector(travel, len);
    return p;
  };
  const pos = [], aS = [];
  const quad = (pts) => {
    for (const i of [0, 1, 2, 0, 2, 3]) { const [a, b, f] = pts[i]; const p = at(a, b, f); pos.push(p.x, p.y, p.z); aS.push(a, b, f); }
  };
  for (const a of [0.12, 0.37, 0.63, 0.88]) quad([[a, 0, 0], [a, 1, 0], [a, 1, 1], [a, 0, 1]]);
  for (const b of [0.2, 0.5, 0.8]) quad([[0, b, 0], [1, b, 0], [1, b, 1], [0, b, 1]]);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aS', new THREE.Float32BufferAttribute(aS, 3));
  const m = new THREE.Mesh(g, mat);
  m.frustumCulled = false;
  return m;
}
