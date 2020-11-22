import { MapData } from "./al_jsdoc_types";
import { intersect_and_cut, xylines_to_edges } from "./map_to_polygons";
import { remove_doubles } from "./remove_doubles";
import { contours_into_horiz_vert_edge_list, detect_contours } from "./detect_contours";
import { inflate_contours } from "./inflate_contour";
import { contours_raycast_edges, fill_quads_and_remove_doubles } from "./contours_to_quads";
import { Point } from "./geometry";


/**
 * Generate navigation mesh based on xlines and ylines from map data. The from_position map position is used as
 * the reference point for which areas separated by walls are defined as walkable or not.
 *
 * @param {MapData} map_data the map data from G.maps[<map_name>].data
 * @param {Point} from_position a reference position used to define walkable areas
 * @returns {{vertices: Point[], edge_indices: number[][], faces: number[][]}}
 *     vertices: a list of points,
 *     edge_indices: two-item tuple of indices into vertices that defines edges,
 *     faces: four-item tuple of indices into vertices that defines faces in ccw order
 */
function generate_navmesh(
    map_data: MapData,
    from_position: Point
): { vertices: Point[], edge_indices: [number, number][], faces: [number, number, number, number][] } {
    const [horizontal_edges, vertical_edges] = xylines_to_edges(map_data);
    const edges = intersect_and_cut(horizontal_edges, vertical_edges);
    const { vertices, edge_indices } = remove_doubles(edges);
    const contours = detect_contours(vertices, edge_indices, from_position);
    const inflated_overlapping_contours = inflate_contours(contours);
    const [horizontal_edges2, vertical_edges2] = contours_into_horiz_vert_edge_list(inflated_overlapping_contours);
    const inflated_edges = intersect_and_cut(horizontal_edges2, vertical_edges2);
    const { vertices: vertices2, edge_indices: edge_indices2 } = remove_doubles(inflated_edges);
    const inflated_contours = detect_contours(vertices2, edge_indices2, from_position);
    const { cut_contours, internal_edges_cut } = contours_raycast_edges(inflated_contours);
    const { vertices: v2, edge_indices: e2, faces } = fill_quads_and_remove_doubles(cut_contours, internal_edges_cut);

    return { vertices: v2, edge_indices: e2, faces };
}

export { generate_navmesh };
