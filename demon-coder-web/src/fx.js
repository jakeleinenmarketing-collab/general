// Pooled additive sprites for every burst, spark and wisp.
import * as THREE from 'three';

export class Particles {
  constructor(scene, tex, size = 260) {
    this.pool = [];
    for (let i = 0; i < size; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
      s.visible = false;
      s.userData = { v: new THREE.Vector3(), life: 0, max: 1, size: 0.2, grav: 0, drag: 0, grow: 0 };
      scene.add(s);
      this.pool.push(s);
    }
    this.i = 0;
  }
  emit(pos, { n = 10, color = 0xffffff, speed = 1.5, life = 0.7, size = 0.25, grav = 0, spread = 1, up = 0, drag = 1.5, grow = 0, jitter = 0.1 } = {}) {
    const c = new THREE.Color(color);
    for (let k = 0; k < n; k++) {
      const s = this.pool[this.i++ % this.pool.length];
      const d = s.userData;
      s.position.copy(pos).add(new THREE.Vector3((Math.random() - .5) * jitter, (Math.random() - .5) * jitter, (Math.random() - .5) * jitter));
      d.v.set((Math.random() - .5) * 2 * spread, (Math.random() - .5) * 2 * spread + up, (Math.random() - .5) * 2 * spread).normalize().multiplyScalar(speed * (0.4 + Math.random() * 0.8));
      d.v.y += up;
      d.life = d.max = life * (0.6 + Math.random() * 0.6);
      d.size = size * (0.6 + Math.random() * 0.8); d.grav = grav; d.drag = drag; d.grow = grow;
      s.material.color.copy(c);
      s.visible = true;
    }
  }
  update(dt) {
    for (const s of this.pool) {
      if (!s.visible) continue;
      const d = s.userData;
      d.life -= dt;
      if (d.life <= 0) { s.visible = false; continue; }
      d.v.y -= d.grav * dt;
      d.v.multiplyScalar(Math.max(0, 1 - d.drag * dt));
      s.position.addScaledVector(d.v, dt);
      const k = d.life / d.max;
      s.material.opacity = Math.min(1, k * 2);
      s.scale.setScalar(d.size * (1 + (1 - k) * d.grow));
    }
  }
}

// A jagged bolt from above, for Zio.
export function bolt(scene, to, color = 0xcfe8ff) {
  const pts = [];
  const from = to.clone().add(new THREE.Vector3((Math.random() - .5) * 0.6, 3, 0));
  for (let i = 0; i <= 10; i++) {
    const p = from.clone().lerp(to, i / 10);
    if (i > 0 && i < 10) p.add(new THREE.Vector3((Math.random() - .5) * 0.35, 0, (Math.random() - .5) * 0.35));
    pts.push(p);
  }
  const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color, transparent: true, blending: THREE.AdditiveBlending }));
  scene.add(line);
  let t = 0;
  const id = setInterval(() => { t += 1; line.material.opacity = 1 - t / 8; if (t >= 8) { clearInterval(id); scene.remove(line); line.geometry.dispose(); } }, 30);
}
