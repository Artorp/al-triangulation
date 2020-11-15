const { intersect_and_cut, xylines_to_edges } = require("./map_to_polygons");

// after cutting at all intersections, remove doubles and build polygon meshes

// for now, ignore winding order


function remove_doubles(edge_array) {
    // edges is a list of horizontal and vertical edges, each edge is a list of two vertices,
    // and each vertex is a list of an x-value and y-value.
    // The vertices inside each edge is ordered s.t. the first vertex has a smaller x- or y-value than the second.

    // convert to vertex array and edge indices array
    const vertices = [];
    const edge_indices = [];
    for (const [v0, v1] of edge_array) {
        vertices.push(v0);
        let len = vertices.push(v1);
        edge_indices.push([len - 2, len - 1]);
    }
    console.log("Removing doubles...")
    console.log(`Before: ${vertices.length} vertices and ${edge_indices.length} edges`);

    // for each vertex, find all other vertices at same location, and merge vertices
    const vertices_match = (v0, v1) => v0[0] === v1[0] && v0[1] === v1[1];
    const original_vertex_length = vertices.length;
    for (let i = vertices.length - 1; i >= 0; i--) {
        const v = vertices[i];
        if (v == null) continue;
        delete vertices[i];
        const matches = []; // indices only
        for (let j = original_vertex_length - 1; j >= 0; j--) {
            const v1 = vertices[j];
            if (v1 == null) continue;
            if (vertices_match(v, v1)) {
                matches.push(j)
                delete vertices[j];
            }
        }
        const same_vertices = [i, ...matches];
        // merge all matches
        const next_idx = vertices.push(v) - 1;
        for (let j = 0; j < edge_indices.length; j++) {
            let [idx_a, idx_b] = edge_indices[j];
            // assume no zero-length edges
            if (same_vertices.indexOf(idx_a) !== -1) {
                edge_indices[j] = [next_idx, idx_b];
            } else if (same_vertices.indexOf(idx_b) !== -1) {
                edge_indices[j] = [idx_a, next_idx];
            }
        }
    }

    // remove all original vertex entries (which should now all be deleted) and offset indices by the correct amount
    vertices.splice(0, original_vertex_length);
    for (let i = 0; i < edge_indices.length; i++) {
        edge_indices[i][0] -= original_vertex_length;
        edge_indices[i][1] -= original_vertex_length;
        edge_indices[i].reverse();
    }
    edge_indices.reverse();

    console.log(`After: ${vertices.length} vertices and ${edge_indices.length} edges`);

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
    vertical_edges.push([[0, -20], [0, -10]], [[0, -40], [0, -10]])

    // V-E:
    horizontal_edges.push([[0, -80], [10, -80]]);
    vertical_edges.push([[0, -90], [0, -70]])

    // E-E crossing:
    horizontal_edges.push([[-10, -120], [10, -120]]);
    vertical_edges.push([[0, -130], [0, -110]])

    // remove doubles:
    // cube (check for self-matching):
    horizontal_edges.push([[0, -190], [10, -190]]);
    horizontal_edges.push([[0, -200], [10, -200]]);
    vertical_edges.push([[0, -200], [0, -190]])
    vertical_edges.push([[10, -200], [10, -190]])

    const edges = intersect_and_cut(horizontal_edges, vertical_edges);
    const [vertices, edge_indices] = remove_doubles(edges);
    //
    const fs = require("fs");
    const { to_waveform_obj } = require("./waveform_obj_import_export");

    const as_waveform = to_waveform_obj(vertices, edge_indices, "AdventureLandMapData");
    fs.writeFileSync("output_data.obj", as_waveform, { encoding: "utf8" })
}

module.exports = { remove_doubles };
