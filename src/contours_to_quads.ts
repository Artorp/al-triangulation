import {
    angle_between,
    distance_2d,
    Edge,
    intersect_lines,
    line_point_pair_to_offset,
    multiply_scalar_2d,
    Point,
    rot180,
    rot270,
    rot90,
    subtract_points_2d,
    to_integer
} from "./geometry";
import { group_by_one_axis, intersect_and_cut } from "./map_to_polygons";
import { remove_doubles } from "./remove_doubles";
import { build_adjacent_edges_list } from "./detect_contours";


const RAY_LENGTH = 10000;

/**
 * For each contour vertex, raycast a line to the closest contour edge in all cardinal directions towards walkable
 * space. The resulting edges are confined to walkable space, and ready to be cut and joined into faces.
 *
 * @param contours
 */
function contours_raycast_edges(contours: Point[][]): { cut_contours: Point[][], internal_edges_cut: Edge[] } {

    // create collection of edges for collision
    const contour_collision_horiz: Edge[] = [];
    const contour_collision_vert: Edge[] = [];
    for (const contour of contours) {
        for (let i = 0; i < contour.length; i++) {
            const p1 = contour[i];
            const p2 = contour[(i + 1) % contour.length];
            if (p1.x === p2.x) {
                contour_collision_vert.push({ p1, p2 });
            } else {
                contour_collision_horiz.push({ p1, p2 });
            }
        }
    }

    let new_horizontal_edges: Edge[] = [];
    let new_vertical_edges: Edge[] = [];

    for (const contour of contours) {
        for (let i = 0; i < contour.length; i++) {
            const v0 = contour[((i - 1) + contour.length) % contour.length];
            const v1 = contour[i];
            const v2 = contour[(i + 1) % contour.length];
            for (const ray of generate_rays_inward(v0, v1, v2)) {
                // Cast ray with v1 as origin, and create edge with first intersection.
                const ray_is_horizontal = ray.y === 0;
                const collision_edges = ray_is_horizontal ? contour_collision_vert : contour_collision_horiz;
                const intersections = [];
                for (const collision_edge of collision_edges) {
                    const [p, r] = line_point_pair_to_offset(collision_edge.p1, collision_edge.p2);
                    let intersection_point = intersect_lines(v1, ray, p, r);
                    if (intersection_point != null) {
                        intersection_point = to_integer(intersection_point);
                        const dist = distance_2d(v1, intersection_point);
                        if (dist > 0) {
                            intersections.push({ dist, intersection_point, is_horizontal: ray_is_horizontal });
                        }
                    }
                }
                intersections.sort((a, b) => a.dist - b.dist);
                if (intersections.length === 0) {
                    console.warn("Found no intersections when raycasting contour, expected to hit contour at other side", v1, ray);
                }
                const closest_intersection = intersections[0];
                if (closest_intersection.is_horizontal) {
                    new_horizontal_edges.push({ p1: v1, p2: closest_intersection.intersection_point });
                } else {
                    new_vertical_edges.push({ p1: v1, p2: closest_intersection.intersection_point });
                }
            }
        }
    }

    // sort all edges, horizontal by y axis and vertical by x axis
    new_horizontal_edges.sort((e1, e2) => e1.p1.y - e2.p1.y);
    new_vertical_edges.sort((e1, e2) => e1.p1.x - e2.p1.x);
    // sort vertices in edges internally s.t. p1 < p2
    for (const edge of new_horizontal_edges) {
        if (edge.p1.x > edge.p2.x) {
            const tmp = edge.p1;
            edge.p1 = edge.p2;
            edge.p2 = tmp;
        }
    }
    for (const edge of new_vertical_edges) {
        if (edge.p1.y > edge.p2.y) {
            const tmp = edge.p1;
            edge.p1 = edge.p2;
            edge.p2 = tmp;
        }
    }

    // remove duplicate edges
    function remove_duplicates(axis_aligned_edges: Edge[], sweep_axis: "x" | "y"): Edge[] {
        const varying_axis = sweep_axis === "x" ? "y" : "x";
        const non_duplicates: Edge[] = [];
        for (const [from, to] of group_by_one_axis(axis_aligned_edges, sweep_axis)) {
            for (let i = from; i < to; i++) {
                let found_same_edge = false;
                const e1 = axis_aligned_edges[i];
                for (let j = i + 1; j < to; j++) {
                    const e2 = axis_aligned_edges[j];
                    if (e1.p1[varying_axis] === e2.p1[varying_axis] && e1.p2[varying_axis] === e2.p2[varying_axis]) {
                        found_same_edge = true;
                        break;
                    }
                }
                if (!found_same_edge) {
                    non_duplicates.push(e1);
                }
            }
        }
        return non_duplicates;
    }

    new_horizontal_edges = remove_duplicates(new_horizontal_edges, "y");
    new_vertical_edges = remove_duplicates(new_vertical_edges, "y");

    console.log(`Quad raycast: # of vertical: ${new_vertical_edges.length}, horizontal: ${new_horizontal_edges.length}`);

    // cut stage 1: find all intersections between contours and raycast edges, and cut contours
    //  PS: these intersections will never be E-E as raycast edges can not cross the contours

    const cut_contours = [];
    for (const contour of contours) {
        const contour_with_collisions = [];
        for (let i = 0; i < contour.length; i++) {
            // for each contour edge p0->p1...
            const p0 = contour[i];
            const p1 = contour[(i + 1) % contour.length];
            const contour_is_horizontal = p0.y === p1.y;
            const contour_same_val_axis = contour_is_horizontal ? "y" : "x";
            const contour_major_value = p0[contour_same_val_axis];

            // find all raycast edges that might possible touch this edge
            const sweep_axis = contour_is_horizontal ? "x" : "y";
            const contour_edge_range = [p0[sweep_axis], p1[sweep_axis]];
            contour_edge_range.sort((v1, v2) => v1 - v2);
            let [low, hi] = contour_edge_range;
            // narrow range such that we limit possible collisions to be within a contour edge
            low += 0.1;
            hi -= 0.1;
            const collision_raycast_edges = contour_is_horizontal ? new_vertical_edges : new_horizontal_edges;
            const eligible_collision_edges = binary_search_range(collision_raycast_edges, sweep_axis, low, hi);
            const [elig_low, elig_hi] = eligible_collision_edges;
            const collision_major_values = [];
            for (let j = elig_low; j < elig_hi; j++) {
                const check_collision_against = collision_raycast_edges[j];
                // only check for V-E collision, where V must be part of the raycast edge (not contour)
                if (check_collision_against.p1[contour_same_val_axis] === contour_major_value) {
                    collision_major_values.push(check_collision_against.p1[sweep_axis]);
                }
                if (check_collision_against.p2[contour_same_val_axis] === contour_major_value) {
                    collision_major_values.push(check_collision_against.p2[sweep_axis]);
                }
            }

            // check which order new vertices should be put into the contour list
            const insert_ascending = p0[sweep_axis] < p1[sweep_axis];

            // insert
            collision_major_values.sort((a, b) => a - b);
            if (!insert_ascending) {
                collision_major_values.reverse();
            }

            contour_with_collisions.push(p0);
            for (const v of collision_major_values) {
                const p: Point = { x: -1, y: -1 };
                p[contour_same_val_axis] = contour_major_value;
                p[sweep_axis] = v;
                contour_with_collisions.push(p);
            }
        }
        cut_contours.push(contour_with_collisions);
    }


    // cut stage 2: find all intra-intersections between intersections
    //   PS: these intersections will never be E-V as raycast edges start and stop at contours, and can not collide with
    //       other raycast edges at contours

    // just use previously implemented edge cut function
    const internal_edges_cut = intersect_and_cut(new_horizontal_edges, new_vertical_edges);

    return { cut_contours, internal_edges_cut };
}

