
// Represents an array buffer of fixed-sized items that
// can accept and remove items between draws.
function StreamingArrayBuffer(itemSize, initialCapacity) {
	this.data = new Float32Array(itemSize * initialCapacity);
	this.source = gl.createBuffer();
	this.sourceHasData = false;
	this.needFlush = true;
	this.itemSize = itemSize;
	this.itemStates = new Array(initialCapacity);
	this.nextPossibleFree = 0;
	this.drawLength = 0;
	for (var i = 0; i < this.itemStates.length; i++) {
		this.itemStates[i] = 0;
	}
}

// Define StreamingArrayBuffer functions.
(function() {

	// The possible flags for an item in a StreamingArrayBuffer.
	var ItemState = {
		Free : 0,
		InUse : 1,
		UseMask : 1,
		Clean : 0,
		Dirty : 2,
		StatusMask : 2
	}
	
	// Resizes this StreamingArrayBuffer to have the given item capacity. If
	// this is not enough to contain the current items, the last few items
	// will be removed. Items will retain their current indices. 'flush' must
	// be called after 'resize', even if the item data has not changed. 
	this.prototype.resize = function(capacity) {
		var nData = new Float32Array(this.itemSize * capacity);
		for (var i = 0; i < Math.min(this.data.length, nData.length); i++) {
			nData[i] = this.data[i];
		}
		this.data = nData;
		var oldCapacity = this.itemStates.length;
		this.itemStates.length = capacity;
		for (var i = oldCapacity; i < capacity; i++) {
			this.itemStates[i] = 0;
		}
		this.sourceHasData = false;
		this.needFlush = true;
	}

	// Finds the next free item index in the buffer, returning -1
	// if there isn't one available.
	this.prototype.findFree = function () {
		for (var i = this.nextPossibleFree; i < this.itemStates.length; i++) {
			var state = this.itemStates[i];
			if ((state & ItemState.UseMask) == ItemState.Free) {
				this.nextPossibleFree = i + 1;
				return i;
			}
		}
		return -1;
	}
	
	// Finds the next free item index in the buffer, expanding it if needed.
	this.prototype.forceFree = function() {
		var index = this.findFree();
		if (index == -1) {
			index = this.itemStates.length;
			this.resize(this.itemStates.length * 2);
			this.nextPossibleFree = index + 1;
		}
		return index;
	}

	// Updates the item at the given index in the buffer, returning
	// a Float32Array to edit the raw data of the item.
	this.prototype.edit = function(index) {
		var start = index * this.itemSize;
		this.itemStates[index] = ItemState.InUse | ItemState.Dirty;
		this.needFlush = true;
		return this.data.subarray(start, start + this.itemSize);
	}

	// Removes an item from this buffer.
	this.prototype.remove = function(index) {
		if ((this.itemStates[index] & ItemState.UseMask) == ItemState.InUse) {
			this.itemStates[index] = ItemState.Free | ItemState.Dirty;
			this.nextPossibleFree = Math.min(this.nextPossibleFree, index);
			var start = index * this.itemSize;
			for (var i = 0; i < this.itemSize; i++) {
				this.data[start + i] = 0.0;
			}
			this.needFlush = true;
		}
	}

	// Synchronizes the state of the buffer with the graphics device. This should
	// be called some time before the draw call after there was an edit to the items
	// in the buffer.
	this.prototype.flush = function() {
		if (!this.needFlush) return;
		this.drawLength = 0;
		this.needFlush = false;
		gl.bindBuffer(gl.ARRAY_BUFFER, this.source);
		if (!this.sourceHasData) {
			gl.bufferData(gl.ARRAY_BUFFER, this.data, gl.STREAM_DRAW);
			this.sourceHasData = true;
			for (var i = 0; i < this.itemStates.length; i++) {
				var state = this.itemStates[i];
				if ((state & ItemState.UseMask) == ItemState.InUse) {
					this.drawLength = i + 1;
				}
				this.itemStates[i] = (~ItemState.StatusMask & state) | ItemState.Clean;
			}
		} else {
			var itemSize = this.itemSize;
			var data = this.data;
			var batchCount = 0;
			function writeBatch(start, end) {
				gl.bufferSubData(gl.ARRAY_BUFFER, 
					start * itemSize * 4, data.subarray(
						start * itemSize,
						end * itemSize));
				batchCount++;
			}
			var hasBatch = false;
			var batchStart = 0;
			var batchEnd = 0;
			var currentGap = 0;
			var maxGap = 100;
			for (var i = 0; i < this.itemStates.length; i++) {
				var state = this.itemStates[i];
				if ((state & ItemState.UseMask) == ItemState.InUse) {
					this.drawLength = i + 1;
				}
				if ((state & ItemState.StatusMask) == ItemState.Dirty) {
					currentGap = 0;
					if (hasBatch) {
						batchEnd = i + 1;
					} else {
						hasBatch = true;
						batchStart = i;
						batchEnd = i + 1;
					}
					this.itemStates[i] = (~ItemState.StatusMask & state) | ItemState.Clean;
				} else {
					if (hasBatch) {
						currentGap = currentGap + 1;
						if (currentGap >= maxGap) {
							writeBatch(batchStart, batchEnd);
							hasBatch = false;
						}
					}
				}
			}
			if (hasBatch) writeBatch(batchStart, batchEnd);
		}
	}

	// Binds this StreamingArrayBuffer.
	this.prototype.bind = function() {
		gl.bindBuffer(gl.ARRAY_BUFFER, this.source);
	}
	
	// Draws all items in this StreamingArrayBuffer, assuming that
	// the buffer is already bound.
	this.prototype.draw = function(mode, vertexSize) {
		gl.drawArrays(mode, 0, vertexSize * this.drawLength);
	}
	
}).call(StreamingArrayBuffer);

