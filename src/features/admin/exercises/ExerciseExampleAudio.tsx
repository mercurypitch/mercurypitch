// ============================================================
// Exercise example audio — record, review, replay, and trim coach cues
// ============================================================
//
// Recording stays provisional until an author has listened to the take and
// selected the exact region to upload. The live and review waveforms make the
// audio state visible without turning the admin studio into a media editor.

import type { Component } from 'solid-js'
import { createEffect, createSignal, For, onCleanup, Show } from 'solid-js'
import { CheckSmall, Mic, Pause, Play, RotateCcw } from '@/components/icons'
import { normalizeGuidedExerciseAudioSelection } from '@/features/zen/guided-exercise-audio'
import { syncCanvasBacking } from '@/lib/canvas-size-sync'
import styles from './ExerciseExampleAudio.module.css'

export type ExerciseRecordingPhase =
  | 'idle'
  | 'acquiring'
  | 'recording'
  | 'preparing'

export type ExerciseRecordingDurationChoice = 5 | 10 | 'custom'

export interface PendingExerciseExampleAudio {
  file: File
  buffer: AudioBuffer
  durationMs: number
  clipStartMs: number
  clipEndMs: number
  origin: 'file' | 'recording'
}

const RECORDING_DURATION_TEMPLATES = [5, 10] as const
export const MAX_EXAMPLE_RECORDING_SECONDS = 15

export function getExerciseRecordingLimitMs(
  choice: ExerciseRecordingDurationChoice,
  customSeconds = MAX_EXAMPLE_RECORDING_SECONDS,
): number {
  const seconds = choice === 'custom' ? customSeconds : choice
  return Math.round(
    Math.min(
      MAX_EXAMPLE_RECORDING_SECONDS,
      Math.max(1, Number.isFinite(seconds) ? seconds : 5),
    ) * 1000,
  )
}

const secondsLabel = (durationMs: number): string =>
  (durationMs / 1000).toFixed(durationMs % 1000 === 0 ? 0 : 1)

const clockLabel = (durationMs: number): string => {
  const tenths = Math.max(0, Math.round(durationMs / 100))
  const minutes = Math.floor(tenths / 600)
  const seconds = Math.floor((tenths % 600) / 10)
  const decimal = tenths % 10
  return `${minutes}:${seconds.toString().padStart(2, '0')}.${decimal}`
}

const recordingTimeLabel = (durationMs: number, limitMs: number): string =>
  `${(durationMs / 1000).toFixed(1)} / ${(limitMs / 1000).toFixed(1)} s`

interface LiveRecordingWaveformProps {
  active: boolean
  stream: MediaStream | null
}

