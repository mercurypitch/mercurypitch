// ============================================================
// Plate loader: the picture the tap builds is the one the room shows
// ============================================================

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PlateSpec } from './plate-loader'
import { buildPlate, CLAIM_MS, claimPlate, hasPreload, plateDecoded, preloadPlate, releasePlate, resetPlatesForTests, srcsetOf, } from './plate-loader'

const SPEC: PlateSpec = {
  key: 'sky',
  candidates: [
    { url: '/sky-860.webp', width: 860 },
    { url: '/sky-1290.webp', width: 1290 },
  ],
  sources: [
    {
      media: '(min-aspect-ratio: 3/4)',
      candidates: [{ url: '/sky-tablet.webp', width: 1536 }],
    },
  ],
  sizes: '100vw',
}

/** jsdom has no `decode()`: each image's is a promise the test settles. */
const decodes = new Map<
  HTMLImageElement,
  Array<{ resolve: () => void; reject: (e: Error) => void }>
>()

beforeEach(() => {
  vi.useFakeTimers()
  decodes.clear()
  Object.defineProperty(HTMLImageElement.prototype, 'decode', {
    configurable: true,
    value(this: HTMLImageElement) {
      return new Promise<void>((resolve, reject) => {
        const list = decodes.get(this) ?? []
        list.push({ resolve, reject })
        decodes.set(this, list)
      })
    },
  })
})

afterEach(() => {
  resetPlatesForTests()
  vi.useRealTimers()
  Reflect.deleteProperty(HTMLImageElement.prototype, 'decode')
})

describe('buildPlate', () => {
  it('lists the sources first and gives the image the default set', () => {
    const { picture, img } = buildPlate(SPEC)
    const [source, last] = [...picture.children]
    expect(source.tagName).toBe('SOURCE')
    expect(source.getAttribute('media')).toBe('(min-aspect-ratio: 3/4)')
    expect(source.getAttribute('srcset')).toBe('/sky-tablet.webp 1536w')
    expect(source.getAttribute('sizes')).toBe('100vw')
    expect(last).toBe(img)
    expect(img.getAttribute('srcset')).toBe(
      '/sky-860.webp 860w, /sky-1290.webp 1290w',
    )
    expect(img.getAttribute('sizes')).toBe('100vw')
    expect(img.alt).toBe('')
  })

  it('writes width descriptors', () => {
    expect(srcsetOf(SPEC.candidates)).toBe(
      '/sky-860.webp 860w, /sky-1290.webp 1290w',
    )
  })
})

describe('preloadPlate and claimPlate', () => {
  it('hands the room the picture the tap built, decode already started', () => {
    preloadPlate(SPEC)
    expect(hasPreload('sky')).toBe(true)
    const started = [...decodes.keys()]
    expect(started).toHaveLength(1)

    const plate = claimPlate(SPEC)

    expect(plate.img).toBe(started[0])
    expect(hasPreload('sky')).toBe(false)
    // The decode the tap started is the one the room waits on.
    void plateDecoded(plate.img)
    expect(decodes.get(plate.img)).toHaveLength(1)
  })

  it('keeps the first preload when the tap repeats', () => {
    preloadPlate(SPEC)
    preloadPlate(SPEC)
    expect(decodes.size).toBe(1)
  })

  it('builds a fresh plate when nothing was preloaded', () => {
    const plate = claimPlate(SPEC)
    expect(plate.img.getAttribute('srcset')).toContain('/sky-1290.webp 1290w')
    expect(decodes.size).toBe(0)
  })

  it('lets go of a preload nobody claimed', () => {
    preloadPlate(SPEC)
    const [img] = [...decodes.keys()]
    vi.advanceTimersByTime(CLAIM_MS - 1)
    expect(hasPreload('sky')).toBe(true)

    vi.advanceTimersByTime(1)

    expect(hasPreload('sky')).toBe(false)
    expect(img.hasAttribute('srcset')).toBe(false)
    // A claim after that starts over.
    expect(claimPlate(SPEC).img).not.toBe(img)
  })
})

describe('releasePlate', () => {
  it('clears every file and takes the picture off the page', () => {
    const plate = buildPlate(SPEC)
    document.body.append(plate.picture)

    releasePlate(plate)

    expect(plate.picture.isConnected).toBe(false)
    for (const el of plate.picture.children) {
      expect(el.hasAttribute('srcset')).toBe(false)
      expect(el.hasAttribute('src')).toBe(false)
    }
  })
})

describe('plateDecoded', () => {
  it('asks the image once while its decode is under way', () => {
    const { img } = buildPlate(SPEC)
    const a = plateDecoded(img)
    expect(plateDecoded(img)).toBe(a)
    expect(decodes.get(img)).toHaveLength(1)
  })

  it('decodes again after a failure', async () => {
    const { img } = buildPlate(SPEC)
    const first = plateDecoded(img)
    decodes.get(img)?.[0].reject(new Error('switched'))
    await expect(first).rejects.toThrow('switched')

    const second = plateDecoded(img)

    expect(second).not.toBe(first)
    expect(decodes.get(img)).toHaveLength(2)
  })

  it('waits for the load event where the browser cannot decode', async () => {
    Reflect.deleteProperty(HTMLImageElement.prototype, 'decode')
    const { img } = buildPlate(SPEC)
    let done = false
    void plateDecoded(img).then(() => {
      done = true
    })
    await Promise.resolve()
    expect(done).toBe(false)

    img.dispatchEvent(new Event('load'))
    await Promise.resolve()

    expect(done).toBe(true)
  })
})
