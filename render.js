
// Represents an array buffer of fixed-sized items that
// can accept and remove items between draws.
function StreamingArrayBuffer(itemSize, maxItemCount) {
	this.data = new Float32Array(itemSize * maxItemCount);
	this.source = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, this.source);
	gl.bufferData(gl.ARRAY_BUFFER, this.data, gl.STREAM_DRAW);
	
	this.maxItemCount = maxItemCount;
	this.itemSize = itemSize;
	this.itemState = new Array(maxItemCount);
	this.nextPossibleFree = 0;
	for (var i = 0; i < this.itemState.length; i++) {
		this.itemState[i] = 0;
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

	// Finds the next free item index in the buffer.
	this.prototype.findFree = function () {
		for (var i = this.nextPossibleFree; i < this.itemState.length; i++) {
			var state = this.itemState[i];
			if ((state & ItemState.UseMask) == ItemState.Free) {
				this.nextPossibleFree = i + 1;
				return i;
			}
		}
		return -1;
	}

	// Updates the item at the given index in the buffer, returning
	// a Float32Array to edit the raw data of the item.
	this.prototype.edit = function(index) {
		var start = index * this.itemSize;
		this.itemState[index] = ItemState.InUse | ItemState.Dirty;
		return this.data.subarray(start, start + this.itemSize);
	}

	// Adds an item to the buffer and returns a Float32Array to edit
	// the raw data of the item.
	this.prototype.push = function() {
		var index = this.findFree();
		if (index == -1) throw "Buffer Overflow"
		return this.edit(index);
	}

	// Removes an item from this buffer.
	this.prototype.clear = function(index) {
		if ((this.itemState[index] & ItemState.UseMask) == ItemState.InUse) {
			this.itemState[index] = ItemState.Free | ItemState.Dirty;
			this.nextPossibleFree = Math.min(this.nextPossibleFree, index);
			var start = index * this.itemSize;
			for (var i = 0; i < this.itemSize; i++) {
				this.data[start + i] = 0.0;
			}
		}
	}

	// Synchronizes the state of the buffer with the graphics device. This should
	// be called some time before the draw call after there was an edit to the items
	// in the buffer.
	this.prototype.flush = function() {
		gl.bindBuffer(gl.ARRAY_BUFFER, this.source);
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
		for (var i = 0; i < this.itemState.length; i++) {
			var state = this.itemState[i];
			if ((state & ItemState.StatusMask) == ItemState.Dirty) {
				currentGap = 0;
				if (hasBatch) {
					batchEnd = i + 1;
				} else {
					hasBatch = true;
					batchStart = i;
					batchEnd = i + 1;
				}
				this.itemState[i] = (~ItemState.StatusMask & state) | ItemState.Clean;
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

	// Binds this StreamingArrayBuffer.
	this.prototype.bind = function() {
		gl.bindBuffer(gl.ARRAY_BUFFER, this.source);
	}
}).call(StreamingArrayBuffer);

// Represents a matter node being rendered.
function MatterBuffer(node) {
	this.buffers = new HashMap(13);
	for (var i = 0; i < 3; i++) {
		for (var j = 0; j <= 1; j++) {
			var flip = (j == 1);
			var slices = Surface.Slice[i].all(node, flip);
			for (var k = 0; k < slices.length; k++) {
				var view = Surface.view(slices[k].val);
				var quads = view.allQuads();
				for (var l = 0; l < quads.length; l++) {
					var quad = quads[l];
					this.writeQuad(i, flip, quad.material, quad.lower, slices[k].pos);
				}
			}
		}
	}
	this.flush();
}

// Define MatterBuffer functions.
(function() {

	// Looks up the buffer with the given material.
	this.prototype.lookupBuffer = function(material) {
		return this.buffers.lookup(material, function() {
			return new StreamingArrayBuffer(36, 100000);
		});
	}
	
	// Writes a Quad of the given orientation and material to the appropriate buffer.
	this.prototype.writeQuad = function(axis, flip, material, rect, pos) {
		var proj = Surface.Slice[axis].project;
		var a = proj(rect.min, pos);
		var b = proj([rect.max[0], rect.min[1]], pos);
		var c = proj([rect.min[0], rect.max[1]], pos);
		var d = proj(rect.max, pos);
		if (flip) {
			var temp = b;
			b = c;
			c = temp;
		}
		
		var data = this.lookupBuffer(material).push();
		data[0] = a[0]; data[1] = a[1]; data[2] = a[2];
		data[6] = b[0]; data[7] = b[1]; data[8] = b[2];
		data[12] = c[0]; data[13] = c[1]; data[14] = c[2];
		data[18] = c[0]; data[19] = c[1]; data[20] = c[2];
		data[24] = b[0]; data[25] = b[1]; data[26] = b[2];
		data[30] = d[0]; data[31] = d[1]; data[32] = d[2];
		
		var nv = flip ? -1.0 : 1.0;
		for (var i = 3; i < 36; i += 6) {
			data[i + axis] = nv;
		}
	}
	
	// Flushes all buffers in this MatterBuffer.
	this.prototype.flush = function() {
		this.buffers.forEach(function(_, buffer) {
			buffer.flush();
		});
	}
	
	// Renders the contents of this MatterBuffer.
	this.prototype.render = function() {
		gl.enableVertexAttribArray(program.pos);
		gl.enableVertexAttribArray(program.norm);
		this.buffers.forEach(function(mat, buffer) {
			if (mat instanceof Material.Solid) {
				buffer.bind();
				gl.uniform3f(program.color, mat.r, mat.g, mat.b);
				gl.vertexAttribPointer(program.pos, 3, gl.FLOAT, false, 6 * 4, 0);
				gl.vertexAttribPointer(program.norm, 3, gl.FLOAT, false, 6 * 4, 3 * 4);
				gl.drawArrays(gl.TRIANGLES, 0, 6 * buffer.maxItemCount);
			}
		});
		gl.disableVertexAttribArray(program.pos);
		gl.disableVertexAttribArray(program.norm);
	}
}).call(MatterBuffer);