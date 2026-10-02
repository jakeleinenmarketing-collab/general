shader_type canvas_item;

// Final pass over the low-res 3D frame: heat haze, wake-up blur, color grade,
// ordered dither to a late-90s palette depth, vignette, grain, flashes and fades.
uniform vec2 res = vec2(640.0, 360.0);
uniform float haze = 0.6;
uniform float blur = 0.0;
uniform float vignette = 0.55;
uniform float grain = 0.045;
uniform float fade = 0.0;
uniform vec4 flash_color : source_color = vec4(1.0, 1.0, 1.0, 1.0);
uniform float flash = 0.0;
uniform float warp = 0.0;
uniform float battle = 0.0;
uniform float levels = 28.0;
// 1.0 = the SMT II cover look: bleached, misty duotone with hard blacks and halation.
uniform float sm2 = 0.0;
// 1.0 = illustration look: cream paper, ink edges, soft airbrush tones, light colour accents.
uniform float ink = 0.0;
uniform vec4 sm2_dark : source_color = vec4(0.07, 0.07, 0.05, 1.0);
uniform vec4 sm2_mid : source_color = vec4(0.55, 0.54, 0.34, 1.0);
uniform vec4 sm2_light : source_color = vec4(0.97, 0.96, 0.86, 1.0);

float bayer4(vec2 p) {
	int x = int(mod(p.x, 4.0));
	int y = int(mod(p.y, 4.0));
	int i = x + y * 4;
	float m[16] = float[](0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0, 3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0);
	return m[i] / 16.0 - 0.5;
}

float rnd(vec2 p) {
	return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

void fragment() {
	vec2 uv = UV;
	// swirl into battle
	if (warp > 0.0) {
		vec2 d = uv - 0.5;
		float r = length(d);
		float a = warp * 6.0 * (1.0 - smoothstep(0.0, 0.7, r));
		float s = sin(a);
		float c = cos(a);
		uv = 0.5 + mat2(vec2(c, -s), vec2(s, c)) * d * (1.0 - warp * 0.3);
	}
	// heat haze shimmer, strongest around the horizon band
	float band = smoothstep(0.25, 0.48, uv.y) * (1.0 - smoothstep(0.55, 0.75, uv.y));
	uv.x += sin(uv.y * 140.0 + TIME * 3.2) * 0.0011 * haze * band;
	vec3 col = texture(TEXTURE, uv).rgb;
	if (blur > 0.001) {
		vec3 acc = col;
		float rad = blur * 0.012;
		for (int i = 0; i < 8; i++) {
			float a = float(i) * 0.785398;
			acc += texture(TEXTURE, uv + vec2(cos(a), sin(a)) * rad).rgb;
			acc += texture(TEXTURE, uv + vec2(cos(a), sin(a)) * rad * 2.2).rgb;
		}
		col = acc / 17.0;
		col = mix(col, col * vec3(1.05, 0.95, 0.9), blur);
	}
	// grade: warm lifted shadows, gentle contrast, a little red push in battle
	col = col * 1.04 - 0.015;
	col = mix(vec3(dot(col, vec3(0.299, 0.587, 0.114))), col, 0.96);
	col += vec3(0.02, 0.01, 0.0) * (1.0 - col);
	col = mix(col, col * vec3(1.12, 0.86, 0.84), battle * 0.6);
	// ordered dither down to a limited palette depth
	vec2 px = floor(UV * res);
	col += bayer4(px) / levels;
	col = floor(col * levels + 0.5) / levels;
	// vignette and grain
	vec2 v = UV - 0.5;
	if (ink > 0.0) {
		vec2 px1 = 1.0 / res;
		float lc = dot(col, vec3(0.299, 0.587, 0.114));
		// ink: luminance edges
		float lx = dot(texture(TEXTURE, uv + vec2(px1.x, 0.0)).rgb - texture(TEXTURE, uv - vec2(px1.x, 0.0)).rgb, vec3(0.333));
		float ly = dot(texture(TEXTURE, uv + vec2(0.0, px1.y)).rgb - texture(TEXTURE, uv - vec2(0.0, px1.y)).rgb, vec3(0.333));
		float edge = smoothstep(0.08, 0.22, length(vec2(lx, ly)));
		// tone: map to paper, keep a little of the original colour for gold and blood
		float t = smoothstep(0.02, 0.95, lc);
		vec3 paper = vec3(0.95, 0.93, 0.86);
		vec3 mid = vec3(0.74, 0.71, 0.6);
		vec3 dark = vec3(0.3, 0.28, 0.23);
		vec3 tone = t < 0.5 ? mix(dark, mid, t * 2.0) : mix(mid, paper, (t - 0.5) * 2.0);
		vec3 chroma = col - vec3(lc);
		float sat = length(chroma);
		// keep strong accents (gold, blood, banners); wash out the broad yellows
		tone += chroma * mix(0.12, 0.6, smoothstep(0.18, 0.32, sat));
		// paper fibre and grain
		float fib = rnd(floor(UV * res * vec2(0.25, 1.0))) * 0.035 + rnd(floor(UV * res)) * 0.03;
		tone -= fib * 0.6;
		tone = mix(tone, vec3(0.13, 0.11, 0.09), edge * 0.75);
		// pale mist at the edges of the page
		tone = mix(tone, paper, smoothstep(0.18, 0.55, dot(v, v)) * 0.35);
		col = mix(col, tone, ink);
	} else if (sm2 > 0.0) {
		// halation: bright areas bleed outward
		vec3 glow = vec3(0.0);
		for (int i = 0; i < 12; i++) {
			float a = float(i) * 0.5236;
			glow += max(texture(TEXTURE, uv + vec2(cos(a), sin(a) * 1.7) * 0.012).rgb - 0.5, 0.0);
		}
		glow /= 12.0;
		float l = dot(col, vec3(0.299, 0.587, 0.114));
		l = smoothstep(0.04, 0.92, l);
		vec3 duo = l < 0.5 ? mix(sm2_dark.rgb, sm2_mid.rgb, l * 2.0) : mix(sm2_mid.rgb, sm2_light.rgb, (l - 0.5) * 2.0);
		duo = mix(duo, col, 0.1);
		duo += glow * vec3(1.0, 1.0, 0.85) * 0.45;
		// mist creeping in from the edges instead of darkness
		duo = mix(duo, sm2_light.rgb * 0.9, smoothstep(0.16, 0.5, dot(v, v)) * 0.3);
		col = mix(col, duo, sm2);
	} else {
		col *= 1.0 - dot(v, v) * vignette * (1.0 + battle * 0.8);
	}
	col += (rnd(px + fract(TIME) * 91.0) - 0.5) * grain;
	col = mix(col, flash_color.rgb, flash);
	col *= 1.0 - fade;
	COLOR = vec4(col, 1.0);
}
