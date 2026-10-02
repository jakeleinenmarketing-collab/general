shader_type canvas_item;

// Ghurub's screen: cyan backlight, scanlines, slow flicker.
uniform float flicker = 1.0;

void fragment() {
	vec4 c = texture(TEXTURE, UV) * COLOR;
	float scan = 0.82 + 0.18 * step(0.5, fract(FRAGCOORD.y * 0.5));
	float f = 1.0 - flicker * 0.04 * (sin(TIME * 23.0) * 0.5 + 0.5) * step(0.93, fract(TIME * 0.37));
	COLOR = vec4(c.rgb * scan * f, c.a);
}
