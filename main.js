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
	
	var white = Material.solid(1.0, 1.0, 1.0);
	var red = Material.solid(1.0, 0.0, 0.0);
	function randNode(depth, materials) {
		if (Math.random() < depth * 0.2 - 0.2) {
			var x = Math.floor(Math.random() * (materials.length + 1));
			if (x < materials.length) return Surface.lookup(materials[x]);
			else return Surface.inside;
		} else {
			var n = depth + 1;
			var newMaterials = new Array();
			while (Math.random() < 0.1) {
				newMaterials.push(Material.solid(
					Math.random() * 0.5 + 0.5,
					Math.random() * 0.5 + 0.5,
					Math.random() * 0.5 + 0.5));
			}
			materials = materials.concat(newMaterials);
			return Surface.Node.merge(
				randNode(n, materials), 
				randNode(n, materials), 
				randNode(n, materials), 
				randNode(n, materials));
		}
	}
	var node = randNode(0, [white]);
	var view = Surface.view(node).transform(8.0, [0.0, 0.0]);
	
	buffers = new HashMap(5);
	function writeQuad(mat, rect) {
		var data = buffers.lookup(mat, function(mat) {
			return new StreamingArrayBuffer(18, 15000);
		}).push();
		
		var d = 0.01;
		data[0] = rect.min[0] + d;
		data[1] = rect.min[1] + d;
		data[2] = 0.0;
		data[3] = rect.max[0] - d;
		data[4] = rect.min[1] + d;
		data[5] = 0.0;
		data[6] = rect.min[0] + d;
		data[7] = rect.max[1] - d;
		data[8] = 0.0;
		data[9] = rect.min[0] + d;
		data[10] = rect.max[1] - d;
		data[11] = 0.0;
		data[12] = rect.max[0] - d;
		data[13] = rect.min[1] + d;
		data[14] = 0.0;
		data[15] = rect.max[0] - d;
		data[16] = rect.max[1] - d;
		data[17] = 0.0;
	}
	
	function writeView(view) {
		var quads = view.allQuads();
		for (i = 0; i < quads.length; i++) {
			var quad = quads[i];
			writeQuad(quad.material, quad.lower);
		}
	}
	writeView(view);
	buffers.forEach(function(_, buffer) {
		buffer.flush();
	});
	
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
		mat4.lookAt([0, -3, 12], [0, 0, 0], [0, 0, 1], view);
		
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
		
		gl.enable(gl.BLEND);
		gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
		buffers.forEach(function(mat, buffer) {
			if (mat instanceof Material.Solid) {
				renderBuffer(buffer, mat.r, mat.g, mat.b);
			}
		});
	}
}

function onUpdateFrame(delta) {

}