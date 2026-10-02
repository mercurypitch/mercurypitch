// ============================================================
// Exhibit asset — validate a complete authored fracture before preparing an atomic replacement.
// ============================================================

import type { BufferGeometry, Material, MeshPhysicalMaterial, Object3D, } from 'three'
import { Box3, Matrix4, Vector3 } from 'three'
import { createMaterialTable, flattenGeometry } from './asset-geometry'
import type { BreakableRenderRecipe } from './catalog'
import type { FracturePiece } from './fracture'
import type { MaterialLibrary } from './material-library'

const importedMaterialUnits = new WeakMap<
  Material,
  { readonly thickness: number; readonly attenuationDistance: number }
>()

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
    count > 48 ||
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
  if (
    recipe.sourceHeight !== undefined &&
    Math.abs(height - recipe.sourceHeight) > 0.0001
  )
    throw new Error(
      `Unexpected ${height} m source height in ${resolvedBundle}; expected ${recipe.sourceHeight} m`,
    )
  const scale = recipe.displayHeight / height
  const envelope = recipe.barrierEnvelope
  if (
    envelope !== undefined &&
    (Math.abs((bounds.max.x - bounds.min.x) * scale - envelope.width) > 0.002 ||
      Math.abs((bounds.max.z - bounds.min.z) * scale - envelope.depth) >
        0.002 ||
      Math.abs(recipe.displayHeight - envelope.height) > 0.002)
  )
    throw new Error(
      `Pane bounds do not match certified contact in ${resolvedBundle}`,
    )
  const transform = new Matrix4()
    .makeScale(scale, scale, scale)
    .multiply(
      new Matrix4().makeTranslation(
        recipe.preserveAuthoredOrigin === true
          ? 0
          : -(bounds.min.x + bounds.max.x) / 2,
        recipe.preserveAuthoredOrigin === true ? 0 : -bounds.min.y,
        recipe.preserveAuthoredOrigin === true
          ? 0
          : -(bounds.min.z + bounds.max.z) / 2,
      ),
    )
  const table = createMaterialTable(library, recipe.bakeImportedMaterialUnits)
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
    // Full baked transforms already include display scale; the legacy named
    // unit adjustment must not apply that scale a second time.
    const scaledMaterialNames = new Set(
      recipe.bakeImportedMaterialUnits === true
        ? []
        : (recipe.scaleImportedMaterialUnits ?? []),
    )
    for (const material of table.materials) {
      if (!scaledMaterialNames.has(material.name)) continue
      const physical = material as MeshPhysicalMaterial
      if (!physical.isMeshPhysicalMaterial)
        throw new Error(
          `Material ${material.name} in ${resolvedBundle} must be physical to scale metre-valued optics`,
        )
      const sourceUnits = importedMaterialUnits.get(material) ?? {
        thickness: physical.thickness,
        attenuationDistance: physical.attenuationDistance,
      }
      importedMaterialUnits.set(material, sourceUnits)
      physical.thickness = sourceUnits.thickness * scale
      physical.attenuationDistance = Number.isFinite(
        sourceUnits.attenuationDistance,
      )
        ? sourceUnits.attenuationDistance * scale
        : sourceUnits.attenuationDistance
      physical.needsUpdate = true
    }
    return { geometry, pieces, materials: table.materials, transform }
  } catch (error) {
    owned.forEach((geometry) => geometry.dispose())
    throw error
  }
}
