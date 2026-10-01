// Turn-based battles fought in the corridor itself: enemies stand in the world, the menu lives on the laptop.
import * as THREE from 'three';
import { ROSTER, RIM } from './characters.js';
import { ENEMIES, SKILLS } from './data.js';
import { sound, playMusic, stopMusic } from './audio.js';
import { bolt } from './fx.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rnd = (a, b) => a + Math.random() * (b - a);
const anim = (ms, fn) => new Promise((res) => {
  const t0 = performance.now();
  const step = () => { const k = Math.min(1, (performance.now() - t0) / ms); fn(k); if (k < 1) requestAnimationFrame(step); else res(); };
  step();
});

// Press-turn: a weakness or crit only spends half a turn, a miss or resist spends two.
function consume(icons, result) {
  if (result === 'weak') {
    const i = icons.lastIndexOf('full');
    if (i >= 0) icons[i] = 'half'; else icons.pop();
  } else if (result === 'miss') {
    icons.pop(); icons.pop();
  } else if (result === 'pass') {
    const i = icons.lastIndexOf('full');
    if (i >= 0 && !icons.includes('half')) icons[i] = 'half'; else icons.pop();
  } else {
    const h = icons.lastIndexOf('half');
    if (h >= 0) icons.splice(h, 1); else icons.pop();
  }
}

