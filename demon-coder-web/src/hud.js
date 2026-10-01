// The laptop HUD and every overlay. Portraits are the real 3D party models, rendered live.
import * as THREE from 'three';
import { ROSTER } from './characters.js';
import { loadPortrait } from './sprites.js';
import { MAP, W, Hh, at, isFloorCh, INTERACT } from './level.js';
import { sound } from './audio.js';

const $ = (s) => document.querySelector(s);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const PORTRAIT_BG = { touma: ['#3a2c0c', '#120d04'], gibbles: ['#2a1240', '#0a0412'], sparkles: ['#0e2e2c', '#04100f'] };

export class Hud {
  constructor(game) {
    this.game = game;
    this.party = [];
    this.pr = new THREE.WebGLRenderer({ alpha: true, antialias: false });
    this.pr.setPixelRatio(1);
    this.pr.setSize(112, 60, false);
    this.pr.outputColorSpace = THREE.SRGBColorSpace;
    this.visited = new Set();
    this.mapCtx = $('#automap').getContext('2d');
    this.mapCtx.imageSmoothingEnabled = false;
  }

  // ------------------------------------------------------------ party
  buildParty(members) {
    const root = $('#party');
    root.innerHTML = '';
    this.party = members;
    for (const m of members) {
      const el = document.createElement('div');
      el.className = 'slot';
      el.innerHTML = `<canvas width="112" height="60"></canvas><div class="info"><div class="name">${m.name}</div><div class="race">${m.race}</div><div class="bar"><i></i></div><div class="hp"></div></div>`;
      root.appendChild(el);
      m.el = el;
      m.ctx = el.querySelector('canvas').getContext('2d');
      // portrait stage
      const scene = new THREE.Scene();
      const rig = ROSTER[m.id](this.game.T);
      scene.add(rig.root);
      scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x3a2a20, 1.6));
      const key = new THREE.DirectionalLight(0xfff0dc, 2.6); key.position.set(1.5, 2.5, 3); scene.add(key);
      const rim = new THREE.DirectionalLight(0x8fd8ff, 1.6); rim.position.set(-2, 1, -2); scene.add(rim);
      const cam = new THREE.PerspectiveCamera(24, 112 / 60, 0.05, 10);
      const fy = rig.faceY;
      const dist = m.id === 'touma' ? 0.62 : m.id === 'gibbles' ? 1.05 : 0.75;
      cam.position.set(0.05, fy + 0.02, dist);
      cam.lookAt(0, fy - (m.id === 'touma' ? 0.05 : 0.03), 0);
      m.portrait = { scene, rig, cam, hurt: 0, attack: 0, art: new URLSearchParams(location.search).has('3d') ? null : loadPortrait(m.id), blink: 0, nextBlink: 2 };
      if (m.portrait.art) { const cv = el.querySelector('canvas'); cv.width = 224; cv.height = 120; cv.style.imageRendering = 'auto'; }
      this.setHP(m);
    }
    for (let i = members.length; i < 6; i++) {
      const el = document.createElement('div');
      el.className = 'slot empty';
      el.textContent = '- EMPTY -';
      root.appendChild(el);
    }
  }

  setHP(m) {
    const pct = Math.max(0, m.hpNow / m.hp);
    const bar = m.el.querySelector('.bar i');
    bar.style.width = pct * 100 + '%';
    bar.classList.toggle('low', pct < 0.3);
    m.el.querySelector('.hp').textContent = `HP ${Math.max(0, m.hpNow)}/${m.hp}`;
    m.el.classList.toggle('down', m.hpNow <= 0);
  }

  setActive(m) { for (const p of this.party) p.el.classList.toggle('active', p === m); }

  hurt(m) {
    m.portrait.hurt = 1;
    m.el.classList.remove('hurt'); void m.el.offsetWidth; m.el.classList.add('hurt');
  }
  attack(m) { m.portrait.attack = 1; }

  updatePortraits(t, dt) {
    for (const m of this.party) {
      const p = m.portrait;
      p.hurt = Math.max(0, p.hurt - dt * 1.6);
      p.attack = Math.max(0, p.attack - dt * 2);
      const st = { hurt: Math.min(1, p.hurt * 1.5), attack: Math.sin(Math.min(1, p.attack) * Math.PI), low: m.hpNow / m.hp < 0.3 };
      if (m.hpNow <= 0) { st.hurt = 1; }
      if (p.art) { this.drawArt(m, p, st, t, dt); continue; }
      p.rig.update(t + m.hp, dt, st);
      p.rig.setFlash(p.hurt > 0.6 ? (p.hurt - 0.6) * 1.8 : 0, 0xff2030);
      this.pr.render(p.scene, p.cam);
      const g = m.ctx;
      const [a, b] = PORTRAIT_BG[m.id];
      const grad = g.createLinearGradient(0, 0, 0, 60);
      grad.addColorStop(0, a); grad.addColorStop(1, b);
      g.fillStyle = grad; g.fillRect(0, 0, 112, 60);
      g.drawImage(this.pr.domElement, 0, 0);
      if (p.hurt > 0.5) { g.fillStyle = `rgba(255,30,40,${(p.hurt - 0.5) * 0.6})`; g.fillRect(0, 0, 112, 60); }
    }
  }

  // Drawn portrait: pick the expression, crop to the face, add a little life.
  drawArt(m, p, st, t, dt) {
    p.nextBlink -= dt;
    if (p.nextBlink < 0) { p.blink = 0.13; p.nextBlink = 2 + Math.random() * 4; }
    p.blink = Math.max(0, p.blink - dt);
    const e = m.hpNow <= 0 || st.hurt > 0.3 ? 'hurt' : st.attack > 0.2 ? 'attack' : p.blink > 0 ? 'blink' : st.low ? 'low' : 'neutral';
    const g = m.ctx, W = 224, H = 120;
    const [a, b] = PORTRAIT_BG[m.id];
    const grad = g.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, a); grad.addColorStop(1, b);
    g.fillStyle = grad; g.fillRect(0, 0, W, H);
    const bob = Math.sin(t * 1.6) * 1.2, shake = st.hurt > 0 ? Math.sin(t * 60) * 4 * st.hurt : 0;
    // source crop around the face in the 400x400 art
    const sw = 290, sh = sw * H / W, sx = 56 + shake, sy = 92 + bob - st.attack * 6;
    g.drawImage(p.art[e], sx, sy, sw, sh, 0, 0, W, H);
    if (p.hurt > 0.5) { g.fillStyle = `rgba(255,30,40,${(p.hurt - 0.5) * 0.5})`; g.fillRect(0, 0, W, H); }
  }

  // ------------------------------------------------------------ explore vs battle
  mode(m) {
    const battle = m === 'battle';
    $('#automap').style.display = battle ? 'none' : 'block';
    $('#menu').style.display = battle ? 'block' : 'none';
    $('#loc').style.display = battle ? 'none' : 'inline';
    if (!battle) { $('#turns').innerHTML = ''; this.log(''); }
  }

  log(text) { $('#log').textContent = text; }
  setLoc(text) { $('#loc').textContent = text; }

  turns(icons, enemy) {
    $('#turns').innerHTML = icons.map((h) => `<div class="t ${h === 'half' ? 'half' : ''} ${enemy ? 'enemy' : ''}"></div>`).join('');
  }

  async menu(items, { head = '', desc } = {}) {
    let sel = Math.max(0, items.findIndex((i) => !i.off));
    const el = $('#menu');
    const draw = () => {
      el.innerHTML = (head ? `<div class="head">${head}</div>` : '') +
        items.map((it, i) => `<div class="item ${i === sel ? 'sel' : ''} ${it.off ? 'off' : ''}">${it.label}</div>`).join('') +
        (items[sel]?.desc ? `<div class="desc">${items[sel].desc}</div>` : '');
      items[sel]?.onHover?.();
    };
    draw();
    for (;;) {
      const k = await this.game.input.next(['up', 'down', 'ok', 'back', 'left', 'right']);
      if (k === 'up' || k === 'left') { sel = (sel - 1 + items.length) % items.length; sound.blip(); draw(); }
      if (k === 'down' || k === 'right') { sel = (sel + 1) % items.length; sound.blip(); draw(); }
      if (k === 'ok') { if (items[sel].off) { sound.back(); continue; } sound.ok(); el.innerHTML = ''; return sel; }
      if (k === 'back') { sound.back(); el.innerHTML = ''; return -1; }
    }
  }

  // ------------------------------------------------------------ automap
  markVisited(x, y) {
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) this.visited.add((x + dx) + ',' + (y + dy));
  }
  setSignal(v) { this.signal = v; }
  drawMap(px, py, dir, read) {
    const g = this.mapCtx, s = 6, ox = 10, oy = 18;
    g.clearRect(0, 0, 200, 132);
    for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) {
      if (!this.visited.has(x + ',' + y)) continue;
      const c = at(x, y);
      if (isFloorCh(c)) { g.fillStyle = c === 'S' ? '#5a2020' : '#1d4a35'; g.fillRect(ox + x * s, oy + y * s, s, s); }
      else { g.fillStyle = '#5dffb0'; g.globalAlpha = 0.5; g.fillRect(ox + x * s, oy + y * s, s, s); g.globalAlpha = 1; }
    }
    for (const it of INTERACT) {
      if (!this.visited.has(it.x + ',' + it.y) || it.id === 'page2') continue;
      g.fillStyle = read.has(it.note || it.id) ? '#6f8f7c' : '#ffd84a';
      g.fillRect(ox + it.x * s + 2, oy + it.y * s + 2, 2, 2);
    }
    // player arrow
    g.save(); g.translate(ox + px * s + s / 2, oy + py * s + s / 2); g.rotate(dir * Math.PI / 2);
    g.fillStyle = '#ff4d5e'; g.beginPath(); g.moveTo(0, -4); g.lineTo(3.5, 3.5); g.lineTo(-3.5, 3.5); g.fill(); g.restore();
    g.fillStyle = '#6f8f7c'; g.font = '14px monospace'; g.fillText('1F  KAGEMORI HIGH', 10, 12);
    // demon signal, the closer an encounter the more bars light
    const sig = this.signal || 0;
    g.fillText('SIGNAL', 10, 128);
    for (let i = 0; i < 8; i++) {
      const on = sig * 8 > i + 0.2;
      g.fillStyle = on ? (i > 5 ? '#ff4d5e' : i > 3 ? '#ffd84a' : '#5dffb0') : '#16301f';
      if (on && sig > 0.7 && Math.random() < 0.3) g.fillStyle = '#16301f';
      g.fillRect(64 + i * 15, 118, 11, 10);
    }
  }

  // ------------------------------------------------------------ floaters
  floatAt(x, y, text, cls = '', tag = '') {
    const d = document.createElement('div');
    d.className = 'floater ' + cls;
    d.style.left = x + 'px'; d.style.top = y + 'px';
    d.innerHTML = (tag ? `<span class="tag">${tag}</span>` : '') + text;
    $('#floaters').appendChild(d);
    setTimeout(() => d.remove(), 1100);
  }
  floatOnMember(m, text, cls, tag) {
    const hud = $('#hud').getBoundingClientRect(), r = m.el.getBoundingClientRect();
    const k = 1280 / hud.width;
    this.floatAt((r.left - hud.left + r.width * 0.3) * k, (r.top - hud.top) * k - 4, text, cls, tag);
  }
  floatOnWorld(v, text, cls, tag) {
    const p = v.clone().project(this.game.camera);
    this.floatAt((p.x * 0.5 + 0.5) * 1280, (-p.y * 0.5 + 0.5) * 720, text, cls, tag);
  }

  // ------------------------------------------------------------ overlays
  toast(text, ms = 1800) {
    const t = $('#toast'); t.textContent = text; t.style.opacity = 1;
    clearTimeout(this._toast); this._toast = setTimeout(() => (t.style.opacity = 0), ms);
  }
  prompt(text) { const p = $('#prompt'); p.textContent = text || ''; p.style.opacity = text ? 1 : 0; }

  flash(color = '#fff', ms = 400, peak = 1) {
    const f = $('#flash');
    f.style.transition = 'none'; f.style.background = color; f.style.opacity = peak;
    requestAnimationFrame(() => { f.style.transition = `opacity ${ms}ms`; f.style.opacity = 0; });
  }

  async dialogue(who, text) {
    const d = $('#dialogue');
    d.style.display = 'block';
    d.querySelector('.who').textContent = who;
    const tx = d.querySelector('.text');
    tx.textContent = '';
    let skip = false;
    const waiter = this.game.input.next(['ok', 'back']).then(() => (skip = true));
    for (const ch of text) { if (skip) break; tx.textContent += ch; if (ch !== ' ') sound.type(); await sleep(28); }
    tx.textContent = text;
    if (!skip) await waiter; else await this.game.input.next(['ok', 'back']);
    d.style.display = 'none';
  }

  async note(n) {
    const box = $('#note'), paper = box.querySelector('.paper');
    paper.className = 'paper ' + (n.style || 'paper');
    paper.innerHTML = (n.title ? `<h3>${n.title}</h3>` : '');
    if (n.html) paper.innerHTML += n.html; else paper.appendChild(document.createTextNode(n.text));
    box.style.display = 'flex';
    sound.paper();
    await this.game.input.next(['ok', 'back']);
    sound.back();
    box.style.display = 'none';
  }

  async card(html, wait = true) {
    const c = $('#card'); c.innerHTML = html; c.style.display = 'flex';
    if (wait) { await sleep(600); await this.game.input.next(['ok']); c.style.display = 'none'; }
  }
  hideCard() { $('#card').style.display = 'none'; }
}
