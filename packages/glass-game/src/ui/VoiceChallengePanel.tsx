// Voice challenge presentation — shared guidance for held notes, pairs and gentle waves.
import { createSignal, createUniqueId, For, Show } from 'solid-js'
import type { PitchTargetId } from '../contracts'
import { GameControlMaterial, GameIcon, GameSurface } from './GameUI'
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
  const replayDescriptionId = createUniqueId()
  const [instructionsOpen, setInstructionsOpen] = createSignal(false)
  let instructionsButton!: HTMLButtonElement
  const percent = () => Math.round(Math.max(0, Math.min(1, props.charge)) * 100)
  const canReplay = () => props.target !== null && props.mode === 'singing'
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
      class={lessonStyles.panel}
      aria-label="Voice challenge"
      data-challenge-panel
      data-voice-mode={props.mode}
      data-voice-layout={
        !props.pair && props.wave !== true ? 'single' : 'sequence'
      }
      data-step-index={props.stepIndex}
      onKeyDown={handlePanelKeyDown}
    >
      <GameSurface class={lessonStyles.surface} shape="console">
        <div class={lessonStyles.content}>
          <div class={lessonStyles.heading}>
            <span>{props.label}</span>
            <h2 aria-live="polite">{props.message}</h2>
          </div>
          <div class={lessonStyles.cornerControls}>
            <button
              ref={instructionsButton}
              class={lessonStyles.iconButton}
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
              <GameIcon name="help" />
            </button>
            <button
              class={lessonStyles.iconButton}
              type="button"
              aria-label="Cancel"
              title="Close singing challenge"
              onClick={() => props.onCancel()}
            >
              <GameIcon name="close" />
            </button>
          </div>
          <div class={lessonStyles.targetColumn}>
            <button
              class={lessonStyles.target}
              type="button"
              aria-label="Hear example"
              aria-describedby={replayDescriptionId}
              disabled={!canReplay()}
              onClick={() => props.onReplay()}
            >
              <GameControlMaterial kind="lens" />
              <span
                class={lessonStyles.targetNote}
                role="img"
                aria-label={
                  props.target === null
                    ? 'Find your comfortable note'
                    : `Target note: ${noteName(props.target)}`
                }
              >
                <Show
                  when={props.target !== null}
                  fallback={<GameIcon name="tuning" />}
                >
                  {noteName(props.target!)}
                </Show>
              </span>
              <span class={lessonStyles.hear}>
                <GameIcon name="speaker" />
                Hear
              </span>
            </button>
            <div
              class={lessonStyles.chargeTrack}
              role="progressbar"
              aria-label="Glass resonance"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={percent()}
            >
              <span style={{ width: `${percent()}%` }} />
            </div>
          </div>
          <button
            class={lessonStyles.changeButton}
            type="button"
            aria-label={props.pair ? 'Change notes' : 'Change note'}
            disabled={props.mode !== 'singing'}
            onClick={() => props.onRefind()}
          >
            <GameIcon name="tuning" />
            Change
          </button>
          <div class={lessonStyles.readout}>
            <span>
              {props.mode === 'finding'
                ? 'Finding your note…'
                : props.mode === 'reference'
                  ? 'Your turn in a moment…'
                  : props.pitch === null
                    ? 'Sing or hum gently.'
                    : `You: ${noteName(props.pitch)}`}
            </span>
            <span
              class={lessonStyles.percent}
              aria-label={`${percent()} percent resonance`}
            >
              {percent()}%
            </span>
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
          <span id={replayDescriptionId} class={lessonStyles.srOnly}>
            Hear the target again and restart this attempt.
          </span>
        </div>
      </GameSurface>
    </section>
  )
}
