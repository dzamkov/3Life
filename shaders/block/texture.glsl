precision mediump float;
uniform sampler2D texture;
uniform vec4 color;
uniform float scale;
uniform vec3 offset; 
varying vec3 wpos;
varying vec3 wnorm;
void main(void) {
	vec3 light = normalize(vec3(0.3, 0.5, 1.0));
	float adjust = 1.0 + dot(wnorm, light) * 0.1;
	vec3 tpos = wpos - offset;
	vec2 uv = tpos.xy * wnorm.z + tpos.yz * wnorm.x + tpos.zx * wnorm.y;
	uv = uv / scale;
	vec4 fcolor = texture2D(texture, uv) * color;
	gl_FragColor = vec4(
		fcolor.r * adjust,
		fcolor.g * adjust,
		fcolor.b * adjust,
		fcolor.a);
}