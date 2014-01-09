attribute vec3 pos;
attribute vec3 norm;
varying vec3 fpos;
varying vec3 fnorm;
uniform mat4 view;
void main() {
	gl_Position = view * vec4(pos, 1.0);
	fpos = pos;
	fnorm = norm;
}