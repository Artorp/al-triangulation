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

/**
 *
 * @param {Point[]} vertices
 * @param {[number, number][]} edge_indices
 * @param {[number, number, number, number][]} faces
 * @param {string} object_name
 * @returns {string}
 */
function to_waveform_obj_w_faces(vertices, edge_indices, faces, object_name) {
    let waveform_data = `o ${object_name}\n`;
    for (const { x, y } of vertices) {
        waveform_data += `v ${x} ${y} 0\n`;
    }
    for (const [v0, v1] of edge_indices) {
        waveform_data += `l ${v0 + 1} ${v1 + 1}\n`;
    }
    for (const [v0, v1, v2, v3] of faces) {
        waveform_data += `f ${v0 + 1} ${v1 + 1} ${v2 + 1} ${v3 + 1}\n`;
    }
    return waveform_data;
}


module.exports = {
    to_waveform_obj, to_waveform_obj_w_faces
};
