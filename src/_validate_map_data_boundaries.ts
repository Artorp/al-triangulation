import path from "path";
import fs from "fs";
import { load_map_data } from "./load_map_data";
import { MapData } from "./al_jsdoc_types";

const ignore_maps = new Set<string>([
    "batcave",
    "d2",
    "dungeon0",
    "old_bank",
    "old_main",
    "original_main"
]);

for (const map_file of fs.readdirSync("./map_data")) {
    const map_name = map_file.split(".")[0];
    if (ignore_maps.has(map_name)) {
        console.log(`Ignoring map ${map_name}.`);
        continue;
    }
    console.log(`Checking ${map_name}...`);
    const { name, data, spawns } = load_map_data(map_name);
    checkBoundaries(name, data);
}


function checkBoundaries(name: string, data: MapData) {
    const { x_lines, y_lines, min_x, min_y, max_x, max_y } = data;

    const is_in_range = (val: number, lower: number, upper: number) =>
        lower <= val && val <= upper;

    for (const [x, y0, y1] of x_lines) {
        if (!is_in_range(x, min_x, max_x) || !(y0 >= min_y) || !(y1 <= max_y)) {
            console.log(`[${name}] Edge x_line ${[x, y0, y1]} in ${name} is outside map boundaries ${pprint(min_x, min_y, max_x, max_y)}`);
        }
    }
    for (const [y, x0, x1] of y_lines) {
        if (!is_in_range(y, min_y, max_y) || !(x0 >= min_x) || !(x1 <= max_x)) {
            console.log(`[${name}] Edge y_line ${[y, x0, x1]} in ${name} is outside map boundaries ${pprint(min_x, min_y, max_x, max_y)}`);
        }
    }
}


function pprint(min_x: number, min_y: number, max_x: number, max_y: number) {
    return `(${min_x}, ${min_y}), (${max_x}, ${max_y})`;
}
