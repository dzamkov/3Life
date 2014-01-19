// Contains functions and types related to renderable 3D volumes.
var Matter = new function() {

	// A spatial node representing the visual contents of
	// a cubic 3D area.
	var Node = Volume.Node();
	
	// Gets the leaf node for the given substance.
	function lookup(substance) {
		if (substance.node) return substance.node;
		var node = Node.leaf();
		node.substance = substance;
		substance.node = node;
		return node;
	}
	
	// Represents a volume that is empty.
	var empty = lookup(Substance.empty);
	
	// Represents a volume with undefined visual properties.
	var inside = lookup(Substance.inside);
	
	// Gets a solid matter node for a material.
	function solidUniform(material) {
		return lookup(Substance.solidUniform(material));
	}
	
	// The indices of the first four children (along a given axis) of a node.
	var projIndices = [
		[0, 2, 4, 6],
		[0, 4, 1, 5],
		[0, 1, 2, 3]];
	
	// Gets the material surface between two matter nodes.
	function between(axis, flip, n, p) {
		if (n.depth == 0 && p.depth == 0) {
			var material = Substance.between(axis, flip, n.substance, p.substance);
			return Surface.lookup(material);
		} else {
			var children = new Array(4);
			for (var i = 0; i < 4; i++) {
				var k = projIndices[axis][i];
				children[i] = between(axis, flip, 
					n.children[k | (1 << axis)], 
					p.children[k]);
			}
			return Surface.get(children);
		}
	}
	
	// Gets a material surface for the contents within a matter node. The position should
	// be within the exclusive bounds of 0.0 to 1.0. Note that if the slice does not 
	// intersect any face of the matter node, the result will be some combination of
	// 'Surface.empty' and 'Surface.inside'.
	function within(axis, flip, node, pos) {
		if (node.depth == 0) {
			return Surface.within(node.substance);
		} else {
			var children = new Array(4);
			if (pos == 0.5) {
				for (var i = 0; i < 4; i++) {
					var k = projIndices[axis][i];
					children[i] = between(axis, flip,
						node.children[k],
						node.children[k | (1 << axis)]);
				}
			} else {
				var j, npos;
				if (pos > 0.5) {
					j = 1 << axis;
					npos = pos * 2.0 - 1.0;
				} else {
					j = 0;
					npos = pos * 2.0;
				}
				for (var i = 0; i < 4; i++) {
					children[i] = within(axis, flip, node.children[k | j], npos);
				}
			}
			return Surface.get(children);
		}
	}
	
	// Gets a complete description of all material surface slices in the given matter
	// node, which can be used to compute any 'within' slice.
	function slice(axis, node) {
	
		// Note: The structure of the objects returned is as follows:
		// { head : Surface, tail : [{ pos : Number, at : Surface[2], after : Surface }] }
		
		// 'head' specifies the slice that appears at positions near 0.0.
		// 'tail' specifies all "discontinuities" in the following slice.
		// 'pos' specifies the position of a discontinuity.
		// 'at' specifies the slices (one for each 'flip' value) 
		//      	that appear at the discontinuity.
		// 'after' specifies the slices directly following the discontinuity.
		
		if (node.depth == 0) {
			var head = Surface.within(node.substance);
			return { head : head, tail : [] };
		} else {
		
			// Computes the "discontinuities" for a half of the given node along the given
			// axis and pushes them to the given tail array, returning the head of the
			// half of nodes.
			function computeHalf(j, offset, tail) {
				var tails = new Array(4);
				var counter = new Array(4);
				var current = new Array(4);
				var children = new Array(4);
				for (var i = 0; i < 4; i++) {
					var sub = slice(axis, node.children[projIndices[axis][i] | j]);
					tails[i] = sub.tail;
					counter[i] = 0;
					current[i] = children[i] = sub.head;
				}
				var head = Surface.get(children);
				while (true) {
				
					// Find the first position where there is a discontinuity in any of
					// the child nodes.
					var firstPos = 1.0;
					for (var i = 0; i < 4; i++) {
						if (counter[i] < tails[i].length) {
							firstPos = Math.min(firstPos, tails[i][counter[i]].pos);
						}
					}
					if (firstPos == 1.0) break;
					
					// Determine the full slice at that discontinuity.
					var atChildren = [new Array(4), new Array(4)];
					var afterChildren = new Array(4);
					for (var i = 0; i < 4; i++) {
						var iDis = tails[i][counter[i]];
						if (iDis && iDis.pos == firstPos) {
							atChildren[0][i] = iDis.at[0];
							atChildren[1][i] = iDis.at[1];
							afterChildren[i] = iDis.after;
							current[i] = iDis.after;
							counter[i]++;
						} else {
							atChildren[0][i] = current[i];
							atChildren[1][i] = current[i];
							afterChildren[i] = current[i];
						}
					}
					
					// Push the discontinuity.
					tail.push({
						pos : firstPos * 0.5 + offset,
						at : [Surface.get(atChildren[0]), Surface.get(atChildren[1])],
						after : Surface.get(afterChildren)});
				}
				
				// Return the head.
				return head;
			}
			
			// Computes the slices for this node.
			function compute() {
			
				// Get center 'at' slices.
				var atChildren = [new Array(4), new Array(4)];
				for (var f = 0; f <= 1; f++) {
					for (var i = 0; i < 4; i++) {
						var k = projIndices[axis][i];
						atChildren[f][i] = between(axis, f == 1,
							node.children[k], node.children[k | (1 << axis)]);
					}
				}
				var centerAt = [Surface.get(atChildren[0]), Surface.get(atChildren[1])];
				var center = { pos : 0.5, at : centerAt };
				
				// Construct result by combining the results from the first set of
				// children, the center slice, and the results from the second set of
				// children.
				var tail = new Array();
				var nHead = computeHalf(0, 0.0, tail);
				var centerIndex = tail.length;
				tail.push(center);
				var pHead = center.after = computeHalf(1 << axis, 0.5, tail);
				
				// Remove center if it is not a discontinuity.
				if (centerAt[0] === centerAt[1] && centerAt[0] === pHead) {
					var before = (centerIndex == 0) ? nHead : tail[centerIndex - 1].after;
					if (before === centerAt[0]) {
						tail.splice(centerIndex, 1);
					}
				}
				return { head : nHead, tail : tail };
			}
			
			// Check the cache to avoid duplicate work.
			if (node.slices) {
				if (node.slices[axis]) {
					return node.slices[axis];
				} else {
					return node.slices[axis] = compute();
				}
			} else {
				node.slices = new Array(3);
				return node.slices[axis] = compute();
			}
		}
	}
	
	// Define exports.
	this.Node = Node;
	this.get = Node.get;
	this.merge = Node.merge;
	this.lookup = lookup;
	this.inside = inside;
	this.empty = empty;
	this.solidUniform = solidUniform;
	this.between = between;
	this.within = within;
	this.slice = slice;
}