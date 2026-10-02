shader_type sky;

global uniform vec4 g_fog_color;

uniform vec4 top_color : source_color = vec4(0.36, 0.42, 0.55, 1.0);
uniform vec4 mid_color : source_color = vec4(0.86, 0.62, 0.42, 1.0);
uniform vec4 ground_color : source_color = vec4(0.72, 0.52, 0.28, 1.0);
uniform vec4 sun_color : source_color = vec4(1.0, 0.86, 0.55, 1.0);
uniform float sun_size = 0.9985;
uniform float darken = 0.0;

float h21(vec2 p) {
	return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

void sky() {
	float y = EYEDIR.y;
	vec3 c = mix(g_fog_color.rgb, mid_color.rgb, smoothstep(0.0, 0.12, y));
	c = mix(c, top_color.rgb, smoothstep(0.12, 0.75, y));
	c = mix(c, ground_color.rgb, smoothstep(0.0, -0.08, y));
	// dust bands near the horizon
	float band = sin(y * 220.0 + sin(atan(EYEDIR.x, EYEDIR.z) * 3.0) * 4.0) * 0.5 + 0.5;
	c += vec3(0.04, 0.025, 0.0) * band * (1.0 - smoothstep(0.0, 0.2, abs(y)));
	float sd = dot(EYEDIR, LIGHT0_DIRECTION);
	float disk = smoothstep(sun_size, sun_size + 0.0006, sd);
	float glow = pow(max(sd, 0.0), 24.0) * 0.55 + pow(max(sd, 0.0), 4.0) * 0.18;
	c += sun_color.rgb * (disk * 1.6 + glow);
	c *= 1.0 - darken;
	COLOR = c;
}
