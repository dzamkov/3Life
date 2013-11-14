var canvas, scene, renderer, node, program;
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
		program.pos = gl.getAttribLocation(program, "pos");
		program.norm = gl.getAttribLocation(program, "norm");
	});

	scene = new Render.Scene();
	renderer = new Render.Matter(scene);
	renderer.set(node = testWorld);
	scene.flush();
	
	gl.enable(gl.CULL_FACE);
	gl.enable(gl.DEPTH_TEST);
	
	onResize();
	window.addEventListener('resize', onResize, false);
	canvas.addEventListener('mousemove', onMouseMove, false);
	canvas.addEventListener('mousewheel', onMouseWheel, false);
	
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
		onRenderFrame();
		onUpdateFrame(interval);
		requestAnimationFrame(animate);
	})();
	
	setInterval(function() {
		function randEdit(node, depth) {
			if (Math.random() < depth * 0.3 - 0.8) {
				return {
					node : empty,
					change : Volume.Boolean.true};
			} else {
				var i = Math.floor(Math.random() * 8);
				var mChildren = new Array(8);
				var cChildren = new Array(8);
				for (var j = 0; j < 8; j++) {
					mChildren[j] = node.children[j];
					cChildren[j] = Volume.Boolean.false;
				}
				var res = randEdit(mChildren[i], depth + 1);
				mChildren[i] = res.node;
				cChildren[i] = res.change;
				return {
					node : Matter.get(mChildren),
					change : Volume.Boolean.get(cChildren)};
				Matter.get(children);
			}
		}
		var res = randEdit(node, 0);
		renderer.update(res.node, res.change);
		node = res.node;
	}, 30);
}

function onResize() {
	canvas.width = window.innerWidth;
	canvas.height = window.innerHeight;
	gl.viewport(0, 0, canvas.width, canvas.height);
}

var x = 0;
var y = 0;
function onMouseMove(event) {
	x = event.clientX;
	y = event.clientY;
}

var zoom = 0.0;
function onMouseWheel(event) {
	zoom -= event.wheelDelta / 5000.0;
	zoom = Math.min(0.5, Math.max(-0.5, zoom));
}

function onRenderFrame() {
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
	if (program) {
		gl.useProgram(program);
		
		var proj = mat4.create();
		mat4.perspective(45, canvas.width / canvas.height, 0.01, 10.0, proj);
		
		var view = mat4.create();
		var mx = 1.0 - x / canvas.width * 2.0;
		var my = y / canvas.height * 2.0 - 1.0;
		mx *= 2.5;
		my *= 1.5;
		var d = Math.exp(zoom * 5.0);
		mat4.lookAt([
			d * Math.cos(mx) * Math.cos(my),
			d * Math.sin(mx) * Math.cos(my),
			d * Math.sin(my) - 0.5],
			[0, 0, -0.5], [0, 0, 1], view);
		
		gl.uniformMatrix4fv(program.proj, false, proj);
        gl.uniformMatrix4fv(program.view, false, view);
		scene.render();
		scene.flush();
	}
}

function onUpdateFrame(delta) {
	
}