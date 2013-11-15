// Contains functions and types related to 3D matter.
var Matter = new function() {
	
	// We are probably going to be using 3 space here.
	var Vector = Volume.Vector;
	var Permutation = Volume.Permutation;
	
	// A node representing a physical configuration of a 3D space.
	var Node = Volume.Node();
	
	// Creates a new leaf matter node with the given material.
	function create(material) {
		var node = Node.leaf();
		node.material = material;
		return node;
	}
	
	// Represents empty space.
	var empty = create(Material.empty);
	
	// The offsets of the children of a node.
	var offsets = [
		[-0.25, -0.25, -0.25],
		[0.25, -0.25, -0.25],
		[-0.25, 0.25, -0.25],
		[0.25, 0.25, -0.25],
		[-0.25, -0.25, 0.25],
		[0.25, -0.25, 0.25],
		[-0.25, 0.25, 0.25],
		[0.25, 0.25, 0.25]];
	
	// Gets the permutation that sorts the components of the given vector.
	Permutation.sort = function(vec) {
		if (vec[0] < vec[1]) {
			if (vec[1] < vec[2]) {
				return Permutation.xyz;
			} else {
				if (vec[0] < vec[2]) {
					return Permutation.xzy;
				} else {
					return Permutation.zxy;
				}
			}
		} else {
			if (vec[0] < vec[2]) {
				return Permutation.yxz;
			} else {
				if (vec[1] < vec[2]) {
					return Permutation.yzx;
				} else {
					return Permutation.zyx;
				}
			}
		}
	}
	
	// Gets the surface point in the given node that is nearest to the
	// given position. Also returns the normal at that point, and the
	// signed distance to the point. Returns null if the node is completely empty. 
	// This function assumes that the node occupies the cubic area described by
	// 'Volume.Bound.unit'. The max parameter sets the maximum distance for
	// which points are considered; this is an optimization, not an absolute;
	// sometimes, points farther than the max distance will be returned.
	function near(node, pos, max) {
		if (node.depth == 0) {
			if (node === empty) {
				return null;
			} else {
				var abs = Vector.create(pos);
				Vector.abs(abs);
				
				// Find the permutation thats sorts the components of 'abs'.
				var perm = Permutation.sort(abs);
				
				// Apply that permutation and see what we get.
				abs = Permutation.apply(perm, abs);
				if (abs[1] < 0.5) {
				
					// Nearest to a face.
					var dis = abs[2] - 0.5;
					var point = Vector.create(pos);
					var norm = Vector.zero();
					if (point[perm[2]] > 0.0) {
						point[perm[2]] = 0.5;
						norm[perm[2]] = 1.0;
					} else {
						point[perm[2]] = -0.5;
						norm[perm[2]] = -1.0;
					}
					return { dis : dis, point : point, norm : norm };
				} else if (abs[0] < 0.5) {
				
					// Nearest to an edge.
					abs[1] -= 0.5; abs[2] -= 0.5;
					var dis = Math.sqrt(abs[1] * abs[1] + abs[2] * abs[2]);
					var point = Vector.create(pos);
					point[perm[1]] = (point[perm[1]] > 0.0) ? 0.5 : -0.5;
					point[perm[2]] = (point[perm[2]] > 0.0) ? 0.5 : -0.5;
					var norm = Vector.create(pos);
					Vector.sub(norm, point);
					Vector.scale(norm, 1.0 / dis);
					return { dis : dis, point : point, norm : norm };
				} else {
				
					// Nearest to a corner.
					abs[0] -= 0.5; abs[1] -= 0.5; abs[2] -= 0.5;
					var dis = Vector.length(abs);
					var point = Vector.create(pos);
					point[0] = (point[0] > 0.0) ? 0.5 : -0.5;
					point[1] = (point[1] > 0.0) ? 0.5 : -0.5;
					point[2] = (point[2] > 0.0) ? 0.5 : -0.5;
					var norm = Vector.create(pos);
					Vector.sub(norm, point);
					Vector.scale(norm, 1.0 / dis);
					return { dis : dis, point : point, norm : norm };
				}
			}
		} else {
			// Returns the result with the smaller distance.
			function minDis(a, b) {
				if (b !== null) {
					if (a === null || b.dis < a.dis) {
						return b;
					}
				}
				return a;
			}
		
			// Finds the nearest point to a child of the given node.
			function nearChild(node, index, pos, max) {
				var nPos = Vector.create(pos);
				Vector.sub(nPos, offsets[index]);
				Vector.scale(nPos, 2.0);
				var res = near(node.children[index], nPos, max * 2.0);
				if (res !== null) {
					res.dis *= 0.5;
					Vector.scale(res.point, 0.5);
					Vector.add(res.point, offsets[index]);
				}
				return res;
			}
			
			// Check if the node is within the range specified by 'max'. Approximate
			// the node as a sphere to hurry this up.
			if (isFinite(max) && Vector.length(pos) > max + 0.8660254) {
				return null;
			}
			
			// Find the closest child node.
			var x = (pos[0] > 0.0) ? 1 : 0;
			var y = (pos[1] > 0.0) ? 2 : 0;
			var z = (pos[2] > 0.0) ? 4 : 0;
			var i = x | y | z;
			
			// Check children in approximate order of closeness.
			var best = nearChild(node, i, pos, max);
			best = minDis(best, nearChild(node, i ^ 1, pos, best ? best.dis : max)); 
			best = minDis(best, nearChild(node, i ^ 2, pos, best ? best.dis : max)); 
			best = minDis(best, nearChild(node, i ^ 4, pos, best ? best.dis : max)); 
			best = minDis(best, nearChild(node, i ^ 3, pos, best ? best.dis : max));
			best = minDis(best, nearChild(node, i ^ 6, pos, best ? best.dis : max));
			best = minDis(best, nearChild(node, i ^ 5, pos, best ? best.dis : max)); 
			best = minDis(best, nearChild(node, i ^ 7, pos, best ? best.dis : max));
			
			// Return closest found point.
			return best;
		}
	}
	
	// Like 'near', but allows the position and size (edge-length) of the
	// node to be chosen.
	function nearTransformed(node, size, center, pos, max) {
		var nPos = Vector.create(pos);
		Vector.sub(nPos, center);
		Vector.scale(nPos, 1.0 / size);
		var res = near(node, nPos, max / size);
		if (res !== null) {
			res.dis *= size;
			Vector.scale(res.point, size);
			Vector.add(res.point, center);
		}
		return res;
	}
	
	// A test configuration of matter.
	this.test = (function() {
		var e = empty;
		var r = create(Material.solid(0.7, 0.3, 0.1));
		var g = create(Material.solid(0.1, 0.7, 0.3));
		var b = create(Material.solid(0.1, 0.3, 0.7));
		
		var x0 = Node.merge(b, b, b, b, e, g, e, g);
		var x1 = Node.merge(x0, x0, x0, x0, e, e, e, e);
		var x2 = Node.merge(x1, x1, x1, x1, e, e, x0, e);
		var x3 = Node.merge(x2, x2, x1, x2, e, e, e, e);
		var x4 = Node.merge(x3, x3, x3, x3, e, e, e, x2);
		var x5 = Node.merge(x4, x4, x4, x4, e, e, e, e);
		var x6 = Node.merge(x5, x5, x5, x5, e, e, e, e);
		var x7 = Node.merge(x6, x6, x6, x6, e, e, x4, e);
		var x8 = Node.merge(x7, x7, r, x5, e, e, e, e);
		var x9 = Node.merge(x8, x8, x8, x8, e, e, e, e);
		return x8;
	})();
	
	// Define exports.
	this.Node = Node;
	this.get = Node.get;
	this.merge = Node.merge;
	this.create = create;
	this.empty = empty;
	this.near = near;
	this.nearTransformed = nearTransformed;
}