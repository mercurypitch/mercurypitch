#!/usr/bin/env python3
"""Build the packed living-crystal authoring master without replacing historical proofs."""

from __future__ import annotations

import hashlib
import json
import math
import os
from pathlib import Path
import random
import tempfile
from typing import Any, Iterable

import bpy
from mathutils import Vector


SCRIPT = Path(__file__).resolve()
HERE = SCRIPT.parent
REPO = HERE.parents[3]
DEFAULT_SOURCE = (
    Path.home()
    / "Documents/root/5-Creative/besidecue/assets/glass-adventure/crystal-interiors/v1"
)
SOURCE = Path(
    os.environ.get("GLASS_CRYSTAL_INTERIOR_SOURCE_ROOT", str(DEFAULT_SOURCE))
).expanduser().resolve()
BLENDER_DIR = SOURCE / "blender"
PROOF_DIR = SOURCE / "proofs/blender"
MASTER = BLENDER_DIR / "crystal-interiors-v1-authoring.blend"
MANIFEST = SOURCE / "authoring-receipt.json"
RESOLUTION = (640, 420)
FRAME_END = 120
ENVELOPE = {
    "width": 2.1,
    "height": 0.08,
    "depth": 2.1,
    "centerRuntime": [0.0, -0.05, 0.0],
    "inset": 0.006,
}
PRESET_AUTHORING: dict[str, dict[str, Any]] = {
    "resonance-veins": {
        "seed": 4051,
        "colorsHex": ["#ffa31a", "#ff3d12", "#ffdf70"],
        "radiiMeters": {"main": 0.0051, "branch": 0.0034},
    },
    "frost-roots": {
        "seed": 771,
        "colorsHex": ["#00b7f5", "#172bbf", "#34f5d0"],
        "radiiMeters": {"main": 0.005576, "branch": 0.003808},
    },
    "aurora-heart": {
        "seed": 1209,
        "colorsHex": ["#ff3cb9", "#713cff", "#18dfff"],
        "radiiMeters": {"ribbons": [0.00578, 0.006596, 0.007412]},
    },
}


def digest(path: Path) -> str:
    result = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            result.update(block)
    return result.hexdigest()


def durable_json(path: Path, value: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, name = tempfile.mkstemp(prefix=f".{path.name}.", suffix=".tmp", dir=path.parent)
    temporary = Path(name)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8") as handle:
            json.dump(value, handle, indent=2)
            handle.write("\n")
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, path)
    finally:
        temporary.unlink(missing_ok=True)


def linear_color(value: str) -> tuple[float, float, float]:
    """Convert a runtime sRGB hex color to Blender's scene-linear input."""

    if len(value) != 7 or not value.startswith("#"):
        raise ValueError(f"Expected a six-digit color, got {value!r}.")

    def channel(offset: int) -> float:
        encoded = int(value[offset : offset + 2], 16) / 255
        return encoded / 12.92 if encoded <= 0.04045 else ((encoded + 0.055) / 1.055) ** 2.4

    return (channel(1), channel(3), channel(5))


def preset_max_radius(specification: dict[str, Any]) -> float:
    radii = specification["radiiMeters"]
    values = radii["ribbons"] if "ribbons" in radii else [radii["main"], radii["branch"]]
    return max(values)


def inset_bounds(radius: float = 0.0) -> tuple[tuple[float, float, float], tuple[float, float, float]]:
    center = ENVELOPE["centerRuntime"]
    half = (ENVELOPE["width"] / 2, ENVELOPE["height"] / 2, ENVELOPE["depth"] / 2)
    margin = ENVELOPE["inset"] + radius
    minimum = tuple(center[axis] - half[axis] + margin for axis in range(3))
    maximum = tuple(center[axis] + half[axis] - margin for axis in range(3))
    if any(minimum[axis] >= maximum[axis] for axis in range(3)):
        raise ValueError(f"Radius {radius} leaves no positive inset volume.")
    return minimum, maximum


def clamp_centerlines(
    paths: Iterable[Iterable[tuple[float, float, float]]],
    radius: float,
) -> list[list[tuple[float, float, float]]]:
    """Keep every control point one preset-wide maximum radius inside the inset."""

    minimum, maximum = inset_bounds(radius)
    return [
        [
            tuple(max(minimum[axis], min(maximum[axis], point[axis])) for axis in range(3))
            for point in path
        ]
        for path in paths
    ]


