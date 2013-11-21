
// Describes a shader independently from a graphics context.
function Shader(source, type) {
	this.source = source;
	this.type = type;
}

// Define 'Shader' functions.
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
	this.vertex = this.request("shaders/vertex.glsl", this.Type.Vertex);
	
	// A promise for a colored fragment shader.
	this.color = this.request("shaders/color.glsl", this.Type.Fragment);
	
	// A promise for a textured fragment shader.
	this.texture = this.request("shaders/texture.glsl", this.Type.Fragment);
	
}).call(Shader);

// Describes a shader program independently from a graphics context.
function Program(shaders, setup) {
	this.shaders = shaders;
	this.setup = setup;
}

// Define 'Program' functions.
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
	
	// Sets up the uniforms and attributes that are common between programs.
	function setupCommon(program, gl) {
		program.proj = gl.getUniformLocation(program, "proj");
        program.view = gl.getUniformLocation(program, "view");
		program.scale = gl.getUniformLocation(program, "scale");
		program.pos = gl.getAttribLocation(program, "pos");
		program.norm = gl.getAttribLocation(program, "norm");
	}
	
	// A promise for a colored program.
	this.color = this.request([Shader.vertex, Shader.color], function(program, gl) {
		program.color = gl.getUniformLocation(program, "color");
		setupCommon(program, gl);
	});
	
	// A promise for a textured program.
	this.texture = this.request([Shader.vertex, Shader.texture], function(program, gl) {
		program.texture = gl.getUniformLocation(program, "texture");
		setupCommon(program, gl);
	});

}).call(Program);

// Describes a texture independently from a graphics context.
function Texture(image) {
	this.image = image;
}

// Define 'Texture' functions.
(function() {

	// Loads the texture into a graphics context and returns a
	// handle to it. This function caches the texture for the
	// last used graphics context.
	this.prototype.get = function(gl) {
		if (this.cache && this.cache.gl === gl) {
			return this.cache.handle;
		} else {
			var texture = gl.createTexture();
			gl.bindTexture(gl.TEXTURE_2D, texture);
			gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.image);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_NEAREST);
			gl.generateMipmap(gl.TEXTURE_2D);
			this.cache = { gl : gl, handle : texture };
			return texture;
		}
	}
	
	// Requests a texture from a url, returning a promise to
	// be fufilled once it has been downloaded.
	this.request = function(url) {
		return requestImage(url).map(function(image) {
			return new Texture(image);
		});
	}
	
	// Generic cell texture.
	this.cell = this.request("textures/cell.png");

}).call(Texture);

// Describes a procedure for rendering a material.
function Procedure(program, setUniforms) {
	this.program = program;
	this.setUniforms = setUniforms;
}

// Define 'Procedure' functions.
(function() {

	// Creates a promise for a procedure to render a colored material.
	this.color = function(mat) {
		return Program.color.map(function(program) {
			return new Procedure(program, function(program, gl) {
				gl.uniform4f(program.color, mat.r, mat.g, mat.b, mat.a);
			});
		});
	}
	
	// Creates a promise for a procedure to render a textured material,
	// given a promise for the texture itself.
	this.texture = function(texture) {
		return joinArgs([Program.texture, texture], function(program, texture) {
			return new Procedure(program, function(program, gl) {
				gl.activeTexture(gl.TEXTURE0);
				gl.bindTexture(gl.TEXTURE_2D, texture.get(gl));
				gl.uniform1i(program.texture, 0);
			});
		});
	}
	
}).call(Procedure);

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