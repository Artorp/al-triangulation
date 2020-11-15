const { intersect_and_cut, xylines_to_edges } = require("./map_to_polygons")
const { remove_doubles } = require("./remove_doubles")
const { intersect_lines, line_point_pair_to_offset, subtract_points_2d, distance_2d, cross_product_2d, normalize, dot_product_2d, angle_between, vertices_equal, midpoint, multiply_scalar_2d } = require("./geometry");

// Input: vertex array, and edge index array (edges can share vertices)
// Goal: Create contour meshes, with proper winding order.

// Define a spawn point.
// Raycast from spawn point to infinity, the first edge hit is the starting edge.
// Initial winding order is Counter-Clockwise from ray, so ray.normalized cross z-up.
// Run a depth first search on the mesh, always selecting the edge that goes to the left.
// (first create an index of edges from each vertices?)
// Build contour mesh while doing this.
// When finding the initial edge / starting vertex, procedure done. Remove mesh that was worked from, then...
// select another edge (the edge must have an angle to the raycast ray), and choose edge midpoint as ray target
// then run above algorithm again.
// When no more edges, should have a set of contour meshes. These can be inflated / deflated as needed.


function detect_contours(vertices, edge_indices, spawn_position){

    // build vertex index that points to all edges connected to a vertex
    const vertices_with_connected_edges = [];
    for (let i = 0; i < vertices.length; i++) {
        vertices_with_connected_edges.push([]);
    }
    for (let i = 0; i < edge_indices.length; i++) {
        const edge = edge_indices[i];
        const [v0, v1] = edge;
        vertices_with_connected_edges[v0].push(i);
        vertices_with_connected_edges[v1].push(i);
    }
    const nudged_spawn_position = [spawn_position[0] + 0.5, spawn_position[1] + 0.5]
    console.log("Using spawn position ", nudged_spawn_position);

    const found_contours = [];

    // searchable_edges is a list of indices into edge_indices, of all edges that can be used as raycast targets
    const searchable_edges = [];
    for (let i = 0; i < edge_indices.length; i++) {
        searchable_edges.push(i);
    }

    while (searchable_edges.length > 0) {
        // console.log("Eligible edges:", searchable_edges.map(e => edge_indices[e]).map(([v1, v2])=>[vertices[v1], vertices[v2]]));

        // pick an edge that is not collinear with the spawn point
        let chosen_edge_idx = -1;
        for (let i = 0; i < searchable_edges.length; i++) {
            const edge_idx = searchable_edges[i];
            const edge = edge_indices[edge_idx];
            const [a, b] = [vertices[edge[0]], vertices[edge[1]]];
            const sp_a = distance_2d(nudged_spawn_position, a);
            const sp_b = distance_2d(nudged_spawn_position, b);
            const ab = distance_2d(a, b);
            // check co-linearity by comparing distance, if the sum of the two small distances equals the
            // large distance, then it forms a triangle with 0 height, so the points are co-linear
            const small_small_large = [sp_a, sp_b, ab];
            small_small_large.sort();
            if (small_small_large[0] + small_small_large[1] - small_small_large[2] < 0.0001) {
                // they are collinear
                continue;
            }
            chosen_edge_idx = i;
            break;
        }
        if (chosen_edge_idx === -1) {
            console.warn(`All remaining polygons are collinear with the spawn point, ${searchable_edges.length} edges.`);
            console.warn("Contents of the remaining edges", "\nedges:\n", searchable_edges.map(e=>edge_indices[e]), "\nvertices\n", vertices);
            break;
        }
        // use the middle point of the found edge as the raycast target angle
        const chosen_edge = searchable_edges[chosen_edge_idx];
        const raycast_target_edge = [vertices[edge_indices[searchable_edges[chosen_edge_idx]][0]], vertices[edge_indices[searchable_edges[chosen_edge_idx]][1]]];
        const raycast_target_point = midpoint(raycast_target_edge[0], raycast_target_edge[1]);
        let raycast_ray = subtract_points_2d(raycast_target_point, nudged_spawn_position);
        raycast_ray = normalize(raycast_ray);
        // increase raycast distance to +infinity, or in this case just a large number
        // could also just increase by a little bit
        raycast_ray = multiply_scalar_2d(raycast_ray, 100000);

        // perform raycast
        const intersections = []; // [edge_idx, intersection_point, distance, is_contour]

        // on all searchable edges
        for (let i = 0; i < searchable_edges.length; i++) {
            const e_idx = searchable_edges[i];
            const [v1_idx, v2_idx] = edge_indices[e_idx];
            const edge_pr = line_point_pair_to_offset(vertices[v1_idx], vertices[v2_idx]);
            const [ep, er] = edge_pr;
            const intersection_point = intersect_lines(nudged_spawn_position, raycast_ray, ep, er);
            if (intersection_point) {
                const dist = distance_2d(nudged_spawn_position, intersection_point);
                intersections.push([e_idx, intersection_point, dist, false]);
            }
        }

        // on all previously found contours
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
                const intersection_point = intersect_lines(nudged_spawn_position, raycast_ray, ep, er);
                if (intersection_point) {
                    const dist = distance_2d(nudged_spawn_position, intersection_point);
                    intersections.push([-1, intersection_point, dist, true]);
                }
            }
        }

        // sort by distance
        intersections.sort((a, b) => a[2] - b[2]);

        // find closest intersection, check if inside previously found contour
        let is_inside_walkable_space = true;
        let closest_intersection;
        for (const intersection of intersections) {
            if (intersection[3]) {
                is_inside_walkable_space = !is_inside_walkable_space;
                continue;
            }
            closest_intersection = intersection;
            break;
        }

        // update chosen_edge_idx to point to the index of the closest edge
        for (let i = 0; i < searchable_edges.length; i++) {
            if (searchable_edges[i] === closest_intersection[0]) {
                chosen_edge_idx = i;
                break;
            }
        }

        // use simple depth-first search to remove all edges from current polygon from the list of searchable edges
        const open_edge_set = [searchable_edges[chosen_edge_idx]];
        const seen_edge_indices = {};
        while (open_edge_set.length > 0) {
            const edge_idx = open_edge_set.pop(); // edge is an index of edge_indices
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
                "\nIntersected at point", closest_intersection[1]);
            continue;
        }

        // use cross product between ray and edge to figure out which direction makes edge go left
        const edge_vertex_indices = edge_indices[closest_intersection[0]];
        const edge_as_vector = subtract_points_2d(vertices[edge_vertex_indices[0]], vertices[edge_vertex_indices[1]]);
        const edge_normalized = normalize(edge_as_vector);
        const ray_normalized = normalize(raycast_ray);
        const cross_product = cross_product_2d(ray_normalized, edge_normalized);
        // if > 0, the edge points left already, otherwise, it points right

        // begin creating contour, it is a list of vertices with the last vertex being connected to the first vertex
        const contour_mesh_vertices = [];

        // Begin traversing graph. If the first edge already points left from the perspective of the ray, keep it.
        // Otherwise, swap order of vertices.

        let vertex1_idx;
        let vertex2_idx;
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
            const edges_ordered = [];
            for (const edge_idx of edges) {
                const edge = edge_indices[edge_idx];
                if (edge[0] === vertex2_idx) {
                    edges_ordered.push([edge[0], edge[1]]);
                } else {
                    edges_ordered.push([edge[1], edge[0]]);
                }
            }
            // remove the current edge (if there are more than 1 edges)
            let angle_compare_edge;
            for (let i = 0; i < edges_ordered.length; i++) {
                if (edges_ordered[i][1] === vertex1_idx) {
                    [angle_compare_edge] = edges_ordered.splice(i, 1);
                    break;
                }
            }
            if (edges_ordered.length === 0) {
                // this was a single edge, add the returning edge as an alternative
                edges_ordered.push([angle_compare_edge[0], angle_compare_edge[1]]);
            }
            angle_compare_edge = [vertices[angle_compare_edge[0]], vertices[angle_compare_edge[1]]]
            angle_compare_edge = subtract_points_2d(angle_compare_edge[0], angle_compare_edge[1]);
            // check all other edges, select the one that points the most to the left
            const edge_angles = [];
            for (let i = 0; i < edges_ordered.length; i++) {
                const check_edge_v_indices = edges_ordered[i];
                let check_edge = [vertices[check_edge_v_indices[0]], vertices[check_edge_v_indices[1]]];
                let check_edge_v = subtract_points_2d(check_edge[0], check_edge[1]);
                let angle = angle_between(angle_compare_edge, check_edge_v);
                angle = (angle + 2 * Math.PI) % (2 * Math.PI);
                check_edge_v = normalize(check_edge_v);
                edge_angles.push([i, angle]);
            }
            edge_angles.sort((a, b) => a[1] - b[1]);
            // if (vertex1_idx === 0) {
            //     console.log(edge_angles.map(e => [vertices[edges_ordered[e[0]][1]], 180/3.1416 * e[1]]))
            // }
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


