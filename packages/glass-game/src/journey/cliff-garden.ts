// Cliff gardens — attach the planted rim authored for each museum terrace footprint.

import type { BufferGeometry, Object3D } from 'three'
import { Mesh } from 'three'
import type { JourneyAuthoredUnit } from './architecture'
import { createFirstLightCliffDetail } from './cliff-detail'

const FOLIAGE_ROOTS: Readonly<Record<string, string>> = {
  'first-light-landmass': 'map_foliage_first_light',
  'twin-galleries-landmass': 'map_foliage_twin_galleries',
  'resonance-conservatory-landmass': 'map_foliage_resonance_conservatory',
}

export const GARDEN_CLIFF_VERTICAL_SCALE = 1.65

export function hasAuthoredCliffGarden(cliff: Object3D | undefined): boolean {
  return cliff?.userData.museumEdgeVersion === 3
}

function foliageRootName(islandId: string): string {
  const root = FOLIAGE_ROOTS[islandId]
  if (root === undefined)
    throw new Error(`No authored cliff garden exists for ${islandId}.`)
  return root
}

/** Reject incomplete garden kits before the assembly allocates its own resources. */
export function validateAuthoredCliffGarden(
  scene: Object3D,
  islandIds: readonly string[],
): void {
  if (!hasAuthoredCliffGarden(scene.getObjectByName('map_cliff'))) return
  for (const islandId of islandIds) {
    const root = foliageRootName(islandId)
    if (scene.getObjectByName(root) === undefined)
      throw new Error(`Journey map kit is missing ${root}.`)
  }
}

/** The plants share the cliff transform; each prototype was fitted to its own deck. */
export function attachAuthoredCliffGarden(
  cliff: Object3D,
  islandId: string,
  authored: JourneyAuthoredUnit,
  ownedGeometries: Set<BufferGeometry>,
): void {
  if (islandId === 'first-light-landmass') {
    const rock = cliff.getObjectByName('map_cliff_geometry')
    if (
      rock instanceof Mesh &&
      rock.geometry.userData.firstLightCliffDetail !== true
    ) {
      const geometry = createFirstLightCliffDetail(rock.geometry)
      ownedGeometries.add(geometry)
      rock.geometry = geometry
    }
  }
  cliff.add(authored(foliageRootName(islandId)))
}

/** The new rock meets the existing ivory and gold trim without the old hanging apron. */
export function removeLegacyCliffApron(
  terrace: Object3D,
  ownedGeometries: Set<BufferGeometry>,
): void {
  terrace.getObjectByName('map_platform_mesh_4')?.removeFromParent()
  const trim = terrace.getObjectByName('map_platform_mesh')
  if (
    !(trim instanceof Mesh) ||
    Array.isArray(trim.material) ||
    trim.material.name !== 'map_champagne_gold'
  )
    return
  const source = trim.geometry
  const index = source.index
  const positions = source.getAttribute('position')
  if (index === null || positions === undefined) return
  // V1's gold primitive combines the rim with eight disconnected apron ribs.
  // The ribs end below -0.274; upper trim starts above -0.140. Keep crossing
  // faces too, so this removes only the apron within that empty separation.
  const retained: number[] = []
  for (let i = 0; i < index.count; i += 3) {
    const triangle = [index.getX(i), index.getX(i + 1), index.getX(i + 2)]
    if (!triangle.every((vertex) => positions.getY(vertex) < -0.27))
      retained.push(...triangle)
  }
  if (retained.length === index.count) return
  const geometry = source.clone()
  geometry.setIndex(retained)
  ownedGeometries.add(geometry)
  trim.geometry = geometry
}
