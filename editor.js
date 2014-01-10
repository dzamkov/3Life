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
	function lineGridMesh(x, y) {
		var mode = Mesh.Mode.Triangles;
		var vertexSize = 5;
		var attributes = {
			pos : { size : 2, offset : 0 },
			dir : { size : 2, offset : 2 },
			offset : { size : 1, offset : 4 }};
		return Mesh.createBuilder(mode, vertexSize, attributes, function(builder) {
			for (var i = 0; i <= x; i++) {
				builder.line([i, 0], [i, y], 0.5, [0, 1]);
			}
			for (var j = 0; j <= y; j++) {
				builder.line([0, j], [x, j], 0.5, [1, 0]);
			}
		});
	}
	
	// A mesh for a unit cube between (0, 0, 0) and (1, 1, 1) with an open face
	// on the XY plane. The cube is made of lines of width 1.
	var boxMesh = Mesh.createBuilder(Mesh.Mode.Triangles, 7, {
		pos : { size : 3, offset : 0 },
		dir : { size : 3, offset : 3 },
		offset : { size : 1, offset : 6 }}, 
	function(builder) {
		builder.line([0, 0, 1], [0, 1, 1], 0.5, [0, 1, 0]);
		builder.line([1, 0, 1], [1, 1, 1], 0.5, [0, 1, 0]);
		builder.line([0, 0, 1], [1, 0, 1], 0.5, [1, 0, 0]);
		builder.line([0, 1, 1], [1, 1, 1], 0.5, [1, 0, 0]);
		builder.line([0, 0, 0], [0, 0, 1], 0.5, [0, 0, 1]);
		builder.line([0, 1, 0], [0, 1, 1], 0.5, [0, 0, 1]);
		builder.line([1, 0, 0], [1, 0, 1], 0.5, [0, 0, 1]);
		builder.line([1, 1, 0], [1, 1, 1], 0.5, [0, 0, 1]);
	});
	
	// Contains three matrices which, when applied to a line grid,
	// will rotate it so that its normal is along the axis corresponding
	// to the matrix index.
	var permuteMatrices = [
		[0, 1, 0,
		 0, 0, 1,
		 1, 0, 0],
		[0, 0, 1,
		 1, 0, 0,
		 0, 1, 0],
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
		var drawGrid = lineGridMesh(width / scale, height / scale).create(gl);
		var drawBox = boxMesh.create(gl);
		
		var permute = mat4.create();
		mat3.toMat4(permuteMatrices[axis], permute);
		
		var gridModel = mat4.create();
		mat4.identity(gridModel);
		mat4.translate(gridModel, flip ? bounds.max : bounds.min);
		mat4.multiply(gridModel, permute);
		mat4.scale(gridModel, [scale, scale, scale]);
		
		var boxModel = mat4.create();
		mat4.identity(boxModel);
		mat4.translate(boxModel, flip ? bounds.max : bounds.min);
		mat4.multiply(boxModel, permute);
		mat4.scale(boxModel, [width, height, depth]);
		
		if (flip) {
			mat4.scale(gridModel, [-1, -1, -1]);
			mat4.scale(boxModel, [-1, -1, -1]);
		}
		
		
		var rProgram = Program.Line.color;
		return function(view, eyePos) {
			if (rProgram.hasValue) {
				var program = rProgram.value.get(gl);
				gl.useProgram(program);
				gl.uniformMatrix4fv(program.model, false, gridModel);
				gl.uniform1f(program.scale, scale * 0.07);
				gl.uniformMatrix4fv(program.view, false, view);
				gl.uniform4f(program.color, 0.0, 0.3, 0.6, 1.0);
				gl.uniform3fv(program.eyePos, eyePos);
				drawGrid(program);
				gl.uniformMatrix4fv(program.model, false, boxModel);
				gl.uniform1f(program.scale, scale * 0.05);
				gl.uniform4f(program.color, 0.5, 0.0, 0.0, 1.0);
				drawBox(program);
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
		
		var t = 1.0 / (1 << 7);
		var box = new Box(
			new Volume.Bound(
				[10 * t, 10 * t, -20 * t],
				[30 * t, 30 * t, -16 * t]),
			2, true, t);
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
	this.lineGridMesh = lineGridMesh;
	this.boxMesh = boxMesh;
};