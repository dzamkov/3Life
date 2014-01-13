precision mediump float;
uniform sampler2D texture;
uniform float scale; 
varying vec3 wpos;
varying vec3 wnorm;
void main(void) {
	vec3 light = normalize(vec3(0.3, 0.5, 1.0));
	float adjust = dot(wnorm, light) * 0.1;
	vec2 uv = wpos.xy * wnorm.z + wpos.yz * wnorm.x + wpos.zx * wnorm.y;
	uv = uv / scale;
	vec4 color = texture2D(texture, uv);
	gl_FragColor = vec4(
		color.r + adjust,
		color.g + adjust,
		color.b + adjust,
		color.a);
}