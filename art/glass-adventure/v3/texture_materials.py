"""Sample inspected Meshy paint regions onto final faces without changing geometry.

Run in Blender. Both meshes must use the SAME source normalization transform.
This transfers material labels, not UVs or baked reflections. Explicit reviewed
sRGB swatches and rejection limits are mandatory; ambiguous faces stay unresolved.
"""
import math

import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from mathutils.geometry import barycentric_transform


def _chroma(rgb):
    return rgb / max(float(np.sum(rgb)), .001)


def _texture(source, material_index, images):
    material = source.data.materials[material_index]
    shader = next((node for node in material.node_tree.nodes
                   if node.type == 'BSDF_PRINCIPLED'), None)
    if shader is None or not shader.inputs['Base Color'].is_linked:
        raise ValueError(f'{source.name}: expected inspected textured Principled base color')
    color_link = shader.inputs['Base Color'].links[0]
    node = color_link.from_node
    if node.type != 'TEX_IMAGE' or color_link.from_socket.name != 'Color' or not node.image:
        raise ValueError('Only a direct source color image is supported; inspect shader mapping')
    if node.image.colorspace_settings.name != 'sRGB' or node.image.is_float:
        raise ValueError('Source paint must be an inspected byte image declared sRGB')
    uv = next((layer for layer in source.data.uv_layers if layer.active_render), None)
    if node.inputs['Vector'].is_linked:
        mapping = node.inputs['Vector'].links[0].from_node
        if mapping.type != 'UVMAP':
            raise ValueError('Source texture has an unsupported coordinate transform')
        uv = source.data.uv_layers.get(mapping.uv_map)
    if uv is None or node.extension not in ('REPEAT', 'EXTEND'):
        raise ValueError('Expected an explicit source UV layer with repeat/clamp sampling')
    if node.image not in images:
        width, height = node.image.size
        if not width or not height:
            raise ValueError('Source image is not decoded')
        pixels = np.empty(width * height * 4, dtype=np.float32)
        node.image.pixels.foreach_get(pixels)
        images[node.image] = pixels.reshape(height, width, 4)
    return uv, images[node.image], node.extension


def _sample(pixels, uv, extension):
    # Blender byte-image pixels retain encoded sRGB and use a bottom-left origin.
    height, width, _ = pixels.shape
    uv = np.asarray(uv, dtype=float)
    if extension == 'REPEAT':
        uv %= 1
    else:
        uv = np.clip(uv, 0, 1)
    point = uv * (width, height) - .5
    lo = np.floor(point).astype(int)
    blend = point - lo
    indices = [(lo[0], lo[1]), (lo[0]+1, lo[1]),
               (lo[0], lo[1]+1), (lo[0]+1, lo[1]+1)]
    samples = []
    for x, y in indices:
        if extension == 'REPEAT':
            x, y = x % width, y % height
        else:
            x, y = np.clip(x, 0, width-1), np.clip(y, 0, height-1)
        samples.append(pixels[y, x])
    lower = samples[0] * (1-blend[0]) + samples[1] * blend[0]
    upper = samples[2] * (1-blend[0]) + samples[3] * blend[0]
    rgba = lower * (1-blend[1]) + upper * blend[1]
    return np.clip(rgba[:3], 0, 1), float(rgba[3])


