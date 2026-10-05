// Runner light tests — one prepared reflection capture, safe first shadows and temporary card ownership.
import type { Mesh, WebGLRenderer } from 'three'
import { Group, Scene } from 'three'
import { describe, expect, it, vi } from 'vitest'
import type { createMuseumEnvironment } from './environment'
import { resolveGlassRenderQuality } from './render-quality'
import { captureRunnerImageLight } from './runner-look'

describe('runner image lighting', () => {
  it.each(['balanced', 'high'] as const)(
    'captures the dressed %s scene once with hidden actors and owned reflection cards',
    (profile) => {
      const scene = new Scene()
      const architecture = new Group()
      const merc = new Group()
      const targets = new Group()
      scene.add(architecture, merc, targets)
      const renderer = { shadowMap: { needsUpdate: false } } as WebGLRenderer
      const quality = resolveGlassRenderQuality(profile, {
        cssWidth: 390,
        cssHeight: 844,
        coarsePointer: true,
        mobileHint: true,
      })
      let cardGeometryDispose = vi.fn()
      const cardMaterialDisposals: ReturnType<typeof vi.spyOn>[] = []
      const capture = vi.fn((position, hidden, size) => {
        expect(renderer.shadowMap.needsUpdate).toBe(true)
        expect(position.toArray()).toEqual([0, 1.3, -6])
        expect(hidden).toEqual([merc, targets])
        expect(size).toBe(profile === 'balanced' ? 128 : 256)
        const cards = scene.children.find(
          (child) =>
            child !== architecture && child !== merc && child !== targets,
        )!
        expect(cards.children).toHaveLength(2)
        const first = cards.children[0] as Mesh
        cardGeometryDispose = vi.spyOn(first.geometry, 'dispose')
        for (const child of cards.children) {
          const mesh = child as Mesh
          expect(mesh.geometry).toBe(first.geometry)
          expect(Array.isArray(mesh.material)).toBe(false)
          if (!Array.isArray(mesh.material))
            cardMaterialDisposals.push(vi.spyOn(mesh.material, 'dispose'))
        }
      })
      const environment = { capture } as unknown as ReturnType<
        typeof createMuseumEnvironment
      >
      captureRunnerImageLight(
        environment,
        renderer,
        scene,
        [merc, targets],
        quality,
      )
      expect(capture).toHaveBeenCalledOnce()
      expect(scene.children).toEqual([architecture, merc, targets])
      expect(cardGeometryDispose).toHaveBeenCalledOnce()
      cardMaterialDisposals.forEach((spy) => expect(spy).toHaveBeenCalledOnce())
    },
  )

  it('removes and disposes reflection cards even when capture fails', () => {
    const scene = new Scene()
    const renderer = { shadowMap: { needsUpdate: false } } as WebGLRenderer
    let geometryDispose = vi.fn()
    const environment = {
      capture() {
        const mesh = scene.children[0]!.children[0] as Mesh
        geometryDispose = vi.spyOn(mesh.geometry, 'dispose')
        throw new Error('capture failed')
      },
    } as unknown as ReturnType<typeof createMuseumEnvironment>
    expect(() =>
      captureRunnerImageLight(
        environment,
        renderer,
        scene,
        [],
        resolveGlassRenderQuality('balanced', {
          cssWidth: 390,
          cssHeight: 844,
          coarsePointer: true,
          mobileHint: true,
        }),
      ),
    ).toThrow('capture failed')
    expect(scene.children).toHaveLength(0)
    expect(geometryDispose).toHaveBeenCalledOnce()
  })
})
