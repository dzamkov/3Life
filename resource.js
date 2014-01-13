// Describes a graphical resource independently from a graphics
// context.
function Resource() {
	this.index = null;
}

// Define 'Resource' functions.
(function() {

	// The index assigned to the next constructed resource.
	var nextIndex = 0;
	
	// Gets an instance of this resource for the given graphics context.
	this.prototype.get = function(gl) {
		if (this.index === null) {
			this.index = nextIndex;
			nextIndex++;
		}
		if (gl.resource) {
			var cur = gl.resource[this.index];
			if (cur) return cur; else {
				return gl.resource[this.index] = this.create(gl);
			}
		} else {
			gl.resource = new Array(Resource.nextIndex);
			return gl.resource[this.index] = this.create(gl);
		}
	}
	
	// Creates an instance of this resource for the given graphics context.
	this.prototype.create = function(gl) {
		return { };
	}

}).call(Resource);

// Describes a shader independently from a graphics context.
function Shader(source, type) {
	Resource.call(this);
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

	// Implement 'Resource'.
	this.prototype = Object.create(Resource.prototype);
	this.prototype.create = function(gl) {
		var shader = gl.createShader(this.type);
		gl.shaderSource(shader, this.source);
		gl.compileShader(shader);
		if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
			throw "Shader Compiler Error: " + gl.getShaderInfoLog(shader);
		}
		return shader;
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
		
		// A promise for a colored fragment shader with falloff.
		this.colorFalloff = request("shaders/line/colorFalloff.glsl", Type.Fragment);
	}
	
	// Define exports.
	this.Type = Type;
	this.request = request;
}).call(Shader);

// Describes a shader program independently from a graphics context.
function Program(shaders, setup) {
	Resource.call(this);
	this.shaders = shaders;
	this.setup = setup;
}

// Define 'Program' functions.
(function() {
	
	// Implement 'Resource'.
	this.prototype = Object.create(Resource.prototype);
	this.prototype.create = function(gl) {
		var program = gl.createProgram();
		this.shaders.forEach(function(shader) {
			gl.attachShader(program, shader.get(gl));
		});
		gl.linkProgram(program);
		if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
			throw "Program Link Error: " + gl.getProgramParameter(program, gl.VALIDATE_STATUS);
		}
		this.setup(program, gl);
		return program;
	}
	
	// Creates a promise for a program given a set of promises for
	// its constituent shaders and a static setup function.
	function request(shaders, setup) {
		return join(shaders, function(shaders) {
			return new Program(shaders, setup);
		});
	}
	
	// TODO: Rename view uniforms to viewProj
	
	// Contains programs for blocks.
	this.Block = new function() {
	
		// Sets up the uniforms and attributes that are common between block programs.
		function setupCommon(program, gl) {
			program.model = gl.getUniformLocation(program, "model");
			program.view = gl.getUniformLocation(program, "view");
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
			program.scale = gl.getUniformLocation(program, "scale");
			program.texture = gl.getUniformLocation(program, "texture");
			setupCommon(program, gl);
		});
	}
	
	// Contains programs for lines.
	this.Line = new function() {
		
		// Sets up the uniforms and attributes that are common between line programs.
		function setupCommon(program, gl) {
			program.model = gl.getUniformLocation(program, "model");
			program.scale = gl.getUniformLocation(program, "scale");
			program.view = gl.getUniformLocation(program, "view");
			program.eyePos = gl.getUniformLocation(program, "eyePos");
			program.pos = gl.getAttribLocation(program, "pos");
			program.dir = gl.getAttribLocation(program, "dir");
			program.offset = gl.getAttribLocation(program, "offset");
		}
		
		// A promise for a colored line program.
		this.color = request([Shader.Line.vertex, Shader.color], function(program, gl) {
			program.color = gl.getUniformLocation(program, "color");
			setupCommon(program, gl);
		});
		
		// A promise for a colored line program with falloff.
		this.colorFalloff = request([Shader.Line.vertex, Shader.Line.colorFalloff], function(program, gl) {
			program.color = gl.getUniformLocation(program, "color");
			setupCommon(program, gl);
		});
	}
	
	// Define exports.
	this.request = request;
}).call(Program);

// Describes a texture independently from a graphics context.
function Texture(image) {
	Resource.call(this);
	this.image = image;
}

