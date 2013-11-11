
// A node representing a physical configuration of a 3D space. This
// is the base node type for the HashLife algorithim.
var Matter = Volume.Node();

// Define wireworld simulation.
var empty = Matter.leaf();
empty.material = Material.empty;

var copper = Matter.leaf();
copper.material = Material.solid(1.0, 0.5, 0.0);

var electronHead = Matter.leaf();
electronHead.material = Material.solid(0.2, 0.6, 0.7);

var electronTail = Matter.leaf();
electronTail.material = Material.solid(0.5, 0.9, 1.0);

// Create test world.
var testWorld = (function() {
	var e = empty;
	var c = copper;
	var h = electronHead;
	var t = electronTail;
	
	var x0 = Matter.merge(c, c, c, c, e, h, e, h);
	var x1 = Matter.merge(x0, x0, x0, x0, e, e, e, e);
	var x2 = Matter.merge(x1, x1, x1, x1, e, e, x0, e);
	var x3 = Matter.merge(x2, x2, x1, x2, e, e, e, e);
	var x4 = Matter.merge(x3, x3, x3, x3, e, e, e, x2);
	var x5 = Matter.merge(x4, x4, x4, x4, e, e, e, e);
	var x6 = Matter.merge(x5, x5, x5, x5, e, e, e, e);
	var x7 = Matter.merge(x6, x6, x6, x6, e, e, x4, e);
	var x8 = Matter.merge(x7, x7, x7, x7, e, e, e, x5);
	var x9 = Matter.merge(x8, x8, x8, x8, e, e, e, e);
	return x8;
})();