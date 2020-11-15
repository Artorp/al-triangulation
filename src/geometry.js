
function line_point_pair_to_offset(p1, p2) {
    // change representation from (p1 -> p2) to (p -> p + r) where r is the point delta

    const r = subtract_points_2d(p2, p1);
    return [p1, r];
}

// line segment p -> p + r, and q -> q + s
function intersect_lines(p, r, q, s){
    // https://stackoverflow.com/questions/563198/how-do-you-detect-where-two-line-segments-intersect/565282#565282

    const rs_cross = cross_product_2d(r, s);

    if (rs_cross === 0) {
        // if u_numerator === 0, then the line segments are collinear
        // if u_numerator !== 0, then the line segments are parallel and non-intersecting
        // Either way, treat both cases as no intersection
        return false;
    }

    const u_numerator = cross_product_2d(subtract_points_2d(q, p), r);
    const t_numerator = cross_product_2d(subtract_points_2d(q, p), s);

    const u = u_numerator / rs_cross;
    const t = t_numerator / rs_cross;

    if (0 <= u && u <= 1 && 0 <= t && t <= 1) {
        // line segments are intersecting at p + t*r = q + u * s
        return add_points_2d(p, multiply_scalar_2d(r, t));
    }

    // the line segments are not parallel, but the line segments do not
    return false;
}


/**
 * Takes the 2d cross product of v1 x v2
 *
 * @param v1
 * @param v2
 * @returns {number}
 */
function cross_product_2d(v1, v2) {
    const [x1, y1] = v1;
    const [x2, y2] = v2;
    return x1 * y2 - y1 * x2;
}

function dot_product_2d(v1, v2) {
    const [x1, y1] = v1;
    const [x2, y2] = v2;
    return x1 * x2 + y1 * y2;
}

function angle_between(v1, v2) {
    const [v1x, v1y] = v1;
    const [v2x, v2y] = v2;
    const a1 = Math.atan2(v1y, v1x);
    const a2 = Math.atan2(v2y, v2x);
    return a2 - a1;
}

function vertices_equal(v1, v2) {
    const [x1, y1] = v1;
    const [x2, y2] = v2;
    return x1 === x2 && y1 === y2;
}

function orthogonal_ccw_of(v1, v2) {
    return [v1, [v2[1], -v2[0]]];
}

function rot90(v) {
    return [v[1], -v[0]];
}

/**
 * Returns v1 + v2
 *
 * @param v1 point array, 0 index is x and 1 index is y
 * @param v2 point array
 * @returns {number[]} v1 + v2
 */
function add_points_2d(v1, v2){
    return [v1[0] + v2[0], v1[1] + v2[1]];
}

/**
 * Returns v1 - v2
 *
 * @param v1 point array, 0 index is x and 1 index is y
 * @param v2 point array
 * @returns {number[]} v1 - v2
 */
function subtract_points_2d(v1, v2) {
    return [v1[0] - v2[0], v1[1] - v2[1]];
}

/**
 * Returns v1 + v2
 *
 * @param v1 point array, 0 index is x and 1 index is y
 * @param scalar point array
 * @returns {number[]} v1 + v2
 */
function multiply_scalar_2d(v1, scalar){
    return [v1[0] * scalar, v1[1] * scalar];
}


function distance_2d(v1, v2) {
    return Math.sqrt(Math.pow(v1[0] - v2[0], 2) + Math.pow(v1[1] - v2[1], 2));
}

function normalize(v) {
    const magnitude = Math.sqrt(Math.pow(v[0], 2) + Math.pow(v[1], 2));
    return [v[0]/magnitude, v[1]/magnitude];
}

function midpoint(v1, v2) {
    return [(v1[0] + v2[0]) / 2, (v1[1] + v2[1]) / 2];
}


function test_fn() {
    // line from (0, 0) -> (0, 10) and (-5, 5),(5, 5) should meet at point (0, 5)
    console.log("Expect (0, 5)");
    console.log(intersect_lines([0, 0], [0, 10], [-5, 5], [10, 0]));

    // line from (0, 0) -> (0, 10) and (0, 0), (0, 10) do not intersect
    console.log("Expect false");
    console.log(intersect_lines([0, 0], [0, 10], [0, 0], [0, 10]));

    // line from (0, 0) -> (0, 10) and (0, 0), (10, 0) intersects inclusive at (0, 0)
    console.log("Expect (0, 0)");
    console.log(intersect_lines([0, 0], [0, 10], [0, 0], [10, 0]));

    // line from (5, 0) -> (15, 0) and (0, 5), (0, 15) do not intersect
    console.log("Expect false");
    console.log(intersect_lines([5, 0], [10, 0], [0, 5], [0, 10]));
}

module.exports = {
    intersect_lines, line_point_pair_to_offset, add_points_2d, subtract_points_2d, multiply_scalar_2d, distance_2d, normalize, cross_product_2d, dot_product_2d, angle_between, vertices_equal, midpoint, orthogonal_ccw_of, rot90
};

