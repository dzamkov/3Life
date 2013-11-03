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
	
	buffer = new StreamingArrayBuffer(9, 500000);
	
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
		if (elapsedTime > 1.0) {
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
		gl.drawArrays(gl.TRIANGLES, 0, 3 * buffer.maxItemCount);
		gl.disableVertexAttribArray(vertex_position);
	}
}

var time = 0;
function onUpdateFrame(delta) {
	time += delta;
	for (var j = 0; j < 10; j++) {
		if (Math.random() < 0.7) {
			buffer.clear(Math.floor(Math.random() * buffer.maxItemCount));
		} else {
			var i = buffer.findFree();
			if (i >= 0) {
				var data = buffer.edit(i);
				data[0] = Math.random() * 2.0 - 1.0;
				data[1] = Math.random() * 2.0 - 1.0;
				data[2] = Math.random() * 2.0 - 1.0;
				data[3] = Math.random() * 2.0 - 1.0;
				data[4] = Math.random() * 2.0 - 1.0;
				data[5] = Math.random() * 2.0 - 1.0;
				data[6] = Math.random() * 2.0 - 1.0;
				data[7] = Math.random() * 2.0 - 1.0;
				data[8] = Math.random() * 2.0 - 1.0;
				data[9] = Math.random() * 2.0 - 1.0;
			}
		}
	}
	buffer.flush();
}