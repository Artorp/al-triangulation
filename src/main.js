const fs = require("fs");
const { to_waveform_obj } = require("./waveform_obj_import_export");
const { intersect_and_cut, xylines_to_edges } = require("./map_to_polygons");
const { remove_doubles } = require("./remove_doubles");
const { detect_contours, contours_into_vert_edge_list, contours_into_horiz_vert_edge_list } = require("./detect_contours");
const { inflate_contours } = require("./inflate_contour");

function perform_inflation_and_contouring(map_name, map_data, map_spawns) {
    const spawn_pos = [map_spawns[0][0], map_spawns[0][1]];
    const [horizontal_edges, vertical_edges] = xylines_to_edges(map_data);
    console.log(`${horizontal_edges.length} horizontal edges and ${vertical_edges.length} vertical edges`);

    // find all intersections, build graph

    const edges = intersect_and_cut(horizontal_edges, vertical_edges);
    const [vertices, edge_indices] = remove_doubles(edges);

    const contours = detect_contours(vertices, edge_indices, spawn_pos);

    const inflated_contours = inflate_contours(contours);

    // intersect and cut the inflated topology
    const [horizontal_edges2, vertical_edges2] = contours_into_horiz_vert_edge_list(inflated_contours);
    const inflated_edges = intersect_and_cut(horizontal_edges2, vertical_edges2);

    const [vertices2, edge_indices2] = remove_doubles(inflated_edges);

    const sanitized_inflated_contours = detect_contours(vertices2, edge_indices2, spawn_pos);

    const [v2, e2] = contours_into_vert_edge_list(sanitized_inflated_contours);

    const as_waveform = to_waveform_obj(v2, e2, "AdventureLandMapData");
    fs.writeFileSync(`../output_waveform_objs/${map_name}.obj`, as_waveform, { encoding: "utf8" });
}

const { data, spawns } = require("./map_data/winter_inn.json");

perform_inflation_and_contouring("winter_inn", data, spawns);
