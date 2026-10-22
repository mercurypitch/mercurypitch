"""Procedural textures generated in bpy and embedded in the export: no files to manage.

`hammered_normal` makes a tileable tangent-space normal map of shallow hammer
dents meeting at soft ridges (Worley F1 squared): the hand-worked gold of the
Glassworks concepts, at no triangle cost. `marbled` makes a tileable colour map
of soft veins over a mottled ground, for jade and marble. `attach_normal` and
`attach_color` wire them into a Principled material so the glTF exporter
writes them as its normalTexture and baseColorTexture. The surface needs UVs in
metres over the tile size (`lathe.lathe(uv=tile)`, `sweep.tube(uv=tile)`), or
the pattern stretches with each part's own UV scale.
"""

import random

import bpy
import numpy as np

from .materials import srgb


def hammered_normal(name, size=128, cells=9, depth=2.2, stretch=1.25, seed=3):
    """Tileable hammered normal map as a packed, non-colour bpy image.

    cells: dents along one side of the tile. depth: slope scale of a dent's wall
    (higher is a deeper dent). stretch: dents longer across u than v, as hammer
    blows usually are.
    """
    rng = random.Random(seed)
    pts = np.array([((i + 0.15 + 0.7 * rng.random()) / cells, (j + 0.15 + 0.7 * rng.random()) / cells)
                    for i in range(cells) for j in range(cells)])
    axis = (np.arange(size) + 0.5) / size
    u, v = np.meshgrid(axis, axis)
    best = np.full(u.shape, np.inf)
    for px, py in pts:
        du = np.abs(u - px)
        dv = np.abs(v - py)
        du = np.minimum(du, 1 - du) / stretch  # wrap: the tile repeats seamlessly
        dv = np.minimum(dv, 1 - dv)
        best = np.minimum(best, du * du + dv * dv)
    height = best * (cells * cells)  # F1 squared, about 0..0.5 inside a cell
    gu = (np.roll(height, -1, axis=1) - np.roll(height, 1, axis=1)) * (size / 2) / cells * depth
    gv = (np.roll(height, -1, axis=0) - np.roll(height, 1, axis=0)) * (size / 2) / cells * depth
    normal = np.dstack((-gu, -gv, np.ones_like(height)))
    normal /= np.linalg.norm(normal, axis=2, keepdims=True)
    rgba = np.dstack((normal * 0.5 + 0.5, np.ones_like(height)))
    image = bpy.data.images.new(name, size, size, alpha=False)
    image.colorspace_settings.name = 'Non-Color'
    image.pixels.foreach_set(rgba.astype(np.float32).ravel())
    image.pack()
    return image


def attach_normal(material, image, strength=1.0):
    """Feed `image` through a tangent-space Normal Map node into the material's Principled BSDF."""
    nt = material.node_tree
    bsdf = next(node for node in nt.nodes if node.type == 'BSDF_PRINCIPLED')
    tex = nt.nodes.new('ShaderNodeTexImage')
    tex.image = image
    tex.interpolation = 'Linear'
    normal_map = nt.nodes.new('ShaderNodeNormalMap')
    normal_map.inputs['Strength'].default_value = strength
    nt.links.new(tex.outputs['Color'], normal_map.inputs['Color'])
    nt.links.new(normal_map.outputs['Normal'], bsdf.inputs['Normal'])
    return material



def _tileable_noise(size, cells, rng):
    """Smooth value noise that wraps at the tile edges, 0..1."""
    grid = np.array([[rng.random() for _ in range(cells)] for _ in range(cells)])
    t = (np.arange(size) + 0.5) / size * cells
    i0 = np.floor(t).astype(int) % cells
    i1 = (i0 + 1) % cells
    f = t - np.floor(t)
    f = f * f * (3 - 2 * f)
    rows = grid[i0][:, i0] * (1 - f)[None, :] + grid[i0][:, i1] * f[None, :]
    rows2 = grid[i1][:, i0] * (1 - f)[None, :] + grid[i1][:, i1] * f[None, :]
    return rows * (1 - f)[:, None] + rows2 * f[:, None]


def marbled(name, ground, vein, *, dark=None, size=256, veins=3, turbulence=2.2, softness=0.35, seed=5):
    """Tileable marbled colour map: `ground` mottled toward `dark`, crossed by soft `vein` lines.

    Colours are sRGB hex like the materials. veins: vein bands across the tile.
    turbulence: how far fractal noise pushes the veins off straight. softness:
    vein width (0..1). Built so the tile repeats seamlessly in both directions.
    """
    rng = random.Random(seed)
    fractal = sum(_tileable_noise(size, 4 * 2 ** o, rng) / 2 ** o for o in range(4)) / 1.875
    axis = (np.arange(size) + 0.5) / size
    u, v = np.meshgrid(axis, axis)
    phase = 2 * np.pi * (veins * (u + v) / 2 * 2) + turbulence * 2 * np.pi * fractal
    band = np.abs(np.sin(phase / 2))
    lines = np.clip(1 - band / max(softness, 1e-3), 0, 1) ** 2
    mottle = _tileable_noise(size, 6, rng) * 0.6 + fractal * 0.4
    g, w = np.array(srgb(ground)), np.array(srgb(vein))
    d = np.array(srgb(dark)) if dark else g * 0.55
    base = g[None, None, :] * (1 - mottle[..., None] * 0.7) + d[None, None, :] * (mottle[..., None] * 0.7)
    rgb = base * (1 - lines[..., None]) + w[None, None, :] * lines[..., None]
    image = bpy.data.images.new(name, size, size, alpha=False)
    image.colorspace_settings.name = 'sRGB'
    # a byte image holds sRGB-encoded values: encode the linear mix (gamma 2.2 is close enough)
    rgba = np.dstack((np.clip(rgb, 0, 1) ** (1 / 2.2), np.ones((size, size))))
    image.pixels.foreach_set(rgba.astype(np.float32).ravel())
    image.pack()
    return image


def attach_color(material, image, scale=1.0):
    """Feed `image` into the material's Principled Base Color (the exporter's baseColorTexture).

    scale below 1 repeats the image less often than the UV tiles (0.33 shows one
    image over three tiles, so a vein pattern does not visibly repeat round a
    foot); it exports as KHR_texture_transform.
    """
    nt = material.node_tree
    bsdf = next(node for node in nt.nodes if node.type == 'BSDF_PRINCIPLED')
    tex = nt.nodes.new('ShaderNodeTexImage')
    tex.image = image
    tex.interpolation = 'Linear'
    if scale != 1.0:
        coords = nt.nodes.new('ShaderNodeTexCoord')
        mapping = nt.nodes.new('ShaderNodeMapping')
        mapping.inputs['Scale'].default_value = (scale, scale, 1.0)
        nt.links.new(coords.outputs['UV'], mapping.inputs['Vector'])
        nt.links.new(mapping.outputs['Vector'], tex.inputs['Vector'])
    nt.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
    return material
