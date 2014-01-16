// An interface to a 3D scene editor which attaches to
// a canvas element.
function Editor(canvas, node, undo) {
	this.canvas = canvas;
	this.gl = createGLContext(canvas);
	this.node = node;
	this.camera = new Editor.Camera([0.0, 0.15, 0.0], 0.0, -0.8); 
	this.scene = new Render.Scene();
	this.renderer = new Render.Direct(Volume, this.scene.pushMatterLeaf.bind(this.scene));
	this.renderer.set(node);
	this.scene.flush(this.gl);
	this.getMovement = Input.Signal.wasd.link(canvas);
	this.maxDis = 0.5;
	this.minDis = 0.001;
	this.lastDis = 0.0;
	this.control = null;
	this.dragHandler = null;
	
	var t = 1.0 / (1 << 7);
	this.boxes = [new Editor.Box(new Volume.Bound(
		[0 * t, 0 * t, -20 * t],
		[40 * t, 40 * t, -16 * t]), t)];
	this.plane = new Editor.Plane(this.boxes[0], 2, -19 * t, -17 * t, true);
	
	this.renderPlane = null;
	this.renderPlaneFor = null;
	
	var editor = this;
	Event.register(canvas, 'mousemove', function(event) {
		var x = event.clientX;
		var y = event.clientY;
		if (editor.dragHandler) {
			editor.dragHandler.update(editor, editor.projectPoint(x, y));
		} else {
			editor.control = editor.select(x, y);
		}
	});
	
	Input.Trigger.mouseButton(0, true).register(canvas, function() {
		if (!editor.dragHandler) {
			if (editor.control) {
				editor.dragHandler = editor.control.begin(editor);
			} else {
				editor.dragHandler = Editor.DragHandler.none;
			}
		}
	});
	
	Input.Trigger.mouseButton(0, false).register(canvas, function() {
		if (editor.dragHandler) {
			editor.dragHandler.end(editor);
			editor.dragHandler = null;
		}
	});
		
	Callback.register(Callback.render, function() {
		editor.render();
	}, undo);
	
	Callback.register(Callback.update, function(delta) {
		editor.update(delta);
	});
	
	Input.Trigger.mouseDrag(
		Input.Trigger.mouseButton(2, true),
		Input.Trigger.mouseButton(2, false))
	.register(canvas, function(rotate) {
		var scale = 0.003;
		editor.camera = editor.camera.rotate(Vec2.scale(rotate, scale), Math.PI * 0.4);
	});
}