/**
 * Given three consecutive vertices on a contour path, generate rays for raycast that points towards walkable space.
 * Left turns generate no rays, straight ahead generates a ray to the left, and right turns generate rays to the
 * left and straight ahead. They rays should be cast with p1 as the origin.
 *
 * @param p0
 * @param p1
 * @param p2
 * @returns
 */
function* generate_rays_inward(p0: Point, p1: Point, p2: Point): Generator<Point, void, any> {
    const v1 = subtract_points_2d(p1, p0);
    const v2 = subtract_points_2d(p2, p1);

    let point_up_transformation: (point: Point) => Point;
    let inverse_transformation: (point: Point) => Point;

    if (v1.x === 0) {
        if (v1.y > 0) {
            // v1 points down
            point_up_transformation = rot180;
            inverse_transformation = rot180;
        } else {
            // v1 points up
            point_up_transformation = p1 => p1;
            inverse_transformation = p1 => p1;
        }
    } else {
        if (v1.x > 0) {
            // v1 points right
            point_up_transformation = rot90;
            inverse_transformation = rot270;
        } else {
            // v1 points left
            point_up_transformation = rot270;
            inverse_transformation = rot90;
        }
    }

    const v2_t = point_up_transformation(v2);
    if (v2_t.x === 0) {
        if (v2_t.y > 0) {
            // v2_t points down, could generate rays west, north, east, but this situation should never happen after
            // inflating contours, so just print a warning
            console.warn("v2 points in the inverse direction to v1, this should never happen after inflation.",
                `p0: ${p0}, p1: ${p1}, p2: ${p2}`)
        } else {
            // v2_t points up, v1 and v2 are parallel and v1, v2, v3 are collinear. Generate ray west.
            let ray: Point = { x: -1, y: 0 };
            ray = multiply_scalar_2d(ray, RAY_LENGTH);
            ray = inverse_transformation(ray);
            yield ray;
        }
    } else {
        if (v2_t.x > 0) {
            // v2_t points right, this is a right turn, generate ray west and north

            let ray: Point = { x: -1, y: 0 };
            ray = multiply_scalar_2d(ray, RAY_LENGTH);
            ray = inverse_transformation(ray);
            yield ray;
            ray = { x: 0, y: -1 };
            ray = multiply_scalar_2d(ray, RAY_LENGTH);
            ray = inverse_transformation(ray);
            yield ray;
        } else {
            // v2_t points left, this is a left turn, generate no rays
        }
    }
}

