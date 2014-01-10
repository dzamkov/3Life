// "Standardize" methods.
(function() {
	var e = HTMLElement.prototype;
	e.requestPointerLock =
		e.requestPointerLock ||
		e.mozRequestPointerLock ||
		e.webkitRequestPointerLock;

	var d = document;
	d.exitPointerLock =
		d.exitPointerLock ||
		d.mozExitPointerLock ||
		d.webkitExitPointerLock;
		
	var m = MouseEvent.prototype;
	m.getMovement = function() {
		return [
			this.movementX ||
			this.mozMovementX ||
			this.webkitMovementX,
			this.movementY ||
			this.mozMovementY ||
			this.webkitMovementY];
	}
})();

// Contains functions and types related to user input.
var Input = new function() {

	// An element-independent description of an input event source, which
	// may be associated with arbitrary data.
	function Trigger() { }
	
	// Define 'Trigger' sub-types and constructors.
	(function() {
	
		// Registers a handler for this trigger. Certain triggers (such as those
		// for keyboard and mouse button events) may be associated with
		// a given element. When the trigger is fired, the handler is called
		// with data associated with the event.
		this.prototype.register = function(element, handler, undo) { }
		
		// A trigger for a DOM event. The 'extract' function will convert the
		// Event object into trigger data.
		function Event(name, extract) {
			this.name = name;
			this.extract = extract;
		}
		
		// Define 'Event' functions.
		(function() {
			this.prototype = Object.create(Trigger.prototype);
			this.prototype.register = function(element, handler, undo) {
				var extract = this.extract;
				Global.Event.register(element, this.name, function(event) {
					handler(extract(event));
				}, undo);
			}
			this.create = function(name, extract) {
				return new Event(name, extract);
			}
		}).call(Event);
		
		// A trigger modifier which only passes events where the 
		// event data is equal to the given target value.
		function Specific(source, target) {
			this.source = source;
			this.target = target;
		}
		
		// Define 'Specific' methods.
		(function() {
			this.prototype = Object.create(Trigger.prototype);
			this.prototype.register = function(element, handler, undo) {
				var target = this.target;
				this.source.register(element, function(data) {
					if (data === target) handler(data);
				}, undo);
			};
		}).call(Specific);
		
		// Define 'specific' method for triggers.
		this.prototype.specific = function(target) {
			return new Specific(this, target);
		}
		
		// A trigger which fires with 2D movement vectors whenever the mouse moves
		// between firings of the given 'start' and 'stop' triggers.
		function MouseDrag(start, stop) {
			this.start = start;
			this.stop = stop;
		}
		
		// Define 'MouseDrag' functions.
		(function() {
			this.prototype = Object.create(Trigger.prototype);
			this.prototype.register = function(element, handler, undo) {
				function listener(e) {
					var m = e.getMovement();
					m[1] = -m[1];
					handler(m);
				}
				this.start.register(element, function() {
					element.addEventListener('mousemove', listener);
				}, undo);
				this.stop.register(element, function() {
					element.removeEventListener('mousemove', listener);
				}, undo);
			}
			this.create = function(start, stop) {
				return new MouseDrag(start, stop);
			}
		}).call(MouseDrag);
		
		// Key triggers.
		var extractKeyCode = function(event) { return event.keyCode; };
		var anyKeyDown = Event.create('keydown', extractKeyCode);
		var anyKeyUp = Event.create('keyup', extractKeyCode);
		function anyKey(down) {
			return down ? anyKeyDown : anyKeyUp;
		}
		function key(code, down) {
			return anyKey(down).specific(code);
		}
		
		// Mouse button triggers.
		var extractButton = function(event) { return event.button; };
		var anyMouseButtonDown = Event.create('mousedown', extractButton);
		var anyMouseButtonUp = Event.create('mouseup', extractButton);
		function anyMouseButton(down) {
			return down ? anyMouseButtonDown : anyMouseButtonUp;
		}
		var mouseButtonUp = new Array(3);
		var mouseButtonDown = new Array(3);
		function mouseButton(index, down) {
			var cache = down ? mouseButtonDown : mouseButtonUp;
			if (cache[index]) return cache[index];
			return cache[index] = anyMouseButton(down).specific(index);
		}
		
		// Define exports.
		this.Event = Event;
		this.event = Event.create;
		this.Specific = Specific;
		this.MouseDrag = MouseDrag;
		this.mouseDrag = MouseDrag.create;
		this.anyMouseButton = anyMouseButton;
		this.anyKey = anyKey;
		this.mouseButton = mouseButton;
		this.key = key;
	}).call(Trigger);
	
	// An element-independent description of an input signal (a continuous
	// source of arbitrary data).
	function Signal() { }

	// Define 'Signal' sub-types and constructors.
	(function() {
	
		// Creates a function to read data from this signal.
		this.prototype.link = function(element, undo) { }
		
		// A signal that returns the state of the key with 
		// the given scan code (true for down, false for up).
		function Key(code) {
			this.code = code;
		}
		
		// Define 'Key' methods.
		(function() {
			this.prototype = Object.create(Signal.prototype);
			this.prototype.link = function(element, undo) {
				if (!window.keyStates) {
					var keyStates = window.keyStates = new Array();
					window.addEventListener('keydown', function(eventData) {
						keyStates[eventData.keyCode] = true;
					});
					window.addEventListener('keyup', function(eventData) {
						keyStates[eventData.keyCode] = false;
					});
				}
				var code = this.code;
				var keyStates = window.keyStates;
				if (!(code in keyStates)) keyStates[code] = false;
				return function() { return keyStates[code]; };
			};
			this.create = function(code) {
				return new Key(code);
			}
		}).call(Key);
		
		// A signal which returns a directional 2-vector of magnitude
		// 1.0 by summing contributions from the given
		// from the given boolean signals.
		function Compass(xn, xp, yn, yp) {
			this.xn = xn;
			this.xp = xp;
			this.yn = yn;
			this.yp = yp;
		}
		
		// Define 'Compass' methods.
		(function() {
			var dia = Math.sqrt(2) / 2.0;
			this.prototype = Object.create(Signal.prototype);
			this.prototype.link = function(element, undo) {
				var xn = this.xn.link(element, undo);
				var xp = this.xp.link(element, undo);
				var yn = this.yn.link(element, undo);
				var yp = this.yp.link(element, undo);
				var mag = this.mag;
				return function() {
					var res = [xp() - xn(), yp() - yn()];
					if (Math.abs(res[0]) == 1.0 && Math.abs(res[1]) == 1.0) {
						res[0] *= dia;
						res[1] *= dia;
					}
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
			Key.create(87));
			
		// A signal which returns a 2-vector that describes the
		// direction of movement of the IJKL keys.
		var ijkl = Compass.create(
			Key.create(74),
			Key.create(76),
			Key.create(75),
			Key.create(73));
	
		// Define exports.
		this.Key = Key;
		this.key = Key.create;
		this.Compass = Compass;
		this.compass = Compass.create;
		this.wasd = wasd;
		this.ijkl = ijkl;
	}).call(Signal);
	
	// Define exports.
	this.Trigger = Trigger;
	this.Signal = Signal;
}