// Contains functions and types for rendering logical objects.
var Render = new function() {
	
	// Contains methods for handling surface geometry. 
	var Surface = new function() {
	
		// The base initializer for surface renderer types.
		// 'push' is a function that takes a material and rectangle
		// and outputs the corresponding quad. A reference to the quad
		// is returned. 'remove' will remove a quad by a given reference.
		function Base(push, remove) {
			this.push = push;
			this.remove = remove;
		}
		
		// Resets the node for a renderer.
		Base.prototype.reset = function(node) {
			this.clear();
			this.set(node);
		}
		
		// TODO: 'Full' renderer, using views to reduce quads.
		
		// Maintains geometry information for a surface by
		// treating each leaf node as a seperate quad. This
		// method is fastest to update, but may require many
		// more quads over other methods, especially when the
		// scene involves many slim rectangles. Note that
		// the initial scale and offset of this type of renderer
		// can optionally be set.
		function Quick(push, remove, scale, offset) {
			Base.call(this, push, remove);
			this.scale = scale || 1.0;
			this.offset = offset || Area.Vector.zero();
			this.tree = null;
		}
		
		// Define 'Quick' methods.
		(function() {
		
			// Maintains the quad references for a surface node.
			function Tree(push, node, scale, offset) {
				this.leaf = null;
				this.ref = null;
				this.children = null;
				if (node.depth == 0) {
					var rect = Rect.unit.transform(scale, offset);
					this.leaf = node;
					this.ref = push(node.material, rect);
				} else {
					this.children = new Array(4);
					for (var i = 0; i < 4; i++) {
						this.children[i] = new Tree(push,
							node.children[i], scale * 0.5,
							Area.getOffset(scale, offset, i));
					}
				}
			}
			
			// Clears a quad reference tree.
			Tree.prototype.clear = function(remove) {
				if (this.leaf) {
					remove(this.ref);
				} else {
					for (var i = 0; i < 4; i++) {
						this.children[i].clear(remove);
					}
				}
			}
			
			// Updates a quad reference tree.
			Tree.prototype.update = function(push, remove, delta, scale, offset) {
				if (delta === Global.Surface.same) return;
				if (delta.depth == 0) {
					this.clear();
					var rect = Rect.Unit.transform(scale, offset);
					this.ref = push(node.material, rect);
					this.leaf = delta;
					this.children = null;
				} else if (this.leaf) {
					remove(this.ref);
					this.children = new Array(4);
					for (var i = 0; i < 4; i++) {
						this.children[i] = new Tree(push, 
							Global.Surface.update(this.leaf, delta.children[i]),
							scale * 0.5, Area.getOffset(scale, offset, i));
					}
					this.leaf = null;
					this.ref = null;
				} else {
					for (var i = 0; i < 4; i++) {
						this.children[i].update(push, remove, delta.children[i],
							scale * 0.5, Area.getOffset(scale, offset, index));
					}
				}
			}
			
			// Declare inheritance from 'Base'.
			this.prototype = Object.create(Base.prototype);
			
			// Clears the node for this renderer.
			this.prototype.clear = function() {
				this.tree.clear(this.remove);
				this.tree = null;
			}
			
			// Sets the node for this renderer.
			this.prototype.set = function(node) {
				this.tree = new Tree(this.push, node, this.scale, this.offset);
			}
			
			// Updates the node for this renderer.
			this.prototype.update = function(delta) {
				this.tree.update(this.push, this.remove, delta, this.scale, this.offset);
			}
			
		}).call(Quick);

		// Define exports.
		this.Base = Base;
		this.Quick = Quick;
	}
	
	// Contains methods for handling matter geometry.
	var Matter = new function() {
	
		// The base initializer for matter renderer types.
		// 'push' is a function that takes a material, rectangle, axis, flip
		// and z-position and outputs the corresponding quad. A reference 
		// to the quad is returned. 'remove' will remove a quad by a given
		// reference.
		function Base(push, remove) {
			this.push = push;
			this.remove = remove;
		}
		
		// Resets the node for a renderer.
		Base.prototype.reset = function(node) {
			this.clear();
			this.set(node);
		}
		
		// TODO: 'Simple' render model, renders matter nodes directly.
		
		// Maintains geometry information for a matter node by maintaining
		// seperate surface renderers for each "slice" of the matter.
		function Complex(push, remove, Surface) {
			Base.call(this, push, remove);
			this.Surface = Surface || Global.Render.Surface.Quick;
			this.surfaces = new Array(3);
		}
		
		// Define Complex renderer functions.
		(function() {
			
			// TODO: maybe we can have a buffer for each surface. This will reduce the size of
			// each item (no need for individual normals and z positions), but more importantly,
			// will allow sorted rendering of surfaces, which would make rendering faster.
			
			// Declare inheritance from 'Base'.
			this.prototype = Object.create(Base.prototype);
			
			// Converts a 'push' function for a matter renderer into a 'push' function for a
			// surface renderer by supplying a z-position, axis and flip.
			function surfacePush(push, axis, flip, pos) {
				return function(mat, rect) {
					return push(mat, rect, axis, flip, pos);
				}
			}
			
			// Clears the node for this matter renderer.
			this.prototype.clear = function() {
				for (var i = 0; i < 3; i++) {
					for (var j = 0; j < this.surfaces[i].length; j++) {
						for (var k = 0; k <= 1; k++) {
							this.surfaces[i][j][k].clear();
						}
					}
					this.surfaces[i] = null;
				}
			}
			
			// Sets the node to be rendered by this matter renderer.
			this.prototype.set = function(node) {
				for (var axis = 0; axis < 3; axis++) {
					var slices = Global.Surface.Slice[axis].all(node).tail;
					this.surfaces[axis] = new Array(slices.length);
					for (var i = 0; i < slices.length; i++) {
						var slice = slices[i];
						var surfaces = this.surfaces[axis][i] = new Array(2);
						for (var j = 0; j <= 1; j++) {
							var flip = (j == 1);
							var surface = surfaces[j] = new this.Surface(
								surfacePush(this.push, axis, flip, slice.pos),
								this.remove);
							surface.set(slice.at[j]);
						}
					}
				}
			}
			
			// Updates the node to be rendered by this renderer to the given node. A boolean
			// 'change' node must be supplied to specify what areas of the node have changed
			// between the last set node. Areas that have not changed can safely be marked as
			// changed, but not vice versa.
			this.prototype.update = function(node, change) {
				for (var axis = 0; axis < 3; axis++) {
					var surfaces = this.surfaces[axis];
					var all = Global.Surface.Slice[axis].allDelta(node, change);
					var current = all.head;
					var slices = all.tail;
					var i = 0;
					var j = 0;
					while (i < slices.length && j < surfaces.length) {
						var iPos = slices[i].pos;
						var jPos = surfaces[j][0].pos;
						if (iPos == jPos) {
							for (var k = 0; k <= 1; k++) {
								surfaces[j][k].update(slices[i].at[k]);
							}
							current = slices[i].after;
							i++; j++;
						} else if (iPos < jPos) {
							this.surfaces[axis].splice(j, 0, new Array(2));
							for (var k = 0; k <= 1; k++) {
								var flip = (k == 1);
								var surface = surfaces[j][k] = new this.Surface(
									surfacePush(this.push, axis, flip, iPos), 
									this.remove);
								surface.set(slices[i].at[k]);
							}
							current = slices[i].after;
							i++; j++;
						} else {
							for (var k = 0; k <= 1; k++) {
								surfaces[j][k].update(current);
							}
							j++;
						}
					}
					while (i < slices.length) {
						var nSurfaces = new Array(2);
						for (var k = 0; k <= 1; k++) {
							var flip = (k == 1);
							var surface = nSurfaces[k] = new this.Surface(
								surfacePush(this.push, axis, flip, slices[i].pos),
								this.remove);
							surface.set(slices[i].at[k]);
						}
						this.surfaces[axis].push(nSurfaces);
						i++;
					}
					while (j < surfaces.length) {
						for (var k = 0; k <= 1; k++) {
							surfaces[j][k].update(current);
						}
						j++;
					}
				}
			}
		}).call(Complex);
		
		// Define exports.
		this.Base = Base;
		this.Complex = Complex;
	};
	

	// Allows the rendering of a scene, which is a composition of
	// many quads with varying materials. They supply 'push' and
	// 'remove' functions which can be used by renderers.
	function Scene() {
		this.buffers = new HashMap(13);
	}
	
	// Define Scene functions.
	(function() {
	
		// Gets the buffer in this scene for the given material.
		this.prototype.lookupBuffer = function(material) {
			return scene.buffers.lookup(material, function() {
				return new StreamingArrayBuffer(36, 100);
			});
		}
	
		// A reference to a quad within a buffer.
		function QuadRef(buffer, index) {
			this.buffer = buffer;
			this.index = index;
		}
	
		// Adds a Quad to this scene. The Quad is described by its material,
		// its four planar corners, and its normal. A reference to the quad
		// is returned to allow for later removal.
		this.prototype.push = function(material, a, b, c, d, norm) {
			if (material !== Material.empty) {
				var buffer = this.lookupBuffer(material);
				var index = buffer.forceFree();
				var data = buffer.edit(index);
				data[0] = a[0]; data[1] = a[1]; data[2] = a[2];
				data[6] = b[0]; data[7] = b[1]; data[8] = b[2];
				data[12] = c[0]; data[13] = c[1]; data[14] = c[2];
				data[18] = c[0]; data[19] = c[1]; data[20] = c[2];
				data[24] = b[0]; data[25] = b[1]; data[26] = b[2];
				data[30] = d[0]; data[31] = d[1]; data[32] = d[2];
				for (var i = 3; i <36; i += 6) {
					data[i + 0] = norm[0];
					data[i + 1] = norm[1];
					data[i + 2] = norm[2];
				}
				return new QuadRef(buffer, index);
			} else return null;
		}
		
		// Returns a function like 'push', but with parameters
		// like those expected by a matter renderer's 'push' function.
		this.prototype.pushMatter = function() {
			var scene = this;
			return function(mat, rect, axis, flip, pos) {
				var proj = Global.Surface.Slice[axis].project;
				var a = proj(rect.min, pos);
				var b = proj([rect.max[0], rect.min[1]], pos);
				var c = proj([rect.min[0], rect.max[1]], pos);
				var d = proj(rect.max, pos);
				if (flip) {
					var temp = b;
					b = c;
					c = temp;
				}
				var norm = new Array(3);
				norm[0] = norm[1] = norm[2] = 0.0;
				norm[axis] = flip ? -1.0 : 1.0;
				return scene.push(mat, a, b, c, d, norm);
			}
		}
		
		// Removes the Quad with the given reference from this scene.
		this.prototype.remove = function(ref) {
			if (ref) ref.buffer.remove(ref.index);
		}
		
		// Flushes all buffers for this scene. This must be called when changes
		// are made to its contents.
		this.prototype.flush = function() {
			this.buffers.forEach(function(_, buffer) {
				buffer.flush();
			});
		}
		
		// Renders the contents of this Scene.
		this.prototype.render = function(proj, view, scale) {
			this.buffers.forEach(function(mat, buffer) {
				var procedure = mat.procedure;
				if (procedure.hasValue) {
					procedure = procedure.value;
					var program = procedure.program.get(gl);
					if (mat.isTransparent) {
						gl.enable(gl.BLEND);
						gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
					}
					gl.useProgram(program);
					gl.uniformMatrix4fv(program.proj, false, proj);
					gl.uniformMatrix4fv(program.view, false, view);
					gl.uniform1f(program.scale, scale);
					procedure.setUniforms(program, gl);
					buffer.bind();
					gl.enableVertexAttribArray(program.pos);
					gl.enableVertexAttribArray(program.norm);
					gl.vertexAttribPointer(program.pos, 3, gl.FLOAT, false, 6 * 4, 0);
					gl.vertexAttribPointer(program.norm, 3, gl.FLOAT, false, 6 * 4, 3 * 4);
					buffer.draw(gl.TRIANGLES, 6);
					gl.disableVertexAttribArray(program.pos);
					gl.disableVertexAttribArray(program.norm);
					gl.disable(gl.BLEND);
				}
			});
		}
	}).call(Scene);
	
	// Define exports.
	this.Surface = Surface;
	this.Matter = Matter;
	this.Scene = Scene;
};