/**
 * Perform binary searches on sorted list of edges to find all edges within a given range
 *
 * @param axis_aligned_edges pre-sorted axis-aligned edges
 * @param sweep_axis which axis to search through, y for horizontal, x for vertical
 * @param lower_inc lower bound (inclusive) of edges to include
 * @param upper_inc upper bound (inclusive) of edges to include
 * @returns from index (inclusive) to index (exclusive) of edges that are in range
 */
function binary_search_range(
    axis_aligned_edges: Edge[],
    sweep_axis: "x" | "y",
    lower_inc: number,
    upper_inc: number
): [number, number] {
    function binary_search_leftmost(axis_aligned_edges: Edge[], sweep_axis: "x" | "y", lower_inc: number): number {
        let left = 0;
        let right = axis_aligned_edges.length;
        while (left < right) {
            const m = Math.floor((left + right) / 2);
            if (axis_aligned_edges[m].p1[sweep_axis] < lower_inc) {
                left = m + 1;
            } else {
                right = m;
            }
        }
        return left;
    }

    function binary_search_rightmost(axis_aligned_edges: Edge[], sweep_axis: "x" | "y", upper_inc: number): number {
        let left = 0;
        let right = axis_aligned_edges.length;
        while (left < right) {
            const m = Math.floor((left + right) / 2);
            if (axis_aligned_edges[m].p1[sweep_axis] > upper_inc) {
                right = m;
            } else {
                left = m + 1;
            }
        }
        return right - 1;
    }

    const left_idx = binary_search_leftmost(axis_aligned_edges, sweep_axis, lower_inc);
    const right_idx_inclusive = binary_search_rightmost(axis_aligned_edges, sweep_axis, upper_inc);
    const right_idx_exclusive = right_idx_inclusive + 1;
    return [left_idx, right_idx_exclusive];
}

