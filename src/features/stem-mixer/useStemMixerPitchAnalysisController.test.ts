// Pitch Studio's analysis: one at a time, and the caller that asked decides
// who reports how it went.
import { createRoot } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type * as PitchPipeline from '@/lib/pitch-pipeline'
import type { VocalAnalysis } from '@/lib/pitch-pipeline'

const fakes = vi.hoisted(() => ({
  analyze: vi.fn<() => Promise<VocalAnalysis>>(),
}))

vi.mock('@/lib/pitch-pipeline', async (importOriginal) => ({
  ...(await importOriginal<typeof PitchPipeline>()),
  analyzeVocalSamples: fakes.analyze,
}))

const { useStemMixerPitchAnalysisController } =
  await import('./useStemMixerPitchAnalysisController')

const VOCAL = {
  sampleRate: 48_000,
  getChannelData: () => new Float32Array(8),
} as unknown as AudioBuffer

const ANALYSED = {
  algo: 'yin',
  rawDetections: [],
  contour: [],
  mergedNotes: [],
  segmentedNotes: [],
} as unknown as VocalAnalysis

let disposeRoot: (() => void) | null = null

function mount() {
  const showNotification = vi.fn<(message: string, type?: string) => void>()
  const controller = createRoot((dispose) => {
    disposeRoot = dispose
    return useStemMixerPitchAnalysisController({
      vocalBuffer: () => VOCAL,
      sampleRate: () => VOCAL.sampleRate,
      setPitchHistory: () => {},
      showNotification,
    })
  })
  return { controller, showNotification }
}

afterEach(() => {
  disposeRoot?.()
  disposeRoot = null
  fakes.analyze.mockReset()
})

describe('runAnalysis', () => {
  it('runs one analysis at a time: a second request joins the first', async () => {
    let finish!: (analysis: VocalAnalysis) => void
    fakes.analyze.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve
      }),
    )
    const { controller } = mount()

    const first = controller.runAnalysis()
    const second = controller.runAnalysis({ quiet: true })

    expect(fakes.analyze).toHaveBeenCalledTimes(1)
    finish(ANALYSED)
    expect(await first).toEqual({ ok: true })
    expect(await second).toEqual({ ok: true })
    expect(controller.isAnalyzing()).toBe(false)
  })

  it('starts a fresh one once the last has finished', async () => {
    fakes.analyze.mockResolvedValue(ANALYSED)
    const { controller } = mount()

    await controller.runAnalysis()
    await controller.runAnalysis()

    expect(fakes.analyze).toHaveBeenCalledTimes(2)
  })

  it('says how a run asked for from Pitch Studio went', async () => {
    fakes.analyze.mockResolvedValueOnce(ANALYSED)
    fakes.analyze.mockRejectedValueOnce(
      new Error('The vocal could not be read'),
    )
    const { controller, showNotification } = mount()

    expect(await controller.runAnalysis()).toEqual({ ok: true })
    expect(await controller.runAnalysis()).toEqual({
      ok: false,
      message: 'The vocal could not be read',
      shown: true,
    })
    expect(showNotification.mock.calls).toEqual([
      ['Pitch analysis complete', 'success'],
      ['The vocal could not be read', 'error'],
    ])
  })

  it('leaves the report of a quiet run to its caller, error and all', async () => {
    fakes.analyze.mockResolvedValueOnce(ANALYSED)
    fakes.analyze.mockRejectedValueOnce(
      new Error('The vocal could not be read'),
    )
    const { controller, showNotification } = mount()

    expect(await controller.runAnalysis({ quiet: true })).toEqual({ ok: true })
    expect(await controller.runAnalysis({ quiet: true })).toEqual({
      ok: false,
      message: 'The vocal could not be read',
      shown: false,
    })
    expect(showNotification).not.toHaveBeenCalled()
  })
})

describe('runAnalysis, asked for in two ways at once', () => {
  // Find my key analyses quietly and reports in its own message. A singer who
  // presses Pitch Studio's Analyze while that runs has asked for the
  // analysis in their own right, and was told nothing at all.
  function slowAnalysis() {
    let finish!: (analysis: VocalAnalysis) => void
    let fail!: (error: Error) => void
    fakes.analyze.mockReturnValue(
      new Promise((resolve, reject) => {
        finish = resolve
        fail = reject
      }),
    )
    return { finish: () => finish(ANALYSED), fail }
  }

  it('says it went well to an Analyze that joined a quiet run', async () => {
    const slow = slowAnalysis()
    const { controller, showNotification } = mount()

    const findMyKey = controller.runAnalysis({ quiet: true })
    const analyze = controller.runAnalysis()
    slow.finish()

    expect(await analyze).toEqual({ ok: true })
    expect(await findMyKey).toEqual({ ok: true })
    expect(showNotification.mock.calls).toEqual([
      ['Pitch analysis complete', 'success'],
    ])
  })

  it('says why it failed once, and tells Find my key it was said', async () => {
    const slow = slowAnalysis()
    const { controller, showNotification } = mount()

    const findMyKey = controller.runAnalysis({ quiet: true })
    const pressed = controller.runAnalysis()
    const pressedAgain = controller.runAnalysis()
    slow.fail(new Error('The vocal could not be read'))

    const said = {
      ok: false,
      message: 'The vocal could not be read',
      shown: true,
    }
    expect(await pressed).toEqual(said)
    expect(await pressedAgain).toEqual(said)
    expect(await findMyKey).toEqual(said)
    expect(showNotification.mock.calls).toEqual([
      ['The vocal could not be read', 'error'],
    ])
  })

  it('adds nothing to a run Pitch Studio started, whoever joins it', async () => {
    const slow = slowAnalysis()
    const { controller, showNotification } = mount()

    const analyze = controller.runAnalysis()
    const findMyKey = controller.runAnalysis({ quiet: true })
    const pressedAgain = controller.runAnalysis()
    slow.finish()

    await Promise.all([analyze, findMyKey, pressedAgain])
    expect(showNotification.mock.calls).toEqual([
      ['Pitch analysis complete', 'success'],
    ])
  })
})

