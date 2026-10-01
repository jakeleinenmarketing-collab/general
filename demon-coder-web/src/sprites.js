// Hand-authored 2D illustrations: flat cel shading with ink lines, drawn as SVG in code and rasterized at load.
// This is the Soul Hackers / Strange Journey approach: drawn art standing in a 3D corridor.
import * as THREE from 'three';

const INK = '#110a0e';

// Rasterize an SVG string into a canvas. The canvas is returned immediately and filled when the image decodes.
export function rasterize(svg, w, h, onReady) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const img = new Image();
  img.onload = () => { c.getContext('2d').drawImage(img, 0, 0, w, h); onReady?.(c); };
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  return c;
}

// ---------------------------------------------------------------- Naomi (Touma), bust portrait
// 400 x 400, three-quarter view facing slightly left.
function naomiSVG(expr = 'neutral') {
  const C = { skin: '#e8cbb9', skinS: '#b48a86', hair: '#16131d', hairS: '#08070b', hairH: '#4d5b7c', coat: '#b48d2c', coatS: '#77591a', coatD: '#3e2c0c', shirt: '#1a1e2a', white: '#f0ebe2', iris: '#2b1a24', lip: '#8e5050' };
  const eyesOpen = `
    <clipPath id="eL"><path d="M158 168 C166 160 186 158 197 164 C192 176 176 182 162 178 Z"/></clipPath>
    <clipPath id="eR"><path d="M216 165 C224 159 236 158 243 163 C240 173 228 178 219 175 Z"/></clipPath>
    <path d="M158 168 C166 160 186 158 197 164 C192 176 176 182 162 178 Z" fill="${C.white}"/>
    <g clip-path="url(#eL)"><ellipse cx="180" cy="171" rx="8.5" ry="10.5" fill="${C.iris}"/><ellipse cx="180" cy="176" rx="6" ry="5" fill="#4a2c3c"/><path d="M158 158 L200 158 L200 168 C186 163 170 164 158 170 Z" fill="${C.skinS}" opacity=".45"/></g>
    <ellipse cx="183.5" cy="165.5" rx="2.6" ry="3.2" fill="#fff"/>
    <path d="M216 165 C224 159 236 158 243 163 C240 173 228 178 219 175 Z" fill="${C.white}"/>
    <g clip-path="url(#eR)"><ellipse cx="231" cy="168" rx="6.8" ry="9.8" fill="${C.iris}"/><ellipse cx="231" cy="173" rx="4.8" ry="4.6" fill="#4a2c3c"/></g>
    <ellipse cx="233.5" cy="163.5" rx="2" ry="2.6" fill="#fff"/>
    <path d="M155 167 C161 155 183 150 199 160 L198 165 C184 157 166 158 158 171 Z" fill="${INK}"/>
    <path d="M213 163 C221 153 237 152 246 160 L244 164 C236 158 224 158 216 167 Z" fill="${INK}"/>
    <path d="M164 179 C174 183 186 181 194 175" stroke="${INK}" stroke-width="1.4" fill="none"/>
    <path d="M220 176 C228 179 236 177 241 172" stroke="${INK}" stroke-width="1.2" fill="none"/>`;
  const eyesNarrow = `
    <path d="M158 170 C168 164 186 163 197 166 C190 174 174 177 162 176 Z" fill="${C.white}"/>
    <ellipse cx="180" cy="170" rx="7.5" ry="5.2" fill="${C.iris}"/><circle cx="182.5" cy="168.5" r="1.8" fill="#fff"/>
    <path d="M216 167 C224 163 236 162 243 165 C238 172 228 174 219 173 Z" fill="${C.white}"/>
    <ellipse cx="231" cy="168.5" rx="6" ry="4.6" fill="${C.iris}"/>
    <path d="M154 170 C162 160 184 158 200 164 L198 168 C184 163 166 164 157 173 Z" fill="${INK}"/>
    <path d="M212 166 C221 158 237 158 246 163 L244 167 C236 162 224 163 215 169 Z" fill="${INK}"/>
    <path d="M165 177 C175 179 186 178 194 174" stroke="${INK}" stroke-width="1.3" fill="none"/>`;
  const eyesClosed = `
    <path d="M157 170 C168 176 184 177 197 168" stroke="${INK}" stroke-width="3" fill="none" stroke-linecap="round"/>
    <path d="M215 168 C224 173 235 173 244 166" stroke="${INK}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`;
  const eyesHurt = `
    <path d="M158 162 L178 170 L158 177" stroke="${INK}" stroke-width="3.2" fill="none" stroke-linejoin="round"/>
    <path d="M196 161 L180 170 L195 177" stroke="${INK}" stroke-width="2" fill="none" opacity=".0"/>
    <path d="M244 160 L224 168 L243 175" stroke="${INK}" stroke-width="2.8" fill="none" stroke-linejoin="round"/>`;
  const eyes = { neutral: eyesOpen, blink: eyesClosed, hurt: eyesHurt, attack: eyesNarrow, low: eyesNarrow }[expr];
  const brows = {
    neutral: `<path d="M158 146 C168 141 182 140 194 144" /><path d="M214 141 C224 137 236 138 244 143" />`,
    blink: `<path d="M158 146 C168 141 182 140 194 144" /><path d="M214 141 C224 137 236 138 244 143" />`,
    hurt: `<path d="M158 150 C168 147 182 141 194 136" /><path d="M214 134 C224 139 236 142 244 147" />`,
    attack: `<path d="M160 142 C170 145 184 150 196 154" /><path d="M212 152 C222 147 234 143 244 141" />`,
    low: `<path d="M158 148 C168 145 182 142 194 140" /><path d="M214 138 C224 140 236 143 244 147" />`,
  }[expr];
  const mouth = {
    neutral: `<path d="M192 222 C199 224 207 223 213 220" stroke="${INK}" stroke-width="2" fill="none"/><path d="M199 228 L207 228" stroke="${C.lip}" stroke-width="1.4"/>`,
    blink: `<path d="M192 222 C199 224 207 223 213 220" stroke="${INK}" stroke-width="2" fill="none"/>`,
    hurt: `<path d="M189 220 C197 214 208 214 216 219 C212 232 196 234 189 220 Z" fill="#3a0a10" stroke="${INK}" stroke-width="2"/><path d="M193 220 L212 219" stroke="#e8e0d8" stroke-width="2.4"/>`,
    attack: `<path d="M191 223 L214 219" stroke="${INK}" stroke-width="2.4" fill="none"/>`,
    low: `<path d="M193 225 C199 222 207 222 212 224" stroke="${INK}" stroke-width="2" fill="none"/>`,
  }[expr];
  const sweat = expr === 'low' || expr === 'hurt' ? `<path d="M250 150 C246 162 246 170 251 172 C256 170 256 162 250 150 Z" fill="#cfe4ee" stroke="${INK}" stroke-width="1.2"/>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">
  <g stroke="${INK}" stroke-width="2.6" stroke-linejoin="round">
    <path d="M138 90 C120 150 100 230 90 300 C84 345 70 375 58 400 L342 400 C328 370 314 340 308 300 C300 230 286 150 266 96 Z" fill="${C.hair}"/>
    <path d="M40 400 C50 350 70 322 110 306 C140 296 160 286 172 272 L228 268 C240 282 262 292 295 302 C335 315 352 350 362 400 Z" fill="${C.coat}"/>
    <path d="M228 268 C240 282 262 292 295 302 C335 315 352 350 362 400 L300 400 C290 360 268 330 238 314 Z" fill="${C.coatS}" stroke="none"/>
    <path d="M70 400 C80 370 95 345 120 330" fill="none" stroke="${C.coatS}" stroke-width="5"/>
    <path d="M148 276 C160 256 240 253 254 273 L228 268 L172 272 Z" fill="${C.coatS}"/>
    <path d="M185 288 L200 300 L215 288 L200 335 Z" fill="${C.shirt}"/>
    <path d="M172 272 L148 302 L184 348 L200 300 Z" fill="${C.coat}"/>
    <path d="M228 268 L252 298 L214 348 L200 300 Z" fill="${C.coatS}"/>
    <path d="M160 302 L184 342" stroke="${C.coatD}" stroke-width="2" fill="none"/>
    <circle cx="204" cy="372" r="5" fill="${C.coatD}"/>
    <path d="M178 228 L218 222 L222 282 C210 290 190 290 176 283 Z" fill="${C.skin}"/>
    <path d="M178 230 L218 224 L220 252 C205 262 190 258 178 246 Z" fill="${C.skinS}" stroke="none"/>
    <path d="M152 108 C146 130 146 160 152 185 C158 210 172 232 194 248 C200 252 206 250 212 244 C232 225 246 200 250 170 C253 140 250 115 244 100 Z" fill="${C.skin}"/>
    <path d="M234 118 C247 140 251 170 246 195 C240 220 226 238 212 244 C223 224 233 200 235 175 Z" fill="${C.skinS}" stroke="none"/>
    <path d="M150 112 C180 132 225 130 247 112 L249 128 C226 144 180 146 151 130 Z" fill="${C.skinS}" stroke="none"/>
  </g>
  ${eyes}
  <g stroke="${INK}" stroke-width="2.6" fill="none" stroke-linecap="round">${brows}</g>
  <path d="M207 182 L213 201 L205 204" stroke="${INK}" stroke-width="1.7" fill="none" stroke-linejoin="round"/>
  <path d="M207 185 L213 200 L209 201 Z" fill="${C.skinS}"/>
  ${mouth}
  <g stroke="${INK}" stroke-width="2.6" stroke-linejoin="round">
    <path d="M138 92 C126 46 172 26 205 28 C246 30 278 56 267 104 C258 82 234 70 205 70 C176 70 152 78 138 92 Z" fill="${C.hair}"/>
    <path d="M140 74 C168 52 240 50 264 80 L258 112 L247 146 L240 110 L229 136 L222 106 L207 144 L200 104 L186 140 L180 106 L167 136 L162 108 L150 146 L146 112 C140 100 138 86 140 74 Z" fill="${C.hair}"/>
    <path d="M146 108 C132 150 128 205 138 266 L153 250 C146 210 149 170 158 128 Z" fill="${C.hair}"/>
    <path d="M257 104 C270 150 268 212 257 262 L245 246 C252 205 252 165 244 125 Z" fill="${C.hairS}"/>
  </g>
  <path d="M166 66 C178 58 194 55 206 56 L203 61 C192 61 180 64 170 71 Z" fill="${C.hairH}"/>
  <path d="M216 57 C230 58 242 63 250 72 L245 74 C237 67 227 63 215 62 Z" fill="${C.hairH}"/>
  <path d="M150 150 C146 175 145 200 147 225" stroke="${C.hairH}" stroke-width="2" fill="none" opacity=".6"/>
  <path d="M146 150 C141 180 141 215 146 245" stroke="${C.hairH}" stroke-width="2" fill="none" opacity=".7"/>
  ${sweat}
</svg>`;
}