def collection(name: str, parent: bpy.types.Collection | None = None) -> bpy.types.Collection:
    value = bpy.data.collections.new(name)
    (parent or bpy.context.scene.collection).children.link(value)
    return value


def link_object(value: bpy.types.Object, target: bpy.types.Collection) -> None:
    for owner in list(value.users_collection):
        owner.objects.unlink(value)
    target.objects.link(value)


def emission_material(name: str, color_hex: str, phase: float) -> bpy.types.Material:
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    material["runtime_color_hex"] = color_hex
    nodes = material.node_tree.nodes
    nodes.clear()
    output = nodes.new("ShaderNodeOutputMaterial")
    emission = nodes.new("ShaderNodeEmission")
    color = linear_color(color_hex)
    emission.inputs["Color"].default_value = (*color, 1.0)
    material.diffuse_color = (*color, 1.0)
    material.node_tree.links.new(emission.outputs["Emission"], output.inputs["Surface"])
    for frame, strength in (
        (1, 0.8 + phase * 0.2),
        (31 + round(phase * 24), 4.8),
        (67 + round(phase * 18), 0.9),
        (FRAME_END, 0.8 + phase * 0.2),
    ):
        emission.inputs["Strength"].default_value = strength
        emission.inputs["Strength"].keyframe_insert("default_value", frame=frame)
    return material


def physical_material(
    name: str,
    base: tuple[float, float, float],
    metallic: float,
    roughness: float,
    transmission: float = 0.0,
) -> bpy.types.Material:
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    shader = next(node for node in material.node_tree.nodes if node.bl_idname == "ShaderNodeBsdfPrincipled")
    shader.inputs["Base Color"].default_value = (*base, 1.0)
    shader.inputs["Metallic"].default_value = metallic
    shader.inputs["Roughness"].default_value = roughness
    transmission_input = shader.inputs.get("Transmission Weight")
    if transmission_input is not None:
        transmission_input.default_value = transmission
    ior_input = shader.inputs.get("IOR")
    if ior_input is not None:
        ior_input.default_value = 1.45
    if transmission > 0:
        shader.inputs["Alpha"].default_value = 0.24
        material.surface_render_method = "BLENDED"
        material.use_transparency_overlap = False
    return material


def runtime_to_blender(point: tuple[float, float, float]) -> tuple[float, float, float]:
    return (point[0], -point[2], point[1])


def blender_to_runtime(point: Vector) -> tuple[float, float, float]:
    return (point.x, point.z, -point.y)


def clamp_blender_point(point: Vector, radius: float) -> Vector:
    minimum, maximum = inset_bounds(radius)
    runtime = blender_to_runtime(point)
    clamped = tuple(
        max(minimum[axis], min(maximum[axis], runtime[axis])) for axis in range(3)
    )
    return Vector(runtime_to_blender(clamped))


def curve_object(
    name: str,
    points: Iterable[tuple[float, float, float]],
    radius: float,
    centerline_radius: float,
    material: bpy.types.Material,
    target: bpy.types.Collection,
) -> bpy.types.Object:
    values = [runtime_to_blender(point) for point in points]
    data = bpy.data.curves.new(f"{name}__curve", "CURVE")
    data.dimensions = "3D"
    data.resolution_u = 2
    data.bevel_depth = radius
    data.bevel_resolution = 2
    data.resolution_u = 2
    data.use_fill_caps = True
    spline = data.splines.new("BEZIER")
    spline.bezier_points.add(len(values) - 1)
    for handle, coordinate in zip(spline.bezier_points, values, strict=True):
        handle.co = coordinate
        handle.handle_left_type = "AUTO"
        handle.handle_right_type = "AUTO"
    data.materials.append(material)
    obj = bpy.data.objects.new(name, data)
    target.objects.link(obj)
    bpy.context.view_layer.update()
    # Blender 5.2 has no AUTO_CLAMPED handle enum. Preserve its calculated
    # auto shape as editable free handles, then bound the handle hull too.
    for handle in spline.bezier_points:
        left = clamp_blender_point(handle.handle_left.copy(), centerline_radius)
        right = clamp_blender_point(handle.handle_right.copy(), centerline_radius)
        handle.handle_left_type = "FREE"
        handle.handle_right_type = "FREE"
        handle.handle_left = left
        handle.handle_right = right
    return obj


