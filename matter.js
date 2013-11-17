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
	
	// Gets a solid-colored matter node.
	function color(r, g, b, a) {
		return lookup(Substance.solidUniform(Material.color(r, g, b, a)));
	}
	
	// Define exports.
	this.Node = Node;
	this.get = Node.get;
	this.merge = Node.merge;
	this.lookup = lookup;
	this.inside = inside;
	this.empty = empty;
	this.color = color;
}