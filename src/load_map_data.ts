import { MapData } from "./al_jsdoc_types";
import fs from "fs";

export type MapJsonData = { name: string, data: MapData, spawns: [number, number][] };

function load_map_data(mapname: string): MapJsonData {
    const file_contents_json = fs.readFileSync(`./map_data/${mapname}.json`, { encoding: "utf8" });
    return JSON.parse(file_contents_json);
}

export { load_map_data };
