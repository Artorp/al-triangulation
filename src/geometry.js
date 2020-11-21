
/**
 * @typedef {import("./geometry_types").Point} Point
 * */

/**
 *
 * @param {Point} p1
 * @param {Point} p2
 * @returns {[Point, Point]}
 */
function line_point_pair_to_offset(p1, p2) {
    // change representation from (p1 -> p2) to (p -> p + r) where r is the point delta

    const r = subtract_points_2d(p2, p1);
    return [p1, r];
}

/**
 * Checks intersection between two line segments, defined as
 * line segment p -> p + r, and q -> q + s
 *
 * If there is no intersection, returns null
 *
 * @param {Point} p
 * @param {Point} r
 * @param {Point} q
 * @param {Point} s
 * @returns {Point|null}
 */
function intersect_lines(p, r, q, s){
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

    /**
     * @param {number} float_val
     * @param {number} lower
     * @param {number} upper
     */
    const in_range_inclusive = (float_val, lower, upper) =>
        (lower - float_val <= eps && float_val - upper <= eps);

    if (in_range_inclusive(u, 0, 1) && in_range_inclusive(t, 0, 1)) {
        // line segments are intersecting at p + t*r = q + u * s
        return add_points_2d(p, multiply_scalar_2d(r, t));
    }

    // the line segments are not parallel, but the line segments do not
    return null;
}


/**
 * Takes the '2d cross product' of v1 x v2, defined as the z-value of the 3d cross product, which
 * only depends on the two first two axis x and y.
 *
 * @param {Point} v1
 * @param {Point} v2
 * @returns {number}
 */
function cross_product_2d(v1, v2) {
    const {x: x1, y: y1} = v1;
    const {x: x2, y: y2} = v2;
    return x1 * y2 - y1 * x2;
}

/**
 * Dot product of two 2d vectors.
 *
 * @param {Point} v1
 * @param {Point} v2
 * @returns {number}
 */
function dot_product_2d(v1, v2) {
    const {x: x1, y: y1} = v1;
    const {x: x2, y: y2} = v2;
    return x1 * x2 + y1 * y2;
}

/**
 * Finds the angle between two vectors v1 and v2, under the assumption that both vectors share origin point.
 *
 * The angle is expressed in radians.
 *
 * @param {Point} v1
 * @param {Point} v2
 * @returns {number}
 */
function angle_between(v1, v2) {
    const {x: x1, y: y1} = v1;
    const {x: x2, y: y2} = v2;
    const a1 = Math.atan2(y1, x1);
    const a2 = Math.atan2(y2, x2);
    return a2 - a1;
}

/**
 * Returns true if both points are equal. Assumes both points are integers.
 *
 * @param {Point} v1
 * @param {Point} v2
 * @returns {boolean}
 */
function vertices_equal(v1, v2) {
    const {x: x1, y: y1} = v1;
    const {x: x2, y: y2} = v2;
    return x1 === x2 && y1 === y2;
}

/**
 * Rotate 2d vector v 90 degrees ccw
 *
 * @param {Point} v
 * @returns {Point}
 */
function rot90(v) {
    return { x: v.y, y: -v.x };
}

/**
 * Rotate 2d vector v 180 degrees ccw
 *
 * @param {Point} v
 * @returns {Point}
 */
function rot180(v) {
    return { x: -v.x, y: -v.y };
}

/**
 * Rotate 2d vector v 270 degrees ccw
 *
 * @param {Point} v
 * @returns {Point}
 */
function rot270(v) {
    return { x: -v.y, y: v.x };
}

/**
 * Returns v1 + v2
 *
 * @param {Point} v1
 * @param {Point} v2
 * @returns {Point} v1 + v2
 */
function add_points_2d(v1, v2){
    return { x: v1.x + v2.x, y: v1.y + v2.y };
}

/**
 * Returns v1 - v2
 *
 * @param {Point} v1
 * @param {Point} v2
 * @returns {Point} v1 - v2
 */
