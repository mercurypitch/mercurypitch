// ============================================================
// usePracticeToolsController — Practice helpers, octave shift & accuracy
// ============================================================
//
// Encapsulates sensitivity auto-calibration, melody octave shifting & key mirror,
// target note resolution, historical note accuracy heatmap, and practice score grading.
//

import type {Accessor} from 'solid-js';
import { createEffect, createMemo, on } from 'solid-js'
import { autoCalibrateSensitivity } from '@/features/mic-feedback/auto-calibrate'
import * as melodyStore from '@/stores/melody-store'
import { showNotification } from '@/stores/notifications-store'
import { getNoteAccuracyMap, getSessionHistory, } from '@/stores/practice-session-store'
import type { MelodyNote, PracticeResult } from '@/types'

export interface UsePracticeToolsControllerDeps {
  practiceEngine: {
    startMic: () => Promise<boolean>
    getInputLevel: () => number
  }
  micActive: Accessor<boolean>
  currentNoteIndex: Accessor<number>
  setKeyName: (key: string) => void
  setScaleType: (scale: string) => void
  practiceResult: Accessor<PracticeResult | null>
  setPracticeResult: (result: PracticeResult | null) => void
  setLiveScore: (score: unknown) => void
}

export interface UsePracticeToolsControllerReturn {
  handleAutoCalibrate: () => Promise<void>
  handleOctaveShift: (delta: number) => void
  targetNote: Accessor<MelodyNote | null>
  targetNoteName: Accessor<string | null>
  noteAccuracyMap: Accessor<Map<number, number>>
  scoreGrade: Accessor<string>
  scoreLabel: Accessor<string>
  closeScoreOverlay: () => void
}

export function usePracticeToolsController(
  deps: UsePracticeToolsControllerDeps,
): UsePracticeToolsControllerReturn {
  // Sidebar "Auto-calibrate": ensure the mic is on, then sample the room.
  const handleAutoCalibrate = async () => {
    if (!deps.micActive()) {
      const ok = await deps.practiceEngine.startMic()
      if (!ok) {
        showNotification('Enable your mic to auto-calibrate.', 'warning')
        return
      }
    }
    await autoCalibrateSensitivity(() => deps.practiceEngine.getInputLevel())
  }

  // ── Octave shift ──────────────────────────────────────────
  // One shared store operation: melody and reference grid move together,
  // rebuilt from the store's own tracked key/scale (the app-store signals
  // can lag behind a loaded melody).
  const handleOctaveShift = (delta: number) => {
    melodyStore.shiftMelodyOctave(delta)
  }

  // A loaded melody carries its own key and scale type; mirror them into the
  // app-store signals so the sidebar pickers and share links describe the
  // melody actually on the stage (the grid itself is aligned by loadMelody).
  createEffect(
    on(
      () => melodyStore.currentMelody()?.id,
      () => {
        const m = melodyStore.currentMelody()
        if (m == null) return
        if (m.key !== '') deps.setKeyName(m.key)
        if (m.scaleType !== '') deps.setScaleType(m.scaleType)
      },
    ),
  )

  // ── Target note for pitch display ──────────────────────────
  const targetNote = createMemo(() => {
    const idx = deps.currentNoteIndex()
    const items = melodyStore.getCurrentItems()
    if (idx < 0 || idx >= items.length) return null
    return items[idx].note
  })

  const targetNoteName = createMemo(() => {
    const note = targetNote()
    if (note === null) return null
    return note.name + note.octave
  })

  // ── Accuracy heatmap ───────────────────────────────────────
  const noteAccuracyMap = createMemo(() => {
    void getSessionHistory().length
    return getNoteAccuracyMap() as Map<number, number>
  })

  const scoreGrade = createMemo(() => {
    const pr = deps.practiceResult()
    if (!pr) return ''
    if (pr.score >= 90) return 'grade-perfect'
    if (pr.score >= 80) return 'grade-excellent'
    if (pr.score >= 65) return 'grade-good'
    if (pr.score >= 50) return 'grade-okay'
    return 'grade-needs-work'
  })

  const scoreLabel = createMemo(() => {
    const pr = deps.practiceResult()
    if (!pr) return ''
    if (pr.score >= 90) return 'Pitch Perfect!'
    if (pr.score >= 80) return 'Excellent!'
    if (pr.score >= 65) return 'Good!'
    if (pr.score >= 50) return 'Okay!'
    return 'Needs Work'
  })

  const closeScoreOverlay = () => {
    deps.setPracticeResult(null)
    deps.setLiveScore(null)
  }

  return {
    handleAutoCalibrate,
    handleOctaveShift,
    targetNote,
    targetNoteName,
    noteAccuracyMap,
    scoreGrade,
    scoreLabel,
    closeScoreOverlay,
  }
}
