"""Prepare a hollow decanter and solid stopper from the high-resolution Meshy donor."""
import argparse
import hashlib
import importlib.util
import json
import math
from pathlib import Path
import sys

import bmesh
import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree
import numpy as np

HERE = Path(__file__).resolve().parent
DIRECTORY = HERE / "donors" / "cut-crystal-decanter"
SOURCE = HERE / "donors" / "cut-crystal-decanter-high-source" / "raw-import.blend"
SOURCE_HASH = "1372b1f338ad94314bf3c314b67f91a279f7091d62a0cf02a9bf00f02a1fb141"


def import_module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def topology(obj):
    mesh = obj.data
    indices = np.empty(len(mesh.loops), dtype=np.int32)
    mesh.loops.foreach_get("edge_index", indices)
    uses = np.bincount(indices, minlength=len(mesh.edges))
    return {"vertices": len(mesh.vertices), "faces": len(mesh.polygons),
            "boundaryEdges": int(np.sum(uses == 1)), "nonManifoldEdges": int(np.sum(uses != 2))}


def selected(obj):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def measure(obj):
    mesh = bmesh.new()
    mesh.from_mesh(obj.data)
    bmesh.ops.triangulate(mesh, faces=list(mesh.faces))
    result = topology(obj) | {"triangles": len(mesh.faces), "signedVolume": mesh.calc_volume(signed=True)}
    mesh.free()
    if result["nonManifoldEdges"] or result["signedVolume"] <= 0:
        raise ValueError(f"Invalid closed volume for {obj.name}: {result}")
    return result


def cut_half(original, name, split, upper):
    obj = original.copy()
    obj.data = original.data.copy()
    bpy.context.scene.collection.objects.link(obj)
    obj.name = name
    mesh = bmesh.new()
    mesh.from_mesh(obj.data)
    bmesh.ops.bisect_plane(mesh, geom=list(mesh.verts)+list(mesh.edges)+list(mesh.faces),
        dist=1e-8, plane_co=Vector((0,0,split)), plane_no=Vector((0,0,1)),
        clear_inner=upper, clear_outer=not upper)
    boundary = [edge for edge in mesh.edges if edge.is_boundary]
    if not boundary or any(abs(v.co.z-split) > 1e-6 for edge in boundary for v in edge.verts):
        raise ValueError("Only the inspected neck cut may introduce open edges")
    if upper:
        result = bmesh.ops.holes_fill(mesh, edges=boundary, sides=0)
        for face in result["faces"]:
            face.material_index = 1
    bmesh.ops.recalc_face_normals(mesh, faces=list(mesh.faces))
    mesh.to_mesh(obj.data)
    mesh.free()
    return obj


def placeholder_material(name):
    result = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    result.use_nodes = True
    shader = result.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (.94,.985,.98,1)
    shader.inputs["Transmission Weight"].default_value = .98
    shader.inputs["Roughness"].default_value = .04
    shader.inputs["IOR"].default_value = 1.5
    return result


def tree_for(obj):
    return BVHTree.FromPolygons([v.co for v in obj.data.vertices], [tuple(f.vertices) for f in obj.data.polygons])


def ray_hits(tree, origin, direction):
    result = []
    for _ in range(12):
        point, normal, face, distance = tree.ray_cast(origin, direction, 2)
        if point is None:
            break
        result.append({"position": list(point), "normal": list(normal), "face": face})
        # Move 0.01mm past a surface to avoid counting two triangles sharing
        # the same numerical ray boundary as two separate material walls.
        origin = point + direction*1e-5
    return result


