function Promise() {
	this.onComplete = null;
	this.hasValue = false;
	this.value = null;
}

Promise.prototype.fufill = function (value) {
	this.value = value;
	if (this.onComplete !== null) {
		this.onComplete.call(null, value)
		this.onComplete = null;
	}
}

Promise.prototype.done = function (onComplete) {
	if (this.hasValue) {
		onComplete.call(null, this.value);
	} else {
		if (this.onComplete === null) {
			this.onComplete = onComplete;
		} else {
			var current = this.onComplete;
			var next = onComplete;
			this.onComplete = function (value) {
				current(value);
				next(value);
			}
		}
	}
}

Promise.prototype.map = function (map) {
	var promise = new Promise();
	this.done(function (value) { 
		promise.fufill(map(value)); 
	});
	return promise;
}

function join(sources, create) {
	var promise = new Promise();
	var count = 0;
	var onOneComplete = function () {
		count++;
		if (count >= sources.length) {
			var results = new Array(sources.length);
			for (var i = 0; i < sources.length; i++) {
				results[i] = sources[i].value;
			}
			promise.fufill(create.apply(null, results));
		}
	}
	for (var i = 0; i < sources.length; i++) {
		sources[i].done(onOneComplete);
	}
	return promise;
}

function loadText(url) {
	var promise = new Promise();
	var request = new XMLHttpRequest();
	request.open('GET', url, true);
	request.onload = function() { 
		promise.fufill(request.responseText);
	}
	request.send();
	return promise;
}

// Creates a global function that defers to the given method with
// the "this" parameter set to the given object.
function link(object, method) {
	return function () {
		return method.apply(object, arguments);
	}
}

// Creates a copy of the given object with all methods replaced with
// global functions that defer to the corresponding method with the
// "this" parameter set to the original object.
function linkAll(object) {
	var result = new Object();
	for (var property in object) {
		if (typeof object[property] == "function") {
			result[property] = link(object, object[property]);
		}
	}
	return result;
}

// Creates a WebGLRenderingContext for the given canvas element.
function createGLContext(canvas) {
	var gl = canvas.getContext('experimental-webgl') ||
		canvas.getContext('webgl');
	if (!gl) throw "WebGL Not Supported";
	return gl;
}

// Creates and compiles a shader of the given type from the given source.
WebGLRenderingContext.prototype.loadShader = function (type, source) {
	var shader = this.createShader(type);
	this.shaderSource(shader, source);
	this.compileShader(shader);
	if (!this.getShaderParameter(shader, this.COMPILE_STATUS)) {
		throw "Shader Compiler Error: " + this.getShaderInfoLog(shader);
	}
	return shader;
}

// Creates and compiles a vertex shader from the given source.
WebGLRenderingContext.prototype.loadVertexShader = function (source) {
	return this.loadShader(this.VERTEX_SHADER, source);
}

// Creates and compiles a fragment shader from the given source.
WebGLRenderingContext.prototype.loadFragmentShader = function (source) {
	return this.loadShader(this.FRAGMENT_SHADER, source);
}

// Creates and links a shader program from the given vertex and
// fragment shaders.
WebGLRenderingContext.prototype.loadProgram = function (vs, fs) {
	var program = this.createProgram();
	this.attachShader(program, vs);
	this.attachShader(program, fs);
	this.linkProgram(program);
	if (!this.getProgramParameter(program, this.LINK_STATUS)) {
		throw "Program Link Error: " + gl.getProgramParameter(program, gl.VALIDATE_STATUS);
	}
	return program;
}

window.requestAnimationFrame = window.requestAnimationFrame ||
	window.webkitRequestAnimationFrame ||
	window.mozRequestAnimationFrame ||
	window.oRequestAnimationFrame ||
	window.msRequestAnimationFrame ||
	function(callback, element) {
		window.setTimeout(callback, 1000 / 60);
	};