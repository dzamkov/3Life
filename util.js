// Contains functions related to callbacks.
var Callback = new function() {

	// Creates a new empty callback.
	function create() {
		return new Array();
	}
	
	// Extends a callback with a handler to be called when
	// it is invoked. The optional 'undo' callback can be specified
	// in order for this function to register an undo handler which
	// will remove the handler binding when the callback is invoked.
	// This function may be called with 'callback' as null, in which
	// case nothing happens.
	function register(callback, handler, undo) {
		if (callback) {
			callback.push(handler);
			if (undo) {
				undo.push(function() {
					var index = callback.indexOf(handler);
					if (index >= 0) {
						callback.splice(index, 1);
					}
				});
			}
		}
	}
	
	// Invokes a callback with the given arguments.
	function invoke(callback) {
		var args = Array.prototype.slice.call(arguments, 1);
		for (var i = 0; i < callback.length; i++) {
			var res = callback[i].apply(Global, args);
			if (res) return res;
		}
	}
	
	// Common callbacks.
	this.render = create();
	this.input = create();
	this.update = create();
	
	// Define exports.
	this.create = create;
	this.register = register;
	this.invoke = invoke;
}

// Contains functions related to DOM events.
var Event = new function() {
	
	// Registers a listener for a DOM event, similar to 'Callback.register'.
	this.register = function(element, name, listener, undo) {
		element.addEventListener(name, listener);
		Callback.register(undo, function() {
			element.removeEventListener(name, listener);
		});
	}
}

// Identifies a value that is not currently available. The 'begin' parameter
// is a function to be called to start the loading of the value for the promise.
// It takes, as a parameter, the 'fufill' function for the promise. Alternatively,
// the 'begin' parameter can be set to null, in which case the promise can only
// be fufilled explicitly, by calling the 'fufill' method.
function Promise(begin) {
	this.begin = begin;
	this.fufilled = Callback.create();
	this.value = null;
}

// Define 'Promise' functions.
(function() {

	// Creates a new promise.
	function create(begin) {
		return new Promise(begin);
	}

	// Fufills this promise by assigning it a concrete value. This
	// may only be called once in the lifetime of the 'Promise'.
	this.prototype.fufill = function(value) {
		this.begin = null;
		this.value = value;
		Callback.invoke(this.fufilled, value);
		this.fufilled = null;
	}
	
	// Registers a handler to be called when this promise is fufilled,
	// or immediately if the promise has already been fufilled.
	this.prototype.await = function(handler, undo) {
		if (this.fufilled) {
			if (this.begin) {
				var begin = this.begin;
				this.begin(this.fufill.bind(this), undo);
				this.begin = null;
				Callback.register(undo, function() {
					this.begin = begin;
				});
			}
			Callback.register(this.fufilled, handler, undo);
		} else {
			handler(this.value);
		}
	}
	
	// Creates and returns a promise corresponding to this promise with
	// the given mapping applied.
	this.prototype.map = function(map) {
		var current = this;
		return create(function(fufill, undo) {
			current.await(function(value) {
				fufill(map(value));
			}, false, undo);
		});
	}
	
	// Like 'map', but calls the mapping function with 'arguments'
	// set to value of this promise.
	this.prototype.mapArgs = function(map) {
		return this.map(function(value) {
			return map.apply(this, value);
		});
	}
	
	// Creates and returns a promise which awaits all promises in a 
	// collection (either an 'Array', or a key/value mapping), and returns
	// a similarly-structured collection with all promises replaced by
	// their corresponding values.
	function join(sources) {
		return create(function(fufill, undo) {
			if (sources instanceof Array) {
				var result = new Array(sources.length);
				var have = 0;
				for (var i = 0; i < sources.length; i++) {
					sources[i].await((function(value) {
						result[this] = value;
						if (++have >= sources.length) fufill(result);
					}).bind(i), undo);
				}
			} else {
				var result = new Object();
				var need = 1;
				var have = 0;
				for (name in sources) {
					if (sources[name] instanceof Promise) {
						need++;
						sources[name].await((function(value) {
							result[this] = value;
							if (++have >= need) fufill(result);
						}).bind(name), undo);
					} else {
						result[name] = sources[name];
					}
				}
				if (have >= --need) fufill(result);
			}
		});
	}
	
	// Requests the text contents of a URL and returns
	// the result as a promise.
	function requestText(url) {
		return create(function(fufill) {
			var request = new XMLHttpRequest();
			request.open('GET', url, true);
			request.onload = function() { 
				fufill(request.responseText);
			}
			request.send();
		});
	}
	
	// Requests the image contents of a URL and returns
	// the result as a promise.
	function requestImage(url) {
		return create(function(fufill) {
			var image = new Image();
			image.src = url;
			image.onload = function() {
				fufill(image);
			}
		});
	}
	
	// Define exports.
	this.create = create;
	this.join = join;
	this.requestText = requestText;
	this.requestImage = requestImage;
}).call(Promise);

