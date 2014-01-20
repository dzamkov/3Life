// Contains functions for rendering matter nodes.
var Render = new function() {

	// The size of the vertices used in meshes containing block data.
	var vertexSize = 6;

	// The attributes of the vertices used in meshes containing block data.
	var attributes = {
		pos : { size : 3, offset : 0 },
		norm : { size : 3, offset : 3 }
	};
	
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
	
	// Prepares the renderable parts (program/mesh pairs) defined by the given builders,
	// outputing them to the appropriate array (either 'opaque' or 'transparent'). The
	// given map function can be used to modify materials before they are used in parts.
	function prepareParts(gl, builders, map, opaque, transparent) {
		builders.forEach(function(mat, builder) {
			mat = map(mat);
			var part = {
				mat : mat,
				program : mat.program.get(gl),
				mesh : builder.finish().create(gl)
			}
			if (mat.isOpaque) {
				opaque.push(part);
			} else {
				transparent.push(part);
			}
		});
	}
	
	// Renders the given part with the given parameters.
	function renderPart(gl, part, model, viewProj) {
		part.mat.setupTextures(gl);
		gl.render(part.program, part.mesh, {
			model : model,
			view : viewProj,
			__proto__ : part.mat.constants
		});
	}
	
	// Renders the given set of parts with the given parameters.
	function renderParts(gl, opaque, transparent, model, viewProj) {
		for (var i = 0; i < opaque.length; i++) {
			renderPart(gl, opaque[i], model, viewProj);
		}
		
		// TODO: Depth peeling.
		
		gl.colorMask(false, false, false, false);
		for (var i = 0; i < transparent.length; i++) {
			renderPart(gl, transparent[i], model, viewProj);
		}
		gl.colorMask(true, true, true, true);
		gl.depthFunc(gl.EQUAL);
		gl.enable(gl.BLEND);
		gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
		for (var i = 0; i < transparent.length; i++) {
			renderPart(gl, transparent[i], model, viewProj);
		}
		gl.disable(gl.BLEND);
		gl.depthFunc(gl.LESS);
	}
	
	// Creates and returns a function to render a node (given the 'viewProj' matrix).
	function prepareRenderNode(gl, node, scale, offset) {
		var builders = new HashMap(13);
		buildMatterNode(builders, node, scale, offset);
		var opaque = new Array();
		var transparent = new Array();
		prepareParts(gl, builders, identity, opaque, transparent);
		var model = mat4.create();
		mat4.identity(model);
		return function(viewProj) {
			renderParts(gl, opaque, transparent, model, viewProj);
		}
	}
	
	// Define exports.
	this.vertexSize = vertexSize;
	this.attributes = attributes;
	this.getBuilder = getBuilder;
	this.buildSurfaceNode = buildSurfaceNode;
	this.buildMatterNode = buildMatterNode;
	this.prepareParts = prepareParts;
	this.renderPart = renderPart;
	this.renderParts = renderParts;
	this.prepareRenderNode = prepareRenderNode;
}