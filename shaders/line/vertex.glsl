attribute vec3 pos;
attribute vec3 dir;
attribute float offset;
varying vec3 wpos;
varying float roffset;
uniform mat4 model;
uniform float scale;
uniform mat4 view;
uniform vec3 eyePos;
void main() {
	vec3 wpos = vec3(model * vec4(pos, 1.0));
	vec3 wdir = vec3(model * vec4(dir, 0.0));
	float woffset = scale * offset;
	vec3 side = normalize(cross(wdir, eyePos - wpos));
	wpos += side * woffset;
	gl_Position = view * vec4(wpos, 1.0);
	roffset = sign(offset);
}