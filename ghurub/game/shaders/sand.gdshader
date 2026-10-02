shader_type spatial;
render_mode cull_back;

#include "res://shaders/common.gdshaderinc"

uniform vec4 sand_color : source_color = vec4(0.8, 0.62, 0.33, 1.0);
uniform vec4 sand_dark : source_color = vec4(0.7, 0.52, 0.28, 1.0);
uniform vec4 sand_light : source_color = vec4(0.9, 0.76, 0.48, 1.0);
uniform float ripple_scale = 2.2;

varying vec3 wpos;

// Softer than the toon light: a low sun should rake across the dunes, not flood them.
void light() {
	float ndl = clamp(dot(NORMAL, LIGHT), 0.0, 1.0);
	float shadow = smoothstep(0.3, 0.7, ATTENUATION);
	float lit = mix(0.3, 1.0, smoothstep(0.0, 0.9, ndl)) * mix(0.42, 1.0, shadow);
	DIFFUSE_LIGHT += LIGHT_COLOR * lit * 0.88;
}

void vertex() {
	wpos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
}

void fragment() {
	vec2 p = wpos.xz;
	float big = vnoise(vec3(p * 0.025, 0.0));
	float mid = vnoise(vec3(p * 0.12, 3.0));
	vec2 dir = normalize(vec2(0.8, 0.6));
	float r = sin(dot(p, dir) * ripple_scale + mid * 6.0 + big * 4.0);
	float ripple = smoothstep(0.55, 0.9, r);
	vec3 col = mix(sand_dark.rgb, sand_color.rgb, smoothstep(0.25, 0.75, big));
	float r2 = sin(dot(p, vec2(-0.5, 0.86)) * ripple_scale * 1.7 + mid * 9.0);
	float fade_near = smoothstep(2.0, 18.0, length(VERTEX));
	col = mix(col, sand_light.rgb, ripple * (0.08 + 0.14 * fade_near));
	col = mix(col, col * 0.9, smoothstep(0.6, 1.0, r2) * 0.25 * (1.0 - big));
	col *= 0.94 + 0.06 * vnoise(vec3(p * 3.0, 7.0));
	float f = fog_amount(VERTEX);
	ALBEDO = col * (1.0 - f);
	ROUGHNESS = 1.0;
	EMISSION = g_fog_color.rgb * f;
}
