
// Describes the progression rules for cells within a 3D cellular
// automata. States are represented as consecutive integers starting
// at zero. The given 'transition' function will take a 27-state array
// representing a 3x3x3 neighborhood of cells and compute the next 
// state for the center cell.
function Rule(states, transition) {
	this.states = states;
	this.transition = transition;
}

// TODO: don't restrict state values to integers, and dont require
// a finite number of states.

// Define rule functions and types.
(function() {
	
	// 3D game of life rule.
	var gol = new Rule(2, function(b) {
		var n = 0;
		for(var i = 0; i < 27; i++) {
			if (i == 13) continue; // Center cell
			if (b[i] == 1) n++;
		}
		if (b[13]) {
			return (n == 2 || n == 3) ? 1 : 0;
		} else {
			return (n == 3) ? 1 : 0;
		}
	});

	// Define exports.
	this.gol = gol;
}).call(Rule);


// Contains functions and types related to 3D cellular automata
// with a particular Rule.
function Automata(rule) {

	// A node representing the configuration of states in a volume.
	// Note that a Node does not specify the size of the pattern; e.g.
	// a leaf node can represent a single cell, or a 4x4x4 block of cells.
	var Node = Volume.Node();
	
	// Construct leaf nodes for states.
	var stateNodes = new Array(rule.states);
	for (var i = 0; i < stateNodes.length; i++) {
		stateNodes[i] = Node.leaf();
		stateNodes[i].state = i;
	}
	delete Node.leaf;
	
	// Gets the node for the given state.
	function lookup(state) {
		return stateNodes[state];
	}
	
	// Gets a 2x2x2 node representing the state of the center of the given
	// 4x4x4 node after one iteration. The supplied node must have a depth
	// of at most 2.
	function computeNextBase(node) {
	
		// TODO: inlining, lots of it. Could probably come up with a tool
		// or something to inline this node computation stuff.

		// Create a flat array describing the source node.
		var s = new Array(64);
		for (var i = 0; i < 64; i++) {
			var minor = i & 7;
			var major = (i & 56) >> 3;
			var v = node.children[major].children[minor].state;
			var x = ((major & 1) << 1) | (minor & 1);
			var y = (major & 2) | ((minor & 2) >> 1);
			var z = ((major & 4) >> 1) | ((minor & 4) >> 2);
			s[x | (y << 2) | (z << 4)] = v;
		}
		
		// Compute children then.
		var n = new Array(27);
		var children = new Array(8);
		for (var i = 0; i < 8; i++) {
			for (var x = 0; x < 3; x++) {
				for (var y = 0; y < 3; y++) {
					for (var z = 0; z < 3; z++) {
						var nx = x + (i & 1);
						var ny = y + ((i & 2) >> 1);
						var nz = z + ((i & 4) >> 2);
						n[x + (y * 3) + (z * 9)] = s[nx | (ny << 2) | (nz << 4)];
					}
				}
			}
			children[i] = lookup(rule.transition(n));
		}
		
		// All done.
		return Node.get(children);
	}
	
	
	// Computes the general case of 'next', without accessing the cache.
	function computeNext(node, depth, iters) {
		if (iters == 0) {
			var children = new Array(8);
			for (var i = 0; i < 8; i++) {
				children[i] = node.children[i].children[i ^ 7];
			}
			return Node.get(children);
		} else if (depth == 2) {
			return computeNextBase(node);
		} else {
		
			// Create a flat array of the '2^(d-2)' nodes.
			var s = new Array(64);
			for (var i = 0; i < 64; i++) {
				var minor = i & 7;
				var major = (i & 56) >> 3;
				var v = node.children[major].children[minor];
				var x = ((major & 1) << 1) | (minor & 1);
				var y = (major & 2) | ((minor & 2) >> 1);
				var z = ((major & 4) >> 1) | ((minor & 4) >> 2);
				s[x | (y << 2) | (z << 4)] = v;
			}
			
			// Get the '2^(d-2)' nodes for the first set of iterations.
			var fdepth = depth - 1;
			var fiters = Math.min(iters, 1 << (depth - 3));
			var n = new Array(27);
			for (var x = 0; x < 3; x++) {
				for (var y = 0; y < 3; y++) {
					for (var z = 0; z < 3; z++) {
						var b = x | (y << 2) | (z << 4);
						
						// TODO: 8 of 27 calls to merge here are unnecessary.
						n[x + (y * 3) + (z * 9)] = next(Node.get([
							s[b], s[b + 1], s[b + 4], s[b + 5],
							s[b + 16], s[b + 17], s[b + 20], s[b + 21]]),
							fdepth, fiters);
					}
				}
			}
			
			// Get the '2^(d-2)' nodes for the second set of iterations.
			var sdepth = depth - 1;
			var siters = iters - fiters;
			var t = new Array(8);
			for (var i = 0; i < 8; i++) {
				var b = (i & 1) + (((i & 2) >> 1) * 3) + (((i & 4) >> 2) * 9);
				t[i] = next(Node.get([
					n[b], n[b + 1], n[b + 3], n[b + 4],
					n[b + 9], n[b + 10], n[b + 12], n[b + 13]]),
					sdepth, siters);
			}
			
			return Node.get(t);
		}
	}
	
	// Gets a '2^(d-1)' node representing the state of the center of the given
	// '2^d' node after the given amount iterations. The 'd' is the given 
	// "actual" depth of the node, which must be at least 'node.depth'. The
	// number of iterations must not exceed '2^(d-2)'.
	function next(node, depth, iters) {
	
		// TODO: fix this inefficient mess of caching. If 'iters' is high, the 
		// resulting cache array will be very big and very empty.
	
		// Make sure to save and use work we've already done.
		var depthOffset = depth - node.depth;
		if (node.next) {
			if (node.next[depthOffset]) {
				if (node.next[depthOffset][iters]) {
					return node.next[depthOffset][iters];
				} else {
					return node.next[depthOffset][iters] = computeNext(node, depth, iters);
				}
			} else {
				node.next[depthOffset] = new Array();
				return node.next[depthOffset][iters] = computeNext(node, depth, iters);
			}
		} else {
			node.next = new Array();
			node.next[depthOffset] = new Array();
			return node.next[depthOffset][iters] = computeNext(node, depth, iters);
		}
	}
	
	// Gets a node representing a progressed state of the given node when in a medium
	// of the given state. The "actual" depth of the node must be given, and must be
	// at least 'node.depth'. This function can compute up to '2^d' iterations foward.
	function nextInPlace(node, medium, depth, iters) {
		var node = node;
		var m = lookup(medium);
		node = Node.merge(node, m, m, m, m, m, m, m);
		node = Node.merge(m, m, m, m, m, m, m, node);
		return next(node, depth + 2, iters).children[7];
	}
	
	// Define exports.
	var Automata = { };
	Automata.Node = Node;
	Automata.get = Node.get;
	Automata.merge = Node.merge;
	Automata.lookup = lookup;
	Automata.next = next;
	Automata.nextInPlace = nextInPlace;
	return Automata;
}

