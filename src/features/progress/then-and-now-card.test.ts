// ============================================================
// Then-and-now card — the weekly Check-up's share card, with Merc on it
// ============================================================
//
// Drawn through the Progress card's renderer with a recording 2D context, as
// share-card.test.ts draws it, so what lands on the card is read from the
// draw calls: the facts, the address, Merc, and nothing that names anybody.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CheckupTake } from '@/lib/check-up/then-and-now'
import { thenAndNow } from '@/lib/check-up/then-and-now'
import type { MirrorSummary } from '@/lib/mirror/metrics'
import { MIRROR_SHARE_URL } from '@/lib/mirror/shared-voiceprint'
import { renderThenAndNowCard, shareThenAndNowCard, THEN_AND_NOW_CLAIM, THEN_AND_NOW_MERC_URL, } from './then-and-now-card'

interface Recorder {
  ctx: CanvasRenderingContext2D
  drawImage: ReturnType<typeof vi.fn>
  texts: () => string[]
}

function makeRecorder(): Recorder {
  const drawImage = vi.fn()
  const fillText = vi.fn()
  const ctx = {
    arc: vi.fn(),
    beginPath: vi.fn(),
    clip: vi.fn(),
    createLinearGradient: () => ({ addColorStop: vi.fn() }),
    drawImage,
    fillRect: vi.fn(),
    fillText,
    lineTo: vi.fn(),
    measureText: (text: string) => ({ width: text.length * 16 }),
    moveTo: vi.fn(),
    rect: vi.fn(),
    restore: vi.fn(),
    save: vi.fn(),
    stroke: vi.fn(),
  } as unknown as CanvasRenderingContext2D
  return {
    ctx,
    drawImage,
    texts: () => fillText.mock.calls.map(([text]) => String(text)),
  }
}

const DAY = 24 * 60 * 60 * 1000
const START = Date.parse('2026-10-05T12:00:00.000Z')

function sung(day: number, summary: Partial<MirrorSummary>): CheckupTake {
  return {
    takenAt: new Date(START + day * DAY).toISOString(),
    summary: {
      lowMidi: 43,
      highMidi: 60,
      semitones: 17,
      accuracy: 60,
      steadiness: 70,
      ...summary,
    },
  }
}

/** Range 3 semitones wider and steadiness down 6, both named; accuracy up 4,
 *  under its threshold. */
function comparison() {
  const read = thenAndNow([
    sung(0, {}),
    sung(14, { lowMidi: 41, highMidi: 61, accuracy: 64, steadiness: 64 }),
  ])
  if (read === null) throw new Error('no comparison')
  return read
}

const MERC = { naturalWidth: 512, naturalHeight: 512 } as HTMLImageElement

let recorder: Recorder

beforeEach(() => {
  recorder = makeRecorder()
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
    (() =>
      recorder.ctx) as unknown as typeof HTMLCanvasElement.prototype.getContext,
  )
})

afterEach(() => {
  vi.restoreAllMocks()
  Object.defineProperty(navigator, 'share', {
    value: undefined,
    configurable: true,
  })
  Object.defineProperty(navigator, 'canShare', {
    value: undefined,
    configurable: true,
  })
})

describe('the then-and-now card', () => {
  it('draws Merc, centred between the claim and the facts', async () => {
    const loadPlate = vi.fn(async (url: string) =>
      url === THEN_AND_NOW_MERC_URL ? MERC : null,
    )

    await renderThenAndNowCard(comparison(), 0, 'square', { loadPlate })

    expect(loadPlate).toHaveBeenCalledWith(THEN_AND_NOW_MERC_URL)
    expect(recorder.drawImage).toHaveBeenCalledWith(MERC, 390, 400, 300, 300)
  })

  it('is drawn without Merc when his picture does not load', async () => {
    await renderThenAndNowCard(comparison(), 0, 'story', {
      loadPlate: async () => null,
    })

    expect(recorder.drawImage).not.toHaveBeenCalled()
  })

  it('prints the claim, the named changes, the practice and the dates', async () => {
    await renderThenAndNowCard(comparison(), 9, 'square', {
      loadPlate: async () => null,
    })

    // The facts' labels wrap, so the face is read as one run of text.
    const face = recorder.texts().join(' ')
    expect(recorder.texts()).toEqual(
      expect.arrayContaining([
        'W E E K L Y   C H E C K - U P',
        THEN_AND_NOW_CLAIM,
        '5 Oct – 19 Oct 2026',
        'mercurypitch.com/mirror',
      ]),
    )
    expect(face).toContain('G2–C4 → F2–C#4 3 semitones wider')
    expect(face).toContain('70 → 64 steadiness down 6')
    expect(face).toContain('9 practice sessions in between')
  })

  it('never puts a change under its threshold on the card', async () => {
    await renderThenAndNowCard(comparison(), 0, 'square', {
      loadPlate: async () => null,
    })

    // Accuracy moved 4, under its 5: the card gives Now's reading alone.
    const face = recorder.texts().join(' ')
    expect(face).toContain('64 accuracy now')
    expect(face).not.toMatch(/accuracy up|60 → 64|60 and 64|about the same/)
  })

  it('names nobody: no handle, name or email on the face', async () => {
    await renderThenAndNowCard(comparison(), 0, 'story', {
      loadPlate: async () => null,
    })

    expect(recorder.texts().join(' ')).not.toMatch(/@|Shared as/)
  })
})

describe('sharing it', () => {
  it('sends the Mirror’s tagged link in the text, under the card’s own name', async () => {
    const share = vi.fn(async (_data: ShareData) => undefined)
    Object.defineProperty(navigator, 'canShare', {
      value: () => true,
      configurable: true,
    })
    Object.defineProperty(navigator, 'share', {
      value: share,
      configurable: true,
    })
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(
      function (callback: BlobCallback) {
        callback(new Blob(['card'], { type: 'image/png' }))
      },
    )

    const status = await shareThenAndNowCard(document.createElement('canvas'))

    expect(status.outcome).toBe('shared')
    const sent = share.mock.calls[0]?.[0]
    expect(sent?.text).toBe(`${THEN_AND_NOW_CLAIM}: ${MIRROR_SHARE_URL}`)
    expect(sent?.files?.[0]?.name).toMatch(
      /^check-up-then-and-now-\d{4}-\d{2}-\d{2}\.png$/,
    )
  })
})
