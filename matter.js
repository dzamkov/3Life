
// A node representing a physical configuration of a 3D space. This
// is the base node type for the HashLife algorithim.
var Matter = Volume.Node();

// Define wireworld simulation (for now).
var copper = Matter.leaf();
var electronHead = Matter.leaf();
var electronTail = Matter.leaf();