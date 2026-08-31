// The asset contract, asserted against the real .glb files.
// ============================================================
//
// `solveShatter` takes a list of centroids and never asks where they
// came from. In the shipped scene they come from the shard nodes'
// translations in `shards-preview.glb` -- which means an art change
// can silently break the sim without a single line of TypeScript
// changing. Blender is not in CI, so these tests are the seam: they
// read the committed artefact and fail if the exporter's promises
// stop holding.
//
// Regenerate the assets with:
//   blender --background --python apps/beside-cue/art/glass/make_glass.py
//   blender --background --python apps/beside-cue/art/glass/make_shards.py

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { gzipSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import type { Vec3 } from './sim/shatter3d'
import { solveShatter } from './sim/shatter3d'
import { WORLD3D_CONFIG } from './world3d-config'

interface GltfNode {
  name?: string
  translation?: [number, number, number]
  mesh?: number
}
interface GltfMesh {
  primitives: { attributes: Record<string, number> }[]
}
interface Gltf {
  nodes: GltfNode[]
  meshes: GltfMesh[]
}

// Anchored to the vitest root (apps/beside-cue) rather than to
// import.meta.url: under vitest's transform that URL is not a real file
// path, and resolving against it silently yields `/art/glass/...`.
const assetPath = (file: string): string =>
  resolve(process.cwd(), 'art/glass', file)

/**
 * Read a .glb's JSON chunk. Hand-rolled rather than pulled from a
 * library: the container is a 12-byte header plus length-prefixed
 * chunks, and a dependency here would be a dependency in CI.
 */
const readGlb = (file: string): { gltf: Gltf; bytes: Buffer } => {
  const bytes = readFileSync(assetPath(file))
  expect(bytes.toString('utf8', 0, 4)).toBe('glTF')
  const jsonLength = bytes.readUInt32LE(12)
  const gltf = JSON.parse(bytes.toString('utf8', 20, 20 + jsonLength)) as Gltf
  return { gltf, bytes }
}

const shardNodes = (gltf: Gltf): GltfNode[] =>
  gltf.nodes.filter((n) => n.name?.startsWith('shard_') === true)

describe('the shard asset, as the sim reads it', () => {
  const { gltf, bytes } = readGlb('shards-preview.glb')
  const shards = shardNodes(gltf)

  it('ships shards at all, and every node is one', () => {
    expect(shards.length).toBeGreaterThan(60)
    expect(shards).toHaveLength(gltf.nodes.length)
  })

  it('names them shard_000 upward with no gaps', () => {
    // A gap means a shard was dropped after export, and whatever numbered
    // reference pointed at it now points at a different piece.
    const numbers = shards
      .map((n) => n.name!.match(/^shard_(\d{3})$/)?.[1])
      .map((d) => (d === undefined ? -1 : Number(d)))
      .sort((a, b) => a - b)
    expect(numbers[0]).toBe(0)
    numbers.forEach((n, i) => expect(n).toBe(i))
  })

  it('gives every shard a translation, which is its centroid', () => {
    // This is the whole contract. `make_shards.py` sets each origin to
    // the shard's centre of volume, and the exporter writes that origin
    // as the node translation -- so the loader can hand these straight
    // to solveShatter with no sidecar file and no bespoke exporter.
    for (const n of shards) {
      expect(n.translation, `${n.name} has no translation`).toBeDefined()
      expect(n.translation!.every(Number.isFinite)).toBe(true)
    }
  })

  it('places them at distinct points, so none are stacked', () => {
    const keys = new Set(
      shards.map((n) => n.translation!.map((v) => v.toFixed(5)).join(',')),
    )
    expect(keys.size).toBe(shards.length)
  })

  it('keeps them inside the bowl they were cut from', () => {
    // glTF is Y-up: y is height. A centroid outside these bounds means the
    // bisect or the export axis convention moved, and the shatter would
    // start from the wrong place.
    for (const n of shards) {
      const [x, y, z] = n.translation!
      expect(y).toBeGreaterThan(0.05)
      expect(y).toBeLessThan(0.26)
      expect(Math.hypot(x, z)).toBeLessThan(0.06)
    }
  })

  it('carries no tangents, which nothing in this scene reads', () => {
    for (const mesh of gltf.meshes) {
      for (const prim of mesh.primitives) {
        expect(Object.keys(prim.attributes)).not.toContain('TANGENT')
      }
    }
  })

  it('fits the download budget once gzipped', () => {
    // The number the plan committed to. This is the un-meshopt'd preview,
    // so the shipped asset only gets smaller.
    const gz = gzipSync(bytes).length / 1024
    expect(gz).toBeLessThan(70)
  })
})

describe('the intact glass asset', () => {
  const { gltf } = readGlb('glass-preview.glb')

  it('ships the bowl and the foot as separate nodes', () => {
    // The foot is what stays on the plinth when the bowl goes; it cannot
    // do that if it is welded into the same node.
    const names = gltf.nodes.map((n) => n.name)
    expect(names).toContain('glass_intact')
    expect(names).toContain('glass_foot')
  })
})

describe('the asset feeding the sim', () => {
  it('solves a shatter from the shipped centroids', () => {
    // The end-to-end claim: these exact numbers, out of this exact file,
    // produce a usable break. If the asset ever exports a centroid the
    // solver cannot handle, this fails here rather than on a device.
    const { gltf } = readGlb('shards-preview.glb')
    const centroids: Vec3[] = shardNodes(gltf).map((n) => ({
      x: n.translation![0],
      y: n.translation![1],
      z: n.translation![2],
    }))
    const launches = solveShatter(
      centroids,
      { x: 0, y: 0.17, z: 0 },
      1,
      WORLD3D_CONFIG.shatter,
      7,
    )
    expect(launches).toHaveLength(centroids.length)
    for (const l of launches) {
      expect(Number.isFinite(l.velocity.x)).toBe(true)
      expect(Number.isFinite(l.velocity.y)).toBe(true)
      expect(Number.isFinite(l.velocity.z)).toBe(true)
      expect(l.delay).toBeGreaterThanOrEqual(0)
    }
  })
})
