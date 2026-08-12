import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ProgressShareMoment } from './share-card'
import { describeProgressShareMoment, MAX_PROGRESS_SHARE_TRACE_POINTS, MERCURY_PRESSING_PLATE_URL, PROGRESS_SHARE_SIZES, renderProgressShareCard, sampleProgressPitchTrace, shareProgressCardBlob, } from './share-card'

interface CanvasRecorder {
  ctx: CanvasRenderingContext2D
  drawImage: ReturnType<typeof vi.fn>
  fillText: ReturnType<typeof vi.fn>
  lineTo: ReturnType<typeof vi.fn>
  filters: string[]
  colorStops: Array<[number, string]>
}

function makeCanvasRecorder(): CanvasRecorder {
  const drawImage = vi.fn()
  const fillText = vi.fn()
  const lineTo = vi.fn()
  const filters: string[] = []
  const colorStops: Array<[number, string]> = []
  const gradient = () => ({
    addColorStop: (offset: number, color: string) => {
      colorStops.push([offset, color])
    },
  })
  const context = {
    beginPath: vi.fn(),
    arc: vi.fn(),
    clip: vi.fn(),
    createLinearGradient: gradient,
    drawImage,
    fillRect: vi.fn(),
    fillText,
    lineTo,
    measureText: (text: string) => ({ width: text.length * 16 }),
    moveTo: vi.fn(),
    rect: vi.fn(),
    restore: vi.fn(),
    save: vi.fn(),
    stroke: vi.fn(),
    set filter(value: string) {
      filters.push(value)
    },
  } as unknown as CanvasRenderingContext2D
  return { ctx: context, drawImage, fillText, lineTo, filters, colorStops }
}

const moment: ProgressShareMoment = {
  claim: 'I came back four weeks in a row.',
  context: '13-week view, all recorded voice practice.',
  period: 'May–August 2026',
  facts: [
    { value: '4 weeks', label: 'active in a row' },
    { value: '3 kinds', label: 'of voice practice' },
  ],
}

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

let recorder: CanvasRecorder

beforeEach(() => {
  recorder = makeCanvasRecorder()
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
    (() =>
      recorder.ctx) as unknown as typeof HTMLCanvasElement.prototype.getContext,
  )
})

afterEach(() => {
  mockShare(undefined)
  vi.restoreAllMocks()
})

describe('renderProgressShareCard', () => {
  it.each(['square', 'feed', 'story'] as const)(
    'composes the %s format at its native export size',
    async (format) => {
      const loadPlate = vi.fn().mockResolvedValue(null)
      const canvas = await renderProgressShareCard(moment, format, {
        loadPlate,
      })

      expect({ width: canvas.width, height: canvas.height }).toEqual(
        PROGRESS_SHARE_SIZES[format],
      )
      expect(canvas).toHaveAttribute(
        'aria-label',
        expect.stringContaining(moment.claim),
      )
      expect(loadPlate).toHaveBeenCalledWith(MERCURY_PRESSING_PLATE_URL)
    },
  )

  it('keeps identity private unless a handle is explicitly supplied', async () => {
    await renderProgressShareCard(moment, 'feed', { backgroundUrl: null })
    const anonymousText = recorder.fillText.mock.calls.map(([text]) => text)
    expect(anonymousText).not.toContain('@aria')

    recorder.fillText.mockClear()
    await renderProgressShareCard({ ...moment, handle: '@aria' }, 'feed', {
      backgroundUrl: null,
    })
    const identifiedText = recorder.fillText.mock.calls.map(([text]) => text)
    expect(identifiedText).toContain('May–August 2026  ·  @aria')
  })

  it('draws no graph when the payload has no measured pitch trace', async () => {
    await renderProgressShareCard(moment, 'square', { backgroundUrl: null })
    expect(recorder.lineTo).not.toHaveBeenCalled()
  })

  it('bounds canvas trace work even for a large supplied recording', async () => {
    const points = Array.from({ length: 20_000 }, (_, index) => ({
      time: index / 100,
      pitch: 60 + Math.sin(index / 20) * 3,
    }))
    const sampled = sampleProgressPitchTrace(points)
    expect(sampled).toHaveLength(MAX_PROGRESS_SHARE_TRACE_POINTS)

    await renderProgressShareCard(
      {
        ...moment,
        trace: { points, description: 'My recorded challenge pitch contour' },
      },
      'story',
      { backgroundUrl: null },
    )
    expect(recorder.lineTo.mock.calls.length).toBeGreaterThan(0)
    expect(recorder.lineTo.mock.calls.length).toBeLessThanOrEqual(
      MAX_PROGRESS_SHARE_TRACE_POINTS * 2,
    )
  })

  it('applies plate exposure separately from the live-data scrim', async () => {
    const plate = {
      naturalWidth: 1122,
      naturalHeight: 1402,
      width: 1122,
      height: 1402,
    } as HTMLImageElement
    await renderProgressShareCard(moment, 'feed', {
      backgroundExposure: 1.35,
      dataScrimOpacity: 0.25,
      loadPlate: async () => plate,
    })

    expect(recorder.filters).toContain('brightness(1.35)')
    expect(recorder.drawImage).toHaveBeenCalledTimes(1)
    expect(recorder.colorStops).toContainEqual([0, 'rgba(3, 5, 12, 0.21)'])
  })
})

