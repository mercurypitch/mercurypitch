"""Principled BSDF materials that survive glTF export and read well in three.js.

Only Principled BSDF inputs the exporter recognises are used (no procedural
textures, no Glass BSDF). Blender 5.2 writes transmission and IOR as
KHR_materials_transmission / KHR_materials_ior. It does NOT write
KHR_materials_volume from the glTF Material Output group, so thickness and
attenuation are added after export by scripts/gltf_finish.py from `optics()`.
Colours are given in sRGB, as you would pick them off a concept image, and
converted to the linear values the socket and glTF expect.
"""

import bpy


def srgb(value):
    """'#d9fff4' or (r, g, b) in 0..1 sRGB -> linear (r, g, b)."""
    if isinstance(value, str):
        value = value.lstrip('#')
        value = tuple(int(value[i:i + 2], 16) / 255 for i in range(0, 6, 2))

    def lin(c):
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

    return tuple(lin(c) for c in value)


def principled(name, color, *, metallic=0.0, roughness=0.5, transmission=0.0, ior=1.5, coat=0.0,
               coat_roughness=0.03, thin_film_nm=0.0, thin_film_ior=1.33, sheen=0.0, sheen_tint='#ffffff',
               sheen_roughness=0.5, backface_culling=True):
    """New material with one Principled BSDF; `color` and `sheen_tint` are sRGB (hex or tuple).

    Sheen exports as KHR_materials_sheen: a soft tinted glow toward grazing angles,
    the pearl on opal glass. The exporter writes Sheen Tint as sheenColorFactor and
    drops Sheen Weight, so the weight is folded into the tint here (weight 1, tint
    x sheen): Cycles renders the same product, and three.js gets the intended
    strength instead of full sheen, which darkened an inlaid gold line to copper.
    Thin film needs gltf_finish.py to reach three.js.
    """
    mat = bpy.data.materials.new(name)
    if mat.node_tree is None:  # older builds; 5.x creates the tree already
        mat.use_nodes = True
    bsdf = next(node for node in mat.node_tree.nodes if node.type == 'BSDF_PRINCIPLED')
    linear = srgb(color)
    values = {
        'Base Color': (*linear, 1.0),
        'Metallic': metallic,
        'Roughness': roughness,
        'Transmission Weight': transmission,
        'IOR': ior,
        'Coat Weight': coat,
        'Coat Roughness': coat_roughness,
        'Thin Film Thickness': thin_film_nm,
        'Thin Film IOR': thin_film_ior,
        'Sheen Weight': 1.0 if sheen else 0.0,
        'Sheen Tint': (*(c * sheen for c in srgb(sheen_tint)), 1.0),
        'Sheen Roughness': sheen_roughness,
    }
    for socket, value in values.items():
        bsdf.inputs[socket].default_value = value
    mat.use_backface_culling = backface_culling
    mat.diffuse_color = (*linear, 1.0)  # Workbench MATERIAL colour and viewport
    mat.metallic = metallic
    mat.roughness = roughness
    return mat


# Presets for the Glassworks palette. Tune per asset in its build script; the
# numbers here are starting points that render plausibly in Cycles and three.js.

def opal_glass(name='glass_shell', tint='#e2f4ef'):
    """Pearl-opal glass: mostly transmissive, faintly milky, thin-film iridescence."""
    return principled(name, tint, roughness=0.06, transmission=0.86, ior=1.47, coat=0.4,
                      thin_film_nm=380.0, thin_film_ior=1.45)


def clear_glass(name='glass_clear', tint='#eefaf6'):
    return principled(name, tint, roughness=0.03, transmission=1.0, ior=1.5)


def cut_glass(name='glass_cut', tint='#cfeee6'):
    """Fracture faces: same glass, a touch rougher so breaks catch light differently."""
    return principled(name, tint, roughness=0.14, transmission=0.8, ior=1.47)


def jade(name='jade_stone', color='#3f8a66'):
    """Polished jade: translucent stone, glossy coat."""
    return principled(name, color, roughness=0.22, transmission=0.18, ior=1.61, coat=0.7,
                      coat_roughness=0.08)


def gold(name='gold_trim', color='#e8c27a', roughness=0.26, metallic=1.0):
    """Champagne gold; raise roughness for a hammered finish.

    Pure metal shows only what it reflects. Under the museum's HDR, whose ground is
    a fifth as bright as its sky and brown, gold on any surface that faces the floor
    renders copper; metallic 0.75 lets the key light's diffuse keep it gold
    (`materials-glass.md`, measured against the concept)."""
    return principled(name, color, metallic=metallic, roughness=roughness)


def marble(name='marble_ivory', color='#efe9df'):
    return principled(name, color, roughness=0.34, coat=0.25, coat_roughness=0.12)


def optics(thickness, attenuation_color='#ffffff', attenuation_distance=None):
    """KHR_materials_volume values for gltf_finish.py (thickness in metres, mesh space)."""
    spec = {'thicknessFactor': float(thickness), 'attenuationColor': list(srgb(attenuation_color))}
    if attenuation_distance is not None:
        spec['attenuationDistance'] = float(attenuation_distance)
    return spec


