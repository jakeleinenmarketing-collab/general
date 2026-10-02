#include "res://shaders/common.gdshaderinc"
#include "res://shaders/toon_light.gdshaderinc"

uniform vec4 albedo : source_color = vec4(1.0);
uniform vec4 emission_color : source_color = vec4(0.0, 0.0, 0.0, 1.0);
uniform float emission_energy = 0.0;
uniform float dissolve = 0.0;
uniform vec4 dissolve_color : source_color = vec4(1.0, 0.55, 0.15, 1.0);
uniform float flash = 0.0;
uniform float wave = 0.0;
uniform float fog_mult = 1.0;
uniform bool use_vertex_color = false;

varying vec3 obj_pos;

void vertex() {
	obj_pos = VERTEX;
	if (wave > 0.0) {
		float k = clamp(VERTEX.x + 0.5, 0.0, 1.0);
		VERTEX.z += sin(TIME * 5.0 + VERTEX.x * 5.0 + VERTEX.y * 2.0) * wave * k;
	}
}

void fragment() {
	vec3 edge = vec3(0.0);
	if (dissolve > 0.001) {
		float n = vnoise(obj_pos * 7.0) * 0.8 + vnoise(obj_pos * 19.0) * 0.2;
		if (n < dissolve) {
			discard;
		}
		edge = dissolve_color.rgb * 4.0 * (1.0 - smoothstep(0.0, 0.07, n - dissolve));
	}
	float f = fog_amount(VERTEX) * fog_mult;
	vec3 base = use_vertex_color ? albedo.rgb * COLOR.rgb : albedo.rgb;
	vec3 col = mix(base, vec3(1.0), flash);
	ALBEDO = col * (1.0 - f);
	ROUGHNESS = 1.0;
	EMISSION = (emission_color.rgb * emission_energy + edge + vec3(flash * 0.5)) * (1.0 - f) + g_fog_color.rgb * f;
}
