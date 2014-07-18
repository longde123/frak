/** Render-stage that uses forward rendering to render meshes with materials and directional lighting */
var MaterialRenderStage=RenderStage.extend({
	init: function() {
		this._super();
		this.visibleRenderers=0;
		this.visibleSolidRenderers=0;
		this.visibleSolidBatches=0;
		this.visibleSolidFaces=0;
		this.visibleTransparentRenderers=0;
		this.visibleTransparentFaces=0;

		this.solidRenderers=[];
		this.solidRendererBatches=[];
		this.transparentRenderers=[];


		this.shadowMapStage=this.addStage(new ShadowMapRenderStage());
		this.shadowMapFallbackSampler = false;

		// internal cache
		this.eyePosition=vec3.create();
		this.invModelview=mat4.create();

		// Shared uniforms cache
		this.sharedUniforms={
			"time": new UniformFloat(0),
			"view": new UniformMat4(mat4.create()),
			"viewInverse": new UniformMat4(mat4.create()),
			"projection": new UniformMat4(mat4.create())
		};

		// Renderer uniforms cache
		this.rendererUniforms={
			"model": new UniformMat4(mat4.create()),
			"modelview": new UniformMat4(mat4.create()),
			"modelviewInverse": new UniformMat4(mat4.create())
		};

		// Light uniforms cache
		this.lightUniforms={
			"lightDirection": new UniformVec3(vec3.create()),
			"lightColor": new UniformColor(new Color()),
			"lightIntensity": new UniformFloat(0.0),
			"useShadows": new UniformInt(0)
		};

		this.shadowUniforms={
			"linearDepthConstant": new UniformFloat(0.0),
			"lightView": new UniformMat4(mat4.create()),
			"lightProjection": new UniformMat4(mat4.create()),
			"shadowIntensity": new UniformFloat(0.0)
		};

		this.enableDynamicBatching=true;
	},

	prepareShadowContext: function(context, scene) {
		if (this.shadowMapFallbackSampler===false) {
			this.shadowMapFallbackSampler = new Sampler('shadow0', scene.engine.WhiteTexture);
		}

		if (!this.shadowMapStage.active)
			return;

		var light = this.shadowMapStage.getFirstShadowCastingLight(scene);
		if (!light)
			return;

		context.shadow={
			'shadow0': this.shadowMapStage.shadowSampler,
			'linearDepthConstant': this.shadowMapStage.material.uniforms["linearDepthConstant"],
			'lightProjection': new UniformMat4(this.shadowMapStage.lightProj),
			'lightView': new UniformMat4(this.shadowMapStage.lightView),
			'shadowIntensity': new UniformFloat(light.shadowIntensity)
		};
	},

	onPreRender: function(context, scene, camera) {
		// Acquire and organize the visible renderers
		this.solidRendererBatches={};
		this.solidRenderers.length=0;
		this.transparentRenderers.length=0;

		this.visibleSolidRenderers=0;
		this.visibleSolidBatches=0;
		this.visibleSolidFaces=0;
		this.visibleTransparentFaces=0;

		var renderers=scene.dynamicSpace.frustumCast(camera.frustum, camera.layerMask);
		for(var i in renderers) {
			if (renderers[i].transparent) {
				this.transparentRenderers.push(renderers[i]);
				this.visibleTransparentFaces+=renderers[i].submesh.faces.length;
			}
			else {
				if(this.enableDynamicBatching) {
					if(renderers[i].material.id in this.solidRendererBatches) this.solidRendererBatches[renderers[i].material.id].push(renderers[i]);
					else {
						this.solidRendererBatches[renderers[i].material.id]=[renderers[i]];
						this.visibleSolidBatches++;
					}
				}
				this.visibleSolidFaces+=renderers[i].submesh.faces.length;
				this.solidRenderers.push(renderers[i]);
				this.visibleSolidRenderers++;
			}
		}
		this.visibleRenderers=renderers.length;
		this.visibleTransparentRenderers=this.transparentRenderers.length;

		// Sort transparent renderers
		mat4.invert(this.invModelview, context.modelview.top());
		mat4.translation(this.eyePosition, this.invModelview);
		var eyePosition = this.eyePosition;
		this.transparentRenderers.sort(function(a, b) {
			var d1 = vec3.squaredDistance(eyePosition, a.globalBoundingSphere.center);
			var d2 = vec3.squaredDistance(eyePosition, b.globalBoundingSphere.center);
			if (d1>d2) return -1;
			if (d1<d2) return 1;
			return 0;
		});
	},

	/** Renders solid renderers in batches */
	renderBatched: function(context) {
		var date=new Date();
		var batches=this.solidRendererBatches;

		var globalSamplers = [];

		// Prepare camera/projection uniforms; these won't change during rendering batches.
		this.sharedUniforms.projection = new UniformMat4(context.projection.top());
		this.sharedUniforms.view = new UniformMat4(context.camera.viewMatrix);
		this.sharedUniforms.viewInverse=new UniformMat4(context.camera.viewInverseMatrix);
		this.sharedUniforms.time.value=date.getTime();

		// Optionally prepare light uniforms. Light also won't change during rendering batches.
		if(context.light) {
			this.lightUniforms.lightDirection=new UniformVec3(context.light.direction);
			this.lightUniforms.lightColor=new UniformColor(context.light.color);
			this.lightUniforms.lightIntensity=new UniformFloat(context.light.intensity);
			this.lightUniforms.useShadows=new UniformInt(context.shadow?1:0);
		}

		// And shadow uniforms, if needed
		if(context.shadow) {
			this.shadowUniforms.linearDepthConstant=context.shadow.linearDepthConstant;
			this.shadowUniforms.lightView=context.shadow.lightView;
			this.shadowUniforms.lightProjection=context.shadow.lightProjection;
			this.shadowUniforms.shadowIntensity=context.shadow.shadowIntensity;

			globalSamplers.push(context.shadow.shadow0);
		}
		else {
			globalSamplers.push(this.shadowMapFallbackSampler);
		}

		var usedShader=false;

		for (var i in batches) {
			var batch=batches[i];

			// if(batch.length==0) continue; // Not necessary, because batches with size 0 can not exist

			// Use shader
			var material=batch[0].material;
			var shader=material.shader;
			if(shader!=usedShader) {
				shader.use();
				usedShader=shader;

				// Bind shadow uniforms
				if(context.shadow) shader.bindUniforms(this.shadowUniforms);

				// Bind shared uniforms
				shader.bindUniforms(this.sharedUniforms);

				// Bind light uniforms to shader
				if(context.light) shader.bindUniforms(this.lightUniforms);
			}

			// Bind samplers
			var samplers=globalSamplers.concat(material.samplers);
			shader.bindSamplers(samplers);

			// Bind material uniforms
			shader.bindUniforms(material.uniforms);

			for(var j=0; j<batch.length; ++j) {
				context.modelview.push();
				context.modelview.multiply(batch[j].matrix);

				// Bind renderer specific uniforms
				this.rendererUniforms.model.value=batch[j].matrix;
				this.rendererUniforms.modelview.value=context.modelview.top();
				this.rendererUniforms.modelviewInverse.value=mat4.invert(mat4.create(), context.modelview.top());

				shader.bindUniforms(this.rendererUniforms);

				batch[j].render(context);

				context.modelview.pop();
			}

			// Unbind shader
			shader.unbindSamplers(samplers);
		}
	},

	/** Renders without dynamic batching */
	renderBruteForce: function(context, renderers) {
		var globalSamplers=[];
		if (context.shadow) {
			globalSamplers.push(context.shadow.shadow0);
		}
		else {
			globalSamplers.push(this.shadowMapFallbackSampler);
		}

		for(var j=0; j<renderers.length; ++j) {
			var renderer=renderers[j];

			context.modelview.push();
			context.modelview.multiply(renderer.matrix);

			renderer.material.bind(renderer.getDefaultUniforms(context), globalSamplers);
			renderer.render(context);
			renderer.material.unbind(globalSamplers);

			context.modelview.pop();
		}
	},

	renderSolid: function(context, scene, camera) {
		camera.target.bind(context);

		var gl = context.gl;
		gl.enable(gl.DEPTH_TEST);
		gl.depthFunc(gl.LESS);
		gl.depthMask(true);

		// Render solid renderers with the first light
		if (scene.lights.length>0)
			context.light=scene.lights[0];

		if(this.enableDynamicBatching) {
			this.renderBatched(context);
		}
		else {
			this.renderBruteForce(context, this.solidRenderers);
		}

		context.light=false;

		// Render solid geometry with the rest of the lights
		if (scene.lights.length>1) {
			gl.depthMask(false);
			gl.depthFunc(gl.LEQUAL);
			gl.blendFunc(gl.ONE, gl.ONE);
			gl.enable(gl.BLEND);
			for (var l=1; l<scene.lights.length; l++) {
				context.light=scene.lights[l];

				if(this.enableDynamicBatching) {
					this.renderBatched(context);
				}
				else {
					this.renderBruteForce(context, this.solidRenderers);
				}
			}
			gl.disable(gl.BLEND);
			gl.depthMask(true);
			gl.depthFunc(gl.LESS);
		}

		camera.target.unbind(context);
	},

	renderTransparent: function(context, scene, camera) {
		camera.target.bind(context, true);

		var gl = context.gl;
		gl.depthMask(false);
		gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
		gl.enable(gl.BLEND);

		this.renderBruteForce(context, this.transparentRenderers);

		gl.disable(gl.BLEND);
		gl.disable(gl.DEPTH_TEST);
		gl.depthMask(true);

		camera.target.unbind(context);
	},

	onPostRender: function(context, scene, camera) {
		this.prepareShadowContext(context, scene);
		this.renderSolid(context, scene, camera);
		this.renderTransparent(context, scene, camera);
		context.shadow=false;
	}
});