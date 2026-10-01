// All sound is synthesized with WebAudio; nothing to download.
let ctx, master, sfx, musicBus, noiseBuf;
let music = null;

export function initAudio() {
  if (ctx) { ctx.resume(); return; }
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  master = ctx.createGain(); master.gain.value = 0.8; master.connect(ctx.destination);
  sfx = ctx.createGain(); sfx.gain.value = 0.9; sfx.connect(master);
  musicBus = ctx.createGain(); musicBus.gain.value = 0.32; musicBus.connect(master);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
}

const now = () => ctx.currentTime;

function noise({ dur = 0.2, freq = 1000, q = 1, type = 'bandpass', gain = 0.3, attack = 0.002, sweep, out = sfx, when = 0 }) {
  if (!ctx) return;
  const t = now() + when;
  const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
  if (sweep) f.frequency.exponentialRampToValueAtTime(sweep, t + dur);
  const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f); f.connect(g); g.connect(out);
  src.start(t, Math.random()); src.stop(t + dur + 0.05);
}

function tone({ freq = 440, dur = 0.15, type = 'square', gain = 0.12, slide, attack = 0.003, out = sfx, when = 0 }) {
  if (!ctx) return;
  const t = now() + when;
  const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
  const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.05);
}

export const sound = {
  step() { noise({ dur: 0.09, freq: 180 + Math.random() * 60, q: 0.8, type: 'lowpass', gain: 0.35 }); noise({ dur: 0.03, freq: 2500, q: 2, gain: 0.05 }); },
  bump() { tone({ freq: 70, slide: 40, dur: 0.18, type: 'sine', gain: 0.4 }); noise({ dur: 0.08, freq: 300, type: 'lowpass', gain: 0.2 }); },
  turn() { noise({ dur: 0.07, freq: 900, q: 0.6, gain: 0.04 }); },
  blip() { tone({ freq: 880, dur: 0.05, gain: 0.05 }); },
  ok() { tone({ freq: 660, dur: 0.06, gain: 0.06 }); tone({ freq: 990, dur: 0.09, gain: 0.06, when: 0.06 }); },
  back() { tone({ freq: 440, slide: 300, dur: 0.08, gain: 0.05 }); },
  type() { tone({ freq: 1800 + Math.random() * 400, dur: 0.015, gain: 0.03 }); },
  paper() { noise({ dur: 0.25, freq: 3000, q: 0.5, gain: 0.12, sweep: 1500 }); },
  hit() { noise({ dur: 0.18, freq: 700, q: 0.7, gain: 0.5, sweep: 200 }); tone({ freq: 160, slide: 50, dur: 0.2, type: 'sine', gain: 0.5 }); },
  crit() { this.hit(); tone({ freq: 1200, slide: 2400, dur: 0.12, gain: 0.08, type: 'sawtooth' }); },
  miss() { noise({ dur: 0.25, freq: 2000, q: 1, gain: 0.08, sweep: 600 }); },
  fire() { noise({ dur: 0.7, freq: 300, q: 0.6, gain: 0.5, sweep: 2400, attack: 0.05 }); noise({ dur: 0.5, freq: 120, type: 'lowpass', gain: 0.4 }); },
  elec() { for (let i = 0; i < 9; i++) tone({ freq: 200 + Math.random() * 2000, dur: 0.04, type: 'square', gain: 0.08, when: i * 0.035 }); noise({ dur: 0.35, freq: 4000, q: 0.3, gain: 0.25 }); },
  heal() { [523, 659, 784, 1047].forEach((f, i) => tone({ freq: f, dur: 0.4, type: 'sine', gain: 0.08, when: i * 0.07 })); },
  hurt() { tone({ freq: 220, slide: 90, dur: 0.25, type: 'sawtooth', gain: 0.15 }); noise({ dur: 0.2, freq: 500, gain: 0.3, type: 'lowpass' }); },
  appear() {
    noise({ dur: 1.0, freq: 200, q: 2, gain: 0.0001 });
    [110, 116.5, 155].forEach((f) => tone({ freq: f, slide: f * 2, dur: 0.9, type: 'sawtooth', gain: 0.07, attack: 0.6 }));
    noise({ dur: 0.9, freq: 400, q: 1, gain: 0.25, sweep: 3000, attack: 0.7 });
  },
  die() { noise({ dur: 1.0, freq: 3000, q: 0.5, gain: 0.25, sweep: 200 }); tone({ freq: 400, slide: 60, dur: 0.9, type: 'triangle', gain: 0.2 }); },
  thunder(big = true) {
    noise({ dur: big ? 3.4 : 2.4, freq: big ? 140 : 90, type: 'lowpass', gain: big ? 0.9 : 0.5, attack: big ? 0.02 : 0.4 });
    if (big) { noise({ dur: 0.5, freq: 1200, type: 'lowpass', gain: 0.45 }); noise({ dur: 2.0, freq: 60, type: 'lowpass', gain: 0.5, when: 0.4, attack: 0.3 }); }
  },
  brownout() { tone({ freq: 100, slide: 40, dur: 1.4, type: 'sawtooth', gain: 0.06 }); noise({ dur: 0.15, freq: 3000, q: 4, gain: 0.08 }); noise({ dur: 0.1, freq: 2500, q: 4, gain: 0.06, when: 2.6 }); },
  warp() {
    noise({ dur: 0.9, freq: 300, q: 3, gain: 0.35, sweep: 4000, attack: 0.4 });
    [55, 58.3, 82.4].forEach((f) => tone({ freq: f, slide: f * 0.5, dur: 1.0, type: 'sawtooth', gain: 0.12, attack: 0.05 }));
  },
  shutter() { for (let i = 0; i < 16; i++) noise({ dur: 0.12, freq: 600 + Math.random() * 300, q: 6, gain: 0.25, when: i * 0.1 }); tone({ freq: 55, dur: 1.8, type: 'sawtooth', gain: 0.12 }); },
  white() { noise({ dur: 2.5, freq: 6000, q: 0.2, gain: 0.35, attack: 0.3, type: 'highpass' }); tone({ freq: 60, slide: 30, dur: 2.5, type: 'sine', gain: 0.5 }); },
  win() { [392, 523, 659, 784].forEach((f, i) => tone({ freq: f, dur: 0.35, type: 'square', gain: 0.06, when: i * 0.1 })); },
};

