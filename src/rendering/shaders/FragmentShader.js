/** FragmentShader for ShaderProgram. */
var FragmentShader=Subshader.extend({ 
	init: function(shader, code) {
		this._super(shader, code, this.FRAGMENT_SHADER);
		this.compiledShader=this.context.gl.createShader(this.context.gl.FRAGMENT_SHADER);
	}
});