precision mediump float;
varying vec3 verpos;
void main(void) {
	float r = sin(verpos.x * 5.0) + cos(verpos.y * 5.0);
	float g = sin(verpos.y * 5.0) + cos(verpos.z * 5.0);
	float b = sin(verpos.z * 5.0) + cos(verpos.x * 5.0);
	gl_FragColor = vec4(r, g, b, 1.0);
}