function xylines_to_edges(map_data) {
    const { x_lines, y_lines } = map_data;
    const vertical_edges = [];
    const horizontal_edges = [];
    for (const x_line of x_lines) {
        const [x, y0, y1] = x_line;
        vertical_edges.push([[x, y0], [x, y1]]);
    }
    for (const y_line of y_lines) {
        const [y, x0, x1] = y_line;
        horizontal_edges.push([[x0, y], [x1, y]]);
    }
    return [horizontal_edges, vertical_edges];
}


function intersect_and_cut(horizontal_edges, vertical_edges) {
    // find all intersections, and split edges if intersections found

    // Types of intersections:
    // 1. Aligned overlapping. Both edges are aligned and are overlapping each other: 0--1==2--3, edges 0-2 and 1-3.
    //    Processing: split into max of 3 edges.
    // 2. V-V touching. Edges do not overlap, but share vertex.
    //    Processing: no processing in this stage, leave both edges.
    // 3. V-E touching. One vertex touch edge of other edge.
    //    Processing: split edge that is touched by other, results in 3 edges.
    // 4. E-E crossing, typical intersection at right angle.
    //    Processing: create vertex at intersection, split both edges at that point, results in 4 edges.

    // assumptions on horizontal_edges and vertical_edges:
    //   the vertices of an edge is ordered, s.t. the first index of an edge has a lower x-value or a lower y-value

    function validate_edges_internal_order(edges, axis = 0) {
        for (const [a, b] of edges) {
            if (!(a[axis] < b[axis]))
                console.warn(`${axis === 0 ? "Horizontal" : "Vertical"} edge ${a}->${b} not internally ordered! Intersection test might fail.`);
        }
    }

    validate_edges_internal_order(horizontal_edges, 0);
    validate_edges_internal_order(vertical_edges, 1);


    // pre-sort by x and y values
    horizontal_edges.sort((a, b) => a[0][1] - b[0][1]);
    vertical_edges.sort((a, b) => a[0][0] - b[0][0]);

    // handle case 1: overlapping parallel edges

    // check all overlapping within an edge
    // use a sweeping function to search for all edges with the same x- or y-value
    function* group_by_one_axis(edges, sweep_axis) {
        let last_value = edges[0][0][sweep_axis];
        let last_idx = 0;
        for (let i = 1; i < edges.length; i++) {
            const point = edges[i][0];
            if (last_value !== point[sweep_axis]) {
                yield [last_idx, i];
                last_idx = i;
                last_value = point[sweep_axis];
            }
        }
        yield [last_idx, edges.length];
    }

    function cut_aligned_edges(axis_aligned_edges, sweep_axis) {
        const axis2 = 1 - sweep_axis;  // x-axis if sweep axis is the y-axis, and vice versa

        const processed_edges = [];

        for (const [from, to] of group_by_one_axis(axis_aligned_edges, sweep_axis)) {
            // check for intersections, if so, split and combine
            const unchecked = axis_aligned_edges.slice(from, to);
            const checked = [];
            while (unchecked.length > 1) {
                let found_intersection = false;
                const e0 = unchecked.pop();
                // rely on the invariant property that all edges' vertices are internally ordered to be sorted by the
                // axis that varies
                const e0_min = e0[0][axis2];
                const e0_max = e0[1][axis2];
                for (let e1_idx = 0; e1_idx < unchecked.length; e1_idx++) {
                    const e1 = unchecked[e1_idx];
                    const e1_min = e1[0][axis2];
                    const e1_max = e1[1][axis2];
                    if ((e1_min >= e0_max) || (e0_min >= e1_max)) continue;
                    // edges are overlapping, split
                    found_intersection = true;

                    // remove e1 from unchecked, will instead add new edges
                    unchecked.splice(e1_idx, 1);

                    // four vertices, e0_v0, e0_v1, e1_v0, e1_v1. Want to find up to three new edges v0 -> v1 -> v2 -> v3
                    // sorting the vertices and removing doubles will handle all overlapping cases
                    const vertices_sorted = [e0[0], e0[1], e1[0], e1[1]];
                    vertices_sorted.sort((v0, v1) => v0[axis2] - v1[axis2]);
                    for (let i = 1; i < vertices_sorted.length; i++) {
                        const a = vertices_sorted[i - 1];
                        const b = vertices_sorted[i];
                        if (a[axis2] === b[axis2]) continue; // skip doubles
                        const new_edge = [[...a], [...b]];
                        unchecked.push(new_edge);
                    }
                    break;
                }
                if (!found_intersection) {
                    checked.push(e0);
                }
            }
            checked.push(...unchecked);
            processed_edges.push(...checked);
        }
        return processed_edges;
    }

    const case1_h_edges = cut_aligned_edges(horizontal_edges, 1);
    const case1_v_edges = cut_aligned_edges(vertical_edges, 0);


    validate_edges_internal_order(case1_h_edges, 0);
    validate_edges_internal_order(case1_v_edges, 1);

    // handle case 2 and 3: vertex touches edge or edge touches edge

    // at this point, a horizontal edge can only intersect with a vertical edge, and vice versa
    // so, check all horizontal edges against all vertical edges, and both are checked after one sweep

    const working_edge_list_h = [...case1_h_edges];
    const working_edge_list_v = [...case1_v_edges];
    const processed_h_edges = [];
    const processed_v_edges = [];

    while (working_edge_list_h.length > 0) {
        const edge_h = working_edge_list_h.pop();
        const edge_h_y = edge_h[0][1];
        // intersection check vs all vertical edges
        let found_intersection = false;
        for (let v_e_idx = 0; v_e_idx < working_edge_list_v.length; v_e_idx++) {
            const edge_v = working_edge_list_v[v_e_idx];
            const edge_v_x = edge_v[0][0];
            // compare bounding boxes
            if ((edge_v[0][1] <= edge_h_y) && (edge_h_y <= edge_v[1][1]) &&
                (edge_h[0][0] <= edge_v_x) && (edge_v_x <= edge_h[1][0])) {
                // has intersection, check if it is just a V-V intersection (which can be ignored)
                const intersection_point = [edge_v_x, edge_h_y];
                let vv = false;
                for (const v1 of edge_h) {
                    for (const v2 of edge_v) {
                        if (v1[0] === v2[0] && v1[1] === v2[1]) {
                            vv = true;
                        }
                    }
                }
                if (vv) continue;

                // not V-V, so either V-E or E-E.
                found_intersection = true;

                // check if V-E:
                let ve = false;
                for (const v of [...edge_h, ...edge_v]) {
                    if (v[0] === intersection_point[0] && v[1] === intersection_point[1]) {
                        ve = true;
                        break;
                    }
                }

                if (ve) {
                    if ((edge_h_y === edge_v[0][1]) || (edge_h_y === edge_v[1][1])) {
                        // split horizontal, keep vertical
                        const h_v0 = edge_h[0];
                        const h_v1 = intersection_point;
                        const h_v2 = edge_h[1];
                        working_edge_list_h.push([h_v0, h_v1]);
                        working_edge_list_h.push([h_v1, h_v2]);
                    } else {
                        // split vertical, keep horizontal
                        working_edge_list_h.push(edge_h);
                        working_edge_list_v.splice(v_e_idx, 1);
                        const v_v0 = edge_v[0];
                        const v_v1 = intersection_point;
                        const v_v2 = edge_v[1];
                        working_edge_list_v.push([v_v0, v_v1]);
                        working_edge_list_v.push([v_v1, v_v2]);
                    }

                } else {
                    // is E-E, split both
                    working_edge_list_v.splice(v_e_idx, 1);

                    const h_v0 = edge_h[0];
                    const h_v2 = edge_h[1];
                    const v_v0 = edge_v[0];
                    const v_v2 = edge_v[1];
                    working_edge_list_h.push([h_v0, intersection_point]);
                    working_edge_list_h.push([intersection_point, h_v2]);
                    working_edge_list_v.push([v_v0, intersection_point]);
                    working_edge_list_v.push([intersection_point, v_v2]);
                }
                break;
            }
        }
        if (!found_intersection) {
            processed_h_edges.push(edge_h);
        }
    }

    processed_v_edges.push(...working_edge_list_v);

    validate_edges_internal_order(processed_h_edges, 0);
    validate_edges_internal_order(processed_v_edges, 1);

    return [...processed_h_edges, ...processed_v_edges];
}

