// Pearl material tests — world-grain surfaces borrow texture ownership without altering other stone.

import type { Material } from 'three'
import { MeshPhysicalMaterial, Texture } from 'three'
import { describe, expect, it, vi } from 'vitest'
import { createPearlCourtMaterial } from './cloudway-pearl-material'
import { createMaterialLibrary } from './material-library'

describe('continuous Pearl marble', () => {
  it('shares loaded map resources and preserves the museum marble material', () => {
    const map = new Texture()
    const normalMap = new Texture()
    const marble = new MeshPhysicalMaterial({ map, normalMap, roughness: 0.7 })
    const owned = new Set<Material>()
    const court = createPearlCourtMaterial(marble, owned)
    expect(court).not.toBe(marble)
    expect(court.map).toBe(map)
    expect(court.normalMap).toBe(normalMap)
    expect(court.roughness).toBe(0.7)
    expect(marble.customProgramCacheKey()).not.toBe(
      court.customProgramCacheKey(),
    )
    expect(owned.has(court)).toBe(true)
  })

  it('disposes the court material without disposing borrowed texture channels', () => {
    const library = createMaterialLibrary()
    const texture = new Texture()
    const marble = new MeshPhysicalMaterial({ map: texture })
    const court = createPearlCourtMaterial(marble, library.materials)
    const materialDisposed = vi.spyOn(court, 'dispose')
    const textureDisposed = vi.spyOn(texture, 'dispose')
    library.dispose()
    expect(materialDisposed).toHaveBeenCalledOnce()
    expect(textureDisposed).not.toHaveBeenCalled()
  })
})
