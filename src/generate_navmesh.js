const { fill_quads_and_remove_doubles } = require("./contours_to_quads");
const { contours_raycast_edges } = require("./contours_to_quads");
const { contours_into_horiz_vert_edge_list } = require("./detect_contours");
const { detect_contours } = require("./detect_contours");
const { inflate_contours } = require("./inflate_contour");
const { contours_remove_unused_verts } = require("./detect_contours");
const { remove_doubles } = require("./remove_doubles");
const { intersect_and_cut } = require("./map_to_polygons");
const { xylines_to_edges } = require("./map_to_polygons");


/**
 * @typedef {import("./al_jsdoc_types").MapData} MapData
 * @typedef {import("./geometry_types").Point} Point
 * @typedef {import("./geometry_types").Edge} Edge
 * */


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
function generate_navmesh(map_data, from_position) {
    const [horizontal_edges, vertical_edges] = xylines_to_edges(map_data);
    const edges = intersect_and_cut(horizontal_edges, vertical_edges);
    const { vertices, edge_indices } = remove_doubles(edges);
    const contours = contours_remove_unused_verts(detect_contours(vertices, edge_indices, from_position));
    const inflated_overlapping_contours = inflate_contours(contours);
    const [horizontal_edges2, vertical_edges2] = contours_into_horiz_vert_edge_list(inflated_overlapping_contours);
    const inflated_edges = intersect_and_cut(horizontal_edges2, vertical_edges2);
    const { vertices: vertices2, edge_indices: edge_indices2 } = remove_doubles(inflated_edges);
    const inflated_contours = contours_remove_unused_verts(detect_contours(vertices2, edge_indices2, from_position));
    const { cut_contours, internal_edges_cut } = contours_raycast_edges(inflated_contours);
    const { vertices: v2, edge_indices: e2, faces } = fill_quads_and_remove_doubles(cut_contours, internal_edges_cut);

    return { vertices: v2, edge_indices: e2, faces };
}

module.exports = { generate_navmesh };
