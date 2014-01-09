precision mediump float;
uniform vec4 color;
varying float roffset;
void main(void) {
	float v = sqrt(1.0 - roffset * roffset);
	gl_FragColor = color * v;
}