def prepare(obj, source_report, version):
    stem = f"prepared-cavity-{version}"
    destination = DIRECTORY / f"{stem}.blend"
    report_path = DIRECTORY / f"{stem}.json"
    if destination.exists() or report_path.exists():
        raise ValueError("Preserve existing cavity versions")
    split = .429
    thickness = .003
    obj.data.materials.clear()
    for name in ["glass_shell", "glass_cut", "gold_trim"]:
        obj.data.materials.append(placeholder_material(name))
    for face in obj.data.polygons:
        face.material_index = 0
    body = cut_half(obj, "decanter_cut_body", split, False)
    stopper = cut_half(obj, "decanter_cut_stopper", split, True)
    outer_points = [v.co.copy() for v in body.data.vertices]
    outer_faces = len(body.data.polygons)
    # Sample conservative inside sections from the actual donor surface. The
    # cavity is polished inside; it does not mirror the outer decorative cuts.
    # Only this interior is authored. Every outer vertex remains unchanged.
    count = len(outer_points)
    original_faces = [tuple(face.vertices) for face in body.data.polygons]
    edges = {}
    for face in original_faces:
        for a,b in zip(face, face[1:]+face[:1]):
            key = tuple(sorted((a,b)))
            edges.setdefault(key, []).append((a,b))
    boundary = [uses[0] for uses in edges.values() if len(uses) == 1]
    successors = dict(boundary)
    loop = [boundary[0][0]]
    while successors[loop[-1]] != loop[0]:
        loop.append(successors[loop[-1]])
        if len(loop) > len(boundary):
            raise ValueError("Neck boundary is not one simple loop")
    if len(loop) != len(boundary):
        raise ValueError("More than one neck aperture loop")
    area = sum(outer_points[a].x*outer_points[b].y-outer_points[b].x*outer_points[a].y for a,b in boundary)
    direction = 1 if area > 0 else -1
    angles = [math.atan2(outer_points[index].y,outer_points[index].x) for index in loop]
    unwrapped = [angles[0]]
    for angle in angles[1:]:
        delta = (direction*(angle-unwrapped[-1])) % math.tau
        if delta > math.pi:
            raise ValueError("Actual neck rim is not radially ordered")
        unwrapped.append(unwrapped[-1]+direction*max(delta,1e-6))
    angles = unwrapped
    original_tree = tree_for(obj)
    floor = min(v.z for v in outer_points)+thickness
    sampled = []
    for level in range(960):
        z = floor+(split-floor)*level/959
        radii = []
        for i in range(256):
            angle = math.tau*i/256
            point, _, _, distance = original_tree.ray_cast(Vector((0,0,min(z,split-1e-5))), Vector((math.cos(angle),math.sin(angle),0)), .4)
            if point is None:
                raise ValueError("Inside section misses actual donor wall")
            radii.append(distance)
        radius = min(radii)-thickness
        if radius <= .008:
            raise ValueError("Inspected cavity section is too narrow")
        sampled.append((z,radius))
    profile = []
    span = (split-floor)/239
    for level in range(240):
        z = floor+span*level
        radius = min(r for height,r in sampled if abs(height-z) <= span+1e-8)
        profile.append((z,radius))
    inner = [Vector((math.cos(angle)*radius,math.sin(angle)*radius,z)) for z,radius in profile for angle in angles]
    n = len(loop)
    faces = list(original_faces)
    for level in range(len(profile)-1):
        lower = count+level*n; upper = lower+n
        faces.extend((lower+i,lower+(i+1)%n,upper+(i+1)%n,upper+i) for i in range(n))
    top = count+(len(profile)-1)*n
    faces.extend((loop[(i+1)%n],loop[i],top+i,top+(i+1)%n) for i in range(n))
    centre_index = count+len(inner)
    inner.append(Vector((0,0,floor)))
    faces.extend((centre_index,count+(i+1)%n,count+i) for i in range(n))
    replacement = bpy.data.meshes.new("Meshy body with donor-derived inner shell")
    replacement.from_pydata(outer_points+inner, [], faces)
    for material in body.data.materials:
        replacement.materials.append(material)
    for index,face in enumerate(replacement.polygons):
        face.material_index = 0 if index < len(original_faces) else 1
    body.data = replacement
    # Keep the authored exterior exactly. Material 1 identifies generated inner
    # wall/rim and stopper cap so atlas transfer can exclude those new surfaces.
    if any((v.co-point).length > 1e-7 for v, point in zip(body.data.vertices, outer_points)):
        raise ValueError("Inward wall unexpectedly moved donor exterior")
    original_tree = tree_for(obj)
    sample = outer_points[::max(1, len(outer_points)//3000)]
    exterior_error = max(original_tree.find_nearest(point)[3] for point in sample)
    bpy.data.objects.remove(obj, do_unlink=True)
    root = bpy.data.objects.new("decanter_cut", None)
    bpy.context.scene.collection.objects.link(root)
    for part, role in [(body,"body"), (stopper,"stopper")]:
        part.parent = root
        part["role"] = role
        part["source"] = "Actual high-resolution Meshy donor, prepared and split at existing neck seam"
        part["generated_surface_material_index"] = 1
    body_tree = tree_for(body)
    centre = ray_hits(body_tree, Vector((0,0,.6)), Vector((0,0,-1)))
    wall = ray_hits(body_tree, Vector((.3,0,.25)), Vector((-1,0,0)))
    print("DECANTER_CAVITY_PROBES="+json.dumps({"bodyBoundsZ": [min(v.co.z for v in body.data.vertices), max(v.co.z for v in body.data.vertices)], "centre": centre, "wall": wall}))
    if not centre or centre[0]["position"][2] > .03:
        raise ValueError("Body has a false cap instead of an open cavity")
    if len(wall) != 4:
        raise ValueError(f"Expected two walls around a hollow body; got {len(wall)} hits")
    measurements = {"body": measure(body), "stopper": measure(stopper)}
    root["height_metres"] = .52
    root["source_sha256"] = SOURCE_HASH
    root["preparation"] = "Versioned hollow body + solid stopper; final atlas transfer and fracture pending"
    bpy.ops.file.pack_all()
    bpy.ops.wm.save_as_mainfile(filepath=str(destination))
    report = {"status": "cavity prepared; final material transfer, fracture and art review pending",
        "source": source_report, "canonicalHeightMetres": .52, "coordinateSpace": "Blender Z up, common assembled foot centre at origin",
        "operations": [("OpenVDB cleanup of actual high Meshy donor; no adaptivity, pole fixing, reprojection or later collapse" if source_report.get("cleanSurface") else "Controlled reduction of actual closed 1.96M-triangle Meshy source to 40k"), "Split existing neck/stopper seam at z=.429m", "Keep prepared donor exterior and solid stopper; polished cavity is derived from conservative inside sections of the actual body, joined only around its neck rim", "Cap only the new stopper underside; body mouth remains open"],
        "splitHeightMetres": split, "innerDerivation": {"sections": len(profile), "sampledSections": len(sampled), "angularDonorSamplesPerSection": 256, "insideSafetyMarginMetres": thickness, "baseLiftMetres": thickness, "profile": profile, "note": "Polished interior envelope from actual donor cross-sections, conservative minimum over adjacent height intervals. Decorative outer facets remain unchanged; wall thickness varies with their cut depth."},
        "originalBodyOuterFaces": outer_faces, "sampledExteriorDeviationMetres": exterior_error,
        "meshes": measurements, "bodyCentreDownwardRays": centre, "bodyHorizontalWallRays": wall,
        "materialContract": {"slots": ["glass_shell","glass_cut","gold_trim"], "authoredExteriorIndex": 0, "generatedInnerRimAndStopperCapIndex": 1, "note": "Materials are placeholders. Transfer exterior gold/UV from the20k textured donor only onto index0; generated surfaces must not inherit unrelated gold pixels."},
        "sourceUv": "High Meshy source has no UV. Preserve existing20k textured raw import for nearest-surface UV/mask transfer.",
        "blend": {"path": str(destination.relative_to(HERE)), "sha256": hashlib.sha256(destination.read_bytes()).hexdigest(), "bytes": destination.stat().st_size}}
    report_path.write_text(json.dumps(report, indent=2)+"\n")
    print("DECANTER_CAVITY_READY="+json.dumps(report))


def audit_existing(version):
    stem = f"prepared-cavity-{version}"
    bpy.ops.wm.open_mainfile(filepath=str(DIRECTORY / f"{stem}.blend"))
    results = []
    for obj in [o for o in bpy.context.scene.objects if o.type == "MESH"]:
        mesh = bmesh.new()
        mesh.from_mesh(obj.data)
        bmesh.ops.triangulate(mesh, faces=list(mesh.faces))
        mesh.faces.ensure_lookup_table()
        tree = BVHTree.FromBMesh(mesh)
        pairs = []
        regions = {}
        region_bounds = {}
        for a,b in tree.overlap(tree):
            if a >= b:
                continue
            fa,fb = mesh.faces[a],mesh.faces[b]
            if set(fa.verts) & set(fb.verts):
                continue
            pairs.append([a,b])
            region = "/".join(str(x) for x in sorted([fa.material_index,fb.material_index]))
            regions[region] = regions.get(region,0)+1
            points = [v.co for v in [*fa.verts,*fb.verts]]
            lo,hi = region_bounds.setdefault(region, [[float("inf")]*3,[float("-inf")]*3])
            for i in range(3):
                lo[i] = min(lo[i], min(p[i] for p in points))
                hi[i] = max(hi[i], max(p[i] for p in points))
        results.append({"object": obj.name, "nonAdjacentOverlapPairs": len(pairs), "regions": regions, "regionBounds": region_bounds, "firstPairs": pairs[:20]})
        mesh.free()
    (DIRECTORY / f"{stem}-surface-audit.json").write_text(json.dumps(results,indent=2)+"\n")
    print("DECANTER_SURFACE_AUDIT="+json.dumps(results))


def source_ready(clean=False):
    suffix = "-clean" if clean else ""
    cache = DIRECTORY / f"prepared-cavity-source{suffix}.blend"
    report_file = DIRECTORY / f"prepared-cavity-source{suffix}.json"
    if cache.exists():
        bpy.ops.wm.open_mainfile(filepath=str(cache))
        return next(o for o in bpy.context.scene.objects if o.type == "MESH"), json.loads(report_file.read_text())
    bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
    bpy.context.preferences.filepaths.save_version = 0
    obj = next(o for o in bpy.context.scene.objects if o.type == "MESH")
    inspection = import_module("decanter_inspection", HERE / "inspect_donor.py")
    normalization = inspection.normalize([obj], .52)
    report = {"sourceSha256": SOURCE_HASH, "sourceBlend": str(SOURCE.relative_to(HERE)),
              "normalization": normalization, "before": topology(obj)}
    selected(obj)
    if clean:
        original_points = [v.co.copy() for v in obj.data.vertices]
        original_tree = tree_for(obj)
        obj.data.remesh_voxel_size = .0012
        obj.data.remesh_voxel_adaptivity = 0
        obj.data.use_remesh_fix_poles = False
        obj.data.use_remesh_preserve_volume = False
        obj.data.use_remesh_preserve_attributes = False
        bpy.ops.object.voxel_remesh()
        mesh = bmesh.new()
        mesh.from_mesh(obj.data)
        bmesh.ops.triangulate(mesh, faces=list(mesh.faces))
        bmesh.ops.recalc_face_normals(mesh, faces=list(mesh.faces))
        mesh.faces.ensure_lookup_table()
        cleaned_tree = BVHTree.FromBMesh(mesh)
        pairs = [(a,b) for a,b in cleaned_tree.overlap(cleaned_tree) if a<b and not set(mesh.faces[a].verts)&set(mesh.faces[b].verts)]
        forward = [original_tree.find_nearest(v.co)[3] for v in list(mesh.verts)[::max(1,len(mesh.verts)//4000)]]
        reverse = [cleaned_tree.find_nearest(v)[3] for v in original_points[::max(1,len(original_points)//4000)]]
        report["cleanSurface"] = {"method": "OpenVDB surface from actual high Meshy donor, no source projection or subsequent collapse", "voxelMetres": .0012, "adaptivity": 0, "fixPoles": False, "selfIntersectionPairs": len(pairs), "sampledMaxDistanceToSourceMetres": max(forward), "sampledMaxDistanceFromSourceMetres": max(reverse)}
        mesh.to_mesh(obj.data)
        mesh.free()
        if pairs:
            raise ValueError(f"Clean donor source still has {len(pairs)} surface intersections")
    else:
        modifier = obj.modifiers.new("High donor controlled reduction", "DECIMATE")
        modifier.ratio = 40000 / len(obj.data.polygons)
        modifier.use_collapse_triangulate = True
        bpy.ops.object.modifier_apply(modifier=modifier.name)
    report["afterReduction"] = topology(obj)
    if report["afterReduction"]["nonManifoldEdges"]:
        raise ValueError("Reduced high source is not closed; inspect before cavity creation")
    points = np.empty(len(obj.data.vertices)*3, dtype=np.float32)
    obj.data.vertices.foreach_get("co", points)
    points = points.reshape((-1, 3))
    rows = []
    for z in np.arange(.35, .46, .0025):
        ring = points[np.abs(points[:,2]-z) < .00125]
        if len(ring):
            radius = np.linalg.norm(ring[:,:2], axis=1)
            rows.append({"z": round(float(z), 4), "minRadius": float(np.min(radius)), "maxRadius": float(np.max(radius)), "vertices": len(ring)})
    report["neckProfile"] = rows
    bpy.ops.wm.save_as_mainfile(filepath=str(cache))
    report_file.write_text(json.dumps(report, indent=2)+"\n")
    return obj, report


def repair_source_intersections(obj, report):
    tree = tree_for(obj)
    before = measure(obj)
    selected(obj)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.intersect_boolean(operation="UNION",use_self=True,solver="EXACT")
    bpy.ops.object.mode_set(mode="OBJECT")
    after = measure(obj)
    distances = sorted(tree.find_nearest(v.co)[3] for v in obj.data.vertices)
    report["localIntersectionRepair"] = {"operation": "Blender exact self-union of reduced Meshy source", "before": before, "after": after, "maxSurfaceDeviationMetres": max(distances), "p95SurfaceDeviationMetres": distances[int(len(distances)*.95)]}
    print("DECANTER_SOURCE_REPAIR="+json.dumps(report["localIntersectionRepair"]))


def locate_source_deviation():
    report_file = DIRECTORY / "prepared-cavity-source-clean.json"
    report = json.loads(report_file.read_text())
    bpy.ops.wm.open_mainfile(filepath=str(DIRECTORY / "prepared-cavity-source-clean.blend"))
    tree = tree_for(next(o for o in bpy.context.scene.objects if o.type == "MESH"))
    bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
    obj = next(o for o in bpy.context.scene.objects if o.type == "MESH")
    inspection = import_module("decanter_inspection", HERE / "inspect_donor.py")
    inspection.normalize([obj], .52)
    samples = [(tree.find_nearest(v.co)[3], list(v.co)) for v in list(obj.data.vertices)[::max(1,len(obj.data.vertices)//12000)]]
    samples.sort(reverse=True)
    ordered = sorted(distance for distance,_ in samples)
    report["cleanSurface"]["sourceDeviationDetail"] = {"sampledVertices": len(samples), "p95Metres": ordered[int(len(ordered)*.95)], "p99Metres": ordered[int(len(ordered)*.99)], "worst": [{"distanceMetres":d,"sourcePointMetres":p} for d,p in samples[:12]]}
    report_file.write_text(json.dumps(report,indent=2)+"\n")
    print("DECANTER_DEVIATION="+json.dumps(report["cleanSurface"]["sourceDeviationDetail"]))


def prepare_lod(source_version, version, triangle_target, repair):
    source_path = DIRECTORY / f"prepared-cavity-{source_version}.blend"
    destination = DIRECTORY / f"prepared-cavity-{version}.blend"
    report_path = destination.with_suffix(".json")
    if destination.exists() or report_path.exists():
        raise ValueError("Preserve existing cavity versions")
    bpy.ops.wm.open_mainfile(filepath=str(source_path))
    bpy.context.preferences.filepaths.save_version = 0
    objects = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    counts = {obj: measure(obj)["triangles"] for obj in objects}
    total = sum(counts.values())
    results = []
    for obj in objects:
        original_points = [v.co.copy() for v in obj.data.vertices]
        original_tree = tree_for(obj)
        selected(obj)
        modifier = obj.modifiers.new("Measured donor cavity LOD", "DECIMATE")
        modifier.ratio = min(1, triangle_target / total)
        modifier.use_collapse_triangulate = True
        bpy.ops.object.modifier_apply(modifier=modifier.name)
        mesh = bmesh.new()
        mesh.from_mesh(obj.data)
        bmesh.ops.triangulate(mesh, faces=list(mesh.faces))
        bmesh.ops.recalc_face_normals(mesh, faces=list(mesh.faces))
        mesh.faces.ensure_lookup_table()
        mesh.verts.ensure_lookup_table()
        before_repair = [v.co.copy() for v in mesh.verts]

        def contacts():
            tree = BVHTree.FromBMesh(mesh)
            return [(a,b) for a,b in tree.overlap(tree)
                    if a < b and not set(mesh.faces[a].verts) & set(mesh.faces[b].verts)]

        history = []
        for iteration in range(17):
            pairs = contacts()
            history.append(len(pairs))
            print(f"DECANTER_LOD_CONTACTS {obj.name} {iteration} {len(pairs)}", flush=True)
            if not pairs or not repair or len(pairs) > 64 or iteration == 16:
                break
            core = {v for pair in pairs for index in pair for v in mesh.faces[index].verts}
            ring = {edge.other_vert(v) for v in core for edge in v.link_edges} - core
            for group, factor in [(core,.28), (ring,.08)]:
                updates = {v: sum((e.other_vert(v).co for e in v.link_edges), v.co*0)/len(v.link_edges) for v in group}
                for v, target in updates.items():
                    delta = v.co.lerp(target,factor)-before_repair[v.index]
                    if delta.length > .0005:
                        delta = delta.normalized()*.0005
                    v.co = before_repair[v.index]+delta
            mesh.normal_update()
        reduced_tree = BVHTree.FromBMesh(mesh)
        forward = [original_tree.find_nearest(v.co)[3] for v in list(mesh.verts)[::max(1,len(mesh.verts)//6000)]]
        reverse = [reduced_tree.find_nearest(v)[3] for v in original_points[::max(1,len(original_points)//6000)]]
        result = {"object":obj.name, "triangles":len(mesh.faces), "surfaceIntersectionPairs":len(pairs),
            "repairHistory":history, "repairMaxVertexDisplacementMetres":max((v.co-before_repair[v.index]).length for v in mesh.verts),
            "badEdges":sum(not e.is_manifold for e in mesh.edges), "badVertices":sum(not v.is_manifold for v in mesh.verts),
            "nonContiguousEdges":sum(not e.is_contiguous for e in mesh.edges), "signedVolume":mesh.calc_volume(signed=True),
            "sampledMaxDistanceToPreparedSourceMetres":max(forward), "sampledMaxDistanceFromPreparedSourceMetres":max(reverse)}
        results.append(result)
        mesh.to_mesh(obj.data)
        mesh.free()
    body = next(obj for obj in objects if obj.get("role") == "body")
    body_tree = tree_for(body)
    centre = ray_hits(body_tree, Vector((0,0,.6)), Vector((0,0,-1)))
    wall = ray_hits(body_tree, Vector((.3,0,.25)), Vector((-1,0,0)))
    passed = all(not r["surfaceIntersectionPairs"] and not r["badEdges"] and not r["badVertices"] and not r["nonContiguousEdges"] and r["signedVolume"] > 0 for r in results)
    passed = passed and bool(centre) and centre[0]["position"][2] < .03 and len(wall) == 4
    report = json.loads(source_path.with_suffix(".json").read_text())
    report["status"] = "LOD geometry gates passed; visual fidelity, materials and fracture pending" if passed else "REJECTED LOD: geometry gate failed; retain for diagnosis only"
    report["lod"] = {"source":str(source_path.relative_to(HERE)), "sourceSha256":hashlib.sha256(source_path.read_bytes()).hexdigest(), "targetTriangles":triangle_target, "parts":results, "geometryPassed":passed}
    report["bodyCentreDownwardRays"] = centre
    report["bodyHorizontalWallRays"] = wall
    report["meshes"] = {obj.get("role"):measure(obj) for obj in objects}
    bpy.ops.wm.save_as_mainfile(filepath=str(destination))
    report["blend"] = {"path":str(destination.relative_to(HERE)), "sha256":hashlib.sha256(destination.read_bytes()).hexdigest(), "bytes":destination.stat().st_size}
    report_path.write_text(json.dumps(report,indent=2)+"\n")
    print("DECANTER_LOD_READY="+json.dumps(report["lod"]))


def proof(source_version):
    source_path = SOURCE if source_version == "high-source" else DIRECTORY / f"prepared-cavity-{source_version}.blend"
    directory = DIRECTORY / f"prepared-cavity-proof-{source_version}"
    if directory.exists():
        raise ValueError("Preserve existing proof versions")
    directory.mkdir()
    source_hash = hashlib.sha256(source_path.read_bytes()).hexdigest()
    bpy.ops.wm.open_mainfile(filepath=str(source_path))
    objects = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    if source_version == "high-source":
        import_module("decanter_inspection", HERE / "inspect_donor.py").normalize(objects, .52)
    material = bpy.data.materials.new("geometry comparison clay, not final material")
    material.use_nodes = True
    shader = material.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (.45,.49,.50,1)
    shader.inputs["Roughness"].default_value = .56
    for obj in objects:
        obj.data.materials.clear()
        obj.data.materials.append(material)
        for face in obj.data.polygons:
            face.material_index = 0
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 16
    scene.cycles.use_denoising = True
    scene.render.threads_mode = "FIXED"
    scene.render.threads = 4
    scene.render.resolution_x = 900
    scene.render.resolution_y = 1000
    scene.render.resolution_percentage = 100
    scene.world = bpy.data.worlds.new("geometry-comparison-world")
    scene.world.color = (.08,.08,.08)
    for position, power in [((-2,-3,4),450),((3,-1,2),180),((0,3,3),500)]:
        light = bpy.data.lights.new("geometry-comparison-light","AREA")
        light.energy = power*.52*.52
        light.size = 1.04
        obj = bpy.data.objects.new("geometry-comparison-light",light)
        scene.collection.objects.link(obj)
        obj.location = Vector(position)*.52
        obj.rotation_euler = (Vector((0,0,.26))-obj.location).to_track_quat("-Z","Y").to_euler()
    bpy.ops.object.camera_add()
    camera = bpy.context.object
    camera.data.type = "ORTHO"
    scene.camera = camera
    scene.view_settings.view_transform = "AgX"
    views = [("three-quarter",(1.04,-1.56,.676),(0,0,.26),.645),
             ("cut-band",(1.04,-1.56,.21),(0,0,.145),.34)]
    if source_version != "high-source":
        views.append(("open-mouth",(0,-.7,1.8),(0,0,.26),.55))
    for name, position, target, size in views:
        if name == "open-mouth":
            for obj in objects:
                obj.hide_render = obj.get("role") == "stopper"
        camera.location = position
        camera.rotation_euler = (Vector(target)-camera.location).to_track_quat("-Z","Y").to_euler()
        camera.data.ortho_scale = size
        scene.render.filepath = str(directory/f"{name}.png")
        bpy.ops.render.render(write_still=True)
    if source_hash != hashlib.sha256(source_path.read_bytes()).hexdigest():
        raise ValueError("Proof must never write the source")
    (directory/"report.json").write_text(json.dumps({"source":str(source_path.relative_to(HERE)),"sourceSha256":source_hash,"sourceUnchanged":True,"purpose":"Matching clay geometry views; final optical material appearance is not represented","views":[v[0] for v in views]},indent=2)+"\n")
    print("DECANTER_PROOF="+str(directory))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--inspect-only", action="store_true")
    parser.add_argument("--version", default="v1")
    parser.add_argument("--audit-existing", action="store_true")
    parser.add_argument("--repair-source", action="store_true")
    parser.add_argument("--clean-source", action="store_true")
    parser.add_argument("--locate-source-deviation", action="store_true")
    parser.add_argument("--lod-from")
    parser.add_argument("--target-triangles", type=int, default=200000)
    parser.add_argument("--repair-contacts", action="store_true")
    parser.add_argument("--proof")
    args = parser.parse_args(sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else [])
    if args.proof:
        proof(args.proof)
        return
    if args.locate_source_deviation:
        locate_source_deviation()
        return
    if args.audit_existing:
        audit_existing(args.version)
        return
    if args.lod_from:
        prepare_lod(args.lod_from, args.version, args.target_triangles, args.repair_contacts)
        return
    obj, report = source_ready(args.clean_source)
    if args.repair_source:
        repair_source_intersections(obj, report)
    print("DECANTER_SOURCE_READY="+json.dumps({k:v for k,v in report.items() if k != "neckProfile"}))
    if args.inspect_only:
        return
    prepare(obj, report, args.version)


if __name__ == "__main__":
    main()
