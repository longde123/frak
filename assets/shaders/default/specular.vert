// Diffuse shader
attribute vec3 position; 
attribute vec3 normal; 
attribute vec2 texcoord2d0; 

uniform mat4 model;
uniform mat4 view;
uniform mat4 modelview;
uniform mat4 projection;
uniform mat4 lightProjection;
uniform mat4 lightView;

varying vec4 worldPosition;
varying vec4 viewPosition;
varying vec3 worldNormal;
varying vec3 viewNormal;
// varying vec3 viewVector;
varying vec4 shadowPosition;
varying vec2 uv0;

const mat4 scaleMatrix = mat4(0.5, 0.0, 0.0, 0.0, 0.0, 0.5, 0.0, 0.0, 0.0, 0.0, 0.5, 0.0, 0.5, 0.5, 0.5, 1.0);

void main() {
	uv0=texcoord2d0; // TODO: In the future this will probably need to use texture offset and scale uniforms
	worldPosition = model * vec4(position, 1.0);
	viewPosition = view * worldPosition;
	worldNormal = normalize(mat3(model)*normal);
	viewNormal = mat3(modelview)*normal;
	// viewVector = normalize(-viewPosition.xyz);
	shadowPosition = scaleMatrix * lightProjection * lightView * worldPosition;

	gl_Position = projection * viewPosition;
}