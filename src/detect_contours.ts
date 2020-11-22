import { intersect_and_cut, xylines_to_edges } from "./map_to_polygons";
import { remove_doubles } from "./remove_doubles";
import {
    angle_between,
    cross_product_2d,
    distance_2d,
    Edge,
    intersect_lines,
    line_point_pair_to_offset,
    midpoint,
    multiply_scalar_2d,
    normalize,
    Point,
    points_are_collinear,
    subtract_points_2d,
    vertices_equal
} from "./geometry";


// Input: vertex array, and edge index array (edges can share vertices)
// Goal: Create contour meshes, with proper winding order.
/**
 * Detects all wall contours that are walkable from the given spawn point. The resulting contour
 * goes counter-clockwise such that an edge in the contour rotated by 90 degrees ccw will point towards
 * the walkable space. A contour is defined by a list of vertices, with an edge between each consecutive
 * vertex, and the first and last vertex connected.
 *
 * @param vertices
 * @param edge_indices
 * @param spawn_position
 */
function detect_contours(vertices: Point[], edge_indices: [number, number][], spawn_position: Point): Point[][] {

    // build vertex->edge index that for each vertex, lists all edges (by index) connected to this vertex
    const vertices_with_connected_edges = build_adjacent_edges_list(vertices, edge_indices);
    console.log("Using spawn position ", spawn_position);

    const found_contours: Point[][] = [];

    // searchable_edges are all edges (by index) that can be used as raycast targets
    const searchable_edges: number[] = [];
    for (let i = 0; i < edge_indices.length; i++) {
        searchable_edges.push(i);
    }

    while (searchable_edges.length > 0) {
        // console.log("Eligible edges:", searchable_edges.map(e => edge_indices[e]).map(([v1, v2])=>[vertices[v1], vertices[v2]]));

        // pick an edge that is not collinear with the spawn point
        let raycast_target_edge_idx = -1;
        for (let i = 0; i < searchable_edges.length; i++) {
            const edge_idx = searchable_edges[i];
            const edge = edge_indices[edge_idx];
            const [a, b] = [vertices[edge[0]], vertices[edge[1]]];
            if (points_are_collinear(spawn_position, a, b)) {
                continue;
            }
            raycast_target_edge_idx = i;
            break;
        }
        if (raycast_target_edge_idx === -1) {
            console.warn(`All remaining polygons are collinear with the spawn point, ${searchable_edges.length} edges.`);
            console.warn("Contents of the remaining edges", "\nedges:\n", searchable_edges.map(e => edge_indices[e]), "\nvertices\n", vertices);
            break;
        }
        // use the middle point of the found edge as the raycast target angle
        const raycast_target_edge = edge_indices[searchable_edges[raycast_target_edge_idx]];
        const raycast_target_point = midpoint(vertices[raycast_target_edge[0]], vertices[raycast_target_edge[1]]);
        let raycast_ray = subtract_points_2d(raycast_target_point, spawn_position);
        raycast_ray = normalize(raycast_ray);
        // increase raycast distance to +infinity, or in this case just a large number
        // could also just increase by a little bit
        raycast_ray = multiply_scalar_2d(raycast_ray, 100000);

        // perform raycast...

        type Intersection = { e_idx: number, intersection_point: Point, dist: number, is_contour: boolean };

        const intersections: Intersection[] = [];

        // ...on all searchable edges
        for (let i = 0; i < searchable_edges.length; i++) {
            const e_idx = searchable_edges[i];
            const [v1_idx, v2_idx] = edge_indices[e_idx];
            const [ep, er] = line_point_pair_to_offset(vertices[v1_idx], vertices[v2_idx]);
            const intersection_point = intersect_lines(spawn_position, raycast_ray, ep, er);
            if (intersection_point != null) {
                const dist = distance_2d(spawn_position, intersection_point);
                intersections.push({ e_idx, intersection_point, dist, is_contour: false });
            }
        }

        // ...on all previously found contours
        for (const contour of found_contours) {
            const edges = [];
            for (let i = 1; i < contour.length; i++) {
                const v1 = contour[i - 1];
                const v2 = contour[i];
                edges.push([v1, v2]);
            }
            edges.push([contour[contour.length - 1], contour[0]]);
            for (const edge of edges) {
                const [v1, v2] = edge;
                const [ep, er] = line_point_pair_to_offset(v1, v2);
                const intersection_point = intersect_lines(spawn_position, raycast_ray, ep, er);
                if (intersection_point) {
                    const dist = distance_2d(spawn_position, intersection_point);
                    intersections.push({ e_idx: -1, intersection_point, dist, is_contour: true });
                }
            }
        }

        // sort by distance
        intersections.sort((a, b) => a.dist - b.dist);

        // find closest intersection, check if inside previously found contour
        let is_inside_walkable_space = true;
        let closest_intersection;
        for (const intersection of intersections) {
            if (intersection.is_contour) {
                is_inside_walkable_space = !is_inside_walkable_space;
                continue;
            }
            closest_intersection = intersection;
            break;
        }

        if (closest_intersection == null) {
            throw new Error("Found no intersection when raycasting.")
        }

        // use simple depth-first search to remove all edges from current polygon from the list of searchable edges
        const open_edge_set = [closest_intersection.e_idx];
        const seen_edge_indices: { [key: number]: boolean | undefined } = {};
        while (open_edge_set.length > 0) {
            const edge_idx = open_edge_set.pop()!; // edge is an index of edge_indices
            seen_edge_indices[edge_idx] = true;
            // add edge index to list of edges to remove
            // find all connected edges
            const found_edges = [];
            const verts_indices_of_this_edge = edge_indices[edge_idx];
            for (const v_idx of verts_indices_of_this_edge) {
                const edge_list = vertices_with_connected_edges[v_idx];
                found_edges.push(...edge_list);
            }
            // remove all seen edges from the found edges
            const unseen_found_edges = found_edges.filter(edge_idx => !seen_edge_indices[edge_idx]);
            open_edge_set.push(...unseen_found_edges);
        }

        // remove all edges that are part of this polygon from the list of raycast targets
        for (let i = searchable_edges.length - 1; i >= 0; i--) {
            const edge_idx = searchable_edges[i];
            if (seen_edge_indices[edge_idx]) {
                searchable_edges.splice(i, 1);
            }
        }

        if (!is_inside_walkable_space) {
            // the intersected edge is outside a previously found contour, skip generating contour
            console.log("Found an edge that is outside walkable space, skipping contour generation for this polygon",
                "\nIntersected at point", closest_intersection.intersection_point);
            continue;
        }

        // use cross product between ray and edge to figure out which direction makes edge go left
        const edge_vertex_indices = edge_indices[closest_intersection.e_idx];
        const edge_as_vector = subtract_points_2d(vertices[edge_vertex_indices[0]], vertices[edge_vertex_indices[1]]);
        const edge_normalized = normalize(edge_as_vector);
        const ray_normalized = normalize(raycast_ray);
        const cross_product = cross_product_2d(ray_normalized, edge_normalized);
        // if > 0, the edge points left already, otherwise, it points right

        // begin creating contour, it is a list of vertices with the last vertex being connected to the first vertex
        const contour_mesh_vertices = [];

        // Begin traversing graph. If the first edge already points left from the perspective of the ray, keep it.
        // Otherwise, swap order of vertices.

        let vertex1_idx: number;
        let vertex2_idx: number;
        if (cross_product > 0) {
            contour_mesh_vertices.push(vertices[edge_vertex_indices[0]], vertices[edge_vertex_indices[1]]);
            vertex1_idx = edge_vertex_indices[0];
            vertex2_idx = edge_vertex_indices[1];
        } else {
            contour_mesh_vertices.push(vertices[edge_vertex_indices[1]], vertices[edge_vertex_indices[0]]);
            vertex1_idx = edge_vertex_indices[1];
            vertex2_idx = edge_vertex_indices[0];
        }
        let done = false;
        while (!done) {
            // find all potential next edges
            const edges = vertices_with_connected_edges[vertex2_idx];
            const edges_ordered: [number, number][] = [];
            for (const edge_idx of edges) {
                const edge = edge_indices[edge_idx];
                if (edge[0] === vertex2_idx) {
                    edges_ordered.push([edge[0], edge[1]]);
                } else {
                    edges_ordered.push([edge[1], edge[0]]);
                }
            }
            // remove the current edge
            let angle_compare_edge_indices: [number, number] = [-1, -1];
            for (let i = 0; i < edges_ordered.length; i++) {
                if (edges_ordered[i][1] === vertex1_idx) {
                    [angle_compare_edge_indices] = edges_ordered.splice(i, 1);
                    break;
                }
            }

            if (edges_ordered.length === 0) {
                // this was a single edge, add the returning edge as an alternative
                edges_ordered.push([angle_compare_edge_indices[0], angle_compare_edge_indices[1]]);
            }
            let angle_compare_edge = [vertices[angle_compare_edge_indices[0]], vertices[angle_compare_edge_indices[1]]];
            const angle_compare_vector = subtract_points_2d(angle_compare_edge[0], angle_compare_edge[1]);
            // check all other edges, select the one that points the most to the left
            const edge_angles = [];
            for (let i = 0; i < edges_ordered.length; i++) {
                const check_edge_v_indices = edges_ordered[i];
                let check_edge = [vertices[check_edge_v_indices[0]], vertices[check_edge_v_indices[1]]];
                let check_edge_v = subtract_points_2d(check_edge[0], check_edge[1]);
                let angle = angle_between(angle_compare_vector, check_edge_v);
                angle = (angle + 2 * Math.PI) % (2 * Math.PI);
                check_edge_v = normalize(check_edge_v);
                edge_angles.push([i, angle]);
            }
            edge_angles.sort((a, b) => a[1] - b[1]);
            const chosen_idx = edge_angles[0][0];
            const chosen_edge = edges_ordered[chosen_idx];
            // add the next vertex to the contour, and continue search
            vertex1_idx = chosen_edge[0];
            vertex2_idx = chosen_edge[1];
            contour_mesh_vertices.push(vertices[vertex2_idx]);
            if (vertices_equal(contour_mesh_vertices[0], vertices[vertex1_idx]) && vertices_equal(contour_mesh_vertices[1], vertices[vertex2_idx])) {
                done = true;
            }
        }
        contour_mesh_vertices.splice(contour_mesh_vertices.length - 2, 2);
        found_contours.push(contour_mesh_vertices);
    }

    console.log(`Found ${found_contours.length} contours.`);

    return found_contours;
}

