"""Finalize an inspected Meshy architectural donor without replacing its geometry."""
import argparse
import hashlib
import json
from pathlib import Path
import sys
import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

HERE = Path(__file__).resolve().parent

def hash_file(path): return hashlib.sha256(path.read_bytes()).hexdigest()

def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--asset-id", default="gilded-column-01")
    p.add_argument("--target", type=int, default=12000)
    p.add_argument("--version", default="v1")
    p.add_argument("--height", type=float, default=3.0)
    args = p.parse_args(sys.argv[sys.argv.index("--")+1:])
    if any(not x.replace("-", "").isalnum() for x in (args.asset_id,args.version)): raise ValueError("Invalid versioned ID")
    source = HERE / "sources" / f"{args.asset_id}-imported.blend"
    stem = f"{args.asset_id}-final-{args.version}"
    blend = HERE / "sources" / f"{stem}.blend"
    export = HERE / "exports" / f"{stem}.glb"
    report_path = HERE / "reports" / f"{stem}.json"
    if any(x.exists() for x in (blend,export,report_path)): raise ValueError("Version already exists; preserve it and choose a new version")
    bpy.ops.wm.open_mainfile(filepath=str(source))
    meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    bounds = [o.matrix_world @ Vector(c) for o in meshes for c in o.bound_box]
    lo = Vector(tuple(min(v[i] for v in bounds) for i in range(3)))
    hi = Vector(tuple(max(v[i] for v in bounds) for i in range(3)))
    pivot = Vector(((lo.x+hi.x)/2,(lo.y+hi.y)/2,lo.z))
    scale = args.height/(hi.z-lo.z)
    logical_name = args.asset_id.removesuffix("-01").replace("-", "_")
    material_name = f"meshy_{logical_name}_atlas"
    original_vertices=[]; original_faces=[]
    bpy.ops.object.select_all(action="DESELECT")
    for obj in meshes:
        world=obj.matrix_world.copy();obj.parent=None;obj.matrix_world=world
        obj.location=(obj.location-pivot)*scale;obj.scale*=scale
        obj.select_set(True);bpy.context.view_layer.objects.active=obj
        bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
        obj.select_set(False)
        offset=len(original_vertices)
        original_vertices.extend(v.co.copy() for v in obj.data.vertices)
        original_faces.extend(tuple(offset+i for i in f.vertices) for f in obj.data.polygons)
    original_bvh=BVHTree.FromPolygons(original_vertices,original_faces)
    original_count=sum(len(o.data.polygons) for o in meshes)
    ratio=min(1,args.target/original_count)
    for obj in meshes:
        obj.select_set(True);bpy.context.view_layer.objects.active=obj
        if ratio < 1:
            modifier=obj.modifiers.new("Donor-preserving triangle reduction","DECIMATE")
            modifier.ratio=ratio;modifier.use_collapse_triangulate=True
            bpy.ops.object.modifier_apply(modifier=modifier.name)
        obj.name=f"{logical_name}_mesh"
        obj.select_set(False)
    # A combined donor atlas carries all semantic regions. Keep that map instead
    # of replacing the entire column with the renderer's museum_ivory preset.
    for material in bpy.data.materials: material.name=material_name
    root=bpy.data.objects.new(f"meshy_{logical_name}",None);bpy.context.scene.collection.objects.link(root)
    root["source_kind"]="meshy-donor-finalized-in-blender"
    root["source_sha256"]=hash_file(HERE / "raw" / args.asset_id / "donor.glb")
    root["canonical_height_m"]=args.height
    root["collision_role"]="ornament-only; placement requires host clearance review"
    root["atlas_regions"]="ivory stone, gilt accents, verde insets; source atlas preserved"
    final_vertices=[];final_faces=[]
    for obj in meshes:
        obj.parent=root
        offset=len(final_vertices);final_vertices.extend(v.co.copy() for v in obj.data.vertices)
        final_faces.extend(tuple(offset+i for i in f.vertices) for f in obj.data.polygons)
    final_bvh=BVHTree.FromPolygons(final_vertices,final_faces)
    def distance_sample(points,tree):
        sample=points[::max(1,len(points)//5000)]
        distances=[tree.find_nearest(v)[3] for v in sample]
        distances.sort()
        return {"sampledVertices":len(distances),"maxMetres":max(distances),"p95Metres":distances[int(len(distances)*.95)]}
    metric={"sourceToFinal":distance_sample(original_vertices,final_bvh),"finalToSource":distance_sample(final_vertices,original_bvh)}
    bpy.ops.file.pack_all()
    bpy.ops.wm.save_as_mainfile(filepath=str(blend))
    export.parent.mkdir(parents=True,exist_ok=True)
    textures=HERE/"exports"/f"{stem}-textures";textures.mkdir(exist_ok=True)
    texture_records=[]
    # Save 1K runtime derivatives only after preserving the optimized 2K working source.
    for i,image in enumerate(bpy.data.images):
        image.scale(1024,1024)
        image.file_format="PNG";image.filepath_raw=str(textures/f"atlas-{i}.png")
        image.save()
        texture_records.append({"name":image.name,"path":str(Path(image.filepath_raw).relative_to(HERE)),"colorSpace":image.colorspace_settings.name,"size":list(image.size),"sha256":hash_file(Path(image.filepath_raw))})
    bpy.ops.object.select_all(action="DESELECT")
    root.select_set(True)
    for obj in meshes:obj.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(export),export_format="GLB",use_selection=True,export_yup=True,export_texcoords=True,export_normals=True,export_tangents=True,export_materials="EXPORT",export_image_format="AUTO")
    report={"version":3,"assetId":args.asset_id,"status":"exported-awaiting-comparison-and-reimport","sourceBlend":str(source.relative_to(HERE)),"sourceRawSha256":root["source_sha256"],"normalization":{"uniformScale":scale,"sourceBlenderPivot":list(pivot),"canonicalHeightMetres":args.height,"gltfUp":"+Y","gltfFront":"+Z","pivot":"foot-center"},"geometry":{"sourceTriangles":original_count,"targetTriangles":args.target,"finalTriangles":len(final_faces),"distanceMetric":metric},"materials":{"strategy":"Preserved combined donor PBR atlas; ivory/gold/verde regions are not globally replaced by palette aliases","slot":material_name,"packedSourceResolution":2048,"runtimeResolution":1024},"edits":["Uniform fit and foot-center origin",("Decimate collapse on donor triangles; no synthesized replacement geometry" if ratio < 1 else "Original donor triangles and UVs retained; no decimation or synthesized replacement geometry"),"Shared 1K PNG runtime derivatives of original donor PBR atlas"],"textures":texture_records,"blend":{"path":str(blend.relative_to(HERE)),"sha256":hash_file(blend),"bytes":blend.stat().st_size},"glb":{"path":str(export.relative_to(HERE)),"sha256":hash_file(export),"bytes":export.stat().st_size},"visualApproval":"pending","runtimeActivated":False}
    report_path.write_text(json.dumps(report,indent=2)+"\n")
    print("V3_ARCHITECTURE_FINALIZED "+json.dumps({"triangles":len(final_faces),"bytes":export.stat().st_size,"manifest":str(report_path),"deviation":metric}))

if __name__=="__main__": main()