function subtract_points_2d(v1, v2) {
    return { x: v1.x - v2.x, y: v1.y - v2.y };
}

/**
 * Returns v1 * scalar
 *
 * @param {Point} v1
 * @param {number} scalar
 * @returns {Point} v1 * scalar
 */
function multiply_scalar_2d(v1, scalar){
    return {x: v1.x * scalar, y: v1.y * scalar};
}

/**
 * L2 distance between two points
 *
 * @param {Point} v1
 * @param {Point} v2
 * @returns {number}
 */
function distance_2d(v1, v2) {
    return Math.sqrt(Math.pow(v1.x - v2.x, 2) + Math.pow(v1.y - v2.y, 2));
}

/**
 * Round point coordinates to integer values
 *
 * @param {Point} p
 * @returns {Point}
 */
function to_integer(p) {
    return { x: Math.round(p.x), y: Math.round(p.y) };
}

/**
 * Normalize a vector such that its magnitude is 1.0
 *
 * @param {Point} v
 * @returns {Point}
 */
function normalize(v) {
    const magnitude = Math.sqrt(Math.pow(v.x, 2) + Math.pow(v.y, 2));
    return {x: v.x / magnitude, y: v.y / magnitude};
}

/**
 * Find the linear midpoint between two points
 *
 * @param {Point} v1
 * @param {Point} v2
 * @returns {Point}
 */
function midpoint(v1, v2) {
    return {x: (v1.x + v2.x) / 2, y: (v1.y + v2.y) / 2};
}

/**
 * Returns true if the points p1, p2, and p3 are all on the same line
 *
 * @param {Point} p1
 * @param {Point} p2
 * @param {Point} p3
 * @returns {boolean}
 */
function points_are_collinear(p1, p2, p3) {
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


function _test_fn() {
    // line from (0, 0) -> (0, 10) and (-5, 5),(5, 5) should meet at point (0, 5)
    console.log("Expect (0, 5)");
    console.log(intersect_lines({ x: 0, y: 0 }, { x: 0, y: 10 }, { x: -5, y: 5 }, { x: 10, y: 0 }));

    // line from (0, 0) -> (0, 10) and (0, 0), (0, 10) do not intersect
    console.log("Expect null");
    console.log(intersect_lines({ x: 0, y: 0 }, { x: 0, y: 10 }, { x: 0, y: 0 }, { x: 0, y: 10 }));

    // line from (0, 0) -> (0, 10) and (0, 0), (10, 0) intersects inclusive at (0, 0)
    console.log("Expect (0, 0)");
    console.log(intersect_lines({ x: 0, y: 0 }, { x: 0, y: 10 }, { x: 0, y: 0 }, { x: 10, y: 0 }));

    // line from (5, 0) -> (15, 0) and (0, 5), (0, 15) do not intersect
    console.log("Expect null");
    console.log(intersect_lines({ x: 5, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 5 }, { x: 0, y: 10 }));

    // exclusive check, line from (0, 0) -> (1472, 64) and (1104, 40)->(1104, 48), and (1104, 48)->(1112, 48) do not intersect
    console.log("Expect (1104, 48) on both");
    let ray = { x: 1472, y: 64 };
    ray = multiply_scalar_2d(normalize(ray), 10000);
    console.log(intersect_lines({ x: 0, y: 0 }, { x: 1472, y: 64 }, { x: 1104, y: 40 }, { x: 0, y: 8 }));
    console.log(intersect_lines({ x: 0, y: 0 }, { x: 1472, y: 64 }, { x: 1104, y: 48 }, { x: 8, y: 0 }));
}

module.exports = {
    intersect_lines, line_point_pair_to_offset, add_points_2d, subtract_points_2d, multiply_scalar_2d, distance_2d, normalize, cross_product_2d, dot_product_2d, angle_between, vertices_equal, midpoint, rot90, rot180, rot270, points_are_collinear, to_integer
};

