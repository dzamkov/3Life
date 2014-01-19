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
	
	// Appends the contents of a surface node (with the given transformation information)
	// to a HashMap of mesh builders indexed by material.
	function buildSurfaceNode(builders, axis, flip, pos, norm, node, scale, offset) {
		if (node.depth == 0) {
			var material = node.material;
			if (material !== Material.empty && material !== Material.inside) {
				var builder = getBuilder(builders, material);
				var bound = Area.Bound.unit.transform(scale, offset);
				var verts = new Array(4);
				for (var i = 0; i < 4; i++) {
					verts[i] = builder.vertex(
						Vec3.unproj(bound.getCorner(i), axis, pos),
						norm);
				}
				if (flip) builder.quad(verts[0], verts[1], verts[2], verts[3]);
				else builder.quad(verts[0], verts[2], verts[1], verts[3]);
			}
		} else {
			for (var i = 0; i < 4; i++) {
				buildSurfaceNode(builders, axis, flip, pos, norm, node.children[i],
					scale * 0.5, Area.getOffset(scale, offset, i));
			}
		}
	}
	
	// Appends the surface contents of a matter node (with the given transformation
	// applied) to a HashMap of mesh builders indexed by material.
	function buildMatterNode(builders, node, scale, offset) {
		for (var axis = 0; axis < 3; axis++) {
			var pOffset = Vec3.proj(offset, axis);
			var disconts = Matter.slice(axis, node).tail;
			for (var i = 0; i < disconts.length; i++) {
				var discont = disconts[i];
				buildSurfaceNode(builders, axis, false, 
					discont.pos, Vec3.getUnit(axis, false),
					discont.at[0], scale, pOffset);
				buildSurfaceNode(builders, axis, true, 
					discont.pos, Vec3.getUnit(axis, true),
					discont.at[1], scale, pOffset);
			}
		}
	}
	
	// Creates and returns a function to render a node (given the 'viewProj' matrix).
	function prepareRenderNode(gl, node, scale, offset) {
		var builders = new HashMap(13);
		buildMatterNode(builders, node, scale, offset);
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
	this.buildSurfaceNode = buildSurfaceNode;
	this.buildMatterNode = buildMatterNode;
	this.prepareRenderNode = prepareRenderNode;
}