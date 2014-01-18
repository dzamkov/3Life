// An interface to a 3D scene editor which attaches to
// a canvas element.
function Editor(canvas, node, undo) {
	this.canvas = canvas;
	this.gl = createGLContext(canvas);
	this.node = node;
	this.camera = new Editor.Camera([0.4, 0.5, 0.6], 0.0, -0.8); 
	this.renderNode = function() { }
	this.getMovement = Input.Signal.wasd.link(canvas);
	this.maxDis = 0.5;
	this.minDis = 0.001;
	this.lastDis = 0.0;
	this.control = null;
	this.dragHandler = null;
	
	var t = 1.0 / (1 << 7);
	this.boxes = [new Editor.Box(new Volume.Bound(
		[56 * t, 56 * t, 56 * t],
		[72 * t, 72 * t, 72 * t]), t)];
	this.plane = new Editor.Plane(this.boxes[0], 2, 64 * t, 63 * t);
	
	this.renderPlane = null;
	this.renderPlaneFor = null;
	
	var editor = this;
	var point = [0, 0];
	Event.register(canvas, 'mousemove', function(event) {
		point = [event.clientX, event.clientY];
		if (editor.dragHandler) {
			editor.dragHandler.update(editor, point);
		} else {
			editor.control = editor.select(point);
		}
	});
	
	Input.Trigger.mouseButton(0, true).register(canvas, function() {
		if (!editor.dragHandler) {
			if (editor.control) {
				editor.dragHandler = editor.control.begin(editor, point);
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
	function Box(bound, scale) {
		this.bound = bound;
		this.scale = scale;
	}
	
	// Define 'Box' methods.
	(function() {
	
		// Sets the bound for this box.
		this.prototype.setBound = function(bound) {
			return new Box(bound, this.scale);
		}
	
	}).call(Box);
	
	// Describes an edit plane for an editor. An edit plane is made up of two
	// parallel slices of a selection boxes. The "leading" slice can be painted
	// on to make edits that extend to the "trailing" slice.
	function Plane(box, axis, lead, trail) {
		this.box = box;
		this.axis = axis;
		this.lead = lead;
		this.trail = trail;
	}
	
	// Define 'Plane' methods.
	(function() {
	
		// Gets the (2d) bounds for the block at the given (2d) position on this plane, 
		// returning null if the position is outside the bounds of this plane.
		this.prototype.getBlock = function(pos) {
			var scale = this.box.scale;
			var pBounds = this.box.bound.proj(this.axis);
			var pMin = Vec2.align(pos, scale);
			var pMax = Vec2.add(pMin, [scale, scale]);
			var pBlock = new Area.Bound(pMin, pMax);
			return pBounds.contains(pBlock) ? pBlock : null;
		}
		
		// Projects a block on this plane, described by its 2d bounds, into 3d space.
		this.prototype.unprojBlock = function(block) {
			return block.unproj(this.axis,
				Math.min(this.lead, this.trail),
				Math.max(this.lead, this.trail));
		}

		// Sets the box for this plane, automatically adjusting the
		// position of its slices if they are out of the bound.
		this.prototype.setBox = function(box) {
			var bMin = box.bound.min[this.axis];
			var bMax = box.bound.max[this.axis];
			var lead = Math.min(bMax, Math.max(bMin, this.lead));
			var trail = Math.min(bMax, Math.max(bMin, this.trail));
			if (lead == trail) {
				if (lead == bMin) {
					if (this.lead > this.trail) lead = bMin + box.scale;
					else trail = bMin + box.scale;
				} else { // lead == bMax
					if (this.lead > this.trail) trail = bMax - box.scale;
					else lead = bMax - box.scale;
				}
			}
			return new Plane(box, this.axis, lead, trail);
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
		var scale = plane.box.scale;
		var axis = plane.axis;
		var pBound = plane.box.bound.proj(axis);
		var pBasePos = pBound.min;
		var size = pBound.getSize();
		var leadPos = Vec3.unproj(pBasePos, axis, plane.lead);
		var trailPos = Vec3.unproj(pBasePos, axis, plane.trail);
		var width = size[0] / scale;
		var height = size[1] / scale;
		
		var lead = mat4.create();
		mat4.identity(lead);
		mat4.translate(lead, lead, leadPos);
		mat4.scale(lead, lead, [scale, scale, scale]);
		mat4.multiply(lead, lead, permuteMatrices[axis]);
		
		var trail = mat4.create();
		mat4.identity(trail);
		mat4.translate(trail, trail, trailPos);
		mat4.scale(trail, trail, [scale, scale, scale]);
		mat4.multiply(trail, trail, permuteMatrices[axis]);
		mat4.scale(trail, trail, [width, height, 1.0]);
		
		var program = lineProgram.get(gl);
		var gridMesh = lineGridMesh(width, height).create(gl);
		var squareMesh = Mesh.Line.square.get(gl);
		return function(view, eyePos) {
			gl.render(program, gridMesh, {
				color : [0.1, 0.6, 0.9, 1.0],
				scale : scale * 0.06,
				model : lead,
				view : view, // TODO: Rename view uniforms to viewProj
				eyePos : eyePos });
			gl.render(program, squareMesh, {
				color : [0.4, 0.4, 0.4, 1.0],
				scale : scale * 0.04,
				model : trail,
				view : view,
				eyePos : eyePos });
		}
	}
	
	// Renders a selection box.
	function renderBox(gl, box, view, eyePos) {
		var bound = box.bound;
		var model = mat4.create();
		mat4.identity(model);
		mat4.translate(model, model, bound.min);
		mat4.scale(model, model, Vec3.sub(bound.max, bound.min));
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
		// position is given as a 2d vector in pixel coordinates.
		this.prototype.update = function(editor, point) { }
		
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
			this.prototype.update = function(editor, point) {
				var plane = editor.plane;
				var ray = editor.unproj(point);
				var res = Volume.tracePlane(plane.axis, plane.lead, ray.pos, ray.dir);
				if (res) {
					var block = editor.plane.getBlock(res.param);
					if (block) {
						this.updateBlock(editor.plane.box.scale, block);
					}
				}
			}
			this.prototype.end = function(editor) {
				var node = editor.node;
				for (var i = 0; i < this.blocks.length; i++) {
					var pBlock = editor.plane.unprojBlock(this.blocks[i]);
					node = node.splice(pBlock, editor.getDrawNode());
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
		
		// A drag handler for a moving a corner of a selection box.
		function Box(startPoint, startPos, boxIndex, cornerIndex) {
			this.startPoint = startPoint;
			this.startPos = startPos;
			this.boxIndex = boxIndex;
			this.cornerIndex = cornerIndex;
			this.axis = null;
		}
		
		// Define 'Box' methods.
		(function() {
			this.prototype = Object.create(DragHandler.prototype);
			this.prototype.update = function(editor, point) {
				var axis = this.axis;
				if (axis === null) {
					var compass = editor.projCompass(this.startPos);
					var delta = Vec2.sub(point, this.startPoint);
					var best = 0.0;
					for (var i = 0; i < 3; i++) {
						var len = Vec2.len(compass[i]);
						var val = Math.abs(Vec2.dot(compass[i], delta)) / len;
						if (val >= best) {
							axis = i;
							best = val;
						}
					}
				}
				
				// TODO: Prevent inverting the box.
				
				var axisDir = Vec3.getUnit(axis, false);
				var ray = editor.unproj(point);
				var param = Volume.traceLine(this.startPos,
					axisDir, ray.pos, ray.dir).aParam;
				var box = editor.boxes[this.boxIndex];
				var scale = box.scale;
				param = Math.round(param / scale) * scale;
				var nPoint = Vec3.add(this.startPos, Vec3.scale(axisDir, param));
				if (nPoint[axis] != this.startPos[axis]) this.axis = axis;
				var nBox = box.setBound(box.bound.setCorner(this.cornerIndex, nPoint));
				var plane = editor.plane;
				if (plane && plane.box == box) {
					editor.plane = plane.setBox(nBox);
				}
				editor.boxes[this.boxIndex] = nBox;
			}
			this.prototype.end = function(editor) { }
		}).call(Box);
		
		// A drag handler for adjusting the position of an edit plane.
		function Plane(box, axis, lead, pPos) {
			this.box = box;
			this.axis = axis;
			this.lead = lead;
			this.pPos = pPos;
		}
		
		// Define 'Plane' methods.
		(function() {
			this.prototype = Object.create(DragHandler.prototype);
			this.prototype.update = function(editor, point) {
				var ray = editor.unproj(point);
				var aPos = Vec3.unproj(this.pPos, this.axis, 0.0);
				var aDir = Vec3.getUnit(this.axis, false);
				var res = Volume.traceLine(aPos, aDir, ray.pos, ray.dir);
				var param = Math.round(res.aParam / this.box.scale) * this.box.scale;
				var bound = this.box.bound;
				param = Math.min(bound.max[this.axis], Math.max(bound.min[this.axis], param));
				var plane = editor.plane;
				if (this.lead) {
					if (param != plane.trail) {
						editor.plane = new Editor.Plane(plane.box, this.axis, param, plane.trail);
					}
				} else {
					if (param != plane.lead) {
						editor.plane = new Editor.Plane(plane.box, this.axis, plane.lead, param);
					}
				}
			}
		}).call(Plane);
		
		// Define exports.
		this.none = none;
		this.Paint = Paint;
		this.Box = Box;
		this.Plane = Plane;
	}).call(DragHandler);
	
	// Identifies an object in the editor that can be selected, dragged or painted.
	function Control() { }
	
	// Define 'Control' methods and sub-types.
	(function() {
	
		// Renders an indicator for when this control is selected.
		this.prototype.renderIndicator = function(editor, gl, viewProj) { }
		
		// Begins a mouse drag starting at this control.  The mouse
		// position is given as a 2d vector in pixel coordinates.
		this.prototype.begin = function(editor, point) { return DragHandler.none; }
		
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
			this.prototype.begin = function(editor, point) {
				return new DragHandler.Paint.Line(this.block);
			}
		}).call(Paint);
		
		// A control for adjusting the size and volume of a selection box.
		function Box(boxIndex, cornerIndex) {
			this.boxIndex = boxIndex;
			this.cornerIndex = cornerIndex;
		}
		
		// Define 'Box' methods.
		(function() {
			this.prototype = Object.create(Control.prototype);
			this.prototype.renderIndicator = function(editor, gl, viewProj) {
				var box = editor.boxes[this.boxIndex];
				var pos = box.bound.getCorner(this.cornerIndex);
				var rad = box.scale * 0.5;
				var dif = [rad, rad, rad];
				var bound = new Volume.Bound(Vec3.sub(pos, dif), Vec3.add(pos, dif));
				renderBlock(gl, bound, viewProj);
			}
			this.prototype.begin = function(editor, point) { 
				var pos = editor.boxes[this.boxIndex].bound.getCorner(this.cornerIndex);
				return new DragHandler.Box(point, pos, this.boxIndex, this.cornerIndex);
			}
		}).call(Box);
		
		// A control for adjusting or setting an edit plane.
		function Plane(box, axis, pPos, param) {
			this.box = box;
			this.axis = axis;
			this.pPos = pPos;
			this.param = param;
		}
		
		// Define 'Plane' methods.
		(function() {
			this.prototype = Object.create(Control.prototype);
			this.prototype.renderIndicator = function(editor, gl, viewProj) {
				var pos = Vec3.unproj(this.pPos, this.axis, this.param);
				var rad = this.box.scale * 0.4;
				var dif = [rad, rad, rad];
				dif[this.axis] *= 0.7;
				var bound = new Volume.Bound(Vec3.sub(pos, dif), Vec3.add(pos, dif));
				renderBlock(gl, bound, viewProj);
			}
			this.prototype.begin = function(editor, point) {
				var plane = editor.plane;
				if (this.axis == plane.axis) {
					if (this.param == plane.lead)
						return new DragHandler.Plane(this.box, this.axis, true, this.pPos);
					if (this.param == plane.trail)
						return new DragHandler.Plane(this.box, this.axis, false, this.pPos);
				}
				var scale = this.box.scale;
				var tDir = (editor.camera.pos[this.axis] > this.param) ? -scale : scale;
				var trail = this.param + tDir;
				editor.plane = new Editor.Plane(this.box, this.axis, this.param, trail);
				return new DragHandler.Plane(this.box, this.axis, false, this.pPos);
			}
		}).call(Plane);
		
		// Define exports.
		this.Paint = Paint;
		this.Box = Box;
		this.Plane = Plane;
	}).call(Control);
	
	// Sets the node for this editor.
	this.prototype.setNode = function(node) {
		this.node = node;
		this.renderNode = Render.prepareRenderNode(this.gl, node, 1.0, Vec3.zero);
	}
	
	// Gets the current viewProj matrix for this editor.
	this.prototype.getViewProj = function() {
		var proj = mat4.create();
		var viewProj = mat4.create();
		mat4.perspective(proj, 45, this.canvas.width / this.canvas.height, 0.001, 2.0);
		mat4.multiply(viewProj, proj, this.camera.view);
		return viewProj;
	}
	
	// Gets the node that is drawn in a draw operation.
	this.prototype.getDrawNode = function() {
		if (window.keyStates[32]) {
			return Gol.getMatter.dead;
		} else {
			return Gol.getMatter.live;
		}
	}
	
	// Projects a world position to pixel coordinates.
	function proj(width, height, viewProj, pos) {
		var pos = [pos[0], pos[1], pos[2], 1.0];
		vec4.transformMat4(pos, pos, viewProj);
		pos = Vec3.scale(pos, 1.0 / pos[3]);
		return [(pos[0] + 1.0) * width / 2.0, (1.0 - pos[1]) * height / 2.0];
	}
	
	// Gets the pixel coordinates for the given position in this editor.
	this.prototype.proj = function(pos) {
		return proj(this.canvas.width, this.canvas.height, this.getViewProj(), pos);
	}
	
	// Gets a set of pixel vectors corresponding to how a world-space
	// unit vector appears at the given position. The vectors are returned
	// as an length 3 array indexed by axis.
	this.prototype.projCompass = function(pos) {
		var width = this.canvas.width;
		var height = this.canvas.height;
		var viewProj = this.getViewProj();
		var base = proj(width, height, viewProj, pos);
		var res = new Array(3);
		for (var i = 0; i < 3; i++) {
			var cur = proj(width, height, viewProj, Vec3.add(pos, Vec3.getUnit(i, false)));
			res[i] = Vec2.sub(cur, base);
		}
		return res;
	}
	
	// Gets the ray (an object with 'pos' and 'dir') projected from the point
	// at the given pixel coordinates in the canvas of this editor.
	this.prototype.unproj = function(point) {
		x = point[0] * 2.0 / this.canvas.width - 1.0;
		y = 1.0 - point[1] * 2.0 / this.canvas.height;
		
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
	this.prototype.select = function(point) {
		var ray = this.unproj(point);
		var best = null;
		var bestDis = Infinity;
		for (var i = 0; i < this.boxes.length; i++) {
			var box = this.boxes[i];
			for (var j = 0; j < 8; j++) {
				var corner = box.bound.getCorner(j);
				var radius = box.scale * 0.5;
				var res = Volume.traceSphere(corner, radius, ray.pos, ray.dir);
				if (res && res.dis < bestDis) {
					best = new Control.Box(i, j);
					bestDis = res.dis;
				}
			}
			for (var axis = 0; axis < 3; axis++) {
				var pBound = box.bound.proj(axis);
				for (var j = 0; j < 4; j++) {
					var pPos = pBound.getCorner(j);
					var aPos = Vec3.unproj(pPos, axis, 0.0);
					var aDir = Vec3.getUnit(axis, false);
					var res = Volume.traceLine(aPos, aDir, ray.pos, ray.dir);
					var radius = box.scale * 0.4;
					if (res.bParam > 0.0 && res.dis < radius && res.bParam < bestDis) {
						var param = Math.round(res.aParam / box.scale) * box.scale;
						if (param > box.bound.min[axis] && param < box.bound.max[axis]) {
							best = new Control.Plane(box, axis, pPos, param);
							bestDis = res.bParam;
						}
					}
				}
			}
		}
		var res = Volume.tracePlane(this.plane.axis, this.plane.lead, ray.pos, ray.dir);
		if (res && res.dis < bestDis) {
			var pBlock = this.plane.getBlock(res.param);
			if (pBlock) {
				best = new Control.Paint(pBlock);
				bestDis = res.dis;
			}
		}
		return best;
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
		this.renderNode(viewProj);
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
			var near = Volume.nearNode(pred, this.node, 1.0, 
				Vec3.zero, this.camera.pos, this.maxDis);
			this.lastDis = near ? near.dis : this.maxDis;
			if (near && near.dis < this.minDis) {
				this.camera.pos = Vec3.add(this.camera.pos, 
					Vec3.scale(near.norm, this.minDis - near.dis));
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