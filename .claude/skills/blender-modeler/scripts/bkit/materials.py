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
    the pearl on opal glass. Thin film needs gltf_finish.py to reach three.js.
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
        'Sheen Weight': sheen,
        'Sheen Tint': (*srgb(sheen_tint), 1.0),
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


def gold(name='gold_trim', color='#e8c27a', roughness=0.26):
    """Champagne gold; raise roughness for a hammered finish."""
    return principled(name, color, metallic=1.0, roughness=roughness)


def marble(name='marble_ivory', color='#efe9df'):
    return principled(name, color, roughness=0.34, coat=0.25, coat_roughness=0.12)


def optics(thickness, attenuation_color='#ffffff', attenuation_distance=None):
    """KHR_materials_volume values for gltf_finish.py (thickness in metres, mesh space)."""
    spec = {'thicknessFactor': float(thickness), 'attenuationColor': list(srgb(attenuation_color))}
    if attenuation_distance is not None:
        spec['attenuationDistance'] = float(attenuation_distance)
    return spec


def vertex_tint(material, attribute='Col'):
    """Multiply the material's base colour by a colour attribute (glTF COLOR_0).

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
    mix.inputs[6].default_value = tuple(bsdf.inputs['Base Color'].default_value)
    nt.links.new(attr.outputs['Color'], mix.inputs[7])
    nt.links.new(mix.outputs[2], bsdf.inputs['Base Color'])
    return material


def paint_corners(obj, colour_at, only, attribute='Col'):
    """Fill a corner colour attribute: colour_at(world position) -> sRGB on faces whose
    material is named in `only`, white on every other face."""
    me = obj.data
    layer = me.color_attributes.get(attribute) or me.color_attributes.new(attribute, 'BYTE_COLOR', 'CORNER')
    names = [slot.material.name if slot.material else None for slot in obj.material_slots]
    world = obj.matrix_world
    for poly in me.polygons:
        tinted = names[poly.material_index] in only if poly.material_index < len(names) else False
        for li in poly.loop_indices:
            if tinted:
                rgb = colour_at(world @ me.vertices[me.loops[li].vertex_index].co)
            else:
                rgb = (1.0, 1.0, 1.0)
            layer.data[li].color_srgb = (*rgb, 1.0)
    me.color_attributes.active_color = layer
    return layer