const LiveRecordingWaveform: Component<LiveRecordingWaveformProps> = (
  props,
) => {
  let canvasRef: HTMLCanvasElement | undefined

  createEffect(() => {
    const active = props.active
    const stream = props.stream
    const canvas = canvasRef
    if (!active || stream === null || canvas === undefined) return
    if (typeof window.CanvasRenderingContext2D === 'undefined') return

    const AudioContextClass =
      window.AudioContext ??
      (window as Window & { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext
    if (AudioContextClass === undefined) return

    const audioContext = new AudioContextClass()
    const analyser = audioContext.createAnalyser()
    analyser.fftSize = 512
    analyser.smoothingTimeConstant = 0.72
    const source = audioContext.createMediaStreamSource(stream)
    source.connect(analyser)
    const samples = new Uint8Array(analyser.frequencyBinCount)
    let animationFrame = 0

    const draw = (): void => {
      syncCanvasBacking(canvas, window.devicePixelRatio || 1)
      const context = canvas.getContext('2d')
      if (context !== null) {
        const dpr = window.devicePixelRatio || 1
        const width = canvas.width / dpr
        const height = canvas.height / dpr
        context.setTransform(dpr, 0, 0, dpr, 0, 0)
        context.clearRect(0, 0, width, height)
        analyser.getByteTimeDomainData(samples)

        const gradient = context.createLinearGradient(0, 0, width, 0)
        gradient.addColorStop(0, '#f59e0b')
        gradient.addColorStop(1, '#ff8068')
        context.strokeStyle = gradient
        context.lineWidth = 2
        context.lineJoin = 'round'
        context.beginPath()
        for (let index = 0; index < samples.length; index += 1) {
          const x = (index / (samples.length - 1)) * width
          const y = (samples[index] / 255) * height
          if (index === 0) context.moveTo(x, y)
          else context.lineTo(x, y)
        }
        context.stroke()
      }
      animationFrame = window.requestAnimationFrame(draw)
    }

    const observer =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(() => {
            syncCanvasBacking(canvas, window.devicePixelRatio || 1)
          })
    observer?.observe(canvas)
    void audioContext.resume().catch(() => undefined)
    draw()

    onCleanup(() => {
      window.cancelAnimationFrame(animationFrame)
      observer?.disconnect()
      source.disconnect()
      analyser.disconnect()
      void audioContext.close().catch(() => undefined)
    })
  })

  return <canvas ref={canvasRef} aria-hidden="true" />
}

export interface ExerciseRecordingControlsProps {
  activeLimitMs: number
  available: boolean
  customSeconds: number
  durationChoice: ExerciseRecordingDurationChoice
  elapsedMs: number
  hasExistingAudio: boolean
  hasReviewTake: boolean
  phase: ExerciseRecordingPhase
  readOnly: boolean
  selectedLimitMs: number
  stream: MediaStream | null
  transcriptReady: boolean
  onCancel: () => void
  onCustomSecondsChange: (seconds: number) => void
  onDurationChoiceChange: (choice: ExerciseRecordingDurationChoice) => void
  onStart: () => void
  onStop: () => void
}

export const ExerciseRecordingControls: Component<
  ExerciseRecordingControlsProps
> = (props) => {
  const displayedLimitMs = (): number =>
    props.phase === 'idle' ? props.selectedLimitMs : props.activeLimitMs
  const isRecording = (): boolean => props.phase === 'recording'
  const recordLabel = (): string => {
    if (props.hasReviewTake) return 'Record another take'
    if (props.hasExistingAudio) {
      return `Record ${secondsLabel(props.selectedLimitMs)}-second replacement`
    }
    return `Record ${secondsLabel(props.selectedLimitMs)}-second example`
  }

  return (
    <section
      class={styles.recorder}
      data-phase={props.phase}
      aria-label="Record example audio"
    >
      <div class={styles.recorderHeader} aria-live="polite">
        <span class={styles.recordingBeacon} aria-hidden="true" />
        <div>
          <strong>
            {props.phase === 'acquiring'
              ? 'Opening microphone'
              : isRecording()
                ? 'Recording live'
                : props.phase === 'preparing'
                  ? 'Preparing your take'
                  : 'New microphone take'}
          </strong>
          <small>
            {isRecording()
              ? 'Speak or sing the complete example.'
              : 'Capture first. Upload only after review.'}
          </small>
        </div>
        <output>
          {recordingTimeLabel(props.elapsedMs, displayedLimitMs())}
        </output>
      </div>

      <div class={styles.durationControls}>
        <span>Maximum take length</span>
        <div
          class={styles.durationTemplates}
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
          <label class={styles.customDuration}>
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
            <small>1–15 sec</small>
          </label>
        </Show>
      </div>

      <div class={styles.liveWaveform} data-active={isRecording()}>
        <LiveRecordingWaveform active={isRecording()} stream={props.stream} />
        <Show when={!isRecording()}>
          <span>Waveform appears while recording</span>
        </Show>
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
              transform: `scaleX(${Math.min(
                1,
                props.elapsedMs / displayedLimitMs(),
              )})`,
            }}
          />
        </div>
      </div>

      <div class={styles.recorderActions}>
        <button
          type="button"
          classList={{
            [styles.recordButton]: !isRecording(),
            [styles.stopButton]: isRecording(),
          }}
          disabled={
            props.phase === 'preparing' ||
            (props.phase !== 'recording' &&
              props.phase !== 'acquiring' &&
              (props.readOnly || !props.transcriptReady))
          }
          onClick={() => {
            if (isRecording()) props.onStop()
            else if (props.phase === 'acquiring') props.onCancel()
            else props.onStart()
          }}
        >
          <Show when={props.phase === 'idle'}>
            <Mic />
          </Show>
          <Show when={isRecording()}>
            <span class={styles.stopMark} aria-hidden="true" />
          </Show>
          {isRecording()
            ? 'Stop and review'
            : props.phase === 'acquiring'
              ? 'Cancel microphone request'
              : recordLabel()}
        </button>
        <small>
          {!props.available
            ? 'Direct recording is not supported in this browser.'
            : !props.transcriptReady
              ? 'Enter the transcript above before recording.'
              : `Stops automatically at ${secondsLabel(
                  displayedLimitMs(),
                )} seconds. Replay, trim, or record again before upload.`}
        </small>
      </div>
    </section>
  )
}

const peakCache = new WeakMap<AudioBuffer, readonly number[]>()

