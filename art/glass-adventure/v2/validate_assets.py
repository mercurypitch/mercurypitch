"""Independently validate v2 exported transforms, surface channels and hollow fractures."""
from pathlib import Path
import hashlib
import importlib.util
import json

HERE = Path(__file__).resolve().parent
OUT = HERE.parents[2] / 'apps/beside-cue/public/games/adventure-v2'
spec = importlib.util.spec_from_file_location('glb_reader', HERE.parent / 'validate_assets.py')
reader = importlib.util.module_from_spec(spec)
spec.loader.exec_module(reader)


def centre_hits(model, name):
    """Intersect a vertical centre ray with actual exported triangles, +Y up."""
    heights = []
    for _, vertices, indices in model.primitives(name):
        for i in range(0, len(indices), 3):
            a, b, c = [vertices[indices[i+j]] for j in range(3)]
            denominator = (b[2]-c[2])*(a[0]-c[0]) + (c[0]-b[0])*(a[2]-c[2])
            if abs(denominator) < 1e-14:
                continue
            u = ((b[2]-c[2])*(-c[0]) + (c[0]-b[0])*(-c[2])) / denominator
            v = ((c[2]-a[2])*(-c[0]) + (a[0]-c[0])*(-c[2])) / denominator
            if min(u, v, 1-u-v) >= -1e-7:
                heights.append(u*a[1] + v*b[1] + (1-u-v)*c[1])
    assert heights, name
    return max(heights)


def main():
    result = {'status': 'passed', 'bundles': {}, 'breakables': {}}
    for manifest_name in ['architecture-manifest.json', 'vessels-manifest.json']:
        manifest = json.loads((HERE / manifest_name).read_text())
        records = manifest.get('bundles', {})
        if 'bundle' in manifest:
            records = {manifest['bundle']['name']: manifest['bundle']}
        for filename, record in records.items():
            path = OUT / filename
            raw = path.read_bytes()
            assert len(raw) == record['bytes']
            assert hashlib.sha256(raw).hexdigest() == record['sha256']
            model = reader.Glb(path)
            assert not model.doc.get('images'), 'Shared PBR maps must stay external'
            count = 0
            triangles = 0
            for mesh in model.doc['meshes']:
                for primitive in mesh['primitives']:
                    for channel in ['POSITION', 'NORMAL', 'TEXCOORD_0', 'TANGENT']:
                        assert channel in primitive['attributes'], (mesh['name'], channel)
                        model.accessor(primitive['attributes'][channel])
                    triangles += len(model.accessor(primitive['indices'])) // 3
                    count += 1
            result['bundles'][filename] = {'bytes': len(raw), 'sha256': record['sha256'], 'primitives': count, 'trianglesIncludingHiddenShards': triangles, 'embeddedImages': 0}
            for name, asset in manifest['assets'].items():
                assert asset['node'] in model.nodes
                for mesh in asset['meshes']:
                    assert sum(len(indices)//3 for _, _, indices in model.primitives(mesh['node'])) == mesh['triangles']
                if asset['role'] != 'breakable':
                    continue
                assert all(mesh['nonManifoldEdges'] == 0 for mesh in asset['meshes'])
                volume = model.volume(asset['intact'])
                fragments = sum(model.volume(shard) for shard in asset['shards'])
                error = abs(volume-fragments) / abs(volume)
                assert volume > 0 and error < 1e-5, (name, error)
                row = {'closedShards': len(asset['shards']), 'exportedVolumeRelativeError': error}
                if name in ['goblet_laurel', 'vase_rounded']:
                    assert len(asset['shards']) == 23
                    hit = centre_hits(model, asset['intact'])
                    assert hit < (.245 if name == 'goblet_laurel' else .025), (name, hit)
                    row['centreRayFirstSurfaceHeightMetres'] = hit
                    row['mouthIsOpen'] = True
                    for node in [asset['intact']] + asset['shards']:
                        materials = [model.doc['materials'][p['material']]['name'] for p, _, _ in model.primitives(node)]
                        assert 'glass_shell' in materials, node
                result['breakables'][name] = row
    (HERE / 'validation.json').write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps(result, indent=2))


if __name__ == '__main__':
    main()
