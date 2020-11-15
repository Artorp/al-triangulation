const { intersect_and_cut, xylines_to_edges } = require("./map_to_polygons");
const { remove_doubles } = require("./remove_doubles");
const { intersect_lines, line_point_pair_to_offset, subtract_points_2d, distance_2d, cross_product_2d, normalize, dot_product_2d, angle_between, vertices_equal, midpoint, multiply_scalar_2d, rot90, add_points_2d } = require("./geometry");
const { detect_contours, contours_into_vert_edge_list } = require("./detect_contours");


function inflate_contours(contours) {

    console.log("Inflating...");
    const inflated_contours = [];
    for (const contour of contours) {
        console.log(`Input length: ${contour.length} vertices.`);
        const generated_contour = [];
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

        console.log(`Output length: ${generated_contour.length} vertices. Removed ${remove_count} vertices after inflating.`);
        // v0, v1, v2 -> new vertices
        // v13, v0, v1 -> final vertices
        inflated_contours.push(generated_contour);

    }
    console.log("Done inflating.");
    return inflated_contours;
}


function create_inflated_points_by_vertices(v1, v2, v3) {
    // create contours for v2 vertex
    const new_points = [];
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

function move_by_normals(v, n1, n2) {
    const d1 = direction_to_char_offset(n1);
    const d2 = direction_to_char_offset(n2);
    return add_points_2d(add_points_2d(v, d1), d2);
}

function move_by_normal(v, n1) {
    const d = direction_to_char_offset(n1);
    return add_points_2d(v, d);
}

function direction_to_char_offset(direction) {
    // TODO: get programmatically?
    const h_offset = 8; // from character.base.h, how much to move walls left or right
    const v_down_offset = 7; // from character.base.v // downwards (increase y)
    const v_up_offset = 2; // from character.base.vn  // upwards (decrease y)
    // 2 pixels up, 7 pixels down

    const [x, y] = direction;
    if (x < -0.5) {
        return [-h_offset, 0];
    } else if (x > 0.5) {
        return [h_offset, 0];
    } else if (y < -0.5) {
        return [0, -v_up_offset];
    } else {
        return [0, v_down_offset];
    }
}


function test_fn() {
    const { data, spawns } = require("./map_data/winter_inn.json");
    const spawn_pos = [spawns[0][0], spawns[0][1]];
    const [horizontal_edges, vertical_edges] = xylines_to_edges(data);
    console.log(`${horizontal_edges.length} horizontal edges and ${vertical_edges.length} vertical edges`);

    // Test example, single line that is inflated by two vertices:
    horizontal_edges.push([[150, -20], [220, -20]]);


    // Test example, handle single horiz line poly:
    horizontal_edges.push([[20, -20], [50, -20]]);

    // Test example, handle two horiz line poly:
    horizontal_edges.push([[100, -20], [120, -20]]);
    horizontal_edges.push([[120, -20], [140, -20]]);

    // find all intersections, build graph

    const edges = intersect_and_cut(horizontal_edges, vertical_edges);
    const [vertices, edge_indices] = remove_doubles(edges);

    const contours = detect_contours(vertices, edge_indices, spawn_pos);
    const inflated_contours = inflate_contours(contours);
    const [v2, e2] = contours_into_vert_edge_list(inflated_contours);

    const fs = require("fs");
    const { to_waveform_obj } = require("./waveform_obj_import_export");

    const as_waveform = to_waveform_obj(v2, e2, "AdventureLandMapData");
    fs.writeFileSync("output_data.obj", as_waveform, { encoding: "utf8" });
}

module.exports = { inflate_contours };
