// Journey cloudscape lifecycle — retired image decodes cannot revive a disposed sky.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createJourneySky } from './sky'

function fakeCanvas() {
  const gradient = { addColorStop: vi.fn() }
  const context = {
    createLinearGradient: () => gradient,
    createRadialGradient: () => gradient,
    fillRect: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    scale: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    drawImage: vi.fn(),
    fillStyle: '',
  }
  return { width: 0, height: 0, getContext: () => context }
}

describe('journey cloudscape lifetime', () => {
  beforeEach(() => {
    vi.stubGlobal('document', { createElement: () => fakeCanvas() })
  })
  afterEach(() => vi.unstubAllGlobals())

  it('releases a late decoded bitmap without drawing into the retired texture', async () => {
    let finishDecode!: (bitmap: ImageBitmap) => void
    const decoded = new Promise<ImageBitmap>((resolve) => {
      finishDecode = resolve
    })
    const close = vi.fn()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        blob: () => Promise.resolve(new Blob()),
      }),
    )
    const decode = vi.fn(() => decoded)
    vi.stubGlobal('createImageBitmap', decode)
    const sky = createJourneySky({ backgroundUrl: '/cloudscape.webp' })
    await vi.waitFor(() => expect(decode).toHaveBeenCalledOnce())
    const surface = sky.background.image as ReturnType<typeof fakeCanvas>
    const disposed = vi.fn()
    sky.background.addEventListener('dispose', disposed)
    sky.dispose()
    sky.dispose()
    finishDecode({ close } as unknown as ImageBitmap)
    await sky.ready
    expect(surface.getContext().drawImage).not.toHaveBeenCalled()
    expect(close).toHaveBeenCalledOnce()
    expect(disposed).toHaveBeenCalledOnce()
  })

  it('surfaces a failed cloud asset to the scene retry path', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))
    const sky = createJourneySky({ backgroundUrl: '/missing.webp' })
    await expect(sky.ready).rejects.toThrow('cloudscape could not be loaded')
    sky.dispose()
  })

  it('owns cancellation while loading so disposal stops a pending request', async () => {
    let requestSignal: AbortSignal | undefined
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, options: RequestInit) => {
        requestSignal = options.signal as AbortSignal
        return new Promise((_resolve, reject) => {
          requestSignal?.addEventListener(
            'abort',
            () => reject(new DOMException('Aborted', 'AbortError')),
            { once: true },
          )
        })
      }),
    )
    const sky = createJourneySky({ backgroundUrl: '/pending.webp' })
    sky.dispose()
    expect(requestSignal?.aborted).toBe(true)
    await expect(sky.ready).rejects.toMatchObject({ name: 'AbortError' })
  })
})
