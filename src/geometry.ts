export type Point = {
    x: number, y: number
}

export type Edge = {
    p1: Point, p2: Point
}

/**
 * Change representation from (p1 -> p2) to (p -> p + r) where r is the point delta
 *
 * @param p1
 * @param p2
 */
function line_point_pair_to_offset(p1: Point, p2: Point): [Point, Point] {

    const r = subtract_points_2d(p2, p1);
    return [p1, r];
}

/**
 * Checks intersection between two line segments, defined as
 * line segment p -> p + r, and q -> q + s
 *
 * If there is no intersection, returns null
 */
function intersect_lines(p: Point, r: Point, q: Point, s: Point): Point | null {
    // https://stackoverflow.com/questions/563198/how-do-you-detect-where-two-line-segments-intersect/565282#565282

    const rs_cross = cross_product_2d(r, s);

    if (rs_cross === 0) {
        // if u_numerator === 0, then the line segments are collinear
        // if u_numerator !== 0, then the line segments are parallel and non-intersecting
        // Either way, treat both cases as no intersection
        return null;
    }

    const u_numerator = cross_product_2d(subtract_points_2d(q, p), r);
    const t_numerator = cross_product_2d(subtract_points_2d(q, p), s);

    const u = u_numerator / rs_cross;
    const t = t_numerator / rs_cross;

    const eps = 1e-12 // underflow around 1e-15

    const in_range_inclusive = (float_val: number, lower: number, upper: number): boolean =>
        (lower - float_val <= eps && float_val - upper <= eps);

    if (in_range_inclusive(u, 0, 1) && in_range_inclusive(t, 0, 1)) {
        // line segments are intersecting at p + t*r = q + u * s
        return add_points_2d(p, multiply_scalar_2d(r, t));
    }

    // the line segments are not parallel, but the line segments do not
    return null;
}


/**
 * Assumes +x is east and +y is north. If working in a coordinate system where +y is south, assume result
 * is multiplied by -1.
 *
 * Returns a value greater than 0 if p3 is to the left of the line p1->p2, == 0 if p3 is on the line p1->p2,
 * or a value less than 0 if p3 is to the right of the line p1->p2.
 *
 * This returns 2 * the signed area of the triangle formed by p1 -> p2 -> p3 -> p1, positive if the
 * triangle is ccw, negative if the triangle is cw.
 *
 * @see http://geomalgorithms.com/a01-_area.html#Modern-Triangles
 *
 * @param p1 first point
 * @param p2 second point
 * @param p3 third point - or the point to compare against the line p1 -> p2
 * @returns gt 0 if p3 left of p1p2, eq 0 if p3 on the line, and lt 0 if p3 to the right of the line
 */
export function point_is_left(p1: Point, p2: Point, p3: Point): number {
    return (p2.x - p1.x) * (p3.y - p1.y) - (p3.x - p1.x) * (p2.y - p1.y);
}

/**
 * Assumes +x is east and +y is north. If working in a coordinate system where +y is south, this will give invalid
 * results.
 *
 * Returns the winding number of a polygon with respect to a point p. Can be used to determine if a point is inside or
 * outside a polygon. A point is outside the polygon if the polygon doesn't wind around the point at all, or if the
 * winding number is equal 0. A non-zero winding number means the point is inside the polygon.
 *
 * @see http://geomalgorithms.com/a03-_inclusion.html
 *
 * @param p point to calculate winding number in relation to
 * @param poly a polygon with points defined in ccw order, with the last and first point connected
 * @returns zero if point is outside the polygon, non-zero if the point is inside the polygon
 */
export function winding_number(p: Point, poly: Point[]) {
    let wn = 0;

    for (let i = 0; i < poly.length; i++) {
        const p1 = poly[i];
        const p2 = poly[(i + 1) % poly.length];
        /*
        * Intersection test with following rules, given a point P and a horizontal ray from P to the right +infinity:
        *  1) An upward edge includes its starting endpoint and excludes its final endpoint
        *  2) A downward edge excludes its starting endpoint and includes its final endpoint
        *  3) Horizontal edges are excluded
        *  4) The edge <-> ray intersection point must be strictly right of the point
        * From: http://geomalgorithms.com/a03-_inclusion.html#Edge-Crossing-Rules
        * */
        if (p1.y === p2.y) continue;
        if (p2.y > p1.y) {
            // only change winding number if p is strictly left of p1->p2
            // p1 <= p < p2
            if (!(p1.y <= p.y && p.y < p2.y)) continue;
            if (point_is_left(p1, p2, p) > 0) {
                wn++;
            }
        } else {
            // only change winding number if p is strictly right of p1->p2
            // p2 <= p < p1
            if (!(p2.y <= p.y && p.y < p1.y)) continue;
            if (point_is_left(p1, p2, p) < 0) {
                wn--;
            }
        }
    }
    return wn;
}

