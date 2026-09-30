// ============================================================
// Exhibit geometry leases — one bundle installation shares prepared geometry while each vessel owns its materials.
// ============================================================
//
// The pool keeps one construction owner until close(). Afterwards only installed
// vessels retain the geometry; the last release disposes it. No cache survives
// its bundle installation, and published vertex data must never be mutated.

import type { BufferGeometry, Material, Matrix4, Object3D } from 'three'
import type { BreakableRenderRecipe } from './catalog'
import { prepareExhibitAsset } from './exhibit-asset'
import type { FracturePiece } from './fracture'
import type { MaterialLibrary } from './material-library'
import { createMaterialLibrary } from './material-library'

export interface PreparedExhibitAssetLease {
  readonly geometry: BufferGeometry
  readonly pieces: readonly FracturePiece[]
  readonly materials: Material[]
  readonly transform: Matrix4
  /** Transfer this lease to exactly one vessel, or release it if unused. */
  release(): void
}

type PreparedExhibit = ReturnType<typeof prepareExhibitAsset>

interface SharedExhibit {
  readonly prepared: PreparedExhibit
  readonly templates: MaterialLibrary
  owners: number
}

function geometryContract(
  recipe: BreakableRenderRecipe,
  bundle: string,
): string {
  if (!Number.isFinite(recipe.displayHeight) || recipe.displayHeight <= 0)
    throw new Error(
      'Shared exhibit display height must be finite and positive.',
    )
  for (const value of [
    recipe.sourceHeight,
    recipe.barrierEnvelope?.width,
    recipe.barrierEnvelope?.height,
    recipe.barrierEnvelope?.depth,
  ])
    if (value !== undefined && (!Number.isFinite(value) || value <= 0))
      throw new Error(
        'Shared exhibit source dimensions must be finite and positive.',
      )
  return JSON.stringify([
    bundle,
    recipe.intactNode,
    recipe.shardPrefix,
    recipe.bundleShardCounts?.[bundle] ?? recipe.shardCount,
    recipe.sourceHeight,
    recipe.displayHeight,
    recipe.barrierEnvelope?.width,
    recipe.barrierEnvelope?.height,
    recipe.barrierEnvelope?.depth,
    [...new Set(recipe.scaleImportedMaterialUnits ?? [])].sort(),
  ])
}

function geometries(prepared: PreparedExhibit): Set<BufferGeometry> {
  return new Set([
    prepared.geometry,
    ...prepared.pieces.map((piece) => piece.geometry),
  ])
}

function releaseOwner(entry: SharedExhibit): void {
  entry.owners--
  if (entry.owners === 0)
    geometries(entry.prepared).forEach((geometry) => geometry.dispose())
}

function prepareSharedExhibit(
  scene: Object3D,
  recipe: BreakableRenderRecipe,
  resolvedBundle: string,
): SharedExhibit {
  const templates = createMaterialLibrary()
  let prepared: PreparedExhibit | undefined
  try {
    prepared = prepareExhibitAsset(scene, recipe, resolvedBundle, templates)
    for (const geometry of geometries(prepared)) {
      geometry.computeBoundingBox()
      geometry.computeBoundingSphere()
    }
    return { prepared, templates, owners: 1 }
  } catch (error) {
    if (prepared !== undefined)
      geometries(prepared).forEach((geometry) => geometry.dispose())
    templates.dispose()
    throw error
  }
}

export function createExhibitGeometryPool(
  scene: Object3D,
  resolvedBundle: string,
) {
  const entries = new Map<string, SharedExhibit>()
  let closed = false
  return {
    acquire(
      recipe: BreakableRenderRecipe,
      library: MaterialLibrary,
    ): PreparedExhibitAssetLease {
      if (closed) throw new Error('Exhibit geometry pool is closed.')
      const key = geometryContract(recipe, resolvedBundle)
      let entry = entries.get(key)
      if (entry === undefined) {
        entry = prepareSharedExhibit(scene, recipe, resolvedBundle)
        entries.set(key, entry)
      }
      const owner = entry
      const prepared = owner.prepared
      // Imported optics have already been scaled by preparation. Clone those
      // values, not the source GLTF materials, and never scale a lease again.
      const materials = prepared.materials.map((material) =>
        library.clone(material),
      )
      const pieces = prepared.pieces.map((piece) => ({
        geometry: piece.geometry,
        centre: piece.centre.clone(),
      }))
      const transform = prepared.transform.clone()
      owner.owners++
      let released = false
      return {
        geometry: prepared.geometry,
        pieces,
        materials,
        transform,
        release(): void {
          if (released) return
          released = true
          releaseOwner(owner)
        },
      }
    },
    close(): void {
      if (closed) return
      closed = true
      entries.forEach((entry) => {
        entry.templates.dispose()
        releaseOwner(entry)
      })
      entries.clear()
    },
  }
}
