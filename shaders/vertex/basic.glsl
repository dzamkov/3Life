attribute vec3 position;
varying vec3 verpos;
uniform mat4 view;
uniform mat4 proj;
void main() {
	gl_Position = proj * view * vec4(position, 1.0);
	verpos = position;
}