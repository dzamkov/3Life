precision mediump float;
uniform sampler2D texture;
uniform float scale; 
varying vec3 fpos;
varying vec3 fnorm;
void main(void) {
	vec3 light = normalize(vec3(0.3, 0.5, 1.0));
	float adjust = dot(fnorm, light) * 0.1;
	vec2 uv = fpos.xy * fnorm.z + fpos.yz * fnorm.x + fpos.zx * fnorm.y;
	uv = uv / scale;
	vec4 color = texture2D(texture, uv);
	gl_FragColor = vec4(
		color.r + adjust,
		color.g + adjust,
		color.b + adjust, 1.0);
}