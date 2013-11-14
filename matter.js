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
	
	// Gets the surface point in the given node that is nearest to the
	// given position. Also returns the normal at that point, and the
	// signed distance to the point. Returns null if the node is completely empty. 
	// This function assumes that the node occupies a cubic area described by the
	// given size and edge length.
	function near(node, size, center, pos) {
		if (node.depth == 0) {
			if (node === empty) {
				return null;
			} else {
				var hsize = size * 0.5;
				var dif = Vector.sub(pos, center);
				var abs = Vector.abs(dif);
				
				// Find the permutation thats sorts the components of 'abs'.
				var perm;
				if (abs[0] < abs[1]) {
					if (abs[1] < abs[2]) {
						perm = Permutation.xyz;
					} else {
						if (abs[0] < abs[2]) {
							perm = Permutation.xzy;
						} else {
							perm = Permutation.zxy;
						}
					}
				} else {
					if (abs[0] < abs[2]) {
						perm = Permutation.yxz;
					} else {
						if (abs[1] < abs[2]) {
							perm = Permutation.yzx;
						} else {
							perm = Permutation.zyx;
						}
					}
				}
				
				// Apply that permutation and see what we get.
				abs = Permutation.apply(perm, abs);
				if (abs[1] < hsize) {
				
					// Nearest to a face.
					var dis = abs[2] - hsize;
					var point = Vector.copy(dif);
					var norm = Vector.copy(Vector.zero);
					if (point[perm[2]] > 0.0) {
						point[perm[2]] = hsize;
						norm[perm[2]] = 1.0;
					} else {
						point[perm[2]] = -hsize;
						norm[perm[2]] = -1.0;
					}
					point = Vector.add(point, center);
					return { dis : dis, point : point, norm : norm };
				} else if (abs[0] < hsize) {
				
					// Nearest to an edge.
					abs[1] -= hsize;
					abs[2] -= hsize;
					var dis = Math.sqrt(abs[1] * abs[1] + abs[2] * abs[2]);
					var point = Vector.copy(dif);
					point[perm[1]] = (point[perm[1]] > 0.0) ? hsize : -hsize;
					point[perm[2]] = (point[perm[2]] > 0.0) ? hsize : -hsize;
					var norm = Vector.scale(Vector.sub(dif, point), 1.0 / dis);
					point = Vector.add(point, center);
					return { dis : dis, point : point, norm : norm };
				} else {
				
					// Nearest to a corner.
					abs[0] -= hsize;
					abs[1] -= hsize;
					abs[2] -= hsize;
					var dis = Vector.length(abs);
					var point = Vector.copy(dif);
					point[0] = (point[0] > 0.0) ? hsize : -hsize;
					point[1] = (point[1] > 0.0) ? hsize : -hsize;
					point[2] = (point[2] > 0.0) ? hsize : -hsize;
					var norm = Vector.scale(Vector.sub(dif, point), 1.0 / dis);
					point = Vector.add(point, center);
					return { dis : dis, point : point, norm : norm };
				}
			}
		} else {
		
			// TODO: Optimize
			var best = null;
			for (var i = 0; i < 8; i++) {
				var cur = near(node.children[i], size * 0.5,
					Vector.add(center, Vector.scale(offsets[i], size)), pos);
				if (cur !== null) {
					if (best === null || cur.dis < best.dis) {
						best = cur;
					}
				}
			}
			return best;
		}
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
		return x1;
	})();
	
	// Define exports.
	this.Node = Node;
	this.get = Node.get;
	this.merge = Node.merge;
	this.create = create;
	this.empty = empty;
	this.near = near;
}