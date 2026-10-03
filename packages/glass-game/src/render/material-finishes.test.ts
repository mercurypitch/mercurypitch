// Material finish tests — color spaces, optical units and borrowed texture lifetime.
import { ClampToEdgeWrapping, MeshPhysicalMaterial, NoColorSpace, SRGBColorSpace, Texture, } from 'three'
import { describe, expect, it, vi } from 'vitest'
import { MATERIAL_FINISH_FILES, RUNNER_MATERIAL_FINISH_TEXTURE_IDS, } from '../content/material-finishes'
import { createMaterialFinishBank, finishRunnerWallMaterial, } from './material-finishes'
import { createMaterialLibrary } from './material-library'

function fixture() {
  const textures = new Map(
    Object.keys(MATERIAL_FINISH_FILES).map((id) => [id, new Texture()]),
  )
  return { textures, bank: createMaterialFinishBank(textures) }
}

describe('authored material finish bank', () => {
  it('keeps roughness and normal linear, color in sRGB, and frost mapped to one complete pane', () => {
    const { bank } = fixture()
    const porcelain = bank.create('celadon-porcelain')
    const frost = bank.create('etched-frost-glass')
    expect(porcelain.map!.colorSpace).toBe(SRGBColorSpace)
    expect(porcelain.normalMap!.colorSpace).toBe(NoColorSpace)
    expect(frost.roughnessMap!.colorSpace).toBe(NoColorSpace)
    expect(frost.roughnessMap!.wrapS).toBe(ClampToEdgeWrapping)
    expect(frost.roughnessMap!.repeat.toArray()).toEqual([1, 1])
    expect(frost.roughnessMap!.flipY).toBe(false)
    expect(frost.roughness).toBe(1)
    expect(frost.transparent).toBe(false)
    expect(frost.opacity).toBe(1)
    expect(porcelain.transmission).toBe(0)
    expect(frost.transmission).toBeGreaterThan(0.9)
  })

  it('preserves metre-scale host thickness and charge emission while assigning semantic surfaces', () => {
    const { bank } = fixture()
    const pane = new MeshPhysicalMaterial({
      name: 'W06 optical glass',
      thickness: 0.12,
      emissive: 0x224433,
    })
    finishRunnerWallMaterial(pane, bank, true)
    expect(pane.thickness).toBe(0.12)
    expect(pane.attenuationDistance).toBe(2.2)
    expect(pane.emissive.getHex()).toBe(0x224433)
    expect(pane.userData.materialFinish).toBe('etched-frost-glass')
    const border = new MeshPhysicalMaterial({
      name: 'W04 colored border glass',
      thickness: 0.24,
    })
    finishRunnerWallMaterial(border, bank, false)
    expect(border.userData.materialFinish).toBe('amethyst-cut-crystal')
    expect(border.thickness).toBe(0.24)
    expect(border.normalMap).toBeNull()
    expect(border.roughnessMap).toBeNull()
    expect(border.roughness).toBeCloseTo(0.09)
    const opal = new MeshPhysicalMaterial({ name: 'W08 colored border glass' })
    finishRunnerWallMaterial(opal, bank, false)
    expect(opal.map).toBeNull()
    expect(opal.color.getHexString()).toBe('d9e5df')
    expect(opal.iridescence).toBe(0.24)
    const unrelated = new MeshPhysicalMaterial({
      name: 'portrait',
      roughness: 0.62,
    })
    finishRunnerWallMaterial(unrelated, bank, true)
    expect(unrelated.roughness).toBe(0.62)
    expect(unrelated.userData.materialFinish).toBeUndefined()
  })

  it('shares finish textures across independently disposed exhibit leases without mutating the source', () => {
    const { bank, textures } = fixture()
    const source = new MeshPhysicalMaterial({
      name: 'W01 optical glass',
      thickness: 0.1,
    })
    const first = createMaterialLibrary(),
      second = createMaterialLibrary()
    const a = first.clone(source) as MeshPhysicalMaterial
    const b = second.clone(source) as MeshPhysicalMaterial
    finishRunnerWallMaterial(a, bank, true)
    finishRunnerWallMaterial(b, bank, true)
    const disposed = [...textures.values()].map((texture) =>
      vi.spyOn(texture, 'dispose'),
    )
    expect(a.normalMap).toBe(b.normalMap)
    expect(source.normalMap).toBeNull()
    expect(source.userData.materialFinish).toBeUndefined()
    first.dispose()
    second.dispose()
    expect(disposed.every((spy) => spy.mock.calls.length === 0)).toBe(true)
    textures.forEach((texture) => texture.dispose())
    expect(disposed.every((spy) => spy.mock.calls.length === 1)).toBe(true)
  })

  it('does not upload unused border maps and rejects a missing mapped recipe before mutation', () => {
    const textures = new Map(
      RUNNER_MATERIAL_FINISH_TEXTURE_IDS.map((id) => [id, new Texture()]),
    )
    const bank = createMaterialFinishBank(textures)
    const material = new MeshPhysicalMaterial({
      color: '#aabbcc',
      roughness: 0.5,
    })
    bank.apply(material, 'opal-ribbon-glass', false)
    expect(material.color.getHexString()).toBe('d9e5df')
    const before = material.clone()
    expect(() => bank.apply(material, 'opal-ribbon-glass')).toThrow(
      'Missing material finish texture',
    )
    expect(material.color).toEqual(before.color)
    expect(material.roughness).toBe(before.roughness)
    expect(() => bank.apply(material, 'champagne-crystal')).not.toThrow()
    expect(textures.size).toBe(7)
  })
})
