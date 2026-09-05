// ============================================================
// useStemMixerVocalLyricsController — "From vocal" lyrics orchestration
// ============================================================
//
// Turn the Whisper transcription into a synced lyric draft (the 'whisper'
// version) and drop straight into the text editor for cleanup. Reuses a
// cached transcription when one exists; otherwise runs the full
// pitch-analysis-then-whisper pipeline and imports once it lands.
//
// Slice F of docs/agent/REFACTOR-PLAN.md. The plan pointed this code at
// lrc-gen-engine.ts, but it is reactive orchestration — signals, an effect,
// notifications — not engine logic, so it lives as a controller hook beside
// the other StemMixer controllers.

import type { Accessor } from 'solid-js'
import { createEffect, createSignal, on } from 'solid-js'
import type { MergedNote } from '@/lib/midi-generator'
import type { WhisperStatus } from '@/lib/useWhisperTranscription'
import type { WhisperSegment } from '@/lib/whisper-service'
import { showNotification } from '@/stores/notifications-store'

export interface UseStemMixerVocalLyricsControllerDeps {
  pitchAnalysis: {
    offlineSegmentedNotes: Accessor<MergedNote[]>
    offlineMergedNotes: Accessor<MergedNote[]>
    isAnalyzing: Accessor<boolean>
    progress: Accessor<number>
    runAnalysis: () => Promise<void>
  }
  whisper: {
    segments: Accessor<WhisperSegment[]>
    status: Accessor<WhisperStatus>
    progress: Accessor<number>
    elapsed: Accessor<number>
    startTranscription: () => void
  }
  importWhisperLyrics: (segments: WhisperSegment[]) => boolean
  /**
   * Says why transcription cannot run here and returns true when it cannot —
   * a streamed vocal has no decoded buffer to analyse. Checked before anything
   * starts, so the refusal itself is the only effect.
   */
  refuseTranscription?: () => boolean
}

export interface UseStemMixerVocalLyricsControllerReturn {
  startWhisperTranscription: () => void
  generateLyricsFromVocal: () => void
  generatingFromVocal: Accessor<boolean>
  generatingLabel: Accessor<string>
  pendingWhisperLyrics: Accessor<boolean>
}

export function useStemMixerVocalLyricsController(
  deps: UseStemMixerVocalLyricsControllerDeps,
): UseStemMixerVocalLyricsControllerReturn {
  const [pendingWhisperLyrics, setPendingWhisperLyrics] = createSignal(false)

  const hasPitchData = (): boolean =>
    deps.pitchAnalysis.offlineSegmentedNotes().length > 0 ||
    deps.pitchAnalysis.offlineMergedNotes().length > 0

  const refused = (): boolean => deps.refuseTranscription?.() === true

  // If pitch analysis hasn't been run yet, run it first with default
  // settings so the alignment has notes to work with.
  const startTranscriptionAnalysisFirst = (): void => {
    if (!hasPitchData() && !deps.pitchAnalysis.isAnalyzing()) {
      showNotification('Running pitch denoising first...', 'info')
      void deps.pitchAnalysis.runAnalysis().then(() => {
        deps.whisper.startTranscription()
      })
      return
    }
    deps.whisper.startTranscription()
  }

  const startWhisperTranscription = (): void => {
    if (refused()) return
    startTranscriptionAnalysisFirst()
  }

  const importFromSegmentsIfReady = (): boolean => {
    const segs = deps.whisper.segments()
    if (deps.whisper.status() !== 'done' || segs.length === 0) return false
    const ok = deps.importWhisperLyrics(segs)
    if (!ok) {
      showNotification(
        'No recognizable words in the vocal to build lyrics from.',
        'warning',
      )
    }
    return true
  }

  const generateLyricsFromVocal = (): void => {
    if (importFromSegmentsIfReady()) return
    // Refuse before raising the flag: a flag left up would import the next
    // transcription that lands, whoever asked for it.
    if (refused()) return
    setPendingWhisperLyrics(true)
    // Ensures pitch analysis first, then whisper (cache-aware).
    startTranscriptionAnalysisFirst()
  }

  createEffect(
    on(deps.whisper.status, (s) => {
      if (!pendingWhisperLyrics()) return
      if (s === 'done') {
        setPendingWhisperLyrics(false)
        importFromSegmentsIfReady()
      } else if (s === 'error') {
        setPendingWhisperLyrics(false)
        showNotification('Could not transcribe the vocal.', 'error')
      }
    }),
  )

  const generatingFromVocal = (): boolean =>
    pendingWhisperLyrics() &&
    (deps.whisper.status() === 'processing' ||
      deps.whisper.status() === 'loading' ||
      deps.pitchAnalysis.isAnalyzing())

  // Live phase label for the version menu while a From-vocal draft runs.
  const generatingLabel = (): string => {
    if (deps.pitchAnalysis.isAnalyzing()) {
      return `Reading the vocal… ${Math.round(deps.pitchAnalysis.progress())}%`
    }
    if (deps.whisper.status() === 'loading') {
      const pct = Math.round(deps.whisper.progress())
      return pct > 0
        ? `Fetching the listener… ${pct}%`
        : 'Fetching the listener…'
    }
    const secs = deps.whisper.elapsed()
    return secs >= 0 ? `Transcribing… ${secs}s` : 'Transcribing…'
  }

  return {
    startWhisperTranscription,
    generateLyricsFromVocal,
    generatingFromVocal,
    generatingLabel,
    pendingWhisperLyrics,
  }
}
