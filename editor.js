// Describes a free-floating camera for an editor.
function Camera(pos, yaw, pitch) {
	this.pos = pos;
	this.yaw = yaw;
	this.pitch = pitch;
	this.foward = [
		Math.cos(yaw) * Math.cos(pitch),
		Math.sin(yaw) * Math.cos(pitch),
		Math.sin(pitch)];
}

// Define 'Camera' methods.
(function() {

	// Gets the view matrix for this camera.
	this.prototype.getMatrix = function() {
		return mat4.lookAt(this.pos,
			Vec3.add(this.pos, this.foward),
			[0, 0, 1]);
	}
	
	// Moves this camera along its horizontal plane.
	this.prototype.move = function(right, foward) {
		var foward = this.getFoward();
		var right = Volume.Vector.cross(foward, [0, 0, 1]);
	}

}).call(Camera);

// An interface to a canvas acting as a 3D scene editor.
function Editor(canvas, controls) {
	this.canvas = canvas;
	this.gl = createGLContext(canvas);
	
}