enum TurnType {
    STRAIGHT, TURN, RIGHT, LEFT
}

/**
 * Helper function to find turn type based on three consecutive points of a contour
 *
 * @param p1 first point
 * @param p2 second point, point to check
 * @param p3 third point
 * @returns an enum indicating which way the turn goes
 */
function get_turn_type(p1: Point, p2: Point, p3: Point): TurnType {
    // measure angle from p1 to p2, then from p1 to p3.

    const p1_p2 = subtract_points_2d(p2, p1);
    const p1_p3 = subtract_points_2d(p3, p1);

    const angle_diff = (angle_between(p1_p2, p1_p3) + 2 * Math.PI) % (2 * Math.PI);
    // left: between 0 and -180, right: between 0 and 180, straight: 0
    const eps = 1e-9;
    if (angle_diff < eps || angle_diff - 2 * Math.PI > eps) {
        // straight
        return TurnType.STRAIGHT;
    } else if (Math.PI - angle_diff < eps && angle_diff - Math.PI < eps) {
        // 180 degree turn
        return TurnType.TURN;
    } else if (0 - angle_diff < eps && angle_diff - Math.PI < eps) {
        // right
        return TurnType.RIGHT;
    } else { // if (Math.PI - angle_diff < eps && angle_diff - 2 * Math.PI < eps)
        // left
        return TurnType.LEFT;
    }
}

/**
 * Using previously cut contours and internal edges, remove doubles and fill empty quads s.t.
 * all quads cover walkable space.
 *
 * @param cut_contours
 * @param internal_edges_cut
 * @returns vertices, edges, and faces, edges and faces are indices into the vertices list
 */
