// Describes a shader independently from a graphics context.
function Shader(source, type) {
	this.source = source;
	this.type = type;
}

// Define 'Shader' functions.
(function() {

	// Define types of shaders.
	var Type = {
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
	function request(url, type) {
		return requestText(url).map(function(source) {
			return new Shader(source, type);
		});
	}
	
	// A promise for a generic color shader.
	this.color = request("shaders/color.glsl", Type.Fragment);
	
	// Contains shaders for blocks.
	this.Block = new function() {
	
		// A promise for a generic vertex shader.
		this.vertex = request("shaders/block/vertex.glsl", Type.Vertex);
		
		// A promise for a colored fragment shader.
		this.color = request("shaders/block/color.glsl", Type.Fragment);
		
		// A promise for a textured fragment shader.
		this.texture = request("shaders/block/texture.glsl", Type.Fragment);
	}
	
	// Contains shaders for lines.
	this.Line = new function() {
	
		// A promise for a generic vertex shader.
		this.vertex = request("shaders/line/vertex.glsl", Type.Vertex);
	}
	
	// Define exports.
	this.Type = Type;
	this.request = request;
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
	function request(shaders, setup) {
		return join(shaders, function(shaders) {
			return new Program(shaders, setup);
		});
	}
	
	// Contains programs for blocks.
	this.Block = new function() {
	
		// Sets up the uniforms and attributes that are common between block programs.
		function setupCommon(program, gl) {
			program.view = gl.getUniformLocation(program, "view");
			program.scale = gl.getUniformLocation(program, "scale");
			program.pos = gl.getAttribLocation(program, "pos");
			program.norm = gl.getAttribLocation(program, "norm");
		}
		
		// A promise for a colored block program.
		this.color = request([Shader.Block.vertex, Shader.Block.color], function(program, gl) {
			program.color = gl.getUniformLocation(program, "color");
			setupCommon(program, gl);
		});
		
		// A promise for a textured block program.
		this.texture = request([Shader.Block.vertex, Shader.Block.texture], function(program, gl) {
			program.texture = gl.getUniformLocation(program, "texture");
			setupCommon(program, gl);
		});
	}
	
	// Contains programs for lines.
	this.Line = new function() {
		
		// Sets up the uniforms and attributes that are common between line programs.
		function setupCommon(program, gl) {
			program.view = gl.getUniformLocation(program, "view");
			program.foward = gl.getUniformLocation(program, "foward");
			program.pos = gl.getAttribLocation(program, "pos");
			program.dir = gl.getAttribLocation(program, "dir");
			program.offset = gl.getAttribLocation(program, "offset");
		}
		
		// A promise for a colored line program.
		this.color = request([Shader.Line.vertex, Shader.color], function(program, gl) {
			program.color = gl.getUniformLocation(program, "color");
			setupCommon(program, gl);
		});
	}
	
	// Define exports.
	this.request = request;
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