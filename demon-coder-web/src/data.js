// Game content. Numbers and words live here so they can change without touching code.
// Note and dialogue text is placeholder carried over from the 9/27 story session; the script is still being written.

export const PARTY = [
  { id: 'touma', name: 'NAOMI', race: 'Human', hp: 64, atk: 13, skills: ['attack', 'guard'] },
  { id: 'gibbles', name: 'GIBBLES', race: 'Fiend', hp: 48, atk: 8, skills: ['agi', 'zio', 'attack', 'guard'] },
  { id: 'sparkles', name: 'SPARKLES', race: 'Cat', hp: 42, atk: 7, skills: ['dia', 'scratch', 'guard'] },
];

export const SKILLS = {
  attack: { name: 'Attack', type: 'phys', power: 0, target: 'enemy', desc: 'Hit one foe.' },
  scratch: { name: 'Scratch', type: 'phys', power: 3, target: 'enemy', desc: 'Claws. One foe.' },
  agi: { name: 'Agi', type: 'fire', power: 17, target: 'enemy', desc: 'Fire. One foe.' },
  zio: { name: 'Zio', type: 'elec', power: 16, target: 'enemy', desc: 'Lightning. One foe.' },
  dia: { name: 'Dia', type: 'heal', power: 28, target: 'ally', desc: 'Heal one ally.' },
  guard: { name: 'Guard', type: 'guard', target: 'self', desc: 'Halve damage until your next turn.' },
};

export const ENEMIES = {
  calamari: {
    name: 'Bowl of Calamari', hp: 46, atk: 9, weak: ['phys'], resist: ['fire'],
    moves: [
      { name: 'Ink Jet', power: 3, target: 'one', fx: 'ink' },
      { name: 'Tentacle Slap', power: 1, target: 'one', fx: 'slap' },
    ],
  },
  gnome: {
    name: 'Naked Gnome', hp: 38, atk: 9, weak: ['fire'], resist: [],
    moves: [
      { name: 'Lantern Bonk', power: 4, target: 'one', fx: 'slap' },
      { name: 'Indecent Display', power: 0, target: 'none', fx: 'none', line: 'The gnome does something unspeakable. Nobody is hurt, technically.' },
      { name: 'Lantern Bonk', power: 4, target: 'one', fx: 'slap' },
    ],
  },
  mime: {
    name: 'The Mime', hp: 170, atk: 11, weak: ['elec'], resist: ['phys'], boss: true, turns: 2,
    moves: [
      { name: 'Invisible Rope', power: 6, target: 'one', fx: 'slap', line: 'The Mime hauls on a rope that isn\'t there.' },
      { name: 'Silent Applause', power: -3, target: 'all', fx: 'clap', line: 'The Mime applauds. There is no sound. It hurts anyway.' },
      { name: 'The Box', power: 9, target: 'one', fx: 'slap', line: 'The Mime builds a box around someone, wall by wall.' },
    ],
  },
};

export const ENCOUNTERS = {
  graceSteps: 6,
  chance: 0.09,
  pool: [['calamari'], ['gnome'], ['calamari', 'gnome'], ['gnome', 'gnome']],
  scripted: [
    { x: 8, y: 7, group: ['calamari'], toast: 'SOMETHING IS IN THE HALL' },
    { x: 13, y: 4, group: ['gnome'], toast: '' },
  ],
};

export const NOTES = {
  lockers: {
    style: 'object',
    text: 'Two shoe lockers, side by side. The same surname on both name cards.\n\nOne has a black ribbon tied through the handle.\n\nThe other one is yours. Your outdoor shoes are in it. You don\'t remember changing out of them.',
  },
  ranking: {
    style: 'paper', title: 'MOCK EXAM RANKING, 2ND YEAR, JUNE',
    text: '  1   ███████ NAOMI      491\n  2   ...\n  ...\n212   ███████ TOUMA      298\n\nSomeone has circled the first name in red pen.\nNobody has touched the second.',
  },
  phone: {
    style: 'phone',
    html: '<div class="meta">CLASS 2-B &middot; MAY 14</div><div class="bubble">does anyone know if the computer room is open tmrw? i can fix the projector for the festival</div><div class="meta">Read by 31</div><br><div class="meta">MAY 14 &middot; 23:02</div><div class="bubble">[sticker]</div><div class="meta">GABRIELLE</div><br><div class="meta">ANNA &rarr; GABRIELLE (private) &middot; 23:13</div><div class="bubble">should someone answer her</div><div class="meta">Read</div>',
  },
  nurse: {
    style: 'ledger', title: "NURSE'S OFFICE LOG",
    text: '04/22  ANNA     stomach pain     rest. nothing found\n05/09  ANNA     stomach pain     rest. nothing found\n05/30  NAOMI    "fell"           ice, plaster\n06/02  ANNA     stomach pain     rest. nothing found\n06/05  NAOMI    "fell"           ice\n\n(no entries after 06/05 for that name)',
  },
  vase: {
    style: 'object',
    text: 'White chrysanthemums in a vase on a desk at the back.\n\nThe water is fresh. It is September.\n\nNobody in the class will say who changes it.',
  },
  page: {
    style: 'notebook', title: 'A NOTEBOOK PAGE, TAPED TO THE SHUTTER',
    text: 'Does watching count?\n\nIt has to. If nobody watches, it\'s nothing.\nThey know that. That\'s why they keep her.\n\n(It is your handwriting. You don\'t remember writing it.)',
  },
};

export const DOS = [
  { out: 'C:\\NAOMI\\SUMMON>', type: 'run summon.exe' },
  { out: '\nPREVIOUS SESSIONS: 41.  ABORTED AT: WHO.\n' },
  { out: '\nSTATE YOUR NAME.   >', type: 'naomi' },
  { out: '\nWHO.               >', type: 'yuki  gabrielle  jason  anna' },
  { out: '\nDID ANYONE STOP IT.>', type: 'they watched.' },
  { out: '\n\nIS THAT YOUR NAME. [Y/N] ', key: 'y' },
  { out: '\nEND IT ALL?        [Y/N] ', key: 'y' },
];
