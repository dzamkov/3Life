var canvas, scene, renderer, automataNode, matterNode;
window.addEventListener('load', init, false);
function init() {
	canvas = document.getElementById('canvas');
	gl = canvas.getContext('experimental-webgl');

	automataNode = Gol.nextInPlace(Gol.test, 0, Gol.test.depth, 30);
	scene = new Render.Scene();
	renderer = new Render.Matter.Complex(scene.pushMatter(), scene.remove);
	renderer.set(matterNode = Gol.getMatter(automataNode));
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
	
	/*setInterval(function() {
		automataNode = Gol.nextInPlace(automataNode, 0, automataNode.depth, 5);
		renderer.reset(matterNode = Gol.getMatter(automataNode));
	}, 2000);*/
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
	
	var proj = mat4.create();
	mat4.perspective(45, canvas.width / canvas.height, 0.001, 2.0, proj);
	
	var view = mat4.create();
	var eyeDir = vec3.create([
		Math.cos(eyeYaw) * Math.cos(eyePitch),
		Math.sin(eyeYaw) * Math.cos(eyePitch),
		Math.sin(eyePitch)]);
	mat4.lookAt(eyePos, vec3.add(vec3.create(eyePos), eyeDir), [0, 0, 1], view);
	
	scene.render(proj, view, 1.0 / (1 << matterNode.depth));
	scene.flush();
}

var maxDis = 0.5;
var minDis = 0.001;
var lastDis = 0.0;
function onUpdateFrame(delta) {
	var eyeDir = vec3.create([
		Math.cos(eyeYaw) * Math.cos(eyePitch),
		Math.sin(eyeYaw) * Math.cos(eyePitch),
		Math.sin(eyePitch)]);
	var eyeLeft = vec3.cross([0, 0, 1], eyeDir);
	var move = 0.8 * (lastDis + 0.05) * delta;
	if (keyState[37] || keyState[65]) vec3.add(eyePos, vec3.scale(eyeLeft, move));
	if (keyState[39] || keyState[68]) vec3.subtract(eyePos, vec3.scale(eyeLeft, move));
	if (keyState[38] || keyState[87]) vec3.add(eyePos, vec3.scale(eyeDir, move));
	if (keyState[40] || keyState[83]) vec3.subtract(eyePos, vec3.scale(eyeDir, move));
	function pred(node) { return node !== Matter.empty; }
	for (var i = 0; i < 3; i++) {
		var Vector = Volume.Vector;
		var near = Volume.nearTransformed(pred, matterNode, 1.0, [0.0, 0.0, 0.0], eyePos, maxDis);
		lastDis = near ? near.dis : maxDis;
		if (near && near.dis < minDis) {
			Vector.scale(near.norm, minDis - near.dis);
			vec3.add(eyePos, near.norm);
		} else break;
	}
}