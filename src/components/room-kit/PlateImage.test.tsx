// ============================================================
// PlateImage: no fallback for a fast plate, a fade for a late one
// ============================================================

import { render } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PlateSpec } from './plate-loader'
import { preloadPlate, resetPlatesForTests } from './plate-loader'
import { FALLBACK_MS, PlateImage } from './PlateImage'
import styles from './PlateImage.module.css'

const SPEC: PlateSpec = {
  key: 'sky',
  candidates: [
    { url: '/sky-860.webp', width: 860 },
    { url: '/sky-1290.webp', width: 1290 },
  ],
  sizes: '100vw',
}

/** Each image's decodes, in order, for the test to settle. */
const decodes = new Map<
  HTMLImageElement,
  Array<{ resolve: () => void; reject: (e: Error) => void }>
>()

const lastDecode = () => [...decodes.values()].at(-1)?.at(-1)

/** Let the decode's promise callbacks run. */
const flush = () => vi.advanceTimersByTimeAsync(0)

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

function mount(onSettled?: (state: 'ready' | 'failed') => void) {
  const view = render(() => (
    <PlateImage
      spec={SPEC}
      fallback="linear-gradient(#071025, #182a52)"
      testId="sky"
      onSettled={onSettled}
    />
  ))
  const box = view.getByTestId('sky')
  const fallback = box.firstElementChild as HTMLElement
  return { view, box, fallback }
}

describe('PlateImage', () => {
  it('shows a plate decoded in time at once, with no fallback and no fade', async () => {
    const settled = vi.fn()
    const { box, fallback } = mount(settled)
    expect(box.dataset.state).toBe('waiting')

    lastDecode()?.resolve()
    await flush()

    expect(box.dataset.state).toBe('ready')
    expect(box.classList).not.toContain(styles.fading)
    expect(fallback.classList).not.toContain(styles.fallbackShown)
    vi.advanceTimersByTime(FALLBACK_MS)
    expect(fallback.classList).not.toContain(styles.fallbackShown)
    expect(settled).toHaveBeenCalledWith('ready')
  })

  it('shows the fallback for a slow plate, then fades the plate in over it', async () => {
    const { box, fallback } = mount()
    vi.advanceTimersByTime(FALLBACK_MS - 1)
    expect(box.dataset.state).toBe('waiting')

    vi.advanceTimersByTime(1)
    expect(box.dataset.state).toBe('fallback')
    expect(fallback.classList).toContain(styles.fallbackShown)

    lastDecode()?.resolve()
    await flush()

    expect(box.dataset.state).toBe('ready')
    expect(box.classList).toContain(styles.fading)
    // The fallback stays under the plate while it fades in.
    expect(fallback.classList).toContain(styles.fallbackShown)
  })

  it('asks once more when a decode fails, then gives up and keeps the fallback', async () => {
    const settled = vi.fn()
    const { box, fallback } = mount(settled)

    lastDecode()?.reject(new Error('switched'))
    await flush()
    expect(box.dataset.state).toBe('waiting')
    lastDecode()?.reject(new Error('broken'))
    await flush()

    expect(box.dataset.state).toBe('failed')
    expect(fallback.classList).toContain(styles.fallbackShown)
    expect(settled).toHaveBeenCalledWith('failed')
  })

  it('shows the plate when the second ask decodes it', async () => {
    const { box } = mount()
    lastDecode()?.reject(new Error('switched'))
    await flush()
    lastDecode()?.resolve()
    await flush()
    expect(box.dataset.state).toBe('ready')
  })

  it('adopts the picture the tap preloaded', () => {
    preloadPlate(SPEC)
    const [preloaded] = [...decodes.keys()]
    const { box } = mount()
    expect(box.querySelector('img')).toBe(preloaded)
  })

  it('lets the plate go when the room leaves', () => {
    const { view, box } = mount()
    const img = box.querySelector('img') as HTMLImageElement
    expect(img.getAttribute('srcset')).toContain('1290w')

    view.unmount()

    expect(img.hasAttribute('srcset')).toBe(false)
    expect(img.isConnected).toBe(false)
  })
})
