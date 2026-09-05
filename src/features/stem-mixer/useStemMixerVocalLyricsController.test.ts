import { createRoot, createSignal } from 'solid-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MergedNote } from '@/lib/midi-generator'
import type { WhisperStatus } from '@/lib/useWhisperTranscription'
import type { WhisperSegment } from '@/lib/whisper-service'
import { showNotification } from '@/stores/notifications-store'
import type { UseStemMixerVocalLyricsControllerReturn } from './useStemMixerVocalLyricsController'
import { useStemMixerVocalLyricsController } from './useStemMixerVocalLyricsController'

vi.mock('@/stores/notifications-store', () => ({
  showNotification: vi.fn(),
}))

describe('useStemMixerVocalLyricsController', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  function createHarness(overrides?: {
    segmentedNotes?: MergedNote[]
    mergedNotes?: MergedNote[]
    isAnalyzing?: boolean
    analysisProgress?: number
    runAnalysis?: () => Promise<void>
    segments?: WhisperSegment[]
    whisperStatus?: WhisperStatus
    refuse?: boolean
    whisperProgress?: number
    whisperElapsed?: number
    importOk?: boolean
  }) {
    const [segmentedNotes, setSegmentedNotes] = createSignal<MergedNote[]>(
      overrides?.segmentedNotes ?? [],
    )
    const [mergedNotes, setMergedNotes] = createSignal<MergedNote[]>(
      overrides?.mergedNotes ?? [],
    )
    const [isAnalyzing, setIsAnalyzing] = createSignal<boolean>(
      overrides?.isAnalyzing ?? false,
    )
    const [analysisProgress, setAnalysisProgress] = createSignal<number>(
      overrides?.analysisProgress ?? 0,
    )
    const runAnalysisMock = vi.fn(
      overrides?.runAnalysis ?? (() => Promise.resolve()),
    )

    const [segments, setSegments] = createSignal<WhisperSegment[]>(
      overrides?.segments ?? [],
    )
    const [whisperStatus, setWhisperStatus] = createSignal<WhisperStatus>(
      overrides?.whisperStatus ?? 'idle',
    )
    const [whisperProgress, setWhisperProgress] = createSignal<number>(
      overrides?.whisperProgress ?? 0,
    )
    const [whisperElapsed, setWhisperElapsed] = createSignal<number>(
      overrides?.whisperElapsed ?? 0,
    )
    const startTranscriptionMock = vi.fn()

    const importWhisperLyricsMock = vi.fn(() => overrides?.importOk ?? true)
    const refuseTranscriptionMock = vi.fn(() => overrides?.refuse ?? false)

    const deps = {
      pitchAnalysis: {
        offlineSegmentedNotes: segmentedNotes,
        offlineMergedNotes: mergedNotes,
        isAnalyzing,
        progress: analysisProgress,
        runAnalysis: runAnalysisMock,
      },
      whisper: {
        segments,
        status: whisperStatus,
        progress: whisperProgress,
        elapsed: whisperElapsed,
        startTranscription: startTranscriptionMock,
      },
      importWhisperLyrics: importWhisperLyricsMock,
      refuseTranscription: refuseTranscriptionMock,
    }

    return {
      deps,
      setSegmentedNotes,
      setMergedNotes,
      setIsAnalyzing,
      setAnalysisProgress,
      runAnalysisMock,
      setSegments,
      setWhisperStatus,
      setWhisperProgress,
      setWhisperElapsed,
      startTranscriptionMock,
      importWhisperLyricsMock,
      refuseTranscriptionMock,
    }
  }

  it('starts transcription directly if pitch data already exists', () => {
    createRoot((dispose) => {
      const h = createHarness({
        segmentedNotes: [
          { midi: 60, startBeat: 0, duration: 1 } as unknown as MergedNote,
        ],
      })
      const controller = useStemMixerVocalLyricsController(h.deps)

      controller.startWhisperTranscription()
      expect(h.runAnalysisMock).not.toHaveBeenCalled()
      expect(h.startTranscriptionMock).toHaveBeenCalled()
      dispose()
    })
  })

  it('runs pitch analysis first if pitch data is missing, then starts transcription', async () => {
    await new Promise<void>((resolve) => {
      createRoot((dispose) => {
        let resolveAnalysis: () => void
        const analysisPromise = new Promise<void>((res) => {
          resolveAnalysis = res
        })
        const h = createHarness({
          runAnalysis: () => analysisPromise,
        })
        const controller = useStemMixerVocalLyricsController(h.deps)

        controller.startWhisperTranscription()
        expect(showNotification).toHaveBeenCalledWith(
          'Running pitch denoising first...',
          'info',
        )
        expect(h.runAnalysisMock).toHaveBeenCalled()
        expect(h.startTranscriptionMock).not.toHaveBeenCalled()

        resolveAnalysis!()
        analysisPromise.then(() => {
          expect(h.startTranscriptionMock).toHaveBeenCalled()
          dispose()
          resolve()
        })
      })
    })
  })

  it('imports immediately if transcription is already ready', () => {
    createRoot((dispose) => {
      const sampleSegments: WhisperSegment[] = [
        { text: 'hello world', timestamp: [0, 1.5] },
      ]
      const h = createHarness({
        whisperStatus: 'done',
        segments: sampleSegments,
      })
      const controller = useStemMixerVocalLyricsController(h.deps)

      controller.generateLyricsFromVocal()
      expect(h.importWhisperLyricsMock).toHaveBeenCalledWith(sampleSegments)

      expect(controller.pendingWhisperLyrics()).toBe(false)
      dispose()
    })
  })

  it('warns when completed transcription has no recognizable words', () => {
    createRoot((dispose) => {
      const sampleSegments: WhisperSegment[] = [
        { text: '', timestamp: [0, 1.5] },
      ]
      const h = createHarness({
        whisperStatus: 'done',
        segments: sampleSegments,
        importOk: false,
      })
      const controller = useStemMixerVocalLyricsController(h.deps)

      controller.generateLyricsFromVocal()
      expect(h.importWhisperLyricsMock).toHaveBeenCalledWith(sampleSegments)
      expect(showNotification).toHaveBeenCalledWith(
        'No recognizable words in the vocal to build lyrics from.',
        'warning',
      )
      dispose()
    })
  })

  it('sets pending state and reacts to status transitions (done and error)', async () => {
    let controller: UseStemMixerVocalLyricsControllerReturn
    let harness: ReturnType<typeof createHarness>
    let cleanup: () => void

    createRoot((dispose) => {
      cleanup = dispose
      harness = createHarness({
        segmentedNotes: [
          { midi: 60, startBeat: 0, duration: 1 } as unknown as MergedNote,
        ],
        whisperStatus: 'idle',
      })
      controller = useStemMixerVocalLyricsController(harness.deps)
    })

    controller!.generateLyricsFromVocal()

    expect(controller!.pendingWhisperLyrics()).toBe(true)

    harness!.setSegments([{ text: 'la la la', timestamp: [0, 2] }])
    harness!.setWhisperStatus('done')
    await new Promise((r) => setTimeout(r, 20))

    expect(controller!.pendingWhisperLyrics()).toBe(false)
    expect(harness!.importWhisperLyricsMock).toHaveBeenCalled()

    // Trigger error scenario
    harness!.setWhisperStatus('idle')
    harness!.setSegments([])
    controller!.generateLyricsFromVocal()

    expect(controller!.pendingWhisperLyrics()).toBe(true)
    harness!.setWhisperStatus('error')
    await new Promise((r) => setTimeout(r, 20))

    expect(controller!.pendingWhisperLyrics()).toBe(false)
    expect(showNotification).toHaveBeenCalledWith(
      'Could not transcribe the vocal.',
      'error',
    )

    cleanup!()
  })

  it('computes generatingFromVocal and generatingLabel correctly across all phases', () => {
    createRoot((dispose) => {
      const h = createHarness({
        segmentedNotes: [
          { midi: 60, startBeat: 0, duration: 1 } as unknown as MergedNote,
        ],
      })
      const controller = useStemMixerVocalLyricsController(h.deps)

      controller.generateLyricsFromVocal()

      // Phase 1: Analyzing
      h.setIsAnalyzing(true)
      h.setAnalysisProgress(45.2)

      expect(controller.generatingFromVocal()).toBe(true)

      expect(controller.generatingLabel()).toBe('Reading the vocal… 45%')

      // Phase 2: Loading model (progress > 0)
      h.setIsAnalyzing(false)
      h.setWhisperStatus('loading')
      h.setWhisperProgress(80.4)

      expect(controller.generatingFromVocal()).toBe(true)

      expect(controller.generatingLabel()).toBe('Fetching the listener… 80%')

      // Phase 2b: Loading model (progress = 0)
      h.setWhisperProgress(0)

      expect(controller.generatingLabel()).toBe('Fetching the listener…')

      // Phase 3: Processing transcription (elapsed >= 0)
      h.setWhisperStatus('processing')
      h.setWhisperElapsed(12)

      expect(controller.generatingFromVocal()).toBe(true)

      expect(controller.generatingLabel()).toBe('Transcribing… 12s')

      // Phase 3b: Processing transcription (elapsed < 0)
      h.setWhisperElapsed(-1)

      expect(controller.generatingLabel()).toBe('Transcribing…')

      dispose()
    })
  })

  it('refuses a streamed vocal before starting anything, and raises no flag', () => {
    createRoot((dispose) => {
      const h = createHarness({ refuse: true })
      const controller = useStemMixerVocalLyricsController(h.deps)

      controller.startWhisperTranscription()
      controller.generateLyricsFromVocal()

      expect(h.refuseTranscriptionMock).toHaveBeenCalledTimes(2)
      expect(h.runAnalysisMock).not.toHaveBeenCalled()
      expect(h.startTranscriptionMock).not.toHaveBeenCalled()
      // Nothing is pending, so a transcription that lands later by another
      // path is not imported as if this singer had asked for it.
      expect(controller.pendingWhisperLyrics()).toBe(false)
      dispose()
    })
  })
})
