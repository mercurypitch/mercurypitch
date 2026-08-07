// ============================================================
// LeadInCue — when to come back in after a short silence
// ============================================================
//
// Long gaps get a rest row with countdown dots. Short ones got nothing, so a
// four-second silence left you knowing the line but not the moment. This is
// the same idea at line scale: a bar that fills across the run-in and is gone
// the instant the line starts.
//
// Renders nothing outside its window — see `leadInProgress`, which returns
// null rather than 0 for exactly that reason.
//
// Plan: docs/plans/lrc-mapper-studio-plan.md (Phase 6).

import type { Accessor, Component } from 'solid-js'
import { Show } from 'solid-js'
import { leadInProgress } from '@/lib/canonical-lrc'

export interface LeadInCueProps {
  /** When the run-in starts, or undefined for a line that has no cue. */
  leadInFrom: number | undefined
  lineTime: number
  elapsed: Accessor<number>
}

export const LeadInCue: Component<LeadInCueProps> = (props) => {
  const progress = () =>
    leadInProgress(props.leadInFrom, props.lineTime, props.elapsed())

  return (
    <Show when={progress()}>
      {(value) => (
        <span
          aria-hidden="true"
          class="sm-lyrics-lead-in"
          style={{ '--lead-in-progress': `${(value() * 100).toFixed(1)}%` }}
        >
          <span class="sm-lyrics-lead-in-fill" />
        </span>
      )}
    </Show>
  )
}