// Defines a delay-loaded section of code. This will wait for a promise
// to be fufilled (without forcing it to begin loading) and call a handler
// upon completion. If the optional 'list' parameter is specified, the 
// promise will be appended to the array.
function delay(source, handler, list) {
	if (source.fufilled) {
		Callback.register(source.fufilled, handler);
	} else {
		handler(this.value);
	}
	if (list) list.push(source);
}

// The global object. I know this is probably 'window' but I want to
// distinguish between references to window objects (DOM, screens, etc) and
// references to objects I define at the global scope.
var Global = this;

// A function that does nothing.
function ignore() { }

// Combines a set of actions (parameterless functions) into one action.
function combine(actions) {
	actions = actions.filter(function(action) { return action !== ignore; });
	if (actions.length == 0) return ignore;
	return function() { for(var i = 0; i < actions.length; i++) { actions[i](); } };
}

// Correct modulo for negative numbers.
Number.prototype.mod = function(n) {
	return ((this % n) + n) % n;
}

// Contains functions related to structural equality of objects. This
// is defined as '===' for all non-array objects and recursive structural
// equality for arrays.
var Equality = new function() {

	// Determines whether two objects are equal.
	function equals(a, b) {
		if (a instanceof Array) {
			if (b instanceof Array) {
				if (a.length != b.length) return false;
				for (var i = 0; i < a.length; i++) {
					if (!equals(a[i], b[i])) return false;
				}
				return true;
			} else {
				return false;
			}
		} else {
			return a === b;
		}
	}
	
	// A list of useful hash primes.
	var primes = [
		53, 97, 193, 389, 769,
		1543, 3079, 6151, 12289,
		24593, 49157, 98317];
		
	// The arbitrary object hash code that will be given next time one
	// is requested.
	var nextHash = 1987;
	
	// The name of the property used to store the hash code of a
	// non-array object.
	var hashPropertyName = "__hash__";
	
	// Gets the hash of an object. In order for two objects to
	// be considered equal by the above function, they must
	// have the same hash.
	function hash(obj) {
		if (obj instanceof Object) {
			if (obj instanceof Array) {
				var h = 0;
				for(i = 0; i < obj.length; i++) {
					h = h + hash(obj[i]) | 0;
					h = h * primes[i % primes.length] | 0;
				}
				return h;
			} else {
				if (hashPropertyName in obj) {
					return obj[hashPropertyName];
				} else {
					var h = nextHash += 57;
					Object.defineProperty(obj, hashPropertyName, { value : h });
					return h;
				}
			}
		} else {
			return 0;
		}
	}

	// Define exports.
	this.equals = equals;
	this.hash = hash;
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
		var index = Math.abs(Equality.hash(key) % this.buckets.length);
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
		var index = Math.abs(Equality.hash(key) % this.buckets.length);
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
		var index = Math.abs(Equality.hash(key) % this.buckets.length);
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
		var index = Math.abs(Equality.hash(bucket.key) % map.buckets.length);
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

// Creates a WebGLRenderingContext for the given canvas element.
function createGLContext(canvas) {
	var gl = canvas.getContext('experimental-webgl') ||
		canvas.getContext('webgl');
	if (!gl) throw "WebGL Not Supported";
	return gl;
}

window.requestAnimationFrame = window.requestAnimationFrame ||
	window.webkitRequestAnimationFrame ||
	window.mozRequestAnimationFrame ||
	window.oRequestAnimationFrame ||
	window.msRequestAnimationFrame ||
	function(callback, element) {
		window.setTimeout(callback, 1000 / 60);
	};