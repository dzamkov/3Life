precision mediump float;
uniform vec3 color;
varying vec3 fpos;
varying vec3 fnorm;
void main(void) {
	vec3 light = normalize(vec3(0.3, 0.5, 1.0));
	float adjust = dot(fnorm, light) * 0.1;
	
	float maxBorderDepth = 0.95;
	if (gl_FragCoord.z < maxBorderDepth) {
		float m = 1.0 / 512.0;
		vec3 npos = abs(mod(fpos + vec3(m, m, m) * 0.5, m) - vec3(m, m, m) * 0.5);
		float k = min(min(npos.x + abs(fnorm.x), npos.y + abs(fnorm.y)), npos.z + abs(fnorm.z)) / m;
		float farness = pow(gl_FragCoord.z / maxBorderDepth, 10.0);
		float borderWidth = 0.05 + (0.1 - 0.05) * farness;
		if (k < borderWidth) {
			adjust -= 0.3 * (1.0 - farness) * (1.0 - k / borderWidth);
		}
	}
	gl_FragColor = vec4(
		color.r + adjust,
		color.g + adjust,
		color.b + adjust, 1.0);
}