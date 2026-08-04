// ============================================================
// Freeform Voice Recorder — explicit dry capture inside Hear Yourself
// ============================================================

import type { Component } from 'solid-js'
import { createSignal, onCleanup, onMount, Show, untrack } from 'solid-js'
import { IconCross, IconMic } from '@/components/exercise-icons'
import { VoiceTakeWaveform } from '@/components/VoiceTakeWaveform'
import { trackEvent } from '@/lib/analytics'
import { createMediaProgressLoop, isMediaPlaybackActive, } from '@/lib/media-progress-loop'
import { micManager } from '@/lib/mic-manager'
import { registerMicIndicator } from '@/lib/mic-sentinel'
import type { F0Stream } from '@/lib/pitch-f0-stream'
import type { PitchFrame } from '@/lib/pitch-f0-stream'
import { createF0Stream } from '@/lib/pitch-f0-stream'
import type { TakeRecorder } from '@/lib/voice-capture'
import { createTakeRecorder, inspectVoiceTake } from '@/lib/voice-capture'
import { encodeVoiceAtlasContour } from '@/lib/voice-contour'
import type { FreeformThreadTarget, FreeformVoiceTakeCapture, } from './freeform-voice-take'
import { keepFreeformVoiceTake } from './freeform-voice-take'
import styles from './FreeformVoiceRecorder.module.css'
import { LiveVoiceCapture } from './LiveVoiceCapture'

type RecorderState =
  | 'idle'
  | 'starting'
  | 'recording'
  | 'processing'
  | 'ready'
  | 'saving'
  | 'saved'
  | 'unsupported'

interface FreeformVoiceRecorderProps {
  target: FreeformThreadTarget
  onClose: () => void
  onKept: (comparisonKey: string) => Promise<void> | void
  onStartNewThread: () => void
}

const MIC_CONSUMER_PREFIX = 'voice-history-freeform'
let recorderInstance = 0
const MAX_CAPTURE_MS = 5 * 60 * 1000

