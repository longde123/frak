/** An infinite plane in 3D space */
var Plane=Class.extend({
	/** Constructor */
	init: function() {
		this.normal = vec3.create();
		this.distance = 0.0;
	},
	
	/** Creates a plane defined by three points
		@param p1 Instance of {vec3}
		@param p2 Instance of {vec3}
		@param p3 Instance of {vec3}
		*/
	setByPoints: function(p1, p2, p3) {
		this.normal=vec3.cross(
			vec3.create(),
			vec3.subtract(vec3.create(), p2, p1),
			vec3.subtract(vec3.create(), p3, p1)
		);
		vec3.normalize(this.normal, this.normal);
		this.distance = -vec3.dot(this.normal, p2);
	},
	
	/** Creates a plane defined by point and normal
		@param normal Instance of {vec3}
		@param point Instance of {vec3}
	 */
	setByNormalAndPoint: function(normal, point) {
		this.normal=vec3.clone(normal);
		vec3.normalize(this.normal, this.normal);
		this.distance = -vec3.dot(this.normal, point);
	},
	
	/** Returns the signed distance between a plane and a point
		@param point Instance of {vec3}
		@return {number} Signed distance between the plane and the point */
	getDistanceToPoint: function(point) {
		return vec3.dot(this.normal, point) + this.distance;
	},
	
	/** Projects the given point onto this plane.
		@param point Instance of {vec3}
		@param out Instance of {vec3}. If present the output is written to out instead. [optional]
		@return {vec3} The projected point on the plane (the same as out, if out is present) */
	projectToPlane: function(point, out) {
		if (!out) out=vec3.create();
		vec3.scale(out, this.normal, this.getDistanceToPoint(point));
		vec3.sub(out, point, out);
		return out;
	},
	
	/** Tests if point is in front of the plane 
		@param point Instance of {vec3}
		@return {boolean} True, if point is in front of the plane */
	pointInFront: function(point) {
		return vec3.dot(this.normal, point)+this.distance>0;
	},
	
	/** Tests if point is in back of the plane 
		@param point Instance of {vec3}
		@return {boolean} True, if point is in back of the plane */
	pointInBack: function(point) {
		return vec3.dot(this.normal, point)+this.distance<0;
	},
	
	/** Tests if point is on the plane 
		@param point Instance of {vec3}
		@return {boolean} True, if point is on the plane */
	pointOnPlane: function(point) {
		return Math.abs(vec3.dot(this.normal, point)+this.distance)<EPSILON; // NOTE: Requires glmatrix-3dtech-ext
	},
	
	/** Tests if points p1 and p2 are on the same side of the plane 
		@param p1 Instance of {vec3}
		@param p2 Instance of {vec3}
		@return {boolean} True, if points p1 and p2 are on the same side of the plane */
	sameSide: function(p1, p2) {
		var d1=vec3.dot(this.normal, p1)+this.distance;
		var d2=vec3.dot(this.normal, p2)+this.distance;
		return !(d1*d2<0.0);
	},
	
	/** Returns the string representation of this plane.
		@return The {string} representation of this plane */
	toString: function() {
		return "Plane["+this.normal[0]+", "+this.normal[1]+", "+this.normal[2]+", "+this.distance+"]";
	}
});

var AABBPlaneCache = new Plane();