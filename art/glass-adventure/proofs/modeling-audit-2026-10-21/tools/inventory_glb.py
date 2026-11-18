"""Inventory GLBs: roots, mesh objects, triangles, materials, manifold stats, dims (m)."""
import bpy, bmesh, sys, json, os
from mathutils import Vector
args = sys.argv[sys.argv.index('--')+1:]
out_json = args[0]; files = args[1:]
report = []
for f in files:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    try:
        bpy.ops.import_scene.gltf(filepath=f)
    except Exception as e:
        report.append({'file': f, 'error': str(e)}); continue
    objs = [o for o in bpy.context.scene.objects]
    meshes = [o for o in objs if o.type == 'MESH']
    roots = [o.name for o in objs if o.parent is None]
    tris = 0; nm_edges = 0; boundary = 0; loose_parts = 0; mats = set(); flat_faces = 0; faces = 0
    lo = Vector((1e9,)*3); hi = Vector((-1e9,)*3)
    per = []
    dg = bpy.context.evaluated_depsgraph_get()
    for o in meshes:
        me = o.data
        bm = bmesh.new(); bm.from_mesh(me)
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
        bm.verts.ensure_lookup_table(); bm.verts.index_update()
        t = sum(len(p.verts)-2 for p in bm.faces)
        nm = sum(1 for e in bm.edges if not e.is_manifold)
        bd = sum(1 for e in bm.edges if e.is_boundary)
        # connected components
        seen = set(); comps = 0
        for v in bm.verts:
            if v.index in seen: continue
            comps += 1; stack = [v]; seen.add(v.index)
            while stack:
                x = stack.pop()
                for e in x.link_edges:
                    y = e.other_vert(x)
                    if y.index not in seen: seen.add(y.index); stack.append(y)
        fl = sum(1 for p in bm.faces if not p.smooth)
        faces += len(bm.faces); flat_faces += fl
        bm.free()
        tris += t; nm_edges += nm; boundary += bd; loose_parts += comps
        for s in o.material_slots:
            if s.material: mats.add(s.material.name)
        for c in o.bound_box:
            w = o.matrix_world @ Vector(c)
            lo = Vector(map(min, lo, w)); hi = Vector(map(max, hi, w))
        per.append({'name': o.name, 'tris': t, 'nonManifoldEdges': nm, 'boundaryEdges': bd, 'components': comps})
    report.append({'file': os.path.relpath(f), 'bytes': os.path.getsize(f), 'roots': roots[:40], 'rootCount': len(roots),
                   'meshObjects': len(meshes), 'tris': tris, 'nonManifoldEdges': nm_edges, 'boundaryEdges': boundary,
                   'components': loose_parts, 'flatFaceShare': round(flat_faces/max(faces,1),3), 'materials': sorted(mats)[:30],
                   'dims_m': [round(x,3) for x in (hi-lo)] if meshes else None, 'objects': per[:80]})
json.dump(report, open(out_json,'w'), indent=1)
print('INVENTORY_DONE', len(report))
