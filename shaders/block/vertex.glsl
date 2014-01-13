attribute vec3 pos;
attribute vec3 norm;
varying vec3 wpos;
varying vec3 wnorm;
uniform mat4 model;
uniform mat4 view;
void main() {
	wpos = vec3(model * vec4(pos, 1.0));
	wnorm = normalize(vec3(model * vec4(norm, 0.0)));
	gl_Position = view * vec4(wpos, 1.0);
}