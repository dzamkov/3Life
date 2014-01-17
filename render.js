// Contains functions for rendering matter nodes.
var Render = new function() {

	// The size of the vertices used in meshes containing block data.
	var vertexSize = 6;

	// The attributes of the vertices used in meshes containing block data.
	var attributes = {
		pos : { size : 3, offset : 0 },
		norm : { size : 3, offset : 3 }
	};

	// Appends a block cuboid (described by the given bound) to a mesh builder.
	function buildCuboid(builder, bound) {
		var min = bound.min;
		var max = bound.max;
		
	}
	
	// Gets the builder for the given material from a HashMap of mesh builders.
	function getBuilder(builders, material) {
		return builders.lookup(material, function() {
			return new Mesh.Builder(Mesh.Mode.Triangles, vertexSize, attributes, 16, 16);
		});
	}
	
	// Appends the surface contents of a matter node (with the given transformation
	// applied) to a HashMap of mesh builders indexed by material.
	function buildNode(builders, node, scale, offset) {
		if (node.depth == 0) {
			var substance = node.substance;
			if (substance !== Substance.empty && substance instanceof Substance.Solid) {
				var bound = Volume.Bound.unit.transform(scale, offset);
				var verts = new Array(4);
				for (var axis = 0; axis < 3; axis++) {
					var pBound = bound.proj(axis);
					for (var i = 0; i < 2; i++) {
						var val = (i == 1) ? bound.max[axis] : bound.min[axis];
						var norm = Vec3.getUnit(axis, i == 0);
						var material = substance.getFaceMaterial(axis, i == 1);
						var builder = getBuilder(builders, material);
						for (var j = 0; j < 4; j++) {
							verts[j] = builder.vertex(Vec3.unproj(
								pBound.getCorner(j), axis, val), norm);
						}
						if (i == 1) builder.quad(verts[0], verts[1], verts[2], verts[3]);
						else builder.quad(verts[0], verts[2], verts[1], verts[3]);
					}
				}
			}
		} else {
			for (var i = 0; i < 8; i++) {
				buildNode(builders, node.children[i], scale * 0.5,
					Volume.getOffset(scale, offset, i));
			}
		}
	}
	
	// Creates and returns a function to render a node (given the 'viewProj' matrix).
	function prepareRenderNode(gl, node, scale, offset) {
		var builders = new HashMap(13);
		buildNode(builders, node, scale, offset);
		var opaque = new Array();
		builders.forEach(function(mat, builder) {
			var part = { 
				mat : mat, 
				program : mat.program.get(gl),
				mesh : builder.finish().create(gl)
			}
			if (mat.isTransparent) {
				notImplemented();
			} else {
				opaque.push(part);
			}
		});
		var model = mat4.create();
		mat4.identity(model);
		return function(viewProj) {
			for (var i = 0; i < opaque.length; i++) {
				var part = opaque[i];
				part.mat.setupTextures(gl);
				gl.render(part.program, part.mesh, {
					model : model,
					view : viewProj,
					__proto__ : part.mat.constants
				});
			}
		}
	}
	
	// Define exports.
	this.vertexSize = vertexSize;
	this.attributes = attributes;
	this.getBuilder = getBuilder;
	this.buildNode = buildNode;
	this.prepareRenderNode = prepareRenderNode;
}