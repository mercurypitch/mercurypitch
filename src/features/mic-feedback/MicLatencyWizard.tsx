// ============================================================
// MicLatencyWizard — measure the speaker-to-microphone round trip
// ============================================================
//
// Plays a short click track through the speakers and records what comes back
// through the mic. The gap between a click going out and the same click
// arriving back is the device's round-trip latency, which is the number the
// scoring engines need to place a sung note on the reference timeline.
//
// Three details decide whether the measurement means anything:
//
//  - Everything is timed on ONE AudioContext clock. The clicks are scheduled
//    on it and the capture is anchored to it, so playback and capture share a
//    time base and the subtraction is meaningful.
//  - The reference is the SCHEDULED click time, with no `outputLatency` added.
//    The neighbouring TapCalibrationPanel does add it, because a human
//    reaction time must not include the device's delay. Here the device's
//    delay is the entire measurement.
//  - It needs speakers. On headphones the mic never hears the clicks and the
//    run reports that rather than inventing a number.
//
// The math is in @/lib/mic-latency; this file is capture, playback and copy.

import { createSignal, onCleanup, Show } from 'solid-js'
import type { LatencyResult } from '@/lib/mic-latency'
import { detectOnsets, LATENCY_CLICK_COUNT, LATENCY_CLICK_INTERVAL_SEC, LATENCY_LEAD_IN_SEC, matchOnsetDeltas, summariseLatency, } from '@/lib/mic-latency'
import { micManager } from '@/lib/mic-manager'
import { buildClickSchedule } from '@/lib/tap-calibration'
import { clearMicLatency, micLatencyMs, setMicLatencyMs, } from '@/stores/mic-latency-store'
import { showNotification } from '@/stores/notifications-store'
import styles from './MicLatencyWizard.module.css'

const MIC_OWNER = 'mic-latency-wizard'
/** Small blocks keep the capture anchor tight; 512 is ~11 ms at 48 kHz. */
const CAPTURE_BLOCK_SAMPLES = 512
/** Keep recording past the last click so its return is inside the buffer. */
const TAIL_SEC = 0.75

type Phase = 'idle' | 'running' | 'done'

const FAILURE_COPY: Record<string, string> = {
  'not-heard':
    'The clicks never came back. Play through speakers rather than headphones, turn the volume up, and check the microphone is not muted.',
  'too-few-hits':
    'Only a few clicks were picked out of the noise. A quieter room, or a little more volume, should settle it.',
  'out-of-range':
    'The numbers did not agree with each other — something else in the room was probably picked up as a click. Worth another run.',
}

export interface MicLatencyWizardProps {
  onClose: () => void
}