/**
 * Build a list of equal length to vertices, of all edges that are connected to a vertex.
 *
 * @example
 * const vertex_to_connected_edges = build_adjacent_edges_list(vertices, edge_indices);
 * console.log("Vertex at pos 0 is connected to",
 *     vertex_to_connected_edges[0].length, "edges");
 * console.log("One of them are:", edge_indices[vertex_to_connected_edges[0]]);
 *
 * @param vertices
 * @param edge_indices
 */
function build_adjacent_edges_list(vertices: Point[], edge_indices: [number, number][]): number[][] {
    const vertices_with_connected_edges: number[][] = [];
    for (let i = 0; i < vertices.length; i++) {
        vertices_with_connected_edges.push([]);
    }
    for (let i = 0; i < edge_indices.length; i++) {
        const edge = edge_indices[i];
        const [p1_idx, p2_idx] = edge;
        vertices_with_connected_edges[p1_idx].push(i);
        vertices_with_connected_edges[p2_idx].push(i);
    }
    return vertices_with_connected_edges;
}

/**
 * Remove all vertices of a contour if that vertex is not part of an angle / bend
 *
 * @param contours
 */
function contours_remove_unused_verts(contours: Point[][]) {
    const stripped_contours: Point[][] = [];
    for (const contour of contours) {
        const contour_stripped = [];
        for (let i = 0; i < contour.length; i++) {
            const p1 = contour[(i + contour.length - 1) % contour.length];
            const p2 = contour[i];
            const p3 = contour[(i + contour.length + 1) % contour.length];
            if (!points_are_collinear(p1, p2, p3)) {
                contour_stripped.push(p2);
            }
        }
        stripped_contours.push(contour_stripped);
    }
    return stripped_contours;
}


