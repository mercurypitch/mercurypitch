"""Export the authoring room with shared bay geometry and inspect its byte-level receipt."""
import hashlib
import json
from pathlib import Path
import struct
import bpy

HERE = Path(__file__).resolve().parent


def run():
    path = HERE / 'enclosure-study-v1.glb'
    bpy.ops.object.select_all(action='DESELECT')
    for obj in bpy.context.scene.objects:
        if obj.type in {'MESH', 'EMPTY', 'CAMERA'}:
            obj.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(path), export_format='GLB', use_selection=True,
        export_yup=True, export_texcoords=True, export_normals=True, export_tangents=True,
        export_materials='EXPORT', export_cameras=True, export_image_format='AUTO')
    raw=path.read_bytes();length=struct.unpack_from('<I',raw,12)[0]
    document=json.loads(raw[20:20+length])
    node_meshes=[n['mesh'] for n in document['nodes'] if 'mesh' in n]
    report={'purpose':'Separate authoring room preview; no gameplay or collision',
        'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),
        'meshNodes':len(node_meshes),'uniqueMeshReferences':len(set(node_meshes)),
        'sharedGeometry':len(node_meshes)>len(set(node_meshes)),
        'cameras':[c.get('name') for c in document.get('cameras',[])],
        'images':len(document.get('images',[])),
        'externalDependencies':any('uri' in x for x in document.get('images',[])+document.get('buffers',[]))}
    assert report['sharedGeometry']
    assert not report['externalDependencies']
    assert {'Interior','Window sightline','Room overview'} <= set(report['cameras'])
    (HERE/'export-receipt.json').write_text(json.dumps(report,indent=2)+'\n')
    return report