function waveformPeaks(buffer: AudioBuffer): readonly number[] {
  const cached = peakCache.get(buffer)
  if (cached !== undefined) return cached

  const bucketCount = 96
  const peaks = new Array<number>(bucketCount).fill(0)
  for (let bucket = 0; bucket < bucketCount; bucket += 1) {
    const start = Math.floor((bucket / bucketCount) * buffer.length)
    const end = Math.max(
      start + 1,
      Math.floor(((bucket + 1) / bucketCount) * buffer.length),
    )
    let peak = 0
    for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
      const samples = buffer.getChannelData(channel)
      for (let index = start; index < end; index += 1) {
        peak = Math.max(peak, Math.abs(samples[index] ?? 0))
      }
    }
    peaks[bucket] = peak
  }
  const maximum = Math.max(0.08, ...peaks)
  const normalized = peaks.map((peak) => Math.max(0.08, peak / maximum))
  peakCache.set(buffer, normalized)
  return normalized
}

export interface ExerciseAudioReviewProps {
  disabled: boolean
  pending: PendingExerciseExampleAudio
  transcriptReady: boolean
  onDiscard: () => void
  onRecordAgain?: () => void
  onSelectionChange: (startMs: number, endMs: number) => void
  onUse: () => void
}

export const ExerciseAudioReview: Component<ExerciseAudioReviewProps> = (
  props,
) => {
  const [previewUrl, setPreviewUrl] = createSignal('')
  const [playing, setPlaying] = createSignal(false)
  const [previewElapsedMs, setPreviewElapsedMs] = createSignal(0)
  const [previewError, setPreviewError] = createSignal<string | null>(null)
  let audioRef: HTMLAudioElement | undefined
  let currentFile: File | null = null
  let currentUrl = ''

  const stopPreview = (reset = false): void => {
    const audio = audioRef
    audio?.pause()
    setPlaying(false)
    if (reset && audio !== undefined) {
      const startMs = props.pending.clipStartMs
      audio.currentTime = startMs / 1000
      setPreviewElapsedMs(startMs)
    }
  }

  createEffect(() => {
    const file = props.pending.file
    if (file === currentFile) return
    if (currentUrl !== '' && typeof URL.revokeObjectURL === 'function') {
      URL.revokeObjectURL(currentUrl)
    }
    currentFile = file
    if (typeof URL.createObjectURL !== 'function') {
      currentUrl = ''
      setPreviewUrl('')
      return
    }
    currentUrl = URL.createObjectURL(file)
    setPreviewUrl(currentUrl)
    setPreviewElapsedMs(props.pending.clipStartMs)
    setPreviewError(null)
  })

  onCleanup(() => {
    stopPreview()
    if (currentUrl !== '' && typeof URL.revokeObjectURL === 'function') {
      URL.revokeObjectURL(currentUrl)
    }
  })

  const previewSelection = (): void => {
    const audio = audioRef
    if (audio === undefined || previewUrl() === '') return
    if (playing()) {
      stopPreview()
      return
    }
    const startMs = props.pending.clipStartMs
    const endMs = props.pending.clipEndMs
    if (
      audio.currentTime * 1000 < startMs ||
      audio.currentTime * 1000 >= endMs
    ) {
      audio.currentTime = startMs / 1000
      setPreviewElapsedMs(startMs)
    }
    setPreviewError(null)
    void audio
      .play()
      .then(() => setPlaying(true))
      .catch(() => {
        setPlaying(false)
        setPreviewError('This take could not be replayed in the browser.')
      })
  }

  const updateSelection = (
    handle: 'start' | 'end',
    requestedMs: number,
  ): void => {
    stopPreview(true)
    const selection = normalizeGuidedExerciseAudioSelection(
      props.pending.durationMs,
      handle === 'start' ? requestedMs : props.pending.clipStartMs,
      handle === 'end' ? requestedMs : props.pending.clipEndMs,
      handle,
    )
    props.onSelectionChange(selection.startMs, selection.endMs)
    setPreviewElapsedMs(selection.startMs)
  }

  const selectionDurationMs = (): number =>
    props.pending.clipEndMs - props.pending.clipStartMs
  const startPercent = (): number =>
    (props.pending.clipStartMs / props.pending.durationMs) * 100
  const endPercent = (): number =>
    (props.pending.clipEndMs / props.pending.durationMs) * 100
  const handleMidpointPercent = (): number =>
    (startPercent() + endPercent()) / 2
  const playheadPercent = (): number =>
    (previewElapsedMs() / props.pending.durationMs) * 100

  return (
    <section class={styles.review} aria-label="Review example audio">
      <div class={styles.reviewHeader}>
        <div>
          <span>
            {props.pending.origin === 'recording'
              ? 'Microphone take'
              : 'Uploaded audio'}
          </span>
          <strong title={props.pending.file.name}>
            {props.pending.file.name}
          </strong>
        </div>
        <output aria-live="polite">
          {clockLabel(props.pending.clipStartMs)} –{' '}
          {clockLabel(props.pending.clipEndMs)}
          <strong>{secondsLabel(selectionDurationMs())} sec selected</strong>
        </output>
      </div>

      <div class={styles.trimTimeline}>
        <div class={styles.waveformBars} aria-hidden="true">
          <For each={waveformPeaks(props.pending.buffer)}>
            {(peak) => <span style={{ height: `${peak * 100}%` }} />}
          </For>
        </div>
        <div
          class={styles.trimSelection}
          style={{
            left: `${startPercent()}%`,
            width: `${endPercent() - startPercent()}%`,
          }}
          aria-hidden="true"
        />
        <div
          class={styles.trimShade}
          style={{ width: `${startPercent()}%` }}
          aria-hidden="true"
        />
        <div
          class={styles.trimShade}
          style={{ left: `${endPercent()}%`, right: '0' }}
          aria-hidden="true"
        />
        <Show when={playing()}>
          <span
            class={styles.previewPlayhead}
            style={{ left: `${playheadPercent()}%` }}
            aria-hidden="true"
          />
        </Show>
        <input
          class={styles.startHandle}
          type="range"
          aria-label="Clip start"
          min="0"
          max={props.pending.durationMs}
          step="100"
          value={props.pending.clipStartMs}
          disabled={props.disabled}
          style={{
            'clip-path': `inset(0 ${100 - handleMidpointPercent()}% 0 0)`,
          }}
          onInput={(event) => {
            const requestedMs = Number(event.currentTarget.value)
            updateSelection('start', requestedMs)
          }}
        />
        <input
          class={styles.endHandle}
          type="range"
          aria-label="Clip end"
          min="0"
          max={props.pending.durationMs}
          step="100"
          value={props.pending.clipEndMs}
          disabled={props.disabled}
          style={{
            'clip-path': `inset(0 0 0 ${handleMidpointPercent()}%)`,
          }}
          onInput={(event) => {
            const requestedMs = Number(event.currentTarget.value)
            updateSelection('end', requestedMs)
          }}
        />
      </div>

      <div class={styles.trimLabels} aria-hidden="true">
        <span>Start {clockLabel(props.pending.clipStartMs)}</span>
        <span>Maximum clip 15 sec</span>
        <span>End {clockLabel(props.pending.clipEndMs)}</span>
      </div>

      <audio
        ref={audioRef}
        src={previewUrl()}
        preload="auto"
        onTimeUpdate={(event) => {
          const elapsedMs = event.currentTarget.currentTime * 1000
          if (elapsedMs >= props.pending.clipEndMs) {
            stopPreview(true)
          } else {
            setPreviewElapsedMs(elapsedMs)
          }
        }}
        onEnded={() => stopPreview(true)}
      />

      <Show when={previewError()}>
        <p class={styles.previewError} role="alert">
          {previewError()}
        </p>
      </Show>

      <div class={styles.reviewFooter}>
        <div class={styles.reviewSecondaryActions}>
          <button
            type="button"
            disabled={props.disabled}
            onClick={previewSelection}
          >
            {playing() ? <Pause /> : <Play />}
            {playing() ? 'Pause preview' : 'Preview selected clip'}
          </button>
          <Show when={props.onRecordAgain !== undefined}>
            <button
              type="button"
              disabled={props.disabled}
              onClick={() => props.onRecordAgain?.()}
            >
              <RotateCcw />
              Record again
            </button>
          </Show>
          <button
            type="button"
            disabled={props.disabled}
            onClick={() => props.onDiscard()}
          >
            Discard
          </button>
        </div>
        <button
          type="button"
          class={styles.useClipButton}
          disabled={props.disabled || !props.transcriptReady}
          onClick={() => props.onUse()}
        >
          <CheckSmall size={16} />
          Use {secondsLabel(selectionDurationMs())}-second clip
        </button>
      </div>
      <small class={styles.reviewHint}>
        {props.transcriptReady
          ? 'Listen, move both handles around the exact phrase, then finalize the upload.'
          : 'Add the exact transcript above before finalizing this clip.'}
      </small>
    </section>
  )
}