function formatElapsed(durationMs: number): string {
  if (durationMs > 0 && durationMs < 1000) return '<1s'
  const seconds = Math.max(0, Math.floor(durationMs / 1000))
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

function createCaptureAudioContext(): AudioContext | null {
  const WindowAudioContext =
    window.AudioContext ??
    (
      window as typeof window & {
        webkitAudioContext?: typeof AudioContext
      }
    ).webkitAudioContext
  if (WindowAudioContext === undefined) return null
  try {
    return new WindowAudioContext()
  } catch {
    return null
  }
}

/** Stop one contour stream, preserving its raw frames before graph teardown. */
export function drainPitchStream(stream: F0Stream | null): PitchFrame[] {
  if (stream === null) return []
  const frames = stream.takeFrames()
  stream.dispose()
  return frames
}

export const FreeformVoiceRecorder: Component<FreeformVoiceRecorderProps> = (
  props,
) => {
  const micConsumerId = `${MIC_CONSUMER_PREFIX}:${++recorderInstance}`
  const [title, setTitle] = createSignal(untrack(() => props.target.title))
  const [state, setState] = createSignal<RecorderState>('idle')
  const [capture, setCapture] = createSignal<FreeformVoiceTakeCapture | null>(
    null,
  )
  const [elapsedMs, setElapsedMs] = createSignal(0)
  const [previewUrl, setPreviewUrl] = createSignal<string | null>(null)
  const [previewPlaying, setPreviewPlaying] = createSignal(false)
  const [previewProgress, setPreviewProgress] = createSignal(0)
  const [message, setMessage] = createSignal<string | null>(null)
  const [titleError, setTitleError] = createSignal<string | null>(null)
  const previewProgressLoop = createMediaProgressLoop(setPreviewProgress)

  let recorder: TakeRecorder | null = null
  let pitchStream: F0Stream | null = null
  let captureContext: AudioContext | null = null
  let previewAudio: HTMLAudioElement | null = null
  let timer: ReturnType<typeof setInterval> | null = null
  let capTimer: ReturnType<typeof setTimeout> | null = null
  let startedAt = 0
  let capturedAt = ''
  let activeRun = 0
  let titleInput: HTMLInputElement | undefined
  let startButton: HTMLButtonElement | undefined

  const persistenceLocked = (): boolean =>
    state() === 'saving' || state() === 'saved'

  function clearTimers(): void {
    if (timer !== null) clearInterval(timer)
    if (capTimer !== null) clearTimeout(capTimer)
    timer = null
    capTimer = null
  }

  function releaseMic(): void {
    micManager.release(micConsumerId)
  }

  function closeCaptureContext(): void {
    const current = captureContext
    captureContext = null
    if (current !== null && current.state !== 'closed') {
      void current.close().catch(() => undefined)
    }
  }

  function disposePitchStream(): PitchFrame[] {
    const current = pitchStream
    pitchStream = null
    return drainPitchStream(current)
  }

  function clearPreview(): void {
    previewProgressLoop.stop()
    previewAudio?.pause()
    previewAudio = null
    const url = previewUrl()
    if (url !== null) URL.revokeObjectURL(url)
    setPreviewUrl(null)
    setPreviewPlaying(false)
    setPreviewProgress(0)
  }

  function resetTemporary(): void {
    activeRun += 1
    clearTimers()
    recorder?.discard()
    recorder?.dispose()
    recorder = null
    disposePitchStream()
    releaseMic()
    closeCaptureContext()
    clearPreview()
    setCapture(null)
    setElapsedMs(0)
    setMessage(null)
    setState('idle')
  }

  function handleMicLoss(): void {
    resetTemporary()
    setMessage(
      'The microphone stopped before the take was ready. Check the input and record again.',
    )
  }

  let unregisterMicIndicator = (): void => undefined

  onMount(() => {
    const shouldFocusTitle = untrack(() => props.target.title === '')
    unregisterMicIndicator = registerMicIndicator(
      micConsumerId,
      // Deliberately non-reactive: the sentinel polls this accessor on its
      // own watchdog interval instead of subscribing inside Solid's graph.
      // eslint-disable-next-line solid/reactivity
      () => state() === 'recording',
      handleMicLoss,
    )
    queueMicrotask(() => {
      if (shouldFocusTitle) titleInput?.focus()
      else startButton?.focus()
    })
  })

  onCleanup(() => {
    activeRun += 1
    clearTimers()
    recorder?.discard()
    recorder?.dispose()
    recorder = null
    disposePitchStream()
    releaseMic()
    closeCaptureContext()
    clearPreview()
    unregisterMicIndicator()
  })

  function beginRecording(): void {
    const threadTitle = title().trim()
    if (threadTitle === '') {
      setTitleError('Name the phrase, passage, or idea you want to revisit.')
      return
    }

    resetTemporary()
    setTitle(threadTitle)
    setTitleError(null)
    setMessage(null)
    setState('starting')
    const run = ++activeRun
    const context = createCaptureAudioContext()
    captureContext = context
    void beginRecordingAsync(context, run)
  }

  async function beginRecordingAsync(
    context: AudioContext | null,
    run: number,
  ): Promise<void> {
    try {
      if (context?.state === 'suspended') await context.resume()
      const stream = await micManager.acquire(micConsumerId)
      if (run !== activeRun) {
        releaseMic()
        return
      }

      const nextRecorder = createTakeRecorder(stream)
      if (nextRecorder === null) {
        releaseMic()
        closeCaptureContext()
        setState('unsupported')
        return
      }

      recorder = nextRecorder
      if (context !== null) {
        try {
          pitchStream = createF0Stream(context, stream)
          pitchStream.startTask()
        } catch {
          pitchStream = null
        }
      }
      startedAt = Date.now()
      capturedAt = new Date(startedAt).toISOString()
      nextRecorder.start()
      setElapsedMs(0)
      setState('recording')
      timer = setInterval(() => setElapsedMs(Date.now() - startedAt), 250)
      capTimer = setTimeout(() => stopRecording(), MAX_CAPTURE_MS)
    } catch (error) {
      if (run !== activeRun) return
      recorder?.discard()
      recorder?.dispose()
      recorder = null
      disposePitchStream()
      releaseMic()
      closeCaptureContext()
      setState('idle')
      setMessage(
        typeof (error as { message?: unknown }).message === 'string'
          ? (error as { message: string }).message
          : 'The microphone could not open. Check browser permission and try again.',
      )
    }
  }

  function stopRecording(): void {
    if (state() !== 'recording' || recorder === null) return
    const currentRecorder = recorder
    const context = captureContext
    const run = activeRun
    const fallbackDurationMs = Math.max(0, Date.now() - startedAt)
    recorder = null
    const contourFrames = disposePitchStream()
    clearTimers()
    setElapsedMs(fallbackDurationMs)
    setState('processing')
    releaseMic()
    void finishRecording(
      currentRecorder,
      context,
      run,
      fallbackDurationMs,
      contourFrames,
    )
  }

  async function finishRecording(
    currentRecorder: TakeRecorder,
    context: AudioContext | null,
    run: number,
    fallbackDurationMs: number,
    contourFrames: readonly PitchFrame[],
  ): Promise<void> {
    const blob = await currentRecorder.stop()
    currentRecorder.dispose()
    if (blob === null) {
      if (run !== activeRun) return
      closeCaptureContext()
      setState('idle')
      setMessage(
        'No audio was captured. Check the selected input and record again.',
      )
      return
    }

    const inspection = await inspectVoiceTake(blob, context, fallbackDurationMs)
    if (run !== activeRun) return
    closeCaptureContext()
    if (blob.size === 0 || inspection.durationMs <= 0) {
      setElapsedMs(0)
      setState('idle')
      setMessage(
        'No audio was captured. Check the selected input and record again.',
      )
      return
    }
    const nextCapture: FreeformVoiceTakeCapture = {
      blob,
      durationMs: inspection.durationMs,
      peaks: inspection.peaks,
      capturedAt,
      contour: encodeVoiceAtlasContour(contourFrames, {
        source: 'f0-stream-yin-v1',
      }),
    }
    setCapture(nextCapture)
    setPreviewUrl(URL.createObjectURL(blob))
    setElapsedMs(inspection.durationMs)
    setState('ready')
  }

  function togglePreview(): void {
    const url = previewUrl()
    if (url === null) return
    if (previewAudio !== null) {
      const currentAudio = previewAudio
      if (currentAudio.paused) {
        void currentAudio
          .play()
          .then(() => {
            if (
              previewAudio !== currentAudio ||
              !isMediaPlaybackActive(currentAudio)
            )
              return
            setPreviewPlaying(true)
            previewProgressLoop.start(currentAudio)
          })
          .catch(() => {
            if (previewAudio !== currentAudio) return
            setMessage('Playback was blocked. Tap play again to hear the take.')
          })
      } else {
        previewProgressLoop.sample(currentAudio)
        previewProgressLoop.stop()
        currentAudio.pause()
        setPreviewPlaying(false)
      }
      return
    }

    const nextAudio = new Audio(url)
    nextAudio.setAttribute('playsinline', '')
    previewAudio = nextAudio
    nextAudio.addEventListener('timeupdate', () => {
      if (previewAudio !== nextAudio) return
      previewProgressLoop.sample(nextAudio)
    })
    nextAudio.addEventListener('play', () => {
      if (previewAudio !== nextAudio) return
      setPreviewPlaying(true)
      previewProgressLoop.start(nextAudio)
    })
    nextAudio.addEventListener('pause', () => {
      if (previewAudio !== nextAudio) return
      previewProgressLoop.sample(nextAudio)
      previewProgressLoop.stop()
      setPreviewPlaying(false)
    })
    nextAudio.addEventListener('ended', () => {
      if (previewAudio !== nextAudio) return
      previewProgressLoop.stop()
      setPreviewPlaying(false)
      setPreviewProgress(1)
    })
    nextAudio.addEventListener('error', () => {
      if (previewAudio !== nextAudio) return
      previewProgressLoop.stop()
      setPreviewPlaying(false)
      setMessage(
        'This browser could not replay the temporary take, but you can still keep the original audio.',
      )
    })
    void nextAudio
      .play()
      .then(() => {
        if (previewAudio !== nextAudio || !isMediaPlaybackActive(nextAudio))
          return
        setPreviewPlaying(true)
        previewProgressLoop.start(nextAudio)
      })
      .catch(() => {
        if (previewAudio !== nextAudio) return
        setMessage('Playback was blocked. Tap play again to hear the take.')
      })
  }

  function keepTake(): void {
    const take = capture()
    const threadTitle = title().trim()
    const target = props.target
    if (take === null || threadTitle === '') return
    setState('saving')
    setMessage(null)
    trackEvent('voice_keep_attempt')

    void (async () => {
      try {
        const result = await keepFreeformVoiceTake({
          target,
          threadTitle,
          take,
        })
        if (result.ok) {
          setState('saved')
          trackEvent('voice_keep_success')
          try {
            await props.onKept(target.comparisonKey)
          } catch {
            setMessage(
              'The take was kept, but this thread could not refresh. Reload Hear Yourself to see it.',
            )
          }
          return
        }

        setState('ready')
        trackEvent('voice_keep_failure')
        if (result.quotaExceeded || !result.roomAvailable) {
          trackEvent('voice_storage_warning')
          setMessage(
            'This device is too low on browser storage to keep the take. Clear space, then retry.',
          )
        } else {
          setMessage(
            'The take could not be kept. Its temporary copy is still here so you can retry.',
          )
        }
      } catch {
        setState('ready')
        trackEvent('voice_keep_failure')
        setMessage(
          'The take could not be kept. Its temporary copy is still here so you can retry.',
        )
      }
    })()
  }

  function closeRecorder(): void {
    resetTemporary()
    props.onClose()
  }

  return (
    <section
      class={styles.recorder}
      aria-labelledby="freeform-recorder-title"
      aria-busy={state() === 'saving' || state() === 'processing'}
    >
      <div class={styles.heading}>
        <div class={styles.headingCopy}>
          <span class={styles.eyebrow}>Direct capture</span>
          <h2 id="freeform-recorder-title">
            {props.target.title === ''
              ? 'Start a practice thread'
              : 'Add a take'}
          </h2>
          <p>
            Capture one dry, private take. It only joins your history after you
            choose Keep Take.
          </p>
        </div>
        <button
          type="button"
          class={styles.closeButton}
          onClick={closeRecorder}
          aria-label="Close recorder"
          disabled={state() === 'saving'}
        >
          <IconCross size={19} />
        </button>
      </div>

      <div class={styles.body}>
        <div class={styles.promptField}>
          <div class={styles.promptCopy}>
            <label for="freeform-practice-prompt">
              What do you want to repeat?
            </label>
            <small id="freeform-prompt-help">
              {props.target.title === ''
                ? 'Name the moment you want to revisit and compare over time.'
                : 'This take will join the same thread for comparison.'}
            </small>
          </div>
          <div class={styles.promptControl}>
            <input
              id="freeform-practice-prompt"
              ref={titleInput}
              value={title()}
              maxlength={80}
              placeholder="First chorus after warm-up"
              disabled={state() !== 'idle' || props.target.title !== ''}
              aria-invalid={titleError() !== null}
              aria-describedby="freeform-prompt-help"
              onInput={(event) => {
                setTitle(event.currentTarget.value)
                if (event.currentTarget.value.trim() !== '') setTitleError(null)
              }}
            />
            <Show when={props.target.title !== '' && state() === 'idle'}>
              <button
                type="button"
                class={styles.switchThread}
                onClick={() => props.onStartNewThread()}
              >
                Start a different thread
              </button>
            </Show>
          </div>
          <Show when={titleError()}>
            <strong class={styles.fieldError} role="alert">
              {titleError()}
            </strong>
          </Show>
        </div>

        <section
          class={styles.captureField}
          classList={{
            [styles.captureFieldLive]: state() === 'recording',
            [styles.captureFieldReady]: capture() !== null,
          }}
          aria-label="Voice capture controls"
        >
          <div class={styles.captureTopline}>
            <div
              class={styles.captureStatus}
              classList={{
                [styles.captureStatusLive]: state() === 'recording',
              }}
            >
              <span
                class={styles.micMark}
                classList={{ [styles.micLive]: state() === 'recording' }}
                aria-hidden="true"
              >
                <IconMic size={state() === 'recording' ? 23 : 20} />
              </span>
              <div class={styles.statusCopy}>
                <span class={styles.statusEyebrow}>
                  {state() === 'recording'
                    ? 'Live capture'
                    : state() === 'ready' ||
                        state() === 'saving' ||
                        state() === 'saved'
                      ? 'Replay ready'
                      : 'Private capture'}
                </span>
                <strong aria-live="polite" aria-atomic="true">
                  {state() === 'starting'
                    ? 'Opening microphone'
                    : state() === 'recording'
                      ? 'Recording now'
                      : state() === 'processing'
                        ? 'Preparing replay'
                        : state() === 'saved'
                          ? 'Take kept on this device'
                          : state() === 'ready' || state() === 'saving'
                            ? 'Temporary take ready'
                            : state() === 'unsupported'
                              ? 'Recording unavailable'
                              : 'Ready when you are'}
                </strong>
              </div>
            </div>

            <Show when={state() === 'recording' || state() === 'processing'}>
              <time
                class={styles.captureTimer}
                datetime={`PT${Math.floor(elapsedMs() / 1000)}S`}
                aria-label={`${formatElapsed(elapsedMs())} elapsed`}
              >
                {formatElapsed(elapsedMs())}
              </time>
            </Show>
          </div>

          <p class={styles.captureDetail}>
            {state() === 'recording'
              ? 'Waveform shows input shape; the bright trail follows detected pitch.'
              : state() === 'processing'
                ? 'Building a replay from this local recording.'
                : state() === 'saved'
                  ? `${formatElapsed(elapsedMs())} saved locally. Your dry recording stays unchanged.`
                  : state() === 'ready' || state() === 'saving'
                    ? `${formatElapsed(elapsedMs())} captured. Listen before deciding whether to keep it.`
                    : 'Your microphone audio stays on this device. Maximum take length is five minutes.'}
          </p>

          <Show when={state() === 'recording'}>
            <div class={styles.liveVisual}>
              <LiveVoiceCapture
                active={true}
                frame={() => pitchStream?.latestSmoothed() ?? null}
              />
            </div>
          </Show>

          <div class={styles.captureAction}>
            <Show when={state() === 'idle'}>
              <button
                ref={startButton}
                type="button"
                class={styles.recordButton}
                onClick={beginRecording}
              >
                <span aria-hidden="true" />
                Start recording
              </button>
            </Show>
            <Show when={state() === 'starting'}>
              <button type="button" class={styles.recordButton} disabled>
                Opening microphone…
              </button>
            </Show>
            <Show when={state() === 'recording'}>
              <button
                type="button"
                class={styles.stopButton}
                onClick={stopRecording}
              >
                <span aria-hidden="true" />
                Stop recording
              </button>
            </Show>
            <Show when={state() === 'processing'}>
              <button type="button" class={styles.stopButton} disabled>
                Preparing replay…
              </button>
            </Show>
            <Show when={state() === 'unsupported'}>
              <p class={styles.unsupported} role="status">
                This browser cannot create a local voice recording. Your saved
                history remains available.
              </p>
            </Show>
          </div>
        </section>
      </div>

      <Show when={capture()}>
        {(take) => (
          <section
            class={styles.review}
            aria-labelledby="freeform-review-title"
          >
            <div class={styles.reviewHeader}>
              <div>
                <span>
                  {state() === 'saved' ? 'Saved take' : 'Temporary replay'}
                </span>
                <h3 id="freeform-review-title">
                  {state() === 'saved'
                    ? 'This take is in your voice history.'
                    : 'Listen once, then choose what stays.'}
                </h3>
              </div>
              <span class={styles.reviewDuration}>
                {formatElapsed(elapsedMs())}
              </span>
            </div>
            <div
              class={styles.waveform}
              role="img"
              aria-label="Waveform for the temporary take"
            >
              <VoiceTakeWaveform
                class={styles.waveformCanvas}
                peaks={take().peaks}
                progress={previewProgress()}
                playing={previewPlaying()}
              />
            </div>
            <div class={styles.reviewActions}>
              <button
                type="button"
                class={styles.previewButton}
                onClick={togglePreview}
                aria-pressed={previewPlaying()}
                disabled={persistenceLocked()}
              >
                {previewPlaying() ? 'Pause replay' : 'Play replay'}
              </button>
              <button
                type="button"
                class={styles.keepButton}
                onClick={keepTake}
                disabled={persistenceLocked()}
              >
                {state() === 'saving'
                  ? 'Keeping…'
                  : state() === 'saved'
                    ? 'Kept'
                    : 'Keep Take'}
              </button>
              <div class={styles.reviewSecondaryActions}>
                <button
                  type="button"
                  class={styles.textButton}
                  onClick={resetTemporary}
                  disabled={persistenceLocked()}
                >
                  Discard
                </button>
                <button
                  type="button"
                  class={styles.textButton}
                  onClick={beginRecording}
                  disabled={persistenceLocked()}
                >
                  Record again
                </button>
              </div>
            </div>
          </section>
        )}
      </Show>

      <Show when={message()}>
        <p class={styles.message} role="alert">
          {message()}
        </p>
      </Show>
    </section>
  )
}
