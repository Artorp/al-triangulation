/**
 * Takes in Adventure Land map data, and unpacks the horizontal and vertical edges to
 * edges represented by two points.
 *
 * @param {MapData} map_data
 * @returns {[Edge[], Edge[]]}
 */
function xylines_to_edges(map_data) {
    const { x_lines, y_lines } = map_data;
    const vertical_edges = [];
    const horizontal_edges = [];
    for (const x_line of x_lines) {
        const [x, y0, y1] = x_line;
        vertical_edges.push({ p1: { x, y: y0 }, p2: { x, y: y1 } });
    }
    for (const y_line of y_lines) {
        const [y, x0, x1] = y_line;
        horizontal_edges.push({ p1: { x: x0, y }, p2: { x: x1, y } });
    }
    return [horizontal_edges, vertical_edges];
}

/**
 * Given a list of horizontal and vertical edges, find all intersections between all edges and cut the edges
 * at those intersection points. The resulting list of edges have no shared vertices between each other.
 *
 * @param {Edge[]} horizontal_edges
 * @param {Edge[]} vertical_edges
 * @returns {Edge[]}
 */
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

    /**
     * @param {Edge[]} edges
     * @param {"x"|"y"} axis
     */
    function validate_edges_internal_order(edges, axis = "x") {
        for (const { p1, p2 } of edges) {
            if (!(p1[axis] < p2[axis]))
                console.warn(`${axis === "x" ? "Horizontal" : "Vertical"} edge ${JSON.stringify(p1)}->${JSON.stringify(p2)} not internally ordered! Intersection test might fail.`);
        }
    }

    validate_edges_internal_order(horizontal_edges, "x");
    validate_edges_internal_order(vertical_edges, "y");


    // pre-sort by x and y values
    horizontal_edges.sort((a, b) => a.p1.y - b.p1.y);
    vertical_edges.sort((a, b) => a.p1.x - b.p1.x);

    // handle case 1: overlapping parallel edges

    // check all overlapping within an edge
    // use a sweeping function to search for all edges with the same x- or y-value

    /**
     * Cut all edges that are parallel with each other. If they overlap, cut such that no edges overlap and vertices
     * are preserved (removing vertices that are on top of each other, doubles)
     *
     * @param {Edge[]} axis_aligned_edges
     * @param {"x"|"y"} sweep_axis
     * @returns {Edge[]}
     */
    function cut_aligned_edges(axis_aligned_edges, sweep_axis) {
        const axis2 = sweep_axis === "x" ? "y" : "x";

        /** @type {Edge[]} */
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
                const e0_min = e0.p1[axis2];
                const e0_max = e0.p2[axis2];
                for (let e1_idx = 0; e1_idx < unchecked.length; e1_idx++) {
                    const e1 = unchecked[e1_idx];
                    const e1_min = e1.p1[axis2];
                    const e1_max = e1.p2[axis2];
                    if ((e1_min >= e0_max) || (e0_min >= e1_max)) continue;
                    // edges are overlapping, split
                    found_intersection = true;

                    // remove e1 from unchecked, will instead add new edges
                    unchecked.splice(e1_idx, 1);

                    // four vertices, e0_v0, e0_v1, e1_v0, e1_v1. Want to find up to three new edges v0 -> v1 -> v2 -> v3,
                    // sorting the vertices and removing doubles will handle all overlapping cases
                    const vertices_sorted = [e0.p1, e0.p2, e1.p1, e1.p2];
                    vertices_sorted.sort((v0, v1) => v0[axis2] - v1[axis2]);
                    for (let i = 1; i < vertices_sorted.length; i++) {
                        const a = vertices_sorted[i - 1];
                        const b = vertices_sorted[i];
                        if (a[axis2] === b[axis2]) continue; // skip doubles
                        const new_edge = { p1: { ...a }, p2: { ...b } };
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

    const case1_h_edges = cut_aligned_edges(horizontal_edges, "y");
    const case1_v_edges = cut_aligned_edges(vertical_edges, "x");


    validate_edges_internal_order(case1_h_edges, "x");
    validate_edges_internal_order(case1_v_edges, "y");

    // handle case 2 and 3: vertex touches edge or edge touches edge

    // at this point, a horizontal edge can only intersect with a vertical edge, and vice versa
    // so, check all horizontal edges against all vertical edges, and both are checked after one sweep

    const working_edge_list_h = [...case1_h_edges];
    const working_edge_list_v = [...case1_v_edges];
    const processed_h_edges = [];
    const processed_v_edges = [];

    while (working_edge_list_h.length > 0) {
        const edge_h = working_edge_list_h.pop();
        const edge_h_y = edge_h.p1.y;
        // intersection check vs all vertical edges
        let found_intersection = false;
        for (let v_e_idx = 0; v_e_idx < working_edge_list_v.length; v_e_idx++) {
            const edge_v = working_edge_list_v[v_e_idx];
            const edge_v_x = edge_v.p1.x;
            // compare bounding boxes, inclusive
            if ((edge_v.p1.y <= edge_h_y) && (edge_h_y <= edge_v.p2.y) &&
                (edge_h.p1.x <= edge_v_x) && (edge_v_x <= edge_h.p2.x)) {
                // has intersection, check if it is just a V-V intersection (which can be ignored)
                const intersection_point = { x: edge_v_x, y: edge_h_y };
                let vv = false;
                for (const v1 of Object.values(edge_h)) {
                    for (const v2 of Object.values(edge_v)) {
                        if (v1.x === v2.x && v1.y === v2.y) {
                            vv = true;
                        }
                    }
                }
                if (vv) continue;

                // not V-V, so either V-E or E-E.
                found_intersection = true;

                // check if V-E:
                let ve = false;
                for (const v of [...Object.values(edge_h), ...Object.values(edge_v)]) {
                    if (v.x === intersection_point.x && v.y === intersection_point.y) {
                        ve = true;
                        break;
                    }
                }

                if (ve) {
                    if ((edge_h_y === edge_v.p1.y) || (edge_h_y === edge_v.p2.y)) {
                        // split horizontal, keep vertical
                        const h_v0 = edge_h.p1;
                        const h_v1 = intersection_point;
                        const h_v2 = edge_h.p2;
                        working_edge_list_h.push({ p1: h_v0, p2: h_v1 });
                        working_edge_list_h.push({ p1: h_v1, p2: h_v2 });
                    } else {
                        // split vertical, keep horizontal
                        working_edge_list_h.push(edge_h);
                        working_edge_list_v.splice(v_e_idx, 1);
                        const v_v0 = edge_v.p1;
                        const v_v1 = intersection_point;
                        const v_v2 = edge_v.p2;
                        working_edge_list_v.push({ p1: v_v0, p2: v_v1 });
                        working_edge_list_v.push({ p1: v_v1, p2: v_v2 });
                    }

                } else {
                    // is E-E, split both
                    working_edge_list_v.splice(v_e_idx, 1);

                    const h_v0 = edge_h.p1;
                    const h_v2 = edge_h.p2;
                    const v_v0 = edge_v.p1;
                    const v_v2 = edge_v.p2;
                    working_edge_list_h.push({ p1: h_v0, p2: intersection_point });
                    working_edge_list_h.push({ p1: intersection_point, p2: h_v2 });
                    working_edge_list_v.push({ p1: v_v0, p2: intersection_point });
                    working_edge_list_v.push({ p1: intersection_point, p2: v_v2 });
                }
                break;
            }
        }
        if (!found_intersection) {
            processed_h_edges.push(edge_h);
        }
    }

    processed_v_edges.push(...working_edge_list_v);

    validate_edges_internal_order(processed_h_edges, "x");
    validate_edges_internal_order(processed_v_edges, "y");

    return [...processed_h_edges, ...processed_v_edges];
}

/**
 * Helper generator function, group edges such that all edges that are collinear with the sweep axis are
 * returned. The edges must be either all vertical or all horizontal, and be sorted asc by their orthogonal axis
 * (x-axis for vertical, y-axis for horizontal)
 *
 * @param {Edge[]} edges
 * @param {"x"|"y"} sweep_axis
 * @returns {Generator<[number, number], void, *>}
 */
function* group_by_one_axis(edges, sweep_axis) {
    /** @type {number} */
    let last_value = edges[0].p1[sweep_axis];
    let last_idx = 0;
    for (let i = 1; i < edges.length; i++) {
        const point = edges[i].p1;
        if (last_value !== point[sweep_axis]) {
            yield [last_idx, i];
            last_idx = i;
            last_value = point[sweep_axis];
        }
    }
    yield [last_idx, edges.length];
}

/**
 *
 * @param {Edge[]} edges
 * @returns {{vertices: Point[], edge_indices: [number, number][]}}
 */
function edges_to_edge_vert_list(edges) {
    /** @type {Point[]} */
    const vertices = [];
    const edge_indices = [];
    for (const { p1, p2 } of edges) {
        vertices.push(p1, p2);
        const vl = vertices.length;
        edge_indices.push([vl - 2, vl - 1]);
    }
    return { vertices, edge_indices };
}


function test_fn() {
    const { data, spawns } = require("./map_data/winter_inn.json");
    const [horizontal_edges, vertical_edges] = xylines_to_edges(data);
    console.log(`${horizontal_edges.length} horizontal edges and ${vertical_edges.length} vertical edges`);

    // find all intersections, build graph

    // Test examples that demonstrates all different kinds of intersections
    // axis-aligned:
    horizontal_edges.push({ p1: { x: 0, y: 0 }, p2: { x: 10, y: 0 } }, { p1: { x: 0, y: 0 }, p2: { x: 15, y: 0 } });
    vertical_edges.push({ p1: { x: 0, y: -20 }, p2: { x: 0, y: -10 } }, { p1: { x: 0, y: -40 }, p2: { x: 0, y: -10 } });

    // V-E:
    horizontal_edges.push({ p1: { x: 0, y: -80 }, p2: { x: 10, y: -80 } });
    vertical_edges.push({ p1: { x: 0, y: -90 }, p2: { x: 0, y: -70 } });

    // E-E crossing:
    horizontal_edges.push({ p1: { x: -10, y: -120 }, p2: { x: 10, y: -120 } });
    vertical_edges.push({ p1: { x: 0, y: -130 }, p2: { x: 0, y: -110 } });

    const edges = intersect_and_cut(horizontal_edges, vertical_edges);
    const { vertices, edge_indices } = edges_to_edge_vert_list(edges);

    const fs = require("fs");
    const { to_waveform_obj } = require("./waveform_obj_import_export");

    const as_waveform = to_waveform_obj(vertices, edge_indices, "AdventureLandMapData");
    fs.writeFileSync("output_data.obj", as_waveform, { encoding: "utf8" });
}


module.exports = { intersect_and_cut, xylines_to_edges, edges_to_edge_vert_list, group_by_one_axis };
