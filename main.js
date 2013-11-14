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
	renderer.set(node = Matter.test);
	scene.flush();
	
	gl.enable(gl.CULL_FACE);
	gl.enable(gl.DEPTH_TEST);
	
	onResize();
	window.addEventListener('resize', onResize, false);
	window.addEventListener('keyup', onKeyUp, false);
	window.addEventListener('keydown', onKeyDown, false);
	canvas.addEventListener('mousemove', onMouseMove, false);
	canvas.addEventListener('mousedown', onMouseDown, false);
	canvas.addEventListener('mousewheel', onMouseWheel, false);
	
	canvas.requestPointerLock = canvas.requestPointerLock ||
		canvas.mozRequestPointerLock ||
		canvas.webkitRequestPointerLock;
	
	canvas.requestFullScreen = canvas.requestFullScreen ||
		canvas.webkitRequestFullScreen || 
		canvas.mozRequestFullScreen;
	
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
		onUpdateFrame(1 / 60.0);
		requestAnimationFrame(animate);
	})();
	
	setInterval(function() {
		function randEdit(node, depth) {
			if (Math.random() < depth * 0.3 - 0.8) {
				return {
					node : Matter.empty,
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

function onMouseMove(event) {
	if (document.webkitPointerLockElement === canvas) {
		var x = event.movementX || event.webkitMovementX;
		var y = event.movementY || event.webkitMovementY;
		x *= 0.005;
		y *= 0.005;
		eyeYaw = eyeYaw - x;
		eyePitch = Math.max(Math.PI * -0.4, Math.min(Math.PI * 0.4, eyePitch - y));
	}
}

function onMouseDown() {
	canvas.requestFullScreen(canvas.ALLOW_KEYBOARD_INPUT);
	canvas.requestPointerLock();
}

var keyState = new Array();
function onKeyDown(event) {
	keyState[event.keyCode] = true;
}

function onKeyUp(event) {
	keyState[event.keyCode] = false;
}

var zoom = 0.0;
function onMouseWheel(event) {
	zoom -= event.wheelDelta / 5000.0;
	zoom = Math.min(0.5, Math.max(-0.5, zoom));
}

var eyePos = [-0.5, 0.0, 0.6];
var eyeYaw = 0.0;
var eyePitch = -0.5;
function onRenderFrame() {
	gl.clearColor(0.0, 0.0, 0.0, 1.0);
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
	if (program) {
		gl.useProgram(program);
		
		var proj = mat4.create();
		mat4.perspective(45, canvas.width / canvas.height, 0.001, 2.0, proj);
		
		var view = mat4.create();
		var eyeDir = vec3.create([
			Math.cos(eyeYaw) * Math.cos(eyePitch),
			Math.sin(eyeYaw) * Math.cos(eyePitch),
			Math.sin(eyePitch)]);
		mat4.lookAt(eyePos, vec3.add(vec3.create(eyePos), eyeDir), [0, 0, 1], view);
		
		gl.uniformMatrix4fv(program.proj, false, proj);
        gl.uniformMatrix4fv(program.view, false, view);
		scene.render();
		scene.flush();
	}
}

var minDis = 0.001;
var lastDis = 0.0;
function onUpdateFrame(delta) {
	var eyeDir = vec3.create([
		Math.cos(eyeYaw) * Math.cos(eyePitch),
		Math.sin(eyeYaw) * Math.cos(eyePitch),
		Math.sin(eyePitch)]);
	var eyeLeft = vec3.cross([0, 0, 1], eyeDir);
	var move = 1.0 * Math.pow(lastDis, 0.7) * delta;
	if (keyState[37] || keyState[65]) vec3.add(eyePos, vec3.scale(eyeLeft, move));
	if (keyState[39] || keyState[68]) vec3.subtract(eyePos, vec3.scale(eyeLeft, move));
	if (keyState[38] || keyState[87]) vec3.add(eyePos, vec3.scale(eyeDir, move));
	if (keyState[40] || keyState[83]) vec3.subtract(eyePos, vec3.scale(eyeDir, move));
	for (var i = 0; i < 3; i++) {
		var near = Matter.nearTransformed(node, 1.0, [0.0, 0.0, 0.0], eyePos);
		lastDis = near.dis;
		if (near.dis < minDis) {
			var Vector = Volume.Vector;
			vec3.add(eyePos, Vector.scale(near.norm, minDis - near.dis));
		} else break;
	}
	
	
}