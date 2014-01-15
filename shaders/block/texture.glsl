precision mediump float;
uniform sampler2D texture;
uniform float scale;
uniform vec3 offset; 
varying vec3 wpos;
varying vec3 wnorm;
void main(void) {
	vec3 light = normalize(vec3(0.3, 0.5, 1.0));
	float adjust = dot(wnorm, light) * 0.1;
	vec3 tpos = wpos - offset;
	vec2 uv = tpos.xy * wnorm.z + tpos.yz * wnorm.x + tpos.zx * wnorm.y;
	uv = uv / scale;
	vec4 color = texture2D(texture, uv);
	gl_FragColor = vec4(
		color.r + adjust,
		color.g + adjust,
		color.b + adjust,
		color.a);
}