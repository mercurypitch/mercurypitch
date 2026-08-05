import type { Component } from 'solid-js'
import { createEffect, createMemo, createSignal, createUniqueId, For, getOwner, onCleanup, runWithOwner, Show, untrack, } from 'solid-js'
import { audioDurationLabel, createGuidedExerciseAudioClip, decodeGuidedExerciseAudio, GUIDED_EXAMPLE_ACCEPT, GUIDED_EXAMPLE_CLIP_MS, GUIDED_EXAMPLE_FORMATS, } from '@/features/zen/guided-exercise-audio'
import type { ZenExampleAudio, ZenExerciseCategory, ZenExerciseDefinition, } from '@/features/zen/types'
import { midiToNote } from '@/lib/scale-data'
import styles from './ExerciseEditor.module.css'
import { ExercisePreview } from './ExercisePreview'
import { ExerciseTimelineEditor } from './ExerciseTimelineEditor'

export type ExerciseLifecycle =
  | 'draft'
  | 'published'
  | 'superseded'
  | 'archived'

export type ExerciseEditorStatus =
  | 'idle'
  | 'loading'
  | 'saving'
  | 'publishing'
  | 'archiving'
  | 'restoring'
  | 'duplicating'
  | 'uploading'
  | 'error'

export interface ExerciseEditorValidationIssue {
  path: string
  message: string
  severity?: 'error' | 'warning'
}

export interface ExerciseEditorProps {
  value: ZenExerciseDefinition
  lifecycle: ExerciseLifecycle
  status: ExerciseEditorStatus
  validationIssues: readonly ExerciseEditorValidationIssue[]
  identityLocked?: boolean
  onChange: (value: ZenExerciseDefinition) => void
  onInteractionBusyChange?: (busy: boolean) => void
  onSave?: (value: ZenExerciseDefinition) => Promise<void>
  onPublish?: (value: ZenExerciseDefinition) => Promise<void>
  onArchive?: (value: ZenExerciseDefinition) => Promise<void>
  onRestore?: (value: ZenExerciseDefinition) => Promise<void>
  onDuplicate?: (value: ZenExerciseDefinition) => Promise<void>
  onExampleAudioFile?: (
    file: File,
    value: ZenExerciseDefinition,
    recordedDurationMs?: number,
  ) => Promise<ZenExampleAudio | undefined>
  onRemoveExampleAudio?: (
    audio: ZenExampleAudio,
    value: ZenExerciseDefinition,
  ) => Promise<void>
}

type LocalAction =
  | 'save'
  | 'publish'
  | 'archive'
  | 'restore'
  | 'duplicate'
  | 'upload'
  | 'preparing-audio'
  | 'remove-audio'

const CATEGORY_OPTIONS: readonly {
  value: ZenExerciseCategory
  label: string
}[] = [
  { value: 'range', label: 'Range' },
  { value: 'agility', label: 'Agility' },
  { value: 'scales', label: 'Scales' },
  { value: 'tone', label: 'Tone' },
  { value: 'articulation', label: 'Articulation' },
]

const LEVEL_OPTIONS = [
  ['foundation', 'Foundation'],
  ['developing', 'Developing'],
  ['advanced', 'Advanced'],
] as const

const EXTERNAL_BUSY_STATUSES: readonly ExerciseEditorStatus[] = [
  'loading',
  'saving',
  'publishing',
  'archiving',
  'restoring',
  'duplicating',
  'uploading',
]

const AUDIO_BUSY_ACTIONS: readonly LocalAction[] = [
  'upload',
  'preparing-audio',
  'remove-audio',
]

const STATUS_LABELS: Record<ExerciseEditorStatus, string> = {
  idle: 'Ready',
  loading: 'Loading',
  saving: 'Saving',
  publishing: 'Publishing',
  archiving: 'Archiving',
  restoring: 'Restoring',
  duplicating: 'Duplicating',
  uploading: 'Uploading audio',
  error: 'Action failed',
}

const actionLabel = (action: LocalAction | null): string | null => {
  if (action === null) return null
  const labels: Record<LocalAction, string> = {
    save: 'Saving',
    publish: 'Publishing',
    archive: 'Archiving',
    restore: 'Restoring',
    duplicate: 'Duplicating',
    upload: 'Uploading audio',
    'preparing-audio': 'Preparing audio',
    'remove-audio': 'Removing audio',
  }
  return labels[action]
}

const errorMessage = (error: unknown): string =>
  error instanceof Error && error.message.trim() !== ''
    ? error.message
    : 'The action could not be completed. Check the connection and try again.'

type RecordingPhase = 'idle' | 'acquiring' | 'recording' | 'preparing'

interface ExampleAudioUploadContext {
  callback: NonNullable<ExerciseEditorProps['onExampleAudioFile']>
  value: ZenExerciseDefinition
  onChange: ExerciseEditorProps['onChange']
}

interface PendingExampleAudioFile {
  file: File
  buffer: AudioBuffer
  durationMs: number
  clipStartMs: number
  origin: 'file' | 'recording'
}

type RecordingDurationChoice = 5 | 10 | 'custom'

const RECORDING_DURATION_TEMPLATES = [5, 10] as const
const MAX_EXAMPLE_RECORDING_SECONDS = 15
const RECORDER_MIME_TYPES = [
  'audio/mp4;codecs=mp4a.40.2',
  'audio/webm;codecs=opus',
  'audio/ogg;codecs=opus',
  'audio/mp4',
  'audio/webm',
  'audio/ogg',
] as const

const preferredRecorderMimeType = (): string | undefined =>
  RECORDER_MIME_TYPES.find((mimeType) =>
    MediaRecorder.isTypeSupported(mimeType),
  )

const recordingExtension = (mimeType: string): string => {
  const baseType = mimeType.split(';', 1)[0]?.toLowerCase()
  if (baseType === 'audio/mp4' || baseType === 'audio/x-m4a') return 'm4a'
  if (baseType === 'audio/aac') return 'aac'
  if (baseType === 'audio/mpeg') return 'mp3'
  if (baseType === 'audio/ogg') return 'ogg'
  return 'webm'
}

const recordingTimeLabel = (durationMs: number, limitMs: number): string =>
  `${(durationMs / 1000).toFixed(1)} / ${(limitMs / 1000).toFixed(1)} s`

const recordingSecondsLabel = (durationMs: number): string =>
  (durationMs / 1000).toFixed(durationMs % 1000 === 0 ? 0 : 1)

