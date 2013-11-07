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
		program.color = gl.getUniformLocation(program, "color");
	});
	
	whiteBuffer = new StreamingArrayBuffer(18, 300);
	redBuffer = new StreamingArrayBuffer(18, 300);
	var white = new Render.Material(1.0, 1.0, 1.0);
	var red = new Render.Material(1.0, 0.0, 0.0);
	
	function randNode(depth) {
		if (Math.random() < depth * 0.3) {
			var x = Math.random();
			if (x < 0.3) return red;
			else if (x < 0.7) return white;
			else return Render.inside;
		} else {
			var n = depth + 1;
			return Render.merge(randNode(n), randNode(n), randNode(n), randNode(n));
		}
	}
	var node = randNode(0);
	var view = Render.view(node).transform(8.0, -4.0, -4.0);
	
	function write(mat, rect) {
		var buffer =
			(mat === white) ? whiteBuffer :
			(mat === red) ? redBuffer : null;
		if (buffer) {
			var data = buffer.push();
			data[0] = rect.nx + 0.1;
			data[1] = rect.ny + 0.1;
			data[2] = 0.0;
			data[3] = rect.px - 0.1;
			data[4] = rect.ny + 0.1;
			data[5] = 0.0;
			data[6] = rect.nx + 0.1;
			data[7] = rect.py - 0.1;
			data[8] = 0.0;
			data[9] = rect.nx + 0.1;
			data[10] = rect.py - 0.1;
			data[11] = 0.0;
			data[12] = rect.px - 0.1;
			data[13] = rect.ny + 0.1;
			data[14] = 0.0;
			data[15] = rect.px - 0.1;
			data[16] = rect.py - 0.1;
			data[17] = 0.0;
		}
	}
	
	var quads = view.all();
	for (i = 0; i < quads.length; i++) {
		var quad = quads[i];
		write(quad.material, quad.lower);
	}
	whiteBuffer.flush();
	redBuffer.flush();
	
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
		
		var proj = mat4.create();
		mat4.perspective(45, canvas.width / canvas.height, 0.1, 100.0, proj);
		
		var view = mat4.create();
		mat4.lookAt([0, 1, 10], [0, 0, 0], [0, 0, 1], view);
		
		gl.uniformMatrix4fv(program.proj, false, proj);
        gl.uniformMatrix4fv(program.view, false, view);
		
		
		function renderBuffer(buffer, r, g, b) {
			buffer.bind();
			var vertex_position;
			gl.uniform3f(program.color, r, g, b);
			gl.vertexAttribPointer(vertex_position, 3, gl.FLOAT, false, 0, 0);
			gl.enableVertexAttribArray(vertex_position);
			gl.drawArrays(gl.TRIANGLES, 0, 6 * buffer.maxItemCount);
			gl.disableVertexAttribArray(vertex_position);
		}
		
		renderBuffer(whiteBuffer, 1.0, 1.0, 1.0);
		renderBuffer(redBuffer, 1.0, 0.0, 0.0);
	}
}

function onUpdateFrame(delta) {

}