def resonance_paths(seed: int) -> list[list[tuple[float, float, float]]]:
    rng = random.Random(seed)
    result: list[list[tuple[float, float, float]]] = []
    center = (0.0, -0.05, 0.0)
    for trunk in range(3):
        angle = trunk * math.tau / 3 + rng.uniform(-0.18, 0.18)
        end = (math.cos(angle) * 0.94, -0.05 + rng.uniform(-0.018, 0.018), math.sin(angle) * 0.94)
        points = []
        for index in range(7):
            t = index / 6
            arc = math.sin(t * math.pi)
            points.append(
                (
                    center[0] + (end[0] - center[0]) * t + rng.uniform(-0.04, 0.04) * arc,
                    center[1] + (end[1] - center[1]) * t + rng.uniform(-0.006, 0.006) * arc,
                    center[2] + (end[2] - center[2]) * t + rng.uniform(-0.04, 0.04) * arc,
                )
            )
        result.append(points)
        for branch in range(2):
            fork = points[2 + branch * 2]
            branch_angle = angle + (-1 if branch == 0 else 1) * rng.uniform(0.45, 0.75)
            branch_end = (
                max(-1.0, min(1.0, fork[0] + math.cos(branch_angle) * rng.uniform(0.3, 0.55))),
                max(-0.082, min(-0.018, fork[1] + rng.uniform(-0.014, 0.014))),
                max(-1.0, min(1.0, fork[2] + math.sin(branch_angle) * rng.uniform(0.3, 0.55))),
            )
            result.append([fork, branch_end])
    return result


def frost_paths(seed: int) -> list[list[tuple[float, float, float]]]:
    rng = random.Random(seed)
    result: list[list[tuple[float, float, float]]] = []
    for root in range(5):
        start = (-0.72 + root * 0.36, -0.018, rng.uniform(-0.68, 0.68))
        points = [start]
        for index in range(1, 7):
            t = index / 6
            points.append(
                (
                    max(-1.0, min(1.0, start[0] + rng.uniform(-0.24, 0.24) * t)),
                    -0.018 - t * 0.064,
                    max(-1.0, min(1.0, start[2] + rng.uniform(-0.34, 0.34) * t)),
                )
            )
        result.append(points)
        fork = points[3 if rng.random() > 0.5 else 4]
        result.append(
            [
                fork,
                (
                    max(-1.0, min(1.0, fork[0] + rng.uniform(-0.5, 0.5))),
                    max(-0.082, fork[1] - rng.uniform(0.008, 0.022)),
                    max(-1.0, min(1.0, fork[2] + rng.uniform(-0.42, 0.42))),
                ),
            ]
        )
    return result


def aurora_paths(seed: int) -> list[list[tuple[float, float, float]]]:
    rng = random.Random(seed)
    result: list[list[tuple[float, float, float]]] = []
    for ribbon in range(3):
        phase = ribbon * math.tau / 3 + rng.uniform(-0.08, 0.08)
        points = []
        for index in range(13):
            t = index / 12
            heart = math.sin(t * math.pi)
            points.append(
                (
                    -0.88 + t * 1.76,
                    -0.05 + math.sin(t * math.tau + phase) * 0.015 * heart + (ribbon - 1) * 0.005,
                    math.cos(t * math.tau + phase) * 0.72 * heart,
                )
            )
        result.append(points)
    return result


def add_root(
    name: str,
    target: bpy.types.Collection,
    specification: dict[str, Any],
) -> bpy.types.Object:
    root = bpy.data.objects.new(name, None)
    target.objects.link(root)
    root["crystal_interior_json"] = json.dumps(
        {
            "schema": 1,
            "preset": name.removeprefix("CrystalInterior__"),
            **specification,
            "centerlineClampRadius": preset_max_radius(specification),
            "coordinates": "platform-local metres; runtime +Y up; Blender +Z up",
            "envelope": ENVELOPE,
        },
        separators=(",", ":"),
    )
    return root


def parent_objects(objects: Iterable[bpy.types.Object], parent: bpy.types.Object) -> None:
    for obj in objects:
        obj.parent = parent


