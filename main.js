var canvas, buffer, program;
window.addEventListener('load', init, false);
function init() {
	canvas = document.getElementById('canvas');
	gl = canvas.getContext('experimental-webgl');
	var _gl = linkAll(gl);
	
	var vertex = loadText("shaders/vertex/basic.glsl").map(_gl.loadVertexShader);
	var fragment = loadText("shaders/fragment/basic.glsl").map(_gl.loadFragmentShader);
	join([vertex, fragment], _gl.loadProgram).done(function (value) { 
		program = value;
		program.proj = gl.getUniformLocation(program, "proj");
        program.view = gl.getUniformLocation(program, "view");
	});
	
	buffer = new StreamingArrayBuffer(18, 300);
	var mat = new Render.Material(1.0, 0.0, 0.0);
	var a = Render.merge(mat, Render.empty, mat, Render.inside);
	var b = Render.merge(mat, Render.empty, Render.empty, mat);
	var c = Render.merge(mat, Render.inside, Render.inside, Render.inside);
	var d = Render.merge(a, b, c, b);
	var e = Render.merge(a, b, c, d);
	var f = Render.merge(d, b, e, d);
	Render.output(buffer, f, mat, 2.0, -1.0, -1.0);
	buffer.flush();
	
	onResize();
	window.addEventListener('resize', onResize, false);
	
	var lastTime = new Date().getTime();
	var elapsedTime = 0.0;
	var elapsedFrames = 0;
	var interval = 1.0 / 60.0;
	(function animate() {
		var currentTime = new Date().getTime();
		elapsedTime += (currentTime - lastTime) / 1000.0;
		elapsedFrames++;
		lastTime = currentTime;
		while (elapsedTime > 1.0) {
			document.title = elapsedFrames;
			interval = elapsedTime / elapsedFrames;
			elapsedTime -= 1.0;
			elapsedFrames = 0;
		}
		requestAnimationFrame(animate);
		onRenderFrame();
		onUpdateFrame(interval);
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
		buffer.bind();
		
		var proj = mat4.create();
		mat4.perspective(45, canvas.width / canvas.height, 0.1, 100.0, proj);
		
		var view = mat4.create();
		mat4.lookAt([5, 5, 5], [0, 0, 0], [0, 0, 1], view);
		
		gl.uniformMatrix4fv(program.proj, false, proj);
        gl.uniformMatrix4fv(program.view, false, view);
		
		var vertex_position;
		gl.vertexAttribPointer(vertex_position, 3, gl.FLOAT, false, 0, 0);
		gl.enableVertexAttribArray(vertex_position);
		gl.drawArrays(gl.TRIANGLES, 0, 6 * buffer.maxItemCount);
		gl.disableVertexAttribArray(vertex_position);
	}
}

function onUpdateFrame(delta) {

}