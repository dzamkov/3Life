
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
		this.needFlush = false;
		gl.bindBuffer(gl.ARRAY_BUFFER, this.source);
		if (!this.sourceHasData) {
			gl.bufferData(gl.ARRAY_BUFFER, this.data, gl.STREAM_DRAW);
			this.sourceHasData = true;
			for (var i = 0; i < this.itemStates.length; i++) {
				var state = this.itemStates[i];
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
			this.drawLength = 0;
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

	// Allows the rendering of a scene, which is a composition of
	// many quads with varying materials. Scenes impose no geometry
	// restrictions on the quads. Scenes are mutable and allow
	// continuous updates to their content.
	function Scene() {
		this.buffers = new HashMap(13);
	}
	
	// Define Scene functions.
	(function() {
	
		// Gets the buffer in the given scene for the given material.
		function lookupBuffer(scene, material) {
			return scene.buffers.lookup(material, function() {
				return new StreamingArrayBuffer(36, 100);
			});
		}
		
		function QuadRef(buffer, index) {
			this.buffer = buffer;
			this.index = index;
		}
	
		// Adds a Quad to this scene. The Quad is described by its material,
		// its four planar corners, and its normal. A reference to the quad
		// is returned to allow for later removal.
		this.prototype.push = function(material, a, b, c, d, norm) {
			var buffer = lookupBuffer(this, material);
			var index = buffer.forceFree();
			if (index == -1) throw "Buffer Overflow"
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
		}
		
		// Removes the Quad with the given reference from this scene.
		this.prototype.remove = function(ref) {
			ref.buffer.remove(ref.index);
		}
		
		// Flushes all buffers for this scene. This must be called when changes
		// are made to its contents.
		this.prototype.flush = function() {
			this.buffers.forEach(function(_, buffer) {
				buffer.flush();
			});
		}
		
		// Renders the contents of this Scene.
		this.prototype.render = function() {
			gl.enableVertexAttribArray(program.pos);
			gl.enableVertexAttribArray(program.norm);
			this.buffers.forEach(function(mat, buffer) {
				if (mat instanceof Material.Solid) {
					buffer.bind();
					gl.uniform3f(program.color, mat.r, mat.g, mat.b);
					gl.vertexAttribPointer(program.pos, 3, gl.FLOAT, false, 6 * 4, 0);
					gl.vertexAttribPointer(program.norm, 3, gl.FLOAT, false, 6 * 4, 3 * 4);
					buffer.draw(gl.TRIANGLES, 6);
				}
			});
			gl.disableVertexAttribArray(program.pos);
			gl.disableVertexAttribArray(program.norm);
		}
	
	}).call(Scene);
	
	// Allows rendering of a surface to a scene. The surface can be updated to make
	// corresponding changes to the scene. Changes to the scene are automatic and
	// no 'flush' method needs to be called on the renderer.
	function Surface(scene, axis, flip, pos) {
		this.scene = scene;
		this.axis = axis;
		this.flip = flip;
		this.pos = pos;
	}
	
	// Define surface renderer functions.
	(function() {
	
		// Clears the node for this surface renderer. After this is called, use 'set'
		// to set a new node, or ignore the renderer to make it go away.
		this.prototype.clear = function() {
			for (var i = 0; i < this.quadRefs.length; i++) {
				this.scene.remove(this.quadRefs[i]);
			}
			this.quadRefs = null;
			this.node = null;
		}
	
		// Sets the node to be rendered by this surface renderer. This may only be called
		// after the renderer is cleared using 'clear', or when it's in its initial state.
		this.prototype.set = function(node) {
			var proj = Global.Surface.Slice[this.axis].project;
			var quads = Global.Surface.view(node).allQuads();
			this.quadRefs = new Array(quads.length);
			for (var i = 0; i < quads.length; i++) {
				var quad = quads[i];
				var rect = quad.lower;
				var a = proj(rect.min, this.pos);
				var b = proj([rect.max[0], rect.min[1]], this.pos);
				var c = proj([rect.min[0], rect.max[1]], this.pos);
				var d = proj(rect.max, this.pos);
				if (this.flip) {
					var temp = b;
					b = c;
					c = temp;
				}
				var norm = new Array(3);
				norm[0] = norm[1] = norm[2] = 0.0;
				norm[this.axis] = this.flip ? -1.0 : 1.0;
				this.quadRefs[i] = scene.push(quad.material, a, b, c, d, norm);
			}
			this.node = node;
		}
	
		// Clears this surface renderer and sets a new node to be rendered.
		this.prototype.reset = function(node) {
			this.clear();
			this.set(node);
		}
		
		// Updates the node to be rendered by this renderer using the given delta surface.
		this.prototype.update = function(delta) {
			var node = Global.Surface.update(this.node, delta);
			this.reset(node);
		}
	
	}).call(Surface);
	
	// Allows the rendering of a matter node to a scene. The matter node can be updated
	// to make corresponding changes to the scene. Changes to the scene are automatic and
	// no 'flush' method needs to be called on the renderer.
	function Matter(scene) {
		this.scene = scene;
		this.surfaces = new Array(6);
	}
	
	// Define matter renderer functions.
	(function() {
	
		// Clears the node for this matter renderer. After this is called, use 'set'
		// to set a new node, or ignore the renderer to make it go away.
		this.prototype.clear = function() {
			for (var i = 0; i < 6; i++) {
				for (var j = 0; j < this.surfaces[i].length; j++) {
					this.surfaces[i][j].clear();
				}
				this.surfaces[i] = null;
			}
		}
	
		// Sets the node to be rendered by this matter renderer. This may only be called
		// after the renderer is cleared using 'clear', or when it's in its initial state.
		this.prototype.set = function(node) {
			for (var axis = 0; axis < 3; axis++) {
				for (var i = 0; i <= 1; i++) {
					var flip = (i == 1);
					var index = axis + (i * 3);
					var slices = Global.Surface.Slice[axis].all(node, flip);
					this.surfaces[index] = new Array(slices.length);
					for (var j = 0; j < slices.length; j++) {
						var surface = new Surface(this.scene, axis, flip, slices[j].pos);
						surface.set(slices[j].val);
						this.surfaces[index][j] = surface;
					}
				}
			}
		}
	
		// Clears this matter renderer and sets a new node to be rendered.
		this.prototype.reset = function(node) {
			this.clear();
			this.set(node);
		}
		
		// Updates the node to be rendered by this renderer to the given node. A boolean
		// 'change' node must be supplied to specify what areas of the node have changed
		// between the last set node. Areas that have not changed can safely be marked as
		// changed, but not vice versa.
		this.prototype.update = function(node, change) {
			for (var axis = 0; axis < 3; axis++) {
				for (var i = 0; i <= 1; i++) {
					var flip = (i == 1);
					var index = axis + (i * 3);
					var slices = Global.Surface.Slice[axis].allDelta(node, change, flip);
					var surfaces = this.surfaces[index];
					var j = 0;
					var k = 0;
					while (j < slices.length && k < surfaces.length) {
						var slice = slices[j];
						var surface = surfaces[k];
						if (slice.pos == surface.pos) {
							surface.update(slice.val);
							j++; k++;
						} else if (slice.pos < surface.pos) {
							var nSurface = new Surface(this.scene, axis, flip, slice.pos);
							nSurface.set(Global.Surface.update(empty, slice.val));
							surfaces.splice(k, 0, nSurface);
							j++; k++;
						} else if (slice.pos > surface.pos) {
							k++;
						}
					}
					while (j < slices.length) {
						var slice = slices[j];
						var nSurface = new Surface(this.scene, axis, flip, slice.pos);
						nSurface.set(Global.Surface.update(empty, slice.val));
						surfaces.push(nSurface);
						j++;
					}
				}
			}
		}
	
	}).call(Matter);
	
	// Define exports.
	this.Scene = Scene;
	this.Surface = Surface;
	this.Matter = Matter;
};