// ============================================================
// shareCard outcomes — dismissal is not delivery
// ============================================================
//
// The Web Share sheet being closed without sending used to fall through to
// the download branch: the user got a file they never asked for, and every
// call site counted it as `card_shared` — a LIVE Ads conversion. These pin
// the outcome contract the call sites now gate on.

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cardToUnfurlBlob, shareCard } from './card-renderer'

const blob = new Blob(['x'], { type: 'image/png' })

function mockShare(share: (() => Promise<void>) | undefined): void {
  Object.defineProperty(navigator, 'canShare', {
    value: share === undefined ? undefined : () => true,
    configurable: true,
  })
  Object.defineProperty(navigator, 'share', {
    value: share,
    configurable: true,
  })
}

afterEach(() => {
  mockShare(undefined)
  vi.restoreAllMocks()
})

describe('shareCard', () => {
  it('reports a completed native share', async () => {
    mockShare(() => Promise.resolve())
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click')
    expect(await shareCard(blob)).toBe('shared')
    expect(click).not.toHaveBeenCalled()
  })

  it('reports a closed sheet as dismissed, with NO forced download', async () => {
    mockShare(() =>
      Promise.reject(new DOMException('user cancelled', 'AbortError')),
    )
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click')
    expect(await shareCard(blob)).toBe('dismissed')
    expect(click).not.toHaveBeenCalled()
  })

  it('falls back to a download when the share API rejects the data', async () => {
    mockShare(() => Promise.reject(new DOMException('nope', 'NotAllowedError')))
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click')
    expect(await shareCard(blob)).toBe('downloaded')
    expect(click).toHaveBeenCalledTimes(1)
  })

  it('downloads directly where the share API does not exist', async () => {
    mockShare(undefined)
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click')
    expect(await shareCard(blob)).toBe('downloaded')
    expect(click).toHaveBeenCalledTimes(1)
  })
})

// A shared voiceprint stores its card so the link can unfurl as itself. That
// is the one thing in the Mirror that leaves the device, so it must happen
// only when a link is really on its way out.
describe('shareCard — onSheetOpening', () => {
  it('runs before the sheet opens, inside the same tap', async () => {
    const order: string[] = []
    mockShare(() => {
      order.push('share')
      return Promise.resolve()
    })
    await shareCard(blob, 'card.png', {
      onSheetOpening: () => order.push('opening'),
    })
    expect(order).toEqual(['opening', 'share'])
  })

  it('never runs where the card is only saved', async () => {
    // No share sheet: the picture downloads and the text, link included, is
    // thrown away. Storing a card for a link nobody was given would send it
    // off the device for nothing.
    mockShare(undefined)
    vi.spyOn(HTMLAnchorElement.prototype, 'click')
    const onSheetOpening = vi.fn()
    expect(await shareCard(blob, 'card.png', { onSheetOpening })).toBe(
      'downloaded',
    )
    expect(onSheetOpening).not.toHaveBeenCalled()
  })

  it('runs once even when the sheet then refuses the data', async () => {
    mockShare(() => Promise.reject(new DOMException('nope', 'NotAllowedError')))
    vi.spyOn(HTMLAnchorElement.prototype, 'click')
    const onSheetOpening = vi.fn()
    await shareCard(blob, 'card.png', { onSheetOpening })
    expect(onSheetOpening).toHaveBeenCalledTimes(1)
  })
})

// The share sheet gets a PNG; the link's unfurl gets a JPEG of the same card,
// because a painted portrait is 2 MB lossless and the store takes only JPEG.
describe('cardToUnfurlBlob', () => {
  function canvasGiving(blob: Blob | null): {
    canvas: HTMLCanvasElement
    asked: () => unknown[]
  } {
    let asked: unknown[] = []
    const canvas = {
      toBlob: (done: (b: Blob | null) => void, ...rest: unknown[]) => {
        asked = rest
        done(blob)
      },
    } as unknown as HTMLCanvasElement
    return { canvas, asked: () => asked }
  }

  it('asks for a JPEG', async () => {
    const jpeg = new Blob(['x'], { type: 'image/jpeg' })
    const { canvas, asked } = canvasGiving(jpeg)
    expect(await cardToUnfurlBlob(canvas)).toBe(jpeg)
    expect(asked()[0]).toBe('image/jpeg')
  })

  it('gives nothing rather than a picture the store would refuse', async () => {
    // A browser that ignores the type hands back a PNG.
    const png = new Blob(['x'], { type: 'image/png' })
    expect(await cardToUnfurlBlob(canvasGiving(png).canvas)).toBeNull()
    expect(await cardToUnfurlBlob(canvasGiving(null).canvas)).toBeNull()
  })
})
