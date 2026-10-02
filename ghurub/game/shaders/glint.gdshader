shader_type spatial;
render_mode unshaded, blend_add, depth_draw_never, cull_disabled, shadows_disabled;

// A four-point star that always faces the camera. Used for the device's glint,
// muzzle flashes and spell bursts.
uniform vec4 color : source_color = vec4(1.0, 1.0, 1.0, 1.0);
uniform float intensity = 1.0;
uniform float spin = 0.0;

void vertex() {
	MODELVIEW_MATRIX = VIEW_MATRIX * mat4(INV_VIEW_MATRIX[0], INV_VIEW_MATRIX[1], INV_VIEW_MATRIX[2], MODEL_MATRIX[3]);
}

void fragment() {
	vec2 p = UV - 0.5;
	float a = spin;
	p = mat2(vec2(cos(a), -sin(a)), vec2(sin(a), cos(a))) * p;
	float s = max(0.0, 1.0 - abs(p.x) * 30.0) * max(0.0, 1.0 - abs(p.y) * 2.0);
	s += max(0.0, 1.0 - abs(p.y) * 30.0) * max(0.0, 1.0 - abs(p.x) * 2.0);
	s += smoothstep(0.22, 0.0, length(p)) * 0.8;
	ALBEDO = color.rgb * s * intensity;
	ALPHA = clamp(s * intensity, 0.0, 1.0);
}
