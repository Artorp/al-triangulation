const fs = require("fs");
const { map_data } = require("./import_map_data");
const { to_waveform_obj, to_waveform_obj_w_faces } = require("./waveform_obj_import_export");
const { intersect_and_cut, xylines_to_edges, edges_to_edge_vert_list } = require("./map_to_polygons");
const { remove_doubles } = require("./remove_doubles");
const { detect_contours, contours_remove_unused_verts, contours_into_vert_edge_list, contours_into_horiz_vert_edge_list } = require("./detect_contours");
const { inflate_contours } = require("./inflate_contour");
const { contours_raycast_edges, fill_quads_and_remove_doubles } = require("./contours_to_quads");
const { Performance } = require("./performance");


/**
 * @typedef {import("./al_jsdoc_types").MapData} MapData
 * */


/**
 *
 * @param {string} map_name
 * @param {MapData} map_data
 * @param {[number, number][]} map_spawns
 */
function perform_inflation_and_contouring(map_name, map_data, map_spawns) {

    const perf = new Performance();
    perf.start();
    const spawn_pos = { x: map_spawns[0][0], y: map_spawns[0][1] };
    const [horizontal_edges, vertical_edges] = xylines_to_edges(map_data);
    perf.stopAndPrint("Converting edges");
    console.log(`${horizontal_edges.length} horizontal edges and ${vertical_edges.length} vertical edges`);

    // find all intersections, build graph

    perf.start();
    const edges = intersect_and_cut(horizontal_edges, vertical_edges);

    perf.stopAndPrint("Intersect and cut");
    perf.start();
    const { vertices, edge_indices } = remove_doubles(edges);
    perf.stopAndPrint("Remove doubles");

    perf.start();
    const contours = contours_remove_unused_verts(detect_contours(vertices, edge_indices, spawn_pos));
    perf.stopAndPrint("Contour 1");

    perf.start();
    const inflated_overlapping_contours = inflate_contours(contours);
    perf.stopAndPrint("Inflate contours");

    // intersect and cut the inflated topology
    perf.start();
    const [horizontal_edges2, vertical_edges2] = contours_into_horiz_vert_edge_list(inflated_overlapping_contours);
    perf.stopAndPrint("Convert contours into edge list");
    perf.start();
    const inflated_edges = intersect_and_cut(horizontal_edges2, vertical_edges2);
    perf.stopAndPrint("Intersect and cut inflated edges");

    perf.start();
    const { vertices: vertices2, edge_indices: edge_indices2 } = remove_doubles(inflated_edges);
    perf.stopAndPrint("Removing doubles 2");

    perf.start();
    const inflated_contours = contours_remove_unused_verts(detect_contours(vertices2, edge_indices2, spawn_pos));
    perf.stopAndPrint("Detecting inflated contours");

    perf.start();
    const { cut_contours, internal_edges_cut } = contours_raycast_edges(inflated_contours);
    const { vertices: v2, edge_indices: e2, faces } = fill_quads_and_remove_doubles(cut_contours, internal_edges_cut);
    perf.stopAndPrint("Create edges on walkable space and fill with quads");

    const as_waveform = to_waveform_obj_w_faces(v2, e2, faces, "AdventureLandMapData");
    fs.writeFileSync(`../output_waveform_objs/${map_name}.obj`, as_waveform, { encoding: "utf8" });
}

const process_map = "winter_inn";
const { data, spawns } = map_data(process_map);

perform_inflation_and_contouring(process_map, data, spawns);