// Weather and building hum, always on once started.
export function startAmbience() {
  if (!ctx || startAmbience.on) return;
  startAmbience.on = true;
  const rain = ctx.createBufferSource(); rain.buffer = noiseBuf; rain.loop = true;
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1400;
  const g = ctx.createGain(); g.gain.value = 0.12;
  rain.connect(f); f.connect(g); g.connect(master); rain.start();
  const hum = ctx.createOscillator(); hum.type = 'sawtooth'; hum.frequency.value = 100;
  const hf = ctx.createBiquadFilter(); hf.type = 'lowpass'; hf.frequency.value = 300;
  const hg = ctx.createGain(); hg.gain.value = 0.012;
  hum.connect(hf); hf.connect(hg); hg.connect(master); hum.start();
}

// A tiny step sequencer for battle themes.
const THEMES = {
  battle: { bpm: 152, bass: [45, 45, 57, 45, 48, 45, 55, 52, 45, 45, 57, 45, 43, 43, 50, 52], lead: [69, 0, 72, 0, 76, 0, 75, 72, 69, 0, 72, 0, 67, 0, 71, 0], leadEvery: 2 },
  boss: { bpm: 170, bass: [40, 40, 52, 40, 41, 41, 53, 41, 40, 40, 52, 40, 46, 46, 47, 47], lead: [64, 65, 64, 0, 71, 70, 67, 0, 64, 65, 64, 0, 76, 75, 71, 70], leadEvery: 1 },
};
const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

export function playMusic(name) {
  stopMusic();
  if (!ctx) return;
  const th = THEMES[name];
  const stepDur = 60 / th.bpm / 2;
  let step = 0, next = now() + 0.1;
  const id = setInterval(() => {
    while (next < now() + 0.2) {
      const when = next - now();
      const b = th.bass[step % th.bass.length];
      tone({ freq: midi(b), dur: stepDur * 0.9, type: 'sawtooth', gain: 0.22, out: musicBus, when });
      tone({ freq: midi(b - 12), dur: stepDur * 0.9, type: 'square', gain: 0.12, out: musicBus, when });
      if (step % 2 === 0) noise({ dur: 0.04, freq: 8000, type: 'highpass', gain: 0.08, out: musicBus, when });
      if (step % 8 === 4) noise({ dur: 0.15, freq: 1800, q: 0.8, gain: 0.25, out: musicBus, when });
      if (step % 8 === 0) tone({ freq: 90, slide: 40, dur: 0.18, type: 'sine', gain: 0.5, out: musicBus, when });
      const li = Math.floor(step / th.leadEvery) % th.lead.length;
      if (step % th.leadEvery === 0 && th.lead[li] && step >= 32) tone({ freq: midi(th.lead[li]), dur: stepDur * th.leadEvery * 0.85, type: 'square', gain: 0.06, out: musicBus, when });
      step++; next += stepDur;
    }
  }, 50);
  music = { id };
}

export function stopMusic() {
  if (music) { clearInterval(music.id); music = null; }
}
