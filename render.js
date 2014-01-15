
// Represents an array buffer of fixed-sized items that
// can accept and remove items between draws.
function StreamingArrayBuffer(itemSize, initialCapacity) {
	this.data = new Float32Array(itemSize * initialCapacity);
	this.source = null;
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
	this.prototype.flush = function(gl) {
		if (!this.needFlush) return;
		this.drawLength = 0;
		this.needFlush = false;
		if (!this.source) this.source = gl.createBuffer();
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
	this.prototype.bind = function(gl) {
		gl.bindBuffer(gl.ARRAY_BUFFER, this.source);
	}
	
	// Draws all items in this StreamingArrayBuffer, assuming that
	// the buffer is already bound.
	this.prototype.draw = function(gl, mode, vertexSize) {
		gl.drawArrays(mode, 0, vertexSize * this.drawLength);
	}
	
}).call(StreamingArrayBuffer);

// Contains functions and types for rendering spatial nodes.
var Render = new function() {

	// Note: "Renderers" are objects which maintain geometry
	// for spatial nodes. They all take a function called 'push'
	// which creates a geometry primitive based on the parameters
	// and returns a function to delete it later if needed.
	
	// A renderer for a spatial node that can potentially be
	// a space of any dimension. The 'Space' parameter gives
	// the space corresponding to its dimension. The 'pushLeaf'
	// function outputs a primitive for a given leaf with the
	// given scale and offset, and returns a function to later
	// delete the primitive. The 'scale' and 'offset' parameters
	// for the renderer are the optional and specify the location
	// of the root node. If they are not specified, the node is
	// assumed to occupy 'Space.Bound.unit'.
	function Direct(Space, pushLeaf, scale, offset) {
		this.Space = Space;
		this.tree = null;
		this.pushLeaf = pushLeaf;
		this.scale = scale || 1.0;
		this.offset = offset || Space.Vector.zero;
	}
	
	// Define 'Direct' functions.
	(function() {
	
		// Maintains the 'remove' functions for a tree of nodes.
		function Tree(Space, pushLeaf, node, scale, offset) {
			this.node = node;
			this.remove = null;
			this.children = null;
			if (node.depth == 0) {
				this.remove = pushLeaf(node, scale, offset);
			} else {
				this.children = new Array(node.children.length);
				for (var i = 0; i < node.children.length; i++) {
					this.children[i] = new Tree(Space, pushLeaf,
						node.children[i], scale * 0.5,
						Space.getOffset(scale, offset, i));
				}
			}
		}
		
		// Removes all primitives in a tree.
		Tree.prototype.clear = function() {
			if (this.remove) {
				this.remove();
			} else {
				for (var i = 0; i < this.children.length; i++) {
					this.children[i].clear();
				}
			}
		}
		
		// Updates all parts of the tree that differ from the given node.
		Tree.prototype.update = function(Space, pushLeaf, node, scale, offset) {
			if (this.node === node) return;
			if (node.depth == 0) {
				this.clear();
				this.node = node;
				this.remove = pushLeaf(node, scale, offset);
			} else if (this.remove) {
				this.remove();
				this.remove = null;
				this.node = node;
				this.children = new Array(node.children.length);
				for (var i = 0; i < node.children.length; i++) {
					this.children[i] = new Tree(Space, pushLeaf, node.children[i],
						scale * 0.5, Space.getOffset(scale, offset, i));
				}
			} else {
				for (var i = 0; i < node.children.length; i++) {
					this.children[i].update(Space, pushLeaf, node.children[i],
						scale * 0.5, Space.getOffset(scale, offset, i));
				}
			}
		}
		
		// Clears the node for this renderer.
		this.prototype.clear = function() {
			this.tree.clear();
			this.tree = null;
		}
		
		// Sets the node for this renderer.
		this.prototype.set = function(node) {
			this.tree = new Tree(this.Space, this.pushLeaf, node, this.scale, this.offset);
		}
		
		// Updates the node for this renderer.
		this.prototype.update = function(node) {
			this.tree.update(this.Space, this.pushLeaf, node, this.scale, this.offset);
		}
	
	}).call(Direct);

	// Allows the rendering of a scene, which is a composition of
	// many quads with varying materials. The supplied 'push-' functions
	// can be used to add quads to the scene.
	function Scene() {
		this.buffers = new HashMap(13);
	}
	
	// Define Scene functions.
	(function() {
	
		// Gets the buffer in this scene for the given material.
		this.prototype.lookupBuffer = function(material) {
			return this.buffers.lookup(material, function() {
				return new StreamingArrayBuffer(36, 100);
			});
		}
		
		// Adds a quad to the scene. The Quad is described by its material,
		// its four planar corners, and its normal. A function is returned
		// to later remove the quad.
		this.prototype.push = function(material, a, b, c, d, norm) {
			if (material === Material.empty) return ignore;
			var buffer = this.lookupBuffer(material);
			var index = buffer.forceFree();
			var data = buffer.edit(index);
			data[0] = a[0]; data[1] = a[1]; data[2] = a[2];
			data[6] = b[0]; data[7] = b[1]; data[8] = b[2];
			data[12] = d[0]; data[13] = d[1]; data[14] = d[2];
			data[18] = d[0]; data[19] = d[1]; data[20] = d[2];
			data[24] = b[0]; data[25] = b[1]; data[26] = b[2];
			data[30] = c[0]; data[31] = c[1]; data[32] =c[2];
			for (var i = 3; i <36; i += 6) {
				data[i + 0] = norm[0];
				data[i + 1] = norm[1];
				data[i + 2] = norm[2];
			}
			return function() {
				buffer.remove(index);
			}
		}
		
		// Adds a matter leaf node to the scene, returning a function to later remove it.
		this.prototype.pushMatterLeaf = function(leaf, scale, offset) {
			if (leaf.substance instanceof Substance.Solid) {
				var s = leaf.substance;
				var h = scale * 0.5;
				var nnn = [offset[0] - h, offset[1] - h, offset[2] - h];
				var pnn = [offset[0] + h, offset[1] - h, offset[2] - h];
				var npn = [offset[0] - h, offset[1] + h, offset[2] - h];
				var ppn = [offset[0] + h, offset[1] + h, offset[2] - h];
				var nnp = [offset[0] - h, offset[1] - h, offset[2] + h];
				var pnp = [offset[0] + h, offset[1] - h, offset[2] + h];
				var npp = [offset[0] - h, offset[1] + h, offset[2] + h];
				var ppp = [offset[0] + h, offset[1] + h, offset[2] + h];
				var xp = this.push(s.getFaceMaterial(0, false), pnn, ppn, ppp, pnp, [1, 0, 0]);
				var xn = this.push(s.getFaceMaterial(0, false), nnp, npp, npn, nnn, [-1, 0, 0]);
				var yp = this.push(s.getFaceMaterial(0, false), npn, npp, ppp, ppn, [0, 1, 0]);
				var yn = this.push(s.getFaceMaterial(0, false), pnn, pnp, nnp, nnn, [0, -1, 0]);
				var zp = this.push(s.getFaceMaterial(0, false), nnp, pnp, ppp, npp, [0, 0, 1]);
				var zn = this.push(s.getFaceMaterial(0, false), npn, ppn, pnn, nnn, [0, 0, -1]);
				return combine([xp, xn, yp, yn, zp, zn]);
			} else return ignore;
		}
		
		// Gets a push function for a rectangular area on a surface
		// given the normal axis of the surface, its flip, and its
		// position along the normal axis.
		this.prototype.getPushSurfaceQuad = function(axis, flip, pos) {
			var scene = this;
			var norm = new Array(3);
			norm[0] = norm[1] = norm[2] = 0.0;
			norm[axis] = flip ? -1.0 : 1.0;
			var proj = Global.Surface.Slice[axis].project;
			return function(material, rect) {
				var a = proj(rect.min, pos);
				var b = proj([rect.max[0], rect.min[1]], pos);
				var c = proj([rect.min[0], rect.max[1]], pos);
				var d = proj(rect.max, pos);
				if (flip) {
					var temp = b;
					b = c;
					c = temp;
				}
				return scene.push(material, a, b, c, d, norm);
			}
		}
		
		// Gets a push function for a surface leaf node given
		// the normal axis of the surface, its flip, and its
		// position along the normal axis.
		this.prototype.getPushSurfaceLeaf = function(axis, flip, pos) {
			pushSurfaceQuad = this.getPushSurfaceQuad(axis, flip, pos);
			return function(leaf, scale, offset) {
				if (leaf.material !== Material.empty) {
					var rect = Rect.unit.transform(scale, offset);
					return pushSurfaceQuad(leaf.material, rect);
				} else return ignore;
			}
		}
	
		// Flushes all buffers for this scene. This must be called when changes
		// are made to its contents.
		this.prototype.flush = function(gl) {
			this.buffers.forEach(function(_, buffer) {
				buffer.flush(gl);
			});
		}
		
		// TODO: Sort primitives to improve transparency quality and 
		// reduce unnecessary overwrite.
		
		// Renders the contents of this Scene.
		this.prototype.render = function(gl, view, scale) {
			this.buffers.forEach(function(mat, buffer) {
				var program = mat.program.get(gl);
				if (mat.isTransparent) {
					gl.enable(gl.BLEND);
					gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
				}
				gl.useProgram(program);
				buffer.bind(gl);
				var model = mat4.create();
				mat4.identity(model);
				mat.setupTextures(gl);
				gl.setConstants(program.variables, {
					model : model,
					view : view,
					__proto__ : mat.constants
				});
				gl.enableAttributes(program.variables, 6, {
					pos : { size : 3, offset : 0 },
					norm : { size : 3, offset : 3 }
				});
				buffer.draw(gl, gl.TRIANGLES, 6);
				gl.disableAttributes(program.variables);
				gl.disable(gl.BLEND);
			});
		}
	}).call(Scene);
	
	// Define exports.
	this.Direct = Direct;
	this.Scene = Scene;
};