def build_presets() -> dict[str, bpy.types.Collection]:
    presets: dict[str, bpy.types.Collection] = {}
    builders = {
        "resonance-veins": resonance_paths,
        "frost-roots": frost_paths,
        "aurora-heart": aurora_paths,
    }
    for preset, specification in PRESET_AUTHORING.items():
        seed = specification["seed"]
        paths = clamp_centerlines(builders[preset](seed), preset_max_radius(specification))
        target = collection(f"PRESET__{preset}")
        root = add_root(f"CrystalInterior__{preset}", target, specification)
        materials = [
            emission_material(f"{preset}__emission-{index}", color, index / 3)
            for index, color in enumerate(specification["colorsHex"])
        ]
        authored: list[bpy.types.Object] = []
        for index, points in enumerate(paths):
            radii = specification["radiiMeters"]
            if "ribbons" in radii:
                radius = radii["ribbons"][index]
            else:
                radius = radii["main"] if len(points) > 2 else radii["branch"]
            authored.append(
                curve_object(
                    f"{preset}__path-{index:02d}",
                    points,
                    radius,
                    preset_max_radius(specification),
                    materials[index % len(materials)],
                    target,
                )
            )
        if preset == "frost-roots":
            rng = random.Random(seed + 19)
            for index in range(14):
                bpy.ops.mesh.primitive_ico_sphere_add(
                    subdivisions=1,
                    radius=rng.uniform(0.008, 0.015),
                    location=(
                        *runtime_to_blender(
                            (
                                rng.uniform(-0.98, 0.98),
                                rng.uniform(-0.08, -0.02),
                                rng.uniform(-0.98, 0.98),
                            )
                        ),
                    ),
                )
                sparkle = bpy.context.object
                sparkle.name = f"frost-roots__sparkle-{index:02d}"
                link_object(sparkle, target)
                sparkle.data.materials.append(materials[2])
                authored.append(sparkle)
        parent_objects(authored, root)
        presets[preset] = target
    return presets


def validate_presets(
    presets: dict[str, bpy.types.Collection],
) -> dict[str, dict[str, Any]]:
    """Measure editable curves and reject any evaluated tube outside the inset."""

    bpy.context.scene.frame_set(1)
    bpy.context.view_layer.update()
    depsgraph = bpy.context.evaluated_depsgraph_get()
    inset_minimum, inset_maximum = inset_bounds()
    tolerance = 2e-5
    records: dict[str, dict[str, Any]] = {}
    for preset, target in presets.items():
        specification = PRESET_AUTHORING[preset]
        curves = sorted(
            (obj for obj in target.objects if obj.type == "CURVE"),
            key=lambda obj: obj.name,
        )
        if not curves or any(not obj.data.splines for obj in curves):
            raise RuntimeError(f"{preset} must remain a collection of editable curves.")

        expected_radii = specification["radiiMeters"]
        expected_values = (
            expected_radii["ribbons"]
            if "ribbons" in expected_radii
            else [expected_radii["main"], expected_radii["branch"]]
        )
        actual_values = sorted({round(obj.data.bevel_depth, 9) for obj in curves})
        if actual_values != sorted(round(value, 9) for value in expected_values):
            raise RuntimeError(
                f"{preset} curve radii {actual_values} do not match {expected_values}."
            )

        material_colors = sorted(
            {
                material.get("runtime_color_hex")
                for obj in curves
                for material in obj.data.materials
            }
        )
        if material_colors != sorted(specification["colorsHex"]):
            raise RuntimeError(
                f"{preset} material colors {material_colors} do not match runtime colors."
            )

        surface_minimum = [math.inf, math.inf, math.inf]
        surface_maximum = [-math.inf, -math.inf, -math.inf]
        surface_vertices = 0
        for obj in curves:
            evaluated = obj.evaluated_get(depsgraph)
            mesh = evaluated.to_mesh()
            try:
                for vertex in mesh.vertices:
                    runtime = blender_to_runtime(obj.matrix_world @ vertex.co)
                    surface_vertices += 1
                    for axis in range(3):
                        surface_minimum[axis] = min(surface_minimum[axis], runtime[axis])
                        surface_maximum[axis] = max(surface_maximum[axis], runtime[axis])
            finally:
                evaluated.to_mesh_clear()
        if surface_vertices == 0:
            raise RuntimeError(f"{preset} evaluated curves produced no surface vertices.")

        inside = all(
            surface_minimum[axis] >= inset_minimum[axis] - tolerance
            and surface_maximum[axis] <= inset_maximum[axis] + tolerance
            for axis in range(3)
        )
        if not inside:
            raise RuntimeError(
                f"{preset} tube surface {surface_minimum}..{surface_maximum} "
                f"exceeds inset {inset_minimum}..{inset_maximum}."
            )
        records[preset] = {
            "editableCurveCount": len(curves),
            "evaluatedSurfaceVertices": surface_vertices,
            "actualRadiiMeters": actual_values,
            "runtimeColorsHex": specification["colorsHex"],
            "globalCenterlineClampRadius": preset_max_radius(specification),
            "surfaceBoundsRuntime": {
                "minimum": [round(value, 9) for value in surface_minimum],
                "maximum": [round(value, 9) for value in surface_maximum],
            },
            "insideInsetVolume": True,
        }
    return records


