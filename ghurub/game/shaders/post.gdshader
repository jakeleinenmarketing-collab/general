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
	col *= 1.0 - dot(v, v) * vignette * (1.0 + battle * 0.8);
	col += (rnd(px + fract(TIME) * 91.0) - 0.5) * grain;
	col = mix(col, flash_color.rgb, flash);
	col *= 1.0 - fade;
	COLOR = vec4(col, 1.0);
}
