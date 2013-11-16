
// Contains functions and types related to 3D matter.
var Matter = new function() {

	// A node representing a physical configuration of a 3D space.
	var Node = Volume.Node();
	
	// Creates a new leaf matter node with the given substance.
	function create(substance) {
		var node = Node.leaf();
		node.substance = substance;
		return node;
	}
	
	// A special matter node that is a place-holder for matter that
	// can't be seen, and thus doesn't have any visual properties
	// and doesn't need to be rendered.
	var inside = Node.leaf();
	
	// Represents empty space.
	var empty = create(Material.empty);
	
	// A test configuration of matter.
	this.test = (function() {
		var e = empty;
		var rM = Material.color(0.7, 0.3, 0.1);
		var gM = Material.color(0.1, 0.7, 0.3);
		var bM = Material.color(0.1, 0.3, 0.7);
		
		var r = create(Substance.solidUniform(rM));
		var g = create(Substance.solidUpright(gM, bM, bM));
		var b = inside; // create(Substance.solidUniform(bM));
		
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
	this.inside = inside;
	this.empty = empty;
}