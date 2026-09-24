// Collected portrait fracture regression — the authored image rides every shard, then returns intact in its retained frame.

import { readFileSync } from 'node:fs'
import type { Group, Mesh, MeshPhysicalMaterial } from 'three'
import { BoxGeometry, Group as ThreeGroup, MeshPhysicalMaterial as ThreeMeshPhysicalMaterial, Texture, Vector3, } from 'three'
import { describe, expect, it } from 'vitest'
import { GLASSWORKS_JOURNEY } from '../content/glassworks-journey'
import { SHATTER_LIFECYCLE_SECONDS, SHATTER_PRESENTATION_TIMING, } from '../core/shatter-presentation'
import { getBreakableRenderRecipe } from './catalog'
import { createVessel } from './vessels'

const portraitTarget = GLASSWORKS_JOURNEY.breakables.find((item) =>
  item.id.endsWith('/portrait/encounter/portrait-finale'),
)!
const archiveTarget = GLASSWORKS_JOURNEY.breakables.find((item) =>
  item.id.endsWith('/archive/encounter/archive-glazing'),
)!

function legendSlabJson() {
  const bytes = readFileSync(
    new URL(
      '../../../../apps/beside-cue/public/games/adventure/legend-slab.glb',
      import.meta.url,
    ),
  )
  return JSON.parse(
    bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString(),
  ) as {
    materials: { name?: string }[]
    meshes: { primitives: { material?: number }[] }[]
    nodes: { children?: number[]; mesh?: number; name?: string }[]
  }
}

function portraitMaterial(mesh: Mesh): MeshPhysicalMaterial | undefined {
  const materials = Array.isArray(mesh.material)
    ? mesh.material
    : [mesh.material]
  return materials.find((material) => material.name === 'legend_portrait') as
    | MeshPhysicalMaterial
    | undefined
}

function authoredFracture(vessel: ReturnType<typeof createVessel>) {
  const sourceGlass = new ThreeMeshPhysicalMaterial()
  sourceGlass.name = 'legend_glass'
  const sourcePortrait = new ThreeMeshPhysicalMaterial()
  sourcePortrait.name = 'legend_portrait'
  const materials = [
    vessel.materialLibrary.clone(sourceGlass),
    vessel.materialLibrary.clone(sourcePortrait),
  ]
  sourceGlass.dispose()
  sourcePortrait.dispose()
  const geometry = new BoxGeometry(0.6, 0.8, 0.05)
  const count = geometry.index!.count
  geometry.clearGroups()
  geometry.addGroup(0, count - 6, 0)
  geometry.addGroup(count - 6, 6, 1)
  const pieces = Array.from({ length: 16 }, (_, index) => {
    const piece = geometry.clone()
    return {
      geometry: piece,
      centre: new Vector3((index % 4) * 0.02, Math.floor(index / 4) * 0.02, 0),
    }
  })
  vessel.setGeometry(geometry, pieces, materials)
}

