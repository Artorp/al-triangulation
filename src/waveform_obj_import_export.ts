import { Point } from "./geometry";

function to_waveform_obj(
    vertices: Point[],
    edge_indices: [number, number][],
    object_name: string
): string {
    let waveform_data = `o ${object_name}\n`;
    for (const { x, y } of vertices) {
        waveform_data += `v ${x} ${y} 0\n`;
    }
    for (const [v0, v1] of edge_indices) {
        waveform_data += `l ${v0 + 1} ${v1 + 1}\n`;
    }
    return waveform_data;
}

function to_waveform_obj_w_faces(
    vertices: Point[],
    edge_indices: [number, number][],
    faces: [number, number, number, number][],
    object_name: string
): string {
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


export {
    to_waveform_obj, to_waveform_obj_w_faces
};
