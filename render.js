var ItemState = {
	Free : 0,
	InUse : 1,
	UseMask : 1,
	Clean : 0,
	Dirty : 2,
	StatusMask : 2
}

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
		this.itemState[i] = ItemState.Free;
	}
}

StreamingArrayBuffer.prototype.findFree = function () {
	for (var i = this.nextPossibleFree; i < this.itemState.length; i++) {
		var state = this.itemState[i];
		if ((state & ItemState.UseMask) == ItemState.Free) {
			this.nextPossibleFree = i + 1;
			return i;
		}
	}
	return -1;
}

StreamingArrayBuffer.prototype.edit = function(index) {
	var start = index * this.itemSize;
	this.itemState[index] = ItemState.InUse | ItemState.Dirty;
	return this.data.subarray(start, start + this.itemSize);
}

StreamingArrayBuffer.prototype.push = function() {
	var index = this.findFree();
	if (index == -1) throw "Buffer Overflow"
	return this.edit(index);
}

StreamingArrayBuffer.prototype.clear = function(index) {
	if ((this.itemState[index] & ItemState.UseMask) == ItemState.InUse) {
		this.itemState[index] = ItemState.Free | ItemState.Dirty;
		this.nextPossibleFree = Math.min(this.nextPossibleFree, index);
		var start = index * this.itemSize;
		for (var i = 0; i < this.itemSize; i++) {
			this.data[start + i] = 0.0;
		}
	}
}

StreamingArrayBuffer.prototype.flush = function() {
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

StreamingArrayBuffer.prototype.bind = function() {
	gl.bindBuffer(gl.ARRAY_BUFFER, this.source);
}

// Contains functions and objects related to rendering on a square grid.
var Render = new function() {

	// A method of rendering a surface in 3D space.
	this.Material = function(r, g, b) {
		this.r = r;
		this.g = g;
		this.b = b;
	}
	
	// Represents an area that that is in front of an empty volume, and
	// thus can not be rendered.
	this.empty = new Object();

	// Represents an area that is in between two solid volumes, and thus
	// does not need to be rendered, but can be if needed.
	this.inside = new Object();

	// The set of all renderable quads in use.
	this.quads = new HashSet(5039);
	
	// Merges a tuple of materials, special area types, and quads
	// into a single quad. The quads that result can be compared logically
	// using '==='.
	this.merge = function(nn, np, pn, pp) {
		while (true) {
			var mat = this.inside;
			if (nn !== this.inside) mat = nn;
			if (np !== this.inside) {
				if (mat === this.inside) mat = np;
				else if (mat !== np) break;
			}
			if (pn !== this.inside) {
				if (mat === this.inside) mat = pn;
				else if (mat !== pn) break;
			}
			if (pp !== this.inside) {
				if (mat === this.inside) mat = pp;
				else if (mat !== pp) break;
			}
			return mat;
		}
		return this.quads.check(new Quad(nn, np, pn, pp));
	}
	
	// Outputs all quad's of the given material to a StreamingArrayBuffer.
	this.output = function(buffer, quad, mat, size, x, y) {
		if (quad === mat) {
			var data = buffer.push();
			data[0] = x;
			data[1] = y;
			data[2] = 0.0;
			data[3] = x + size;
			data[4] = y;
			data[5] = 0.0;
			data[6] = x;
			data[7] = y + size;
			data[8] = 0.0;
			data[9] = x;
			data[10] = y + size;
			data[11] = 0.0;
			data[12] = x + size;
			data[13] = y;
			data[14] = 0.0;
			data[15] = x + size;
			data[16] = y + size;
			data[17] = 0.0;
		} else if (quad instanceof Quad) {
			var hsize = size * 0.5;
			this.output(buffer, quad.nn, mat, hsize, x, y);
			this.output(buffer, quad.np, mat, hsize, x, y + hsize);
			this.output(buffer, quad.pn, mat, hsize, x + hsize, y);
			this.output(buffer, quad.pp, mat, hsize, x + hsize, y + hsize);
		}
	}
}