describe('Progress share accessibility', () => {
  it('describes only supplied facts, trace, period, and identity', () => {
    expect(describeProgressShareMoment(moment)).not.toContain('Shared as')
    expect(
      describeProgressShareMoment({
        ...moment,
        handle: '@aria',
        trace: {
          description: 'Recorded pitch from the weekly challenge',
          points: [
            { time: 0, pitch: 60 },
            { time: 1, pitch: 62 },
          ],
        },
      }),
    ).toContain('Recorded pitch from the weekly challenge')
  })

  it('reports native cancellation as a polite non-error with no download', async () => {
    mockShare(() =>
      Promise.reject(new DOMException('user cancelled', 'AbortError')),
    )
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click')

    const status = await shareProgressCardBlob(
      new Blob(['card'], { type: 'image/png' }),
    )

    expect(status).toMatchObject({
      outcome: 'dismissed',
      delivered: false,
      isError: false,
      role: 'status',
      live: 'polite',
    })
    expect(click).not.toHaveBeenCalled()
  })

  it('cancels before delivery when its owning identity is no longer current', async () => {
    const share = vi.fn(async () => undefined)
    mockShare(share)
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click')

    const status = await shareProgressCardBlob(
      new Blob(['card'], { type: 'image/png' }),
      { shouldDeliver: () => false },
    )

    expect(status).toMatchObject({
      outcome: 'dismissed',
      delivered: false,
      isError: false,
    })
    expect(share).not.toHaveBeenCalled()
    expect(click).not.toHaveBeenCalled()
  })

  it('reports a completed native share as delivered', async () => {
    mockShare(() => Promise.resolve())
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click')

    const status = await shareProgressCardBlob(
      new Blob(['card'], { type: 'image/png' }),
    )

    expect(status).toMatchObject({
      outcome: 'shared',
      delivered: true,
      isError: false,
      role: 'status',
      live: 'polite',
    })
    expect(click).not.toHaveBeenCalled()
  })

  it('reports the download fallback as a delivered status', async () => {
    mockShare(undefined)
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click')

    const status = await shareProgressCardBlob(
      new Blob(['card'], { type: 'image/png' }),
    )

    expect(status).toMatchObject({
      outcome: 'downloaded',
      delivered: true,
      isError: false,
      role: 'status',
    })
    expect(click).toHaveBeenCalledTimes(1)
  })

  it('uses an assertive error status when neither sharing nor download works', async () => {
    mockShare(undefined)
    vi.spyOn(URL, 'createObjectURL').mockImplementation(() => {
      throw new Error('downloads blocked')
    })

    const status = await shareProgressCardBlob(
      new Blob(['card'], { type: 'image/png' }),
    )

    expect(status).toMatchObject({
      outcome: 'failed',
      delivered: false,
      isError: true,
      role: 'alert',
      live: 'assertive',
    })
  })
})
