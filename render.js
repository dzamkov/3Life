
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