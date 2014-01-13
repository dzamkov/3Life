precision mediump float;
uniform vec4 color;
varying vec3 wpos;
varying vec3 wnorm;
void main(void) {
	vec3 light = normalize(vec3(0.3, 0.5, 1.0));
	float adjust = dot(wnorm, light) * 0.1;
	gl_FragColor = vec4(
		color.r + adjust,
		color.g + adjust,
		color.b + adjust,
		color.a);
}