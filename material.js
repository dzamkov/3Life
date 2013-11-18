
// Describes a shader independently from a graphics context.
function Shader(source, type) {
	this.source = source;
	this.type = type;
}

// Define shader functions.
(function() {

	// Define types of shaders.
	this.Type = {
		Vertex :  WebGLRenderingContext.VERTEX_SHADER,
		Fragment : WebGLRenderingContext.FRAGMENT_SHADER
	}

	// Loads the shader into a graphics context and returns a
	// handle to it. This function caches the shader for the
	// last used graphics context.
	this.prototype.get = function(gl) {
		if (this.cache && this.cache.gl === gl) {
			return this.cache.handle;
		} else {
			var shader = gl.createShader(this.type);
			gl.shaderSource(shader, this.source);
			gl.compileShader(shader);
			if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
				throw "Shader Compiler Error: " + gl.getShaderInfoLog(shader);
			}
			this.cache = { gl : gl, handle : shader };
			return shader;
		}
	}
	
	// Requests a shader from a url, returning a promise to be
	// fufilled once it has been downloaded.
	this.request = function(url, type) {
		return requestText(url).map(function(source) {
			return new Shader(source, type);
		});
	}
	
	// A promise for a generic vertex shader.
	this.Vertex = this.request("shaders/vertex.glsl", this.Type.Vertex);
	
	// A promise for a colored fragment shader.
	this.Color = this.request("shaders/color.glsl", this.Type.Fragment);
	
}).call(Shader);

// Describes a shader program independently from a graphics context.
function Program(shaders, setup) {
	this.shaders = shaders;
	this.setup = setup;
}

// Define program functions.
(function() {

	// Loads the program into a graphics context and returns a
	// handle to it. This function caches the program for the
	// last used graphics context.
	this.prototype.get = function(gl) {
		if (this.cache && this.cache.gl === gl) {
			return this.cache.handle;
		} else {
			var program = gl.createProgram();
			this.shaders.forEach(function(shader) {
				gl.attachShader(program, shader.get(gl));
			});
			gl.linkProgram(program);
			if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
				throw "Program Link Error: " + gl.getProgramParameter(program, gl.VALIDATE_STATUS);
			}
			this.setup(program, gl);
			this.cache = { gl : gl, handle : program };
			return program;
		}
	}
	
	// Creates a promise for a program given a set of promises for
	// its constituent shaders and a static setup function.
	this.request = function(shaders, setup) {
		return join(shaders, function(shaders) {
			return new Program(shaders, setup);
		});
	}
	
	// A promise for a colored program.
	this.Color = this.request([Shader.Vertex, Shader.Color], function(program, gl) {
		program.proj = gl.getUniformLocation(program, "proj");
        program.view = gl.getUniformLocation(program, "view");
		program.color = gl.getUniformLocation(program, "color");
		program.pos = gl.getAttribLocation(program, "pos");
		program.norm = gl.getAttribLocation(program, "norm");
	});

}).call(Program);

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
	
	// TODO: Textured materials
	
	// A material that is completely transparent.
	var empty = new Object();
	empty.isTransparent = true;
	
	// Define exports.
	this.Color = Color;
	this.color = color;
	this.empty = empty;
}

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