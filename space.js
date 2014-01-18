// The names of each axis in space.
var axis = ["x", "y", "z", "w"];

// Contains functions and types related to a
// space of the given dimension.
function Space(dimension) {

	// Contains functions and values related to vectors.
	var Vector = new function() {
	
		// The zero vector.
		var zero = new Array(dimension);
		for (var i = 0; i < dimension; i++) {
			zero[i] = 0.0;
		}
		
		// Creates a vector from its components.
		function create(components) {
			var res = new Array(dimension);
			for (var i = 0; i < dimension; i++) {
				res[i] = components[i];
			}
			return res;
		}
		
		// Adds two vectors together.
		function add(a, b) {
			var res = new Array(dimension);
			for (var i = 0; i < dimension; i++) {
				res[i] = a[i] + b[i];
			}
			return res;
		}
		
		// Subtracts two vectors.
		function sub(a, b) {
			var res = new Array(dimension);
			for (var i = 0; i < dimension; i++) {
				res[i] = a[i] - b[i];
			}
			return res;
		}
		
		// Create named unit vectors.
		var unit = new Array(dimension * 2);
		for (var i = 0; i < dimension; i++) {
			var vec = new Array(dimension);
			for (var j = 0; j < dimension; j++) {
				vec[j] = (i == j) ? 1.0 : 0.0;
			}
			this[axis[i]] = vec;
			unit[i] = vec;
			unit[i + dimension] = sub(zero, vec);
		}
		
		// Gets a specific unit vector for this dimension.
		function getUnit(axis, up) {
			return unit[up ? axis : (axis) + dimension];
		}
		
		// Scales a vector by a given amount.
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
		
		// Computes the dot product between two vectors.
		function dot(a, b) {
			var res = 0;
			for (var i = 0; i < dimension; i++) {
				res += a[i] * b[i];
			}
			return res;
		}
		
		// Computes the length of a vector.
		function len(vec) {
			return Math.sqrt(dot(vec, vec));
		}
		
		// Applies a scale, then a translation, to the given vector.
		function transform(vec, scale, offset) {
			var res = new Array(dimension);
			for (var i = 0; i < dimension; i++) {
				res[i] = vec[i] * scale + offset[i];
			}
			return res;
		}
		
		// Normalizes a vector.
		function normalize(vec) {
			return scale(vec, 1.0 / len(vec));
		}
		
		// Projects a vector to the next lower dimension along
		// the given axis.
		function proj(vec, axis) {
			var res = new Array(dimension - 1);
			for (var i = 0; i < res.length; i++) {
				res[i] = vec[(axis + i + 1) % dimension];
			}
			return res;
		}
		
		// Projects a vector from the next lower dimension by specifying
		// a component value for an axis.
		function unproj(vec, axis, pos) {
			var res = new Array(dimension);
			res[axis] = pos;
			for (var i = 0; i < vec.length; i++) {
				res[(axis + i + 1) % dimension] = vec[i];
			}
			return res;
		}
		
		// Aligns the given vector to grid with units of the given scale. The
		// returned vector will be the minimum point on the unit the vector is in.
		function align(vec, scale) {
			var res = new Array(dimension);
			for (var i = 0; i < vec.length; i++) {
				res[i] = scale * Math.floor(vec[i] / scale);
			}
			return res;
		}
	
		// Define exports.
		this.zero = zero;
		this.create = create;
		this.getUnit = getUnit;
		this.add = add;
		this.sub = sub;
		this.abs = abs;
		this.scale = scale;
		this.dot = dot;
		this.len = len;
		this.transform = transform;
		this.normalize = normalize;
		this.proj = proj;
		this.unproj = unproj;
		this.align = align;
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
		
		// Construct a unit (edge-length 1) bound with its minimum point on the origin.
		// This defines the local coordinate system for a node of this dimension.
		var max = new Array(dimension);
		for (var i = 0; i < dimension; i++) max[i] = 1.0;
		var unit = new Bound(Vector.zero, max);
		
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
		
		// Gets the size of this bound as a vector.
		this.prototype.getSize = function() {
			return Vector.sub(this.max, this.min);
		}
		
		// Gets the location of a corner on this bound.
		this.prototype.getCorner = function(index) {
			var res = new Array(dimension);
			for (var i = 0; i < res.length; i++) {
				res[i] = ((index & (1 << i)) != 0) ?
					this.max[i] : this.min[i];
			}
			return res;
		}
		
		// Sets the location of a corner on this bound, returning
		// the bound that results.
		this.prototype.setCorner = function(index, vec) {
			var min = new Array(dimension);
			var max = new Array(dimension);
			for (var i = 0; i < vec.length; i++) {
				if ((index & (1 << i)) != 0) {
					min[i] = this.min[i];
					max[i] = vec[i];
				} else {
					min[i] = vec[i];
					max[i] = this.max[i];
				}
			}
			return new Bound(min, max);
		}
		
		// Applies a scale, then a translation, to all points in
		// this bound.
		this.prototype.transform = function(scale, offset) {
			return new Bound(
				Vector.transform(this.min, scale, offset),
				Vector.transform(this.max, scale, offset));
		}
		
		// Determines whether this bound fully contains the given bound.
		this.prototype.contains = function(other) {
			for (var i = 0; i < dimension; i++) {
				if (this.min[i] > other.min[i]) return false;
				if (this.max[i] < other.max[i]) return false;
			}
			return true;
		}
		
		// Determines whether this bound intersects the given bound.
		this.prototype.intersects = function(other) {
			for (var i = 0; i < dimension; i++) {
				if (this.min[i] >= other.max[i]) return false;
				if (this.max[i] <= other.min[i]) return false;
			}
			return true;
		}

		// Determines whether this bound shares an edge/face with
		// a containing bound. (Pronounced like "coincide". this is
		// indeed a pun).
		this.prototype.isCoinside = function(container) {
			for (var i = 0; i < dimension; i++) {
				if (this.min[i] == container.min[i]) return true;
				if (this.max[i] == container.max[i]) return true;
			}
			return false;
		}
		
		// Projects a bound to the next lower dimension along
		// the given axis.
		this.prototype.proj = function(axis) {
			var bound = Space.get(dimension - 1).Bound;
			return new bound(
				Vector.proj(this.min, axis),
				Vector.proj(this.max, axis));
		}
		
		// Projects a bound to the next higher dimension by specifying
		// a min and max values for an axis.
		this.prototype.unproj = function(axis, min, max) {
			var space = Space.get(dimension + 1);
			var bound = space.Bound;
			var vector = space.Vector;
			return new bound(
				vector.unproj(this.min, axis, min),
				vector.unproj(this.max, axis, max));
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
		
		// Determines whether the given array is like the given permutation.
		function like(p, a) {
			for (var j = 0; j < a.length; j++) {
				if (a[j] != p[j]) return false;
			}
			return true;
		}
		
		// Gets the permutation like the given array.
		function get(p) {
			for (var i = 0; i < perms.length; i++) {
				var a = perms[i];
				if (like(p, a)) return a;
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
	
	// Calculate the amount of children each node in this dimension has.
	var size = 1 << dimension;
	
	// Contains the offsets of the centers of child nodes from their parent, assuming
	// the parent occupies the hyper-volume defined by 'Bound.unit'.
	var offsets = new Array(size);
	for (var i = 0; i < size; i++) {
		offsets[i] = new Array(dimension);
		for (var j = 0; j < dimension; j++) {
			offsets[i][j] = ((i & (1 << j)) != 0) ? 0.5 : 0.0;
		}
	}
	
	// Contains the inverses of the offsets in 'offsets'.
	var iOffsets = offsets.map(function(vec) { return Vector.scale(vec, -2.0); });
	
	// Gets the offset for a child node of the given index of
	// a parent node with the given scale and offset.
	function getOffset(scale, offset, index) {
		return Vector.add(Vector.scale(offsets[index], scale), offset);
	}
	
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
				var children = new Array(size);
				for (var i = 0; i < children.length; i++)
					children[i] = this.children[i].replace(from, to);
				return get(children);
			}
			
			// Maps all leaf nodes of this node using the given function.
			this.prototype.map = function(map) {
				if (this.depth == 0) return map(this);
				var children = new Array(size);
				for (var i = 0; i < children.length; i++)
					children[i] = this.children[i].map(map);
				return get(children);
			}
			
			// Replaces all sub-nodes within the given bound (in unit coordinates) with
			// the corresponding sub-nodes from the given target node.
			this.prototype.splice = function(bound, target) {
				if (bound.contains(Bound.unit)) return target;
				if (bound.intersects(Bound.unit)) {
					var children = new Array(size);
					for (var i = 0; i < children.length; i++) {
						children[i] = this.children[i].splice(
							bound.transform(2.0, iOffsets[i]),
							target.children[i]);
					}
					return get(children);
				} else return this;
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
	
	// Define exports.
	this.Vector = Vector;
	this.Bound = Bound;
	this.Permutation = Permutation;
	this.Node = Node;
	this.Boolean = Boolean;
	this.dimension = dimension;
	this.vec = Vector.create;
	this.offsets = offsets;
	this.iOffsets = iOffsets;
	this.getOffset = getOffset;
};

// Define 'Space' functions.
(function() {

	// Preconstructed spaces for various dimensions.
	var spaces = new Array();
	
	// Gets a space for the given dimension.
	function get(dimension) {
		var space = spaces[dimension];
		if (space) return space; else {
			return spaces[dimension] = new Space(dimension);
		}
	}
	
	// Define exports.
	this.get = get;
}).call(Space);

// Construct default spaces.
var Area = Space.get(2);
var Volume = Space.get(3);
var Rect = Area.Bound;
var Vec2 = Area.Vector;
var Vec3 = Volume.Vector;

// Define Volume-specific functions.
(function() {

	// Get 3-Space modules.
	var Vector = this.Vector;
	var Permutation = this.Permutation;
	var offsets = this.offsets;
	
	// Gets the cross product of two vectors.
	function cross(a, b) {
		return [
			a[1] * b[2] - a[2] * b[1],
			a[2] * b[0] - a[0] * b[2],
			a[0] * b[1] - a[1] * b[0]];
	}
	
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
	
	// The most trivial of 'near' class of functions. This returns the point, the normal
	// between the point and the given position, and the distance between the point
	// and the position.
	function nearPoint(point, pos) {
		var dif = Vec3.sub(pos, point);
		var dis = Vec3.len(dif);
		return {
			dis : dis,
			point : point,
			norm : Vec3.scale(dif, 1.0 / dis)
		}
	}
	
	// Gets information about the nearest point on the given axial line to the given
	// position.
	function nearAxialLine(axis, pPoint, pos) {
		var pPos = Vec3.proj(pos, axis);
		var pDif = Vec2.sub(pPos, pPoint);
		var dis = Vec2.len(pDif);
		return {
			dis : dis,
			point : Vec3.unproj(pPoint, axis, pos[axis]),
			norm : Vec3.unproj(Vec2.scale(pDif, 1.0 / dis), axis, 0.0)
		}
	}
	
	// Gets information about the nearest point on the given axial plane to the given
	// position.
	function nearAxialPlane(axis, val, pos) {
		var point = Vec3.create(pos);
		point[axis] = val;
		return {
			dis : Math.abs(pos[axis] - val),
			point : point,
			norm : Vec3.getUnit(axis, pos[axis] > val)
		}
	}
	
	// Gets the point nearest to a leaf node of the given node for which the given
	// predicate returns true.
	function nearNode(pred, node, scale, offset, pos, max) {
		if (node.depth == 0) {
			if (!pred(node)) {
				return null;
			} else {
				function inside(pos) {
					var minDis = Infinity;
					var axis = 0;
					for (var i = 0; i < 3; i++) {
						var dis = Math.abs(pos[i] - offset[i] - scale * 0.5);
						if (dis < minDis) {
							minDis = dis;
							axis = i;
						}
					}
					minDis -= scale * 0.5;
					var point = Vec3.create(pos);
					var flip = pos[axis] > offset[axis] + scale * 0.5;
					point[axis] = offset[axis];
					if (flip) point[axis] += scale;
					return {
						dis : minDis,
						point : point,
						norm : Vec3.getUnit(axis, flip)
					}
				}
				
				var nx = offset[0]; var px = nx + scale;
				var ny = offset[1]; var py = ny + scale;
				var nz = offset[2]; var pz = nz + scale;
				
				var type = 0;
				if (pos[0] > px) type += 2;
				else if (pos[0] > nx) type += 1;
				if (pos[1] > py) type += 6;
				else if (pos[1] > ny) type += 3;
				if (pos[2] > pz) type += 18;
				else if (pos[2] > nz) type += 9;
				
				switch(type) {
					case 0: return nearPoint([nx, ny, nz], pos);
					case 1: return nearAxialLine(0, [ny, nz], pos);
					case 2: return nearPoint([px, ny, nz], pos);
					case 3: return nearAxialLine(1, [nz, nx], pos);
					case 4: return nearAxialPlane(2, nz, pos);
					case 5: return nearAxialLine(1, [nz, px], pos);
					case 6: return nearPoint([nx, py, nz], pos);
					case 7: return nearAxialLine(0, [py, nz], pos);
					case 8: return nearPoint([px, py, nz], pos);
					case 9: return nearAxialLine(2, [nx, ny], pos);
					case 10: return nearAxialPlane(1, ny, pos);
					case 11: return nearAxialLine(2, [px, ny], pos);
					case 12: return nearAxialPlane(0, nx, pos);
					case 13: return inside(pos);
					case 14: return nearAxialPlane(0, px, pos);
					case 15: return nearAxialLine(2, [nx, py], pos);
					case 16: return nearAxialPlane(1, py, pos);
					case 17: return nearAxialLine(2, [px, py], pos);
					case 18: return nearPoint([nx, ny, pz], pos);
					case 19: return nearAxialLine(0, [ny, pz], pos);
					case 20: return nearPoint([px, ny, pz], pos);
					case 21: return nearAxialLine(1, [pz, nx], pos);
					case 22: return nearAxialPlane(2, pz, pos);
					case 23: return nearAxialLine(1, [pz, px], pos);
					case 24: return nearPoint([nx, py, pz], pos);
					case 25: return nearAxialLine(0, [py, pz], pos); 
					case 26: return nearPoint([px, py, pz], pos);
				}
			}
		} else {
			
			// Check if the node is within the range specified by 'max'. Approximate
			// the node as a sphere to hurry this up.
			var hscale = scale * 0.5;
			var dx = pos[0] - offset[0] - hscale;
			var dy = pos[1] - offset[1] - hscale;
			var dz = pos[2] - offset[2] - hscale;
			if (isFinite(max)) {
				var maxRadius = max + 0.8660254 * scale;
				if (dx * dx + dy * dy + dz * dz > maxRadius * maxRadius) {
					return null;
				}
			}
			
			// Find the closest child node.
			var x = (dx > 0.0) ? 1 : 0;
			var y = (dy > 0.0) ? 2 : 0;
			var z = (dz > 0.0) ? 4 : 0;
			var i = x | y | z;
			
			// Check children in approximate order of closeness.
			var bestDis = max;
			var best = nearNode(pred, node.children[i], hscale, 
				Volume.getOffset(scale, offset, i), pos, max);
			if (best) bestDis = best.dis;
			for (var j = 1; j < 8; j++) {
				var k = i ^ j;
				var val = nearNode(pred, node.children[k], hscale,
					Volume.getOffset(scale, offset, k), pos, max);
				if (val !== null && val.dis < bestDis) {
					best = val;
					bestDis = val.dis;
				}
			}
			
			// Return closest found point.
			return best;
		}
	}
	
	// Returns information about the intersection between a ray and a plane, or null
	// if there is no intersection.
	function tracePlane(axis, val, pos, dir) {
		var aDir = dir[axis];
		if (aDir == 0.0) return null;
		var aDis = val - pos[axis];
		if ((aDir > 0.0) != (aDis >= 0.0)) return null;
		var pPos = Vec3.proj(pos, axis);
		var pDir = Vec3.proj(dir, axis);
		var pDis = aDis / aDir;
		
		// TODO: return null if ray is going in the wrong direction.
		var param = Vec2.add(pPos, Vec2.scale(pDir, pDis));
		var point = Vec3.unproj(param, axis, val);
		var norm = Vec3.getUnit(axis, aDir < 0.0);
		var dis = Math.sqrt(pDis * pDis + aDis * aDis);
		return { dis : dis, point : point, norm : norm, param : param };
	}
	
	// Returns information about the intersection between a ray and a sphere, or null
	// if there is no intersection.
	function traceSphere(center, radius, pos, dir) {
		var dPos = Vec3.sub(pos, center);
		var w = Vec3.dot(dir, dPos);
		var det = w * w - Vec3.dot(dPos, dPos) + radius * radius;
		if (det < 0.0) return null;
		var dis = -w - Math.sqrt(det);
		var point = Vec3.add(pos, Vec3.scale(dir, dis));
		var norm = Vec3.normalize(Vec3.sub(point, center));
		return { dis : dis, point : point, norm : norm };
	}
	
	// Finds the closest points between two lines, their parameters, and their distance.
	function traceLine(aPos, aDir, bPos, bDir) {
		var v = Vec3.dot(aDir, bDir);
		var dif = Vec3.sub(bPos, aPos);
		var al = Vec3.dot(aDir, dif);
		var bl = Vec3.dot(bDir, dif);
		var den = v * v - 1.0;
		var aParam = (v * bl - al) / den;
		var bParam = (bl - v * al) / den;
		var aPoint = Vec3.add(aPos, Vec3.scale(aDir, aParam));
		var bPoint = Vec3.add(bPos, Vec3.scale(bDir, bParam));
		var dis = Vec3.len(Vec3.sub(aPoint, bPoint));
		return { dis : dis, aParam : aParam, bParam : bParam, 
			aPoint : aPoint, bPoint : bPoint };
	}

	// Define exports.
	this.Vector.cross = cross;
	this.Permutation.sort = sort;
	this.nearPoint = nearPoint;
	this.nearAxialLine = nearAxialLine;
	this.nearAxialPlane = nearAxialPlane;
	this.nearNode = nearNode;
	this.tracePlane = tracePlane;
	this.traceSphere = traceSphere;
	this.traceLine = traceLine;
}).call(Volume);