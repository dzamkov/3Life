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

// Contains functions related to equality.
var Equality = new function() {

	// Determines whether two objects are equal.
	function equals(a, b) {
		if (a instanceof Object) return a.equals(b);
		return a === b;
	}
	
	// Gets the hash of an object. In order for two objects to
	// be considered equal by the above function, they must
	// have the same hash.
	function hash(obj) {
		if (obj instanceof Object) return obj.hash || obj.getHash();
		return 0;
	}

	// Contains functions and values related to hashing.
	var Hash = new function() {
	
		// A list of useful hash primes.
		var primes = [
			53, 97, 193, 389, 769,
			1543, 3079, 6151, 12289,
			24593, 49157, 98317]
			
		// The arbitrary hash code that will be given next time one
		// is requested.
		var next = 1987;
		
		// Returns a unique hash.
		function unique() {
			return next += 53;
		}
		
		// Returns a hash based on the contents of an
		// array of objects.
		function array(items) {
			var h = 0;
			for(i = 0; i < items.length; i++) {
				h = h + hash(items[i]) | 0;
				h = h * primes[i % primes.length] | 0;
			}
			return h;
		}
		
		// Returns a hash based on the given arguments.
		function items() {
			return array(arguments);
		}
	
		// Define exports.
		this.primes = primes;
		this.unique = unique;
		this.array = array;
		this.items = items;
	};
	
	// Define default object equality.
	Object.prototype.getHash = function() {
		return this.hash = Hash.unique();
	}
	Object.prototype.equals = function(other) {
		return this === other;
	}
	
	// Define default array equality.
	Array.prototype.getHash = function() {
		return Hash.array(this);
	}
	Array.prototype.equals = function(other) {
		if (this.length != other.length) return false;
		for (var i = 0; i < this.length; i++) {
			if (!equals(this[i], other[i])) return false;
		}
		return true;
	}
	
	// Define exports.
	this.equals = equals;
	this.hash = hash;
	this.Hash = Hash;
};

// An implementation of a hashtable that associates a set of keys with values.
// Keys are compared using the functions in 'Equality'. This implementation
// uses linear probing for collision resolution.
function HashMap(initialCapacity) {
	this.count = 0;
	this.buckets = new Array(initialCapacity);
	for (var i = 0; i < this.buckets.length; i++) {
		this.buckets[i] = null;
	}
	this.maxLoadFactor = 0.5;
}

// Define HashMap functions.
(function() {

	// Describes a bucket within a HashMap.
	function Bucket(key, value) {
		this.key = key;
		this.value = value;
	}
	
	// Looks up the value for an item in this HashMap, or creates it
	// using the given function if it does not already exist.
	this.prototype.lookup = function(key, create) {
		var index = Equality.hash(key).mod(this.buckets.length);
		while (true) {
			if (this.buckets[index] === null) {
				var value = create(key);
				this.buckets[index] = new Bucket(key, value);
				this.count++;
				if (this.count / this.buckets.length > this.maxLoadFactor) this.expand();
				return value;
			} else {
				if (Equality.equals(key, this.buckets[index].key)) {
					return this.buckets[index].value;
				}
			}
			index = (index + 1) % this.buckets.length;
		}
	}

	// Updates the value for an item in this HashMap.
	this.prototype.set = function(key, value) {
		var index = Equality.hash(key).mod(this.buckets.length);
		while (true) {
			if (this.buckets[index] === null) {
				this.buckets[index] = new Bucket(key, value);
				this.count++;
				if (this.count / this.buckets.length > this.maxLoadFactor) this.expand();
				return;
			} else {
				if (Equality.equals(key, this.buckets[index].key)) {
					this.buckets[index].value = value;
					return;
				}
			}
			index = (index + 1) % this.buckets.length;
		}
	}
	
	// Gets the value for an item in this HashMap, or returns null if the item
	// is not in the HashMap.
	this.prototype.get = function(key) {
		var index = Equality.hash(key).mod(this.buckets.length);
		while (this.buckets[index] !== null) {
			if (Equality.equals(key, this.buckets[index])) {
				return this.buckets[index].value;
			}
			index = (index + 1) % this.buckets.length;
		}
		return null;
	}
	
	// Calls a function for each item in this HashMap. Items are returned in
	// an arbitrary order.
	this.prototype.forEach = function(func) {
		for (var i = 0; i < this.buckets.length; i++) {
			var bucket = this.buckets[i];
			if (bucket !== null) {
				func(bucket.key, bucket.value);
			}
		}
	}

	// Inserts the given bucket into a HashMap with the assumption that no bucket
	// with the same key is already in it and that the HashMap already has the
	// right capacity.
	function insert(map, bucket) {
		var index = Equality.hash(bucket.key).mod(map.buckets.length);
		while (map.buckets[index] !== null) {
			index = (index + 1) % map.buckets.length;
		}
		map.buckets[index] = bucket;
		map.count++;
	}

	// Changes the capacity of the HashMap.
	this.prototype.resize = function(capacity) {
		var oldBuckets = this.buckets;
		this.buckets = new Array(capacity);
		for (var i = 0; i < this.buckets.length; i++) {
			this.buckets[i] = null;
		}
		this.count = 0;
		for (var i = 0; i < oldBuckets.length; i++) {
			var bucket = oldBuckets[i];
			if (bucket !== null) insert(this, bucket);
		}
	}

	// Resizes the HashMap in order to lower the load factor.
	this.prototype.expand = function() {
		this.resize(this.buckets.length * 2 + 1);
	}
	
}).call(HashMap);

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