// Contains functions and types related to renderable 3D volumes.
var Matter = new function() {

	// A spatial node representing the visual contents of
	// a cubic 3D area.
	var Node = Volume.Node();
	
	// Represents a volume that is not visible, and thus can 
	// be rendered in any way.
	var inside = Node.leaf();
	
	// Gets the leaf node for the given substance.
	function lookup(substance) {
		if (substance.node) return substance.node;
		var node = Node.leaf();
		node.substance = substance;
		substance.node = node;
		return node;
	}
	
	// Represents a volume that is empty.
	var empty = lookup(Material.empty);
	
	// A test configuration of matter.
	this.test = (function() {
		var e = empty;
		var rM = Material.color(0.7, 0.3, 0.1);
		var gM = Material.color(0.1, 0.7, 0.3);
		var bM = Material.color(0.1, 0.3, 0.7);
		
		var r = lookup(Substance.solidUniform(rM));
		var g = lookup(Substance.solidUpright(gM, bM, bM));
		var b = lookup(Substance.solidUniform(bM));
		
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
	this.lookup = lookup;
	this.inside = inside;
	this.empty = empty;
}