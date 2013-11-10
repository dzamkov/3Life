
// Contains functions and types related to materials.
var Material = new function() {

	// Represents a solid-colored material.
	function Solid(r, g, b) {
		this.r = r;
		this.g = g;
		this.b = b;
	}
	
	// Creates a solid-colored material.
	function solid(r, g, b) {
		return new Solid(r, g, b);
	}
	
	// Define exports.
	this.Solid = Solid;
	this.solid = solid;
};