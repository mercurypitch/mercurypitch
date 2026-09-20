// Voice challenge presentation — the same quiet singing panel for holds and ordered notes.
import { For, Show } from 'solid-js'
import type { PitchTargetId } from '../contracts'
import styles from './GlassAdventure.module.css'
import type { VoiceChallengeMode } from './voice-challenge'
import lessonStyles from './VoiceChallengePanel.module.css'

const notes = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B']

function noteName(midi: number | null): string {
  if (midi === null) return 'Your note'
  const rounded = Math.round(midi)
  return `${notes[((rounded % 12) + 12) % 12]}${Math.floor(rounded / 12) - 1}`
}

export function VoiceChallengePanel(props: {
  label: string
  mode: VoiceChallengeMode
  message: string
  hint: string
  target: number | null
  pitch: number | null
  charge: number
  pair: boolean
  steps: readonly PitchTargetId[]
  stepIndex: number
  onCancel(): void
  onReplay(): void
  onRefind(): void
}) {
  const percent = () => Math.round(props.charge * 100)
  return (
    <section
      class={styles.encounter}
      aria-label="Voice challenge"
      data-voice-mode={props.mode}
      data-step-index={props.stepIndex}
    >
      <div class={styles.encounterHeading}>
        <span>{props.label}</span>
        <button type="button" onClick={() => props.onCancel()}>
          Cancel
        </button>
      </div>
      <h2 aria-live="polite">{props.message}</h2>
      <Show when={props.steps.length > 1}>
        <ol class={lessonStyles.sequence} aria-label="Note order">
          <For each={props.steps}>
            {(step, index) => (
              <li
                classList={{
                  [lessonStyles.current]:
                    props.mode === 'singing' && index() === props.stepIndex,
                  [lessonStyles.done]:
                    props.mode === 'singing' && index() < props.stepIndex,
                }}
                aria-current={
                  props.mode === 'singing' && index() === props.stepIndex
                    ? 'step'
                    : undefined
                }
              >
                <span>{index() + 1}</span>
                {step === 'low'
                  ? 'Lower note'
                  : step === 'high'
                    ? 'Higher note'
                    : 'Your note'}
              </li>
            )}
          </For>
        </ol>
      </Show>
      <p class={lessonStyles.hint}>{props.hint}</p>
      <div class={styles.voiceMeter}>
        <div class={styles.noteDisc} style={{ '--charge': `${percent()}%` }}>
          <span>{noteName(props.target)}</span>
        </div>
        <div class={styles.voiceReadout}>
          <span>
            {props.mode === 'finding'
              ? 'The glass is finding your voice.'
              : props.mode === 'reference'
                ? 'Your turn in a moment…'
                : props.pitch === null
                  ? 'Sing or hum. No need to be loud.'
                  : `${noteName(props.pitch)} · ${percent()}%`}
          </span>
          <div
            class={styles.chargeTrack}
            role="progressbar"
            aria-label="Glass resonance"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent()}
          >
            <span style={{ width: `${percent()}%` }} />
          </div>
        </div>
      </div>
      <div class={styles.encounterActions}>
        <Show when={props.mode === 'singing'}>
          <button
            class={styles.textButton}
            type="button"
            onClick={() => props.onReplay()}
          >
            {props.steps.length > 1
              ? 'Hear both notes again'
              : 'Hear the note again'}
          </button>
        </Show>
        <button
          class={styles.textButton}
          type="button"
          onClick={() => props.onRefind()}
        >
          {props.pair ? 'Find my notes again' : 'Find my note again'}
        </button>
      </div>
    </section>
  )
}
