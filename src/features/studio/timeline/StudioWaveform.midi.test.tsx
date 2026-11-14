// Studio waveform tests for a MIDI clip — its waveform draws faded to 30 % behind its notes, an audio clip's at full strength, and the canvas says how many notes it drew.
import { cleanup, render } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { studioMidiFixture } from '@/lib/studio/model/model.test-fixtures'
import { recordingRollContext } from '../notes/note-roll-context.fixture'
import { StudioWaveform } from './StudioWaveform'
import type { StudioWaveformResource } from './waveform-resource'

const frames = new Map<number, FrameRequestCallback>()
let nextFrame = 0

/** Run the frames asked for, and those they ask for, until none is left. */
async function settle(): Promise<void> {
  for (let round = 0; round < 5; round++) {
    await Promise.resolve()
    const due = [...frames.values()]
    frames.clear()
    for (const callback of due) callback(performance.now())
  }
}

beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    frames.set(++nextFrame, callback)
    return nextFrame
  })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id))
  vi.spyOn(
    HTMLCanvasElement.prototype,
    'getBoundingClientRect',
  ).mockReturnValue(new DOMRect(0, 0, 400, 40))
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  frames.clear()
})

/** Every canvas draws into `context`. */
function drawInto(context: CanvasRenderingContext2D): void {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(((
    kind: string,
  ) =>
    kind === '2d'
      ? context
      : null) as unknown as typeof HTMLCanvasElement.prototype.getContext)
}

/** A take as loud as half scale all through, at ten frames a peak. */
const loud = {
  get: () =>
    Promise.resolve({
      frameCount: 96_000,
      scale: 1 / 32_767,
      levels: [
        {
          framesPerPeak: 10,
          minima: new Int16Array(9600).fill(-16_000),
          maxima: new Int16Array(9600).fill(16_000),
          rms: new Int16Array(9600).fill(12_000),
        },
      ],
    }),
  dispose: () => undefined,
} as unknown as StudioWaveformResource

/** The waveform's own fills: the bands drawn as lines across the canvas. */
const bandFills = (paints: ReturnType<typeof recordingRollContext>['paints']) =>
  paints.filter(
    (paint) =>
      paint.op === 'fill' &&
      paint.shapes.some((shape) => shape.kind === 'line'),
  )

describe('a MIDI clip’s waveform', () => {
  it('draws faded back behind its notes, and says how many notes it drew', async () => {
    // Arrange
    const { assets, clip, sequence } = studioMidiFixture()
    const recording = recordingRollContext()
    drawInto(recording.context)

    // Act
    const { container } = render(() => (
      <StudioWaveform
        clip={clip}
        asset={assets[1]}
        resource={loud}
        width={400}
        sourceInFrame={clip.sourceInFrame}
        sourceOutFrame={clip.sourceOutFrame}
        notes={{ sequence, sound: 'piano' }}
      />
    ))
    await settle()

    // Assert
    const bands = bandFills(recording.paints)
    expect(bands.length).toBeGreaterThan(0)
    for (const band of bands) expect(band.alpha).toBeLessThanOrEqual(0.3 + 1e-9)
    expect(container.querySelector('canvas')).toHaveAttribute('data-notes', '2')
  })

  it('leaves an audio clip’s waveform at full strength', async () => {
    const { assets, clip } = studioMidiFixture()
    const recording = recordingRollContext()
    drawInto(recording.context)

    const { container } = render(() => (
      <StudioWaveform
        clip={{ ...clip, midi: undefined }}
        asset={assets[1]}
        resource={loud}
        width={400}
        sourceInFrame={clip.sourceInFrame}
        sourceOutFrame={clip.sourceOutFrame}
      />
    ))
    await settle()

    expect(bandFills(recording.paints).map((band) => band.alpha)).toContain(1)
    expect(container.querySelector('canvas')).not.toHaveAttribute('data-notes')
  })
})
