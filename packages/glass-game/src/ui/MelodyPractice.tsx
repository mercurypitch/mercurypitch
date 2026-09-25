// Melody practice panel — an accessible glass ribbon driven by the shared compiled contour.

import { createMemo, createSignal, createUniqueId, For, onCleanup, onMount, Show, untrack, } from 'solid-js'
import type { CompiledMelody, MelodyCompileOptions, MelodyDefinition, } from '../core/melody-contour'
import { compileMelody, sampleMelodyAtPhase } from '../core/melody-contour'
import type { MelodyJudgePolicy } from '../core/melody-judge'
import type { MelodyReferencePlayer } from '../core/melody-reference'
import type { GlassGameHost } from '../host'
import type { MelodyPracticeController, MelodyPracticeRecordingAdapter, MelodyPracticeSnapshot, } from './melody-practice'
import { createMelodyPractice } from './melody-practice'
import styles from './MelodyPractice.module.css'
import { MicrophoneInputRecovery } from './MicrophoneInputRecovery'

const VIEW_WIDTH = 720
const VIEW_HEIGHT = 220
const HORIZONTAL_PADDING = 34
const VERTICAL_PADDING = 28

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

interface RibbonPoint {
  x: number
  y: number
}

interface RibbonGeometry {
  paths: readonly string[]
  anchors: readonly RibbonPoint[]
  midiToY(midi: number): number
  timeToX(timeSeconds: number): number
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

function ribbonGeometry(contour: CompiledMelody | null): RibbonGeometry {
  if (contour === null)
    return {
      paths: [],
      anchors: [],
      midiToY: () => VIEW_HEIGHT / 2,
      timeToX: () => HORIZONTAL_PADDING,
    }
  const pitchMiddle = (contour.minimumMidi + contour.maximumMidi) / 2
  const pitchSpan = Math.max(3, contour.maximumMidi - contour.minimumMidi + 2.5)
  const usableWidth = VIEW_WIDTH - HORIZONTAL_PADDING * 2
  const usableHeight = VIEW_HEIGHT - VERTICAL_PADDING * 2
  const timeToX = (timeSeconds: number): number =>
    HORIZONTAL_PADDING +
    (Math.max(0, Math.min(contour.durationSeconds, timeSeconds)) /
      contour.durationSeconds) *
      usableWidth
  const midiToY = (midi: number): number =>
    VIEW_HEIGHT / 2 - ((midi - pitchMiddle) / pitchSpan) * usableHeight
  const paths: string[] = []
  let points: RibbonPoint[] = []
  const finishPath = (): void => {
    if (points.length === 0) return
    paths.push(
      points
        .map(
          (point, index) =>
            `${index === 0 ? 'M' : 'L'}${point.x.toFixed(2)} ${point.y.toFixed(2)}`,
        )
        .join(' '),
    )
    points = []
  }
  for (const sample of contour.samples) {
    if (sample.midi === null) {
      finishPath()
      continue
    }
    points.push({ x: timeToX(sample.timeSeconds), y: midiToY(sample.midi) })
  }
  finishPath()
  return {
    paths,
    anchors: contour.anchors.map((anchor) => ({
      x: timeToX(anchor.completedAtSeconds),
      y: midiToY(anchor.midi),
    })),
    midiToY,
    timeToX,
  }
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
  const clipId = createUniqueId()
  const titleId = createUniqueId()
  const descriptionId = createUniqueId()
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
  const geometry = createMemo(() =>
    ribbonGeometry(snapshot().contour ?? previewContour()),
  )
  const timelineSeconds = createMemo(() => displayTime(snapshot()))
  const progressX = createMemo(() => geometry().timeToX(timelineSeconds()))
  const livePoint = createMemo(() => {
    const current = snapshot()
    if (
      current.mode !== 'singing' ||
      current.pitch === null ||
      current.contour === null
    )
      return null
    return {
      x: geometry().timeToX(displayTime(current)),
      y: geometry().midiToY(current.pitch),
    }
  })
  const targetPoint = createMemo(() => {
    const current = snapshot()
    if (
      current.mode !== 'singing' ||
      current.judge === null ||
      current.contour === null
    )
      return null
    return {
      x: geometry().timeToX(displayTime(current)),
      y: geometry().midiToY(current.judge.targetMidi),
    }
  })
  const progressPercent = createMemo(() => {
    const contour = snapshot().contour
    if (contour === null) return 0
    return Math.round(
      (Math.max(0, Math.min(contour.durationSeconds, timelineSeconds())) /
        contour.durationSeconds) *
        100,
    )
  })
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
    >
      <header class={styles.heading}>
        <div>
          <h2 id={titleId}>{props.melody.title}</h2>
          <p>{props.melody.description}</p>
        </div>
        <Show when={active(snapshot().mode)}>
          <button class={styles.cancel} type="button" onClick={cancel}>
            Cancel
          </button>
        </Show>
      </header>

      <div class={styles.ribbonFrame}>
        <svg
          class={styles.ribbon}
          viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
          role="img"
          aria-label="Melody ribbon. The lit portion shows how far you have travelled."
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            <clipPath id={clipId}>
              <rect
                x="0"
                y="0"
                width={Math.max(0, progressX())}
                height={VIEW_HEIGHT}
              />
            </clipPath>
          </defs>
          <g class={styles.guideLines} aria-hidden="true">
            <path
              d={`M${HORIZONTAL_PADDING} 70H${VIEW_WIDTH - HORIZONTAL_PADDING}`}
            />
            <path
              d={`M${HORIZONTAL_PADDING} 150H${VIEW_WIDTH - HORIZONTAL_PADDING}`}
            />
          </g>
          <g class={styles.ribbonShadow} aria-hidden="true">
            <For each={geometry().paths}>{(path) => <path d={path} />}</For>
          </g>
          <g
            class={styles.ribbonGlow}
            clip-path={`url(#${clipId})`}
            aria-hidden="true"
          >
            <For each={geometry().paths}>{(path) => <path d={path} />}</For>
          </g>
          <g class={styles.anchorMarks} aria-hidden="true">
            <For each={geometry().anchors}>
              {(point) => <circle cx={point.x} cy={point.y} r="5" />}
            </For>
          </g>
          <Show when={targetPoint()}>
            {(point) => (
              <circle
                class={styles.target}
                cx={point().x}
                cy={point().y}
                r="12"
                aria-hidden="true"
              />
            )}
          </Show>
          <Show when={livePoint()}>
            {(point) => (
              <circle
                class={styles.livePitch}
                cx={point().x}
                cy={point().y}
                r="7"
                aria-hidden="true"
              />
            )}
          </Show>
        </svg>
        <div
          class={styles.progress}
          role="progressbar"
          aria-label="Melody progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progressPercent()}
        >
          <span style={{ width: `${progressPercent()}%` }} />
        </div>
      </div>

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
                applyConfiguration({ pace: Number(event.currentTarget.value) })
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
          onClick={() => controller?.refind()}
        >
          Change my note
        </button>
        <details>
          <summary>How this works</summary>
          <p>
            Listen to the shape, then hum or sing it gently. Follow the ribbon
            forward. You may breathe between phrases, and you never need to sing
            loudly or hold one long breath.
          </p>
        </details>
      </div>
    </section>
  )
}
