"""Procedural textures generated in bpy and embedded in the export: no files to manage.

`hammered_normal` makes a tileable tangent-space normal map of shallow hammer
dents meeting at soft ridges (Worley F1 squared): the hand-worked gold of the
Glassworks concepts, at no triangle cost. `marbled` makes a tileable colour map
of soft veins over a mottled ground, for jade and marble; `crackle` the pale
hairlines and tinted cells of opal glass. `attach_normal` and
`attach_color` wire them into a Principled material so the glTF exporter
writes them as its normalTexture and baseColorTexture. The surface needs UVs in
metres over the tile size (`lathe.lathe(uv=tile)`, `sweep.tube(uv=tile)`), or
the pattern stretches with each part's own UV scale.
"""

import colorsys
import math
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


def attach_normal(material, image, strength=1.0, scale=1.0):
    """Feed `image` through a tangent-space Normal Map node into the material's Principled BSDF.

    scale below 1 repeats the image less often than the UV tiles, as in `attach_color`."""
    nt = material.node_tree
    bsdf = next(node for node in nt.nodes if node.type == 'BSDF_PRINCIPLED')
    tex = nt.nodes.new('ShaderNodeTexImage')
    tex.image = image
    tex.interpolation = 'Linear'
    _scaled(nt, tex, scale)
    normal_map = nt.nodes.new('ShaderNodeNormalMap')
    normal_map.inputs['Strength'].default_value = strength
    nt.links.new(tex.outputs['Color'], normal_map.inputs['Color'])
    nt.links.new(normal_map.outputs['Normal'], bsdf.inputs['Normal'])
    return material


def _scaled(nt, tex, scale):
    """Drive an image node through UV x scale: the exporter writes it as KHR_texture_transform."""
    if scale == 1.0:
        return
    coords = nt.nodes.new('ShaderNodeTexCoord')
    mapping = nt.nodes.new('ShaderNodeMapping')
    mapping.inputs['Scale'].default_value = (scale, scale, 1.0)
    nt.links.new(coords.outputs['UV'], mapping.inputs['Vector'])
    nt.links.new(mapping.outputs['Vector'], tex.inputs['Vector'])


def _normals(h, ds, dz, wrap_s=True, wrap_z=False):
    """Unit tangent-space normals of a height field (rows, cols) in metres.

    Central differences that wrap along a tiled axis: np.gradient's one-sided
    differences at the array's edge put a hairline seam wherever the tile repeats."""
    def slope(axis, step, wrap):
        if wrap:
            return (np.roll(h, -1, axis=axis) - np.roll(h, 1, axis=axis)) / (2 * step)
        return np.gradient(h, step, axis=axis)

    normal = np.dstack((-slope(1, ds, wrap_s), -slope(0, dz, wrap_z), np.ones_like(h)))
    return normal / np.linalg.norm(normal, axis=2, keepdims=True)


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