export async function runBattle(game, group, opts = {}) {
  const { scene, camera, hud, T, fx } = game;
  const party = game.party;
  const yaw = game.player.yaw;
  const fwd = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
  const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
  const eye = game.player.pos.clone();
  const grade = game.grade.uniforms;
  const isBoss = group.some((k) => ENEMIES[k].boss);

  // the corridor twists away into the dark
  sound.warp();
  await anim(520, (k) => (grade.warp.value = k));

  // ---------------------------------------------------------------- spawn
  const enemies = group.map((kind, i) => {
    const def = ENEMIES[kind];
    const rig = opts.rigs?.[i] || ROSTER[kind](T);
    const e = { ...def, kind, rig, hpNow: def.hp, st: { hurt: 0, attack: 0, low: false }, alive: true };
    if (!opts.rigs) {
      const lateral = group.length === 1 ? 0 : (i - (group.length - 1) / 2) * 1.5;
      const dist = def.boss ? 3.8 : 3.3;
      rig.root.position.copy(eye).addScaledVector(fwd, dist).addScaledVector(right, lateral);
      rig.root.position.y = 0;
      rig.root.rotation.y = yaw;
      rig.dissolve.value = 1.05;
      scene.add(rig.root);
    }
    e.home = rig.root.position.clone();
    return e;
  });
  game.enemies = enemies;

  // HP plates above heads
  const plates = enemies.map((e) => {
    const d = document.createElement('div');
    d.className = 'ebar';
    d.innerHTML = `<div class="n">${e.name}</div><div class="b"><i></i></div>`;
    document.querySelector('#floaters').appendChild(d);
    return d;
  });
  const updatePlates = () => enemies.forEach((e, i) => {
    const p = e.rig.root.position.clone(); p.y += e.rig.height * e.rig.root.scale.y + 0.15;
    const s = p.project(camera);
    plates[i].style.left = (s.x * 0.5 + 0.5) * 1280 + 'px';
    plates[i].style.top = (-s.y * 0.5 + 0.5) * 720 + 'px';
    plates[i].style.opacity = e.alive && e.rig.root.scale.y > 0.5 ? 1 : 0;
    plates[i].querySelector('i').style.width = Math.max(0, e.hpNow / e.hp) * 100 + '%';
    plates[i].classList.toggle('sel', !!e.targeted);
  });

  const tickers = [];
  game.onFrame = (t, dt) => {
    for (const e of enemies) {
      e.st.hurt = Math.max(0, e.st.hurt - dt * 2.5);
      e.st.attack = Math.max(0, e.st.attack - dt * 2.2);
      e.st.low = e.hpNow / e.hp < 0.4;
      if (e.alive) e.rig.update(t, dt, { hurt: e.st.hurt, attack: Math.sin(Math.min(1, e.st.attack) * Math.PI), low: e.st.low });
      e.rig.setFlash(e.targeted ? 0.25 + Math.sin(t * 10) * 0.15 : e.st.hurt > 0.5 ? (e.st.hurt - 0.5) * 2 : 0, e.st.hurt > 0.5 ? 0xffffff : 0xffd84a);
    }
    for (const f of tickers) f(t, dt);
    updatePlates();
  };

  hud.mode('battle');
  game.player.pitchTarget = enemies.some((e) => e.boss) ? -0.02 : -0.16;
  playMusic(enemies.some((e) => e.boss) ? 'boss' : 'battle');

  // stage light on the demons, and a red light behind them
  const center = enemies.reduce((v, e) => v.add(e.home), new THREE.Vector3()).divideScalar(enemies.length);
  const key = new THREE.SpotLight(0xd8e6ff, isBoss ? 9 : 8, 14, 0.55, 0.7, 1.4);
  key.position.copy(eye).addScaledVector(fwd, 0.6).setY(2.9);
  key.target.position.copy(center).setY(0.8);
  const back = new THREE.PointLight(isBoss ? 0xff1a2a : 0xb02060, 8, 7, 1.5);
  back.position.copy(center).addScaledVector(fwd, 1.4).setY(1.6);
  scene.add(key, key.target, back);
  const rimWas = RIM.value.clone();
  RIM.value.set(isBoss ? 0x6a1820 : 0x3a2650);

  // ---------------------------------------------------------------- appear
  sound.appear();
  for (const e of enemies) fx.emit(e.home.clone().setY(0.8), { n: 50, color: 0xff4fd0, speed: 2.2, life: 1.1, size: 0.25, up: 0.8 });
  await anim(1100, (k) => {
    grade.warp.value = Math.max(0, 1 - k * 1.8);
    if (!opts.rigs) for (const e of enemies) e.rig.dissolve.value = 1.05 * (1 - k);
  });
  hud.log(enemies.length === 1 ? `${enemies[0].name} appears.` : `${enemies.length} demons appear.`);
  await sleep(900);

  // ---------------------------------------------------------------- helpers
  const alive = () => enemies.filter((e) => e.alive);
  const living = () => party.filter((m) => m.hpNow > 0);
  const naomi = party[0];

  async function pickEnemy() {
    const list = alive();
    if (list.length === 1) return list[0];
    let i = 0;
    for (;;) {
      list.forEach((e, k) => (e.targeted = k === i));
      hud.log(`Target: ${list[i].name}`);
      const k = await game.input.next(['left', 'right', 'up', 'down', 'ok', 'back']);
      if (k === 'left' || k === 'up') { i = (i - 1 + list.length) % list.length; sound.blip(); }
      if (k === 'right' || k === 'down') { i = (i + 1) % list.length; sound.blip(); }
      if (k === 'ok') { list.forEach((e) => (e.targeted = false)); sound.ok(); return list[i]; }
      if (k === 'back') { list.forEach((e) => (e.targeted = false)); sound.back(); return null; }
    }
  }

  async function chooseAction(m) {
    for (;;) {
      const skills = m.skills.map((id) => SKILLS[id]);
      const items = skills.map((s) => ({ label: s.name, desc: s.desc }));
      items.push({ label: 'Pass', desc: 'Hand the turn to the next ally.' });
      if (!enemies.some((e) => e.boss)) items.push({ label: 'Run', desc: 'Try to get away.' });
      const i = await hud.menu(items, { head: m.name });
      if (i < 0) continue;
      if (i === skills.length) return { kind: 'pass' };
      if (i === skills.length + 1) return { kind: 'run' };
      const skill = skills[i];
      if (skill.target === 'enemy') { const t = await pickEnemy(); if (!t) continue; return { kind: 'skill', skill, target: t }; }
      if (skill.target === 'ally') {
        const j = await hud.menu(party.map((p) => ({ label: `${p.name.padEnd(9)}${p.hpNow}/${p.hp}`, off: p.hpNow <= 0 })), { head: 'HEAL WHO' });
        if (j < 0) continue;
        return { kind: 'skill', skill, target: party[j] };
      }
      return { kind: 'skill', skill, target: m };
    }
  }

  function shake(a) { game.shake = Math.max(game.shake, a); }

  async function lunge(e, toward = 0.9) {
    e.st.attack = 1;
    const back = e.home.clone();
    const to = e.home.clone().addScaledVector(fwd, -toward);
    const t0 = performance.now();
    await new Promise((res) => tickers.push(function l() {
      const k = Math.min(1, (performance.now() - t0) / 420);
      e.rig.root.position.lerpVectors(back, to, Math.sin(k * Math.PI));
      if (k === 1) { tickers.splice(tickers.indexOf(l), 1); res(); }
    }));
  }

  async function kill(e) {
    e.alive = false;
    sound.die();
    const c = e.rig.root.position.clone().setY(e.rig.height * 0.5);
    fx.emit(c, { n: 60, color: 0xff6a9a, speed: 3, life: 1.1, size: 0.3, grav: -1, spread: 1 });
    fx.emit(c, { n: 14, color: 0xffffff, speed: 1.5, life: 1.4, size: 0.12, up: 1.2 });
    await anim(900, (k) => { e.rig.dissolve.value = k * 1.05; e.rig.setFlash(0.4 * (1 - k), 0xffd0e0); });
    e.rig.root.visible = false;
  }

  async function partyAct(m, act) {
    hud.attack(m);
    if (act.kind === 'pass') { hud.log(`${m.name} waits.`); await sleep(350); return 'pass'; }
    if (act.kind === 'run') {
      hud.log(`${m.name} runs...`); await sleep(500);
      if (Math.random() < 0.6) { hud.log('Got away.'); await sleep(600); return 'fled'; }
      hud.log("Couldn't get away."); sound.miss(); await sleep(700); return 'miss';
    }
    const { skill, target } = act;
    if (skill.type === 'guard') { m.guard = true; hud.log(`${m.name} braces.`); sound.blip(); await sleep(400); return 'normal'; }
    if (skill.type === 'heal') {
      hud.log(`${m.name}: ${skill.name}.`);
      sound.heal();
      await sleep(300);
      const amt = Math.round(skill.power * rnd(0.9, 1.1));
      target.hpNow = Math.min(target.hp, target.hpNow + amt);
      hud.setHP(target); hud.floatOnMember(target, '+' + amt, 'heal');
      fx.emit(eye.clone().addScaledVector(fwd, 0.8).setY(1.0), { n: 20, color: 0x5dffb0, speed: 0.6, life: 0.9, size: 0.12, up: 1 });
      await sleep(600);
      return 'normal';
    }
    // offensive
    hud.log(`${m.name}: ${skill.name}!`);
    const tpos = target.rig.root.position.clone().setY(target.rig.faceY * 0.7);
    if (skill.type === 'phys') {
      sound.hit();
      camera.fov -= 4; camera.updateProjectionMatrix(); setTimeout(() => { camera.fov += 4; camera.updateProjectionMatrix(); }, 140);
      fx.emit(tpos, { n: 16, color: 0xffffff, speed: 4, life: 0.25, size: 0.18, spread: 1 });
    } else if (skill.type === 'fire') {
      sound.fire();
      fx.emit(tpos.clone().setY(0.2), { n: 70, color: 0xff7a1a, speed: 1.8, life: 0.9, size: 0.5, up: 1.6, spread: 0.6, grow: 1 });
      fx.emit(tpos, { n: 30, color: 0xffe08a, speed: 1, life: 0.6, size: 0.3, up: 1 });
      game.burst(tpos, 0xff7a1a, 30);
      await sleep(250);
    } else if (skill.type === 'elec') {
      sound.elec();
      bolt(scene, tpos); setTimeout(() => bolt(scene, tpos), 90);
      hud.flash('#cfe8ff', 300, 0.5);
      fx.emit(tpos, { n: 40, color: 0xbfe0ff, speed: 3.5, life: 0.4, size: 0.18 });
      game.burst(tpos, 0x9fd8ff, 40);
      await sleep(200);
    }
    // resolve
    const missed = skill.type === 'phys' && Math.random() < 0.06;
    if (missed) { hud.floatOnWorld(tpos, 'MISS', 'miss'); sound.miss(); await sleep(600); return 'miss'; }
    const crit = skill.type === 'phys' && Math.random() < 0.12;
    let mult = 1, tag = '';
    let result = 'normal';
    if (target.weak.includes(skill.type)) { mult = 1.5; tag = 'WEAK'; result = 'weak'; }
    else if (target.resist.includes(skill.type)) { mult = 0.5; tag = 'RESIST'; result = 'miss'; }
    if (crit && result !== 'miss') { mult *= 1.5; tag = tag ? tag + ' + CRITICAL' : 'CRITICAL'; result = 'weak'; sound.crit(); }
    const dmg = Math.max(1, Math.round((m.atk + skill.power) * mult * rnd(0.88, 1.12)));
    target.hpNow -= dmg;
    target.st.hurt = 1;
    shake(result === 'weak' ? 0.12 : 0.06);
    hud.floatOnWorld(tpos, dmg, result === 'weak' ? 'weak' : '', tag);
    if (result === 'weak') { hud.toast(tag, 900); }
    await sleep(650);
    if (target.hpNow <= 0) await kill(target);
    return result;
  }

  async function enemyAct(e) {
    const move = e.moves[Math.floor(Math.random() * e.moves.length)];
    hud.log(move.line || `${e.name}: ${move.name}!`);
    await sleep(500);
    if (move.target === 'none') { e.st.attack = 1; await sleep(900); return 'normal'; }
    await lunge(e, e.boss ? 0.6 : 1.0);
    const targets = move.target === 'all' ? living() : [living()[Math.floor(Math.random() * living().length)]];
    let result = 'normal';
    for (const m of targets) {
      const crit = Math.random() < 0.08;
      let dmg = Math.max(1, Math.round((e.atk + move.power) * rnd(0.85, 1.15) * (crit ? 1.5 : 1)));
      if (m.guard) dmg = Math.ceil(dmg / 2);
      m.hpNow = Math.max(0, m.hpNow - dmg);
      hud.setHP(m); hud.hurt(m);
      hud.floatOnMember(m, dmg, crit ? 'weak' : '', crit ? 'CRITICAL' : '');
      if (crit) result = 'weak';
    }
    sound.hurt(); shake(0.15);
    hud.flash('#ff1030', 350, 0.35);
    await sleep(700);
    for (const m of targets) if (m.hpNow <= 0) { hud.log(`${m.name} goes down.`); await sleep(700); }
    return result;
  }

  // ---------------------------------------------------------------- loop
  let outcome = null;
  let actor = 0;
  battle: for (;;) {
    // party phase
    let icons = living().map(() => 'full');
    hud.turns(icons);
    while (icons.length && !outcome) {
      let m;
      for (let k = 0; k < party.length; k++) { m = party[(actor + k) % party.length]; if (m.hpNow > 0) { actor = (party.indexOf(m) + 1) % party.length; break; } }
      m.guard = false;
      hud.setActive(m);
      hud.log('');
      const act = await chooseAction(m);
      hud.setActive(null);
      const r = await partyAct(m, act);
      if (r === 'fled') { outcome = 'fled'; break battle; }
      consume(icons, r);
      hud.turns(icons);
      if (!alive().length) { outcome = 'win'; break battle; }
    }
    // enemy phase
    icons = alive().flatMap((e) => Array(e.turns || 1).fill('full'));
    hud.turns(icons, true);
    let ei = 0;
    await sleep(300);
    while (icons.length) {
      const list = alive();
      const e = list[ei++ % list.length];
      const r = await enemyAct(e);
      consume(icons, r);
      hud.turns(icons, true);
      if (naomi.hpNow <= 0 || !living().length) { outcome = 'lose'; break battle; }
    }
  }

  // ---------------------------------------------------------------- wrap up
  stopMusic();
  scene.remove(key, key.target, back);
  RIM.value.copy(rimWas);
  for (const m of party) m.guard = false;
  if (outcome === 'win') { sound.win(); hud.log('The hall goes quiet.'); hud.toast('VICTORY', 1400); await sleep(1300); }
  for (const e of enemies) if (!opts.keep) scene.remove(e.rig.root);
  plates.forEach((p) => p.remove());
  game.onFrame = null; game.enemies = [];
  game.player.pitchTarget = 0;
  hud.mode('explore');
  return outcome;
}
