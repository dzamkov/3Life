// Contains functions and types related to renderable 3D volumes.
var Matter = new function() {

	// A spatial node representing the visual contents of
	// a cubic 3D area.
	var Node = Volume.Node();
	
	// Gets the leaf node for the given substance.
	function lookup(substance) {
		if (substance.node) return substance.node;
		var node = Node.leaf();
		node.substance = substance;
		substance.node = node;
		return node;
	}
	
	// Represents a volume that is empty.
	var empty = lookup(Substance.empty);
	
	// Represents a volume with undefined visual properties.
	var inside = lookup(Substance.inside);
	
	// Gets a solid matter node for a material.
	function solidUniform(material) {
		return lookup(Substance.solidUniform(material));
	}
	
	// Define exports.
	this.Node = Node;
	this.get = Node.get;
	this.merge = Node.merge;
	this.lookup = lookup;
	this.inside = inside;
	this.empty = empty;
	this.solidUniform = solidUniform;
}