def marbled(name, ground, vein, *, dark=None, light=None, light_share=0.2, size=256, veins=3, turbulence=2.2,
            softness=0.35, seed=5):
    """Tileable marbled colour map: `ground` mottled toward `dark`, crossed by soft `vein` lines.

    Colours are sRGB hex like the materials. veins: vein bands across the tile.
    turbulence: how far fractal noise pushes the veins off straight. softness:
    vein width (0..1). light: broad pale clouds over about `light_share` of the
    tile, the translucent patches of jade (not lines). Built so the tile repeats
    seamlessly in both directions.
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
    if light:
        cut = np.quantile(mottle, light_share)  # the palest share of the mottle
        cloud = np.clip((cut - mottle) / max(cut * 0.6, 1e-6) + 0.5, 0, 1) ** 1.5
        base = base * (1 - cloud[..., None] * 0.85) + np.array(srgb(light))[None, None, :] * (cloud[..., None] * 0.85)
    rgb = base * (1 - lines[..., None]) + w[None, None, :] * lines[..., None]
    image = bpy.data.images.new(name, size, size, alpha=False)
    image.colorspace_settings.name = 'sRGB'
    # a byte image holds sRGB-encoded values: encode the linear mix (gamma 2.2 is close enough)
    rgba = np.dstack((np.clip(rgb, 0, 1) ** (1 / 2.2), np.ones((size, size))))
    image.pixels.foreach_set(rgba.astype(np.float32).ravel())
    image.pack()
    return image


def _crackle_fields(cols, rows, width, height, *, cell=0.06, keep=0.6, line=0.03, tint=0.04, ground=0.95,
                    warp=0.35, hues=(135, 180, 215, 270, 325, 35), seed=11):
    """Crackle over a width x height metre tile that wraps both ways: (colour, across).

    colour: (rows, cols, 3) sRGB multiplier, cells at `ground` a little tinted and
    the cracks white. across: (rows, cols) 0..1 profile across each crack, for a
    groove. cell: a cell's size in metres. Other arguments as in `crackle`.
    """
    rng = random.Random(seed)
    nu, nv = max(1, round(width / cell)), max(1, round(height / cell))
    pts = np.array([((i + 0.1 + 0.8 * rng.random()) / nu, (j + 0.1 + 0.8 * rng.random()) / nv)
                    for i in range(nu) for j in range(nv)])
    tints = [colorsys.hsv_to_rgb((rng.choice(hues) / 360 + rng.uniform(-0.02, 0.02)) % 1.0,
                                 tint * rng.uniform(0.3, 1.0), ground * rng.uniform(0.97, 1.02)) for _ in pts]
    u, v = np.meshgrid((np.arange(cols) + 0.5) / cols, (np.arange(rows) + 0.5) / rows)
    bend = _tileable_noise(max(cols, rows), 2 * max(nu, nv), rng)[:rows, :cols]
    bend2 = _tileable_noise(max(cols, rows), 2 * max(nu, nv), rng)[:rows, :cols]
    u = (u + warp / nu * (bend - 0.5)) % 1.0
    v = (v + warp / nv * (bend2 - 0.5)) % 1.0
    f1, f2 = np.full(u.shape, np.inf), np.full(u.shape, np.inf)
    n1, n2 = np.zeros(u.shape, dtype=int), np.zeros(u.shape, dtype=int)
    for k, (px, py) in enumerate(pts):
        du, dv = np.abs(u - px), np.abs(v - py)
        d = np.hypot(np.minimum(du, 1 - du) * width, np.minimum(dv, 1 - dv) * height) / cell  # in cells, wrapped
        first, second = d < f1, (d >= f1) & (d < f2)
        f2 = np.where(first, f1, np.where(second, d, f2))
        n2 = np.where(first, n1, np.where(second, k, n2))
        f1 = np.where(first, d, f1)
        n1 = np.where(first, k, n1)
    pair = np.minimum(n1, n2) * len(pts) + np.maximum(n1, n2)
    cracked = (np.sin(pair * 12.9898 + seed * 78.233) * 43758.5453) % 1.0 < keep  # a stable coin per border
    across = np.clip(1 - (f2 - f1) / max(line, 1e-4), 0, 1) * cracked
    colour = np.array(tints)[n1] * (1 - across[..., None] ** 2) + across[..., None] ** 2
    return colour, across


def crackle(name, size=512, cells=5, tile=0.30, depth=0.0004, **fields):
    """Tileable crackle for glass: sparse wiggly hairlines over near-white cells.

    Returns {'color', 'normal'}. The colour is a multiplier for the material's own
    colour (`materials.vertex_tint` after `attach_color`): cells at `ground`, each
    a little tinted (saturation up to `tint`) toward one of `hues` (degrees), and
    white lines, so a crack reads lighter than the glass it parts. The normal map
    cuts each crack as a groove `depth` metres deep over a `tile` metres wide
    image, so its edges catch the light. cells: cells along one side. keep: the
    share of cell borders that are cracks. line: a crack's half width as a
    fraction of a cell. warp: how far noise bends the cracks off straight.
    """
    colour, across = _crackle_fields(size, size, tile, tile, cell=tile / cells, **fields)
    h = -depth * across ** 1.5
    step = tile / size
    normal = _normals(h, step, step, wrap_s=True, wrap_z=True)
    return {'color': _image(f'{name}_color', np.clip(colour, 0, 1) ** 2.2, True),  # _image takes linear
            'normal': _image(f'{name}_normal', normal * 0.5 + 0.5, False)}


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
    _scaled(nt, tex, scale)
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
          reach=0.022, side=-1, period_shifts=(-1, 0, 1, 2), ridges=(), ground_low=None, light=0.0,
          crackle=None, body_colour=None):
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
    crackle: None, or `_crackle_fields` arguments plus `depth` (metres): the same
    glass crackle as `crackle`, in this tile's metres, cut into the ground only.
    body_colour: the body of each wave, painted under its stroke on `side`: the
    ground near the line (a milky crest), deepening to this colour about 0.7
    `reach` in, and back to the ground past the reach.
    ground: an sRGB hex, or a (rows, cols, 3) field of sRGB 0..1 (row 0 at the
    bottom) when the glass carries its own colour play, as an opal band does.
    Map it with UVs s / width across and z / height up; the tangent frame must
    come from those same UVs.
    """
    line_segs = _segments(strokes, width, period_shifts)
    ridge_segs = _segments(ridges, width, period_shifts) if ridges else None
    s_axis = (np.arange(cols) + 0.5) / cols * width
    z_axis = (np.arange(rows) + 0.5) / rows * height
    coverage = np.zeros((rows, cols))
    h = np.zeros((rows, cols))
    body = np.zeros((rows, cols))
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
            side_w = on_side * on_side * (3 - 2 * on_side) * np.exp(-(past_end / (0.5 * reach)) ** 2)
            roll = relief * (1 - np.exp(-d / 0.004)) * np.exp(-(d / reach) ** 2) * side_w
            h[r] += roll.max(axis=1)
            if body_colour is not None:
                body[r] = (np.sin(np.pi * np.clip(d / (1.4 * reach), 0, 1)) ** 1.2 * side_w).max(axis=1)
        if ridge_segs is not None:
            d, _, w, _, _, hh = _nearest(p, ridge_segs)
            bump = hh * np.cos(np.pi / 2 * np.clip(d / np.maximum(w, 1e-6), 0, 1)) ** 2
            h[r] += bump.max(axis=1)
    cracks = None
    if crackle:
        options = dict(crackle)
        depth = options.pop('depth', 0.0004)
        cracks, across = _crackle_fields(cols, rows, width, height, **options)
        h -= depth * across ** 1.5 * (1 - coverage)
    normal = _normals(h, width / cols, height / rows)
    l = np.array(srgb(line))
    if isinstance(ground, str):
        ground_map = np.broadcast_to(np.array(srgb(ground)), (rows, cols, 3)).copy()
    else:  # a field: (rows, cols, 3) sRGB 0..1, row 0 at the bottom, to linear
        field = np.clip(np.asarray(ground, dtype=float), 0, 1)
        ground_map = np.where(field <= 0.04045, field / 12.92, ((field + 0.055) / 1.055) ** 2.4)
    if body_colour is not None:
        tint = np.array(srgb(body_colour))
        ground_map = ground_map * (1 - body[..., None]) + tint[None, None] * body[..., None]
    if ground_low is not None or light:
        key = np.array([0.0, 0.5, 0.866])  # a light above, 30 degrees off the surface normal
        lit = normal @ key - key[2]  # 0 on flat ground, below 0 where the relief turns down
        if ground_low is not None:
            low = np.array(srgb(ground_low))
            shadow = np.clip(-lit / 0.35, 0, 1)[..., None]
            ground_map = ground_map * (1 - shadow) + low[None, None] * shadow
        ground_map *= 1 + light * np.clip(lit / (1 - key[2]), 0, 1)[..., None]
    if cracks is not None:
        ground_map *= np.clip(cracks, 0, 1) ** 2.2  # an sRGB multiplier on linear colour
    colour = ground_map * (1 - coverage[..., None]) + l[None, None] * coverage[..., None]
    gt, lt = np.array(ground_trm), np.array(line_trm)
    trm = gt[None, None] * (1 - coverage[..., None]) + lt[None, None] * coverage[..., None]
    return {'color': _image(f'{name}_color', colour, True), 'trm': _image(f'{name}_trm', trm, False),
            'normal': _image(f'{name}_normal', normal * 0.5 + 0.5, False)}


