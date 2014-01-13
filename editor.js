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
	}
	
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
		var drawLineCube = Mesh.lineCube.get(gl);
		var bounds = box.bounds;
		var model = mat4.create();
		mat4.identity(model);
		mat4.translate(model, bounds.min);
		mat4.scale(model, Vec3.sub(bounds.max, bounds.min));
		var scale = box.scale;
		var program = Program.Line.color.value.get(gl);
		return function(view, eyePos) {
			gl.useProgram(program);
			gl.uniform4f(program.color, 0.4, 0.4, 0.4, 1.0);
			gl.uniform1f(program.scale, scale * 0.04);
			gl.uniformMatrix4fv(program.model, false, model);
			gl.uniformMatrix4fv(program.view, false, view);
			gl.uniform3fv(program.eyePos, eyePos);
			drawLineCube(program);
		}
	}
	
	// Creates and returns a function to draw a selection plane.
	function prepareDrawPlane(gl, plane) {
		var bounds = plane.box.bounds;
		var scale = plane.box.scale;
		var axis = plane.axis;
		var size = Vec2.sub(Vec3.proj(bounds.max, axis), Vec3.proj(bounds.min, axis));
		var minPos = Vec3.unproj(Vec3.proj(bounds.min, axis), axis, plane.min);
		var width = size[0] / scale;
		var height = size[1] / scale;
		var drawGrid = lineGridMesh(width, height).create(gl);
		
		var permute = mat4.create();
		mat3.toMat4(permuteMatrices[axis], permute);
		var primary = mat4.create();
		mat4.identity(primary);
		mat4.translate(primary, minPos);
		mat4.scale(primary, [scale, scale, scale]);
		mat4.multiply(primary, permute);
		
		var secondary = mat4.create();
		mat4.set(primary, secondary);
		mat4.translate(secondary, [0, 0, (plane.max - plane.min) / scale]);
		
		if (plane.flip) {
			var temp = primary;
			primary = secondary;
			secondary = temp;
		}
		
		var program = Program.Line.color.value.get(gl);
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
			drawGrid(program);
		}
	}

	// Creates an editor interface for a canvas.
	this.create = function(canvas, node, undo) {
		var gl = createGLContext(canvas);
		var camera = new Camera([-0.5, 0.0, 0.6], 0.0, -0.5); 
		var scene = new Render.Scene();
		var renderer = new Render.Direct(Volume, scene.pushMatterLeaf.bind(scene));
		renderer.set(node);
		scene.flush(gl);
		
		var t = 1.0 / (1 << 7);
		var box = new Box(new Volume.Bound(
			[10 * t, 10 * t, -20 * t],
			[30 * t, 30 * t, -16 * t]), t);
		var plane = new Plane(box, 2, -18 * t, -17 * t, true);
		var drawBox = prepareDrawBox(gl, box);
		var drawPlane = prepareDrawPlane(gl, plane);
			
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
			drawPlane(view, camera.pos);
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
			camera = camera.rotate(Vec2.scale(rotate, scale), Math.PI * 0.4);
		});
	}
	
	// Declare dependencies.
	this.dependencies = [Program.Line.color];
	
	// Define exports.
	this.Camera = Camera;
	this.lineGridMesh = lineGridMesh;
};