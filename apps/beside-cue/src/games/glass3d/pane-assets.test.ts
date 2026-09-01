// The pane's asset contract, same seam as glass-assets.test.ts.
// ============================================================
//
// Regenerate with:
//   blender --background --python apps/beside-cue/art/pane/make_pane.py

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

const readGlb = (
  file: string,
): { nodes: GltfNode[]; animations?: unknown[] } => {
  const buf = readFileSync(resolve(process.cwd(), file))
  const jsonLength = buf.readUInt32LE(12)
  return JSON.parse(buf.subarray(20, 20 + jsonLength).toString('utf8')) as {
    nodes: GltfNode[]
  }
}

// Matches art/pane/make_pane.py (Blender axes there, scene axes here:
// the Y-up export maps width to z, height to y, thickness to x).
const PANE = { width: 0.72, height: 1.05, thick: 0.006 }

describe('pane-shards.opt.glb', () => {
  const gltf = readGlb('art/pane/pane-shards.opt.glb')
  const shards = gltf.nodes.filter((n) => n.name?.startsWith('pane_') === true)

  it('carries a real break, and nothing else', () => {
    expect(shards.length).toBeGreaterThan(50)
    expect(shards.length).toBe(gltf.nodes.length)
  })

  it('names shards contiguously from pane_000', () => {
    const names = shards.map((n) => n.name).sort()
    for (const [i, name] of names.entries()) {
      expect(name).toBe(`pane_${String(i).padStart(3, '0')}`)
    }
  })

  it('puts every centroid inside the pane, finitely', () => {
    for (const n of shards) {
      const t = n.translation
      expect(t).toBeDefined()
      const [x, y, z] = t!
      expect(
        Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z),
      ).toBe(true)
      expect(Math.abs(x)).toBeLessThan(PANE.thick)
      expect(y).toBeGreaterThan(-0.01)
      expect(y).toBeLessThan(PANE.height + 0.01)
      expect(Math.abs(z)).toBeLessThan(PANE.width / 2 + 0.01)
    }
  })

  it('stays inside the gzip budget', () => {
    const raw = readFileSync(
      resolve(process.cwd(), 'art/pane/pane-shards.opt.glb'),
    )
    expect(gzipSync(raw).length).toBeLessThan(80 * 1024)
  })

  it('feeds solveShatter something it can launch', () => {
    const centroids: Vec3[] = shards.map((n) => ({
      x: n.translation![0],
      y: n.translation![1],
      z: n.translation![2],
    }))
    const launches = solveShatter(
      centroids,
      { x: 0, y: PANE.height * 0.52, z: 0 },
      1,
      WORLD3D_CONFIG.shatter,
      11,
    )
    expect(launches.length).toBe(centroids.length)
    for (const l of launches) {
      expect(Number.isFinite(l.velocity.x)).toBe(true)
      expect(Number.isFinite(l.velocity.y)).toBe(true)
      expect(Number.isFinite(l.velocity.z)).toBe(true)
    }
  })
})

describe('merc.opt.glb', () => {
  it('ships all five clips, move included', () => {
    const buf = readFileSync(resolve(process.cwd(), 'art/merc/merc.opt.glb'))
    const jsonLength = buf.readUInt32LE(12)
    const gltf = JSON.parse(
      buf.subarray(20, 20 + jsonLength).toString('utf8'),
    ) as { animations?: { name: string }[] }
    const names = (gltf.animations ?? []).map((a) => a.name).sort()
    expect(names).toEqual(['celebrate', 'fall', 'listen', 'move', 'sing'])
  })
})
