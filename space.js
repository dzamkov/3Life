// The names of each axis in space.
var axis = ["x", "y", "z", "w"];

// Contains functions and types related to a
// space of the given dimension.
function Space(dimension) {

	// Contains functions and values related to vectors.
	var Vector = new function() {
	
		// Construct the zero vector.
		var zero = new Array(dimension);
		for (var i = 0; i < dimension; i++) {
			zero[i] = 0.0;
		}
	
		// Constructs a vector with the coordinates given
		// by arguments.
		function create() {
			return arguments;
		}
		
		// Creates a copy of the given vector.
		function copy(vec) {
			var res = new Array(dimension);
			for (var i = 0; i < dimension; i++) {
				res[i] = vec[i];
			}
			return res;
		}
		
		// Non-destructively adds two vectors.
		function add(a, b) {
			var res = new Array(dimension);
			for (var i = 0; i < dimension; i++) {
				res[i] = a[i] + b[i];
			}
			return res;
		}
		
		// Non-destructively subtracts a vector from another.
		function sub(a, b) {
			var res = new Array(dimension);
			for (var i = 0; i < dimension; i++) {
				res[i] = a[i] - b[i];
			}
			return res;
		}
		
		// Non-destructively scales a vector by a given amount.
		function scale(vec, amt) {
			var res = new Array(dimension);
			for (var i = 0; i < dimension; i++) {
				res[i] = vec[i] * amt;
			}
			return res;
		}
		
		// Computes the absolute values of all components of a vector.
		function abs(vec) {
			var res = new Array(dimension);
			for (var i = 0; i < dimension; i++) {
				res[i] = Math.abs(vec[i]);
			}
			return res;
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
		this.copy = copy;
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
	
	// Define module exports.
	var Space = { };
	Space.Vector = Vector;
	Space.Bound = Bound;
	Space.Permutation = Permutation;
	Space.Node = Node;
	Space.Boolean = Boolean;
	Space.dimension = dimension;
	Space.vec = Vector.create;
	return Space;
};

// Construct default spaces.
var Area = Space(2);
var Volume = Space(3);
var Rect = Area.Bound;