// Define 'Editor' functions and types.
(function() {

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
	
		// Gets the (2d) bounds for the block at the given (2d) position on this plane, 
		// returning null if the position is outside the bounds of this plane.
		this.prototype.getBlock = function(pos) {
			var scale = this.box.scale;
			var pBounds = this.box.bounds.proj(this.axis);
			var pMin = Vec2.align(pos, scale);
			var pMax = Vec2.add(pMin, [scale, scale]);
			var pBlock = new Area.Bound(pMin, pMax);
			return pBounds.contains(pBlock) ? pBlock : null;
		}
		
		// Projects a block on this plane, described by its 2d bounds, into 3d space.
		this.prototype.unprojBlock = function(block) {
			return block.unproj(this.axis, this.min, this.max);
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
	
	// Creates and returns a function to render a selection plane.
	function prepareRenderPlane(gl, plane) {
		var bounds = plane.box.bounds;
		var scale = plane.box.scale;
		var axis = plane.axis;
		var pBounds = bounds.proj(axis);
		var pBasePos = pBounds.min;
		var size = pBounds.getSize();
		var primaryPos = Vec3.unproj(pBasePos, axis, plane.flip ? plane.max : plane.min);
		var secondaryPos = Vec3.unproj(pBasePos, axis, plane.flip ? plane.min : plane.max);
		var width = size[0] / scale;
		var height = size[1] / scale;
		
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
		var gridMesh = lineGridMesh(width, height).create(gl);
		var squareMesh = Mesh.Line.square.get(gl);
		return function(view, eyePos) {
			gl.render(program, gridMesh, {
				color : [0.1, 0.6, 0.9, 1.0],
				scale : scale * 0.07,
				model : primary,
				view : view, // TODO: Rename view uniforms to viewProj
				eyePos : eyePos });
			gl.render(program, squareMesh, {
				color : [0.4, 0.4, 0.4, 1.0],
				scale : scale * 0.04,
				model : secondary,
				view : view,
				eyePos : eyePos });
		}
	}
	
	// Renders a selection box.
	function renderBox(gl, box, view, eyePos) {
		var bounds = box.bounds;
		var model = mat4.create();
		mat4.identity(model);
		mat4.translate(model, model, bounds.min);
		mat4.scale(model, model, Vec3.sub(bounds.max, bounds.min));
		var scale = box.scale;
		var program = lineProgram.get(gl);
		var mesh = Mesh.Line.cube.get(gl);
		gl.render(program, mesh, {
			color : [0.4, 0.4, 0.4, 1.0],
			scale : [scale * 0.04],
			model : model,
			view : view,
			eyePos : eyePos });
	}
	
	// Renders a selection block.
	function renderBlock(gl, bounds, view) {
		var model = mat4.create();
		mat4.identity(model);
		mat4.translate(model, model, bounds.min);
		mat4.scale(model, model, bounds.getSize());
		var program = blockProgram.get(gl);
		var mesh = Mesh.Block.cube.get(gl);
		gl.enable(gl.BLEND);
		gl.disable(gl.DEPTH_TEST);
		gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
		gl.render(program, mesh, {
			color : [0.7, 0.7, 0.7, 0.5],
			model : model,
			view : view });
		gl.disable(gl.BLEND);
		gl.enable(gl.DEPTH_TEST);
	}
	
	// Gives feedback and modifies the editor while the mouse is dragged from a control.
	function DragHandler() { }
	
	// Define 'DragHandler' methods and sub-types.
	(function() {
	
		// Renders an indicator for this drag handler.
		this.prototype.renderIndicator = function(editor, gl, viewProj) { }
		
		// Updates this drag handler in response to a mouse movement. The mouse
		// state is given by a ray.
		this.prototype.update = function(editor, ray) { }
		
		// Notifies the drag handler that mouse drag has ended. This applies the 
		// changes made by dragging.
		this.prototype.end = function(editor) { }
		
		// A drag handler that does nothing.
		var none = new DragHandler();
		
		// A drag handler for painting.
		function Paint(blocks) {
			this.blocks = blocks;
		}
		
		// Define 'Paint' methods and sub-types.
		(function() {
			this.prototype = Object.create(DragHandler.prototype);
			this.prototype.renderIndicator = function(editor, gl, viewProj) {
				for (var i = 0; i < this.blocks.length; i++) {
					renderBlock(gl, editor.plane.unprojBlock(this.blocks[i]), viewProj);
				}
			}
			this.prototype.update = function(editor, ray) {
				var plane = editor.plane;
				var res = Volume.intersectPlane(plane.axis, plane.pos, ray.pos, ray.dir);
				if (res) {
					var block = editor.plane.getBlock(res);
					if (block) {
						this.updateBlock(editor.plane.box.scale, block);
					}
				}
			}
			this.prototype.end = function(editor) {
				var node = editor.node;
				for (var i = 0; i < this.blocks.length; i++) {
					var pBlock = editor.plane.unprojBlock(this.blocks[i]);
					node = node.splice(pBlock, Gol.getMatter.live);
				}
				editor.setNode(node);
			}
			
			// Updates this paint drag handler when a new block is being dragged over.
			this.prototype.updateBlock = function(block) { }
			
			// A paint drag handler that fills a rectangular area.
			function Fill(start) {
				Paint.call(this, [start]);
				this.start = start;
			}
			
			// Define 'Fill' methods.
			(function() {
				this.prototype = Object.create(Paint.prototype);
				this.prototype.updateBlock = function(scale, end) {
					this.blocks[0] = Area.Bound.union(this.start, end);
				}
			}).call(Fill);
			
			// Gets the array of blocks that make up the line between the given blocks
			// (which must be squares of the given scale).
			function lineBlocks(scale, from, to) {
				var up = (from.min[0] > to.min[0]) == (from.min[1] > to.min[1]);
				var area = Area.Bound.union(from, to);
				var size = area.getSize();
				var dep, idep;
				if (size[0] >= size[1]) {
					dep = 0;
					idep = 1;
				} else {
					dep = 1;
					idep = 0;
				}
				var a = area.min[dep];
				var b = up ? area.min[idep] : area.max[idep];
				var res = new Array(size[idep] / scale);
				for (var i = 0; i < res.length; i++) {
					var na = Math.round((area.min[dep] + size[dep] * (i + 1) / res.length) / scale) * scale;
					var nb = up ? (b + scale) : (b - scale);
					var min = new Array(2);
					var max = new Array(2);
					min[dep] = a; min[idep] = Math.min(b, nb);
					max[dep] = na; max[idep] = Math.max(b, nb);
					a = na; b = nb;
					res[i] = new Area.Bound(min, max);
				}
				return res;
			}
			
			// A paint drag handler that fills a rectangular area.
			function Line(start) {
				Paint.call(this, [start]);
				this.start = start;
			}
			
			// Define 'Fill' methods.
			(function() {
				this.prototype = Object.create(Paint.prototype);
				this.prototype.updateBlock = function(scale, end) {
					this.blocks = lineBlocks(scale, this.start, end);
				}
			}).call(Line);
			
			// Define exports.
			this.Fill = Fill;
			this.lineBlocks = lineBlocks;
			this.Line = Line;
		}).call(Paint);
	
		// Define exports.
		this.none = none;
		this.Paint = Paint;
	}).call(DragHandler);
	
	// Identifies an object in the editor that can be selected, dragged or painted.
	function Control() { }
	
	// Define 'Control' methods and sub-types.
	(function() {
	
		// Renders an indicator for when this control is selected.
		this.prototype.renderIndicator = function(editor, gl, viewProj) { }
		
		// Begins a mouse drag starting at this control. This function
		// should return a drag handler.
		this.prototype.begin = function(editor) { return DragHandler.none; }
		
		// A control for painting.
		function Paint(block) {
			this.block = block;
		}
		
		// Define 'Paint' methods.
		(function() {
			this.prototype = Object.create(Control.prototype);
			this.prototype.renderIndicator = function(editor, gl, viewProj) {
				renderBlock(gl, editor.plane.unprojBlock(this.block), viewProj);
			}
			this.prototype.begin = function(editor) {
				return new DragHandler.Paint.Line(this.block);
			}
		}).call(Paint);
		
		// Define exports.
		this.Paint = Paint;
	}).call(Control);
	
	// Sets the node for this editor.
	this.prototype.setNode = function(node) {
		this.node = node;
		this.renderer.update(node);
		this.scene.flush(this.gl);
	}
	
	// Gets the current viewProj matrix for this editor.
	this.prototype.getViewProj = function() {
		var proj = mat4.create();
		var viewProj = mat4.create();
		mat4.perspective(proj, 45, this.canvas.width / this.canvas.height, 0.001, 2.0);
		mat4.multiply(viewProj, proj, this.camera.view);
		return viewProj;
	}
	
	// Gets the ray (an object with 'pos' and 'dir') projected from the point
	// at the given pixel coordinates in the canvas of this editor.
	this.prototype.projectPoint = function(x, y) {
		x = x * 2.0 / this.canvas.width - 1.0;
		y = 1.0 - y * 2.0 / this.canvas.height;
		
		var viewProj = this.getViewProj();
		var iViewProj = mat4.create();
		mat4.invert(iViewProj, viewProj);
		
		var pos = [x, y, 0, 1];
		vec4.transformMat4(pos, pos, iViewProj);
		pos = Vec3.scale(pos, 1.0 / pos[3]);
		
		var dir = [x, y, 1, 1];
		vec4.transformMat4(dir, dir, iViewProj);
		dir = Vec3.scale(dir, 1.0 / dir[3]);
		dir = Vec3.normalize(Vec3.sub(dir, pos));
		return { pos : pos, dir : dir };
	}
	
	// Gets the control for the object at the given coordinates in this editor.
	// Returns null if there is no selectable object at the coordinates.
	this.prototype.select = function(x, y) {
		var ray = this.projectPoint(x, y);
		var res = Volume.intersectPlane(this.plane.axis, this.plane.pos, ray.pos, ray.dir);
		if (res) {
			var pBlock = this.plane.getBlock(res);
			if (pBlock) {
				return new Control.Paint(pBlock);
			}
		}
		return null;
	}
	
	// Renders the editor view.
	this.prototype.render = function() {
		var gl = this.gl;
		gl.enable(gl.CULL_FACE);
		gl.enable(gl.DEPTH_TEST);
		gl.viewport(0, 0, this.canvas.width, this.canvas.height);
		gl.clearColor(0.0, 0.0, 0.0, 1.0);
		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
		
		var viewProj = this.getViewProj();
		this.scene.render(gl, viewProj);
		if (this.dragHandler) {
			this.dragHandler.renderIndicator(this, gl, viewProj);
		} else if (this.control) {
			this.control.renderIndicator(this, gl, viewProj);
		}
		for (var i = 0; i < this.boxes.length; i++)
			renderBox(gl, this.boxes[i], viewProj, this.camera.pos);
		if (this.renderPlaneFor != this.plane) {
			this.renderPlane = prepareRenderPlane(gl, this.plane);
			this.renderPlaneFor = this.plane;
		}
		this.renderPlane(viewProj, this.camera.pos);
	}
	
	// Updates the editor.
	this.prototype.update = function(delta) {
	
		// Move camera along its plane.
		var cameraMove = this.getMovement();
		if (cameraMove) {
			var cameraMoveScale = 0.8 * (this.lastDis + 0.05) * delta;
			this.camera = this.camera.move(Vec2.scale(cameraMove, cameraMoveScale));
		}
	
		// Compute camera distance from matter in the scene.
		function pred(node) { return node !== Matter.empty; }
		for (var i = 0; i < 3; i++) {
			var near = Volume.nearTransformed(pred, this.node, 1.0, [0.0, 0.0, 0.0], this.camera.pos, this.maxDis);
			this.lastDis = near ? near.dis : this.maxDis;
			if (near && near.dis < this.minDis) {
				this.camera.pos = Vec3.add(this.camera.pos, Vec3.scale(near.norm, minDis - near.dis));
			} else break;
		}
	}
	
	// Define exports.
	this.resources = Promise.join(resources);
	this.Camera = Camera;
	this.Box = Box;
	this.Plane = Plane;
	this.DragHandler = DragHandler;
	this.Control = Control;
}).call(Editor);