function fill_quads_and_remove_doubles(
    cut_contours: Point[][],
    internal_edges_cut: Edge[]
): { vertices: Point[], edge_indices: ([number, number][]), faces: [number, number, number, number][] } {

    // convert contours to edges
    const edges: Edge[] = [];

    const contour_holes_x_y: { [x: number]: { [y: number]: boolean | undefined } | undefined } = {};
    const add_vertex_to_contour_hole_set = (p: Point) => {
        let contour_holes_y = contour_holes_x_y[p.x];
        if (contour_holes_y == null) {
            contour_holes_y = {};
            contour_holes_x_y[p.x] = contour_holes_y;
        }
        contour_holes_y[p.y] = true;
    }
    const vertex_is_contour_hole = (p: Point): boolean => {
        return !!contour_holes_x_y[p.x] && !!contour_holes_x_y[p.x]![p.y];
    }

    for (const contour of cut_contours) {
        for (let i = 0; i < contour.length; i++) {
            const p1 = contour[i];
            const p2 = contour[(i + 1) % contour.length];
            edges.push({ p1, p2 });
        }

        if (contour.length === 4) {
            // check winding order of contour, each left turn => +1, each right turn => -1
            let winding_number = 0;
            for (let i = 0; i < contour.length; i++) {
                const p1 = contour[(i - 1 + contour.length) % contour.length];
                const p2 = contour[i];
                const p3 = contour[(i + 1) % contour.length];
                const turn_type = get_turn_type(p1, p2, p3);
                switch (turn_type) {
                    case TurnType.LEFT:
                        winding_number += 1;
                        break;
                    case TurnType.RIGHT:
                        winding_number -= 1;
                        break;
                }
            }
            if (winding_number < 0) {
                // 4 right turns, so this is a hole. Add all points to vertex hole set
                for (const v of contour) {
                    add_vertex_to_contour_hole_set(v);
                }
            }
        }
    }
    edges.push(...internal_edges_cut);
    const { vertices, edge_indices } = remove_doubles(edges);

    // sort all edges internally s.t. e1.x <= e2.x and e1.y <= e2.y
    for (let i = 0; i < edge_indices.length; i++) {
        const edge = edge_indices[i];
        const [p1_idx, p2_idx] = edge;
        const p1 = vertices[p1_idx];
        const p2 = vertices[p2_idx];
        if (p1.x === p2.x) {
            if (p1.y > p2.y) {
                edge_indices[i] = [p2_idx, p1_idx];
            }
        } else {
            if (p1.x > p2.x) {
                edge_indices[i] = [p2_idx, p1_idx];
            }
        }
    }

    const connected_edges = build_adjacent_edges_list(vertices, edge_indices);

    const faces: [number, number, number, number][] = [];

    /**
     * Helper function that finds a connected vertex to the south;
     *
     * @param p_idx
     */
    const find_connected_vertex_south = (p_idx: number): number | null => {
        const p = vertices[p_idx];
        let found_south_v = null;
        for (const connected_edge_idx of connected_edges[p_idx]) {
            const connected_edge = edge_indices[connected_edge_idx];
            const [c_p1_idx, c_p2_idx] = connected_edge;
            const c_p1 = vertices[c_p1_idx];
            const c_p2 = vertices[c_p2_idx];
            if (c_p1.x !== c_p2.x || c_p1.y !== p.y) continue;
            // connected edge is vertical, and goes south
            found_south_v = c_p2_idx;
            break;
        }
        return found_south_v;
    }

    /**
     * Helper function that checks if two south vertices are connected
     *
     * @param p1_s_idx the south vertex to the west
     * @param p2_s_idx the south vertex to the east
     */
    const south_vertices_are_connected = (p1_s_idx: number, p2_s_idx: number): boolean => {
        const p1_s = vertices[p1_s_idx];
        // const p2_s = vertices[p2_s_idx];
        for (const connected_edge_idx of connected_edges[p1_s_idx]) {
            const connected_edge = edge_indices[connected_edge_idx];
            const [c_p1_idx, c_p2_idx] = connected_edge;
            const c_p1 = vertices[c_p1_idx];
            const c_p2 = vertices[c_p2_idx];
            if (c_p1.y !== c_p2.y || c_p1.x !== p1_s.x) continue;
            // connected edge is horizontal and goes east,
            // check if it connects to p2_s
            return c_p2_idx === p2_s_idx;
        }
        return false;
    }

    for (const [p1_idx, p2_idx] of edge_indices) {
        // For each horizontal edge, check if it is possible to create a face by using two vertices to the south (positive y axis).
        const p1 = vertices[p1_idx];
        const p2 = vertices[p2_idx];
        if (p1.y !== p2.y) continue;
        const p1_south_idx = find_connected_vertex_south(p1_idx);
        const p2_south_idx = find_connected_vertex_south(p2_idx);
        if (p1_south_idx == null || p2_south_idx == null) continue;
        const p1_s = vertices[p1_south_idx];
        const p2_s = vertices[p2_south_idx];
        if (p1_s.y !== p2_s.y) continue;

        // check that all four vertices form a connected rectangle
        if (!south_vertices_are_connected(p1_south_idx, p2_south_idx)) continue;

        // check if the 4 vertices form a hole, if so, don't fill this face
        const debug = p1.x === -196 && p1.y === 238 && p2_s.x === -140 && p2_s.y === 251;
        if (debug) {
            console.log([p1, p2, p1_s, p2_s].map(p => vertex_is_contour_hole(p)));
        }
        let all_are_holes = true;
        for (const v of [p1, p2, p1_s, p2_s]) {
            all_are_holes = all_are_holes && vertex_is_contour_hole(v);
            // if (v.x === -196 && v.y === 238) {
            //     console.log([p1, p2, p1_s, p2_s])
            // }
        }
        if (debug) console.log(all_are_holes)
        if (all_are_holes) continue;

        // define in order top right, top left, bottom left, bottom right (counter clockwise)
        faces.push([p2_idx, p1_idx, p1_south_idx, p2_south_idx]);
    }

    return { vertices, edge_indices, faces };
}

export { contours_raycast_edges, fill_quads_and_remove_doubles };
