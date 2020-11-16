/**
 *
 * @param {Point[]} vertices
 * @param {[number, number][]} edge_indices
 * @param {string} object_name
 * @returns {string}
 */
function to_waveform_obj(vertices, edge_indices, object_name) {
    let waveform_data = `o ${object_name}\n`;
    for (const { x, y } of vertices) {
        waveform_data += `v ${x} ${y} 0\n`;
    }
    for (const [v0, v1] of edge_indices) {
        waveform_data += `l ${v0 + 1} ${v1 + 1}\n`;
    }
    return waveform_data;
}


module.exports = {
    to_waveform_obj
};
