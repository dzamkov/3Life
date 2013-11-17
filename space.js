// The names of each axis in space.
var axis = ["x", "y", "z", "w"];

// Contains functions and types related to a
// space of the given dimension.
function Space(dimension) {

	// Contains functions and values related to vectors.
	var Vector = new function() {
	
		// Creates a new zero vector.
		function zero() {
			var vec = new Array(dimension);
			for (var i = 0; i < dimension; i++) {
				vec[i] = 0.0;
			}
			return vec;
		}
	
		// Creates a vector from the given components.
		function create(components) {
			var vec = new Array(dimension);
			for (var i = 0; i < dimension; i++) {
				vec[i] = components[i];
			}
			return vec;
		}
		
		// Adds a vector to another.
		function add(a, b) {
			for (var i = 0; i < dimension; i++) {
				a[i] += b[i];
			}
		}
		
		// Subtracts a vector from another.
		function sub(a, b) {
			for (var i = 0; i < dimension; i++) {
				a[i] -= b[i];
			}
		}
		
		// Scales a vector by a given amount.
		function scale(vec, amt) {
			for (var i = 0; i < dimension; i++) {
				vec[i] *= amt;
			}
		}
		
		// Computes the absolute values of all components of a vector.
		function abs(vec) {
			for (var i = 0; i < dimension; i++) {
				vec[i] = Math.abs(vec[i]);
			}
		}
		
		// Computes the length of a vector.
		function length(vec) {
			var len = 0;
			for (var i = 0; i < dimension; i++) {
				len += vec[i] * vec[i];
			}
			return Math.sqrt(len);
		}
	
		// Define exports.
		this.zero = zero;
		this.create = create;
		this.add = add;
		this.sub = sub;
		this.abs = abs;
		this.scale = scale;
		this.length = length;
	}
	
	// Describes an orthogonal hypervolume using a min and
	// max vector. Points with all coordinates between the
	// corresponding min and max coordinates are inside the
	// bound.
	function Bound(min, max) {
		this.min = min;
		this.max = max;
	}
	
	// Define Bound functions and values.
	(function() {
		
		// Construct a unit (edge-length 1) bound centered
		// on the origin.
		var min = new Array(dimension);
		var max = new Array(dimension);
		for (var i = 0; i < dimension; i++) {
			min[i] = -0.5;
			max[i] = 0.5;
		}
		var unit = new Bound(min, max);
		
		// Constructs a bound with the coordinates given
		// by arguments.
		function create() {
			var min = new Array(dimension);
			var max = new Array(dimension);
			for (var i = 0; i < dimension; i++) {
				min[i] = arguments[i];
				max[i] = arguments[i + dimension];
			}
			return new Bound(min, max);
		}
	
		// Applies a scale, then a translation, to all points in
		// this bound.
		this.prototype.transform = function(scale, offset) {
			return new Bound(
				this.min.scale(scale).add(offset),
				this.max.scale(scale).add(offset));
		}

		// Determines whether this bound shares an edge/face with
		// a containing bound. (Pronounced like "coincide"; this is
		// indeed a pun).
		this.prototype.isCoinside = function(container) {
			for (var i = 0; i < dimension; i++) {
				if (this.min[i] == container.min[i]) return true;
				if (this.max[i] == container.max[i]) return true;
			}
			return false;
		}

		// Determines whether two bound shares an entire edge/face.
		function areAdjacent(a, b) {
			var n = 0;
			for (var i = 0; i < dimension; i++) {
				if (a.min[i] == b.min[i] && a.max[i] == b.max[i]) {
					n++;
				}
			}
			if (n == dimension - 1) {
				for (var i = 0; i < dimension; i++) {
					if (a.min[i] == b.max[i] || a.max[i] == b.min[i]) {
						return true;
					}
				}
			}
			return false;
		}
		
		// Combines two bounds to get the smallest bound which
		// contains all points in both.
		function union(a, b) {
			var min = new Array(dimension);
			var max = new Array(dimension);
			for (var i = 0; i < dimension; i++) {
				min[i] = Math.min(a.min[i], b.min[i]);
				max[i] = Math.max(a.max[i], b.max[i]);
			}
			return new Bound(min, max);
		}
		
		// Tries combining two non-intersecting bounds to get
		// their exact union. Returns null if this is not possible.
		function merge(a, b) {
			var n = 0;
			for (var i = 0; i < dimension; i++) {
				if (a.max[i] < b.min[i]) return null;
				if (a.min[i] > b.max[i]) return null;
				if (a.min[i] == b.min[i] && a.max[i] == b.max[i]) {
					n++;
				}
			}
			if (n >= dimension - 1) {
				return union(a, b);
			}
			return null;
		}
		
		// Define exports.
		this.unit = unit;
		this.create = create;
		this.areAdjacent = areAdjacent;
		this.union = union;
		this.merge = merge;
	}).call(Bound);
	
	// An array that will later contain all possible 
	// permutations of coordinates in this dimension.
	var perms = new Array();

	// Contains functions related to permutations of
	// coordinates in a vector.
	var Permutation = new function() {
	
		// Note: A permutation is represented by an where each
		// index corresponds to an axis and the value 
		// corresponds to the source axis (before permutation)
		// for that axis.
		
		// Construct all possible permutations of this dimension
		// using a recursive function (which I will not explain).
		function construct(init) {
			if (init.length >= dimension) {
				init.index = perms.length;
				perms.push(init);
			} else {
				for (var i = 0; i < dimension; i++) {
					var valid = true;
					for (var j = 0; j < init.length; j++) {
						if (init[j] == i) {
							valid = false;
							break;
						}
					}
					if (valid) {
						construct(init.concat([i]));
					}
				}
			}
		}
		construct([]);
		
		// The identity permutation (it happens to be the first one
		// constructed, but don't ask how I know this).
		var id = perms[0];
		
		// Gets the permutation like the given array.
		function get(p) {
			for (var i = 0; i < perms.length; i++) {
				var a = perms[i];
				if (p.equals(a)) return a;
			}
		}
		
		// Applies a permutation to a vector.
		function apply(p, vector) {
			var res = new Array(dimension);
			for (var i = 0; i < res.length; i++) {
				res[i] = vector[p[i]];
			}
			return res;
		}
		
		// Precompute compositions.
		var compositions = new Array(perms.length * perms.length);
		for (var i = 0; i < perms.length; i++) {
			var a = perms[i];
			for (var j = 0; j < perms.length; j++) {
				var b = perms[j];
				compositions[i + j * perms.length] = get(apply(b, a));
			}
		}
		
		// Composes two permutations, returning a permutation that first
		// applies the first, then applies the second.
		function compose(a, b) {
			return compositions[a.index + b.index * perms.length];
		}
		
		// Precompute inverses.
		for (var i = 0; i < perms.length; i++) {
			var a = perms[i];
			var inv = new Array(dimension);
			for (var j = 0; j < dimension; j++) {
				inv[a[j]] = j;
			}
			a.inverse = get(inv);
		}
		
		// Gets the inverse of a permutation.
		function inverse(p) {
			return p.inverse;
		}

		// Create names for permutations.
		for (var i = 0; i < perms.length; i++) {
			var p = perms[i];
			var parts = p.map(function(x) { return axis[x]; });
			var name = "".concat.apply("", parts);
			this[name] = p;
			p.name = name;
		}
		
		// Define exports.
		this.identity = id;
		this.get = get;
		this.inverse = inverse;
		this.apply = apply;
		this.compose = compose;
	}
	
	// Calculate the length of all nodes of this dimension.
	var size = 1 << dimension;
	
	// Constructs a type that represents a subdivided hypercube in this space.
	// The hypercube is divided into two halves on each axis and stores a 
	// description of the contents of each sector in the resulting subdivision.
	function Node() {
	
		// Constructs a node.
		function _Node(children, isLeaf) {
			this.children = children;
			this.depth = 0;
			if (!isLeaf) {
				this.depth = -1;
				for (var i = 0; i < children.length; i++) {
					this.depth = Math.max(this.depth, children[i].depth);
				}
				this.depth++;
			}
		}
		
		// Use a HashMap to store all nodes by their children.
		var nodesByChildren = new HashMap(13 << size);
		
		// Creates a new unique leaf node, a node that can not be decomposed
		// by recursion. For convenience, all children of a leaf node are
		// set to the node itself.
		function leaf() {
			var children = new Array(size);
			var node = new _Node(children, true);
			for (var i = 0; i < size; i++) {
				children[i] = node;
			}
			nodesByChildren.set(children, node);
			return node;
		}
		
		// Gets a node that has the given spatial children.
		function get(children) {
			return nodesByChildren.lookup(children, function(children) {
				return new _Node(children, false);
			});
		}
		
		// Like get, but accepts the children as arguments instead of
		// an array.
		function merge() {
			var children = new Array(size);
			for (var i = 0; i < size; i++) {
				children[i] = arguments[i];
			}
			return get(children);
		}
		
		// Define node functions.
		(function() {
		
			// Replaces all occurences of a given leaf node in this node
			// with another leaf node.
			this.prototype.replace = function(from, to) {
				if (this === from) return to;
				if (this.depth == 0) return this;
				function replaceChild(source) { return source.replace(from, to); };
				return get(this.children.map(replaceChild));
			}
			
			// Maps all leaf nodes of this node using the given function.
			this.prototype.map = function(map) {
				if (this.depth == 0) return map(this);
				function mapChild(source) { return source.map(map); };
				return get(this.children.map(mapChild));
			}
			
		}).call(_Node);
		
		// Define type exports.
		var Node = { };
		Node.leaf = leaf;
		Node.get = get;
		Node.merge = merge;
		return Node;
	}
	
	// A node type whose leaves are boolean values.
	var Boolean = Node();
	Boolean.true = Boolean.leaf();
	Boolean.false = Boolean.leaf();
	delete Boolean.leaf;
	
	// Contains the offsets of the centers of child nodes from their parent, assuming
	// the parent occupies the hyper-volume defined by 'Bound.unit'.
	var offsets = new Array(size);
	for (var i = 0; i < size; i++) {
		offsets[i] = new Array(dimension);
		for (var j = 0; j < dimension; j++) {
			offsets[i][j] = ((i & (1 << j)) != 0) ? 0.25 : -0.25;
		}
	}
	
	// Gets the offset for a child node of the given index of
	// a parent node with the given scale and offset.
	function getOffset(scale, offset, index) {
		var nOffset = Vector.create(offsets[index]);
		Vector.scale(nOffset, scale);
		Vector.add(nOffset, offset);
		return nOffset;
	}
	
	// Define module exports.
	var Space = { };
	Space.Vector = Vector;
	Space.Bound = Bound;
	Space.Permutation = Permutation;
	Space.Node = Node;
	Space.Boolean = Boolean;
	Space.dimension = dimension;
	Space.vec = Vector.create;
	Space.offsets = offsets;
	Space.getOffset = getOffset;
	return Space;
};