/**
 * Convert a list of contours into a vertices and edge indices list.
 *
 * @param contours
 */
function contours_into_vert_edge_list(contours: Point[][]): { vertices: Point[], edge_indices: [number, number][] } {
    const vertices = [];
    const edge_indices: [number, number][] = [];
    for (const contour of contours) {
        if (contour.length <= 1) continue;
        const first_vertex_idx = vertices.push(contour[0]) - 1;
        for (let i = 1; i < contour.length; i++) {
            let current_vertex_idx = vertices.push(contour[i]) - 1;
            edge_indices.push([current_vertex_idx - 1, current_vertex_idx]);
        }
        // connect first and last index
        edge_indices.push([vertices.length - 1, first_vertex_idx]);
    }
    return { vertices, edge_indices };
}

/**
 * Convert a list of contours into a horizontal and vertical edge list, grouped by axis
 *
 * @param contours
 */
function contours_into_horiz_vert_edge_list(contours: Point[][]): [Edge[], Edge[]] {
    // the output are [horiz, vert] of all the horizontal and vertical edges, ordered by coordinate
    const horizontal: Edge[] = [];
    const vertical: Edge[] = [];
    for (const contour of contours) {
        const edges: Edge[] = [];
        for (let i = 0; i < contour.length; i++) {
            const p1 = contour[i];
            const p2 = contour[(i + 1) % contour.length];
            edges.push({ p1, p2 });
        }
        for (const edge of edges) {
            // group by horizontal or vertical, and sort internally in edge
            const { p1, p2 } = edge;
            if (p1.x === p2.x) {
                if (p1.y < p2.y) {
                    vertical.push({ p1, p2 });
                } else {
                    vertical.push({ p1: p2, p2: p1 });
                }
            } else {
                if (p1.x < p2.x) {
                    horizontal.push({ p1, p2 });
                } else {
                    horizontal.push({ p1: p2, p2: p1 });
                }
            }
        }
    }
    return [horizontal, vertical];
}


