// ============================================================
// shareCard outcomes — dismissal is not delivery
// ============================================================
//
// The Web Share sheet being closed without sending used to fall through to
// the download branch: the user got a file they never asked for, and every
// call site counted it as `card_shared` — a LIVE Ads conversion. These pin
// the outcome contract the call sites now gate on.

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cardToUnfurlBlob, shareCard, shareOutcomeMessage, } from './card-renderer'

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
describe('shareCard — onLinkLeaving', () => {
  it('runs before the sheet opens, inside the same tap', async () => {
    const order: string[] = []
    mockShare(() => {
      order.push('share')
      return Promise.resolve()
    })
    await shareCard(blob, 'card.png', {
      onLinkLeaving: () => order.push('leaving'),
    })
    expect(order).toEqual(['leaving', 'share'])
  })

  it('never runs for a picture saved on its own', async () => {
    // No share sheet and no link to copy: the picture downloads and that is
    // all. Storing a card for a link nobody was given would send it off the
    // device for nothing.
    mockShare(undefined)
    vi.spyOn(HTMLAnchorElement.prototype, 'click')
    const onLinkLeaving = vi.fn()
    expect(await shareCard(blob, 'card.png', { onLinkLeaving })).toBe(
      'downloaded',
    )
    expect(onLinkLeaving).not.toHaveBeenCalled()
  })

  it('runs once even when the sheet then refuses the data', async () => {
    mockShare(() => Promise.reject(new DOMException('nope', 'NotAllowedError')))
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click')
    const onLinkLeaving = vi.fn()
    const outcome = await shareCard(blob, 'card.png', {
      link: 'https://mercurypitch.com/mirror?v=abc',
      onLinkLeaving,
    })
    // The sheet was already offered the link; it is not handed out twice.
    expect(outcome).toBe('downloaded')
    expect(click).toHaveBeenCalledTimes(1)
    expect(onLinkLeaving).toHaveBeenCalledTimes(1)
  })
})

// A desktop has no share sheet. "Share" used to save the picture and drop
// the text, link and all — so the one thing that brings a friend back never
// left the page, from any of the three places a voiceprint is shared.
describe('shareCard — where there is no share sheet', () => {
  const LINK = 'https://mercurypitch.com/mirror?v=abc&og=aB3xY9zQ01'

  function mockClipboard(writeText: ((text: string) => Promise<void>) | null) {
    Object.defineProperty(navigator, 'clipboard', {
      value: writeText === null ? undefined : { writeText },
      configurable: true,
    })
  }

  afterEach(() => mockClipboard(null))

  it('saves the picture and puts the link on the clipboard', async () => {
    mockShare(undefined)
    const writeText = vi.fn(() => Promise.resolve())
    mockClipboard(writeText)
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click')
    const onLinkLeaving = vi.fn()

    const outcome = await shareCard(blob, 'card.png', {
      text: `My voice, mapped — ${LINK}`,
      link: LINK,
      onLinkLeaving,
    })

    expect(outcome).toBe('downloaded-link-copied')
    expect(click).toHaveBeenCalledTimes(1)
    // The bare link, not the sentence: pasted alone it unfurls as the card.
    expect(writeText).toHaveBeenCalledWith(LINK)
    expect(onLinkLeaving).toHaveBeenCalledTimes(1)
  })

  it('stores nothing when the clipboard refuses', async () => {
    mockShare(undefined)
    mockClipboard(() => Promise.reject(new Error('denied')))
    vi.spyOn(HTMLAnchorElement.prototype, 'click')
    const onLinkLeaving = vi.fn()
    expect(
      await shareCard(blob, 'card.png', { link: LINK, onLinkLeaving }),
    ).toBe('downloaded')
    expect(onLinkLeaving).not.toHaveBeenCalled()
  })

  it('stores nothing where there is no clipboard at all', async () => {
    // An insecure context has no navigator.clipboard, whatever the types say.
    mockShare(undefined)
    mockClipboard(null)
    vi.spyOn(HTMLAnchorElement.prototype, 'click')
    const onLinkLeaving = vi.fn()
    expect(
      await shareCard(blob, 'card.png', { link: LINK, onLinkLeaving }),
    ).toBe('downloaded')
    expect(onLinkLeaving).not.toHaveBeenCalled()
  })

  it('leaves a card with no link exactly as it was', async () => {
    // Glass, Cosmic and the progress cards pass no link.
    mockShare(undefined)
    const writeText = vi.fn(() => Promise.resolve())
    mockClipboard(writeText)
    vi.spyOn(HTMLAnchorElement.prototype, 'click')
    expect(await shareCard(blob, 'card.png')).toBe('downloaded')
    expect(writeText).not.toHaveBeenCalled()
  })

  it('says the link was copied, because nothing else would', () => {
    expect(shareOutcomeMessage('downloaded-link-copied')).toMatch(/link/i)
    expect(shareOutcomeMessage('downloaded')).toBe('Saved — post it anywhere.')
    expect(shareOutcomeMessage('shared')).toBe('Shared!')
    expect(shareOutcomeMessage('dismissed')).toBeNull()
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
