const fs = require("fs");

/**
 *
 * @param {string} mapname
 * @returns {{data: MapData, spawns: [number, number][]}}
 */
function map_data(mapname){
    const file_contents_json = fs.readFileSync(`./map_data/${mapname}.json`, { encoding: "utf8" });
    return JSON.parse(file_contents_json);
}

module.exports = { map_data };
