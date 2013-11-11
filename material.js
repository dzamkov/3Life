
// Contains functions and types related to materials.
var Material = new function() {

	// Represents a solid-colored material.
	function Solid(r, g, b) {
		this.r = r;
		this.g = g;
		this.b = b;
		this.isTransparent = false;
	}
	
	// Creates a solid-colored material.
	function solid(r, g, b) {
		return new Solid(r, g, b);
	}
	
	// A material that is completely transparent.
	var empty = new Object();
	empty.isTransparent = true;
	
	// Define exports.
	this.Solid = Solid;
	this.solid = solid;
	this.empty = empty;
};