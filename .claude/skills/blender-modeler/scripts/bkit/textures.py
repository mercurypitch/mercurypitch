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


def _image(name, rgb, colour):
    """Packed bpy image from an (rows, cols, 3) array whose row 0 is the bottom of the image."""
    rows, cols = rgb.shape[:2]
    image = bpy.data.images.new(name, cols, rows, alpha=False)
    image.colorspace_settings.name = 'sRGB' if colour else 'Non-Color'
    data = np.clip(rgb, 0, 1) ** (1 / 2.2) if colour else np.clip(rgb, 0, 1)
    image.pixels.foreach_set(np.dstack((data, np.ones((rows, cols)))).astype(np.float32).ravel())
    image.pack()
    return image


def _segments(strokes, width, period_shifts):
    """Flatten polylines into segment arrays, drawn once per period shift so the tile wraps.

    strokes: [(points, half_widths[, heights])]; heights default to 1 per point.
    """
    a, b, wa, wb, ha, hb = [], [], [], [], [], []
    for stroke in strokes:
        points, half = stroke[0], stroke[1]
        heights = stroke[2] if len(stroke) > 2 else [1.0] * len(points)
        if np.isscalar(heights):
            heights = [float(heights)] * len(points)
        for shift in period_shifts:
            for i in range(len(points) - 1):
                a.append((points[i][0] + shift * width, points[i][1]))
                b.append((points[i + 1][0] + shift * width, points[i + 1][1]))
                wa.append(half[i])
                wb.append(half[i + 1])
                ha.append(heights[i])
                hb.append(heights[i + 1])
    return tuple(np.array(x, dtype=float) for x in (a, b, wa, wb, ha, hb))


def _nearest(p, segs):
    """For points p (n, 2): distance to, parameter on and index of the nearest segment, the
    interpolated half width and height there, and which hand of it each point is on."""
    a, b, wa, wb, ha, hb = segs
    ab = b - a
    ab_len2 = np.maximum((ab ** 2).sum(axis=1), 1e-18)
    ap = p[:, None, :] - a[None, :, :]
    t = np.clip((ap * ab[None]).sum(axis=2) / ab_len2[None], 0, 1)
    q = a[None] + t[..., None] * ab[None]
    d = np.sqrt(((p[:, None, :] - q) ** 2).sum(axis=2))
    w = wa[None] + t * (wb - wa)[None]
    return d, t, w, ap, ab, ha[None] + t * (hb - ha)[None]