/**
 * Takes the '2d cross product' of v1 x v2, defined as the z-value of the 3d cross product, which
 * only depends on the two first two axis x and y.
 */
function cross_product_2d(v1: Point, v2: Point): number {
    const { x: x1, y: y1 } = v1;
    const { x: x2, y: y2 } = v2;
    return x1 * y2 - y1 * x2;
}

/**
 * Dot product of two 2d vectors.
 */
function dot_product_2d(v1: Point, v2: Point): number {
    const { x: x1, y: y1 } = v1;
    const { x: x2, y: y2 } = v2;
    return x1 * x2 + y1 * y2;
}

/**
 * Finds the angle between two vectors v1 and v2, under the assumption that both vectors share origin point.
 *
 * The angle is expressed in radians.
 */
function angle_between(v1: Point, v2: Point): number {
    const { x: x1, y: y1 } = v1;
    const { x: x2, y: y2 } = v2;
    const a1 = Math.atan2(y1, x1);
    const a2 = Math.atan2(y2, x2);
    return a2 - a1;
}

/**
 * Returns true if both points are equal. Assumes both points are integers.
 */
function vertices_equal(v1: Point, v2: Point): boolean {
    const { x: x1, y: y1 } = v1;
    const { x: x2, y: y2 } = v2;
    return x1 === x2 && y1 === y2;
}

/**
 * Rotate 2d vector v 90 degrees ccw
 */
function rot90(v: Point): Point {
    return { x: v.y, y: -v.x };
}

/**
 * Rotate 2d vector v 180 degrees ccw
 */
function rot180(v: Point): Point {
    return { x: -v.x, y: -v.y };
}

/**
 * Rotate 2d vector v 270 degrees ccw
 */
function rot270(v: Point): Point {
    return { x: -v.y, y: v.x };
}

/**
 * Returns v1 + v2
 */
function add_points_2d(v1: Point, v2: Point): Point {
    return { x: v1.x + v2.x, y: v1.y + v2.y };
}

/**
 * Returns v1 - v2
 */
function subtract_points_2d(v1: Point, v2: Point): Point {
    return { x: v1.x - v2.x, y: v1.y - v2.y };
}

/**
 * Returns v1 * scalar
 */
function multiply_scalar_2d(v1: Point, scalar: number): Point {
    return { x: v1.x * scalar, y: v1.y * scalar };
}

/**
 * L2 distance between two points
 */
function distance_2d(v1: Point, v2: Point) {
    return Math.sqrt(Math.pow(v1.x - v2.x, 2) + Math.pow(v1.y - v2.y, 2));
}

/**
 * Round point coordinates to integer values
 */
function to_integer(p: Point): Point {
    return { x: Math.round(p.x), y: Math.round(p.y) };
}

/**
 * Normalize a vector such that its magnitude is 1.0
 */
function normalize(v: Point): Point {
    const magnitude = Math.sqrt(Math.pow(v.x, 2) + Math.pow(v.y, 2));
    return { x: v.x / magnitude, y: v.y / magnitude };
}

/**
 * Find the linear midpoint between two points
 */
function midpoint(v1: Point, v2: Point) {
    return { x: (v1.x + v2.x) / 2, y: (v1.y + v2.y) / 2 };
}

/**
 * Returns true if the points p1, p2, and p3 are all on the same line
 */
function points_are_collinear(p1: Point, p2: Point, p3: Point): boolean {
    // Assume points are three points on a triangle. In a triangle, the combined distance of the two smaller edges
    // edges is equal to or larger than the larger edge. If they're equal length, the triangle has a height of zero and
    // all points are on the same line / are collinear.
    const p1_p2 = distance_2d(p1, p2);
    const p1_p3 = distance_2d(p1, p3);
    const p2_p3 = distance_2d(p2, p3);
    const small_small_large = [p1_p2, p1_p3, p2_p3];
    small_small_large.sort((a, b) => a - b);

    return small_small_large[0] + small_small_large[1] - small_small_large[2] < 0.0001;

}

export {
    intersect_lines,
    line_point_pair_to_offset,
    add_points_2d,
    subtract_points_2d,
    multiply_scalar_2d,
    distance_2d,
    normalize,
    cross_product_2d,
    dot_product_2d,
    angle_between,
    vertices_equal,
    midpoint,
    rot90,
    rot180,
    rot270,
    points_are_collinear,
    to_integer
};

