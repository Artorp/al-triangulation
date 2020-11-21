const { map_data } = require("./import_map_data");
const { intersect_and_cut, xylines_to_edges } = require("./map_to_polygons");


/**
 * @typedef {import("./geometry_types").Point} Point
 * @typedef {import("./geometry_types").Edge} Edge
 * */


// after cutting at all intersections, remove doubles and build polygon meshes

// for now, ignore winding order

/**
 * Merge all vertices that have a distance of 0. In the resulting vertices and edge list, one edge may share a vertex
 * with another edge.
 *
 * @param {Edge[]} edge_array
 * @returns {{vertices: Point[], edge_indices: [number, number][]}}
 */
function remove_doubles(edge_array) {
    // edges is a list of horizontal and vertical edges
    // The vertices inside each edge is ordered s.t. the first vertex has a smaller x- or y-value than the second.

    /** @type {Point[]} */
    const vertices = [];
    /** @type {[number, number][]} */
    const edge_indices = [];

    /** @type Object<number, Object<number, number>> */
    const vertex_pos_to_vertex_index_x_y = {};

    /**
     * @param {Point} p
     * @returns {number}
     */
    const store_vertex_return_vertex_index = (p) => {
        if (vertex_pos_to_vertex_index_x_y[p.x] == null) {
            vertex_pos_to_vertex_index_x_y[p.x] = {};
        }
        if (vertex_pos_to_vertex_index_x_y[p.x][p.y] == null) {
            const vertex_index = vertices.push(p) - 1;
            vertex_pos_to_vertex_index_x_y[p.x][p.y] = vertex_index;
            return vertex_index;
        }
        return vertex_pos_to_vertex_index_x_y[p.x][p.y];
    }

    for (const { p1, p2 } of edge_array) {
        const p1_idx = store_vertex_return_vertex_index(p1);
        const p2_idx = store_vertex_return_vertex_index(p2);
        edge_indices.push([p1_idx, p2_idx]);
    }

    console.log(`From ${edge_indices.length * 2} vertices to ${vertices.length} vertices.`);

    return { vertices, edge_indices };
}


function _test_fn() {
    const { data, spawns } = map_data("winter_inn");
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

    // remove doubles:
    // cube (check for self-matching):
    horizontal_edges.push({ p1: { x: 0, y: -190 }, p2: { x: 10, y: -190 } });
    horizontal_edges.push({ p1: { x: 0, y: -200 }, p2: { x: 10, y: -200 } });
    vertical_edges.push({ p1: { x: 0, y: -200 }, p2: { x: 0, y: -190 } });
    vertical_edges.push({ p1: { x: 10, y: -200 }, p2: { x: 10, y: -190 } });

    const edges = intersect_and_cut(horizontal_edges, vertical_edges);
    const { vertices, edge_indices } = remove_doubles(edges);

    const fs = require("fs");
    const { to_waveform_obj } = require("./waveform_obj_import_export");

    const as_waveform = to_waveform_obj(vertices, edge_indices, "AdventureLandMapData");
    fs.writeFileSync("output_data.obj", as_waveform, { encoding: "utf8" })
}

module.exports = { remove_doubles };