def inlay(name, strokes, width, height, *, cols=512, rows=256, ground='#d6efe4', line='#e0b65e',
          ground_trm=(0.35, 0.20, 0.0), line_trm=(0.0, 0.30, 1.0), ridge=0.0008, relief=0.0,
          reach=0.022, side=-1, period_shifts=(-1, 0, 1, 2), ridges=(), ground_low=None, light=0.0):
    """Inlaid metal lines and the relief they ride on, as three tileable images for one material.

    strokes: [(points, half_widths)], points (s, z) in metres inside a tile `width`
    across and `height` tall, half_widths per point. The tile repeats across s
    (strokes are drawn shifted by `period_shifts` x width so they wrap) and not
    up z. Returns {'color', 'trm', 'normal'}: base colour (sRGB), transmission,
    roughness and metallic packed in R, G and B, and a tangent-space normal map.
    ridge: height of the line's rounded crown. relief: height of a raised roll on
    `side` of each stroke (-1 is its right hand as it travels: below a crest that
    runs left to right, inside a clockwise curl), fading out over `reach` metres.
    ridges: [(points, half_widths, heights)], glass ridges with no metal: a smooth
    bump of each point's height and half width (heights fade a ridge in and out).
    ground_low, light: the relief's shading baked into the ground colour, so it
    reads at gameplay size and under flat light: where the surface turns down
    (away from a light above) the ground moves toward `ground_low`; where it turns
    up it brightens by up to `light`. The metal line is not shaded.
    Map it with UVs s / width across and z / height up; the tangent frame must
    come from those same UVs.
    """
    line_segs = _segments(strokes, width, period_shifts)
    ridge_segs = _segments(ridges, width, period_shifts) if ridges else None
    s_axis = (np.arange(cols) + 0.5) / cols * width
    z_axis = (np.arange(rows) + 0.5) / rows * height
    coverage = np.zeros((rows, cols))
    h = np.zeros((rows, cols))
    texel = min(width / cols, height / rows)
    idx = np.arange(cols)
    for r in range(rows):  # one row at a time keeps memory flat
        p = np.stack((s_axis, np.full(cols, z_axis[r])), axis=1)
        d, _, w, ap, ab, _ = _nearest(p, line_segs)
        inside = d - w
        k = np.argmin(inside, axis=1)
        coverage[r] = np.clip(0.5 - inside[idx, k] / texel, 0, 1)
        dk, wk = d[idx, k], np.maximum(w[idx, k], 1e-6)
        h[r] = ridge * np.sqrt(np.clip(1 - (dk / wk) ** 2, 0, 1))
        if relief:
            # Every segment's roll on its own side, the strongest kept. Taking only the nearest
            # segment's side left a cliff wherever the nearest segment changed hands: between the
            # turns of a curl and out from a stroke's end.
            length = np.sqrt(np.maximum((ab ** 2).sum(axis=1), 1e-18))[None]
            along = (ap * ab[None]).sum(axis=2) / length
            past_end = np.maximum(np.maximum(-along, along - length), 0)
            across = side * (ab[None, :, 0] * ap[..., 1] - ab[None, :, 1] * ap[..., 0]) / length
            on_side = np.clip(across / 0.0015, 0, 1)
            roll = (relief * (1 - np.exp(-d / 0.004)) * np.exp(-(d / reach) ** 2)
                    * on_side * on_side * (3 - 2 * on_side) * np.exp(-(past_end / (0.5 * reach)) ** 2))
            h[r] += roll.max(axis=1)
        if ridge_segs is not None:
            d, _, w, _, _, hh = _nearest(p, ridge_segs)
            bump = hh * np.cos(np.pi / 2 * np.clip(d / np.maximum(w, 1e-6), 0, 1)) ** 2
            h[r] += bump.max(axis=1)
    dh_ds = np.gradient(h, width / cols, axis=1)
    dh_dz = np.gradient(h, height / rows, axis=0)
    normal = np.dstack((-dh_ds, -dh_dz, np.ones_like(h)))
    normal /= np.linalg.norm(normal, axis=2, keepdims=True)
    g, l = np.array(srgb(ground)), np.array(srgb(line))
    ground_map = np.broadcast_to(g, (rows, cols, 3)).copy()
    if ground_low is not None or light:
        key = np.array([0.0, 0.5, 0.866])  # a light above, 30 degrees off the surface normal
        lit = normal @ key - key[2]  # 0 on flat ground, below 0 where the relief turns down
        if ground_low is not None:
            low = np.array(srgb(ground_low))
            shadow = np.clip(-lit / 0.35, 0, 1)[..., None]
            ground_map = ground_map * (1 - shadow) + low[None, None] * shadow
        ground_map *= 1 + light * np.clip(lit / (1 - key[2]), 0, 1)[..., None]
    colour = ground_map * (1 - coverage[..., None]) + l[None, None] * coverage[..., None]
    gt, lt = np.array(ground_trm), np.array(line_trm)
    trm = gt[None, None] * (1 - coverage[..., None]) + lt[None, None] * coverage[..., None]
    return {'color': _image(f'{name}_color', colour, True), 'trm': _image(f'{name}_trm', trm, False),
            'normal': _image(f'{name}_normal', normal * 0.5 + 0.5, False)}


def attach_inlay(material, maps, strength=1.0):
    """Wire `inlay` maps into a Principled material: colour, transmission, roughness, metallic, normal."""
    nt = material.node_tree
    bsdf = next(node for node in nt.nodes if node.type == 'BSDF_PRINCIPLED')
    colour = nt.nodes.new('ShaderNodeTexImage')
    colour.image = maps['color']
    trm = nt.nodes.new('ShaderNodeTexImage')
    trm.image = maps['trm']
    split = nt.nodes.new('ShaderNodeSeparateColor')
    nt.links.new(colour.outputs['Color'], bsdf.inputs['Base Color'])
    nt.links.new(trm.outputs['Color'], split.inputs['Color'])
    nt.links.new(split.outputs['Red'], bsdf.inputs['Transmission Weight'])
    nt.links.new(split.outputs['Green'], bsdf.inputs['Roughness'])
    nt.links.new(split.outputs['Blue'], bsdf.inputs['Metallic'])
    return attach_normal(material, maps['normal'], strength)
