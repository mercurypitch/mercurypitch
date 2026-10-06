// Melody practice panel — an accessible glass ribbon driven by the shared compiled contour.

import { createMemo, createSignal, createUniqueId, For, onCleanup, onMount, Show, untrack, } from 'solid-js'
import type { CompiledMelody, MelodyCompileOptions, MelodyDefinition, } from '../core/melody-contour'
import { compileMelody, sampleMelodyAtPhase } from '../core/melody-contour'
import type { MelodyJudgePolicy } from '../core/melody-judge'
import type { MelodyReferencePlayer } from '../core/melody-reference'
import type { GlassGameHost } from '../host'
import { GameIcon, GameSurface } from './GameUI'
import type { MelodyPracticeController, MelodyPracticeRecordingAdapter, MelodyPracticeSnapshot, } from './melody-practice'
import { createMelodyPractice } from './melody-practice'
import styles from './MelodyPractice.module.css'
import { MelodyRibbon } from './MelodyRibbon'
import { MicrophoneInputRecovery } from './MicrophoneInputRecovery'
import chrome from './VoiceChallengePanel.module.css'

export interface MelodyPracticeChoice {
  value: number
  label: string
}

export interface MelodyPracticeProps {
  host: Pick<
    GlassGameHost,
    | 'createVoice'
    | 'readPreference'
    | 'writePreference'
    | 'subscribeForeground'
    | 'microphoneInput'
    | 'takeOverMicrophone'
    | 'releaseUnusedMicrophoneTakeover'
  >
  melody: MelodyDefinition
  createReference(compiled: CompiledMelody): MelodyReferencePlayer
  beforeCapture(): Promise<void>
  canPlay?(): boolean
  onReleaseVoice?(): void
  onComplete?(snapshot: MelodyPracticeSnapshot): void
  onChange?(snapshot: MelodyPracticeSnapshot): void
  onError?(message: string): void
  onCancel?(): void
  recording?: MelodyPracticeRecordingAdapter
  pace?: number
  transposeSemitones?: number
  judgePolicy?: Partial<MelodyJudgePolicy>
  allowedRange?: MelodyCompileOptions['allowedRange']
  showConfigurationControls?: boolean
  paceChoices?: readonly MelodyPracticeChoice[]
  transpositionChoices?: readonly MelodyPracticeChoice[]
}

const DEFAULT_PACE_CHOICES: readonly MelodyPracticeChoice[] = [
  { value: 0.8, label: 'Brisk' },
  { value: 1, label: 'Natural' },
  { value: 1.25, label: 'Spacious' },
]

const DEFAULT_TRANSPOSITION_CHOICES: readonly MelodyPracticeChoice[] = [
  { value: -3, label: 'Lower 3' },
  { value: -2, label: 'Lower 2' },
  { value: -1, label: 'Lower 1' },
  { value: 0, label: 'Original' },
  { value: 1, label: 'Higher 1' },
  { value: 2, label: 'Higher 2' },
  { value: 3, label: 'Higher 3' },
]

function emptySnapshot(props: MelodyPracticeProps): MelodyPracticeSnapshot {
  return untrack(() => ({
    mode: 'idle',
    contour: null,
    rootMidi: null,
    pace: props.pace ?? 1,
    transposeSemitones: props.transposeSemitones ?? 0,
    pitch: null,
    referenceTimeSeconds: 0,
    judge: null,
    message: props.melody.title,
    hint: props.melody.description,
    error: null,
    microphoneIssue: null,
    microphoneRecoveryPending: false,
  }))
}

function displayTime(snapshot: MelodyPracticeSnapshot): number {
  if (snapshot.contour === null) return 0
  if (snapshot.mode === 'reference') return snapshot.referenceTimeSeconds
  if (snapshot.judge !== null)
    return sampleMelodyAtPhase(snapshot.contour, snapshot.judge.progress)
      .timeSeconds
  return 0
}

function active(mode: MelodyPracticeSnapshot['mode']): boolean {
  return ['permission', 'calibrating', 'reference', 'singing'].includes(mode)
}

