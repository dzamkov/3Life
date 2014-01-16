var canvas, scene, renderer, automataNode, matterNode;
var movement;
window.addEventListener('load', init, false);
function init() {
	var canvas = document.getElementById('canvas');
	var resize = function() {
		canvas.width = window.innerWidth;
		canvas.height = window.innerHeight;
	}
	window.addEventListener('resize', resize);
	resize();
	
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
		Callback.invoke(Callback.update, 1.0 / 60.0);
		Callback.invoke(Callback.input, 1.0 / 60.0);
		Callback.invoke(Callback.render);
		requestAnimationFrame(animate);
	})();
	
	Editor.resources.await(function() {
		var automataNode = Gol.nextInPlace(Gol.test, 0, Gol.test.depth, 10);
		var matterNode = Gol.getMatter(automataNode);
		var editor = new Editor(canvas, matterNode);
	});
}