def laurel(name, tile, height, *, pairs=2, leaf=(0.030, 0.011), angle=34.0, relief=0.0016, stem=0.0012,
           cols=256, rows=64, ground='#3a2a18', leaf_colour='#e2bd6c', ground_trm=(0.0, 0.55, 0.35),
           leaf_trm=(0.0, 0.25, 0.75)):
    """A laurel frieze as tileable maps: pairs of gold leaves along a stem, pointing toward +u.

    tile: metres along the band for one repeat, holding `pairs` leaf pairs.
    height: the frieze's height in metres (the tile does not repeat up v).
    leaf: (length, width) in metres; angle: degrees off the stem. Leaves are
    pointed lenses domed `relief` high with a midrib, the stem a rounded rod.
    Returns {'color', 'trm', 'normal'} as `inlay` does (transmission, roughness
    and metallic packed in R, G and B); `attach_inlay` wires them. Mirror the
    UVs about the front (u = |arc from the front| / tile) so the leaves run out
    both ways from a bead or stone there.
    """
    s_axis = (np.arange(cols) + 0.5) / cols * tile
    z_axis = (np.arange(rows) + 0.5) / rows * height
    s, z = np.meshgrid(s_axis, z_axis)
    mid = height / 2
    length, width = leaf
    h = np.zeros_like(s)
    cover = np.zeros_like(s)
    texel = min(tile / cols, height / rows)
    step = tile / pairs
    for k in range(-1, pairs + 1):  # one pair either side too, so leaves wrap across the tile edge
        for side in (1, -1):
            base_s = k * step + (0.25 if side > 0 else 0.75) * step  # alternate along the stem
            a = math.radians(angle) * side
            cs, sn = math.cos(a), math.sin(a)
            centre = (base_s + cs * length / 2, mid + sn * length / 2)
            ls = (s - centre[0]) * cs + (z - centre[1]) * sn  # along the leaf, from its middle
            lw = -(s - centre[0]) * sn + (z - centre[1]) * cs  # across it
            t = np.clip(1 - (2 * ls / length) ** 2, 0, None)  # 1 at the middle, 0 at base and tip
            half = width / 2 * t
            inside = np.clip(1 - (np.abs(lw) / np.maximum(half, 1e-6)) ** 2, 0, None)
            dome = relief * np.sqrt(inside * t)
            dome -= relief * 0.25 * np.exp(-(lw / (0.12 * width)) ** 2) * (inside > 0)  # the midrib
            h = np.maximum(h, dome)
            edge = np.abs(lw) - half
            cover = np.maximum(cover, np.clip(0.5 - edge / texel, 0, 1) * (t > 0))
    rod = np.clip(1 - ((z - mid) / stem) ** 2, 0, None)
    h = np.maximum(h, relief * 0.6 * np.sqrt(rod))
    cover = np.maximum(cover, np.clip(0.5 - (np.abs(z - mid) - stem) / texel, 0, 1))
    normal = _normals(h, tile / cols, height / rows)
    g, l = np.array(srgb(ground)), np.array(srgb(leaf_colour))
    # A cavity term, not a light: a leaf darkens toward its edges, so the relief still reads at
    # gameplay size where the normal map is a pixel wide.
    cavity = (0.72 + 0.28 * np.clip(h / max(relief, 1e-9), 0, 1))[..., None]
    colour = g[None, None] * (1 - cover[..., None]) + l[None, None] * cover[..., None] * cavity
    gt, lt = np.array(ground_trm), np.array(leaf_trm)
    trm = gt[None, None] * (1 - cover[..., None]) + lt[None, None] * cover[..., None]
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
    # A frieze with no glass in it (a laurel on a dark ground) keeps transmission off: an
    # all-zero channel linked anyway exports as transmission 1 times that map, and three.js
    # then draws the band in its transmission pass for nothing.
    red = np.empty(len(maps['trm'].pixels), dtype=np.float32)
    maps['trm'].pixels.foreach_get(red)
    if red[0::4].max() > 0.0:
        nt.links.new(split.outputs['Red'], bsdf.inputs['Transmission Weight'])
    nt.links.new(split.outputs['Green'], bsdf.inputs['Roughness'])
    nt.links.new(split.outputs['Blue'], bsdf.inputs['Metallic'])
    return attach_normal(material, maps['normal'], strength)