// ---------------------------------------------------------------- The Mime, full body
// 300 x 600. Palms flat on glass that isn't there; the head leans too far.
function mimeSVG(pose = 'idle') {
  const C = { black: '#0f0e14', blackS: '#000', blackH: '#2c2a3a', white: '#ebe6dc', whiteS: '#a9a5b8', glove: '#f2eee6', gloveS: '#a8a4b4', red: '#a3121b', stripe: '#1a1822', paper: '#e6e0d4' };
  const tilt = pose === 'hurt' ? 26 : pose === 'attack' ? -6 : 14;
  const eyes = pose === 'hurt'
    ? `<path d="M138 128 L150 140 M150 128 L138 140" stroke="${INK}" stroke-width="3"/><path d="M162 128 L174 140 M174 128 L162 140" stroke="${INK}" stroke-width="3"/>`
    : `<path d="M144 116 L151 134 L144 152 L137 134 Z" fill="${INK}"/><path d="M168 116 L175 134 L168 152 L161 134 Z" fill="${INK}"/>
       <path d="M144 152 L145 170" stroke="${INK}" stroke-width="2"/><path d="M168 152 L167 168" stroke="${INK}" stroke-width="2"/>
       ${pose === 'attack' ? `<circle cx="144" cy="132" r="2.2" fill="#ff3a3a"/><circle cx="168" cy="132" r="2.2" fill="#ff3a3a"/>` : ''}`;
  const mouth = pose === 'attack'
    ? `<path d="M128 170 C140 192 172 192 186 168 C172 178 142 180 128 170 Z" fill="#200008" stroke="${INK}" stroke-width="2"/><path d="M134 174 L180 172" stroke="#e8e2d6" stroke-width="3" stroke-dasharray="4 3"/>`
    : pose === 'hurt'
      ? `<ellipse cx="156" cy="176" rx="8" ry="10" fill="#200008" stroke="${INK}" stroke-width="2"/>`
      : `<path d="M146 175 C152 171 160 171 166 175 C160 180 152 180 146 175 Z" fill="${C.red}" stroke="${INK}" stroke-width="1.6"/>`;
  const reach = pose === 'attack' ? 1.18 : 1;
  const hand = (x, y, flip, s = 1) => `
    <g transform="translate(${x} ${y}) scale(${flip * s} ${s})">
      <path d="M-22 18 C-24 0 -20 -14 -16 -20 L-14 -52 C-14 -58 -6 -58 -6 -52 L-5 -26 L-4 -60 C-4 -66 4 -66 4 -60 L5 -26 L7 -56 C7 -62 15 -62 15 -56 L13 -24 L17 -46 C18 -52 25 -51 24 -45 L20 -10 C26 -16 32 -18 34 -12 C30 0 22 14 16 22 C6 30 -14 30 -22 18 Z" fill="${C.glove}"/>
      <path d="M8 -10 C14 0 14 14 16 22 C6 30 -14 30 -22 18 C-10 22 0 16 8 -10 Z" fill="${C.gloveS}" stroke="none"/>
      <path d="M-20 22 L18 26 L16 36 L-20 34 Z" fill="${C.glove}"/>
    </g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 600">
  <defs><pattern id="st" width="20" height="18" patternUnits="userSpaceOnUse"><rect width="20" height="9" fill="${C.paper}"/><rect y="9" width="20" height="9" fill="${C.stripe}"/></pattern></defs>
  <g stroke="${INK}" stroke-width="3" stroke-linejoin="round">
    <path d="M126 330 L108 572 L96 586 C110 592 134 590 140 582 L146 340 Z" fill="${C.black}"/>
    <path d="M164 340 L172 582 C178 590 204 592 214 586 L196 572 L184 330 Z" fill="${C.black}"/>
    <path d="M176 344 L186 570 L196 572 L184 332 Z" fill="${C.blackH}" stroke="none"/>
    <path d="M118 212 L70 236 C60 240 56 230 60 222 L66 ${226 - 30 * reach}" fill="none" stroke="${C.black}" stroke-width="20" stroke-linecap="round"/>
    <path d="M190 212 L238 236 C248 240 252 230 248 222 L242 ${226 - 30 * reach}" fill="none" stroke="${C.black}" stroke-width="20" stroke-linecap="round"/>
    <path d="M114 206 C108 262 112 302 120 342 L184 342 C192 302 196 262 190 206 C170 194 134 194 114 206 Z" fill="url(#st)"/>
    <path d="M168 200 C186 204 194 260 186 342 L184 342 C190 300 192 260 176 204 Z" fill="${C.blackS}" opacity=".45" stroke="none"/>
    <path d="M136 200 L130 342 M168 200 L174 342" stroke="${C.red}" stroke-width="7"/>
    <path d="M118 202 C130 190 176 188 188 202 C176 212 130 214 118 202 Z" fill="${C.white}"/>
    ${hand(64, 176 - 26 * reach, -1, reach)}
    ${hand(244, 176 - 26 * reach, 1, reach)}
  </g>
  <g transform="rotate(${tilt} 154 196) translate(156 198) scale(1.32) translate(-156 -198)" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round">
    <path d="M154 72 C126 72 118 104 120 140 C122 176 138 198 156 198 C174 198 188 176 190 140 C192 104 182 72 154 72 Z" fill="${C.white}"/>
    <path d="M176 84 C190 104 192 150 182 178 C176 190 166 196 156 198 C172 180 180 150 176 84 Z" fill="${C.whiteS}" stroke="none"/>
    <path d="M114 86 C116 62 160 50 196 64 C204 72 196 84 186 82 C160 74 132 78 114 86 Z" fill="${C.black}"/>
    <path d="M190 66 L198 58" stroke="${INK}" stroke-width="3"/>
    ${eyes}
    ${mouth}
    <path d="M172 96 L166 108 L170 118" stroke="#7a7688" stroke-width="1.2" fill="none"/>
  </g>
</svg>`;
}

// ---------------------------------------------------------------- loaders
export function loadPortrait(id) {
  if (id !== 'touma') return null;
  const frames = {};
  for (const e of ['neutral', 'blink', 'hurt', 'attack', 'low']) frames[e] = rasterize(naomiSVG(e), 400, 400);
  return frames;
}

export function loadSpriteFrames(id) {
  if (id !== 'mime') return null;
  const frames = {};
  for (const p of ['idle', 'attack', 'hurt']) {
    const tex = new THREE.CanvasTexture(document.createElement('canvas'));
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.image = rasterize(mimeSVG(p), 300, 600, () => (tex.needsUpdate = true));
    frames[p] = tex;
  }
  return { frames, aspect: 300 / 600 };
}

export const SVG = { naomi: naomiSVG, mime: mimeSVG };
