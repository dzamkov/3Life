precision mediump float;
uniform vec4 color;
uniform float scale; 
varying vec3 fpos;
varying vec3 fnorm;
void main(void) {
	vec3 light = normalize(vec3(0.3, 0.5, 1.0));
	float adjust = dot(fnorm, light) * 0.1;
	gl_FragColor = vec4(
		color.r + adjust,
		color.g + adjust,
		color.b + adjust,
		color.a);
}