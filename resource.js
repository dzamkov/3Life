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
		return Promise.requestText(url).map(function(source) {
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
function Program(shaders) {
	Resource.call(this);
	this.shaders = shaders;
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
		
		// Enumerate variables (uniforms and attributes).
		var variables = { };
		var uniformCount = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
		var attributeCount = gl.getProgramParameter(program, gl.ACTIVE_ATTRIBUTES);
		for (var i = 0; i < uniformCount; i++) {
			var info = gl.getActiveUniform(program, i);
			variables[info.name] = {
				size : info.size,
				type : info.type,
				isAttribute : false,
				location : gl.getUniformLocation(program, info.name)
			};
		}
		for (var i = 0; i < attributeCount; i++) {
			var info = gl.getActiveAttrib(program, i);
			variables[info.name] = {
				size : info.size,
				type : info.type,
				isAttribute : true,
				location : gl.getAttribLocation(program, info.name)
			};
		}
		
		program.variables = variables;
		return program;
	}
	
	// Creates a promise for a program given a set of promises for
	// its constituent shaders.
	function request(shaders) {
		return Promise.join(shaders).map(function(shaders) {
			return new Program(shaders);
		});
	}
	
	// Contains programs for blocks.
	this.Block = new function() {
		
		// A promise for a colored block program.
		this.color = request([Shader.Block.vertex, Shader.Block.color]);
		
		// A promise for a textured block program.
		this.texture = request([Shader.Block.vertex, Shader.Block.texture]);
	}
	
	// Contains programs for lines.
	this.Line = new function() {

		// A promise for a colored line program.
		this.color = request([Shader.Line.vertex, Shader.color]);
		
		// A promise for a colored line program with falloff.
		this.colorFalloff = request([Shader.Line.vertex, Shader.Line.colorFalloff]);
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
		return Promise.requestImage(url).map(function(image) {
			return new Texture(image);
		});
	}
	
	// Metal texture.
	this.metal = this.request("textures/metal.png");

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

	// Implement 'Resource'.
	this.prototype = Object.create(Resource.prototype);
	this.prototype.create = function(gl) {
		var res = { };
		res.mode = this.mode;
		res.attributes = this.attributes;
		res.vertexSize = this.vertexSize;
		var vertexBuffer = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
		gl.bufferData(gl.ARRAY_BUFFER, this.vertexData, gl.STATIC_DRAW);
		res.vertexBuffer = vertexBuffer;
		if (this.indexData) {
			var indexBuffer = gl.createBuffer();
			gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
			gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this.indexData, gl.STATIC_DRAW);
			res.indexBuffer = indexBuffer;
			res.count = this.indexData.length;
		} else {
			res.count = this.vertexData.length / this.vertexSize;
		}
		return res;
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
	
	// A temporary storage for geometry data that can be appended to and converting into
	// a mesh.
	function Builder(mode, vertexSize, attributes, vertexCapacity, indexCapacity) {
		this.mode = mode;
		this.vertexSize = vertexSize;
		this.attributes = attributes;
		this.vertexData = new Float32Array(vertexSize * vertexCapacity);
		this.vertexCount = 0;
		this.indexData = new Uint16Array(indexCapacity);
		this.indexCount = 0;
	}
	
	// Define 'Builder' methods.
	(function() {
	
		// Appends a vertex and returns its index. The vertex is described by its 
		// arguments, which can be vectors or numbers. Each argument describes the value
		// for the corresponding attribute (ordered by offset).
		this.prototype.vertex = function() {
			var index = this.vertexCount;
			var offset = index * this.vertexSize;
			this.vertexCount++;
			if (offset >= this.vertexData.length) {
				var nVertexData = new Float32Array(this.vertexData.length * 2);
				nVertexData.set(this.vertexData);
				this.vertexData = nVertexData;
			}
			for (var i = 0; i < arguments.length; i++) {
				var arg = arguments[i];
				if (arg instanceof Array) {
					for (var j = 0; j < arg.length; j++) {
						this.vertexData[offset] = arg[j];
						offset++;
					}
				} else {
					this.vertexData[offset] = arg;
					offset++;
				}
			}
			return index;
		}
		
		// Appends an index.
		this.prototype.index = function(index) {
			var offset = this.indexCount;
			this.indexCount++;
			if (offset >= this.indexData.length) {
				var nIndexData = new Uint16Array(this.indexData.length * 2);
				nIndexData.set(this.indexData);
				this.indexData = nIndexData;
			}
			this.indexData[offset] = index;
		}
		
		// Outputs a quad given the indices of its four vertices.
		this.prototype.quad = function(a, b, c, d) {
			if (this.mode != Mode.Triangles) notImplemented();
			this.index(a);
			this.index(b);
			this.index(c);
			this.index(c);
			this.index(b);
			this.index(d);
		}
		
		// Outputs a line, assuming that the resulting mesh will be rendered using a line
		// program. If the 'dir' attribute is not specified, it will be calculated from
		// the position attributes.
		this.prototype.line = function(from, to, thickness, dir) {
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
		
		// Creates a 'Mesh' from the current contents of this builder.
		this.prototype.finish = function() {
			var nVertexData = new Float32Array(this.vertexSize * this.vertexCount);
			var nIndexData = new Uint16Array(this.indexCount);
			nVertexData.set(this.vertexData.subarray(0, nVertexData.length));
			nIndexData.set(this.indexData.subarray(0, nIndexData.length));
			return create(this.mode, nVertexData, nIndexData,
				this.vertexSize, this.attributes);
		}
		
		// Creates a 'Mesh' from the current contents of this builder, using the builder's
		// data directly. This avoids copying and allocating additional arrays, but may
		// cause unnecessarily large arrays to remain in memory.
		this.prototype.finishQuick = function() {
			return create(this.mode, 
				this.vertexData.subarray(0, this.vertexSize * this.vertexCount),
				this.indexData.subarray(0, this.indexCount),
				this.vertexSize, this.attributes);
		}
		
	}).call(Builder);
	
	// Creates a new 'Mesh' object using a procedure that takes a builder. Vertices
	// and primitives can be added to the mesh by calling appropriate methods on
	// the builder inside the 'build' procedure.
	function createBuilder(mode, vertexSize, attributes, build) {
		var builder = new Builder(mode, vertexSize, attributes, 16, 16);
		build(builder);
		return builder.finish();
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
	this.create = create;
	this.createExpanded = createExpanded;
	this.Builder = Builder;
	this.createBuilder = createBuilder;
}).call(Mesh);

// Sets a constant value for a variable. Variables may be uniforms or attributes,
// and values may be numbers or arrays of numbers.
WebGLRenderingContext.prototype.setConstant = function(variable, value) {
	if (variable.isAttribute) {
		switch (variable.type) {
			case this.FLOAT: this.vertexAttrib1f(variable.location, value); break;
			case this.FLOAT_VEC2: this.vertexAttrib2fv(variable.location, value); break;
			case this.FLOAT_VEC3: this.vertexAttrib3fv(variable.location, value); break;
			case this.FLOAT_VEC4: this.vertexAttrib4fv(variable.location, value); break;
		}
	} else {
		switch (variable.type) {
			case this.BOOL: case this.INT: case this.SAMPLER_2D: case this.SAMPLER_CUBE: 
				this.uniform1i(variable.location, value); break;
			case this.BOOL_VEC2: case this.INT_VEC2:
				this.uniform2iv(variable.location, value); break;
			case this.BOOL_VEC3: case this.INT_VEC3:
				this.uniform3iv(variable.location, value); break;
			case this.BOOL_VEC4: case this.INT_VEC4:
				this.uniform4iv(variable.location, value); break;
			case this.FLOAT: this.uniform1f(variable.location, value); break;
			case this.FLOAT_VEC2: this.uniform2fv(variable.location, value); break;
			case this.FLOAT_VEC3: this.uniform3fv(variable.location, value); break;
			case this.FLOAT_VEC4: this.uniform4fv(variable.location, value); break;
			case this.FLOAT_MAT2: this.uniformMatrix2fv(variable.location, false, value); break;
			case this.FLOAT_MAT3: this.uniformMatrix3fv(variable.location, false, value); break;
			case this.FLOAT_MAT4: this.uniformMatrix4fv(variable.location, false, value); break;
		}
	}
}

// Sets constant values for a set of variables. Variables may be uniforms or attributes,
// and values may be numbers or arrays of numbers.
WebGLRenderingContext.prototype.setConstants = function(variables, values) {
	for (var name in values) {
		this.setConstant(variables[name], values[name]);
	}
}

// Enables and sets up the appropriate attribute pointers for a set of variables.
WebGLRenderingContext.prototype.enableAttributes = function(variables, vertexSize, attributes) {
	for (name in attributes) {
		var location = variables[name].location;
		var attribute = attributes[name];
		this.enableVertexAttribArray(location);
		this.vertexAttribPointer(location, attribute.size, 
			this.FLOAT, false, vertexSize * 4, attribute.offset * 4);
	}
}

// Disables the attribute pointers for a set of variables.
WebGLRenderingContext.prototype.disableAttributes = function(variables) {
	for (name in variables) {
		var variable = variables[name];
		if (variable.isAttribute) {
			this.disableVertexAttribArray(variable.location);
		}
	}
}

// Binds the appropriate buffers for a mesh.
WebGLRenderingContext.prototype.bindMesh = function(mesh) {
	this.bindBuffer(this.ARRAY_BUFFER, mesh.vertexBuffer);
	if (mesh.indexBuffer) this.bindBuffer(this.ELEMENT_ARRAY_BUFFER, mesh.indexBuffer);
}

// Draws a mesh by making the appropriate call to 'drawArrays' or 'drawElements'.
WebGLRenderingContext.prototype.drawMesh = function(mesh) {
	if (mesh.indexBuffer) {
		this.drawElements(mesh.mode, mesh.count, this.UNSIGNED_SHORT, 0);
	} else {
		this.drawArrays(mesh.mode, 0, mesh.count);
	}
}

// Performs a full render of a given mesh using a given program.
WebGLRenderingContext.prototype.render = function(program, mesh, constants) {
	this.useProgram(program);
	this.setConstants(program.variables, constants);
	this.bindMesh(mesh);
	this.enableAttributes(program.variables, mesh.vertexSize, mesh.attributes);
	this.drawMesh(mesh);
	this.disableAttributes(program.variables);
}