// Contains functions and types related to space.
var Space = new function() {

	// The names of each axis in space.
	var Axis = ["x", "y", "z", "w"];

	// Constructs a type/enum for a permutation of 
	// the axes of the given dimension. A permutation is
	// represented by an array where each index corresponds
	// to an axis and the value corresponds to the source
	// axis (before permutation) for that axis.
	function Permutation(dimension) {
		
		// Construct all possible permutations of this dimension
		// using a recursive function (which I will not explain).
		var all = new Array();
		function construct(init) {
			if (init.length >= dimension) {
				init.index = all.length;
				all.push(init);
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
		var id = all[0];
		
		// Applies a permutation to a vector.
		function apply(perm, vector) {
			var res = new Array(dimension);
			for (var i = 0; i < res.length; i++) {
				res[i] = vector[perm[i]];
			}
			return res;
		}
		
		// Precompute compositions.
		var compositions = new Array(all.length * all.length);
		for (var i = 0; i < all.length; i++) {
			var a = all[i];
			for (var j = 0; j < all.length; j++) {
				var b = all[j];
				var res = apply(b, a);
				for (var k = 0; k < all.length; k++) {
					var c = all[k];
					if (res.same(c)) {
						compositions[i + j * all.length] = c;
						break;
					}
				}
			}
		}
		
		// Composes two permutations, returning a permutation that first
		// applies the first, then applies the second.
		function compose(a, b) {
			return compositions[a.index + b.index * all.length];
		}
		
		// Precompute inverses.
		for (var i = 0; i < all.length; i++) {
			var a = all[i];
			var res = new Array(dimension);
			for (var j = 0; j < dimension; j++) {
				res[a[j]] = j;
			}
			for (var k = 0; k < all.length; k++) {
				var c = all[k];
				if (res.same(c)) {
					a.inverse = c;
				}
			}
		}
		
		// Gets the inverse of a permutation.
		function inverse(perm) {
			return perm.inverse;
		}
		
		// Create names for permutations.
		for (var i = 0; i < all.length; i++) {
			var perm = all[i];
			var parts = perm.map(function(x) { return Axis[x]; });
			var name = "".concat.apply("", parts);
			perm.name = name;
			all[name] = perm;
		}
		
		// Define type functions.
		var Permutation = all;
		Permutation.identity = id;
		Permutation.inverse = inverse;
		Permutation.apply = apply;
		Permutation.compose = compose;
		return Permutation;
	}
	
	// Define module exports.
	this.Axis = Axis;
	this.Permutation = Permutation;
};