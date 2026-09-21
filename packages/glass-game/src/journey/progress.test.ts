// Journey progress display tests — saved rewards change only owned map presentation.

import type { MeshBasicMaterial } from 'three'
import { DoubleSide, Group, Mesh, MeshStandardMaterial, PlaneGeometry, Texture, } from 'three'
import { describe, expect, it, vi } from 'vitest'
import type { MuseumJourneyDefinition } from '../content/museum-journey'
import { createJourneyProgressDisplay } from './progress'

const DEFINITION: MuseumJourneyDefinition = {
  id: 'progress-test',
  modelAssetId: 'map',
  landmasses: [],
  stages: [
    {
      id: 'gallery',
      chapterIds: ['chapter'],
      islandId: 'island',
      position: [0, 0, 0],
      architecturePosition: [0, 0, 0],
      yaw: 0,
      scale: 1,
      focus: [0, 0, 0],
      portrait: {
        position: [0, 0, 0],
        yaw: 0,
        portraitId: 'authored-monument',
      },
      kind: 'pavilion',
      accent: 'jade',
    },
  ],
  bridges: [],
  spillways: [],
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((accept, decline) => {
    resolve = accept
    reject = decline
  })
  return { promise, resolve, reject }
}

function fixture(
  loadTexture: (url: string, signal: AbortSignal) => Promise<Texture>,
) {
  const sharedMaterial = new MeshStandardMaterial({ color: 0x224943 })
  const surface = new Mesh(new PlaneGeometry(1, 1), sharedMaterial)
  surface.userData.journeyPortraitState = 'mystery'
  const sibling = new Mesh(new PlaneGeometry(1, 1), sharedMaterial)
  const mystery = new Group()
  mystery.visible = true
  const markers = [new Group(), new Group(), new Group()] as const
  markers.forEach((marker) => {
    marker.visible = false
  })
  const display = createJourneyProgressDisplay(
    DEFINITION,
    {
      starMarkers: new Map([['gallery', markers]]),
      portraitSurfaces: new Map([['authored-monument', surface]]),
      portraitMysteries: new Map([['authored-monument', mystery]]),
    },
    { loadTexture },
  )
  return { display, markers, mystery, sharedMaterial, sibling, surface }
}

