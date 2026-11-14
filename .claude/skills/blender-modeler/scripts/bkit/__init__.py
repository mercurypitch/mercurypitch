"""bkit — tested bpy building blocks for the blender-modeler skill.

Import from a build script run as `blender -b --factory-startup --python build.py`:

    import sys; sys.path.insert(0, '<skill>/scripts')
    from bkit import profile, lathe, sweep, trims, materials, textures, fracture, validate, export, scene

Every module targets Blender 5.2 LTS. The version is asserted on import because
bpy written for 4.x fails in ways that look like geometry bugs (see
references/blender-5-gotchas.md).
"""

try:
    import bpy
except ImportError:  # outside Blender only the pure modules import (`from bkit import colour`)
    bpy = None

REQUIRED_SERIES = (5, 2)
if bpy is not None and tuple(bpy.app.version[:2]) != REQUIRED_SERIES:
    raise RuntimeError(
        f'bkit targets Blender {REQUIRED_SERIES[0]}.{REQUIRED_SERIES[1]}; this is {bpy.app.version_string}'
    )

from . import colour  # noqa: E402,F401
if bpy is not None:
    from . import profile, scene, lathe, sweep, trims, materials, textures, validate, fracture, export  # noqa: E402,F401
