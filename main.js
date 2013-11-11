var canvas, buffers, program;
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

	buffers = new HashMap(5);
	function writeQuad(mat, rect, project, flip, pos) {
		var data = buffers.lookup(mat, function(mat) {
			return new StreamingArrayBuffer(18, 15000);
		}).push();
		
		var a = project(rect.min, pos);
		var b = project([rect.max[0], rect.min[1]], pos);
		var c = project([rect.min[0], rect.max[1]], pos);
		var d = project(rect.max, pos);
		if (flip) {
			var temp = b;
			b = c;
			c = temp;
		}
		
		data[0] = a[0]; data[1] = a[1]; data[2] = a[2];
		data[3] = b[0]; data[4] = b[1]; data[5] = b[2];
		data[6] = c[0]; data[7] = c[1]; data[8] = c[2];
		data[9] = c[0]; data[10] = c[1]; data[11] = c[2];
		data[12] = b[0]; data[13] = b[1]; data[14] = b[2];
		data[15] = d[0]; data[16] = d[1]; data[17] = d[2];
	}

	var matter = testWorld;
	for (var i = 0; i < 3; i++) {
		for (var j = 0; j <= 1; j++) {
			var flip = (j == 1);
			var slices = Surface.Slice[i].all(matter, flip);
			for (var k = 0; k < slices.length; k++) {
				var view = Surface.view(slices[k].val);
				var quads = view.allQuads();
				for (var l = 0; l < quads.length; l++) {
					var quad = quads[l];
					writeQuad(quad.material, quad.lower, 
						Surface.Slice[i].project, flip, slices[k].pos);
				}
			}
		}
	}
	buffers.forEach(function(_, buffer) {
		buffer.flush();
	});
	
	gl.enable(gl.CULL_FACE);
	gl.enable(gl.DEPTH_TEST);
	
	onResize();
	window.addEventListener('resize', onResize, false);
	canvas.addEventListener('mousemove', onMouseMove, false);
	
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

var x, y;
function onMouseMove(event) {
	x = event.clientX;
	y = event.clientY;
}

function onRenderFrame() {
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
	if (program) {
		gl.useProgram(program);
		
		var proj = mat4.create();
		mat4.perspective(45, canvas.width / canvas.height, 0.1, 100.0, proj);
		
		var view = mat4.create();
		var mx = 1.0 - x / canvas.width * 2.0;
		var my = y / canvas.height * 2.0 - 1.0;
		mx *= 2.5;
		my *= 1.5;
		var d = 2.0;
		mat4.lookAt([
			d * Math.cos(mx) * Math.cos(my),
			d * Math.sin(mx) * Math.cos(my),
			d * Math.sin(my)],
			[0, 0, 0], [0, 0, 1], view);
		
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
		
		buffers.forEach(function(mat, buffer) {
			if (mat instanceof Material.Solid) {
				renderBuffer(buffer, mat.r, mat.g, mat.b);
			}
		});
	}
}

function onUpdateFrame(delta) {

}