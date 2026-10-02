// Hard cel bands, a warm rim and a small hard highlight.
void light() {
	float ndl = dot(NORMAL, LIGHT);
	float shadow = smoothstep(0.3, 0.7, ATTENUATION);
	// ink mode: soft airbrushed falloff instead of hard cel bands
	float lit = mix(smoothstep(0.0, 0.08, ndl), smoothstep(-0.35, 0.7, ndl), g_ink) * shadow;
	float mid = smoothstep(-0.45, -0.3, ndl) * 0.22 * (1.0 - lit);
	DIFFUSE_LIGHT += LIGHT_COLOR * (lit + mid);
	float rim = 1.0 - clamp(dot(NORMAL, VIEW), 0.0, 1.0);
	rim = smoothstep(0.6, 0.68, rim) * smoothstep(-0.3, 0.2, ndl);
	DIFFUSE_LIGHT += LIGHT_COLOR * rim * rim_amount * (1.0 - g_ink * 0.8);
	vec3 h = normalize(LIGHT + VIEW);
	float sp = smoothstep(0.9, 0.94, dot(NORMAL, h)) * shadow;
	SPECULAR_LIGHT += LIGHT_COLOR * sp * spec_amount;
}
