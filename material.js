// Describes the visual properties of a surface. The 'procedure'
// parameter is a promise for the procedure that renders the material.
function Material(procedure, isTransparent) {
	this.procedure = procedure;
	this.isTransparent = isTransparent;
}

// Define 'Material' functions and sub-types.
(function() {

	// The base type for materials.
	var Base = this;
	
	// Describes a procedure for rendering a material.
	function Procedure(program, setUniforms) {
		this.program = program;
		this.setUniforms = setUniforms;
	}

	// Define 'Procedure' functions.
	(function() {

		// Creates a promise for a procedure to render a colored material.
		this.color = function(mat) {
			return Program.Block.color.map(function(program) {
				return new Procedure(program, function(program, gl) {
					gl.uniform4f(program.color, mat.r, mat.g, mat.b, mat.a);
				});
			});
		}
		
		// Creates a promise for a procedure to render a textured material,
		// given a promise for the texture itself.
		this.texture = function(texture) {
			return joinArgs([Program.Block.texture, texture], function(program, texture) {
				return new Procedure(program, function(program, gl) {
					gl.activeTexture(gl.TEXTURE0);
					gl.bindTexture(gl.TEXTURE_2D, texture.get(gl));
					gl.uniform1i(program.texture, 0);
				});
			});
		}
		
	}).call(Procedure);
	
	// Represents a solid-colored material, which will be
	// transparent if the optional alpha parameter is specified.
	function Color(r, g, b, a) {
		this.r = r; this.g = g; this.b = b; this.a = a || 1.0;
		Base.call(this, Procedure.color(this), a ? true : false);
	}
	
	// Creates a solid-colored material.
	function color(r, g, b, a) {
		return new Color(r, g, b, a);
	}
	
	// Represents a textured material.
	function Texture(source, isTransparent) {
		Base.call(this, Procedure.texture(source), isTransparent);
	}
	
	// creates a textured material given a promise to the source texture.
	function texture(source, isTransparent) {
		return new Texture(source, isTransparent);
	}
	
	// TODO: Border material.
	
	// A material that is completely transparent.
	var empty = new Base(null, true);
	
	// Define exports.
	this.Procedure = Procedure;
	this.Color = Color;
	this.color = color;
	this.Texture = Texture;
	this.texture = texture;
	this.empty = empty;

}).call(Material);

// Describes the visual properties of a solid cube of matter.
function Substance(isTransparent) {
	this.isTransparent = isTransparent;
}

// Define 'Substance' functions and sub-types.
(function() {
	
	// The base type for materials.
	var Base = this;

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
		Base.call(this, isTransparent);
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
	var empty = new Base(true);
	
	// Define exports.
	this.Solid = Solid;
	this.solid = solid;
	this.solidUniform = solidUniform;
	this.solidUpright = solidUpright;
	this.empty = empty;
}).call(Substance);