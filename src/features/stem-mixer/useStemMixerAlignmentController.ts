// ============================================================
// useStemMixerAlignmentController — Pitch-word alignment controller
// ============================================================
//
// Computes pitch-to-word alignment mapping (between segmented/merged/realtime
// vocal notes and whisper/canonical LRC word segments), debug logging,
// and transcription accuracy notifications.
//

import type { Accessor } from 'solid-js'
import { createMemo, createSignal, onCleanup } from 'solid-js'
import type { MergedNote, PitchDetection } from '@/lib/midi-generator'
import { mergeConsecutiveNotes } from '@/lib/midi-generator'
import type { AlignmentResult } from '@/lib/pitch-word-alignment'
import { freqToMidi } from '@/lib/scale-data'
import { computeAlignment, formatAlignmentDebugLog, logAlignmentComparison, selectAlignmentSegments, } from '@/lib/transcription-alignment-utils'
import type { WhisperSegment } from '@/lib/whisper-service'
import type { CanonicalLrcEntry } from './types'

export interface AlignmentPitchHistoryEntry {
  frequency: number
  noteName: string
  time: number
}

export interface UseStemMixerAlignmentControllerDeps {
  segmentedNotes: Accessor<MergedNote[]>
  mergedNotes: Accessor<MergedNote[]>
  getPitchHistory: () => AlignmentPitchHistoryEntry[]
  whisperSegments: Accessor<WhisperSegment[]>
  canonicalLrcLines: Accessor<CanonicalLrcEntry[]>
  showNotification: (
    message: string,
    type?: 'info' | 'warning' | 'error',
  ) => void
  isPlaylistActive?: () => boolean
  audioPerformanceDebug?: {
    start: () => void
    stop: () => void
    snapshot: () => unknown
  }
}

export interface UseStemMixerAlignmentControllerReturn {
  useDenoised: Accessor<boolean>
  setUseDenoised: (value: boolean | ((prev: boolean) => boolean)) => void
  alignmentResult: Accessor<AlignmentResult>
  handleTranscriptionComplete: (segments: WhisperSegment[]) => void
}

export function useStemMixerAlignmentController(
  deps: UseStemMixerAlignmentControllerDeps,
): UseStemMixerAlignmentControllerReturn {
  const [useDenoised, setUseDenoised] = createSignal(true)

  // Expose for console debugging: window.__stemMixerDebug.setUseDenoised(false)
  if (typeof globalThis !== 'undefined') {
    const debugObj =
      ((globalThis as Record<string, unknown>).__stemMixerDebug as object) ?? {}
    ;(globalThis as Record<string, unknown>).__stemMixerDebug = {
      ...debugObj,
      useDenoised,
      setUseDenoised,
      ...(deps.audioPerformanceDebug
        ? {
            performance: {
              start: deps.audioPerformanceDebug.start,
              stop: deps.audioPerformanceDebug.stop,
              snapshot: deps.audioPerformanceDebug.snapshot,
              help: 'Call start() before playback to log RAF, analysis, and canvas timings every 2 seconds; call stop() for the final sample.',
            },
          }
        : {}),
    }

    onCleanup(() => {
      delete (globalThis as Record<string, unknown>).__stemMixerDebug
    })
  }

  const alignmentResult = createMemo<AlignmentResult>(() => {
    // Prefer denoised (segmented) notes, fall back to raw merged
    let merged: MergedNote[] = []
    let noteSource = 'none'

    // Always read both signals unconditionally for proper SolidJS tracking
    const segmentedNotes = deps.segmentedNotes()
    const mergedNotes = deps.mergedNotes()
    const wsSegs = deps.whisperSegments()

    if (useDenoised() && segmentedNotes.length > 0) {
      merged = segmentedNotes
      noteSource = 'denoised'
    }

    if (merged.length === 0 && mergedNotes.length > 0) {
      merged = mergedNotes
      noteSource = 'raw-offline'
    }

    // Fallback: use realtime pitch history when offline analysis hasn't run
    if (merged.length === 0) {
      const pitchHistory = deps.getPitchHistory()
      if (pitchHistory.length > 0) {
        const detections: PitchDetection[] = pitchHistory.map((p) => ({
          midi: freqToMidi(p.frequency),
          noteName: p.noteName,
          timeSec: p.time,
        }))
        merged = mergeConsecutiveNotes(detections)
        if (merged.length > 0) noteSource = 'raw-realtime'
      }
    }

    if (merged.length === 0) {
      console.log(
        `[StemMixer] Alignment: no notes available (denoised=${segmentedNotes.length}, raw-offline=${mergedNotes.length}, whisper=${wsSegs.length})`,
      )
      return {
        alignedWords: [],
        totalWords: 0,
        mappedWords: 0,
        unmappedWords: 0,
        accuracy: 0,
        debugEntries: [],
      }
    }

    // Word-window source priority: word-timed LRC (user taps / enhanced LRC)
    // beats whisper. Whisper beats line-only LRC provided Whisper match quality
    // is acceptable (>= 0.25); otherwise line-only LRC is preferred.
    const lrc = deps.canonicalLrcLines()
    const { segments, wordSource } = selectAlignmentSegments(wsSegs, lrc)

    if (segments.length === 0) {
      console.log(
        `[StemMixer] Alignment: no word segments (${noteSource} has ${merged.length} notes but no whisper/LRC segments)`,
      )
      return {
        alignedWords: [],
        totalWords: 0,
        mappedWords: 0,
        unmappedWords: 0,
        accuracy: 0,
        debugEntries: [],
      }
    }

    console.log(
      `[StemMixer] Alignment using ${noteSource} notes x ${wordSource} words (${merged.length} notes, ${segments.length} word segments)`,
    )
    return computeAlignment(merged, segments)
  })

  const handleTranscriptionComplete = (segments: WhisperSegment[]) => {
    // Defer alignment logging and notifications to next tick
    setTimeout(() => {
      const r = alignmentResult()
      const currentSegmented = deps.segmentedNotes()
      const currentMerged = deps.mergedNotes()
      formatAlignmentDebugLog('StemMixer', r)
      logAlignmentComparison(
        'StemMixer',
        currentMerged,
        currentSegmented,
        segments,
      )

      // Show warnings if transcription was poor or failed — but stay quiet
      // during karaoke playlist playback, where the focus is singing.
      if (deps.isPlaylistActive?.() !== true) {
        if (segments.length === 0) {
          deps.showNotification(
            'Transcription timed out or failed. You may need to provide better lyrics or sync manually.',
            'error',
          )
        } else if (r.totalWords > 0 && r.accuracy < 0.25) {
          deps.showNotification(
            `Alignment accuracy is very low (${(r.accuracy * 100).toFixed(0)}%). The lyrics might be incorrect.`,
            'error',
          )
        }
      }
    }, 0)
  }

  return {
    useDenoised,
    setUseDenoised,
    alignmentResult,
    handleTranscriptionComplete,
  }
}
