// ============================================================
// Exhibit asset — validate a complete authored fracture before preparing an atomic replacement.
// ============================================================

import type { BufferGeometry, Object3D } from 'three'
import { Box3, Matrix4, Vector3 } from 'three'
import { createMaterialTable, flattenGeometry } from './asset-geometry'
import type { BreakableRenderRecipe } from './catalog'
import type { FracturePiece } from './fracture'
import type { MaterialLibrary } from './material-library'

export function prepareExhibitAsset(
  scene: Object3D,
  recipe: BreakableRenderRecipe,
  resolvedBundle: string,
  library: MaterialLibrary,
) {
  const count = recipe.bundleShardCounts?.[resolvedBundle] ?? recipe.shardCount
  if (
    !Number.isInteger(count) ||
    count < 1 ||
    count > 24 ||
    recipe.intactNode === undefined ||
    recipe.intactNode.length === 0 ||
    recipe.shardPrefix === undefined ||
    recipe.shardPrefix.length === 0
  )
    throw new Error(`Invalid authored fracture contract for ${resolvedBundle}`)
  const named = new Map<string, Object3D[]>()
  scene.traverse((node) => {
    if (
      node.name !== recipe.intactNode &&
      !node.name.startsWith(recipe.shardPrefix!)
    )
      return
    for (let parent = node.parent; parent; parent = parent.parent)
      if (parent.name.startsWith(recipe.shardPrefix!)) return
    const matches = named.get(node.name) ?? []
    matches.push(node)
    named.set(node.name, matches)
  })
  const requireNode = (name: string) => {
    const matches = named.get(name)
    if (matches?.length !== 1)
      throw new Error(`Expected exactly one ${name} in ${resolvedBundle}`)
    return matches[0]
  }
  const intact = requireNode(recipe.intactNode)
  const shardNames = Array.from(
    { length: count },
    (_, i) => `${recipe.shardPrefix}${String(i).padStart(3, '0')}`,
  )
  // Child primitives may have arbitrary names. Only roots with the declared
  // numbered name count; a prefixed surprise must never silently alter a break.
  const expected = new Set([recipe.intactNode, ...shardNames])
  for (const name of named.keys())
    if (!expected.has(name))
      throw new Error(`Unexpected fracture node ${name} in ${resolvedBundle}`)
  const shards = shardNames.map(requireNode)
  const bounds = new Box3().setFromObject(intact)
  const height = bounds.max.y - bounds.min.y
  if (bounds.isEmpty() || !Number.isFinite(height) || height <= 0)
    throw new Error(`Invalid intact bounds in ${resolvedBundle}`)
  const scale = recipe.displayHeight / height
  const transform = new Matrix4()
    .makeScale(scale, scale, scale)
    .multiply(
      new Matrix4().makeTranslation(
        -(bounds.min.x + bounds.max.x) / 2,
        -bounds.min.y,
        -(bounds.min.z + bounds.max.z) / 2,
      ),
    )
  const table = createMaterialTable(library)
  const owned: BufferGeometry[] = []
  try {
    const geometry = flattenGeometry(intact, transform, table)
    owned.push(geometry)
    const pieces: FracturePiece[] = shards.map((shard) => {
      const part = flattenGeometry(shard, transform, table)
      owned.push(part)
      part.computeBoundingBox()
      const centre = part.boundingBox!.getCenter(new Vector3())
      part.translate(-centre.x, -centre.y, -centre.z)
      return { geometry: part, centre }
    })
    return { geometry, pieces, materials: table.materials, transform }
  } catch (error) {
    owned.forEach((geometry) => geometry.dispose())
    throw error
  }
}
