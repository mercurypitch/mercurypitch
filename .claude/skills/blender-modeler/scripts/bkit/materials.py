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

from .colour import lab as _lab  # noqa: F401  (kept for callers of the old private names)
from .colour import linear_from_lab as _linear_from_lab  # noqa: F401
from .colour import push_chroma, shift_lightness, srgb  # noqa: F401
from .colour import srgb_from_linear as _srgb_from_linear  # noqa: F401


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