def classify_faces(target, sources, *, gold_srgb_samples, glass_srgb_samples,
                   max_distance, min_margin, max_chroma_distance):
    """Return face labels and diagnostics; never mutate target, source, UV or material.

    Samples are reviewed source-image colors in sRGB 0..1. Limits are explicit:
    maximum correspondence distance in world metres, nearest-class chromaticity
    distance and the required margin from the competing class. Low-confidence
    samples are unresolved. Update the view layer after changing transforms.
    Inspect a diagnostic render before assigning labels.
    """
    limits = (max_distance, min_margin, max_chroma_distance)
    if not all(math.isfinite(value) and value > 0 for value in limits):
        raise ValueError('Supply positive finite inspected distance/margin limits')
    if target.type != 'MESH' or not target.data.polygons:
        raise ValueError('Expected a nonempty final mesh')
    prototypes = []
    for values in (glass_srgb_samples, gold_srgb_samples):
        array = np.asarray(values, dtype=float)
        if array.ndim != 2 or array.shape[1] != 3 or not len(array):
            raise ValueError('Both classes need reviewed RGB swatches')
        if not np.all(np.isfinite(array)) or np.any((array < 0) | (array > 1)):
            raise ValueError('Source swatches must be sRGB 0..1')
        prototypes.append(np.array([_chroma(rgb) for rgb in array]))
    separation = min(np.linalg.norm(a-b) for a in prototypes[0] for b in prototypes[1])
    if separation <= min_margin:
        raise ValueError('Reviewed swatches overlap; inspect or author ambiguous regions')
    positions, triangles, metadata, images = [], [], [], {}
    for source in sources:
        if source.type != 'MESH':
            raise ValueError('Sources must be mesh objects')
        mesh = source.data
        mesh.calc_loop_triangles()
        offset = len(positions)
        positions.extend(source.matrix_world @ vertex.co for vertex in mesh.vertices)
        textures = {}
        for face in mesh.loop_triangles:
            if face.material_index not in textures:
                textures[face.material_index] = _texture(source, face.material_index, images)
            layer, pixels, extension = textures[face.material_index]
            triangles.append(tuple(offset + index for index in face.vertices))
            uv = tuple(Vector((*layer.data[index].uv, 0)) for index in face.loops)
            metadata.append((uv, pixels, extension))
    if not triangles:
        raise ValueError('No textured source triangles')
    tree = BVHTree.FromPolygons(positions, triangles, all_triangles=True)
    rows = []
    for face in target.data.polygons:
        centre = sum((target.matrix_world @ target.data.vertices[index].co
                      for index in face.vertices), Vector()) / len(face.vertices)
        point, _, triangle, distance = tree.find_nearest(centre)
        if triangle is None:
            raise ValueError('No nearest donor triangle')
        uv, pixels, extension = metadata[triangle]
        projected = barycentric_transform(point, *[positions[i] for i in triangles[triangle]], *uv)
        rgb, alpha = _sample(pixels, projected.xy, extension)
        distances = [float(np.linalg.norm(group - _chroma(rgb), axis=1).min())
                     for group in prototypes]
        winner = int(distances[1] < distances[0])
        margin = abs(distances[1] - distances[0])
        reasons = []
        if distance > max_distance:
            reasons.append('outside-source-distance')
        if alpha < .5 or max(rgb) < .025:
            reasons.append('unusable-source-pixel')
        if min(distances) > max_chroma_distance or margin < min_margin:
            reasons.append('ambiguous-source-color')
        rows.append({'face': face.index, 'material': None if reasons else
                     ('glass_shell', 'gold_trim')[winner], 'sourceRgbSrgb': rgb.tolist(),
                     'sourceTriangle': int(triangle), 'distanceMetres': float(distance),
                     'classMargin': margin, 'nearestClassDistance': min(distances),
                     'reasons': reasons})
    distances = [row['distanceMetres'] for row in rows]
    return {'status': 'region audition; inspect physical-material proof before acceptance',
            'swatchesSrgb': {'glass': glass_srgb_samples, 'gold': gold_srgb_samples},
            'limits': {'maxDistanceMetres': max_distance, 'minMargin': min_margin,
                       'maxChromaDistance': max_chroma_distance},
            'counts': {name: sum(row['material'] == name for row in rows)
                       for name in ('glass_shell', 'gold_trim', None)},
            'distanceMetres': {'max': max(distances), 'p95': float(np.quantile(distances, .95))},
            'faces': rows, 'geometryChanged': False}


def apply_face_labels(target, report, materials):
    """Assign reviewed complete labels atomically; caller owns physical material creation."""
    rows = report['faces']
    if len(rows) != len(target.data.polygons) or any(row['face'] != i for i, row in enumerate(rows)):
        raise ValueError('Face labels no longer match target topology')
    labels = [row['material'] for row in rows]
    if any(label not in materials or materials[label] is None for label in labels):
        raise ValueError('Resolve every ambiguous face and provide real physical materials first')
    names = list(materials)
    target.data.materials.clear()
    for name in names:
        target.data.materials.append(materials[name])
    for face, label in zip(target.data.polygons, labels):
        face.material_index = names.index(label)
