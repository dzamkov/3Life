// Contains functions and values related to the 3D
// scene editor user interface.
var Editor = new function() {

	// The resources necessary to use this module.
	var resources = [Texture.metal, Material.resources];

	// Describes a free-floating camera for an editor.
	function Camera(pos, yaw, pitch, foward) {
		this.pos = pos;
		this.yaw = yaw;
		this.pitch = pitch;
		this.foward = foward || [
			Math.cos(yaw) * Math.cos(pitch),
			Math.sin(yaw) * Math.cos(pitch),
			Math.sin(pitch)];
		this.view = mat4.create();
		mat4.lookAt(this.view, this.pos,
			Vec3.add(this.pos, this.foward),
			Vec3.z);
	}

	// Define 'Camera' methods.
	(function() {
		
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
	
	// Describes a selection box for an editor. The selection box covers a
	// volume aligned to a cubic grid of a given scale. It is possible for a
	// selection box to extend infinitely in one or more directions.
	function Box(bounds, scale) {
		this.bounds = bounds;
		this.scale = scale;
	}
	
	// Describes an edit plane for an editor. An edit plane is a "slice" of a
	// a selection box that can be "painted" on. Edits made on the plane will
	// extend a certain distance behind the plane, dictated by the plane's "depth".
	function Plane(box, axis, min, max, flip) {
		this.box = box;
		this.axis = axis;
		this.min = min;
		this.max = max;
		this.flip = flip;
		this.pos = flip ? max : min;
	}
	
	// Define 'Plane' methods.
	(function() {
	
		// Gets the bounds for the block at the given (2d) position on this plane, 
		// returning null if the position is outside the bounds of this plane.
		this.prototype.getBlock = function(pos) {
			var scale = this.box.scale;
			var bounds = this.box.bounds;
			var pMin = Vec2.align(pos, scale);
			var bpMin = Vec3.proj(bounds.min, this.axis);
			var bpMax = Vec3.proj(bounds.max, this.axis);
			if (pMin[0] >= bpMin[0] && pMin[1] >= bpMin[1] && pMin[0] < bpMax[0] && pMin[1] < bpMax[1]) {
				var pMax = Vec2.add(pMin, [scale, scale]);
				var min = Vec3.unproj(pMin, this.axis, this.min);
				var max = Vec3.unproj(pMax, this.axis, this.max);
				return new Volume.Bound(min, max);
			} else return null;
		}

	}).call(Plane);
	
	// Creates a mesh for a line grid. The mesh is on the XY plane, and each square
	// on the grid is 1 by 1. The lines have a width of 1.
	function lineGridMesh(x, y) {
		return Mesh.createBuilder(Mesh.Mode.Triangles, 5, {
			pos : { size : 2, offset : 0 },
			dir : { size : 2, offset : 2 },
			offset : { size : 1, offset : 4 }
		}, function(builder) {
			for (var i = 0; i <= x; i++) {
				builder.line([i, 0], [i, y], 0.5, [0, 1]);
			}
			for (var j = 0; j <= y; j++) {
				builder.line([0, j], [x, j], 0.5, [1, 0]);
			}
		});
	}
	
	// Contains three matrices which, when applied to a line grid,
	// will rotate it so that its normal is along the axis corresponding
	// to the matrix index.
	var permuteMatrices = [
		[0, 1, 0, 0,
		 0, 0, 1, 0,
		 1, 0, 0, 0,
		 0, 0, 0, 1],
		[0, 0, 1, 0,
		 1, 0, 0, 0,
		 0, 1, 0, 0,
		 0, 0, 0, 1],
		[1, 0, 0, 0,
		 0, 1, 0, 0,
		 0, 0, 1, 0,
		 0, 0, 0, 1]];
		 
	// Load programs.
	var lineProgram, blockProgram;
	delay(Program.Line.color, function(program) {
		lineProgram = program;
	}, resources);
	delay(Program.Block.color, function(program) {
		blockProgram = program;
	}, resources);
		 
	// Creates and returns a function to draw a selection box.
	function prepareDrawBox(gl, box) {
		var drawCube = Mesh.Line.cube.get(gl);
		var bounds = box.bounds;
		var model = mat4.create();
		mat4.identity(model);
		mat4.translate(model, model, bounds.min);
		mat4.scale(model, model, Vec3.sub(bounds.max, bounds.min));
		var scale = box.scale;
		var program = lineProgram.get(gl);
		return function(view, eyePos) {
			gl.useProgram(program);
			gl.uniform4f(program.color, 0.4, 0.4, 0.4, 1.0);
			gl.uniform1f(program.scale, scale * 0.04);
			gl.uniformMatrix4fv(program.model, false, model);
			gl.uniformMatrix4fv(program.view, false, view);
			gl.uniform3fv(program.eyePos, eyePos);
			drawCube(program);
		}
	}
	
	// Creates and returns a function to draw a selection plane.
	function prepareDrawPlane(gl, plane) {
		var bounds = plane.box.bounds;
		var scale = plane.box.scale;
		var axis = plane.axis;
		var basePos = Vec3.proj(bounds.min, axis);
		var size = Vec2.sub(Vec3.proj(bounds.max, axis), basePos);
		var primaryPos = Vec3.unproj(basePos, axis, plane.flip ? plane.max : plane.min);
		var secondaryPos = Vec3.unproj(basePos, axis, plane.flip ? plane.min : plane.max);
		var width = size[0] / scale;
		var height = size[1] / scale;
		var drawGrid = lineGridMesh(width, height).create(gl);
		var drawSquare = Mesh.Line.square.get(gl);
		
		var primary = mat4.create();
		mat4.identity(primary);
		mat4.translate(primary, primary, primaryPos);
		mat4.scale(primary, primary, [scale, scale, scale]);
		mat4.multiply(primary, primary, permuteMatrices[axis]);
		
		var secondary = mat4.create();
		mat4.identity(secondary);
		mat4.translate(secondary, secondary, secondaryPos);
		mat4.scale(secondary, secondary, [scale, scale, scale]);
		mat4.multiply(secondary, secondary, permuteMatrices[axis]);
		mat4.scale(secondary, secondary, [width, height, 1.0]);
		
		var program = lineProgram.get(gl);
		return function(view, eyePos) {
			gl.useProgram(program);
			gl.uniformMatrix4fv(program.view, false, view);
			gl.uniform3fv(program.eyePos, eyePos);
			
			gl.uniform4f(program.color, 0.1, 0.6, 0.9, 1.0);
			gl.uniform1f(program.scale, scale * 0.07);
			gl.uniformMatrix4fv(program.model, false, primary);
			drawGrid(program);
			
			gl.uniform4f(program.color, 0.4, 0.4, 0.4, 1.0);
			gl.uniform1f(program.scale, scale * 0.04);
			gl.uniformMatrix4fv(program.model, false, secondary);
			drawSquare(program);
		}
	}
	
	// Creates and returns a function to draw a selection block.
	function prepareDrawBlock(gl, bounds) {
		var drawCube = Mesh.Block.cube.get(gl);
		var model = mat4.create();
		mat4.identity(model);
		mat4.translate(model, model, bounds.min);
		mat4.scale(model, model, Vec3.sub(bounds.max, bounds.min));
		var program = blockProgram.get(gl);
		return function(view) {
			gl.useProgram(program);
			gl.uniform4f(program.color, 0.7, 0.7, 0.7, 0.5);
			gl.uniformMatrix4fv(program.model, false, model);
			gl.uniformMatrix4fv(program.view, false, view);
			gl.enable(gl.BLEND);
			gl.disable(gl.DEPTH_TEST);
			gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
			drawCube(program);
			gl.disable(gl.BLEND);
			gl.enable(gl.DEPTH_TEST);
		}
	}

	// Creates an editor interface for a canvas.
	this.create = function(canvas, node, undo) {
		var gl = createGLContext(canvas);
		var camera = new Camera([0.0, 0.15, 0.0], 0.0, -0.8); 
		var scene = new Render.Scene();
		var renderer = new Render.Direct(Volume, scene.pushMatterLeaf.bind(scene));
		renderer.set(node);
		scene.flush(gl);
		
		var t = 1.0 / (1 << 7);
		var box = new Box(new Volume.Bound(
			[10 * t, 10 * t, -20 * t],
			[30 * t, 30 * t, -16 * t]), t);
		var plane = new Plane(box, 2, -19 * t, -17 * t, true);
		var block = new Volume.Bound([12 * t, 25 * t, -19 * t], [13 * t, 26 * t, -17 * t]);
		var drawBox = prepareDrawBox(gl, box);
		var drawPlane = prepareDrawPlane(gl, plane);
		var drawBlock = prepareDrawBlock(gl, block);
		
		// Gets the current viewProj matrix.
		function getViewProj() {
			var proj = mat4.create();
			var viewProj = mat4.create();
			mat4.perspective(proj, 45, canvas.width / canvas.height, 0.001, 2.0);
			mat4.multiply(viewProj, proj, camera.view);
			return viewProj;
		}
		
		// Handle mouse picking.
		Event.register(canvas, 'mousemove', function(event) {
			var x = event.clientX;
			var y = event.clientY;
			x = x * 2.0 / canvas.width - 1.0;
			y = 1.0 - y * 2.0 / canvas.height;
			
			var viewProj = getViewProj();
			var iViewProj = mat4.create();
			mat4.invert(iViewProj, viewProj);
			
			var pos = [x, y, 0, 1];
			vec4.transformMat4(pos, pos, iViewProj);
			pos = Vec3.scale(pos, 1.0 / pos[3]);
			
			var dir = [x, y, 1, 1];
			vec4.transformMat4(dir, dir, iViewProj);
			dir = Vec3.scale(dir, 1.0 / dir[3]);
			dir = Vec3.normalize(Vec3.sub(dir, pos));
			
			var res = Volume.intersectPlane(plane.axis, plane.pos, pos, dir);
			var nBlock = plane.getBlock(res);
			if (nBlock) {
				block = plane.getBlock(res);
				drawBlock = prepareDrawBlock(gl, block);
			}
		});
		
		// Drawing.
		Input.Trigger.mouseButton(0, true).register(canvas, function() {
			node = node.splice(block, Gol.getMatter.live);
			renderer.update(node);
			scene.flush(gl);
		});
			
		// Render the editor view.
		gl.enable(gl.CULL_FACE);
		gl.enable(gl.DEPTH_TEST);
		Callback.register(Callback.render, function() {
			gl.viewport(0, 0, canvas.width, canvas.height);
			gl.clearColor(0.0, 0.0, 0.0, 1.0);
			gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
			
			var viewProj = getViewProj();
			var scale = 1.0 / (1 << node.depth);
			scene.render(gl, viewProj, scale);
			drawBlock(viewProj);
			drawBox(viewProj, camera.pos);
			drawPlane(viewProj, camera.pos);
		}, undo);
		
		// Handle movement/update.
		var getMovement = Input.Signal.wasd.link(canvas);
		var maxDis = 0.5;
		var minDis = 0.001;
		var lastDis = 0.0;
		Callback.register(Callback.update, function(delta) {

			// Move camera along its plane.
			var cameraMove = getMovement();
			if (cameraMove) {
				var cameraMoveScale =  0.8 * (lastDis + 0.05) * delta;
				camera = camera.move(Vec2.scale(cameraMove, cameraMoveScale));
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
		
		// Camera rotatation.
		Input.Trigger.mouseDrag(
			Input.Trigger.mouseButton(2, true),
			Input.Trigger.mouseButton(2, false))
		.register(canvas, function(rotate) {
			var scale = 0.003;
			camera = camera.rotate(Vec2.scale(rotate, scale), Math.PI * 0.9);
		});
	}
	
	// Define exports.
	this.resources = Promise.join(resources);
	this.Camera = Camera;
	this.lineGridMesh = lineGridMesh;
};