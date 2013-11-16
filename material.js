
// Contains functions and types related to materials. Materials
// describe the visual properties of a surface.
var Material = new function() {

	// Represents a solid-colored material, which will be
	// transparent if the optional alpha parameter is specified.
	function Color(r, g, b, a) {
		this.r = r;
		this.g = g;
		this.b = b;
		if (a) {
			this.a = a;
			this.isTransparent = true;
		} else {
			this.a = 1.0;
			this.isTransparent = false;
		}
	}
	
	// Creates a solid-colored material.
	function color(r, g, b, a) {
		return new Color(r, g, b, a);
	}
	
	// A material that is completely transparent.
	var empty = new Object();
	empty.isTransparent = true;
	
	// Define exports.
	this.Color = Color;
	this.color = color;
	this.empty = empty;
};

// Contains functions and types related to substances. Substances
// describe the visual properties of a solid cube of matter.
var Substance = new function() {

	// Represents a substance that appears as a solid cube with
	// faces described by the given materials.
	function Solid(faces) {
		this.faces = faces;
		this.isTransparent = false;
		for (var i = 0; i < 3; i++) {
			for (var j = 0; j <= 1; j++) {
				this.isTransparent = this.isTransparent || faces[i][j].isTransparent;
			}
		}
	}

	// Gets the material for the given face of a solid substance.
	Solid.prototype.getFaceMaterial = function(axis, flip) {
		return this.faces[axis][flip ? 1 : 0];
	}
	
	// Creates a solid substance.
	function solid(faces) {
		return new Solid(faces);
	}
	
	// Creates a solid substance with a single material for all of its faces.
	function solidUniform(material) {
		var axis = [material, material];
		return new Solid([axis, axis, axis]);
	}
	
	// Creates a solid substance with different materials for its top face, its
	// side faces, and its bottom face.
	function solidUpright(top, side, bottom) {
		var sideAxis = [side, side];
		return new Solid([sideAxis, sideAxis, [top, bottom]]);
	}

	// A substance that is completely transparent.
	var empty = new Object();
	empty.isTransparent = true;
	
	// Define exports.
	this.Solid = Solid;
	this.solid = solid;
	this.solidUniform = solidUniform;
	this.solidUpright = solidUpright;
	this.empty = empty;
}