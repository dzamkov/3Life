// Contains functions and types related to user input.
var Input = new function() {

	// An element-independent description of an input event source, which
	// may be associated with arbitrary data. Each trigger contains 
	// a function 'link' which, when given an element and an event 
	// handler, will pair the event handler with the associated input
	// event on the element. The function will return another function
	// which can be called to later disable the event handler.
	function Trigger() {
		this.link = null;
	}
	
	// An element-independent description of an input signal (a continuous
	// source of arbitrary data). Each signal contains a function 'link' which,
	// when given an element, will return a function which can be called to
	// get the current value of the signal for that element.
	function Signal() {
		this.link = null;
	}
	
	// Define 'Trigger' sub-types and constructors.
	(function() {
	
		// The base type for triggers.
		var Base = this;
		
		// A trigger for a key event, associating each event with the
		// scan code of the key.
		function AnyKey(down) {
			this.down = down;
			this.eventName = down ? 'keydown' : 'keyup';
		}
		
		// Define 'AnyKey' methods and values.
		(function() {
			this.prototype = Object.create(Base);
			this.prototype.link = function(element, handler) {
				var listener = function(eventData) {
					handler(eventData.keyCode);
				};
				var eventName = this.eventName;
				element.addEventListener(eventName, listener);
				return function() {
					element.removeEventListener(eventName, listener);
				};
			};
			this.down = new AnyKey(true);
			this.up = new AnyKey(false);
			this.get = function(down) {
				return down ? AnyKey.down : AnyKey.up;
			};
		}).call(AnyKey);
		
		// A trigger for a mouse button event, associating each event 
		// with the button index.
		function AnyMouseButton(down) {
			this.down = down;
			this.eventName = down ? 'mousedown' : 'mouseup';
		}
		
		// Define 'AnyMouseButton' methods and values.
		(function() {
			this.prototype = Object.create(Base);
			this.prototype.link = function(element, handler) {
				var listener = function(eventData) {
					handler(eventData.button);
				};
				var eventName = this.eventName;
				element.addEventListener(eventName, listener);
				return function() {
					element.removeEventListener(eventName, listener);
				};
			};
			this.down = new AnyMouseButton(true);
			this.up = new AnyMouseButton(false);
			this.get = function(down) {
				return down ? AnyMouseButton.down : AnyMouseButton.up;
			};
		}).call(AnyMouseButton);
		
		// A type of trigger which only passes events when a given
		// boolean signal has the value 'true'.
		function When(source, signal) {
			this.source = source;
			this.signal = signal;
		}
		
		// Define 'When' methods.
		(function() {
			this.prototype = Object.create(Base);
			this.prototype.link = function(element, handler) {
				var shouldPass = this.signal.link(element);
				return this.source.link(element, function(data) {
					if (shouldPass()) handler(data);
				});
			};
		}).call(When);
		
		// Define 'when' method for triggers.
		this.prototype.when = function(signal) {
			return new When(this, signal);
		};
		
		// A type of trigger which only passes events where the 
		// event data is equal to the given target value.
		function Specific(source, target) {
			this.source = source;
			this.target = target;
		}
		
		// Define 'Specific' methods.
		(function() {
			this.prototype = Object.create(Base);
			this.prototype.link = function(element, handler) {
				var target = this.target;
				return this.source.link(element, function(data) {
					if (data === target) handler(data);
				});
			};
		}).call(Specific);
		
		// Define 'specific' method for triggers.
		this.prototype.specific = function(target) {
			return new Specific(this, target);
		};
		
		// Creates a trigger for a key.
		function key(code, down) {
			return AnyKey.get(down).specific(code);
		}
		
		// Creates a trigger for a mouse button.
		function mouseButton(index, down) {
			return AnyMouseButton.get(down).specific(code);
		}
		
		// Define exports.
		this.AnyKey = AnyKey;
		this.anykey = AnyKey.get;
		this.AnyMouseButton = AnyMouseButton;
		this.anyMouseButton = AnyMouseButton.get;
		this.When = When;
		this.Specific = Specific;
		this.key = key;
		this.mouseButton = mouseButton;
	}).call(Trigger);

	// Define 'Signal' sub-types and constructors.
	(function() {
	
		// The base type for signals.
		var Base = this;
		
		// A signal that returns the state of the key 
		// with the given scan code (true for down, false for up).
		function Key(code) {
			this.code = code;
		}
		
		// Define 'Key' methods.
		(function() {
			this.prototype = Object.create(Base);
			this.prototype.link = function(element) {
				if (!element.keyStates) {
					var keyStates = element.keyStates = new Array();
					element.addEventListener('keydown', function(eventData) {
						keyStates[eventData.keyCode] = true;
					});
					element.addEventListener('keyup', function(eventData) {
						keyStates[eventData.keyCode] = false;
					});
				}
				var code = this.code;
				var keyStates = element.keyStates;
				if (!(code in keyStates)) keyStates[code] = false;
				return function() { return keyStates[code]; };
			};
			this.create = function(code) {
				return new Key(code);
			}
		}).call(Key);
		
		// A signal which returns a directional 2-vector of the given
		// magnitude (or 0.0) by summing contributions from the given
		// from the given boolean signals.
		function Compass(xn, xp, yn, yp, mag) {
			this.xn = xn;
			this.xp = xp;
			this.yn = yn;
			this.yp = yp;
			this.mag = mag;
		}
		
		// Define 'Compass' methods.
		(function() {
			this.prototype = Object.create(Base);
			this.prototype.link = function(element) {
				var xn = this.xn.link(element);
				var xp = this.xp.link(element);
				var yn = this.yn.link(element);
				var yp = this.yp.link(element);
				var mag = this.mag;
				return function() {
					var res = [xp() - xn(), yp() - yn()];
					if (Math.abs(res[0]) == 1.0 && Math.abs(res[1]) == 1.0) {
						res[0] *= Math.sqrt(2.0) / 2.0;
						res[1] *= Math.sqrt(2.0) / 2.0;
					}
					res[0] *= mag;
					res[1] *= mag;
					return res;
				};
			};
			this.create = function(xn, xp, yn, yp, mag) {
				return new Compass(xn, xp, yn, yp, mag);
			}
		}).call(Compass);
		
		// A signal which returns a 2-vector that describes the
		// direction of movement of the WASD keys.
		var wasd = Compass.create(
			Key.create(65),
			Key.create(68),
			Key.create(83),
			Key.create(87),
			1.0);
	
		// Define exports.
		this.Key = Key;
		this.key = Key.create;
		this.Compass = Compass;
		this.compass = Compass.create;
		this.wasd = wasd;
	}).call(Signal);
	
	// Define exports.
	this.Trigger = Trigger;
	this.Signal = Signal;
}