// Shared by every 3D material so demons, bodies, ruins and sand all share one look:
// hard cel bands, a warm rim, and a distance haze that melts into the sky.
global uniform vec4 g_fog_color;
global uniform float g_fog_near;
global uniform float g_fog_far;
global uniform float g_fog_max;
global uniform float g_ink;

uniform float rim_amount = 0.35;
uniform float spec_amount = 0.0;

float fog_amount(vec3 view_vertex) {
	return smoothstep(g_fog_near, g_fog_far, length(view_vertex)) * g_fog_max;
}

float hash3(vec3 p) {
	return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
}

float vnoise(vec3 p) {
	vec3 i = floor(p);
	vec3 f = fract(p);
	f = f * f * (3.0 - 2.0 * f);
	float n000 = hash3(i);
	float n100 = hash3(i + vec3(1, 0, 0));
	float n010 = hash3(i + vec3(0, 1, 0));
	float n110 = hash3(i + vec3(1, 1, 0));
	float n001 = hash3(i + vec3(0, 0, 1));
	float n101 = hash3(i + vec3(1, 0, 1));
	float n011 = hash3(i + vec3(0, 1, 1));
	float n111 = hash3(i + vec3(1, 1, 1));
	return mix(mix(mix(n000, n100, f.x), mix(n010, n110, f.x), f.y),
			mix(mix(n001, n101, f.x), mix(n011, n111, f.x), f.y), f.z);
}