def _lab(rgb):
    """sRGB 0..1 to CIE Lab (D65)."""
    lin = [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in rgb]
    x = (0.4124 * lin[0] + 0.3576 * lin[1] + 0.1805 * lin[2]) / 0.95047
    y = 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2]
    z = (0.0193 * lin[0] + 0.1192 * lin[1] + 0.9505 * lin[2]) / 1.08883
    f = [t ** (1 / 3) if t > 0.008856 else 7.787 * t + 16 / 116 for t in (x, y, z)]
    return 116 * f[1] - 16, 500 * (f[0] - f[1]), 200 * (f[1] - f[2])


def _linear_from_lab(L, a, b):
    fy = (L + 16) / 116
    fx, fz = fy + a / 500, fy - b / 200
    inv = [t ** 3 if t ** 3 > 0.008856 else (t - 16 / 116) / 7.787 for t in (fx, fy, fz)]
    x, y, z = inv[0] * 0.95047, inv[1], inv[2] * 1.08883
    return (3.2406 * x - 1.5372 * y - 0.4986 * z, -0.9689 * x + 1.8758 * y + 0.0415 * z,
            0.0557 * x - 0.2040 * y + 1.0570 * z)


def _srgb_from_linear(lin):
    return tuple(min(1.0, max(0.0, 12.92 * c if c <= 0.0031308 else 1.055 * c ** (1 / 2.4) - 0.055)) for c in lin)


def push_chroma(rgb, about, gain):
    """Move an sRGB colour's chroma `gain` times further from `about`'s (both 0..1), its
    lightness and hue kept, and no further than sRGB holds: more colour play round the
    same average without washing to white, which pushing lightness does. Used where the
    renderer compresses a palette's spread (the opal's vertex colours lose about 60% of
    theirs in three.js)."""
    L, a, b = _lab(rgb)
    _, a0, b0 = _lab(about)
    da, db = (a - a0) * gain, (b - b0) * gain
    lo, hi = 0.0, 1.0
    if not all(-1e-6 <= c <= 1 + 1e-6 for c in _linear_from_lab(L, a0 + da, b0 + db)):
        for _ in range(24):  # the largest share of the push that stays inside the gamut
            mid = (lo + hi) / 2
            if all(-1e-6 <= c <= 1 + 1e-6 for c in _linear_from_lab(L, a0 + da * mid, b0 + db * mid)):
                lo = mid
            else:
                hi = mid
        da, db = da * lo, db * lo
    return _srgb_from_linear(_linear_from_lab(L, a0 + da, b0 + db))


def vertex_tint(material, attribute='Col'):
    """Multiply the material's base colour, or the colour texture feeding it, by a colour
    attribute (glTF COLOR_0). Attach a texture first, then tint.

    The exporter writes COLOR_0 for every primitive of a mesh once one material
    uses it, and three.js multiplies every one of them by it: paint the faces of
    the other materials white (`paint_corners`), or gold and jade turn pastel too.
    """
    nt = material.node_tree
    bsdf = next(node for node in nt.nodes if node.type == 'BSDF_PRINCIPLED')
    attr = nt.nodes.new('ShaderNodeVertexColor')
    attr.layer_name = attribute
    mix = nt.nodes.new('ShaderNodeMix')
    mix.data_type = 'RGBA'
    mix.blend_type = 'MULTIPLY'
    mix.inputs['Factor'].default_value = 1.0
    source = bsdf.inputs['Base Color'].links
    if source:  # a colour texture already feeds the base: tint the texture (baseColorTexture x COLOR_0)
        nt.links.new(source[0].from_socket, mix.inputs[6])
    else:
        mix.inputs[6].default_value = tuple(bsdf.inputs['Base Color'].default_value)
    nt.links.new(attr.outputs['Color'], mix.inputs[7])
    nt.links.new(mix.outputs[2], bsdf.inputs['Base Color'])
    return material


def paint_corners(obj, colour_at, only, attribute='Col'):
    """Fill a corner colour attribute: colour_at(world position) -> sRGB on faces whose
    material is named in `only`, white on every other face. A colour_at that takes two
    arguments also gets the face's material name, so one pass can tint several
    materials differently (opal patches on the glass, a darker jade foot)."""
    import inspect

    two = len(inspect.signature(colour_at).parameters) >= 2
    me = obj.data
    names = [slot.material.name if slot.material else None for slot in obj.material_slots]
    if not any(names[p.material_index] in only for p in me.polygons if p.material_index < len(names)):
        return None  # nothing here uses the tint: no attribute, so nothing is written for it
    layer = me.color_attributes.get(attribute) or me.color_attributes.new(attribute, 'BYTE_COLOR', 'CORNER')
    world = obj.matrix_world
    for poly in me.polygons:
        tinted = names[poly.material_index] in only if poly.material_index < len(names) else False
        for li in poly.loop_indices:
            if tinted:
                co = world @ me.vertices[me.loops[li].vertex_index].co
                rgb = colour_at(co, names[poly.material_index]) if two else colour_at(co)
            else:
                rgb = (1.0, 1.0, 1.0)
            layer.data[li].color_srgb = (*rgb, 1.0)
    me.color_attributes.active_color = layer
    return layer
