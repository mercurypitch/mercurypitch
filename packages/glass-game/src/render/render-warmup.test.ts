// Renderer warmup tests — loading draws cannot leak temporary visibility or culling state into play.

import { Group, Mesh, MeshBasicMaterial, PlaneGeometry } from 'three'
import { describe, expect, it, vi } from 'vitest'
import { withResidentRenderablesVisible } from './render-warmup'

function fixture() {
  const root = new Group()
  const hiddenParent = new Group()
  hiddenParent.visible = false
  const renderable = new Mesh(new PlaneGeometry(), new MeshBasicMaterial())
  renderable.visible = false
  renderable.frustumCulled = true
  hiddenParent.add(renderable)
  const unrelated = new Group()
  unrelated.visible = false
  root.add(hiddenParent, unrelated)
  return { hiddenParent, renderable, root, unrelated }
}

describe('resident renderer warmup', () => {
  it('exposes renderables and their ancestry only for the loading draw', () => {
    const { hiddenParent, renderable, root, unrelated } = fixture()
    const draw = vi.fn(() => {
      expect(root.visible).toBe(true)
      expect(hiddenParent.visible).toBe(true)
      expect(renderable.visible).toBe(true)
      expect(renderable.frustumCulled).toBe(false)
      expect(unrelated.visible).toBe(false)
    })

    withResidentRenderablesVisible(root, draw)

    expect(draw).toHaveBeenCalledOnce()
    expect(hiddenParent.visible).toBe(false)
    expect(renderable.visible).toBe(false)
    expect(renderable.frustumCulled).toBe(true)
    expect(unrelated.visible).toBe(false)
  })

  it('restores exact presentation state when the loading draw fails', () => {
    const { hiddenParent, renderable, root } = fixture()

    expect(() =>
      withResidentRenderablesVisible(root, () => {
        expect(hiddenParent.visible).toBe(true)
        expect(renderable.visible).toBe(true)
        expect(renderable.frustumCulled).toBe(false)
        throw new Error('warmup draw failed')
      }),
    ).toThrow('warmup draw failed')

    expect(hiddenParent.visible).toBe(false)
    expect(renderable.visible).toBe(false)
    expect(renderable.frustumCulled).toBe(true)
  })
})