export function MelodyPractice(props: MelodyPracticeProps) {
  const titleId = createUniqueId()
  const descriptionId = createUniqueId()
  const instructionsId = createUniqueId()
  const [instructionsOpen, setInstructionsOpen] = createSignal(false)
  let instructionsButton!: HTMLButtonElement
  const [snapshot, setSnapshot] = createSignal(emptySnapshot(props))
  const [configurationError, setConfigurationError] = createSignal('')
  let controller: MelodyPracticeController | undefined

  onMount(() => {
    controller = createMelodyPractice({
      host: props.host,
      melody: props.melody,
      createReference: props.createReference,
      beforeCapture: props.beforeCapture,
      canPlay: () => props.canPlay?.() ?? true,
      onChange: (next) => {
        setSnapshot(next)
        props.onChange?.(next)
      },
      onComplete: (nextSnapshot) => props.onComplete?.(nextSnapshot),
      onError: (message) => props.onError?.(message),
      onReleaseVoice: () => props.onReleaseVoice?.(),
      recording: props.recording,
      pace: props.pace,
      transposeSemitones: props.transposeSemitones,
      judgePolicy: props.judgePolicy,
      allowedRange: props.allowedRange,
    })
  })

  onCleanup(() => controller?.dispose())

  // Show the authored shape before permission; this display preview supplies
  // no capture evidence and is replaced by the player's calibrated contour.
  const previewContour = createMemo(() =>
    compileMelody(props.melody, { rootMidi: 60 }),
  )
  const timelineSeconds = createMemo(() => displayTime(snapshot()))
  const paceChoices = () => props.paceChoices ?? DEFAULT_PACE_CHOICES
  const transpositionChoices = () =>
    props.transpositionChoices ?? DEFAULT_TRANSPOSITION_CHOICES
  const microphoneAction = () => snapshot().microphoneIssue?.action ?? 'none'
  const retryableMicrophoneIssue = createMemo(() => {
    const issue = snapshot().microphoneIssue
    return issue?.action === 'retry' ? issue : null
  })
  const canRecoverMicrophone = () =>
    microphoneAction() === 'retry' ||
    (microphoneAction() === 'take-over' &&
      props.host.takeOverMicrophone !== undefined)
  const mayStart = () =>
    !active(snapshot().mode) &&
    snapshot().mode !== 'paused' &&
    (snapshot().microphoneIssue === null || canRecoverMicrophone())
  const mayHear = () =>
    !active(snapshot().mode) &&
    snapshot().mode !== 'paused' &&
    snapshot().contour !== null

  const startOrRecover = (): void => {
    if (microphoneAction() === 'take-over') {
      void controller?.recoverMicrophone()
      return
    }
    void controller?.start()
  }

  const applyConfiguration = (configuration: {
    pace?: number
    transposeSemitones?: number
  }): void => {
    if (controller?.configure(configuration) === true) {
      setConfigurationError('')
      return
    }
    setConfigurationError(
      'That setting falls outside your comfortable range. Change your note first.',
    )
  }

  const cancel = (): void => {
    controller?.cancel()
    props.onCancel?.()
  }

  return (
    <section
      class={styles.practice}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      data-mode={snapshot().mode}
      onKeyDown={(event) => {
        if (event.key !== 'Escape' || !instructionsOpen()) return
        event.preventDefault()
        event.stopPropagation()
        setInstructionsOpen(false)
        instructionsButton.focus({ preventScroll: true })
      }}
    >
      <GameSurface class={styles.surface}>
        <header class={styles.heading}>
          <div>
            <h2 id={titleId}>{props.melody.title}</h2>
          </div>
          <div class={styles.cornerControls}>
            <button
              ref={instructionsButton}
              class={chrome.iconButton}
              type="button"
              aria-label={
                instructionsOpen()
                  ? 'Hide melody instructions'
                  : 'Show melody instructions'
              }
              aria-expanded={instructionsOpen()}
              aria-controls={instructionsId}
              onClick={() => setInstructionsOpen((open) => !open)}
            >
              <GameIcon name="help" />
            </button>
            <Show when={active(snapshot().mode)}>
              <button
                class={chrome.iconButton}
                type="button"
                onClick={cancel}
                aria-label="Cancel"
              >
                <GameIcon name="close" />
              </button>
            </Show>
          </div>
        </header>
        <div
          id={instructionsId}
          class={styles.instructions}
          hidden={!instructionsOpen()}
        >
          <p>{props.melody.description}</p>
          <p>
            Listen to the shape, then hum or sing it gently. Follow the ribbon
            forward. You may breathe between phrases, and you never need to sing
            loudly or hold one long breath.
          </p>
        </div>

        <MelodyRibbon
          contour={snapshot().contour ?? previewContour()}
          judge={snapshot().mode === 'singing' ? snapshot().judge : null}
          pitch={snapshot().mode === 'singing' ? snapshot().pitch : null}
          timelineSeconds={timelineSeconds()}
          complete={snapshot().mode === 'complete'}
        />

        <div class={styles.guidance} aria-live="polite" aria-atomic="true">
          <h3>{snapshot().message}</h3>
          <p id={descriptionId}>{snapshot().hint}</p>
          <Show
            when={
              snapshot().judge !== null &&
              snapshot().judge!.phraseCount > 1 &&
              snapshot().mode === 'singing'
            }
          >
            <span class={styles.phraseStatus}>
              Phrase {snapshot().judge!.phraseIndex + 1} of{' '}
              {snapshot().judge!.phraseCount}
            </span>
          </Show>
        </div>

        <Show when={retryableMicrophoneIssue()}>
          {(issue) => (
            <MicrophoneInputRecovery
              microphoneInput={props.host.microphoneInput}
              issue={issue()}
            />
          )}
        </Show>

        <Show when={props.showConfigurationControls === true}>
          <div class={styles.configuration} aria-label="Melody settings">
            <label>
              <span>Pace</span>
              <select
                value={snapshot().pace}
                disabled={active(snapshot().mode)}
                onChange={(event) =>
                  applyConfiguration({
                    pace: Number(event.currentTarget.value),
                  })
                }
              >
                <For each={paceChoices()}>
                  {(choice) => (
                    <option value={choice.value}>{choice.label}</option>
                  )}
                </For>
              </select>
            </label>
            <label>
              <span>Starting height</span>
              <select
                value={snapshot().transposeSemitones}
                disabled={active(snapshot().mode)}
                onChange={(event) =>
                  applyConfiguration({
                    transposeSemitones: Number(event.currentTarget.value),
                  })
                }
              >
                <For each={transpositionChoices()}>
                  {(choice) => (
                    <option value={choice.value}>{choice.label}</option>
                  )}
                </For>
              </select>
            </label>
            <Show when={configurationError()}>
              <p class={styles.configurationError} role="alert">
                {configurationError()}
              </p>
            </Show>
          </div>
        </Show>

        <div class={styles.actions}>
          <Show when={snapshot().mode === 'singing'}>
            <button
              class={styles.secondaryAction}
              type="button"
              onClick={() => void controller?.replay()}
            >
              <GameIcon name="speaker" />
              Hear melody again
            </button>
          </Show>
          <Show when={mayHear()}>
            <button
              class={styles.secondaryAction}
              type="button"
              disabled={snapshot().microphoneRecoveryPending}
              onClick={() => void controller?.hear()}
            >
              <GameIcon name="speaker" />
              Hear melody
            </button>
          </Show>
          <Show when={mayStart()}>
            <button
              class={styles.primaryAction}
              type="button"
              disabled={snapshot().microphoneRecoveryPending}
              aria-busy={snapshot().microphoneRecoveryPending}
              onClick={startOrRecover}
            >
              <GameIcon name="play" />
              {snapshot().microphoneRecoveryPending
                ? 'Moving microphone…'
                : microphoneAction() === 'take-over'
                  ? 'Use it here'
                  : snapshot().mode === 'error'
                    ? 'Try again'
                    : snapshot().rootMidi === null
                      ? 'Find my note and sing'
                      : snapshot().mode === 'complete'
                        ? 'Sing again'
                        : 'Sing the melody'}
            </button>
          </Show>
        </div>

        <div class={styles.utilityRow}>
          <button
            type="button"
            disabled={active(snapshot().mode)}
            aria-label="Change my note"
            onClick={() => controller?.refind()}
          >
            <GameIcon name="tuning" />
            Change
          </button>
        </div>
      </GameSurface>
    </section>
  )
}
