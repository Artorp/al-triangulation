/**
 *
 * @param {string} mapname
 * @returns {{data: MapData, spawns: [number, number][]}}
 */
function map_data(mapname){
    return require(`./map_data/${mapname}.json`);
}

module.exports = { map_data };
