// ============================================================
// useTakeReviewController — Recording preview and take review
// ============================================================
//
// Encapsulates live recording melody preview, review re-segmentation contour,
// nudge timing adjustment, take commitment, and dynamic compose grid bounds.
//

import type { Accessor } from 'solid-js'
import { createEffect, createMemo, createSignal, on } from 'solid-js'
import { segmentContourToMelody } from '@/lib/pitch-pipeline'
import { midiToFreq, midiToNote } from '@/lib/scale-data'
import type { MelodyItem } from '@/types'
import type { RecordingController } from './useRecordingController'
import { shiftTakeFrames } from './useRecordingController'

export interface UseTakeReviewControllerDeps {
  recording: Pick<
    RecordingController,
    | 'isRecording'
    | 'recordedMelody'
    | 'provisionalNote'
    | 'pendingTake'
    | 'commitTake'
  >
  currentBeat: Accessor<number>
  bpm: Accessor<number>
  keyName: Accessor<string>
  scaleType: Accessor<string>
  totalBeats: Accessor<number>
}

export interface UseTakeReviewControllerReturn {
  reviewAmount: Accessor<number>
  setReviewAmount: (v: number | ((prev: number) => number)) => void
  reviewNudgeMs: Accessor<number>
  setReviewNudgeMs: (v: number | ((prev: number) => number)) => void
  liveRecordingMelody: Accessor<MelodyItem[]>
  reviewMelody: Accessor<MelodyItem[]>
  previewMelody: Accessor<MelodyItem[]>
  commitTake: () => void
  composeTotalBeats: Accessor<number>
}

export function useTakeReviewController(
  deps: UseTakeReviewControllerDeps,
): UseTakeReviewControllerReturn {
  // ── Compose live recording preview ──────────────────────────
  // Notes captured so far this take, plus the currently-held note growing with
  // the playhead. Kept out of melodyStore until the take is finalized.
  const liveRecordingMelody = createMemo<MelodyItem[]>(() => {
    if (!deps.recording.isRecording()) return []
    const items = [...deps.recording.recordedMelody()]
    const prov = deps.recording.provisionalNote()
    if (prov != null) {
      const dur = Math.max(0.05, deps.currentBeat() - prov.startBeat)
      const info = midiToNote(prov.midi)
      items.push({
        id: -1,
        note: {
          midi: prov.midi,
          name: info.name,
          octave: info.octave,
          freq: midiToFreq(prov.midi),
        },
        duration: dur,
        startBeat: prov.startBeat,
      })
    }
    return items
  })

  // ── Take review ────────────────────────────────────────────
  // After a take stops, re-segment its retained contour at the chosen cleanup
  // amount (gentle: as-sung -> strong: key-snapped + quantized). This drives
  // both the on-roll preview and what Keep commits.
  const [reviewAmount, setReviewAmount] = createSignal(0.5)

  // Hand-adjustable timing on top of the automatic round-trip compensation
  // (applied at capture in useRecordingController): a measured offset can
  // still be a few frames off, and a singer may simply have come in late.
  // Reset per take — the last take's correction says nothing about this one.
  const [reviewNudgeMs, setReviewNudgeMs] = createSignal(0)
  createEffect(
    on(
      () => deps.recording.pendingTake(),
      (take) => {
        if (take !== null) setReviewNudgeMs(0)
      },
    ),
  )

  const reviewMelody = createMemo<MelodyItem[]>(() => {
    const take = deps.recording.pendingTake()
    if (take === null) return []
    return segmentContourToMelody(
      shiftTakeFrames(take.frames, reviewNudgeMs(), deps.bpm()),
      {
        bpm: deps.bpm(),
        key: deps.keyName(),
        scaleType: deps.scaleType(),
        cleanupAmount: reviewAmount(),
      },
    )
  })

  // The piano roll's preview channel shows the live take while recording, then
  // the re-segmented candidate while reviewing.
  const previewMelody = createMemo<MelodyItem[]>(() =>
    deps.recording.isRecording() ? liveRecordingMelody() : reviewMelody(),
  )

  const commitTake = (): void => {
    deps.recording.commitTake(reviewMelody())
  }

  // During recording the grid grows to follow the playhead so the take is not
  // capped at the default arrangement length (the old 16-beat stop); during
  // review it stays large enough to show the whole take.
  const composeTotalBeats = createMemo(() => {
    const base = deps.totalBeats()
    const BEATS_PER_BAR = 4
    if (deps.recording.isRecording()) {
      const grown =
        (Math.floor((deps.currentBeat() + 8) / BEATS_PER_BAR) + 1) *
        BEATS_PER_BAR
      return Math.max(base, 16, grown)
    }
    const take = deps.recording.pendingTake()
    if (take !== null) {
      const end = Math.ceil((take.endBeat + 4) / BEATS_PER_BAR) * BEATS_PER_BAR
      return Math.max(base, 16, end)
    }
    return base
  })

  return {
    reviewAmount,
    setReviewAmount,
    reviewNudgeMs,
    setReviewNudgeMs,
    liveRecordingMelody,
    reviewMelody,
    previewMelody,
    commitTake,
    composeTotalBeats,
  }
}