export const getExerciseRecordingLimitMs = (
  choice: RecordingDurationChoice,
  customSeconds = MAX_EXAMPLE_RECORDING_SECONDS,
): number => {
  const seconds = choice === 'custom' ? customSeconds : choice
  return Math.round(
    Math.min(
      MAX_EXAMPLE_RECORDING_SECONDS,
      Math.max(1, Number.isFinite(seconds) ? seconds : 5),
    ) * 1000,
  )
}

export const shouldAutoUploadPreparedExampleAudio = (
  origin: PendingExampleAudioFile['origin'],
  durationMs: number,
): boolean => origin === 'file' && durationMs <= GUIDED_EXAMPLE_CLIP_MS

interface ExerciseRecordingControlsProps {
  activeLimitMs: number
  available: boolean
  customSeconds: number
  durationChoice: RecordingDurationChoice
  elapsedMs: number
  hasExistingAudio: boolean
  phase: RecordingPhase
  readOnly: boolean
  selectedLimitMs: number
  transcriptReady: boolean
  onCancel: () => void
  onCustomSecondsChange: (seconds: number) => void
  onDurationChoiceChange: (choice: RecordingDurationChoice) => void
  onStart: () => void
  onStop: () => void
}

const ExerciseRecordingControls: Component<ExerciseRecordingControlsProps> = (
  props,
) => {
  const displayedLimitMs = (): number =>
    props.phase === 'idle' ? props.selectedLimitMs : props.activeLimitMs

  return (
    <div class={styles.recordingTake} data-phase={props.phase}>
      <div class={styles.recordingStatus} aria-live="polite">
        <span aria-hidden="true" />
        <strong>
          {props.phase === 'acquiring'
            ? 'Opening microphone'
            : props.phase === 'recording'
              ? 'Recording example'
              : props.phase === 'preparing'
                ? 'Preparing review'
                : 'Record from microphone'}
        </strong>
        <output>
          {recordingTimeLabel(props.elapsedMs, displayedLimitMs())}
        </output>
      </div>
      <div class={styles.recordingDuration}>
        <span>Capture window</span>
        <div
          class={styles.recordingTemplates}
          role="group"
          aria-label="Recording length"
        >
          <For each={RECORDING_DURATION_TEMPLATES}>
            {(seconds) => (
              <button
                type="button"
                aria-pressed={props.durationChoice === seconds}
                disabled={props.readOnly || props.phase !== 'idle'}
                onClick={() => props.onDurationChoiceChange(seconds)}
              >
                {seconds} sec
              </button>
            )}
          </For>
          <button
            type="button"
            aria-pressed={props.durationChoice === 'custom'}
            disabled={props.readOnly || props.phase !== 'idle'}
            onClick={() => props.onDurationChoiceChange('custom')}
          >
            Custom
          </button>
        </div>
        <Show when={props.durationChoice === 'custom'}>
          <label class={styles.customRecordingDuration}>
            <span>Custom seconds</span>
            <input
              type="number"
              min="1"
              max={MAX_EXAMPLE_RECORDING_SECONDS}
              step="1"
              value={props.customSeconds}
              disabled={props.readOnly || props.phase !== 'idle'}
              onInput={(event) => {
                const seconds = event.currentTarget.valueAsNumber
                props.onCustomSecondsChange(
                  Math.min(
                    MAX_EXAMPLE_RECORDING_SECONDS,
                    Math.max(1, Number.isFinite(seconds) ? seconds : 5),
                  ),
                )
              }}
            />
            <small>1–15 seconds</small>
          </label>
        </Show>
      </div>
      <div
        class={styles.recordingProgress}
        role="progressbar"
        aria-label="Example recording duration"
        aria-valuemin="0"
        aria-valuemax={displayedLimitMs()}
        aria-valuenow={Math.round(props.elapsedMs)}
      >
        <span
          style={{
            width: `${Math.min(100, (props.elapsedMs / displayedLimitMs()) * 100)}%`,
          }}
        />
      </div>
      <div class={styles.recordingActions}>
        <button
          type="button"
          classList={{
            [styles.stopRecording]: props.phase === 'recording',
          }}
          disabled={
            props.phase === 'preparing' ||
            (props.phase !== 'recording' &&
              props.phase !== 'acquiring' &&
              (props.readOnly || !props.transcriptReady))
          }
          onClick={() => {
            if (props.phase === 'recording') props.onStop()
            else if (props.phase === 'acquiring') props.onCancel()
            else props.onStart()
          }}
        >
          {props.phase === 'recording'
            ? 'Stop and review recording'
            : props.phase === 'acquiring'
              ? 'Cancel microphone request'
              : props.hasExistingAudio
                ? `Record ${recordingSecondsLabel(props.selectedLimitMs)}-second replacement`
                : `Record ${recordingSecondsLabel(props.selectedLimitMs)}-second example`}
        </button>
        <small>
          {!props.available
            ? 'Direct recording is not supported in this browser.'
            : !props.transcriptReady
              ? 'Enter the transcript above before recording.'
              : `Stops automatically at ${recordingSecondsLabel(displayedLimitMs())} seconds, then opens review and trim controls.`}
        </small>
      </div>
    </div>
  )
}

export function isExerciseEditorBusy(
  hasLocalAction: boolean,
  hasExternalAction: boolean,
  recordingActive: boolean,
): boolean {
  return hasLocalAction || hasExternalAction || recordingActive
}