describe('journey progress display', () => {
  it('shows only persisted 1–3 stars and restores authored visibility', () => {
    const { display, markers } = fixture(vi.fn())
    display.setProgress([{ stageId: 'gallery', stars: 2 }])
    expect(markers.map((marker) => marker.visible)).toEqual([true, true, false])
    display.setProgress([{ stageId: 'gallery' }])
    expect(markers.map((marker) => marker.visible)).toEqual([
      false,
      false,
      false,
    ])
    display.dispose()
    expect(markers.map((marker) => marker.visible)).toEqual([
      false,
      false,
      false,
    ])
  })

  it('uses the authored monument, keeps mystery until load, and restores shared materials', async () => {
    const pending = deferred<Texture>()
    const load = vi.fn(() => pending.promise)
    const snapshots = vi.fn()
    const sharedMaterial = new MeshStandardMaterial({ color: 0x224943 })
    const surface = new Mesh(new PlaneGeometry(1, 1), sharedMaterial)
    surface.userData.journeyPortraitState = 'mystery'
    const sibling = new Mesh(new PlaneGeometry(1, 1), sharedMaterial)
    const mystery = new Group()
    mystery.visible = true
    const markers = [new Group(), new Group(), new Group()] as const
    const display = createJourneyProgressDisplay(
      DEFINITION,
      {
        starMarkers: new Map([['gallery', markers]]),
        portraitSurfaces: new Map([['authored-monument', surface]]),
        portraitMysteries: new Map([['authored-monument', mystery]]),
      },
      { loadTexture: load, onChange: snapshots },
    )
    const sharedDispose = vi.spyOn(sharedMaterial, 'dispose')
    const texture = new Texture()
    const textureDispose = vi.spyOn(texture, 'dispose')

    display.setProgress([
      {
        stageId: 'gallery',
        portrait: { id: 'saved-collectible-id', imageUrl: '/portrait.webp' },
      },
    ])
    expect(load).toHaveBeenCalledWith('/portrait.webp', expect.any(AbortSignal))
    expect(mystery.visible).toBe(true)
    expect(surface.material).toBe(sharedMaterial)

    pending.resolve(texture)
    await pending.promise
    await vi.waitFor(() => expect(mystery.visible).toBe(false))
    expect(surface.material).not.toBe(sharedMaterial)
    expect(sibling.material).toBe(sharedMaterial)
    expect(surface.userData.journeyPortraitState).toBe('earned')
    expect(snapshots).toHaveBeenLastCalledWith({
      stars: { gallery: 0 },
      earnedPortraitIds: ['authored-monument'],
    })

    display.dispose()
    expect(surface.material).toBe(sharedMaterial)
    expect(surface.userData.journeyPortraitState).toBe('mystery')
    expect(mystery.visible).toBe(true)
    expect(textureDispose).toHaveBeenCalledOnce()
    expect(sharedDispose).not.toHaveBeenCalled()
  })

  it('aborts stale work and cannot install a late texture', async () => {
    const first = deferred<Texture>()
    let firstSignal: AbortSignal | undefined
    const load = vi.fn((_url: string, signal: AbortSignal) => {
      firstSignal = signal
      return first.promise
    })
    const { display, mystery, sharedMaterial, surface } = fixture(load)
    const staleTexture = new Texture()
    const staleDispose = vi.spyOn(staleTexture, 'dispose')

    display.setProgress([
      { stageId: 'gallery', portrait: { imageUrl: '/stale.webp' } },
    ])
    display.setProgress([])
    expect(firstSignal?.aborted).toBe(true)
    first.resolve(staleTexture)
    await first.promise
    await vi.waitFor(() => expect(staleDispose).toHaveBeenCalledOnce())
    expect(surface.material).toBe(sharedMaterial)
    expect(mystery.visible).toBe(true)
  })

  it('retries the same portrait after a failed request', async () => {
    const texture = new Texture()
    const load = vi
      .fn<(url: string, signal: AbortSignal) => Promise<Texture>>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(texture)
    const { display, mystery } = fixture(load)
    const progress = [
      { stageId: 'gallery', portrait: { imageUrl: '/portrait.webp' } },
    ] as const

    display.setProgress(progress)
    await vi.waitFor(() => expect(load).toHaveBeenCalledTimes(1))
    await vi.waitFor(() => expect(mystery.visible).toBe(true))
    display.setProgress(progress)
    await vi.waitFor(() => expect(load).toHaveBeenCalledTimes(2))
    await vi.waitFor(() => expect(mystery.visible).toBe(false))
    display.dispose()
  })

  it('uploads an upright bitmap and center-crops it without stretching', async () => {
    const bitmap = {
      width: 768,
      height: 1152,
      close: vi.fn(),
    } as unknown as ImageBitmap
    const createImageBitmap = vi.fn().mockResolvedValue(bitmap)
    vi.stubGlobal('createImageBitmap', createImageBitmap)
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(new Blob(['portrait']), {
          status: 200,
        }),
      ),
    )
    const sharedMaterial = new MeshStandardMaterial()
    const surface = new Mesh(new PlaneGeometry(0.82, 1.34), sharedMaterial)
    const mystery = new Group()
    const display = createJourneyProgressDisplay(DEFINITION, {
      starMarkers: new Map(),
      portraitSurfaces: new Map([['authored-monument', surface]]),
      portraitMysteries: new Map([['authored-monument', mystery]]),
    })

    try {
      display.setProgress([
        { stageId: 'gallery', portrait: { imageUrl: '/portrait.webp' } },
      ])
      await vi.waitFor(() => expect(mystery.visible).toBe(false))
      expect(createImageBitmap).toHaveBeenCalledWith(expect.any(Blob), {
        imageOrientation: 'flipY',
        premultiplyAlpha: 'none',
      })
      const material = surface.material as unknown as MeshBasicMaterial
      const texture = material.map!
      expect(material.side).toBe(DoubleSide)
      expect(texture.flipY).toBe(false)
      expect(texture.repeat.x).toBeCloseTo(0.82 / 1.34 / (768 / 1152))
      expect(texture.repeat.y).toBe(1)
      expect(texture.offset.x).toBeCloseTo((1 - texture.repeat.x) / 2)
      expect(texture.offset.y).toBe(0)
    } finally {
      display.dispose()
      vi.unstubAllGlobals()
    }
    expect(bitmap.close).toHaveBeenCalledOnce()
  })

  it('preserves the donor inset crop and orients its rotated glTF UVs', async () => {
    const texture = new Texture({ width: 768, height: 1152 })
    const { display, mystery, surface } = fixture(
      vi.fn().mockResolvedValue(texture),
    )
    surface.userData.journeyPortraitUv = 'authored'

    display.setProgress([
      { stageId: 'gallery', portrait: { imageUrl: '/portrait.webp' } },
    ])
    await vi.waitFor(() => expect(mystery.visible).toBe(false))

    const material = surface.material as unknown as MeshBasicMaterial
    expect(material.side).toBe(DoubleSide)
    expect(texture.repeat.toArray()).toEqual([-1, -1])
    expect(texture.offset.toArray()).toEqual([1, 1])
    display.dispose()
  })
})
