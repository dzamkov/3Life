// Describes a free-floating camera for an editor.
function Camera(pos, yaw, pitch, foward) {
	this.pos = pos;
	this.yaw = yaw;
	this.pitch = pitch;
	this.foward = foward || [
		Math.cos(yaw) * Math.cos(pitch),
		Math.sin(yaw) * Math.cos(pitch),
		Math.sin(pitch)];
}

// Define 'Camera' methods.
(function() {

	// Gets the view matrix for this camera.
	this.prototype.getViewMatrix = function() {
		return mat4.lookAt(this.pos,
			Vec3.add(this.pos, this.foward),
			Vec3.z);
	}
	
	// Moves this camera along its horizontal plane.
	this.prototype.move = function(amt) {
		var right = Vec3.cross(this.foward, Vec3.z);
		return new Camera(Vec3.add(this.pos, Vec3.add(
			Vec3.scale(right, amt[0]), Vec3.scale(this.foward, amt[1]))),
			this.yaw, this.pitch, this.foward);
	}
	
	// Rotates this camera (in radian units).
	this.prototype.rotate = function(amt, pitchLimit) {
		var yaw = this.yaw - amt[0];
		var pitch = Math.max(-pitchLimit, Math.min(pitchLimit, this.pitch + amt[1]));
		return new Camera(this.pos, yaw, pitch);
	}

}).call(Camera);

// Contains functions and values related to the 3D
// scene editor user interface.
var Editor = new function() {

	// The default input scheme for an editor.
	this.defaultInputs = {
		cameraMove : Input.Signal.wasd,
		cameraRotate : Input.Signal.ijkl
	}
	
	// Creates an editor interface for a canvas.
	this.create = function(canvas, node, inputs, undo) {
		var gl = createGLContext(canvas);
		var camera = new Camera([-0.5, 0.0, 0.6], 0.0, -0.5); 
		var signals = Input.link(inputs, canvas, { }, undo);
		var scene = new Render.Scene();
		var renderer = new Render.Direct(Volume, scene.pushMatterLeaf.bind(scene));
		renderer.set(node);
		scene.flush(gl);
		
		// Create a test line scene.
		var verts = new Float32Array([
			0.0, 0.0, 0.0, 0.0, 0.0, 1.0, -0.001,
			0.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.001,
			0.0, 0.0, 1.0, 0.0, 0.0, 1.0, -0.01,
			0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.01]);
		var ids = new Uint16Array([0, 1, 2, 2, 1, 3]);
		var lineVertBuffer = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, lineVertBuffer);
		gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
		var lineIndexBuffer = gl.createBuffer();
		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, lineIndexBuffer);
		gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, ids, gl.STATIC_DRAW);
		
		// Render the editor view.
		gl.enable(gl.CULL_FACE);
		gl.enable(gl.DEPTH_TEST);
		Callback.register(Callback.render, function() {
			gl.viewport(0, 0, canvas.width, canvas.height);
			gl.clearColor(0.0, 0.0, 0.0, 1.0);
			gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
			
			var view = mat4.create();
			mat4.multiply(mat4.perspective(45, canvas.width / canvas.height, 0.001, 2.0),
				camera.getViewMatrix(), view);
			scene.render(gl, view, 1.0 / (1 << node.depth));
			
			var lineProgram = Program.Line.color;
			if (lineProgram.hasValue) {
				lineProgram = lineProgram.value.get(gl);
				gl.useProgram(lineProgram);
				gl.uniformMatrix4fv(lineProgram.view, false, view);
				gl.uniform4f(lineProgram.color, 1.0, 0.0, 0.0, 1.0);
				gl.uniform3fv(lineProgram.foward, camera.foward);
				gl.bindBuffer(gl.ARRAY_BUFFER, lineVertBuffer);
				gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, lineIndexBuffer);
				gl.enableVertexAttribArray(lineProgram.pos);
				gl.enableVertexAttribArray(lineProgram.dir);
				gl.enableVertexAttribArray(lineProgram.offset);
				gl.vertexAttribPointer(lineProgram.pos, 3, gl.FLOAT, false, 7 * 4, 0);
				gl.vertexAttribPointer(lineProgram.dir, 3, gl.FLOAT, false, 7 * 4, 3 * 4);
				gl.vertexAttribPointer(lineProgram.offset, 1, gl.FLOAT, false, 7 * 4, 6 * 4);
				gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
				gl.disableVertexAttribArray(lineProgram.pos);
				gl.disableVertexAttribArray(lineProgram.dir);
				gl.disableVertexAttribArray(lineProgram.offset);
			}
		}, undo);
		
		// Handle movement/update.
		var maxDis = 0.5;
		var minDis = 0.001;
		var lastDis = 0.0;
		Callback.register(Callback.update, function(delta) {

			// Move camera along its plane.
			var cameraMove = signals.cameraMove();
			if (cameraMove) {
				var cameraMoveScale =  0.8 * (lastDis + 0.05) * delta;
				camera = camera.move(Vec2.scale(cameraMove, cameraMoveScale));
			}
			
			// Rotate camera.
			var cameraRotate = signals.cameraRotate();
			if (cameraRotate) {
				var cameraRotateScale = 1.5 * delta;
				camera = camera.rotate(Vec2.scale(cameraRotate, cameraRotateScale), Math.PI * 0.4);
			}
		
			// Compute camera distance from matter in the scene.
			function pred(node) { return node !== Matter.empty; }
			for (var i = 0; i < 3; i++) {
				var near = Volume.nearTransformed(pred, node, 1.0, [0.0, 0.0, 0.0], camera.pos, maxDis);
				lastDis = near ? near.dis : maxDis;
				if (near && near.dis < minDis) {
					camera.pos = Vec3.add(camera.pos, Vec3.scale(near.norm, minDis - near.dis));
				} else break;
			}
		});
	}
};