describe('picture-bearing portrait fracture', () => {
  it('keeps the archive as protective glazing and marks collected portraits as picture-bearing', () => {
    expect(getBreakableRenderRecipe(archiveTarget.variant)).toMatchObject({
      portraitFracture: 'protective-glazing',
    })
    expect(getBreakableRenderRecipe(portraitTarget.variant)).toMatchObject({
      portraitFracture: 'picture-bearing',
    })
  })

  it('ships a portrait primitive on every one of the 16 authored shard roots', () => {
    const gltf = legendSlabJson()
    const portraitMaterialIndex = gltf.materials.findIndex(
      (material) => material.name === 'legend_portrait',
    )
    expect(portraitMaterialIndex).toBeGreaterThanOrEqual(0)
    const shardRoots = gltf.nodes
      .map((node, index) => ({ ...node, index }))
      .filter((node) => node.name?.startsWith('legend_cash_shard_') === true)
    expect(shardRoots).toHaveLength(16)
    const carriesPortrait = (root: number): boolean => {
      const pending = [root]
      while (pending.length > 0) {
        const node = gltf.nodes[pending.pop()!]!
        if (
          node.mesh !== undefined &&
          gltf.meshes[node.mesh]!.primitives.some(
            (primitive) => primitive.material === portraitMaterialIndex,
          )
        )
          return true
        pending.push(...(node.children ?? []))
      }
      return false
    }
    expect(shardRoots.every((node) => carriesPortrait(node.index))).toBe(true)
  })

  it('uses independent plane and glTF texture orientation and maps all 16 authored shards', () => {
    const vessel = createVessel(portraitTarget, false)
    authoredFracture(vessel)

    const gltfTexture = new Texture()
    gltfTexture.flipY = false
    const gltfVersion = gltfTexture.version
    vessel.setPortrait(gltfTexture)

    const art = vessel.root.getObjectByName(
      `persistent-portrait-${portraitTarget.id}`,
    ) as Mesh
    const planeTexture = (art.material as MeshPhysicalMaterial).map!
    expect(planeTexture).not.toBe(gltfTexture)
    expect(planeTexture.flipY).toBe(true)
    expect(gltfTexture.flipY).toBe(false)
    expect(gltfTexture.version).toBe(gltfVersion)

    const intact = vessel.root.getObjectByName(
      `vessel-intact-${portraitTarget.id}`,
    ) as Mesh
    expect(portraitMaterial(intact)).toBeUndefined()
    const shards = vessel.root.getObjectByName(
      `vessel-shards-${portraitTarget.id}`,
    ) as Group
    expect(shards.children).toHaveLength(16)
    for (const child of shards.children) {
      const face = portraitMaterial(child as Mesh)
      expect(face).toBeDefined()
      expect(face!.map).toBe(gltfTexture)
      expect(face!.map!.flipY).toBe(false)
    }

    vessel.dispose()
  })

  it('shows the intact image through cracks, hides it only during shard flight, then restores it in the frame', () => {
    const vessel = createVessel(portraitTarget, false)
    const frame = new ThreeGroup()
    frame.name = 'retained-portrait-frame'
    vessel.addPersistent(frame)
    vessel.setPortrait(new Texture())
    const art = vessel.root.getObjectByName(
      `persistent-portrait-${portraitTarget.id}`,
    ) as Mesh
    const intact = vessel.root.getObjectByName(
      `vessel-intact-${portraitTarget.id}`,
    ) as Mesh
    const shards = vessel.root.getObjectByName(
      `vessel-shards-${portraitTarget.id}`,
    ) as Group

    vessel.update(
      {
        id: portraitTarget.id,
        charge: 0.8,
        phase: 'charging',
        brokenAt: null,
      },
      0,
    )
    expect(art.visible).toBe(true)
    expect(intact.visible).toBe(true)
    expect(shards.visible).toBe(false)
    expect(
      vessel.root.children.some(
        (child) => child.type === 'LineSegments' && child.visible,
      ),
    ).toBe(true)

    vessel.update(
      {
        id: portraitTarget.id,
        charge: 1,
        phase: 'shattering',
        brokenAt: 0,
      },
      SHATTER_PRESENTATION_TIMING.normal.anticipationSeconds / 2,
    )
    expect(art.visible).toBe(true)
    expect(intact.visible).toBe(true)

    vessel.update(
      {
        id: portraitTarget.id,
        charge: 1,
        phase: 'shattering',
        brokenAt: 0,
      },
      SHATTER_PRESENTATION_TIMING.normal.anticipationSeconds + 0.2,
    )
    expect(art.visible).toBe(false)
    expect(intact.visible).toBe(false)
    expect(shards.visible).toBe(true)
    expect(frame.visible).toBe(true)

    vessel.update(
      { id: portraitTarget.id, charge: 1, phase: 'complete', brokenAt: 0 },
      SHATTER_LIFECYCLE_SECONDS,
    )
    expect(shards.visible).toBe(false)
    expect(art.visible).toBe(true)
    expect(frame.visible).toBe(true)

    vessel.update(
      {
        id: portraitTarget.id,
        charge: 1,
        phase: 'complete',
        brokenAt: null,
      },
      10,
    )
    expect(intact.visible).toBe(false)
    expect(shards.visible).toBe(false)
    expect(art.visible).toBe(true)
    expect(frame.visible).toBe(true)
    vessel.dispose()
  })

  it('restores the intact collected image after the reduced-motion shard beat', () => {
    const vessel = createVessel(portraitTarget, true)
    vessel.setPortrait(new Texture())
    const art = vessel.root.getObjectByName(
      `persistent-portrait-${portraitTarget.id}`,
    ) as Mesh
    const shards = vessel.root.getObjectByName(
      `vessel-shards-${portraitTarget.id}`,
    ) as Group
    const state = {
      id: portraitTarget.id,
      charge: 1,
      phase: 'shattering' as const,
      brokenAt: 0,
    }

    vessel.update(state, 0)
    expect(shards.visible).toBe(true)
    expect(art.visible).toBe(false)
    vessel.update(
      state,
      SHATTER_PRESENTATION_TIMING.reducedMotion.visibleFlightSeconds,
    )
    expect(shards.visible).toBe(false)
    expect(art.visible).toBe(true)
    vessel.dispose()
  })
})
