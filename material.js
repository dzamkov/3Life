// Describes the visual properties of a surface.
function Material(isTransparent) {
	this.isTransparent = isTransparent;
}

// Define 'Material' functions and sub-types.
(function() {

	// The resources necessary to use this module.
	var resources = new Array();

	// The 'Program' resource used to implement this material.
	this.prototype.program = function() { return null; }

	// Sets up the uniforms for a program implementing this material.
	this.prototype.setupUniforms = function(gl, program) { }

	// Represents a solid-colored material, which will be
	// transparent if the optional alpha parameter is specified.
	function Color(color) {
		Material.call(this, color[3] < 1.0);
		this.color = color;
	}
	
	// Define 'Color' methods and values.
	(function() {
		this.prototype = Object.create(Material.prototype);
		delay(Program.Block.color, (function(program) {
			this.prototype.program = program;
		}).bind(this), resources);
		this.prototype.setupUniforms = function(gl, program) {
			gl.uniform4fv(program.color, this.color);
		}
		this.create = function(color) {
			return new Color(color);
		}
	}).call(Color);
	
	// Represents a textured material.
	function Texture(source, scale, offset, isTransparent) {
		Material.call(this, isTransparent);
		this.source = source;
		this.scale = scale;
		this.offset = offset;
	}
	
	// Define 'Texture' methods and values.
	(function() {
		this.prototype = Object.create(Material.prototype);
		delay(Program.Block.texture, (function(program) {
			this.prototype.program = program;
		}).bind(this), resources);
		this.prototype.setupUniforms = function(gl, program) {
			gl.activeTexture(gl.TEXTURE0);
			gl.bindTexture(gl.TEXTURE_2D, this.source.get(gl));
			gl.uniform1i(program.texture, 0);
			gl.uniform1f(program.scale, this.scale);
			gl.uniform3fv(program.offset, this.offset);
		}
		this.create = function(source, scale, offset, isTransparent) {
			return new Texture(source, scale, offset, isTransparent);
		}
	}).call(Texture);
	
	// A material that is completely transparent.
	var empty = new Material(true);
	
	// Define exports.
	this.resources = Promise.join(resources);
	this.Color = Color;
	this.color = Color.create;
	this.Texture = Texture;
	this.texture = Texture.create;
	this.empty = empty;
}).call(Material);

// Describes the visual properties of a solid cube of matter.
function Substance(isTransparent) {
	this.isTransparent = isTransparent;
}

// Define 'Substance' functions and sub-types.
(function() {
	
	// Represents a substance that appears as a solid cube with
	// faces described by the given materials.
	function Solid(faces) {
		this.faces = faces;
		isTransparent = false;
		for (var i = 0; i < 3; i++) {
			for (var j = 0; j <= 1; j++) {
				isTransparent = isTransparent || faces[i][j].isTransparent;
			}
		}
		Substance.call(this, isTransparent);
	}
	
	// Define 'Solid' methods.
	(function() {
		this.prototype = Object.create(Substance.prototype);
		
		// Gets the material for the given face of this solid substance.
		this.prototype.getFaceMaterial = function(axis, flip) {
			return this.faces[axis][flip ? 1 : 0];
		}
		
		// Creates a solid substance.
		this.create = function(faces) {
			return new Solid(faces);
		}
		
		// Creates a solid substance with a single material for all of its faces.
		this.createUniform = function(material) {
			var axis = [material, material];
			return new Solid([axis, axis, axis]);
		}
	}).call(Solid);

	// A substance that is completely transparent.
	var empty = new Substance(true);
	
	// Define exports.
	this.Solid = Solid;
	this.solid = Solid.create;
	this.solidUniform = Solid.createUniform;
	this.empty = empty;
}).call(Substance);