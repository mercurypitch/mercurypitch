// ============================================================
// Freeform Voice Recorder — explicit dry capture inside Hear Yourself
// ============================================================

import type { Component } from 'solid-js'
import { createSignal, onMount, Show, untrack } from 'solid-js'
import { IconCross, IconMic } from '@/components/exercise-icons'
import { VoiceTakeWaveform } from '@/components/VoiceTakeWaveform'
import { trackEvent } from '@/lib/analytics'
import { encodeVoiceAtlasContour } from '@/lib/voice-contour'
import type { FreeformThreadTarget, FreeformVoiceTakeCapture, } from './freeform-voice-take'
import { keepFreeformVoiceTake } from './freeform-voice-take'
import styles from './FreeformVoiceRecorder.module.css'
import { LiveVoiceCapture } from './LiveVoiceCapture'
import type { DryVoiceCaptureState } from './useDryVoiceCapture'
import { useDryVoiceCapture } from './useDryVoiceCapture'

export { drainPitchStream } from './useDryVoiceCapture'

type RecorderState = DryVoiceCaptureState | 'saving' | 'saved'

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

export const FreeformVoiceRecorder: Component<FreeformVoiceRecorderProps> = (
  props,
) => {
  const micConsumerId = `${MIC_CONSUMER_PREFIX}:${++recorderInstance}`
  const [title, setTitle] = createSignal(untrack(() => props.target.title))
  const [titleError, setTitleError] = createSignal<string | null>(null)
  const [persistenceState, setPersistenceState] = createSignal<
    'idle' | 'saving' | 'saved'
  >('idle')
  const [persistenceMessage, setPersistenceMessage] = createSignal<
    string | null
  >(null)
  const voiceCapture = useDryVoiceCapture({
    consumerId: micConsumerId,
    maxDurationMs: MAX_CAPTURE_MS,
  })

  const state = (): RecorderState => {
    const persistence = persistenceState()
    return persistence === 'idle' ? voiceCapture.state() : persistence
  }
  const capture = voiceCapture.capture
  const elapsedMs = voiceCapture.elapsedMs
  const previewPlaying = voiceCapture.previewPlaying
  const previewProgress = voiceCapture.previewProgress
  const message = (): string | null =>
    persistenceMessage() ?? voiceCapture.message()

  let titleInput: HTMLInputElement | undefined
  let startButton: HTMLButtonElement | undefined

  const persistenceLocked = (): boolean =>
    state() === 'saving' || state() === 'saved'

  function resetTemporary(): void {
    voiceCapture.discard()
    setPersistenceState('idle')
    setPersistenceMessage(null)
  }

  onMount(() => {
    const shouldFocusTitle = untrack(() => props.target.title === '')
    queueMicrotask(() => {
      if (shouldFocusTitle) titleInput?.focus()
      else startButton?.focus()
    })
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
    void voiceCapture.start()
  }

  function stopRecording(): void {
    void voiceCapture.stop()
  }

  function keepTake(): void {
    const take = capture()
    const threadTitle = title().trim()
    const target = props.target
    if (take === null || threadTitle === '') return
    const freeformTake: FreeformVoiceTakeCapture = {
      blob: take.blob,
      durationMs: take.durationMs,
      peaks: take.peaks,
      capturedAt: take.capturedAt,
      contour: encodeVoiceAtlasContour(take.frames, {
        source: 'f0-stream-yin-v1',
      }),
    }
    setPersistenceState('saving')
    setPersistenceMessage(null)
    trackEvent('voice_keep_attempt')

    void (async () => {
      try {
        const result = await keepFreeformVoiceTake({
          target,
          threadTitle,
          take: freeformTake,
        })
        if (result.ok) {
          setPersistenceState('saved')
          trackEvent('voice_keep_success')
          try {
            await props.onKept(target.comparisonKey)
          } catch {
            setPersistenceMessage(
              'The take was kept, but this thread could not refresh. Reload Hear Yourself to see it.',
            )
          }
          return
        }

        setPersistenceState('idle')
        trackEvent('voice_keep_failure')
        if (result.quotaExceeded || !result.roomAvailable) {
          trackEvent('voice_storage_warning')
          setPersistenceMessage(
            'This device is too low on browser storage to keep the take. Clear space, then retry.',
          )
        } else {
          setPersistenceMessage(
            'The take could not be kept. Its temporary copy is still here so you can retry.',
          )
        }
      } catch {
        setPersistenceState('idle')
        trackEvent('voice_keep_failure')
        setPersistenceMessage(
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
                frame={voiceCapture.latestSmoothedFrame}
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
                onClick={voiceCapture.togglePreview}
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
