attribute vec3 pos;
attribute vec3 dir;
attribute float offset;
varying vec3 fpos;
varying float roffset;
uniform mat4 view;
uniform vec3 foward;
void main() {
	vec3 side = cross(foward, dir);
	fpos = pos + side * offset;
	gl_Position = view * vec4(fpos, 1.0);
	roffset = sign(offset);
}