// Define 'Texture' functions.
(function() {
	
	// Implement 'Resource'.
	this.prototype = Object.create(Resource.prototype);
	this.prototype.create = function(gl) {
		var texture = gl.createTexture();
		gl.bindTexture(gl.TEXTURE_2D, texture);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.image);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_NEAREST);
		gl.generateMipmap(gl.TEXTURE_2D);
		return texture;
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

// Describes a mesh independently from a graphics context.
function Mesh(mode, vertexData, indexData, vertexSize, attributes) {
	Resource.call(this);
	this.mode = mode;
	this.vertexData = vertexData;
	this.indexData = indexData;
	this.vertexSize = vertexSize;
	this.attributes = attributes;
}

// Define 'Mesh' functions.
(function() {

	// Identifies a draw mode for a mesh.
	var Mode = {
		Triangles : WebGLRenderingContext.TRIANGLES
	}
	
	// Enables, and sets up, the attributes for a program.
	function enableAttributes(gl, program, attributes, vertexSize) {
		for (name in attributes) {
			var attribute = attributes[name];
			var location = program[name];
			gl.enableVertexAttribArray(location);
			gl.vertexAttribPointer(location, attribute.size, 
				gl.FLOAT, false, vertexSize * 4, attribute.offset * 4);
		}
	}
	
	// Disables the attributes for a program.
	function disableAttributes(gl, program, attributes) {
		for (name in attributes) {
			gl.disableVertexAttribArray(program[name]);
		}
	}

	// Implement 'Resource'.
	this.prototype = Object.create(Resource.prototype);
	this.prototype.create = function(gl) {
		var mode = this.mode;
		var attributes = this.attributes;
		var vertexSize = this.vertexSize;
		var vertexBuffer = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
		gl.bufferData(gl.ARRAY_BUFFER, this.vertexData, gl.STATIC_DRAW);
		if (this.indexData) {
			var indexBuffer = gl.createBuffer();
			gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
			gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this.indexData, gl.STATIC_DRAW);
			var count = this.indexData.length;
			return function(program) {
				gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
				gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
				enableAttributes(gl, program, attributes, vertexSize);
				gl.drawElements(mode, count, gl.UNSIGNED_SHORT, 0);
				disableAttributes(gl, program, attributes);
			};
		} else {
			var count = this.vertexData.length / this.vertexSize;
			return function(program) {
				gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
				enableAttributes(gl, program, attributes, vertexSize);
				gl.drawArrays(mode, 0, count);
				disableAttributes(gl, program, attributes);
			};
		}
	}
	
	// Creates a new 'Mesh' object.
	function create(mode, vertexData, indexData, vertexSize, attributes) {
		return new Mesh(mode, vertexData, indexData, vertexSize, attributes);
	}
	
	// Creates a new 'Mesh' object given an expanded description of its contents.
	// Both 'vertices' and 'indices' are given as simple arrays. Each item in 'vertices'
	// is an object that maps attributes (by name) to their values (either arrays or numbers).
	function createExpanded(mode, vertices, indices) {
		var vertex = vertices[0];
		var offset = 0;
		var attributes = new Object();
		for (name in vertex) {
			var value = vertex[name];
			var size = value instanceof Array ? value.length : 1;
			attributes[name] = { size : size, offset : offset };
			offset += size;
		}
		var vertexSize = offset;
		var vertexData = new Float32Array(vertices.length * vertexSize);
		var cur = 0;
		for (var i = 0; i < vertices.length; i++) {
			var vertex = vertices[i];
			for (name in attributes) {
				var attribute = attributes[name];
				var value = vertex[name];
				if (value instanceof Array) {
					for (var j = 0; j < value.length; j++) {
						vertexData[cur + attribute.offset + j] = value[j];
					}
				} else {
					vertexData[cur + attribute.offset] = value;
				}
			}
			cur += vertexSize;
		}
		var indexData = new Uint16Array(indices);
		return create(mode, vertexData, indexData, vertexSize, attributes);
	}
	
	// Creates a new 'Mesh' object using a procedure that takes a builder. Vertices
	// and primitives can be added to the mesh by calling appropriate methods on
	// the builder inside the 'build' procedure.
	function createBuilder(mode, vertexSize, attributes, build) {
		var builder = { };
		var vertexData = new Float32Array(vertexSize * 16);
		var vertexCount = 0;
		var indexData = new Uint16Array(16);
		var indexCount = 0;
	
		// Outputs a vertex and returns its index. The vertex is described
		// by its arguments, which can be vectors or numbers. Each argument
		// corresponds to a value for the corresponding attribute (ordered
		// by offset).
		builder.vertex = function() {
			var index = vertexCount;
			var offset = index * vertexSize;
			vertexCount++;
			if (offset >= vertexData.length) {
				var nVertexData = new Float32Array(vertexData.length * 2);
				nVertexData.set(vertexData);
				vertexData = nVertexData;
			}
			for (var i = 0; i < arguments.length; i++) {
				var arg = arguments[i];
				if (arg instanceof Array) {
					for (var j = 0; j < arg.length; j++) {
						vertexData[offset] = arg[j];
						offset++;
					}
				} else {
					vertexData[offset] = arg;
					offset++;
				}
			}
			return index;
		}
		
		// Outputs an index.
		builder.index = function(index) {
			var offset = indexCount;
			indexCount++;
			if (offset >= indexData.length) {
				var nIndexData = new Uint16Array(indexData.length * 2);
				nIndexData.set(indexData);
				indexData = nIndexData;
			}
			indexData[offset] = index;
		}
		
		// Outputs a quad given the indices of its
		// four vertices (Triangles mode only).
		if (mode === Mode.Triangles) {
			builder.quad = function(a, b, c, d) {
				this.index(a);
				this.index(b);
				this.index(c);
				this.index(c);
				this.index(b);
				this.index(d);
			}
		}
		
		// Outputs a line, assuming that the resulting mesh
		// will be interpreted using a line shader.
		builder.line = function(from, to, thickness, dir) {
			if (!dir) {
				var Vector = Space.get(to.length).Vector;
				dir = Vector.normalize(Vector.sub(to, from));
			}
			var a = this.vertex(from, dir, -thickness);
			var b = this.vertex(from, dir, thickness);
			var c = this.vertex(to, dir, -thickness);
			var d = this.vertex(to, dir, thickness);
			this.quad(a, b, c, d);
		}
		
		// Build geometry.
		build(builder);
		
		// Resize geometry data.
		var nVertexData = new Float32Array(vertexSize * vertexCount);
		var nIndexData = new Uint16Array(indexCount);
		nVertexData.set(vertexData.subarray(0, nVertexData.length));
		nIndexData.set(indexData.subarray(0, nIndexData.length));
		vertexData = nVertexData;
		indexData = nIndexData;
		
		// Create mesh.
		return create(mode, vertexData, indexData, vertexSize, attributes);
	}
	
	// Contains common meshes for block shader programs.
	this.Block = new function() {
	
		// A mesh for a unit cube between (0, 0, 0) and (1, 1, 1).
		this.cube = createBuilder(Mode.Triangles, 6, {
			pos : { size : 3, offset : 0 },
			norm : { size : 3, offset : 3 }
		}, function(builder) {
			for (var axis = 0; axis < 3; axis++) {
				for (var i = 0; i < 2; i++) {
					var norm = Vec3.unproj(Vec2.zero, axis, (i == 1) ? 1 : -1);
					var a = builder.vertex(Vec3.unproj([0, 0], axis, i), norm);
					var b = builder.vertex(Vec3.unproj([0, 1], axis, i), norm);
					var c = builder.vertex(Vec3.unproj([1, 0], axis, i), norm);
					var d = builder.vertex(Vec3.unproj([1, 1], axis, i), norm);
					if (i == 0) builder.quad(a, b, c, d); else builder.quad(a, c, b, d);
				}
			}
		});
	
	}
	
	// Contains common meshes for line shader programs.
	this.Line = new function() {
	
		// A mesh for a unit cube between (0, 0, 0) and (1, 1, 1) constructed out of 
		// lines of width 1.
		this.cube = createBuilder(Mode.Triangles, 7, {
			pos : { size : 3, offset : 0 },
			dir : { size : 3, offset : 3 },
			offset : { size : 1, offset : 6 }
		}, function(builder) {
			for (var axis = 0; axis < 3; axis++) {
				var dir = Vec3.unproj(Vec2.zero, axis, 1);
				for (var i = 0; i < 2; i++) {
					for (var j = 0; j < 2; j++) {
						var vec = [i, j];
						var from = Vec3.unproj(vec, axis, 0);
						var to = Vec3.unproj(vec, axis, 1);
						builder.line(from, to, 0.5, dir);
					}
				}
			}
		});
		
		// A mesh for a unit square between (0, 0) and (1, 1) constructed out of
		// lines of width 1.
		this.square = createBuilder(Mode.Triangles, 5, {
			pos : { size : 2, offset : 0 },
			dir : { size : 2, offset : 2 },
			offset : { size : 1, offset : 4 }
		}, function(builder) {
			builder.line([0, 0], [0, 1], 0.5, [0, 1]);
			builder.line([1, 0], [1, 1], 0.5, [0, 1]);
			builder.line([0, 0], [1, 0], 0.5, [1, 0]);
			builder.line([0, 1], [1, 1], 0.5, [1, 0]);
		});
	}
	
	// Define exports.
	this.Mode = Mode;
	this.enableAttributes = enableAttributes;
	this.disableAttributes = disableAttributes;
	this.create = create;
	this.createExpanded = createExpanded;
	this.createBuilder = createBuilder;
}).call(Mesh);