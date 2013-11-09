function Promise() {
	this.onComplete = null;
	this.hasValue = false;
	this.value = null;
}

Promise.prototype.fufill = function(value) {
	this.value = value;
	if (this.onComplete !== null) {
		this.onComplete.call(null, value)
		this.onComplete = null;
	}
}

Promise.prototype.done = function(onComplete) {
	if (this.hasValue) {
		onComplete.call(null, this.value);
	} else {
		if (this.onComplete === null) {
			this.onComplete = onComplete;
		} else {
			var current = this.onComplete;
			var next = onComplete;
			this.onComplete = function(value) {
				current(value);
				next(value);
			}
		}
	}
}

Promise.prototype.map = function(map) {
	var promise = new Promise();
	this.done(function (value) { 
		promise.fufill(map(value)); 
	});
	return promise;
}

function join(sources, create) {
	var promise = new Promise();
	var count = 0;
	var onOneComplete = function() {
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

// Correct modulo for negative numbers.
Number.prototype.mod = function(n) {
	return ((this % n) + n) % n;
}

// Replaces the first occurence of the given value in an array
// with the specified value.
Array.prototype.replace = function(from, to) {
	var i = this.indexOf(from);
	if (i >= 0) this[i] = to;
}

// Scales the values in this array by the given value.
Array.prototype.scale = function(amount) {
	var res = new Array(this.length);
	for (var i = 0; i < this.length; i++) {
		res[i] = this[i] * amount;
	}
	return res;
}

// Adds the values in this array with the values in the other array.
Array.prototype.add = function(other) {
	var res = new Array(this.length);
	for (var i = 0; i < this.length; i++) {
		res[i] = this[i] + other[i];
	}
	return res;
}

// Determines whether this array has the same items as the
// given array.
Array.prototype.equals = function(other) {
	if (this.length != other.length) return false;
	for (var i = 0; i < this.length; i++) {
		if (this[i] !== other[i]) return false;
	}
	return true;
}

// A list of primes used to create hash functions.
var hashPrimes = [
	263, 269, 271, 277, 281,
	283, 293, 307, 311, 313,
	317, 331, 337, 347, 349]
	
// Gets a hash for an array.
Array.prototype.getHash = function() {
	var h = 1709;
	for(i = 0; i < this.length; i++) {
		h += hash(this[i]);
		h *= hashPrimes[i % hashPrimes.length];
	}
	return h;
}


// The hash code given to next object for which one is needed,
// but not supplied.
var nextHash = 1987;

// Gets the hash code for the given object.
function hash(object) {
	return object.hash || 
		(object.hash = object.getHash ?
			object.getHash() :
			nextHash += 53);
}

// Determines whether the given objects are equal.
function equals(a, b) {
	return a.equals(b);
}

// An implementation of a hashtable that stores set of objects,
// using linear probing for collision resolution. 'null' is interpreted as
// a special value and thus can not be stored in the HashSet.
function HashSet(initialCapacity) {
	this.count = 0;
	this.buckets = new Array(initialCapacity);
	for (var i = 0; i < this.buckets.length; i++) {
		this.buckets[i] = null;
	}
	this.maxLoadFactor = 0.5;
}

// Checks if the given item is in the HashSet. If so, it returns the
// item as it is stored in the HashSet. If not, the item is added to
// the hash-set and is returned as-is.
HashSet.prototype.check = function(item) {
	var index = hash(item).mod(this.buckets.length);
	while (true) {
		if (this.buckets[index] === null) {
			this.buckets[index] = item;
			this.count++;
			if (this.count / this.buckets.length > this.maxLoadFactor) this.expand();
			return item;
		} else {
			if (equals(item, this.buckets[index])) {
				return this.buckets[index];
			}
		}
		index++;
	}
}

// Inserts the given item into the HashSet with the assumption that it is
// not already in it.
HashSet.prototype.insert = function(item) {
	var index = hash(item).mod(this.buckets.length);
	while (this.buckets[index] !== null) {
		index++;
	}
	this.buckets[index] = item;
	this.count++;
}

// Changes the capacity of the HashSet.
HashSet.prototype.resize = function(capacity) {
	var oldBuckets = this.buckets;
	this.buckets = new Array(capacity);
	for (var i = 0; i < this.buckets.length; i++) {
		this.buckets[i] = null;
	}
	this.count = 0;
	for (var i = 0; i < oldBuckets.length; i++) {
		var item = oldBuckets[i];
		if (item !== null) this.insert(item);
	}
}

// Resizes the HashSet in order to lower the load factor.
HashSet.prototype.expand = function() {
	this.resize(this.buckets.length * 2 + 1);
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
WebGLRenderingContext.prototype.loadShader = function(type, source) {
	var shader = this.createShader(type);
	this.shaderSource(shader, source);
	this.compileShader(shader);
	if (!this.getShaderParameter(shader, this.COMPILE_STATUS)) {
		throw "Shader Compiler Error: " + this.getShaderInfoLog(shader);
	}
	return shader;
}

// Creates and compiles a vertex shader from the given source.
WebGLRenderingContext.prototype.loadVertexShader = function(source) {
	return this.loadShader(this.VERTEX_SHADER, source);
}

// Creates and compiles a fragment shader from the given source.
WebGLRenderingContext.prototype.loadFragmentShader = function(source) {
	return this.loadShader(this.FRAGMENT_SHADER, source);
}

// Creates and links a shader program from the given vertex and
// fragment shaders.
WebGLRenderingContext.prototype.loadProgram = function(vs, fs) {
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