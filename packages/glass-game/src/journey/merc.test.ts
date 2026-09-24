// Journey Merc tests — the rendered footprint stays centred on every destination.

import { Box3, BoxGeometry, Group, Mesh, MeshStandardMaterial, Texture, Vector3, } from 'three'
import { describe, expect, it, vi } from 'vitest'
import { FLOATING_MUSEUM_JOURNEY } from '../content/museum-journey'
import { disposeObject } from '../render/dispose'
import { createJourneyMerc } from './merc'

function mascot() {
  const scene = new Group()
  // A deliberately off-centre donor catches reliance on its original origin.
  const geometry = new BoxGeometry(1.4, 2, 1)
  geometry.translate(1.5, 2.8, -2)
  const mesh = new Mesh(
    geometry,
    new MeshStandardMaterial({ map: new Texture() }),
  )
  mesh.name = 'merc_body'
  scene.add(mesh)
  const dispose = vi.fn(() => {
    disposeObject(scene)
  })
  return { scene, animations: [], dispose }
}

describe('journey mascot standing position', () => {
  it('retires the metallic override and original donor texture once', () => {
    const document = mascot()
    const mesh = document.scene.children[0] as Mesh<
      BoxGeometry,
      MeshStandardMaterial
    >
    const original = mesh.material
    const disposeOriginal = vi.spyOn(original, 'dispose')
    const disposeMap = vi.spyOn(original.map!, 'dispose')
    const merc = createJourneyMerc(document, FLOATING_MUSEUM_JOURNEY.stages[0]!)
    const disposeMetal = vi.spyOn(mesh.material, 'dispose')
    expect(disposeOriginal).not.toHaveBeenCalled()
    merc.dispose()
    merc.dispose()
    expect(mesh.material).toBe(original)
    expect(disposeOriginal).toHaveBeenCalledOnce()
    expect(disposeMap).toHaveBeenCalledOnce()
    expect(disposeMetal).toHaveBeenCalledOnce()
  })
  it('centres the rendered footprint above all four marker surfaces', () => {
    const document = mascot()
    const merc = createJourneyMerc(document, FLOATING_MUSEUM_JOURNEY.stages[0]!)
    for (const stage of FLOATING_MUSEUM_JOURNEY.stages) {
      merc.setTarget(stage, true)
      const bounds = new Box3().setFromObject(merc.root)
      const centre = bounds.getCenter(new Vector3())
      expect(centre.x).toBeCloseTo(stage.position[0], 6)
      expect(centre.z).toBeCloseTo(stage.position[2], 6)
      expect(bounds.min.y).toBeCloseTo(stage.position[1] + 0.17, 6)
      expect(bounds.getSize(new Vector3()).y).toBeCloseTo(0.68, 6)
    }
    merc.dispose()
    merc.dispose()
    expect(document.dispose).toHaveBeenCalledOnce()
  })

  it('settles at the latest selection without accumulating vertical drift', () => {
    const merc = createJourneyMerc(mascot(), FLOATING_MUSEUM_JOURNEY.stages[0]!)
    for (const stage of FLOATING_MUSEUM_JOURNEY.stages) {
      merc.setTarget(stage, false)
      merc.update(1 / 60, false)
    }
    const destination = FLOATING_MUSEUM_JOURNEY.stages[3]!
    for (let frame = 0; frame < 1200; frame++) merc.update(1 / 60, false)
    expect(merc.root.position.toArray()).toEqual([
      destination.position[0],
      destination.position[1] + 0.17,
      destination.position[2],
    ])
    const first = FLOATING_MUSEUM_JOURNEY.stages[0]!
    merc.setTarget(first, false)
    merc.update(0, true)
    expect(merc.root.position.x).toBe(first.position[0])
    expect(merc.root.position.z).toBe(first.position[2])
    merc.dispose()
  })
})
