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
	var R = this;

	// A method of rendering a surface in 3D space.
	R.Material = function(r, g, b) {
		this.r = r;
		this.g = g;
		this.b = b;
	}
	
	// Represents an area that that is in front of an empty volume, and
	// thus can not be rendered.
	R.empty = new Object();

	// Represents an area that is in between two solid volumes, and thus
	// does not need to be rendered, but can be if needed.
	R.inside = new Object();

	// The set of all renderable quadrets in use.
	R.quadrets = new HashSet(5039);
	
	// Merges a tuple of materials, special area types, and quadrets
	// into a single quadret. The quadrets that result can be compared logically
	// using '==='.
	R.merge = function(nn, np, pn, pp) {
		return (nn === np && nn === pn && nn === pp) ? nn :
			R.quadrets.check(new Quadret(nn, np, pn, pp));
	}
	
	// Describes a rectangular rendering primitive that can be used to display
	// an area on a quadret. Each Quad has a single material, and a lower and upper
	// bound on the area it occupies. The lower bound is the smallest rectangle that
	// the Quad can cover while still being consistent with the area it represents.
	// The upper bound, likewise, is the largest rectangle that the Quad can cover
	// without interfering with other areas. Quads of the same material may be
	// combined into a single Quad.
	R.Quad = function(material, lower, upper) {
		this.material = material;
		this.lower = lower;
		this.upper = upper;
	}
	
	// Applies a scale, then a translation, to this Quad.
	R.Quad.prototype.transform = function(scale, x, y) {
		return new R.Quad(this.material,
			this.lower.transform(scale, x, y),
			this.upper.transform(scale, x, y));
	}
	
	// Tries merging this Quad with another. Returns null if not possible.
	// In order for this to succeed, the other Quad most be adjacent to this
	// one (sharing part of an upper bound edged).
	R.Quad.prototype.merge = function(other) {
		if (this.material == other.material ||
			this.material === null ||
			other.material === null)
		{
			function mergeOnX(n, p) {
				if (n.lower.ny >= p.upper.ny &&
					n.lower.py <= p.upper.py &&
					n.upper.ny <= p.lower.ny &&
					n.upper.py >= p.lower.py)
				return new R.Quad(n.material,
					new Rect(
						n.lower.nx, Math.min(n.lower.ny, p.lower.ny),
						p.lower.px, Math.max(n.lower.py, p.lower.py)),
					new Rect(
						n.upper.nx, Math.max(n.upper.ny, p.upper.ny),
						p.upper.px, Math.min(n.upper.py, p.upper.py)));
				return null;
			}
			function mergeOnY(n, p) {
				if (n.lower.nx >= p.upper.nx &&
					n.lower.px <= p.upper.px &&
					n.upper.nx <= p.lower.nx &&
					n.upper.px >= p.lower.px)
				return new R.Quad(n.material,
					new Rect(
						Math.min(n.lower.nx, p.lower.nx), n.lower.ny,
						Math.max(n.lower.px, p.lower.px), p.lower.py),
					new Rect(
						Math.max(n.upper.nx, p.upper.nx), n.upper.ny,
						Math.min(n.upper.px, p.upper.px), p.upper.py));
				return null;
			}
			if (this.upper.px == other.upper.nx) 
				return mergeOnX(this, other);
			if (other.upper.px == this.upper.nx) 
				return mergeOnX(other, this);
			if (this.upper.py == other.upper.ny) 
				return mergeOnY(this, other);
			if (other.upper.py == this.upper.ny) 
				return mergeOnY(other, this);
		}
		return null;
	}
	
	// A quad that describes an inside area. Note that the material of null indicates
	// that it can be rendered as any material (or even a combination of materials).
	R.inside.quad = new R.Quad(null, new Rect(1.0, 1.0, 0.0, 0.0), Rect.unit);
	
	// Contains a set of Quads within an area, such as one defined by a quadret. The
	// View stores border quads (those that share part of an edge with the view area)
	// seperately from inner quads (those that don't share a border with the view area).
	// 'R.inside.quad' and variants should be excluded from the set of inner quads.
	R.View = function(inner, border) {
		this.inner = inner;
		this.border = border;
	}
	
	// Gets all Quads in a view.
	R.View.prototype.all = function() {
		return this.inner.concat(this.border);
	}
	
	// Combines this view with another.
	R.View.prototype.combine = function(other, area) {
		var inner = this.inner.concat(other.inner);
		
		// Merge border Quads.
		var border = new Array();
		var otherBorderMerged = new Array(other.border.length);
		for (var i = 0; i < otherBorderMerged.length; i++)
			otherBorderMerged[i] = false;
		for (var i = 0; i < this.border.length; i++) {
			var a = this.border[i];
			for (var j = 0; j < other.border.length; j++) {
				if (!otherBorderMerged[j]) {
					var b = other.border[j];
					var merged;
					if (merged = a.merge(b)) {
						a = merged;
						otherBorderMerged[j] = true;
						break;
					}
				}
			}
			if (a.upper.borders(area)) {
				border.push(a);
			} else if (a.material !== null) {
				inner.push(a);
			}
		}
		for (var i = 0; i < other.border.length; i++) {
			var b = other.border[i];
			if (!otherBorderMerged[i]) {
				border.push(b);
			} else if (b.material !== null) {
				inner.push(b);
			}
		}
		return new R.View(inner, border);
	}
	
	
	// Applies a scale, then a translation, to a view.
	R.View.prototype.transform = function(scale, x, y) {
		function transformQuad(quad) {
			return quad.transform(scale, x, y);
		}
		return new R.View(
			this.inner.map(transformQuad), 
			this.border.map(transformQuad));
	}
	
	// Gets a view for a node (quadret, material or special area). The coordinates of
	// the resulting quads are relative to the node, with the entire node area being
	// 'Rect.unit'.
	R.view = function(node) {
		function compute(node) {
			if (node instanceof R.Material) {
				return new R.View([], [new R.Quad(node, Rect.unit, Rect.unit)]);
			} else if (node instanceof Quadret) {
				var nn = R.view(node.nn).transform(0.5, 0.0, 0.0);
				var np = R.view(node.np).transform(0.5, 0.0, 0.5);
				var pn = R.view(node.pn).transform(0.5, 0.5, 0.0);
				var pp = R.view(node.pp).transform(0.5, 0.5, 0.5);
				var n = nn.combine(np, new Rect(0.0, 0.0, 0.5, 1.0));
				var p = pn.combine(pp, new Rect(0.5, 0.0, 1.0, 1.0));
				return n.combine(p, Rect.unit);
			}
		}
		return node.view || 
			(node.view = compute(node)) ||
			R.empty.view;
	}
	R.inside.view = new R.View([], [R.inside.quad]);
	R.empty.view = new R.View([], []);
	
	// Represents a renderable surface produced from a quadret. A surface is implicitly
	// associated with a StreamingArrayBuffer, containing references to quads within 
	// the buffer. Unlike quadrets, surfaces are mutable and can be updated with information
	// from a different quadret.
	/*R.Surface = function(node, parent) {
	
		// The quadret, material, or special area this surface currently represents.
		this.node = node;
		
		// The surface containing this surface, or null if this is the root surface.
		this.parent = parent || null;
		
		// Indicates whether this surface contains leaves which are not represented
		// by any quads.
		this.dirty = true;
		
		// The quad that represents this surface; only valid if this surface is a leaf
		// and has a material as its node.
		this.quad = null;
		
		if (node instanceof Quadret) {
			this.nn = new R.Surface(node.nn, this);
			this.np = new R.Surface(node.np, this);
			this.pn = new R.Surface(node.pn, this);
			this.pp = new R.Surface(node.pp, this);
		}
	}*/
	
	// A reference to a quad in a buffer.
	/*R.Quad = function(location, leaf) {
	
		// A rectangle representing the smallest area this quad can take
		// while still being consistent with all of its leaves.
		this.lowerBound = location;
		
		// A rectangle representing the largest area this quad can take
		// while still being consistent with the surronding surface.
		this.upperBound = location;
		
		// The index of this quad in the appropriate buffer.
		this.index = null;
		
		// The set of surface leaf nodes this quad is representing.
		this.leaves = [leaf];
	}*/
	
	// Produces quads for the dirty nodes in the given surface and writes
	// them to a set of buffers. The given write function should take
	// a material and a rectangle for a quad and write the appropriate
	// data to a buffer, returning the resulting index of the quad in
	// the buffer. The location of the surface (used to create quads)
	// is given by its size and offset in 2D space.
	/*R.Surface.prototype.output = function(write, size, x, y) {
		if (this.dirty) {
			this.dirty = false;
			if (this.node instanceof R.Material) {
				var rect = new Rect(x, y, x + size, y + size);
				var quad = new R.Quad(rect, this);
				this.quad = quad;
				quad.index = write(this.node, rect);
			} else if (this.node instanceof Quadret) {
				var hsize = size * 0.5;
				this.nn.output(write, hsize, x, y);
				this.np.output(write, hsize, x, y + hsize);
				this.pn.output(write, hsize, x + hsize, y);
				this.pp.output(write, hsize, x + hsize, y + hsize);
			}
		}
		// this.outputInner(write, size, x, y);
	}
	
	// Like 'output', but only writes the quads whose upperBound does
	// not border the edges of the surface. Quads whose upperBound does border
	// the edges are returned in a 'Rect' structure. A surface with a node
	// of 'inside' will return 'inside' instead of a 'Rect'.
	R.Surface.prototype.outputInner = function(write, size, x, y) {
		if (this.node === R.inside) {
			return R.inside
		} else if (this.dirty) {
			this.dirty = false;
			if (this.node instanceof R.Material) {
				var rect = new Rect(x, y, x + size, y + size);
				var quad = new Quad(rect, this);
				this.quad = quad;
				var borders = [quad]
				return new Rect (borders, borders, borders, borders);
			} else if (this.node instanceof Quadret) {
				var hsize = size / 2;
				
				// Like 'outputInner', but for two adjacent surfaces with
				// the same size and y value.
				function outputLine(n, p, write, size, x, y) {
					var n = n.outputInner(write, size, x, y);
					var p = p.outputInner(write, size, x + size, y);
					if (n === R.inside) {
						if (p === R.inside) {
							return R.inside;
						} else {
							for (var i = 0; i < p.nx.length; i++) {
								p.nx[i].upperBound.nx = x;
							}
							return p;
						}
					} else if (p === R.inside) {
						for (var i = 0; i < p.nx.length; i++) {
							n.px[i].upperBound.px = x + 2 * size;
						}
						return n;
					} else {
						var nx = n.nx;
						var px = p.px;
					
						// Merge the right quads of 'n' 
						// with the left quads of 'p'.
						var i = 0; var j = 0;
						while (i < n.px.length && j < p.nx.length) {
							var n = n.px[i]; var p = p.nx[j];
							if (n.upperBound.ny >= p.upperBound.py) {
								j++;
							} else if (n.upperBound.py <= p.upperBound.ny) {
								i++;
							} else if (n.lowerBound.ny >= p.upperBound.ny &&
								n.lowerBound.py <= p.upperBound.py &&
								p.lowerBound.ny >= n.upperBound.ny &&
								p.lowerBound.py <= n.upperBound.py)
							{
								// Combine 'n' and 'p'.
								n.lowerBound.ny = Math.min(n.lowerBound.ny, p.lowerBound.ny);
								n.lowerBound.py = Math.max(n.lowerBound.py, p.lowerBound.py);
								n.upperBound.ny = Math.max(n.upperBound.ny, p.upperBound.ny);
								n.upperBound.py = Math.min(n.upperBound.py, p.upperBound.py);
								n.lowerBound.px = p.lowerBound.px;
								n.upperBound.px = p.upperBound.px;
								n.leaves = n.leaves.concat(p.leaves);
								
								// Replace all instances of 'p' with the combined
								// 'n' and 'p', which is now stored in 'n'.
								px.replace(p, n);
								
								i++; j++;
							} else if (n.upperBound.py > p.upperBound.py) {
								j++;
							} else {
								i++;
							}
							
							// Output quads that dont border the edges of the line.
						}
					}
				}
				
				var n = outputLine(this.nn, this.pn, write, hsize, x, y);
				var p = outputLine(this.np, this.pp, write, hsize, x, y + hsize);
			}
		}
		return new Rect ([], [], [], []);
	}*/
}