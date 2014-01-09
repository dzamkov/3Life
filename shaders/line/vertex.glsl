attribute vec3 pos;
attribute vec3 dir;
attribute float offset;
varying vec3 fpos;
varying float roffset;
uniform mat4 view;
uniform vec3 eyePos;
void main() {
	vec3 side = normalize(cross(pos - eyePos, dir));
	fpos = pos + side * offset;
	gl_Position = view * vec4(fpos, 1.0);
	roffset = sign(offset);
}