// Construct default spaces.
var Area = Space(2);
var Volume = Space(3);
var Rect = Area.Bound;

// Define Volume-specific functions.
(function() {

	// Get 3-Space modules.
	var Vector = this.Vector;
	var Permutation = this.Permutation;
	var offsets = this.offsets;

	// Gets the permutation that sorts the components of the given vector.
	function sort(vec) {
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

	// Gets the point nearest to the given position that is on a leaf node which
	// satisfies the given predicate. Also returns the normal at that point, and the
	// signed distance to the point. Returns null if the node is completely empty. 
	// This function assumes that the node occupies the cubic area described by
	// 'Volume.Bound.unit'. The max parameter sets the maximum distance for
	// which points are considered; this is an optimization, not an absolute;
	// sometimes, points farther than the max distance will be returned.
	function near(pred, node, pos, max) {
		if (node.depth == 0) {
			if (!pred(node)) {
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
			function nearChild(pred, node, index, pos, max) {
				var nPos = Vector.create(pos);
				Vector.sub(nPos, offsets[index]);
				Vector.scale(nPos, 2.0);
				var res = near(pred, node.children[index], nPos, max * 2.0);
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
			var best = nearChild(pred, node, i, pos, max);
			best = minDis(best, nearChild(pred, node, i ^ 1, pos, best ? best.dis : max)); 
			best = minDis(best, nearChild(pred, node, i ^ 2, pos, best ? best.dis : max)); 
			best = minDis(best, nearChild(pred, node, i ^ 4, pos, best ? best.dis : max)); 
			best = minDis(best, nearChild(pred, node, i ^ 3, pos, best ? best.dis : max));
			best = minDis(best, nearChild(pred, node, i ^ 6, pos, best ? best.dis : max));
			best = minDis(best, nearChild(pred, node, i ^ 5, pos, best ? best.dis : max)); 
			best = minDis(best, nearChild(pred, node, i ^ 7, pos, best ? best.dis : max));
			
			// Return closest found point.
			return best;
		}
	}
	
	// Like 'near', but allows the position and size (edge-length) of the
	// node to be chosen.
	function nearTransformed(pred, node, size, center, pos, max) {
		var nPos = Vector.create(pos);
		Vector.sub(nPos, center);
		Vector.scale(nPos, 1.0 / size);
		var res = near(pred, node, nPos, max / size);
		if (res !== null) {
			res.dis *= size;
			Vector.scale(res.point, size);
			Vector.add(res.point, center);
		}
		return res;
	}
	
	// TODO: Use 'Volume.getOffset' for 'nearChild' and 'nearTransformed'.

	// Define exports.
	this.Permutation.sort = sort;
	this.near = near;
	this.nearTransformed = nearTransformed;
	
}).call(Volume);