function contours_into_vert_edge_list(contours) {
    const vertices = [];
    const edge_indices = [];
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
    return [vertices, edge_indices];
}


function contours_into_horiz_vert_edge_list(contours) {
    // the output are [horiz, vert] of all the horizontal and vertical edges, ordered by coordinate
    const horizontal = [];
    const vertical = [];
    for (const contour of contours) {
        const edges = [];
        for (let i = 0; i < contour.length; i++) {
            const v0 = contour[i];
            const v1 = contour[(i + 1) % contour.length];
            edges.push([v0, v1]);
        }
        for (const edge of edges) {
            // group by horizontal or vertical, and sort internally in edge
            const [v0, v1] = edge;
            if (v0[0] === v1[0]) {
                if (v0[1] < v1[1]) {
                    vertical.push([v0, v1]);
                } else {
                    vertical.push([v1, v0]);
                }
            } else {
                if (v0[0] < v1[0]) {
                    horizontal.push([v0, v1]);
                } else {
                    horizontal.push([v1, v0]);
                }
            }
        }
    }
    return [horizontal, vertical];
}



function test_fn() {
    const { data, spawns } = require("./map_data/winter_inn.json");
    const spawn_pos = [spawns[0][0], spawns[0][1]];
    const [horizontal_edges, vertical_edges] = xylines_to_edges(data);
    console.log(`${horizontal_edges.length} horizontal edges and ${vertical_edges.length} vertical edges`);

    // Test example, square outside main contour (test for object removal):
    horizontal_edges.push([[270, -120], [280, -120]]);
    horizontal_edges.push([[270, -110], [280, -110]]);
    vertical_edges.push([[270, -120], [270, -110]]);
    vertical_edges.push([[280, -120], [280, -110]]);

    // find all intersections, build graph

    const edges = intersect_and_cut(horizontal_edges, vertical_edges);
    const [vertices, edge_indices] = remove_doubles(edges);

    const contours = detect_contours(vertices, edge_indices, spawn_pos)
    const [v2, e2] = contours_into_vert_edge_list(contours);

    const fs = require("fs");
    const { to_waveform_obj } = require("./waveform_obj_import_export");

    const as_waveform = to_waveform_obj(v2, e2, "AdventureLandMapData");
    fs.writeFileSync("output_data.obj", as_waveform, { encoding: "utf8" })
}

module.exports = { detect_contours, contours_into_vert_edge_list, contours_into_horiz_vert_edge_list };
