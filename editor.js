// Contains functions and values related to the 3D
// scene editor user interface.
var Editor = new function() {

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
			var right = Vec3.normalize(Vec3.cross(this.foward, Vec3.z));
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
	
	// Describes a selection box for an editor. The selection box
	// covers a rectangular volume, has a primary face (for painting)
	// and has a scale (for determining the size of units within the box).
	function Box(bounds, axis, flip, scale) {
		this.bounds = bounds;
		this.axis = axis;
		this.flip = flip;
		this.scale = scale;
	}
	
	// Creates a mesh for a line grid. The mesh is on the XY plane, and each square
	// on the grid is 1 by 1. The lines have a width of 1.
	function lineGrid(rows, cols) {
		var vertexSize = 5;
		var attributes = {
			pos : { size : 2, offset : 0 },
			dir : { size : 2, offset : 2 },
			offset : { size : 1, offset : 4 }};
		var vertexData = new Array();
		var indexData = new Array();
		function outputVertex(pos, dir, offset) {
			var index = vertexData.length;
			vertexData.length += vertexSize;
			vertexData[index + 0] = pos[0];
			vertexData[index + 1] = pos[1];
			vertexData[index + 2] = dir[0];
			vertexData[index + 3] = dir[1];
			vertexData[index + 4] = offset;
			return index / vertexSize;
		}
		function outputLine(from, to, dir, thickness) {
			var a = outputVertex(from, dir, -thickness);
			var b = outputVertex(from, dir, thickness);
			var c = outputVertex(to, dir, -thickness);
			var d = outputVertex(to, dir, thickness);
			indexData.push(a);
			indexData.push(b);
			indexData.push(c);
			indexData.push(c);
			indexData.push(b);
			indexData.push(d);
		}
		for (var i = 0; i <= rows; i++) {
			outputLine([i, 0], [i, cols], [0, 1], 0.5);
		}
		for (var j = 0; j <= cols; j++) {
			outputLine([0, j], [rows, j], [1, 0], 0.5);
		}
		return Mesh.create(Mesh.Mode.Triangles,
			new Float32Array(vertexData),
			new Uint16Array(indexData),
			vertexSize, attributes);
	}
	
	// Contains three matrices which, when applied to a line grid,
	// will rotate it so that its normal to the axis corresponding
	// to the matrix indexs.
	var permuteMatrices = [
		[0, 0, 1,
		 1, 0, 0,
		 0, 1, 0],
		[0, 1, 0,
		 0, 0, 1,
		 1, 0, 0],
		[1, 0, 0,
		 0, 1, 0,
		 0, 0, 1]];
	
	// Creates and returns a function to draw a selection box.
	function prepareDrawBox(gl, box) {
		var bounds = box.bounds;
		var axis = box.axis;
		var flip = box.flip;
		var scale = box.scale;
		var x = (axis + 1) % 3;
		var y = (axis + 2) % 3;
		var width = bounds.max[x] - bounds.min[x];
		var height = bounds.max[y] - bounds.min[y];
		var depth = bounds.max[axis] - bounds.min[axis];
		var rows = height / scale;
		var cols = width / scale;
		var drawGrid = lineGrid(rows, cols).create(gl);
		
		var primary = mat4.create();
		mat3.toMat4(permuteMatrices[axis], primary);
		mat4.translate(primary, bounds.min);
		mat4.scale(primary, [scale, scale, scale]);
		
		var secondary = mat4.create();
		mat4.set(primary, secondary);
		mat4.translate(secondary, [0, 0, depth / scale]);
		
		if (flip) {
			var temp = primary;
			primary = secondary;
			secondary = temp;
		}
		
		var rProgram = Program.Line.color;
		return function(view, eyePos) {
			if (rProgram.hasValue) {
				var program = rProgram.value.get(gl);
				gl.useProgram(program);
				gl.uniformMatrix4fv(program.model, false, primary);
				gl.uniform1f(program.scale, scale * 0.1);
				gl.uniformMatrix4fv(program.view, false, view);
				gl.uniform4f(program.color, 0.0, 0.6, 1.0, 1.0);
				gl.uniform3fv(program.eyePos, eyePos);
				drawGrid(program);
				gl.uniformMatrix4fv(program.model, false, secondary);
				gl.uniform1f(program.scale, scale * 0.05);
				gl.uniform4f(program.color, 0.5, 0.0, 0.0, 1.0);
				drawGrid(program);
			}
		};
	}

	// The default input scheme for an editor.
	var defaultInputs = {
		cameraMove : Input.Signal.wasd,
		cameraRotate : Input.Signal.ijkl
	}
	
	// Creates an editor interface for a canvas.
	this.create = function(canvas, node, inputs, undo) {
		var gl = createGLContext(canvas);
		var camera = new Camera([-0.5, 0.0, 0.6], 0.0, -0.5); 
		var signals = Input.link(inputs || defaultInputs, canvas, { }, undo);
		var scene = new Render.Scene();
		var renderer = new Render.Direct(Volume, scene.pushMatterLeaf.bind(scene));
		renderer.set(node);
		scene.flush(gl);
		
		var box = new Box(
			new Volume.Bound(
				[0.0, 0.0, 0.0],
				[0.125, 0.125, 0.25]),
			0, false, 1.0 / (1 << 5));
		var drawBox = prepareDrawBox(gl, box);
			
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
			
			var scale = 1.0 / (1 << node.depth);
			scene.render(gl, view, scale);
			drawBox(view, camera.pos);
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
	
	// Define exports.
	this.Camera = Camera;
	this.defaultInputs = defaultInputs;
	this.lineGrid = lineGrid;
};