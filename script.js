var canvas, gl, _gl;
var buffer, program;
window.addEventListener('load', init, false);
function init() {
	canvas = document.getElementById('canvas');
	gl = canvas.getContext('experimental-webgl');
	_gl = linkAll(gl);
	
	var vertex = loadText('shaders/vertex/basic.glsl').map(_gl.loadVertexShader);
	var fragment = loadText('shaders/fragment/basic.glsl').map(_gl.loadFragmentShader);
	join([vertex, fragment], _gl.loadProgram).done(function (value) { 
		program = value;
		program.proj = gl.getUniformLocation(program, "proj");
        program.view = gl.getUniformLocation(program, "view");
	});
	
	buffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1.0, -1.0, 1.0, -1.0, -1.0, 1.0, 1.0, -1.0, 1.0, 1.0, -1.0, 1.0]), gl.STATIC_DRAW);
	
	onResize();
	window.addEventListener('resize', onResize, false);
	
	(function animate() {
		requestAnimationFrame(animate);
		onRenderFrame();
	})();
}

function onResize() {
	canvas.width = window.innerWidth;
	canvas.height = window.innerHeight;
	gl.viewport(0, 0, canvas.width, canvas.height);
}

function onRenderFrame() {
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
	if (program) {
		gl.useProgram(program);
		gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
		
		var proj = mat4.create();
		mat4.perspective(45, canvas.width / canvas.height, 0.1, 100.0, proj);
		//mat4.identity(proj);
		
		var view = mat4.create();
		mat4.lookAt([2, 2, 2], [0, 0, 0], [0, 0, 1], view);
		
		gl.uniformMatrix4fv(program.proj, false, proj);
        gl.uniformMatrix4fv(program.view, false, view);
		
		var vertex_position;
		gl.vertexAttribPointer(vertex_position, 2, gl.FLOAT, false, 0, 0);
		gl.enableVertexAttribArray(vertex_position);
		gl.drawArrays(gl.TRIANGLES, 0, 6);
		gl.disableVertexAttribArray(vertex_position);
	}
}