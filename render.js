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