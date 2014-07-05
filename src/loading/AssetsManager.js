/** General assets manager. 
	Example of usage:
	<pre>
// Usually you get instance of AssetsManager from instance of Engine, but it can be constructed separately as well:
var assetsManager=new AssetsManager(renderingContext);            // Create assets manager
var shader=assetsManager.addShaderSource('shaders/default/test'); // Add shader to loading queue
var node=assetsManager.addModel("test.data");                     // Add model to loading queue
	
// Start loading
assetsManager.load(function() {
	// All done, use shader and node where model from test.data has been attached
});

</pre>
	*/
var AssetsManager=Class.extend({
	/** Constructor
		@param renderingContext Instance of RenderingContext
		*/
	init: function(renderingContext, shadersPath) {
		this.managers=[];
		
		var me=this;
		this.loadingCount=0;
		this.loadedCallbacks=[];
		var addManager=function(manager) {
			manager.onAddToQueue=function(descriptor) {
				me.loadingCount++;
			};
			manager.onLoaded=function(descriptor) {
				me.loadingCount--;
				if(me.loadingCount<=0) {
					var callbacks=me.loadedCallbacks.slice(0);
					me.loadedCallbacks=[];
					for(i in callbacks) {
						var c=callbacks[i];
						c();
					}
				}
			};
			me.managers.push(manager);
		};
		
		addManager(this.shadersManager=new ShadersManager(renderingContext));
		addManager(this.texturesManager=new TexturesManager(renderingContext));
		addManager(this.modelsManager=new ModelsManager(renderingContext, this.shadersManager, this.texturesManager));
		addManager(this.textManager=new TextManager());
		addManager(this.materialsManager=new MaterialsManager(renderingContext, this.shadersManager, this.texturesManager));
		addManager(this.materialSourcesManager=new MaterialSourcesManager(renderingContext, this.materialsManager, this.textManager));
		addManager(this.fontsManager=new FontsManager(renderingContext, this.materialSourcesManager, this.materialsManager, this.texturesManager, this.textManager));
		addManager(this.fontSourcesManager=new FontSourcesManager(renderingContext, this.fontsManager, this.textManager));
		
		if (shadersPath)
			this.shadersManager.shadersPath=shadersPath;
		this.shadersManager.fallbackVertexShader=this.shadersManager.addSource('Fallback');
	},
	
	/** Adds a new texture to textures loading queue 
		@param source Path to texture (url) */
	addTexture: function(source) {
		return this.texturesManager.add(source);
	},
	
	/** Adds a new model to models loading queue 
		@param source Path to model (url) 
		@param noCollisionTree If set to true no collision tree is built */
	addModel: function(source, noCollisionTree) {
		return this.modelsManager.add(source, noCollisionTree);
	},
	
	/** Adds a new GLSL shader  to shaders loading queue.
		The shader is loaded from two files: fragment shader from <source>.frag and vertex shader from <source>.vert
		@param source Path to shader (url) */
	addShaderSource: function(source) {
		return this.shadersManager.addSource(source);
	},
	
	/** Adds a new GLSL shader source to shaders loading queue.
		@param vertexSource Path to vertex shader (url)
		@param fragmentSource Path to fragment shader (url)	*/
	addShader: function(vertexSource, fragmentSource) {
		return this.shadersManager.add(vertexSource, fragmentSource);
	},
	
	/** Adds text source to texts loading queue. 
		@param source Path to text */
	addText: function(source) {
		return this.textManager.add(source);
	},
	
	/** Adds material source to material sources loading queue. 
		@param source Path to material source */
	addMaterial: function(source) {
		return this.materialSourcesManager.add(source);
	},
	
	/** Adds font source to font sources loading queue
		@param source Path to font source 
		@return Instance of FontSource */
	addFont: function(source) {
		return this.fontSourcesManager.add(source);
	},

	/** Returns true if the asstesmanager has anything in its loading queue. */
	hasItemsInQueue: function() {
		for(var m in this.managers) {
			if (this.managers[m].getWaitingItems()>0)
				return true;
		}
		return false;
	},
	
	/** Starts loading all queued sources 
		
		IMPORTANT NOTE!
		When the callback is called, there is no guarantee that onStart method has been
		called for any of the resources loaded. In fact, the opposite is likely true.
		
		@param callback Callback that is called when all added sources have been loaded 
		@param progressCallback Callback that is called when either all shaders, all textures or all models have been loaded */
	load: function(callback, progressCallback) {
		var me=this;
		
		if(callback) {
			this.loadedCallbacks.push(callback);
		}

		if (!this.hasItemsInQueue()) {
			var callbacks=this.loadedCallbacks.slice(0);
			this.loadedCallbacks=[];
			for(i in callbacks) {
				var c=callbacks[i];
				c();
			}
			return;
		}

		function onProgress() {
			if (!progressCallback)
				return;
			var progress = 0.0;
			for (var i in me.managers)
				progress+=me.managers[i].getProgress();
			progressCallback(progress/me.managers.length);
		}
		
		for(var m in this.managers) {
			this.managers[m].load(function() {}, onProgress);
		}
	}
});