export function MicLatencyWizard(props: MicLatencyWizardProps) {
  const [phase, setPhase] = createSignal<Phase>('idle')
  const [result, setResult] = createSignal<LatencyResult | null>(null)
  const [error, setError] = createSignal<string | null>(null)

  let ctx: AudioContext | null = null
  let source: MediaStreamAudioSourceNode | null = null
  let capture: ScriptProcessorNode | null = null
  let sink: GainNode | null = null
  let finishTimer: ReturnType<typeof setTimeout> | undefined
  let holdsMic = false

  let chunks: Float32Array[] = []
  let captureStartSec: number | null = null
  let schedule: number[] = []

  const teardown = (): void => {
    if (finishTimer !== undefined) {
      clearTimeout(finishTimer)
      finishTimer = undefined
    }
    if (capture !== null) {
      capture.onaudioprocess = null
      capture.disconnect()
      capture = null
    }
    source?.disconnect()
    source = null
    sink?.disconnect()
    sink = null
    if (ctx !== null) {
      void ctx.close().catch(() => {})
      ctx = null
    }
    if (holdsMic) {
      holdsMic = false
      micManager.release(MIC_OWNER)
    }
  }

  onCleanup(teardown)

  /** Short sine burst with ramps at both ends — a bare start/stop pops. */
  const scheduleClick = (audio: AudioContext, at: number): void => {
    const osc = audio.createOscillator()
    const gain = audio.createGain()
    osc.type = 'sine'
    osc.frequency.value = 1000
    gain.gain.setValueAtTime(0, at)
    gain.gain.linearRampToValueAtTime(0.5, at + 0.003)
    gain.gain.linearRampToValueAtTime(0, at + 0.04)
    osc.connect(gain).connect(audio.destination)
    osc.start(at)
    osc.stop(at + 0.06)
  }

  const finish = (): void => {
    const audio = ctx
    const startedAt = captureStartSec
    const sampleRate = audio?.sampleRate ?? 0
    const recorded = chunks
    const scheduled = schedule
    teardown()

    if (startedAt === null || sampleRate <= 0 || recorded.length === 0) {
      setError('Nothing was recorded. Check the microphone and try again.')
      setPhase('idle')
      return
    }

    let total = 0
    for (const chunk of recorded) total += chunk.length
    const samples = new Float32Array(total)
    let at = 0
    for (const chunk of recorded) {
      samples.set(chunk, at)
      at += chunk.length
    }

    const onsets = detectOnsets(samples, sampleRate)
    // Onsets are relative to the buffer; the schedule is on the audio clock.
    const onsetTimes = onsets.map((t) => startedAt + t)
    const deltas = matchOnsetDeltas(scheduled, onsetTimes)
    setResult(summariseLatency(deltas, onsets.length))
    setPhase('done')
  }

  const start = async (): Promise<void> => {
    teardown()
    setError(null)
    setResult(null)
    chunks = []
    captureStartSec = null

    let stream: MediaStream
    try {
      stream = await micManager.acquire(MIC_OWNER)
      holdsMic = true
    } catch {
      setError(
        'The microphone could not be opened. Allow microphone access and try again.',
      )
      return
    }

    const audio = new AudioContext()
    ctx = audio
    await audio.resume().catch(() => {})

    source = audio.createMediaStreamSource(stream)
    capture = audio.createScriptProcessor(CAPTURE_BLOCK_SAMPLES, 1, 1)
    // ScriptProcessor over AudioWorklet for the same reason as ShazamListen:
    // Chrome outputs silence for a worklet fed by a cross-context stream.
    capture.onaudioprocess = (e) => {
      const input = e.inputBuffer.getChannelData(0)
      // The block just delivered was captured over the window ENDING now, so
      // sample 0 of the recording sits one block back on the audio clock.
      captureStartSec ??= audio.currentTime - input.length / audio.sampleRate
      chunks.push(new Float32Array(input))
    }
    // A ScriptProcessor only fires while connected to the destination, but its
    // output must not be audible — it would feed the mic straight back out.
    sink = audio.createGain()
    sink.gain.value = 0
    source.connect(capture)
    capture.connect(sink).connect(audio.destination)

    const firstClick = audio.currentTime + LATENCY_LEAD_IN_SEC
    schedule = buildClickSchedule(
      firstClick,
      LATENCY_CLICK_COUNT,
      LATENCY_CLICK_INTERVAL_SEC,
    )
    for (const time of schedule) scheduleClick(audio, time)

    const runFor =
      LATENCY_LEAD_IN_SEC +
      LATENCY_CLICK_COUNT * LATENCY_CLICK_INTERVAL_SEC +
      TAIL_SEC
    finishTimer = setTimeout(finish, runFor * 1000)
    setPhase('running')
  }

  const apply = (): void => {
    const measured = result()?.latencyMs
    if (measured == null) return
    setMicLatencyMs(measured)
    showNotification(
      `Microphone latency set to ${measured} ms for this input.`,
      'success',
    )
    props.onClose()
  }

  const clear = (): void => {
    clearMicLatency()
    showNotification('Microphone latency offset cleared.', 'info')
    props.onClose()
  }

  return (
    <div
      class={styles.wizard}
      role="group"
      aria-label="Microphone latency calibration"
    >
      <div class={styles.head}>
        <span class={styles.title}>Microphone latency</span>
        <button
          type="button"
          class={styles.close}
          onClick={() => {
            teardown()
            props.onClose()
          }}
          aria-label="Close latency calibration"
        >
          <svg viewBox="0 0 24 24" width="11" height="11">
            <path
              fill="currentColor"
              d="M19 6.4 17.6 5 12 10.6 6.4 5 5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12z"
            />
          </svg>
        </button>
      </div>

      <Show when={phase() === 'idle'}>
        <p class={styles.copy}>
          Your device takes a moment to play a sound and another to capture one.
          Over that gap a note you sing lands late against the reference, and
          scoring blames you for it. This plays {LATENCY_CLICK_COUNT} clicks
          through your speakers, listens for them coming back, and measures the
          gap.
        </p>
        <p class={styles.note}>
          Use speakers, not headphones — the microphone has to hear the clicks.
          Moderate volume, and stay quiet for the few seconds it runs.
        </p>
        <Show when={micLatencyMs() > 0}>
          <p class={styles.current}>
            Currently set to <strong>{micLatencyMs()} ms</strong> for this
            input.
          </p>
        </Show>
        <Show when={error() !== null}>
          <p class={styles.error}>{error()}</p>
        </Show>
        <div class={styles.actions}>
          <button
            type="button"
            class={styles.primary}
            onClick={() => {
              void start()
            }}
          >
            Start
          </button>
          <Show when={micLatencyMs() > 0}>
            <button type="button" class={styles.secondary} onClick={clear}>
              Clear offset
            </button>
          </Show>
        </div>
      </Show>

      <Show when={phase() === 'running'}>
        <p class={styles.copy}>Listening — stay quiet.</p>
        <div class={styles.bar} aria-hidden="true">
          <span class={styles.barFill} />
        </div>
      </Show>

      <Show when={phase() === 'done'}>
        <Show
          when={result()?.latencyMs != null}
          fallback={
            <>
              <p class={styles.error}>
                {FAILURE_COPY[result()?.failure ?? ''] ??
                  'The run did not produce a usable number.'}
              </p>
              <div class={styles.actions}>
                <button
                  type="button"
                  class={styles.primary}
                  onClick={() => {
                    void start()
                  }}
                >
                  Try again
                </button>
              </div>
            </>
          }
        >
          <p class={styles.result}>
            <strong>{result()?.latencyMs} ms</strong> round trip
          </p>
          <p class={styles.note}>
            Matched {result()?.hits} of {LATENCY_CLICK_COUNT} clicks
            <Show when={result()?.spreadMs != null}>
              , spread {result()?.spreadMs} ms
            </Show>
            . A wide spread means the room was noisy and the run is worth
            repeating.
          </p>
          <div class={styles.actions}>
            <button type="button" class={styles.primary} onClick={apply}>
              Use this
            </button>
            <button
              type="button"
              class={styles.secondary}
              onClick={() => {
                void start()
              }}
            >
              Measure again
            </button>
          </div>
        </Show>
      </Show>
    </div>
  )
}