export const ExerciseEditor: Component<ExerciseEditorProps> = (props) => {
  const [view, setView] = createSignal<'author' | 'preview'>('author')
  const [selectedTargetId, setSelectedTargetId] = createSignal<string | null>(
    untrack(() => props.value.targets[0]?.id ?? null),
  )
  const [localAction, setLocalAction] = createSignal<LocalAction | null>(null)
  const [localError, setLocalError] = createSignal<string | null>(null)
  const [recordingPhase, setRecordingPhase] =
    createSignal<RecordingPhase>('idle')
  const [recordingElapsedMs, setRecordingElapsedMs] = createSignal(0)
  const [recordingDurationChoice, setRecordingDurationChoice] =
    createSignal<RecordingDurationChoice>(5)
  const [customRecordingSeconds, setCustomRecordingSeconds] = createSignal(15)
  const selectedRecordingLimitMs = createMemo(() =>
    getExerciseRecordingLimitMs(
      recordingDurationChoice(),
      customRecordingSeconds(),
    ),
  )
  const [pendingExampleAudioFile, setPendingExampleAudioFile] =
    createSignal<PendingExampleAudioFile | null>(null)
  const [audioDropActive, setAudioDropActive] = createSignal(false)
  const [audioError, setAudioError] = createSignal<string | null>(null)
  const editorId = createUniqueId()
  const owner = getOwner()
  let exampleTranscriptInput: HTMLInputElement | undefined
  let pendingExerciseKey = untrack(
    () => `${props.value.id}:${props.value.version}`,
  )

  let recordingRequest = 0
  let fileSelectionRequest = 0
  let recordingRecorder: MediaRecorder | null = null
  let recordingStream: MediaStream | null = null
  let recordingChunks: Blob[] = []
  let recordingStartedAt = 0
  let recordingStopTimer: number | undefined
  let recordingElapsedTimer: number | undefined
  let discardRecording = false
  let disposed = false
  let activeRecordingLimitMs = 5_000
  let recordingUploadContext: ExampleAudioUploadContext | null = null

  const inOwner = (callback: () => void): void => {
    if (owner === null) callback()
    else runWithOwner(owner, callback)
  }

  const recordingBusy = createMemo(() => recordingPhase() !== 'idle')
  const audioInteractionBusy = createMemo(() => {
    const action = localAction()
    return (
      recordingBusy() ||
      (action !== null && AUDIO_BUSY_ACTIONS.includes(action))
    )
  })
  const busy = createMemo(() =>
    isExerciseEditorBusy(
      localAction() !== null,
      EXTERNAL_BUSY_STATUSES.includes(props.status),
      recordingBusy(),
    ),
  )
  const readOnly = createMemo(() => props.lifecycle !== 'draft' || busy())
  const directRecordingAvailable = (): boolean =>
    typeof navigator !== 'undefined' &&
    navigator.mediaDevices?.getUserMedia !== undefined &&
    typeof MediaRecorder !== 'undefined'
  const blockingIssues = createMemo(() =>
    props.validationIssues.filter((issue) => issue.severity !== 'warning'),
  )
  const scoreWeightTotal = createMemo(
    () =>
      props.value.scoring.pitchWeight +
      props.value.scoring.coverageWeight +
      props.value.scoring.steadinessWeight,
  )

  createEffect(() => {
    props.onInteractionBusyChange?.(audioInteractionBusy())
  })
  const rootLabel = createMemo(() => {
    const note = midiToNote(props.value.defaultRootMidi)
    return `${note.name}${note.octave}`
  })

  const emit = (patch: Partial<ZenExerciseDefinition>): void => {
    if (readOnly()) return
    props.onChange({ ...props.value, ...patch })
  }

  const runAction = (
    action: LocalAction,
    callback: ((value: ZenExerciseDefinition) => Promise<void>) | undefined,
  ): void => {
    if (callback === undefined || busy()) return
    const value = props.value
    setLocalAction(action)
    setLocalError(null)
    void callback(value)
      .catch((error: unknown) => setLocalError(errorMessage(error)))
      .finally(() => setLocalAction(null))
  }

  const updateExampleAudio = (patch: Partial<ZenExampleAudio>): void => {
    const current = props.value.exampleAudio
    if (current === undefined || readOnly()) return
    emit({ exampleAudio: { ...current, ...patch } })
  }

  const addExampleAudioMetadata = (): void => {
    emit({
      exampleAudio: {
        src: '',
        durationMs: 5000,
        locale: 'en-GB',
        source: 'coach',
        transcript: '',
      },
    })
  }

  const beginExampleAudioUpload = (
    file: File,
    context: ExampleAudioUploadContext,
    recordedDurationMs?: number,
    onFailure?: () => void,
  ): void => {
    setLocalAction('upload')
    setAudioError(null)
    const upload =
      recordedDurationMs === undefined
        ? context.callback(file, context.value)
        : context.callback(file, context.value, recordedDurationMs)
    void upload
      .then((audio) => {
        if (audio !== undefined) {
          context.onChange({ ...context.value, exampleAudio: audio })
        }
      })
      .catch((error: unknown) => {
        onFailure?.()
        setAudioError(errorMessage(error))
      })
      .finally(() => setLocalAction(null))
  }

  const uploadDecodedExampleAudio = (
    pending: PendingExampleAudioFile,
    transcript: string,
    callback: NonNullable<ExerciseEditorProps['onExampleAudioFile']>,
    value: ZenExerciseDefinition,
    onChange: ExerciseEditorProps['onChange'],
  ): void => {
    const exampleAudio = value.exampleAudio
    if (exampleAudio === undefined || transcript.trim() === '') return
    const clip = createGuidedExerciseAudioClip(
      pending.file,
      pending.buffer,
      pending.clipStartMs,
    )
    setPendingExampleAudioFile(null)
    beginExampleAudioUpload(
      clip.file,
      {
        callback,
        value: {
          ...value,
          exampleAudio: {
            ...exampleAudio,
            transcript: transcript.trim(),
            ...(pending.origin === 'recording' ? { source: 'coach' } : {}),
          },
        },
        onChange,
      },
      clip.durationMs,
      () => setPendingExampleAudioFile(pending),
    )
  }

  const uploadPendingExampleAudio = (transcript: string): void => {
    const pending = pendingExampleAudioFile()
    const callback = props.onExampleAudioFile
    const value = props.value
    if (
      pending === null ||
      callback === undefined ||
      value.exampleAudio === undefined ||
      transcript.trim() === '' ||
      busy() ||
      readOnly()
    ) {
      return
    }
    uploadDecodedExampleAudio(
      pending,
      transcript,
      callback,
      value,
      props.onChange,
    )
  }

  const prepareExampleAudioFile = (
    file: File,
    context: ExampleAudioUploadContext,
    origin: PendingExampleAudioFile['origin'],
  ): void => {
    const request = ++fileSelectionRequest
    const callback = context.callback
    const value = context.value
    const onChange = context.onChange
    const transcript = value.exampleAudio?.transcript ?? ''
    setAudioDropActive(false)
    setAudioError(null)
    setPendingExampleAudioFile(null)
    setLocalAction('preparing-audio')
    void decodeGuidedExerciseAudio(file)
      .then((decoded) =>
        inOwner(() => {
          if (disposed || request !== fileSelectionRequest) return
          const pending: PendingExampleAudioFile = {
            file,
            buffer: decoded.buffer,
            durationMs: decoded.durationMs,
            clipStartMs: 0,
            origin,
          }
          setPendingExampleAudioFile(pending)
          setLocalAction(null)
          if (origin === 'recording') setRecordingPhase('idle')
          // Mark the editor dirty so its existing navigation guard also
          // protects this local, not-yet-uploaded file selection.
          onChange(value)
          if (transcript.trim() === '') {
            exampleTranscriptInput?.focus()
            return
          }
          if (
            shouldAutoUploadPreparedExampleAudio(origin, decoded.durationMs)
          ) {
            uploadDecodedExampleAudio(
              pending,
              transcript,
              callback,
              value,
              onChange,
            )
          }
        }),
      )
      .catch((error: unknown) =>
        inOwner(() => {
          if (disposed || request !== fileSelectionRequest) return
          setLocalAction(null)
          if (origin === 'recording') setRecordingPhase('idle')
          setAudioError(errorMessage(error))
        }),
      )
  }

  const selectExampleAudioFile = (file: File): void => {
    const callback = props.onExampleAudioFile
    if (readOnly() || callback === undefined) return
    prepareExampleAudioFile(
      file,
      { callback, value: props.value, onChange: props.onChange },
      'file',
    )
  }

  const clearRecordingTimers = (): void => {
    if (recordingStopTimer !== undefined) {
      window.clearTimeout(recordingStopTimer)
      recordingStopTimer = undefined
    }
    if (recordingElapsedTimer !== undefined) {
      window.clearInterval(recordingElapsedTimer)
      recordingElapsedTimer = undefined
    }
  }

  const releaseRecordingStream = (): void => {
    recordingStream?.getTracks().forEach((track) => track.stop())
    recordingStream = null
  }

  const finishExampleRecording = (): void => {
    const recorder = recordingRecorder
    const uploadContext = recordingUploadContext
    const durationMs = Math.min(
      activeRecordingLimitMs,
      Math.max(1, Math.round(performance.now() - recordingStartedAt)),
    )
    const recorderType = recorder?.mimeType
    const chunkType = recordingChunks[0]?.type
    const mimeType =
      recorderType !== undefined && recorderType !== ''
        ? recorderType
        : chunkType !== undefined && chunkType !== ''
          ? chunkType
          : 'audio/webm'
    const chunks = recordingChunks
    recordingRecorder = null
    recordingChunks = []
    recordingUploadContext = null
    clearRecordingTimers()
    releaseRecordingStream()

    if (discardRecording || disposed) {
      if (!disposed) setRecordingPhase('idle')
      return
    }

    const recording = new Blob(chunks, { type: mimeType })
    setRecordingElapsedMs(durationMs)
    if (recording.size === 0) {
      setRecordingPhase('idle')
      setAudioError('The microphone recording was empty. Please try again.')
      return
    }
    if (uploadContext === null) {
      setRecordingPhase('idle')
      setAudioError('The recording session expired. Please try again.')
      return
    }
    const file = new File(
      [recording],
      `zen-example-${Date.now()}.${recordingExtension(mimeType)}`,
      { type: mimeType },
    )
    prepareExampleAudioFile(file, uploadContext, 'recording')
  }

  const stopExampleRecording = (): void => {
    const recorder = recordingRecorder
    if (recorder === null || recorder.state === 'inactive') return
    setRecordingElapsedMs(
      Math.min(
        activeRecordingLimitMs,
        Math.max(0, performance.now() - recordingStartedAt),
      ),
    )
    setRecordingPhase('preparing')
    clearRecordingTimers()
    recorder.stop()
  }

  const startExampleRecording = (): void => {
    if (!directRecordingAvailable()) {
      setAudioError(
        'Direct recording is not supported in this browser. Choose an audio file instead.',
      )
      return
    }
    const callback = props.onExampleAudioFile
    const value = props.value
    const exampleAudio = value.exampleAudio
    if (
      readOnly() ||
      callback === undefined ||
      exampleAudio === undefined ||
      exampleAudio.transcript.trim() === ''
    ) {
      return
    }

    const request = ++recordingRequest
    const limitMs = selectedRecordingLimitMs()
    setAudioError(null)
    setRecordingElapsedMs(0)
    activeRecordingLimitMs = limitMs
    recordingUploadContext = {
      callback,
      value: {
        ...value,
        exampleAudio: { ...exampleAudio, source: 'coach' },
      },
      onChange: props.onChange,
    }
    setRecordingPhase('acquiring')
    void navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) =>
        inOwner(() => {
          if (disposed || request !== recordingRequest) {
            stream.getTracks().forEach((track) => track.stop())
            return
          }

          recordingStream = stream
          const mimeType = preferredRecorderMimeType()
          const recorder =
            mimeType === undefined
              ? new MediaRecorder(stream)
              : new MediaRecorder(stream, { mimeType })
          recordingRecorder = recorder
          recordingChunks = []
          discardRecording = false
          recorder.ondataavailable = (event) => {
            if (request === recordingRequest && event.data.size > 0) {
              recordingChunks.push(event.data)
            }
          }
          recorder.onerror = () =>
            inOwner(() => {
              if (disposed || request !== recordingRequest) return
              discardRecording = true
              setAudioError(
                'The microphone recording failed. Please try again.',
              )
              stopExampleRecording()
            })
          recorder.onstop = () =>
            inOwner(() => {
              if (disposed || request !== recordingRequest) return
              finishExampleRecording()
            })
          recordingStartedAt = performance.now()
          recorder.start()
          setRecordingPhase('recording')
          recordingElapsedTimer = window.setInterval(
            () =>
              inOwner(() => {
                setRecordingElapsedMs(
                  Math.min(limitMs, performance.now() - recordingStartedAt),
                )
              }),
            100,
          )
          recordingStopTimer = window.setTimeout(
            () => inOwner(stopExampleRecording),
            limitMs,
          )
        }),
      )
      .catch((error: unknown) =>
        inOwner(() => {
          if (disposed || request !== recordingRequest) return
          clearRecordingTimers()
          releaseRecordingStream()
          recordingUploadContext = null
          setRecordingPhase('idle')
          setAudioError(
            error instanceof DOMException && error.name === 'NotAllowedError'
              ? 'Microphone access was denied. Allow it in the browser or choose an audio file.'
              : 'The microphone could not be opened. Choose an audio file or try again.',
          )
        }),
      )
  }

  const cancelExampleRecording = (updateUi: boolean): void => {
    recordingRequest += 1
    discardRecording = true
    recordingUploadContext = null
    clearRecordingTimers()
    const recorder = recordingRecorder
    recordingRecorder = null
    recordingChunks = []
    if (recorder !== null && recorder.state !== 'inactive') {
      recorder.ondataavailable = null
      recorder.onerror = null
      recorder.onstop = null
      recorder.stop()
    }
    releaseRecordingStream()
    if (updateUi) {
      setRecordingPhase('idle')
      setRecordingElapsedMs(0)
    }
  }

  createEffect(() => {
    const exerciseKey = `${props.value.id}:${props.value.version}`
    if (exerciseKey === pendingExerciseKey) return
    pendingExerciseKey = exerciseKey
    fileSelectionRequest += 1
    setPendingExampleAudioFile(null)
    setAudioError(null)
    cancelExampleRecording(true)
  })

  onCleanup(() => {
    disposed = true
    fileSelectionRequest += 1
    cancelExampleRecording(false)
    props.onInteractionBusyChange?.(false)
  })

  const removeExampleAudio = (): void => {
    const audio = props.value.exampleAudio
    if (audio === undefined || busy() || readOnly()) return
    const value = props.value
    const callback = props.onRemoveExampleAudio
    const onChange = props.onChange
    setPendingExampleAudioFile(null)
    setAudioError(null)
    if (callback === undefined) {
      onChange({ ...value, exampleAudio: undefined })
      return
    }
    setLocalAction('remove-audio')
    void callback(audio, value)
      .then(() => onChange({ ...value, exampleAudio: undefined }))
      .catch((error: unknown) => setAudioError(errorMessage(error)))
      .finally(() => setLocalAction(null))
  }

  const statusText = createMemo(
    () => actionLabel(localAction()) ?? STATUS_LABELS[props.status],
  )

  return (
    <section
      class={styles.root}
      data-testid="guided-exercise-editor"
      aria-label="Guided exercise editor"
    >
      <header class={styles.appBar}>
        <div class={styles.identity}>
          <div class={styles.identityMark} aria-hidden="true">
            <span />
          </div>
          <div>
            <p>Guided exercise studio</p>
            <h2>{props.value.title || 'Untitled exercise'}</h2>
          </div>
          <span class={styles.lifecycle} data-lifecycle={props.lifecycle}>
            {props.lifecycle}
          </span>
        </div>

        <div class={styles.viewSwitch} role="tablist" aria-label="Editor view">
          <button
            type="button"
            role="tab"
            aria-selected={view() === 'author'}
            classList={{ [styles.activeView]: view() === 'author' }}
            onClick={() => setView('author')}
          >
            Author
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view() === 'preview'}
            classList={{ [styles.activeView]: view() === 'preview' }}
            onClick={() => setView('preview')}
          >
            Preview
          </button>
        </div>

        <div class={styles.actions}>
          <span class={styles.status} aria-live="polite">
            {statusText()}
          </span>
          <Show when={props.lifecycle === 'draft'}>
            <button
              type="button"
              class={styles.secondaryAction}
              disabled={busy() || props.onSave === undefined}
              onClick={() => void runAction('save', props.onSave)}
            >
              Save draft
            </button>
            <button
              type="button"
              class={styles.primaryAction}
              disabled={
                busy() ||
                blockingIssues().length > 0 ||
                props.onPublish === undefined
              }
              title={
                blockingIssues().length > 0
                  ? 'Resolve validation errors before publishing'
                  : 'Publish this immutable exercise version'
              }
              onClick={() => void runAction('publish', props.onPublish)}
            >
              Publish
            </button>
          </Show>
          <Show when={props.lifecycle === 'published'}>
            <button
              type="button"
              class={styles.primaryAction}
              disabled={busy() || props.onDuplicate === undefined}
              onClick={() => void runAction('duplicate', props.onDuplicate)}
            >
              Create draft revision
            </button>
          </Show>
        </div>
      </header>

      <Show when={localError()}>
        <div class={styles.actionError} role="alert">
          <strong>Action failed</strong>
          <span>{localError()}</span>
          <button type="button" onClick={() => setLocalError(null)}>
            Dismiss
          </button>
        </div>
      </Show>

      <Show
        when={view() === 'author'}
        fallback={
          <div class={styles.previewView} role="tabpanel">
            <ExercisePreview value={props.value} />
          </div>
        }
      >
        <div class={styles.authorLayout} role="tabpanel">
          <main class={styles.authorMain}>
            <section
              class={styles.section}
              aria-labelledby={`${editorId}-identity-heading`}
            >
              <div class={styles.sectionHeading}>
                <div>
                  <p>Exercise definition</p>
                  <h3 id={`${editorId}-identity-heading`}>
                    Identity and coaching
                  </h3>
                </div>
                <span>Version {props.value.version}</span>
              </div>

              <div class={styles.formGrid}>
                <label class={styles.wideField}>
                  <span>Title</span>
                  <input
                    value={props.value.title}
                    disabled={readOnly()}
                    onInput={(event) =>
                      emit({ title: event.currentTarget.value })
                    }
                  />
                </label>
                <label>
                  <span>Stable ID</span>
                  <input
                    value={props.value.id}
                    disabled={readOnly() || props.identityLocked === true}
                    spellcheck={false}
                    onInput={(event) => emit({ id: event.currentTarget.value })}
                  />
                  <Show when={props.identityLocked === true}>
                    <small>The stable ID is locked after the first save.</small>
                  </Show>
                </label>
                <label>
                  <span>Category</span>
                  <select
                    value={props.value.category}
                    disabled={readOnly()}
                    onChange={(event) =>
                      emit({
                        category: event.currentTarget
                          .value as ZenExerciseCategory,
                      })
                    }
                  >
                    <For each={CATEGORY_OPTIONS}>
                      {(option) => (
                        <option value={option.value}>{option.label}</option>
                      )}
                    </For>
                  </select>
                </label>
                <label>
                  <span>Level</span>
                  <select
                    value={props.value.level}
                    disabled={readOnly()}
                    onChange={(event) =>
                      emit({
                        level: event.currentTarget.value as
                          | 'foundation'
                          | 'developing'
                          | 'advanced',
                      })
                    }
                  >
                    <For each={LEVEL_OPTIONS}>
                      {([value, label]) => (
                        <option value={value}>{label}</option>
                      )}
                    </For>
                  </select>
                </label>
                <label class={styles.wideField}>
                  <span>Catalogue summary</span>
                  <input
                    value={props.value.summary}
                    disabled={readOnly()}
                    onInput={(event) =>
                      emit({ summary: event.currentTarget.value })
                    }
                  />
                  <small>
                    One calm sentence shown before the full instructions.
                  </small>
                </label>
                <label class={styles.wideField}>
                  <span>Practice goal</span>
                  <textarea
                    rows="2"
                    value={props.value.goal}
                    disabled={readOnly()}
                    onInput={(event) =>
                      emit({ goal: event.currentTarget.value })
                    }
                  />
                </label>
                <label class={styles.wideField}>
                  <span>How to sing it</span>
                  <textarea
                    rows="4"
                    value={props.value.instructions}
                    disabled={readOnly()}
                    onInput={(event) =>
                      emit({ instructions: event.currentTarget.value })
                    }
                  />
                </label>
                <label class={styles.wideField}>
                  <span>Pronunciation guidance</span>
                  <textarea
                    rows="2"
                    value={props.value.pronunciationHint ?? ''}
                    disabled={readOnly()}
                    onInput={(event) =>
                      emit({
                        pronunciationHint:
                          event.currentTarget.value || undefined,
                      })
                    }
                  />
                </label>
                <label class={styles.wideField}>
                  <span>Safety note</span>
                  <textarea
                    rows="2"
                    value={props.value.safetyNote ?? ''}
                    disabled={readOnly()}
                    onInput={(event) =>
                      emit({
                        safetyNote: event.currentTarget.value || undefined,
                      })
                    }
                  />
                </label>
              </div>
            </section>

            <section
              class={styles.section}
              aria-labelledby={`${editorId}-timing-heading`}
            >
              <div class={styles.sectionHeading}>
                <div>
                  <p>Playback frame</p>
                  <h3 id={`${editorId}-timing-heading`}>
                    Timing and singer defaults
                  </h3>
                </div>
                <span>
                  Root {rootLabel()} · {props.value.loopBeats} beats
                </span>
              </div>
              <div class={styles.compactGrid}>
                <label>
                  <span>Tempo</span>
                  <div class={styles.unitInput}>
                    <input
                      type="number"
                      min="40"
                      max="240"
                      step="1"
                      value={props.value.bpm}
                      disabled={readOnly()}
                      onChange={(event) =>
                        emit({ bpm: Number(event.currentTarget.value) })
                      }
                    />
                    <small>BPM</small>
                  </div>
                </label>
                <label>
                  <span>Count-in</span>
                  <div class={styles.unitInput}>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={props.value.countInBeats}
                      disabled={readOnly()}
                      onChange={(event) =>
                        emit({
                          countInBeats: Number(event.currentTarget.value),
                        })
                      }
                    />
                    <small>beats</small>
                  </div>
                </label>
                <label>
                  <span>Loop length</span>
                  <div class={styles.unitInput}>
                    <input
                      type="number"
                      min="0.25"
                      step="0.25"
                      value={props.value.loopBeats}
                      disabled={readOnly()}
                      onChange={(event) =>
                        emit({
                          loopBeats: Number(event.currentTarget.value),
                        })
                      }
                    />
                    <small>beats</small>
                  </div>
                </label>
                <label>
                  <span>Default root</span>
                  <div class={styles.unitInput}>
                    <input
                      type="number"
                      min="24"
                      max="96"
                      step="1"
                      value={props.value.defaultRootMidi}
                      disabled={readOnly()}
                      onChange={(event) =>
                        emit({
                          defaultRootMidi: Number(event.currentTarget.value),
                        })
                      }
                    />
                    <small>{rootLabel()}</small>
                  </div>
                </label>
                <label>
                  <span>Target notes</span>
                  <select
                    value={props.value.defaultTargetVisibility}
                    disabled={readOnly()}
                    onChange={(event) =>
                      emit({
                        defaultTargetVisibility: event.currentTarget.value as
                          | 'off'
                          | 'dim'
                          | 'on',
                      })
                    }
                  >
                    <option value="on">Shown</option>
                    <option value="dim">Dimmed</option>
                    <option value="off">Hidden</option>
                  </select>
                </label>
                <label>
                  <span>Progress cue</span>
                  <select
                    value={props.value.defaultProgressCue}
                    disabled={readOnly()}
                    onChange={(event) =>
                      emit({
                        defaultProgressCue: event.currentTarget.value as
                          | 'none'
                          | 'playhead',
                      })
                    }
                  >
                    <option value="playhead">Playhead</option>
                    <option value="none">No playhead</option>
                  </select>
                </label>
              </div>
            </section>

            <section class={`${styles.section} ${styles.timelineSection}`}>
              <ExerciseTimelineEditor
                value={props.value}
                selectedTargetId={selectedTargetId()}
                onSelectedTargetIdChange={setSelectedTargetId}
                onChange={props.onChange}
                readOnly={readOnly()}
              />
            </section>

            <section
              class={styles.section}
              aria-labelledby={`${editorId}-scoring-heading`}
            >
              <div class={styles.sectionHeading}>
                <div>
                  <p>Measured feedback</p>
                  <h3 id={`${editorId}-scoring-heading`}>Scoring</h3>
                </div>
                <span>{scoreWeightTotal().toFixed(2)} total weight</span>
              </div>
              <div class={styles.scoringGrid}>
                <label>
                  <span>Pitch weight</span>
                  <input
                    type="number"
                    min="0"
                    step="0.05"
                    value={props.value.scoring.pitchWeight}
                    disabled={readOnly()}
                    onChange={(event) =>
                      emit({
                        scoring: {
                          ...props.value.scoring,
                          pitchWeight: Number(event.currentTarget.value),
                        },
                      })
                    }
                  />
                </label>
                <label>
                  <span>Coverage weight</span>
                  <input
                    type="number"
                    min="0"
                    step="0.05"
                    value={props.value.scoring.coverageWeight}
                    disabled={readOnly()}
                    onChange={(event) =>
                      emit({
                        scoring: {
                          ...props.value.scoring,
                          coverageWeight: Number(event.currentTarget.value),
                        },
                      })
                    }
                  />
                </label>
                <label>
                  <span>Steadiness weight</span>
                  <input
                    type="number"
                    min="0"
                    step="0.05"
                    value={props.value.scoring.steadinessWeight}
                    disabled={readOnly()}
                    onChange={(event) =>
                      emit({
                        scoring: {
                          ...props.value.scoring,
                          steadinessWeight: Number(event.currentTarget.value),
                        },
                      })
                    }
                  />
                </label>
                <label>
                  <span>Pitch tolerance</span>
                  <div class={styles.unitInput}>
                    <input
                      type="number"
                      min="1"
                      step="5"
                      value={props.value.scoring.toleranceCents}
                      disabled={readOnly()}
                      onChange={(event) =>
                        emit({
                          scoring: {
                            ...props.value.scoring,
                            toleranceCents: Number(event.currentTarget.value),
                          },
                        })
                      }
                    />
                    <small>cents</small>
                  </div>
                </label>
              </div>
              <p class={styles.scoringNote}>
                MercuryPitch scores pitch, sung coverage, and steadiness. Cue
                pronunciation is coaching content and is not scored.
              </p>
            </section>

            <section
              class={styles.section}
              aria-labelledby={`${editorId}-audio-heading`}
            >
              <div class={styles.sectionHeading}>
                <div>
                  <p>Pronunciation and tone</p>
                  <h3 id={`${editorId}-audio-heading`}>
                    Example audio (optional)
                  </h3>
                </div>
                <span>Optional at publication</span>
              </div>

              <p class={styles.audioPolicy}>
                <strong>You can publish without audio.</strong> When attached, a
                short coach or generated vocal recording teaches pronunciation
                and tone; it is lazy loaded only when the singer asks to hear
                it.
              </p>

              <Show
                when={props.value.exampleAudio}
                fallback={
                  <div class={styles.noAudio}>
                    <div>
                      <strong>No example audio attached</strong>
                      <span>
                        Leave this empty to publish without audio, or set up the
                        transcript and origin before choosing a file.
                      </span>
                    </div>
                    <button
                      type="button"
                      disabled={readOnly()}
                      onClick={addExampleAudioMetadata}
                    >
                      Set up example audio
                    </button>
                  </div>
                }
              >
                {(audio) => (
                  <div class={styles.audioEditor}>
                    <Show when={audio().src.trim() !== ''}>
                      <audio controls preload="none" src={audio().src} />
                    </Show>
                    <div class={styles.formGrid}>
                      <label class={styles.wideField}>
                        <span>Playback URL</span>
                        <input
                          value={audio().src}
                          disabled={readOnly()}
                          readOnly
                          spellcheck={false}
                        />
                        <small>
                          Filled automatically after the managed upload.
                        </small>
                      </label>
                      <label>
                        <span>Origin</span>
                        <select
                          value={audio().source}
                          disabled={readOnly()}
                          onChange={(event) =>
                            updateExampleAudio({
                              source: event.currentTarget.value as
                                | 'coach'
                                | 'generated'
                                | 'imported',
                            })
                          }
                        >
                          <option value="coach">Coach recording</option>
                          <option value="generated">Generated vocal</option>
                          <option value="imported">Imported</option>
                        </select>
                      </label>
                      <label>
                        <span>Duration</span>
                        <div class={styles.unitInput}>
                          <input
                            type="number"
                            min="1"
                            step="100"
                            value={audio().durationMs}
                            disabled={readOnly()}
                            onChange={(event) =>
                              updateExampleAudio({
                                durationMs: Number(event.currentTarget.value),
                              })
                            }
                          />
                          <small>ms</small>
                        </div>
                      </label>
                      <label>
                        <span>Locale</span>
                        <select value={audio().locale} disabled>
                          <option value="en-GB">English (UK)</option>
                        </select>
                      </label>
                      <label class={styles.wideField}>
                        <span>Transcript</span>
                        <input
                          ref={(element) => {
                            exampleTranscriptInput = element
                          }}
                          value={audio().transcript}
                          disabled={readOnly()}
                          onInput={(event) =>
                            updateExampleAudio({
                              transcript: event.currentTarget.value,
                            })
                          }
                          onChange={(event) => {
                            const pending = pendingExampleAudioFile()
                            if (
                              pending !== null &&
                              shouldAutoUploadPreparedExampleAudio(
                                pending.origin,
                                pending.durationMs,
                              )
                            ) {
                              uploadPendingExampleAudio(
                                event.currentTarget.value,
                              )
                            }
                          }}
                          onKeyDown={(event) => {
                            const pending = pendingExampleAudioFile()
                            if (
                              event.key === 'Enter' &&
                              pending !== null &&
                              shouldAutoUploadPreparedExampleAudio(
                                pending.origin,
                                pending.durationMs,
                              ) &&
                              event.currentTarget.value.trim() !== ''
                            ) {
                              event.preventDefault()
                              uploadPendingExampleAudio(
                                event.currentTarget.value,
                              )
                            }
                          }}
                        />
                        <small>
                          Enter the exact syllable or phrase heard in the
                          recording. Required only when audio is attached.
                        </small>
                      </label>
                    </div>
                    <div class={styles.audioUpload}>
                      <ExerciseRecordingControls
                        activeLimitMs={activeRecordingLimitMs}
                        available={directRecordingAvailable()}
                        customSeconds={customRecordingSeconds()}
                        durationChoice={recordingDurationChoice()}
                        elapsedMs={recordingElapsedMs()}
                        hasExistingAudio={audio().src.trim() !== ''}
                        phase={recordingPhase()}
                        readOnly={readOnly()}
                        selectedLimitMs={selectedRecordingLimitMs()}
                        transcriptReady={
                          audio().transcript.trim() !== '' &&
                          props.onExampleAudioFile !== undefined
                        }
                        onCancel={() => cancelExampleRecording(true)}
                        onCustomSecondsChange={setCustomRecordingSeconds}
                        onDurationChoiceChange={setRecordingDurationChoice}
                        onStart={startExampleRecording}
                        onStop={stopExampleRecording}
                      />
                      <div class={styles.audioFileChoice}>
                        <div
                          class={styles.audioDropZone}
                          data-dragging={audioDropActive() ? 'true' : undefined}
                          onDragEnter={(event) => {
                            if (!readOnly()) {
                              event.preventDefault()
                              setAudioDropActive(true)
                            }
                          }}
                          onDragOver={(event) => {
                            if (!readOnly()) {
                              event.preventDefault()
                              if (event.dataTransfer !== null) {
                                event.dataTransfer.dropEffect = 'copy'
                              }
                            }
                          }}
                          onDragLeave={() => setAudioDropActive(false)}
                          onDrop={(event) => {
                            event.preventDefault()
                            setAudioDropActive(false)
                            const file = event.dataTransfer?.files[0]
                            if (file !== undefined) {
                              selectExampleAudioFile(file)
                            }
                          }}
                        >
                          <label>
                            <span>
                              {audio().src.trim() === ''
                                ? pendingExampleAudioFile() === null
                                  ? 'Choose audio file'
                                  : 'Choose a different file'
                                : 'Replace from file'}
                            </span>
                            <input
                              type="file"
                              accept={GUIDED_EXAMPLE_ACCEPT}
                              disabled={
                                readOnly() ||
                                props.onExampleAudioFile === undefined
                              }
                              onChange={(event) => {
                                const file = event.currentTarget.files?.[0]
                                if (file !== undefined) {
                                  selectExampleAudioFile(file)
                                }
                                event.currentTarget.value = ''
                              }}
                            />
                          </label>
                          <span>or drop audio anywhere in this box</span>
                        </div>
                        <div
                          class={styles.pendingAudioFile}
                          hidden={pendingExampleAudioFile() === null}
                          aria-live="polite"
                        >
                          <div class={styles.pendingAudioIdentity}>
                            <strong
                              title={pendingExampleAudioFile()?.file.name ?? ''}
                            >
                              {pendingExampleAudioFile()?.file.name ?? ''}
                            </strong>
                            <span>
                              {audioDurationLabel(
                                pendingExampleAudioFile()?.durationMs ?? 0,
                              )}
                            </span>
                          </div>
                          <Show
                            when={
                              (pendingExampleAudioFile()?.durationMs ?? 0) >
                              GUIDED_EXAMPLE_CLIP_MS
                            }
                          >
                            <label class={styles.clipStart}>
                              <span>
                                Clip start:{' '}
                                {(
                                  (pendingExampleAudioFile()?.clipStartMs ??
                                    0) / 1000
                                ).toFixed(1)}{' '}
                                s
                              </span>
                              <input
                                type="range"
                                min="0"
                                max={Math.max(
                                  0,
                                  (pendingExampleAudioFile()?.durationMs ??
                                    GUIDED_EXAMPLE_CLIP_MS) -
                                    GUIDED_EXAMPLE_CLIP_MS,
                                )}
                                step="100"
                                value={
                                  pendingExampleAudioFile()?.clipStartMs ?? 0
                                }
                                disabled={readOnly()}
                                onInput={(event) => {
                                  const pending = pendingExampleAudioFile()
                                  if (pending === null) return
                                  setPendingExampleAudioFile({
                                    ...pending,
                                    clipStartMs: Number(
                                      event.currentTarget.value,
                                    ),
                                  })
                                }}
                              />
                            </label>
                          </Show>
                          <div class={styles.pendingAudioActions}>
                            <button
                              type="button"
                              disabled={
                                readOnly() || audio().transcript.trim() === ''
                              }
                              onClick={() =>
                                uploadPendingExampleAudio(audio().transcript)
                              }
                            >
                              {(pendingExampleAudioFile()?.durationMs ?? 0) >
                              GUIDED_EXAMPLE_CLIP_MS
                                ? 'Use selected 5-second clip'
                                : pendingExampleAudioFile()?.origin ===
                                    'recording'
                                  ? 'Use recording'
                                  : 'Upload file'}
                            </button>
                            <button
                              type="button"
                              disabled={readOnly()}
                              onClick={() => {
                                fileSelectionRequest += 1
                                setPendingExampleAudioFile(null)
                              }}
                            >
                              Clear
                            </button>
                          </div>
                          <small>
                            {audio().transcript.trim() === ''
                              ? 'The file is ready. Add its exact transcript above to enable upload.'
                              : (pendingExampleAudioFile()?.durationMs ?? 0) >
                                  GUIDED_EXAMPLE_CLIP_MS
                                ? 'Choose where the five-second pronunciation example starts, then use the selected clip.'
                                : pendingExampleAudioFile()?.origin ===
                                    'recording'
                                  ? 'Review the captured duration, then use the recording or discard it and try again.'
                                  : 'The file is ready to upload as a normalized mono clip.'}
                          </small>
                        </div>
                        <p>
                          {GUIDED_EXAMPLE_FORMATS}. Files are converted to a
                          five-second mono WAV; longer songs get a clip-start
                          control. The stored clip stays below 2 MiB, uploads to
                          managed media, and fills the playback URL
                          automatically.
                        </p>
                      </div>
                    </div>
                    <Show when={audioError()}>
                      <div class={styles.audioError} role="alert">
                        <div>
                          <strong>Audio action failed</strong>
                          <span>{audioError()}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setAudioError(null)}
                        >
                          Dismiss
                        </button>
                      </div>
                    </Show>
                    <button
                      type="button"
                      class={styles.removeAudio}
                      disabled={readOnly() || busy()}
                      onClick={() => void removeExampleAudio()}
                    >
                      {audio().src.trim() === ''
                        ? 'Remove audio setup'
                        : 'Remove example audio'}
                    </button>
                  </div>
                )}
              </Show>
            </section>
          </main>

          <aside
            class={styles.validationRail}
            aria-labelledby={`${editorId}-validation-heading`}
          >
            <div class={styles.validationHeading}>
              <div>
                <p>Publish check</p>
                <h3 id={`${editorId}-validation-heading`}>Validation</h3>
              </div>
              <span
                classList={{
                  [styles.validationReady]: blockingIssues().length === 0,
                }}
              >
                {blockingIssues().length === 0
                  ? 'Ready'
                  : `${blockingIssues().length} to resolve`}
              </span>
            </div>
            <Show
              when={props.validationIssues.length > 0}
              fallback={
                <p class={styles.validationEmpty}>
                  The current definition passes every supplied publishing check.
                </p>
              }
            >
              <ul class={styles.issueList}>
                <For each={props.validationIssues}>
                  {(issue) => (
                    <li data-severity={issue.severity ?? 'error'}>
                      <span>{issue.path}</span>
                      <p>{issue.message}</p>
                    </li>
                  )}
                </For>
              </ul>
            </Show>

            <div class={styles.railFacts}>
              <div>
                <span>Targets</span>
                <strong>{props.value.targets.length}</strong>
              </div>
              <div>
                <span>Loop</span>
                <strong>{props.value.loopBeats} beats</strong>
              </div>
              <div>
                <span>Audio</span>
                <strong>
                  {props.value.exampleAudio === undefined
                    ? 'Optional · none'
                    : props.value.exampleAudio.src.trim() === ''
                      ? 'Setup incomplete'
                      : 'Attached'}
                </strong>
              </div>
            </div>

            <div class={styles.lifecycleActions}>
              <Show when={props.lifecycle !== 'archived'}>
                <button
                  type="button"
                  disabled={busy() || props.onArchive === undefined}
                  onClick={() => void runAction('archive', props.onArchive)}
                >
                  Archive exercise
                </button>
              </Show>
              <Show
                when={
                  props.lifecycle === 'archived' &&
                  props.onRestore !== undefined
                }
              >
                <button
                  type="button"
                  disabled={busy() || props.onRestore === undefined}
                  onClick={() => void runAction('restore', props.onRestore)}
                >
                  Restore exercise
                </button>
              </Show>
              <Show
                when={
                  props.lifecycle === 'draft' && props.onDuplicate !== undefined
                }
              >
                <button
                  type="button"
                  disabled={busy() || props.onDuplicate === undefined}
                  onClick={() => void runAction('duplicate', props.onDuplicate)}
                >
                  Duplicate draft
                </button>
              </Show>
            </div>
          </aside>
        </div>
      </Show>
    </section>
  )
}
