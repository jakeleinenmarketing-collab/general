shader_type spatial;
render_mode unshaded, cull_front, depth_draw_opaque;

#include "res://shaders/common.gdshaderinc"

uniform float thickness = 0.02;
uniform vec4 line_color : source_color = vec4(0.13, 0.07, 0.05, 1.0);
uniform float dissolve = 0.0;
uniform float wave = 0.0;

varying vec3 obj_pos;

void vertex() {
	obj_pos = VERTEX;
	if (wave > 0.0) {
		float k = clamp(VERTEX.x + 0.5, 0.0, 1.0);
		VERTEX.z += sin(TIME * 5.0 + VERTEX.x * 5.0 + VERTEX.y * 2.0) * wave * k;
	}
	VERTEX += NORMAL * thickness * (1.0 - g_ink * 0.45);
}

void fragment() {
	if (dissolve > 0.001) {
		float n = vnoise(obj_pos * 7.0) * 0.8 + vnoise(obj_pos * 19.0) * 0.2;
		if (n < dissolve) {
			discard;
		}
	}
	float f = fog_amount(VERTEX);
	vec3 lc = mix(line_color.rgb, vec3(0.12, 0.1, 0.08), g_ink);
	ALBEDO = mix(lc, g_fog_color.rgb, f);
}
