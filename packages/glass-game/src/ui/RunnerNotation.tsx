// Song runner musical ribbon — one phase, filling note medallions and an inline live pitch guide.
import { createMemo, createUniqueId, For, Show } from 'solid-js'
import type { RunnerTargetSnapshot } from '../runner/contracts'
import type { RunnerNotationNote } from '../runner/notation'
import { runnerRibbon } from './runner-ribbon'
import type { RunnerUpcomingCue as UpcomingCue } from './runner-upcoming-cue'
import styles from './RunnerNotation.module.css'
import { RunnerPitchReadout } from './RunnerPitchReadout'
import { RunnerRibbonNotes } from './RunnerRibbonNotes'

interface RunnerNotationProps {
  notes: readonly RunnerNotationNote[]
  activeNoteIndex: number | null
  phaseLabel: string
  instruction: string
  target: Pick<
    RunnerTargetSnapshot,
    'currentTargetMidi' | 'pitchFeedback'
  > | null
  showPitchReadout: boolean
  microphoneStatus: string
  scoreStatus: string
  meterName?: string
  upcomingCue?: UpcomingCue | null
  embedded?: boolean
}

export function RunnerNotation(props: RunnerNotationProps) {
  const descriptionId = createUniqueId()
  const ribbon = createMemo(() =>
    runnerRibbon(
      props.notes,
      props.activeNoteIndex,
      props.upcomingCue?.notes.map((note) => note.duration),
    ),
  )
  return (
    <section
      class={styles.panel}
      classList={{ [styles.embedded]: props.embedded === true }}
      data-voice-phase={props.phaseLabel.toLowerCase().replaceAll(' ', '-')}
      aria-label="Current melody"
      aria-describedby={descriptionId}
    >
      <div class={styles.ribbon}>
        <div class={styles.phase}>
          <span
            class={styles.microphone}
            role="img"
            aria-label={props.microphoneStatus}
            title={props.microphoneStatus}
          >
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <rect x="5.5" y="1.5" width="5" height="8" rx="2.5" />
              <path d="M3.5 7.5a4.5 4.5 0 0 0 9 0M8 12v2.5M5.5 14.5h5" />
            </svg>
          </span>
          <strong aria-label={props.instruction}>{props.phaseLabel}</strong>
        </div>
        <RunnerRibbonNotes
          notes={ribbon().visible}
          progressName={props.meterName}
        />
        <div
          class={styles.position}
          aria-label={`Note ${ribbon().position.replace('/', ' of ')}`}
        >
          <span>{ribbon().position}</span>
          <Show when={ribbon().remaining > 0}>
            <strong class={styles.fullRemaining}>+{ribbon().remaining}</strong>
          </Show>
          <Show when={ribbon().visible.length === 3}>
            <strong class={styles.compactRemaining}>
              +{ribbon().remaining + 1}
            </strong>
          </Show>
        </div>
      </div>
      <div class={styles.footer}>
        <Show
          when={props.target !== null && props.showPitchReadout}
          fallback={<span class={styles.waitingCue}>{props.scoreStatus}</span>}
        >
          <RunnerPitchReadout target={props.target!} />
        </Show>
      </div>
      <span id={descriptionId} class={styles.srOnly}>
        {props.instruction}. {props.microphoneStatus}. {props.scoreStatus}.
      </span>
      <ol class={styles.srOnly} aria-label="Complete melody">
        <For each={ribbon().all}>
          {(note) => (
            <li>
              {note.pitch}
              {note.duration !== null ? `, hold ${note.duration}` : ''}
              {note.state === 'filled' ? ', complete' : ''}
            </li>
          )}
        </For>
      </ol>
    </section>
  )
}
