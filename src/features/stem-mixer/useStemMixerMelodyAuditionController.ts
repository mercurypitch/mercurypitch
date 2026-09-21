// ============================================================
// useStemMixerMelodyAuditionController — hear the detected melody
// ============================================================
//
// Sound the detected vocal notes as a monophonic synth that follows the
// playhead, so the cleaned melody can be heard rather than only read off the
// canvas. The synth itself is melody-synth.ts; this is the reactive half —
// the toggle, the note-following effect, and disposal.
//
// Slice D of docs/agent/REFACTOR-PLAN.md. The plan pointed this code at
// melody-synth.ts, which already existed, but that module is a pure audio
// graph with no Solid import: folding signals and an effect into it would
// give it a dependency on both the audio and the pitch-analysis controller.
// Same call slice F made, for the same reason.
//
// The effect reads `elapsed` before deciding whether to sound anything, so it
// stays subscribed to the playhead even while silent and wakes on every frame
// with the feature switched off, only to re-send silence. That is preserved
// exactly as it was — this slice is a move, not a fix — but it is not doing
// any work: `enabled` and `playing` are tracked too, so a toggle re-runs the
// effect on its own. Narrowing the read is a behaviour change (fewer effect
// runs) and wants its own PR and its own test.

import type { Accessor } from 'solid-js'
import { createEffect, createSignal, onCleanup } from 'solid-js'
import type { MergedNote } from '@/lib/midi-generator'
import { createMelodySynth } from './melody-synth'

export interface UseStemMixerMelodyAuditionControllerDeps {
  audio: {
    playing: Accessor<boolean>
    elapsed: Accessor<number>
  }
  pitchAnalysis: {
    offlineSegmentedNotes: Accessor<MergedNote[]>
  }
}

export interface UseStemMixerMelodyAuditionControllerReturn {
  /** Whether the audition synth is switched on. */
  enabled: Accessor<boolean>
  /**
   * Flip it. Switching on resumes the AudioContext from this call, which is
   * the user gesture — melody-synth.ts creates the graph lazily so autoplay
   * policy is satisfied, and the effect must never be the one to resume it.
   */
  toggle: () => void
}

export function useStemMixerMelodyAuditionController(
  deps: UseStemMixerMelodyAuditionControllerDeps,
): UseStemMixerMelodyAuditionControllerReturn {
  const [enabled, setEnabled] = createSignal(false)
  const synth = createMelodySynth()
  onCleanup(() => synth.dispose())

  createEffect(() => {
    const on = enabled() && deps.audio.playing()
    const t = deps.audio.elapsed()
    if (!on) {
      synth.setNote(null)
      return
    }
    const notes = deps.pitchAnalysis.offlineSegmentedNotes()
    const active = notes.find((n) => t >= n.startSec && t < n.endSec)
    synth.setNote(active !== undefined ? active.midi : null)
  })

  const toggle = (): void => {
    const next = !enabled()
    setEnabled(next)
    if (next) synth.resume()
  }

  return { enabled, toggle }
}
