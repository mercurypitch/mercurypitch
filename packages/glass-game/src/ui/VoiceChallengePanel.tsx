// Voice challenge presentation — shared guidance for held notes, pairs and gentle waves.
import { createSignal, createUniqueId, For, Show } from 'solid-js'
import type { PitchTargetId } from '../contracts'
import styles from './GlassAdventure.module.css'
import type { VoiceChallengeMode } from './voice-challenge'
import lessonStyles from './VoiceChallengePanel.module.css'

const notes = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B']

function noteName(midi: number): string {
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
  wave?: boolean
  waveCycles?: number
  steps: readonly PitchTargetId[]
  stepIndex: number
  onCancel(): void
  onReplay(): void
  onRefind(): void
}) {
  const instructionsId = createUniqueId()
  const [instructionsOpen, setInstructionsOpen] = createSignal(false)
  let instructionsButton!: HTMLButtonElement
  const percent = () => Math.round(props.charge * 100)
  const stepLabels = () =>
    props.wave === true
      ? [
          'Settle your note',
          (props.waveCycles ?? 2) === 2
            ? 'Sway twice'
            : `Sway ${props.waveCycles} times`,
        ]
      : props.steps.map((step) =>
          step === 'low'
            ? 'Lower note'
            : step === 'high'
              ? 'Higher note'
              : 'Your note',
        )
  const closeInstructions = (): void => {
    setInstructionsOpen(false)
    instructionsButton.focus({ preventScroll: true })
  }
  const handlePanelKeyDown = (event: KeyboardEvent): void => {
    if (event.code !== 'Escape' || !instructionsOpen()) return
    event.preventDefault()
    event.stopPropagation()
    closeInstructions()
  }
  return (
    <section
      class={styles.encounter}
      aria-label="Voice challenge"
      data-voice-mode={props.mode}
      data-step-index={props.stepIndex}
      onKeyDown={handlePanelKeyDown}
    >
      <div class={styles.encounterHeading}>
        <span>{props.label}</span>
        <button type="button" onClick={() => props.onCancel()}>
          Cancel
        </button>
      </div>
      <div class={lessonStyles.goal}>
        <h2 aria-live="polite">{props.message}</h2>
        <button
          ref={instructionsButton}
          class={lessonStyles.instructionsButton}
          type="button"
          aria-label={
            instructionsOpen()
              ? 'Hide singing instructions'
              : 'Show singing instructions'
          }
          aria-controls={instructionsId}
          aria-expanded={instructionsOpen()}
          onClick={() => setInstructionsOpen((open) => !open)}
        >
          <span aria-hidden="true">{instructionsOpen() ? '×' : '?'}</span>
        </button>
      </div>
      <Show when={stepLabels().length > 1}>
        <ol
          class={lessonStyles.sequence}
          aria-label={props.wave === true ? 'Lesson steps' : 'Note order'}
        >
          <For each={stepLabels()}>
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
                {step}
              </li>
            )}
          </For>
        </ol>
      </Show>
      <p
        id={instructionsId}
        class={lessonStyles.instructions}
        hidden={!instructionsOpen()}
      >
        {props.hint}
      </p>
      <div class={styles.voiceMeter}>
        <div
          class={styles.noteDisc}
          style={{ '--charge': `${percent()}%` }}
          role="img"
          aria-label={
            props.target === null
              ? 'Find your comfortable note'
              : `Target note: ${noteName(props.target)}`
          }
        >
          <span aria-hidden="true">
            <Show
              when={props.target !== null}
              fallback={
                <svg viewBox="0 0 32 32" fill="none" aria-hidden="true">
                  <circle cx="16" cy="16" r="10" />
                  <circle cx="16" cy="16" r="4" />
                  <path d="M16 2v6m0 16v6M2 16h6m16 0h6" />
                </svg>
              }
            >
              {noteName(props.target!)}
            </Show>
          </span>
        </div>
        <div class={styles.voiceReadout}>
          <span>
            {props.mode === 'finding'
              ? 'Finding your note…'
              : props.mode === 'reference'
                ? 'Your turn in a moment…'
                : props.pitch === null
                  ? 'Sing or hum gently.'
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
            Hear example
          </button>
        </Show>
        <button
          class={styles.textButton}
          type="button"
          onClick={() => props.onRefind()}
        >
          {props.pair ? 'Change notes' : 'Change note'}
        </button>
      </div>
    </section>
  )
}
