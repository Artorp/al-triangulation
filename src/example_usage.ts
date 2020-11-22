import { MapData } from "./al_jsdoc_types";
import { Perf } from "./performance";
import { intersect_and_cut, xylines_to_edges } from "./map_to_polygons";
import { remove_doubles } from "./remove_doubles";
import { contours_into_horiz_vert_edge_list, detect_contours } from "./detect_contours";
import { contours_raycast_edges, fill_quads_and_remove_doubles } from "./contours_to_quads";
import { to_waveform_obj_w_faces } from "./waveform_obj_import_export";
import { load_map_data } from "./load_map_data";
import fs from "fs";
import { inflate_contours } from "./inflate_contour";


function perform_inflation_and_contouring(map_name: string, map_data: MapData, map_spawns: [number, number][]) {

    const perf = new Perf();
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
    const contours = detect_contours(vertices, edge_indices, spawn_pos);
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
    const inflated_contours = detect_contours(vertices2, edge_indices2, spawn_pos);
    perf.stopAndPrint("Detecting inflated contours");

    perf.start();
    const { cut_contours, internal_edges_cut } = contours_raycast_edges(inflated_contours);
    const { vertices: v2, edge_indices: e2, faces } = fill_quads_and_remove_doubles(cut_contours, internal_edges_cut);
    perf.stopAndPrint("Create edges on walkable space and fill with quads");

    const as_waveform = to_waveform_obj_w_faces(v2, e2, faces, "AdventureLandMapData");
    fs.writeFileSync(`../output_waveform_objs/${map_name}.obj`, as_waveform, { encoding: "utf8" });
}

const process_map = "winter_inn";
const { data, spawns } = load_map_data(process_map);

perform_inflation_and_contouring(process_map, data, spawns);
