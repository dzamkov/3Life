precision mediump float;
uniform vec3 color;
varying vec3 fpos;
varying vec3 fnorm;
void main(void) {
	vec3 light = normalize(vec3(0.3, 0.5, 1.0));
	float adjust = dot(fnorm, light) * 0.1;
	gl_FragColor = vec4(
		color.r + adjust,
		color.g + adjust,
		color.b + adjust, 1.0);
}