function edges_to_edge_vert_list(edges) {
    const vertices = [];
    const edge_indices = [];
    for (const [v0, v1] of edges) {
        vertices.push(v0, v1);
        const vl = vertices.length;
        edge_indices.push([vl - 2, vl - 1]);
    }
    return [vertices, edge_indices];
}


function test_fn() {
    const { data, spawns } = require("./map_data/winter_inn.json");
    const [horizontal_edges, vertical_edges] = xylines_to_edges(data);
    console.log(`${horizontal_edges.length} horizontal edges and ${vertical_edges.length} vertical edges`);

    // find all intersections, build graph

    // Test examples that demonstrates all different kinds of intersections
    // axis-aligned:
    horizontal_edges.push([[0, 0], [10, 0]], [[0, 0], [15, 0]]);
    vertical_edges.push([[0, -20], [0, -10]], [[0, -40], [0, -10]]);

    // V-E:
    horizontal_edges.push([[0, -80], [10, -80]]);
    vertical_edges.push([[0, -90], [0, -70]]);

    // E-E crossing:
    horizontal_edges.push([[-10, -120], [10, -120]]);
    vertical_edges.push([[0, -130], [0, -110]]);

    const edges = intersect_and_cut(horizontal_edges, vertical_edges);
    const [vertices, edge_indices] = edges_to_edge_vert_list(edges);

    const fs = require("fs");
    const { to_waveform_obj } = require("./waveform_obj_import_export");

    const as_waveform = to_waveform_obj(vertices, edge_indices, "AdventureLandMapData");
    fs.writeFileSync("output_data.obj", as_waveform, { encoding: "utf8" });
}


module.exports = { intersect_and_cut, xylines_to_edges, edges_to_edge_vert_list };
