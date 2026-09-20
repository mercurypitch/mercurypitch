"""Preserve the Meshy frame and give its inspected inset a reusable art material."""

import hashlib
import json
import tempfile
from pathlib import Path

import bmesh
import bpy
from mathutils import Vector

HERE = Path(__file__).resolve().parent


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def records_digest(records):
    encoded = json.dumps(records, separators=(',', ':'), sort_keys=True).encode()
    return hashlib.sha256(encoded).hexdigest()


def geometry_uv_records(mesh, faces):
    uv_data = mesh.uv_layers.active.data
    records = []
    for face in faces:
        records.append({
            'coordinates': [
                [float(mesh.vertices[index].co[axis]).hex() for axis in range(3)]
                for index in face.vertices
            ],
            'material': face.material_index,
            'uv': [
                [float(uv_data[index].uv[axis]).hex() for axis in range(2)]
                for index in face.loop_indices
            ],
        })
    return records


def uv_records(mesh):
    uv_data = mesh.uv_layers.active.data
    return sorted(
        [[
            [float(uv_data[index].uv[axis]).hex() for axis in range(2)]
            for index in face.loop_indices
        ] for face in mesh.polygons],
        key=repr,
    )


def run():
    source = HERE / 'sources/frame-imported.blend'
    bpy.ops.wm.open_mainfile(filepath=str(source))
    obj = next(o for o in bpy.context.scene.objects if o.type == 'MESH')
    material = obj.data.materials[0]
    material.name = 'meshy_gallery_frame_atlas'
    bsdf = next(n for n in material.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    image = bsdf.inputs['Base Color'].links[0].from_node.image
    pixels = list(image.pixels)
    width, height = image.size
    selected = []
    # The inspected donor has a dark petrol front inset. Classify only that
    # front-facing region; keep all original ornament, cabochons and back faces.
    for face in obj.data.polygons:
        if not (face.normal.y < -.95 and abs(face.center.x) < .43
                and -.82 < face.center.z < .81):
            continue
        uv = sum((obj.data.uv_layers.active.data[i].uv for i in face.loop_indices),
                 Vector((0, 0))) / len(face.loop_indices)
        index = (min(height - 1, int(uv.y * height)) * width
                 + min(width - 1, int(uv.x * width))) * 4
        rgb = pixels[index:index + 3]
        if rgb[2] > rgb[0] * .95 and max(rgb) < .5:
            selected.append(face)
    assert len(selected) == 55, 'Donor changed; inspect its inset again'
    selected_indices = {face.index for face in selected}
    selected_coordinates = {
        tuple(obj.data.vertices[index].co)
        for face in selected for index in face.vertices
    }
    # One opposite-facing donor cap uses only inset topology and projects
    # across the lower-right inset. Keep that donor triangle unchanged in the
    # ornament mesh, but place the continuous art surface just ahead of its
    # nearest point so it cannot punch through paintings or probe reflections.
    occluding_caps = [
        face for face in obj.data.polygons
        if face.index not in selected_indices
        and face.normal.y > .95
        and all(
            tuple(obj.data.vertices[index].co) in selected_coordinates
            for index in face.vertices
        )
    ]
    assert len(occluding_caps) == 1, (
        'Donor changed; inspect its overlapping inset cap again'
    )
    occluding_cap = occluding_caps[0]
    occluding_cap_source_face = occluding_cap.index
    occluding_cap_y_source = [
        obj.data.vertices[index].co.y for index in occluding_cap.vertices
    ]
    occluding_cap_front_y_source = min(
        occluding_cap_y_source
    )
    ornament_faces = [
        face for face in obj.data.polygons
        if face.index not in selected_indices
    ]
    ornament_records = geometry_uv_records(obj.data, ornament_faces)
    ornament_digest = records_digest(ornament_records)
    ornament_normals = [
        obj.data.corner_normals[index].vector.copy()
        for face in ornament_faces for index in face.loop_indices
    ]
    inset = bpy.data.materials.new('decor_surface')
    inset.use_nodes = True
    shader = next(n for n in inset.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    shader.inputs['Base Color'].default_value = (1, 1, 1, 1)
    shader.inputs['Roughness'].default_value = .44
    obj.data.materials.append(inset)
    coords = [obj.data.vertices[i].co.copy() for p in selected for i in p.vertices]
    lo = Vector(tuple(min(v[i] for v in coords) for i in range(3)))
    hi = Vector(tuple(max(v[i] for v in coords) for i in range(3)))
    for face in selected:
        face.material_index = 1
        for index in face.loop_indices:
            v = obj.data.vertices[obj.data.loops[index].vertex_index].co
            obj.data.uv_layers.active.data[index].uv = (
                .5 + ((v.x - lo.x) / (hi.x - lo.x) - .5)
                * ((hi.x - lo.x) / ((hi.z - lo.z) * (2 / 3))),
                (v.z - lo.z) / (hi.z - lo.z))
    inset_uvs = sorted([
        [[float(obj.data.uv_layers.active.data[index].uv[axis]).hex()
          for axis in range(2)] for index in face.loop_indices]
        for face in selected
    ], key=repr)
    bounds = [v.co.copy() for v in obj.data.vertices]
    centre = Vector(tuple((min(v[i] for v in bounds) + max(v[i] for v in bounds)) / 2
                          for i in range(3)))
    scale = 1.8 / (max(v.z for v in bounds) - min(v.z for v in bounds))

    # Split the classified inset before changing its geometry. Several donor
    # boundary vertices are shared with ornament faces, so editing them in
    # place would subtly deform the frame. Blender's separation preserves the
    # ornament polygon/UV stream byte-for-byte; its split normals are restored
    # below after the operator recalculates them.
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='DESELECT')
    editable = bmesh.from_edit_mesh(obj.data)
    editable.faces.ensure_lookup_table()
    for index in selected_indices:
        editable.faces[index].select = True
    bmesh.update_edit_mesh(obj.data, loop_triangles=False, destructive=False)
    bpy.ops.mesh.separate(type='SELECTED')
    bpy.ops.object.mode_set(mode='OBJECT')
    separated = [
        candidate for candidate in bpy.context.selected_objects
        if candidate.type == 'MESH'
    ]
    surface = next(
        candidate for candidate in separated
        if len(candidate.data.polygons) == len(selected)
    )
    assert obj in separated and len(obj.data.polygons) == 6910
    ornament_records_after = geometry_uv_records(obj.data, obj.data.polygons)
    ornament_preservation = {
        'sourceFaces': len(ornament_records),
        'finalFaces': len(ornament_records_after),
        'facesExact': [
            (len(record['coordinates']), record['material'])
            for record in ornament_records_after
        ] == [
            (len(record['coordinates']), record['material'])
            for record in ornament_records
        ],
        'coordinatesExact': [
            record['coordinates'] for record in ornament_records_after
        ] == [record['coordinates'] for record in ornament_records],
        'uvExact': [record['uv'] for record in ornament_records_after]
        == [record['uv'] for record in ornament_records],
    }
    assert all(
        ornament_preservation[key]
        for key in ('facesExact', 'coordinatesExact', 'uvExact')
    )

    obj.data.materials.pop(index=1)
    surface.data.materials.clear()
    surface.data.materials.append(inset)
    for face in surface.data.polygons:
        face.material_index = 0

    # The donor uses disconnected duplicate vertices even between neighboring
    # inset triangles. Plane and weld only this isolated child so the runtime
    # reflection has one continuous geometric surface. Per-loop UVs and all 55
    # donor triangles remain intact.
    surface_depth_clearance = .0005
    surface_plane_y = (
        occluding_cap_front_y_source - surface_depth_clearance / scale
    )
    for vertex in surface.data.vertices:
        vertex.co.y = surface_plane_y
    editable = bmesh.new()
    editable.from_mesh(surface.data)
    bmesh.ops.remove_doubles(
        editable,
        verts=list(editable.verts),
        dist=1e-6,
    )
    editable.to_mesh(surface.data)
    editable.free()
    for face in surface.data.polygons:
        face.material_index = 0
        face.use_smooth = False
    surface.data.update()
    assert uv_records(surface.data) == inset_uvs
    bpy.ops.object.select_all(action='DESELECT')
    surface.select_set(True)
    bpy.context.view_layer.objects.active = surface
    bpy.ops.mesh.customdata_custom_splitnormals_clear()
    surface.data.update()

    for mesh_object in (obj, surface):
        for vertex in mesh_object.data.vertices:
            vertex.co = (vertex.co - centre) * scale
        mesh_object.data.update()
    assert len(ornament_normals) == len(obj.data.loops)
    obj.data.normals_split_custom_set(ornament_normals)
    ornament_normal_max_error = max(
        (obj.data.corner_normals[index].vector - normal).length
        for index, normal in enumerate(ornament_normals)
    )
    surface.data.update()
    surface_y = [vertex.co.y for vertex in surface.data.vertices]
    occluding_cap_y = [
        (value - centre.y) * scale for value in occluding_cap_y_source
    ]
    surface_planar_deviation = max(surface_y) - min(surface_y)
    surface_normal_max_error = max(
        (corner.vector - Vector((0, -1, 0))).length
        for corner in surface.data.corner_normals
    )
    assert surface_planar_deviation < 1e-9
    assert abs(
        min(occluding_cap_y) - surface_y[0] - surface_depth_clearance
    ) < 1e-7
    assert not surface.data.has_custom_normals
    assert surface_normal_max_error < 1e-6
    assert all(face.normal.dot(Vector((0, -1, 0))) > .999999
               for face in surface.data.polygons)

    obj.name = 'gallery_frame_mesh'
    surface.name = 'gallery_frame_surface'
    root = bpy.data.objects.new('decor_gallery_frame', None)
    bpy.context.scene.collection.objects.link(root)
    obj.parent = root
    surface.parent = root
    root['source_kind'] = 'meshy-donor-finalized-in-blender'
    root['coordinates'] = 'GLB +Y up, +Z front, centre origin, height 1.8m'
    root['surface_material'] = 'decor_surface'
    bpy.context.view_layer.update()
    final_bounds = [
        vertex.co.copy()
        for mesh_object in (obj, surface)
        for vertex in mesh_object.data.vertices
    ]
    dimensions = Vector(tuple(
        max(vertex[axis] for vertex in final_bounds)
        - min(vertex[axis] for vertex in final_bounds)
        for axis in range(3)
    ))
    bpy.ops.file.pack_all()
    blend = HERE / 'sources/gallery-frame-final-v1.blend'
    bpy.ops.wm.save_as_mainfile(filepath=str(blend))
    source_hash = digest(blend)
    export = HERE / 'exports/gallery-frame.glb'
    textures = []
    with tempfile.TemporaryDirectory(prefix='glass-frame-export-') as temp:
        for index, original in enumerate(list(bpy.data.images)):
            colour_space = original.colorspace_settings.name
            use_jpeg = colour_space == 'sRGB'
            original.scale(1024, 1024)
            original.file_format = 'JPEG' if use_jpeg else 'PNG'
            path = Path(temp) / f'atlas-{index}.{"jpg" if use_jpeg else "png"}'
            original.filepath_raw = str(path)
            original.save(quality=95)
            replacement = bpy.data.images.load(str(path), check_existing=False)
            replacement.colorspace_settings.name = colour_space
            for mat in bpy.data.materials:
                if mat.use_nodes:
                    for node in mat.node_tree.nodes:
                        if node.type == 'TEX_IMAGE' and node.image == original:
                            node.image = replacement
            textures.append({'name': original.name, 'size': list(replacement.size),
                             'colorSpace': colour_space, 'sha256': digest(path)})
        bpy.ops.object.select_all(action='DESELECT')
        obj.select_set(True)
        surface.select_set(True)
        root.select_set(True)
        bpy.ops.export_scene.gltf(filepath=str(export), export_format='GLB',
                                 use_selection=True, export_yup=True,
                                 export_texcoords=True, export_normals=True,
                                 export_tangents=True, export_materials='EXPORT',
                                 export_image_format='AUTO', export_jpeg_quality=95)
    assert digest(blend) == source_hash
    receipt = {'schema': 1, 'node': root.name,
               'meshNodes': [obj.name, surface.name],
               'triangles': len(obj.data.polygons) + len(surface.data.polygons),
               'ornamentTriangles': len(obj.data.polygons),
               'surfaceFaces': len(selected),
               'surfaceVertices': len(surface.data.vertices),
               'surfaceLoopsWithFlatNormal': len(surface.data.loops),
               'surfaceNormalBlender': [0, -1, 0],
               'surfacePlaneYBlender': surface_y[0],
               'surfaceDepthClearance': surface_depth_clearance,
               'occludingInsetCap': {
                   'sourceFace': occluding_cap_source_face,
                   'faces': 1,
                   'nearestYBlender': min(occluding_cap_y),
                   'farthestYBlender': max(occluding_cap_y),
                   'allVerticesInInsetTopology': True,
               },
               'surfacePlanarDeviation': surface_planar_deviation,
               'surfaceNormalMaxError': surface_normal_max_error,
               'dimensionsBlender': list(dimensions),
               'insetDimensions': [(hi.x-lo.x)*scale, (hi.z-lo.z)*scale],
               'ornamentGeometryUvSha256': ornament_digest,
               'ornamentPreservation': {
                   **ornament_preservation,
                   'splitNormalMaxError': ornament_normal_max_error,
               },
               'source': str(source.relative_to(HERE)), 'sourceSha256': digest(source),
               'blend': str(blend.relative_to(HERE)), 'blendSha256': source_hash,
               'export': str(export.relative_to(HERE)), 'exportSha256': digest(export),
               'exportBytes': export.stat().st_size, 'textures': textures,
               'edits': ['Uniform scale and centre origin',
                         'Preserved donor triangles and ornament PBR atlas',
                         'Assigned inspected 55-face inset to decor_surface with centred 2:3 artwork crop UV',
                         'Isolated the existing inset triangles before editing so ornament vertices, faces and UVs remain unchanged',
                         'Planed and welded only the inset child; retained its 55 donor triangles and per-loop UVs',
                         'Placed the inset 0.5mm ahead of the measured overlapping donor cap while retaining that ornament triangle unchanged',
                         'Restored donor ornament split normals and regenerated flat Blender -Y normals on the planar inset']}
    (HERE / 'exports/gallery-frame-receipt.json').write_text(json.dumps(receipt, indent=2)+'\n')
    return receipt


if __name__ == '__main__':
    print(json.dumps(run(), indent=2))
