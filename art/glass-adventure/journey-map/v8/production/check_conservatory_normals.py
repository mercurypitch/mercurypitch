"""Check the candidate normal transform in Blender without any asset or provider call."""

from pathlib import Path
import runpy

import bpy
from mathutils import Matrix, Vector


HERE = Path(__file__).resolve().parent
finish = runpy.run_path(str(HERE / "finish_conservatory_candidate.py"))
transform_mesh = finish["transform_mesh_preserving_corner_normals"]
transform = (
    Matrix.Translation(Vector((2.0, -1.0, 0.7)))
    @ Matrix.Rotation(0.4, 4, "Z")
    @ Matrix.Diagonal(Vector((2.0, 0.7, 1.4, 1.0)))
)

maximum_error = 0.0
for custom in (False, True):
    mesh = bpy.data.meshes.new(f"normal-fixture-custom-{custom}")
    mesh.from_pydata([(0, 0, 0), (1, 0, 0), (0, 1, 1)], [], [(0, 1, 2)])
    if custom:
        mesh.polygons[0].use_smooth = True
        normal = Vector((0.2, 0.5, 0.84)).normalized()
        mesh.normals_split_custom_set([normal] * 3)
    old_positions = [vertex.co.copy() for vertex in mesh.vertices]
    old_normals = [corner.vector.copy() for corner in mesh.corner_normals]
    normal_transform = transform.inverted().transposed().to_3x3()
    transform_mesh(mesh, transform)
    for vertex, previous in zip(mesh.vertices, old_positions, strict=True):
        assert (vertex.co - transform @ previous).length < 1e-6
    expected_normals = [(normal_transform @ normal).normalized() for normal in old_normals]
    # Compare against Blender's representation of the independently calculated
    # result. Stored split normals are quantized, not full-precision vectors.
    reference = mesh.copy()
    reference.normals_split_custom_set(expected_normals)
    for corner, encoded, expected in zip(
        mesh.corner_normals, reference.corner_normals, expected_normals, strict=True
    ):
        error = (corner.vector - expected).length
        maximum_error = max(maximum_error, error)
        assert (corner.vector - encoded.vector).length < 1e-6, (custom, error)
    bpy.data.meshes.remove(reference)
    bpy.data.meshes.remove(mesh)

mesh = bpy.data.meshes.new("singular-normal-fixture")
mesh.from_pydata([(0, 0, 0), (1, 0, 0), (0, 1, 1)], [], [(0, 1, 2)])
before = [vertex.co.copy() for vertex in mesh.vertices]
try:
    transform_mesh(mesh, Matrix.Diagonal(Vector((1, 0, 1, 1))))
except ValueError:
    assert all(vertex.co == previous for vertex, previous in zip(mesh.vertices, before, strict=True))
else:
    raise AssertionError("Singular transform must fail before mutating the mesh")
bpy.data.meshes.remove(mesh)

print(f"NORMAL_TRANSFORM_CHECK=passed blender={bpy.app.version_string} maxError={maximum_error:.8f}")