// A phone streams the song, so there is no decoded vocal: the analysis
// gathers one from the stream (streamed-vocal-samples.ts) and finds the
// notes in that, which is how an imported song gets its pitch guide there.
describe('runAnalysis, on a vocal that streams', () => {
  /** A one-second stream at 8 Hz whose chunks say when they are read. */
  function stream(reads: string[]) {
    return {
      sampleRate: 8,
      durationSeconds: 1,
      chunks(from: number) {
        reads.push(`from ${from}`)
        return (async function* () {
          for (const [timestamp, values] of [
            [0, [1, 2, 3, 4]],
            [0.5, [5, 6, 7, 8]],
          ] as const) {
            await Promise.resolve()
            yield {
              timestamp,
              buffer: {
                sampleRate: 8,
                length: values.length,
                getChannelData: () => Float32Array.from(values),
              } as unknown as AudioBuffer,
            }
          }
        })()
      },
    }
  }

  function mountStreamed(reads: string[]) {
    const showNotification = vi.fn<(message: string, type?: string) => void>()
    const controller = createRoot((dispose) => {
      disposeRoot = dispose
      return useStemMixerPitchAnalysisController({
        vocalBuffer: () => null,
        vocalStream: () => stream(reads),
        sampleRate: () => 48_000,
        setPitchHistory: () => {},
        showNotification,
      })
    })
    return { controller, showNotification }
  }

  it('analyses channel 0 gathered from the stream, at its own rate', async () => {
    fakes.analyze.mockResolvedValue(ANALYSED)
    const reads: string[] = []
    const { controller } = mountStreamed(reads)

    expect(await controller.runAnalysis({ quiet: true })).toEqual({ ok: true })

    expect(reads).toEqual(['from 0'])
    const [samples, sampleRate, options] = fakes.analyze.mock
      .calls[0] as unknown as [Float32Array, number, { bufferSize: number }]
    expect([Array.from(samples), sampleRate, options.bufferSize]).toEqual([
      [1, 2, 3, 4, 5, 6, 7, 8],
      8,
      1024,
    ])
  })

  it('gives the walk the first part of the progress, and the detector the rest', async () => {
    const seen: number[] = []
    const { controller } = mountStreamed([])
    fakes.analyze.mockImplementation((...args: unknown[]) => {
      const run = args[3] as { onProgress?: (pct: number) => void }
      // The walk is done by the time the detector starts.
      seen.push(controller.progress())
      run.onProgress?.(50)
      seen.push(controller.progress())
      run.onProgress?.(100)
      seen.push(controller.progress())
      return Promise.resolve(ANALYSED)
    })

    await controller.runAnalysis({ quiet: true })

    expect(seen).toEqual([35, 68, 100])
  })

  it('says no vocal is loaded when there is neither a decoded one nor a stream', async () => {
    const showNotification = vi.fn<(message: string, type?: string) => void>()
    const controller = createRoot((dispose) => {
      disposeRoot = dispose
      return useStemMixerPitchAnalysisController({
        vocalBuffer: () => null,
        vocalStream: () => null,
        sampleRate: () => 48_000,
        setPitchHistory: () => {},
        showNotification,
      })
    })

    expect(await controller.runAnalysis({ quiet: true })).toEqual({
      ok: false,
      message: 'No vocal stem loaded',
      shown: false,
    })
    expect(fakes.analyze).not.toHaveBeenCalled()
  })
})

describe('canAnalyse', () => {
  function controllerOver(
    vocalBuffer: AudioBuffer | null,
    stream: { sampleRate: number; durationSeconds: number } | null,
  ) {
    return createRoot((dispose) => {
      disposeRoot = dispose
      return useStemMixerPitchAnalysisController({
        vocalBuffer: () => vocalBuffer,
        vocalStream: () =>
          stream === null
            ? null
            : {
                ...stream,
                chunks: () => ({
                  async *[Symbol.asyncIterator]() {
                    yield* []
                  },
                }),
              },
        sampleRate: () => 48_000,
        setPitchHistory: () => {},
        showNotification: () => {},
      })
    })
  }

  it('can, on a decoded vocal, and on a streamed one of a usual length', () => {
    expect(controllerOver(VOCAL, null).canAnalyse()).toBe(true)
    expect(
      controllerOver(null, {
        sampleRate: 44_100,
        durationSeconds: 240,
      }).canAnalyse(),
    ).toBe(true)
  })

  it('cannot while there is no vocal, nor on a stream too long to gather', () => {
    expect(controllerOver(null, null).canAnalyse()).toBe(false)
    expect(
      controllerOver(null, {
        sampleRate: 48_000,
        durationSeconds: 3600,
      }).canAnalyse(),
    ).toBe(false)
  })
})
