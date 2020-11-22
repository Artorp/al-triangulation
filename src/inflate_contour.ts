import { add_points_2d, distance_2d, dot_product_2d, normalize, rot90, subtract_points_2d } from "./geometry";
import { Point } from "./geometry_types";
import { intersect_and_cut, xylines_to_edges } from "./map_to_polygons";
import { remove_doubles } from "./remove_doubles";
import { contours_into_vert_edge_list, detect_contours } from "./detect_contours";

/**
 * Inflate previously generated contours
 *
 * @param contours
 * @returns
 */
function inflate_contours(contours: Point[][]): Point[][] {

    console.log("Inflating...");
    const inflated_contours = [];
    for (const contour of contours) {
        // console.log(`Input length: ${contour.length} vertices.`);
        const generated_contour: Point[] = [];
        for (let i = 0; i < contour.length; i++) {
            const v0_idx = i;
            const v1_idx = (i + 1) % contour.length;
            const v2_idx = (i + 2) % contour.length;
            const v0 = contour[v0_idx];
            const v1 = contour[v1_idx];
            const v2 = contour[v2_idx];

            generated_contour.push(...create_inflated_points_by_vertices(v0, v1, v2));

        }

        // check if any two vertices were moved to the same position
        let remove_count = 0;
        for (let i = generated_contour.length - 1; i >= 0; i--) {
            const v0_idx = i;
            const v1_idx = (i + 1) % generated_contour.length;
            const v0 = generated_contour[v0_idx];
            const v1 = generated_contour[v1_idx];
            if (distance_2d(v0, v1) < 0.0001) {
                generated_contour.splice(i, 1);
                remove_count++;
            }
        }

        // console.log(`Output length: ${generated_contour.length} vertices. Removed ${remove_count} vertices after inflating.`);
        // v0, v1, v2 -> new vertices
        // v13, v0, v1 -> final vertices
        inflated_contours.push(generated_contour);

    }
    console.log("Done inflating.");
    return inflated_contours;
}

/**
 * Given three consecutive points of a contour, generate one or two inflated points depending on if the points
 * turn left, right, or form a straight path
 *
 * @param v1
 * @param v2
 * @param v3
 */
function create_inflated_points_by_vertices(v1: Point, v2: Point, v3: Point): Point[] {
    // create contours for v2 vertex
    const new_points: Point[] = [];
    // calculate normal vector for both
    const n1 = rot90(normalize(subtract_points_2d(v2, v1)));
    const n2 = rot90(normalize(subtract_points_2d(v3, v2)));
    const dot = dot_product_2d(n1, n2);
    //console.log(n1, n2, "dot:", dot);
    if (dot > 0.5) {
        // collinear
        // console.log("collinear")
        // normals are the same, vertices are collinear, only need to move once
        const next_v1 = move_by_normal(v2, n1);
        new_points.push(next_v1);
    } else if (dot < -0.5) {
        // 180 degree angle, and requires two new vertices
        // console.log("requires both")
        const n_halfway = rot90(n2);
        const next_v1 = move_by_normals(v2, n1, n_halfway);
        const next_v2 = move_by_normals(v2, n_halfway, n2);
        new_points.push(next_v1, next_v2);
    } else {
        // regular angle, move by both
        // console.log("regular angle")
        const next_v1 = move_by_normals(v2, n1, n2);
        new_points.push(next_v1);
    }

    return new_points;
}

/**
 * Move a vertex in two directions given by two normal vectors, used for bends and turns
 *
 * @param v vertex to move
 * @param n1 first normal direction
 * @param n2 second normal direction
 */
function move_by_normals(v: Point, n1: Point, n2: Point): Point {
    const d1 = direction_to_char_offset(n1);
    const d2 = direction_to_char_offset(n2);
    return add_points_2d(add_points_2d(v, d1), d2);
}

/**
 * Move a vertex in one direction as given by one normal vector, used by straight paths
 *
 * @param v vertex to move
 * @param n1 normal direction
 */
function move_by_normal(v: Point, n1: Point): Point {
    const d = direction_to_char_offset(n1);
    return add_points_2d(v, d);
}

/**
 * Converts a cardinal direction to the proper offset to account for character collision dimensions
 *
 * @param direction a normalized (unit length) direction vector
 */
function direction_to_char_offset(direction: Point): Point {
    // TODO: get programmatically?
    const h_offset = 8; // from character.base.h, how much to move walls left or right
    const v_down_offset = 7; // from character.base.v // downwards (increase y)
    const v_up_offset = 2; // from character.base.vn  // upwards (decrease y)
    // 2 pixels up, 7 pixels down

    const { x, y } = direction;
    if (x < -0.5) {
        return { x: -h_offset, y: 0 };
    } else if (x > 0.5) {
        return { x: h_offset, y: 0 };
    } else if (y < -0.5) {
        return { x: 0, y: -v_up_offset };
    } else {
        return { x: 0, y: v_down_offset };
    }
}


async function _test_fn() {
    const { load_map_data } = await import("./load_map_data");
    const { data, spawns } = load_map_data("winter_inn");
    const spawn_pos = { x: spawns[0][0], y: spawns[0][1] };
    const [horizontal_edges, vertical_edges] = xylines_to_edges(data);
    console.log(`${horizontal_edges.length} horizontal edges and ${vertical_edges.length} vertical edges`);

    // Test example, single line that is inflated by two vertices:
    horizontal_edges.push({ p1: { x: 150, y: -20 }, p2: { x: 220, y: -20 } });


    // Test example, handle single horiz line poly:
    horizontal_edges.push({ p1: { x: 20, y: -20 }, p2: { x: 50, y: -20 } });

    // Test example, handle two horiz line poly:
    horizontal_edges.push({ p1: { x: 100, y: -20 }, p2: { x: 120, y: -20 } });
    horizontal_edges.push({ p1: { x: 120, y: -20 }, p2: { x: 140, y: -20 } });

    // find all intersections, build graph

    const edges = intersect_and_cut(horizontal_edges, vertical_edges);
    const { vertices, edge_indices } = remove_doubles(edges);

    const contours = detect_contours(vertices, edge_indices, spawn_pos);
    const inflated_contours = inflate_contours(contours);
    const { vertices: v2, edge_indices: e2 } = contours_into_vert_edge_list(inflated_contours);

    const fs = require("fs");
    const { to_waveform_obj } = require("./waveform_obj_import_export");

    const as_waveform = to_waveform_obj(v2, e2, "AdventureLandMapData");
    fs.writeFileSync("output_data.obj", as_waveform, { encoding: "utf8" });
}

export { inflate_contours };
