/**
 * Render-stage used to render MaterialRenderStage to a texture,
 * then apply sub-stages to it and then render the resulting texture
 * to a screen-aligned quad that covers the entire viewport.
 */
var PostProcessRenderStage = RenderStage.extend({
	init: function() {
		this._super();
		this.size = vec2.fromValues(1024, 1024);
		this.src = false; ///< TargetTexture, once we receive context
		this.dst = false; ///< TargetTexture, once we receive context
		this.srcSampler = false; ///< Sampler for src
		this.dstSampler = false; ///< Sampler for dst
		this.quad = false; ///< Quad used to render textures
		this.material = false; ///< Material used to render the final image

		this.generator = this.getGeneratorStage();
		this.generator.parent = this;
	},

	getGeneratorStage: function() {
		return new MaterialRenderStage();
	},

	onStart: function(context, engine) {
		vec2.copy(this.size, engine.scene.camera.target.size);
		this.src = new TargetTexture(this.size, context, false);
		this.srcSampler = new Sampler('src', this.src.texture);

		this.dst = new TargetTexture(this.size, context, false);
		this.dstSampler = new Sampler('dst', this.dst.texture);

		this.material = new Material(engine.assetsManager.addShaderSource("shaders/default/ScreenQuad"), {}, []);

		var vertices = [-1,-1,0, -1,1,0, 1,1,0, 1,-1,0];
		var uv = [0,0, 0,1, 1,1, 1,0];
		var faces = [0, 1, 2, 0, 2, 3];
		this.quad = new TrianglesRenderBuffer(context, faces);
		this.quad.add('position', vertices, 3);
		this.quad.add("uv0", uv, 2);

		engine.assetsManager.load();

		this.generator.start(context, engine);
	},

	onPreRender: function(context, scene, camera) {
		var cameraTarget = camera.target;
		if (this.substages.length>0) {
			camera.target = this.src;
		}
		this.generator.render(context, scene, camera);
		camera.target = cameraTarget;
	},

	onPostRender: function(context, scene, camera) {
		if (this.substages.length == 0)
			return;

		this.renderEffect(context, this.material, this.srcSampler);
		this.swapBuffers();
	},

	swapBuffers: function() {
		var tmpTexture = this.src;
		var tmpSampler = this.srcSampler;
		this.src = this.dst;
		this.srcSampler = this.dstSampler;
		this.dst = tmpTexture;
		this.dstSampler = tmpSampler;
	},

	renderEffect: function(context, material, sampler) {
		var gl = context.gl;
		gl.disable(gl.DEPTH_TEST);
		gl.disable(gl.CULL_FACE);
		gl.clearColor(0.0, 0.0, 0.0, 0.0);
		gl.clear(gl.COLOR_BUFFER_BIT);

		material.bind({}, [sampler]);
		this.renderQuad(context, material.shader);
		material.unbind();
	},

	renderQuad: function(context, shader) {
		var gl = context.gl;
		var locations=[];
		for(var bufferName in this.quad.buffers) {
			gl.bindBuffer(gl.ARRAY_BUFFER, this.quad.buffers[bufferName]);
			var bufferLocation=gl.getAttribLocation(shader.program, bufferName);
			if(bufferLocation==-1) continue;
			gl.enableVertexAttribArray(bufferLocation);
			locations.push(bufferLocation);
			gl.vertexAttribPointer(bufferLocation, this.quad.buffers[bufferName].itemSize, gl.FLOAT, false, 0, 0);
		}
		this.quad.drawElements();
		for (var i in locations)
			gl.disableVertexAttribArray(locations[i]);
	}
});