def add_box(
    name: str,
    location: tuple[float, float, float],
    scale: tuple[float, float, float],
    material: bpy.types.Material,
    target: bpy.types.Collection,
    bevel: float = 0.0,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cube_add(location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel > 0:
        modifier = obj.modifiers.new("Soft authored edge", "BEVEL")
        modifier.width = bevel
        modifier.segments = 3
    obj.data.materials.append(material)
    link_object(obj, target)
    return obj


def build_audition_volume() -> bpy.types.Collection:
    target = collection("AUDITION_VOLUME")
    glass = physical_material("AuditionVolume__transmissive-glass", (0.16, 0.34, 0.42), 0.0, 0.16, 0.72)
    gold = physical_material("AuditionVolume__gold-frame", (0.56, 0.24, 0.045), 0.82, 0.21)
    shell = add_box(
        "AuditionVolume__glass-inset",
        (0, 0, -0.05),
        (1.102982044, 1.102982044, 0.05),
        glass,
        target,
        0.018,
    )
    shell.display_type = "TEXTURED"
    for side in (-1, 1):
        add_box(
            f"AuditionVolume__gold-x-{side}",
            (side * 1.135, 0, -0.05),
            (0.035, 1.14, 0.065),
            gold,
            target,
            0.012,
        )
        add_box(
            f"AuditionVolume__gold-y-{side}",
            (0, side * 1.135, -0.05),
            (1.14, 0.035, 0.065),
            gold,
            target,
            0.012,
        )
    return target


def point_at(camera: bpy.types.Object, target: Vector) -> None:
    camera.rotation_euler = (target - camera.location).to_track_quat("-Z", "Y").to_euler()


def setup_scene() -> dict[str, bpy.types.Object]:
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = RESOLUTION[0]
    scene.render.resolution_y = RESOLUTION[1]
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = False
    scene.render.image_settings.color_mode = "RGBA"
    scene.view_settings.look = "AgX - Medium High Contrast"
    scene.render.fps = 30
    scene.frame_start = 1
    scene.frame_end = FRAME_END
    if scene.world is None:
        scene.world = bpy.data.worlds.new("CrystalInterior__World")
    scene.world.color = (0.005, 0.008, 0.02)
    scene.world.use_nodes = True
    background = scene.world.node_tree.nodes.get("Background")
    background.inputs["Color"].default_value = (0.006, 0.012, 0.035, 1.0)
    background.inputs["Strength"].default_value = 0.22

    stage = collection("PROOF_STAGE")
    floor_material = physical_material("ProofStage__floor", (0.025, 0.035, 0.065), 0.12, 0.3)
    add_box("ProofStage__floor", (0, 0, -0.24), (2.6, 2.6, 0.05), floor_material, stage, 0.04)
    for name, location, energy, size, color in (
        ("ProofStage__key", (2.8, -2.4, 3.8), 1150, 3.2, (1.0, 0.72, 0.48)),
        ("ProofStage__fill", (-2.8, -1.0, 2.2), 850, 2.6, (0.34, 0.58, 1.0)),
        ("ProofStage__rim", (0.0, 2.5, 2.8), 980, 2.2, (0.72, 0.38, 1.0)),
    ):
        data = bpy.data.lights.new(name, "AREA")
        data.energy = energy
        data.shape = "DISK"
        data.size = size
        data.color = color
        light = bpy.data.objects.new(name, data)
        light.location = location
        point_at(light, Vector((0, 0, -0.05)))
        stage.objects.link(light)

    cameras: dict[str, bpy.types.Object] = {}
    definitions = {
        "gameplay": ((3.4, -3.4, 2.35), (0, 0, -0.05), 54),
        "above": ((0.05, -0.04, 4.3), (0, 0, -0.05), 58),
        "side": ((0.15, -3.9, 0.36), (0, 0, -0.05), 62),
        "nearest": ((2.25, -1.85, 0.68), (0.15, 0, -0.05), 68),
    }
    for name, (location, target, lens) in definitions.items():
        data = bpy.data.cameras.new(f"ProofCamera__{name}")
        data.lens = lens
        data.sensor_width = 36
        camera = bpy.data.objects.new(f"ProofCamera__{name}", data)
        camera.location = location
        point_at(camera, Vector(target))
        stage.objects.link(camera)
        cameras[name] = camera
    return cameras


def render_proofs(
    presets: dict[str, bpy.types.Collection],
    cameras: dict[str, bpy.types.Object],
) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    scene = bpy.context.scene
    PROOF_DIR.mkdir(parents=True, exist_ok=True)
    scene.frame_set(42)
    for preset, active in presets.items():
        for candidate in presets.values():
            candidate.hide_render = candidate != active
        for view, camera in cameras.items():
            scene.camera = camera
            output = PROOF_DIR / f"{preset}-{view}.png"
            temporary = output.with_suffix(".incomplete.png")
            scene.render.filepath = str(temporary)
            bpy.ops.render.render(write_still=True)
            os.replace(temporary, output)
            records.append(
                {
                    "preset": preset,
                    "view": view,
                    "file": str(output.relative_to(SOURCE)),
                    "bytes": output.stat().st_size,
                    "sha256": digest(output),
                    "resolution": list(RESOLUTION),
                }
            )
    for candidate in presets.values():
        candidate.hide_render = False
    return records


def external_dependencies() -> list[str]:
    files = {library.filepath for library in bpy.data.libraries if library.filepath}
    for image in bpy.data.images:
        if image.source != "FILE" or not image.filepath:
            continue
        packed = image.packed_file is not None or bool(getattr(image, "packed_files", ()))
        if not packed:
            files.add(image.filepath)
    return sorted(files)


def main() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.scene.unit_settings.system = "METRIC"
    bpy.context.scene.unit_settings.scale_length = 1.0
    presets = build_presets()
    build_audition_volume()
    setup_scene()
    bpy.context.scene["crystal_interior_recipe"] = json.dumps(
        {
            "schema": 1,
            "envelope": ENVELOPE,
            "presets": list(presets),
            "staticGeometry": True,
            "physicsChanges": False,
        },
        separators=(",", ":"),
    )
    validation = validate_presets(presets)
    BLENDER_DIR.mkdir(parents=True, exist_ok=True)
    bpy.ops.file.pack_all()
    external_files = external_dependencies()
    if external_files:
        raise RuntimeError(f"Authoring master has unpacked dependencies: {external_files}")
    bpy.ops.wm.save_as_mainfile(filepath=str(MASTER), check_existing=False)
    inset_minimum, inset_maximum = inset_bounds()
    receipt = {
        "schema": 1,
        "version": "crystal-interiors-v1",
        "status": "packed authoring master refreshed to the current runtime layout",
        "source": {
            "file": str(SCRIPT.relative_to(REPO)),
            "sha256": digest(SCRIPT),
        },
        "blender": {
            "version": bpy.app.version_string,
            "file": str(MASTER.relative_to(SOURCE)),
            "bytes": MASTER.stat().st_size,
            "sha256": digest(MASTER),
            "packed": not external_files,
            "externalDependencies": external_files,
        },
        "envelope": ENVELOPE,
        "presets": [
            {"id": preset, **specification}
            for preset, specification in PRESET_AUTHORING.items()
        ],
        "animationFrames": [1, FRAME_END],
        "validation": {
            "editableCurveCount": sum(
                record["editableCurveCount"] for record in validation.values()
            ),
            "insetBoundsRuntime": {
                "minimum": list(inset_minimum),
                "maximum": list(inset_maximum),
            },
            "presets": validation,
        },
        "proofs": {
            "status": "historical-pre-readability-reference",
            "directory": str(PROOF_DIR.relative_to(SOURCE)),
            "imageCount": len(list(PROOF_DIR.glob("*.png"))),
            "regenerated": False,
            "matchedToCurrentWidths": False,
            "note": "Existing Blender images predate the current readable tube widths and were intentionally preserved without rerendering.",
        },
        "scope": "Packed editable Blender master; browser runtime evidence is recorded separately.",
        "rebuild": (
            "rtk proxy timeout 1200 flock -w 1200 /tmp/glass-crystal-interiors-blender.lock "
            "env ALSOFT_DRIVERS=null blender --background --factory-startup --python-exit-code 1 "
            "--python art/glass-adventure/crystal-interiors/v1/author_crystal_interiors.py"
        ),
    }
    durable_json(MANIFEST, receipt)
    print("CRYSTAL_INTERIORS=" + json.dumps(receipt, separators=(",", ":")))


if __name__ == "__main__":
    main()
