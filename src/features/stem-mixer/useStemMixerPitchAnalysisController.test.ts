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
