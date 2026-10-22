"""Finish a Blender GLB for three.js: add the material extensions the 5.2.2 exporter drops.

python3 -I gltf_finish.py IN.glb OUT.glb --optics OPTICS.json [--allow-missing]

The exporter writes KHR_materials_volume and KHR_materials_iridescence only from
the glTF Material Output group node, which a scripted Principled material does
not have, so glass loses its thickness and opal its colour play. OPTICS.json
maps material names to the extension blocks to add:

  {"glass_shell": {
     "KHR_materials_volume": {"thicknessFactor": 0.02,
                              "attenuationColor": [0.86, 0.95, 0.92], "attenuationDistance": 0.35},
     "KHR_materials_iridescence": {"iridescenceFactor": 0.85, "iridescenceIor": 1.55,
                                   "iridescenceThicknessMinimum": 100, "iridescenceThicknessMaximum": 420}}}

A block without a KHR_ key is read as a KHR_materials_volume spec (see
bkit.materials.optics). three.js reads thickness in mesh units (metres here) for
its refraction offset and attenuation for tint through depth; volume needs
transmission on the same material. Only the JSON chunk changes; the binary
chunk is copied byte for byte. Run gltf_validate.mjs on the result.
"""

import json
import struct
import sys

KNOWN = {'KHR_materials_volume', 'KHR_materials_iridescence'}


def read(path):
    with open(path, 'rb') as handle:
        data = handle.read()
    magic, version, length = struct.unpack('<4sII', data[:12])
    if magic != b'glTF' or version != 2:
        raise SystemExit(f'{path}: not a glTF 2 binary')
    offset = 12
    chunks = []
    while offset < length:
        size, kind = struct.unpack('<I4s', data[offset:offset + 8])
        chunks.append((kind, data[offset + 8:offset + 8 + size]))
        offset += 8 + size
    doc = json.loads(chunks[0][1])
    return doc, [c for c in chunks[1:]]


def write(path, doc, rest):
    body = json.dumps(doc, separators=(',', ':')).encode('utf-8')
    body += b' ' * (-len(body) % 4)
    parts = [struct.pack('<I4s', len(body), b'JSON') + body]
    for kind, payload in rest:
        padded = payload + b'\0' * (-len(payload) % 4)
        parts.append(struct.pack('<I4s', len(padded), kind) + padded)
    total = 12 + sum(len(p) for p in parts)
    with open(path, 'wb') as handle:
        handle.write(struct.pack('<4sII', b'glTF', 2, total))
        for part in parts:
            handle.write(part)


def blocks(spec):
    if any(key.startswith('KHR_') for key in spec):
        unknown = set(spec) - KNOWN
        if unknown:
            raise SystemExit(f'unsupported extension blocks {sorted(unknown)}; known: {sorted(KNOWN)}')
        return spec
    return {'KHR_materials_volume': spec}


def main():
    src, dst = sys.argv[1], sys.argv[2]
    optics_path = sys.argv[sys.argv.index('--optics') + 1]
    with open(optics_path) as handle:
        optics = json.load(handle)
    doc, rest = read(src)
    used = set(doc.get('extensionsUsed', []))
    applied = {}
    for material in doc.get('materials', []):
        spec = optics.get(material.get('name'))
        if not spec:
            continue
        ext = material.setdefault('extensions', {})
        for name, block in blocks(spec).items():
            if name == 'KHR_materials_volume' and 'KHR_materials_transmission' not in ext:
                raise SystemExit(f"{material['name']}: KHR_materials_volume needs transmission; set Transmission Weight")
            ext[name] = block
            used.add(name)
            applied.setdefault(material['name'], []).append(name)
    missing = sorted(set(optics) - set(applied))
    if missing and '--allow-missing' not in sys.argv:  # an intact-only build has no cut material
        raise SystemExit(f'no material named {missing} in {src}')
    doc['extensionsUsed'] = sorted(used)
    write(dst, doc, rest)
    print(json.dumps({'out': dst, 'added': applied, 'extensionsUsed': doc['extensionsUsed']}))


if __name__ == '__main__':
    main()
