// Describes the visual properties of a surface.
function Material(isOpaque) {
	this.isOpaque = isOpaque;
}

// Define 'Material' functions and sub-types.
(function() {

	// The resources necessary to use this module.
	var resources = new Array();

	// The 'Program' resource used to implement this material.
	this.prototype.program = null;
	
	// The constant values assigned to variables for the program
	// for this material.
	this.prototype.constants = { };
	
	// Sets up the textures used by this material.
	this.prototype.setupTextures = function(gl) { }

	// Represents a solid-colored material, which will be
	// transparent if the optional alpha parameter is specified.
	function Color(color) {
		Material.call(this, color[3] < 1.0);
		this.color = color;
		this.constants = { color : color };
	}
	
	// Define 'Color' methods and values.
	(function() {
		this.prototype = Object.create(Material.prototype);
		delay(Program.Block.color, (function(program) {
			this.prototype.program = program;
		}).bind(this), resources);
		this.create = function(color) {
			return new Color(color);
		}
	}).call(Color);
	
	// Represents a textured material.
	function Texture(source, scale, offset, isOpaque) {
		Material.call(this, isOpaque);
		this.source = source;
		this.scale = scale;
		this.offset = offset;
		this.constants = {
			texture : 0,
			scale : scale,
			offset : offset 
		};
	}
	
	// Define 'Texture' methods and values.
	(function() {
		this.prototype = Object.create(Material.prototype);
		delay(Program.Block.texture, (function(program) {
			this.prototype.program = program;
		}).bind(this), resources);
		this.prototype.setupTextures = function(gl) {
			gl.activeTexture(gl.TEXTURE0);
			gl.bindTexture(gl.TEXTURE_2D, this.source.get(gl));
		}
		this.create = function(source, scale, offset, isOpaque) {
			return new Texture(source, scale, offset, isOpaque);
		}
	}).call(Texture);
	
	// A material that is completely transparent.
	var empty = new Material(true);
	
	// A material with undefined visual properties. This is used to indicate that a
	// section of a surface can take any appearance (likely because it is not visible).
	var inside = new Material(false);
	
	// Define exports.
	this.resources = Promise.join(resources);
	this.Color = Color;
	this.color = Color.create;
	this.Texture = Texture;
	this.texture = Texture.create;
	this.empty = empty;
	this.inside = inside;
}).call(Material);

// Describes the visual properties of matter.
function Substance() { }

// Define 'Substance' functions and sub-types.
(function() {

	// A substance that is completely described by its surface materials.
	function Solid(isOpaque) {
		this.isOpaque = isOpaque;
	}
	
	// Define 'Solid' functions and subtypes.
	(function() {
		this.prototype = Object.create(Substance.prototype);
		
		// Gets the material for a given face on a block of this substance when facing
		// a non-solid substance.
		this.prototype.outward = function(axis, flip) { return Material.empty; }
		
		// A solid substance described by the materials for its outward-facing surfaces.
		function Simple(faces) {
			this.faces = faces;
			var isOpaque = true;
			for (var i = 0; i < faces.length; i++) {
				isOpaque = isOpaque && faces[i].isOpaque;
			}
			Solid.call(this, isOpaque);
		}
		
		// Define 'Simple' functions.
		(function() {
			this.prototype = Object.create(Solid.prototype);
			this.prototype.outward = function(axis, flip) {
				return this.faces[axis + (flip ? 3 : 0)];
			}
			this.create = function(faces) {
				return new Simple(faces);
			}
			this.createUniform = function(face) {
				var faces = new Array(6);
				for (var i = 0; i < 6; i++) faces[i] = face;
				return new Simple(faces);
			}
		}).call(Simple);
		
		// Gets the material between two adjacent blocks of the given solid substances
		// along the given axis.
		function between(axis, flip, n, p) {
			if (n === p) {
				return n.isOpaque ? Material.inside : Material.empty;
			} else {
				var front = flip ? p : n;
				var back = flip ? n : p;
				if (front.isOpaque) {
					return Material.inside;
				} else if (back instanceof Simple) {
					return back.outward(axis, flip);
				}
				notImplemented();
			}
		}
	
		// Define exports.
		this.Simple = Simple;
		this.between = between;
	}).call(Solid);

	// A substance that is completely transparent.
	var empty = new Substance();
	
	// A substance with undefined visual properties, analagous to 'Material.inside'.
	var inside = new Substance();
	
	// Gets the material between two adjacent blocks of the given substances along the
	// given axis.
	function between(axis, flip, n, p) {
		if (n === inside || p === inside) {
			return Material.inside;
		} else if (n instanceof Solid) {
			if (p instanceof Solid) {
				return Solid.between(axis, flip, n, p);
			} else if (flip) {
				return n.outward(axis, flip);
			} else {
				return Material.empty;
			}
		} else {
			if (p instanceof Solid && !flip) {
				return p.outward(axis, flip);
			} else {
				return Material.empty;
			}
		}
	}
	
	// Define exports.
	this.Solid = Solid;
	this.solidSimple = Solid.Simple.create;
	this.solidUniform = Solid.Simple.createUniform;
	this.empty = empty;
	this.inside = inside;
	this.between = between;
}).call(Substance);