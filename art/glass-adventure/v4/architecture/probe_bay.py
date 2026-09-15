"""Measure real bay openings and obstruction from the exported donor geometry."""
import argparse
import hashlib
import json
from pathlib import Path
import sys
import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

HERE = Path(__file__).resolve().parent


def run(stem):
    path = HERE / "exports" / f"{stem}.glb"
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(path))
    vertices, faces = [], []
    for obj in bpy.context.scene.objects:
        if obj.type != "MESH":
            continue
        offset = len(vertices)
        vertices.extend(obj.matrix_world @ v.co for v in obj.data.vertices)
        faces.extend(tuple(offset + i for i in f.vertices) for f in obj.data.polygons)
    lo = Vector(tuple(min(v[i] for v in vertices) for i in range(3)))
    hi = Vector(tuple(max(v[i] for v in vertices) for i in range(3)))
    tree = BVHTree.FromPolygons(vertices, faces)
    width, depth, height = hi - lo
    def blocked(x, z):
        return tree.ray_cast(Vector((x, lo.y - .2, z)), Vector((0, 1, 0)), depth + .4)[0] is not None
    central = [{"x": x * width, "z": z * height,
                "blocked": blocked(x * width, z * height)}
               for z in [.38, .48, .58, .68] for x in [-.15, 0, .15]]
    def central_interval(samples):
        # Report only the contiguous clear interval containing the bay center;
        # disconnected exterior sky outside the model is never a window opening.
        mid = len(samples) // 2
        if samples[mid][1]:
            return None
        first = last = mid
        while first > 0 and not samples[first-1][1]: first -= 1
        while last < len(samples)-1 and not samples[last+1][1]: last += 1
        return {"min": samples[first][0], "max": samples[last][0],
                "span": samples[last][0] - samples[first][0]}
    sections = []
    for fraction in [.38, .48, .58, .68]:
        z = fraction * height
        section = [(lo.x + width * i / 200, blocked(lo.x + width * i / 200, z)) for i in range(201)]
        sections.append({"height": z, "centralClearWidth": central_interval(section)})
    vertical = [(height * i / 200, blocked(0, height * i / 200)) for i in range(201)]
    report = {"stem": stem, "glbSha256": hashlib.sha256(path.read_bytes()).hexdigest(),
              "coordinateSpace": "Blender Z up, bay front viewed along +Y",
              "bounds": {"min": list(lo), "max": list(hi), "size": list(hi-lo)},
              "centralProbes": central,
              "centralWindowClear": all(not row["blocked"] for row in central),
              "centralScreenOpaque": all(row["blocked"] for row in central),
              "horizontalSections": sections, "verticalCenterOpening": central_interval(vertical),
              "measurementLimit": "Finite geometric ray samples. Does not establish collision readiness or a traversable door; sill and cornice remain real source geometry."}
    target = HERE / "reports" / f"{stem}-openings.json"
    target.write_text(json.dumps(report, indent=2) + "\n")
    return report


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--stem", required=True)
    args = parser.parse_args(sys.argv[sys.argv.index("--")+1:])
    result = run(args.stem)
    print(json.dumps(result))