async function _test_fn() {
    const { load_map_data } = await import("./load_map_data");
    const { data, spawns } = load_map_data("winter_inn");
    const spawn_pos = { x: spawns[0][0], y: spawns[0][1] };
    const [horizontal_edges, vertical_edges] = xylines_to_edges(data);
    console.log(`${horizontal_edges.length} horizontal edges and ${vertical_edges.length} vertical edges`);

    // Test example, square outside main contour (test for object removal):
    horizontal_edges.push({ p1: { x: 270, y: -120 }, p2: { x: 280, y: -120 } });
    horizontal_edges.push({ p1: { x: 270, y: -110 }, p2: { x: 280, y: -110 } });
    vertical_edges.push({ p1: { x: 270, y: -120 }, p2: { x: 270, y: -110 } });
    vertical_edges.push({ p1: { x: 280, y: -120 }, p2: { x: 280, y: -110 } });

    // find all intersections, build graph

    const edges = intersect_and_cut(horizontal_edges, vertical_edges);
    const { vertices, edge_indices } = remove_doubles(edges);

    const contours = detect_contours(vertices, edge_indices, spawn_pos);
    const contours2 = contours_remove_unused_verts(contours);
    const { vertices: v2, edge_indices: e2 } = contours_into_vert_edge_list(contours2);

    const fs = await import("fs");
    const { to_waveform_obj } = require("./waveform_obj_import_export");

    const as_waveform = to_waveform_obj(v2, e2, "AdventureLandMapData");
    fs.writeFileSync("output_data.obj", as_waveform, { encoding: "utf8" })
}

export {
    detect_contours,
    contours_remove_unused_verts,
    contours_into_vert_edge_list,
    contours_into_horiz_vert_edge_list,
    build_adjacent_edges_list
};
