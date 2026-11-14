"""Patch material factors in a GLB without Blender, to try a material in the game in minutes.

    python3 -I glb_patch.py IN.glb OUT.glb 'amber_glass:transmission=0.55,base=#ffc35a' ['gold_trim:metallic=0.6']

Each argument after the paths is `material:key=value,key=value`. Keys:

    base=#rrggbb            baseColorFactor from an sRGB hex (it multiplies any texture)
    factor=r;g;b            baseColorFactor in linear values, e.g. to warm a textured marble
    metallic=, roughness=   metallicFactor, roughnessFactor (they multiply any packed map)
    transmission=           KHR_materials_transmission factor; notransmission=1 drops the extension
    attenuation=#rrggbb     KHR_materials_volume colour; distance=, thickness= its distance and thickness
    ior=                    KHR_materials_ior
    emissive=#rrggbb        emissiveFactor; emissive_strength= KHR_materials_emissive_strength
    clearcoat=, clearcoat_roughness=   KHR_materials_clearcoat
    specular=               KHR_materials_specular factor

Only the JSON chunk changes; buffers, textures and vertex colours are untouched, so
the patched file serves straight into `runtime_proof.mjs`. Settle the winning values
in `build.py` (and `optics.json`) afterwards: a patched file is a probe, not a build.
"""

import json
import struct
import sys

GLB_MAGIC, JSON_CHUNK = 0x46546C67, 0x4E4F534A


def linear(hex_colour):
    c = [int(hex_colour[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return [x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c]


def read(path):
    data = open(path, 'rb').read()
    length = struct.unpack('<I', data[12:16])[0]
    return json.loads(data[20:20 + length]), data[20 + length:]


def write(path, gltf, rest):
    js = json.dumps(gltf, separators=(',', ':')).encode()
    while len(js) % 4:
        js += b' '
    header = struct.pack('<III', GLB_MAGIC, 2, 12 + 8 + len(js) + len(rest)) + struct.pack('<II', len(js), JSON_CHUNK)
    open(path, 'wb').write(header + js + rest)


def patch(gltf, name, settings):
    """Apply {key: value} to the material called `name`; raises KeyError for an unknown one."""
    material = next((m for m in gltf['materials'] if m.get('name') == name), None)
    if material is None:
        raise KeyError(f'no material {name!r}; the file has {[m.get("name") for m in gltf["materials"]]}')
    pbr = material.setdefault('pbrMetallicRoughness', {})
    ext = material.setdefault('extensions', {})

    def extension(key):
        return ext.setdefault(key, {})

    for key, value in settings.items():
        if key == 'base':
            pbr['baseColorFactor'] = linear(value) + [1.0]
        elif key == 'factor':
            pbr['baseColorFactor'] = [float(x) for x in value.split(';')] + [1.0]
        elif key == 'metallic':
            pbr['metallicFactor'] = float(value)
        elif key == 'roughness':
            pbr['roughnessFactor'] = float(value)
        elif key == 'transmission':
            extension('KHR_materials_transmission')['transmissionFactor'] = float(value)
        elif key == 'notransmission':
            ext.pop('KHR_materials_transmission', None)
        elif key == 'attenuation':
            extension('KHR_materials_volume')['attenuationColor'] = linear(value)
        elif key == 'distance':
            extension('KHR_materials_volume')['attenuationDistance'] = float(value)
        elif key == 'thickness':
            extension('KHR_materials_volume')['thicknessFactor'] = float(value)
        elif key == 'ior':
            extension('KHR_materials_ior')['ior'] = float(value)
        elif key == 'emissive':
            material['emissiveFactor'] = linear(value)
        elif key == 'emissive_strength':
            extension('KHR_materials_emissive_strength')['emissiveStrength'] = float(value)
        elif key == 'clearcoat':
            extension('KHR_materials_clearcoat')['clearcoatFactor'] = float(value)
        elif key == 'clearcoat_roughness':
            extension('KHR_materials_clearcoat')['clearcoatRoughnessFactor'] = float(value)
        elif key == 'specular':
            extension('KHR_materials_specular')['specularFactor'] = float(value)
        else:
            raise KeyError(f'unknown key {key!r}')
    if not ext:
        material.pop('extensions')
    used = {e for m in gltf['materials'] for e in m.get('extensions', {})}
    gltf['extensionsUsed'] = sorted(set(gltf.get('extensionsUsed', [])) | used)


def main(argv):
    if len(argv) < 3:
        raise SystemExit(__doc__)
    src, dst, specs = argv[0], argv[1], argv[2:]
    gltf, rest = read(src)
    for spec in specs:
        name, body = spec.split(':', 1)
        patch(gltf, name, dict(item.split('=', 1) for item in body.split(',')))
    write(dst, gltf, rest)
    print(f'{dst}: patched {", ".join(s.split(":", 1)[0] for s in specs)}')


if __name__ == '__main__':
    main(sys.argv[1:])