// Test GOL.
var Gol = Automata(Rule.gol);
Gol.dead = Gol.lookup(0);
Gol.live = Gol.lookup(1);
Gol.test = (function() {
	var d = Gol.lookup(0);
	var l = Gol.lookup(1);
	var x0 = Gol.merge(d, d, d, l, d, d, d, l);
	var x1 = Gol.merge(d, d, d, d, d, d, d, l);
	var x2 = Gol.merge(x1, d, d, d, x0, d, d, d);
	var x3 = Gol.merge(d, d, d, x2, d, d, d, d);
	var x4 = Gol.merge(d, d, d, d, x3, d, d, d);
	var x5 = Gol.merge(d, d, d, x4, d, d, d, d);
	var x6 = Gol.merge(d, d, d, d, x5, d, d, d);
	var x7 = Gol.merge(d, d, d, x6, d, d, d, d);
	return x7;
})();
Gol.getMatter = function(node) {
	return node.map(function(leaf) {
		if (leaf === Gol.dead) return Gol.getMatter.dead;
		if (leaf === Gol.live) return Gol.getMatter.live;
	});
}
Gol.getMatter.dead = Matter.empty;
delay(Texture.metal, function(texture) {
	Gol.getMatter.live = Matter.solidUniform(Material.texture(
		texture, [1, 1, 1, 1], 1.0 / (1 << 7), Vec3.zero, true));
});