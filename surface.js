// Contains functions and types related to renderable 2D surfaces.
var Surface = new function() {

	// A spatial node that describes the visual contents of
	// a square 2D area.
	var Node = Area.Node();
	
	// Represents an area that is not visible, and thus can 
	// be rendered in any way.
	var inside = Node.leaf();
	
	// A special value used in delta surfaces. This represents an
	// area that has not changed from the base surface.
	var same = Node.leaf();
	
	// Gets the leaf node for the given material.
	function lookup(material) {
		if (material.node) return material.node;
		var node = Node.leaf();
		node.material = material;
		material.node = node;
		return node;
	}
	
	// Represents an area that is empty.
	var empty = lookup(Material.empty);

	// Describes a rectangular rendering primitive that can be used to display
	// part of a surface. Each Quad has a single material, and a lower and upper
	// bound on the area it occupies. The lower bound is the smallest rectangle that
	// the Quad can cover while still being consistent with the area it represents.
	// The upper bound, likewise, is the largest rectangle that the Quad can cover
	// without interfering with other areas. Quads of the same material may be
	// combined into a single Quad.
	function Quad(material, lower, upper) {
		this.material = material;
		this.lower = lower;
		this.upper = upper;
	}
	
	// Define Quad functions and values.
	(function() {
	
		// Applies a scale, then a translation, to this Quad.
		this.prototype.transform = function(scale, offset) {
			return new Quad(this.material,
				this.lower.transform(scale, offset),
				this.upper.transform(scale, offset));
		}
		
		// Tries combining two Quads into a single Quad that is consistent
		// with both. Returns null if this is not possible.
		function merge(a, b) {
			if (a.material !== b.material) return null;
			
			// Tries merging two quads that are adjacent along
			// the given axis. The first Quad should have
			// lower coordinates on that axis.
			function mergeOnAxis(axis, n, p) {
				var oaxis = 1 - axis;
				if (n.lower.min[oaxis] >= p.upper.min[oaxis] &&
					n.lower.max[oaxis] <= p.upper.max[oaxis] &&
					n.upper.min[oaxis] <= p.lower.min[oaxis] &&
					n.upper.max[oaxis] >= p.lower.max[oaxis])
				{
					var min = new Array(2);
					var max = new Array(2);
					min[axis] = n.lower.min[axis];
					max[axis] = p.lower.max[axis];
					min[oaxis] = Math.min(n.lower.min[oaxis], p.lower.min[oaxis]);
					max[oaxis] = Math.max(n.lower.max[oaxis], p.lower.max[oaxis]);
					var lower = new Rect(min, max);
				
					var min = new Array(2);
					var max = new Array(2);
					min[axis] = n.upper.min[axis];
					max[axis] = p.upper.max[axis];
					min[oaxis] = Math.max(n.upper.min[oaxis], p.upper.min[oaxis]);
					max[oaxis] = Math.min(n.upper.max[oaxis], p.upper.max[oaxis]);
					var upper = new Rect(min, max);
					
					return new Quad(n.material, lower, upper);
				} else {
					return null;
				}
			}
			
			for (var i = 0; i <= 1; i++) {
				if (a.upper.max[i] == b.upper.min[i]) 
					return mergeOnAxis(i, a, b);
				if (b.upper.max[i] == a.upper.min[i]) 
					return mergeOnAxis(i, b, a);
			}
		}
		
		// Tries merging this Quad into a free area defined by a rectangle. Returns
		// null if not possible. In order for this to succeed, the rectangle must
		// be adjacent to the upper bound of this quad. On success, the lower bound
		// and material of the returned Quad will be the same as this one.
		this.prototype.mergeInto = function(rect) {
			for (var i = 0; i <= 1; i++) {
				var axis = i;
				var oaxis = 1 - i;
				if (this.upper.min[oaxis] >= rect.min[oaxis] && 
					this.upper.max[oaxis] <= rect.max[oaxis]) 
				{
					if (this.upper.max[axis] == rect.min[axis]) {
						var max = new Array(2);
						max[axis] = rect.max[axis];
						max[oaxis] = this.upper.max[oaxis];
						return new Quad(this.material, this.lower, 
							new Rect(this.upper.min, max));
					} else if (rect.max[axis] == this.upper.min[axis]) {
						var min = new Array(2);
						min[axis] = rect.min[axis];
						min[oaxis] = this.upper.min[oaxis];
						return new Quad(this.material, this.lower, 
							new Rect(min, this.upper.max));
					}
				}
			}
			return null;
		}
		
		// Define exports.
		this.merge = merge;
	}).call(Quad);
	
	// Contains a set of Quads within an area, such as one defined by a surface node. The
	// View stores border Quads (those that share part of an edge with the view area)
	// seperately from inner Quads (those that don't share a border with the view area).
	// A View additionally stores a set of "free" rectangles where Quads of any material
	// can expand to. Only free rectangles on the border of the view area are tracked.
	function View(inner, border, free) {
		this.inner = inner;
		this.border = border;
		this.free = free;
	}
	
	// Updates a surface with a delta surface. This replaces all areas in the base with
	// the corresponding areas in the delta surface, except for areas that are set to
	// 'same' in the the delta surface.
	function update(base, delta) {
		if (delta.isLeaf) {
			if (delta === same) {
				return base;
			} else {
				return delta;
			}
		} else {
			var children = new Array(4);
			for (var i = 0; i < 4; i++) {
				children[i] = update(base.children[i], delta.children[i]);
			}
			return Node.get(children);
		}
	}
	
	// Define view functions and values.
	(function () {
	
		// Gets all Quads in a view.
		this.prototype.allQuads = function() {
			return this.inner.concat(this.border);
		}
		
		// Merges the contents of two views that together cover
		// the given target view area.
		function merge(a, b, area) {
			var inner = a.inner.concat(b.inner);

			// Merge border Quads.
			var border = new Array();
			var bBorderMerged = new Array(b.border.length);
			for (var i = 0; i < bBorderMerged.length; i++)
				bBorderMerged[i] = false;
			for (var i = 0; i < a.border.length; i++) {
				var aQuad = a.border[i];
				var merged;
				for (var j = 0; j < b.border.length; j++) {
					if (!bBorderMerged[j]) {
						var bQuad = b.border[j];
						if (merged = Quad.merge(aQuad, bQuad)) {
							aQuad = merged;
							bBorderMerged[j] = true;
							break;
						}
					}
				}
				if (!merged) {
				
					// Try merging into a free area, if a merge with
					// a compatible Quad is not possible.
					for (var j = 0; j < b.free.length; j++) {
						var bFree = b.free[j];
						if (merged = aQuad.mergeInto(bFree)) {
							aQuad = merged;
							break;
						}
					}
				}
				
				// Add this Quad to the result list.
				if (aQuad.upper.isCoinside(area)) {
					border.push(aQuad);
				} else {
					inner.push(aQuad);
				}
			}
			for (var i = 0; i < b.border.length; i++) {
				var bQuad = b.border[i];
				if (!bBorderMerged[i]) {
				
					// Try merging into a free area.
					for (var j = 0; j < a.free.length; j++) {
						var aFree = a.free[j];
						if (merged = bQuad.mergeInto(aFree)) {
							bQuad = merged;
							break;
						}
					}
					
					// Add this Quad to the result list.
					if (bQuad.upper.isCoinside(area)) {
						border.push(bQuad);
					} else {
						inner.push(bQuad);
					}
				}
			}
			
			// Merge free areas.
			var free = new Array();
			var bFreeMerged = new Array(b.free.length);
			for (var i = 0; i < a.free.length; i++) {
				var aFree = a.free[i];
				for (var j = 0; j < b.free.length; j++) {
					if (!bFreeMerged[j]) {
						var bFree = b.free[j];
						var merged;
						if (merged = Rect.merge(aFree, bFree)) {
							aFree = merged;
							bFreeMerged[j] = true;
							break;
						}
					}
				}
				if (aFree.isCoinside(area)) {
					free.push(aFree);
				}
			}
			for (var i = 0; i < b.free.length; i++) {
				var bFree = b.free[i];
				if (!bFreeMerged[i]) {
					if (bFree.isCoinside(area)) {
						free.push(bFree);
					}
				}
			}
			return new View(inner, border, free);
		}
		
		// Applies a scale, then a translation, to a view.
		this.prototype.transform = function(scale, offset) {
			function transformItem(item) {
				return item.transform(scale, offset);
			}
			return new View(
				this.inner.map(transformItem), 
				this.border.map(transformItem),
				this.free.map(transformItem));
		}
		
		// Define exports.
		this.merge = merge;
	}).call(View);
	
	// Gets the view for a node representing a surface.
	function view(node) {
		function compute(node) {
			if (node.isLeaf) {
				return new View([], [new Quad(node.material, Rect.unit, Rect.unit)], []);
			} else {
				var nn = view(node.children[0]).transform(0.5, [-0.25, -0.25]);
				var pn = view(node.children[1]).transform(0.5, [0.25, -0.25]);
				var np = view(node.children[2]).transform(0.5, [-0.25, 0.25]);
				var pp = view(node.children[3]).transform(0.5, [0.25, 0.25]);
				var ny = View.merge(nn, pn, Rect.create(-0.5, -0.5, 0.5, 0.0));
				var py = View.merge(np, pp, Rect.create(-0.5, 0.0, 0.5, 0.5));
				return View.merge(ny, py, Rect.unit);
			}
		}
		return node.view || (node.view = compute(node));
	}
	
	// Define views for special nodes.
	inside.view = new View([], [], [Rect.unit]);
	empty.view = new View([], [], []);
	
	// Contains functions for slicing (getting a surface for) matter along the given axis.
	function Slice(axis) {
		var z = axis;
		var x = (axis + 1) % 3;
		var y = (axis + 2) % 3;
		
		var zF = 1 << z;
		var xF = 1 << x;
		var yF = 1 << y;
		
		// The indices for the children nodes in the first half of a matter node,
		// where halves are defined by the slice axis.
		var ni = [0, xF, yF, xF | yF];
		
		// The indices for the children nodes in the second half of a matter node,
		// where halves are defined by the slice axis.
		var pi = [zF, xF | zF, yF | zF, xF | yF | zF];
	
		// Gets the surface between two nodes of matter that are assumed to be adjacent
		// along the slice axis. The first of nodes will be the "back" of the surface unless
		// the 'flip' parameter is set. This function can also be used to get the delta surface
		// between two matter nodes that change as defined in the given boolean volume nodes.
		function betweenDelta(n, nChange, p, pChange, flip) {
			if (nChange === Volume.Boolean.false &&
				pChange === Volume.Boolean.false)
				return same;
			if (n.isLeaf && p.isLeaf) {
				var n = n.material;
				var p = p.material;
				if (!flip) {
					if (!p.isTransparent) return inside;
					return lookup(n);
				} else {
					if (!n.isTransparent) return inside;
					return lookup(p);
				}
			} else {
				var children = new Array(4);
				for (var i = 0; i < 4; i++) {
					children[i] = betweenDelta(
						n.children[pi[i]], nChange.children[pi[i]],
						p.children[ni[i]], pChange.children[ni[i]], flip);
				}
				return Node.get(children);
			}
		}
		
		// Like 'betweenDelta', but returns a non-delta surface.
		function between(n, p, flip) {
			return betweenDelta(n, Volume.Boolean.true, p, Volume.Boolean.true, flip);
		}
		
		// Gets a slice of the given matter node along a plane with the given position
		// relative to the center plane. The position should be within the exclusive
		// bounds of -0.5 to 0.5. The 'flip' parameter is a boolean that indicates
		// the direction of the slice when a surface is met. This function can be
		// used to get a delta surface by specifying which parts of the matter node
		// have changed in a boolean volume node.
		function withinDelta(node, change, pos, flip) {
			if (change === Volume.Boolean.false) return same;
			if (node.isLeaf) {
				return node.material.isTransparent ? empty : inside;
			} else {
				if (pos == 0.0) {
					var children = new Array(4);
					for (var i = 0; i < 4; i++) {
						children[i] = betweenDelta(
							node.children[ni[i]], change.children[ni[i]],
							node.children[pi[i]], change.children[pi[i]], flip);
					}
					return Node.get(children);
				} else {
					var ki, npos;
					if (pos > 0.0) {
						ki = pi;
						npos = pos * 2.0 - 0.5;
					} else {
						ki = ni;
						npos = pos * 2.0 + 0.5;
					}
					var children = new Array(4);
					for (var i = 0; i < 4; i++) {
						children[i] = withinDelta(node.children[ki[i]],
							change.children[ki[i]], npos, flip);
					}
					return Node.get(children);
				}
			}
		}
		
		// Like 'within', but returns a non-delta surface.
		function within(node, pos, flip) {
			return withinDelta(node, Volume.Boolean.true, pos, flip);
		}
		
		// Gets an ordered array of changed non-empty slices in the given matter node. 
		// The 'flip' parameter is a boolean that indicates the direction of the slice.
		// This function can be used to get delta surfaces by specifying which parts of
		// the matter node have changed in a boolean volume node.
		function allDelta(node, change, flip) {
			if (node.isLeaf || change === Volume.Boolean.false) {
				return [];
			} else {
				function compute(node, change, flip) {
				
					// Computes the slices for a half of a given node and pushes
					// them (in order) to the given result array, with the given position
					// offset.
					function half(node, change, ki, flip, res, pos) {
						var slices = new Array(4);
						var counter = new Array(4);
						for (var i = 0; i < 4; i++) {
							slices[i] = allDelta(node.children[ki[i]], change.children[ki[i]], flip);
							counter[i] = 0;
						}
						
						// Merge slices from nodes.
						while(true) {
							var firstPos = 0.5;
							for (var i = 0; i < 4; i++) {
								if (counter[i] < slices[i].length) {
									var slice = slices[i][counter[i]];
									if (slice.pos < firstPos) {
										firstPos = slice.pos;
									}
								}
							}
							if (firstPos == 0.5) break;
							var children = new Array(4);
							for (var i = 0; i < 4; i++) {
								if (counter[i] < slices[i].length) {
									var slice = slices[i][counter[i]];
									if (slice.pos == firstPos) {
										children[i] = slice.val;
										counter[i]++;
										continue;
									}
								}
								children[i] = withinDelta(node.children[ki[i]], 
									change.children[ki[i]], firstPos, flip);
							}
							res.push({ 
								pos : firstPos * 0.5 + pos,
								val : Node.get(children) });
						}
					}
					
					
					// Get center slice.
					var children = new Array(4);
					for (var i = 0; i < 4; i++) {
						children[i] = betweenDelta(
							node.children[ni[i]], change.children[ni[i]], 
							node.children[pi[i]], change.children[pi[i]], flip);
					}
					var center = Node.get(children);
					
					// Construct result by combining the slices in the first set of children, the
					// center slice, and the slices from the second set of children.
					var res = new Array();
					half(node, change, ni, flip, res, -0.25);
					if (center !== same) res.push({ pos : 0.0, val : center });
					half(node, change, pi, flip, res, 0.25);
					return res;
				}
				
				// TODO: Bring back memoization.
				// Make sure to save and use work we've already done.
				
				return compute(node, change, flip);
			}
		}
		
		// Gets an ordered array of all slices in the given matter node. 
		// The 'flip' parameter is a boolean that indicates the direction of the slice.
		function all(node, flip) {
			return allDelta(node, Volume.Boolean.true, flip);
		}
		
		// Projects a vector on a surface into 3D space.
		function project(vec, pos) {
			var res = new Array(3);
			res[x] = vec[0];
			res[y] = vec[1];
			res[z] = pos;
			return res;
		}
		
		// Define exports.
		var Slice = { }
		Slice.betweenDelta = betweenDelta;
		Slice.withinDelta = withinDelta;
		Slice.allDelta = allDelta;
		Slice.between = between;
		Slice.within = within;
		Slice.all = all;
		Slice.project = project;
		return Slice;
	}
	
	// Create Slice objects.
	var Slice = [Slice(0), Slice(1), Slice(2)];
	
	// Define exports.
	this.Node = Node;
	this.get = Node.get;
	this.merge = Node.merge;
	this.inside = inside;
	this.lookup = lookup;
	this.Quad = Quad;
	this.View = View;
	this.view = view;
	this.update = update;
	this.Slice = Slice;
}