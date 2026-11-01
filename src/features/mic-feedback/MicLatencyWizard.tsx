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
// A TV on AirPlay or HDMI, and Bluetooth, play the sound with a delay of
// their own, so a run there is kept for that route alone, and the number in
// use there is the phone's own outputs' until one is (mic-latency-store.ts).
// The wizard says which, and offers to clear only a number measured where
// the sound goes now. A run there is also measured its own way
// (@/lib/mic-latency-route): unevenly spaced clicks, each reply held to a
// threshold of its own, up to a second kept and a longer delay named
// (REQ-TV-096), with words of its own (latency-route-copy.ts).
//
// The math is in @/lib/mic-latency and @/lib/mic-latency-route; this file is
// capture, playback and copy.

import type { JSX } from 'solid-js'
import { createSignal, onCleanup, Show } from 'solid-js'
import { audioOutputPathSeconds, detectOnsets, LATENCY_CLICK_COUNT, LATENCY_CLICK_HZ, LATENCY_CLICK_INTERVAL_SEC, LATENCY_LEAD_IN_SEC, matchOnsetDeltas, summariseLatency, } from '@/lib/mic-latency'
import type { RouteLatencyResult } from '@/lib/mic-latency-route'
import { measureRouteLatency, ROUTE_TAIL_SEC, routeClickSchedule, } from '@/lib/mic-latency-route'
import { micManager } from '@/lib/mic-manager'
import { buildClickSchedule } from '@/lib/tap-calibration'
import { setMicLatencyPathMs } from '@/stores/mic-latency-path-store'
import type { LatencyRoute } from '@/stores/mic-latency-store'
import { clearMicLatency, currentLatencyRoute, LATENCY_ROUTE_NAMES, micLatencyMeasuredOnRoute, micLatencyMs, setMicLatencyMeasurement, } from '@/stores/mic-latency-store'
import { showNotification } from '@/stores/notifications-store'
import { isTvRoute, routeFailureCopy, TV_RUN_NOTE } from './latency-route-copy'
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

/**
 * One run's answer from its recording. `startedAt` is the recording's first
 * sample on the audio clock, which the schedule is on. The phone's own
 * outputs keep the measurement they always had; a route with a delay of its
 * own is measured its own way.
 */
function measure(
  samples: Float32Array,
  sampleRate: number,
  startedAt: number,
  scheduled: readonly number[],
  route: LatencyRoute | null,
): RouteLatencyResult {
  if (route !== null) {
    return measureRouteLatency(
      samples,
      sampleRate,
      scheduled.map((time) => time - startedAt),
    )
  }
  const onsets = detectOnsets(samples, sampleRate)
  // Onsets are relative to the buffer; the schedule is on the audio clock.
  const onsetTimes = onsets.map((t) => startedAt + t)
  const deltas = matchOnsetDeltas([...scheduled], onsetTimes)
  return summariseLatency(deltas, onsets.length)
}

/** A failed run in words: the route's own where it has them. */
function failureCopy(
  result: RouteLatencyResult | null,
  route: LatencyRoute | null,
): string {
  const routed =
    result !== null && route !== null ? routeFailureCopy(result, route) : null
  return (
    routed ??
    FAILURE_COPY[result?.failure ?? ''] ??
    'The run did not produce a usable number.'
  )
}

export interface MicLatencyWizardProps {
  onClose: () => void
  /** Extra class on the root, for a host that restyles the panel through
   *  the tokens it reads (--accent, --border, --bg-secondary, ...). */
  class?: string
  /** The first paragraph, for a host with words of its own (the phone app's
   *  sheet). Absent, the wizard says what it always has. */
  intro?: JSX.Element
  /** After a measurement is applied, with the number it set. */
  onApplied?: (latencyMs: number) => void
  /** After the offset is cleared. */
  onCleared?: () => void
}

export function MicLatencyWizard(props: MicLatencyWizardProps) {
  const [phase, setPhase] = createSignal<Phase>('idle')
  const [result, setResult] = createSignal<RouteLatencyResult | null>(null)
  const [error, setError] = createSignal<string | null>(null)
  /** The route the last run measured, which its words are for. */
  const [runRoute, setRunRoute] = createSignal<LatencyRoute | null>(null)

  let ctx: AudioContext | null = null
  let source: MediaStreamAudioSourceNode | null = null
  let capture: ScriptProcessorNode | null = null
  let sink: GainNode | null = null
  let finishTimer: ReturnType<typeof setTimeout> | undefined
  let holdsMic = false

  let chunks: Float32Array[] = []
  let captureStartSec: number | null = null
  /** The output path of the clock the last run measured on, in ms. */
  let runPathMs: number | null = null
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

  /** The route the number is kept for, by name, or null for the phone's own outputs. */
  const routeName = (): string | null => {
    const route = currentLatencyRoute()
    return route === null ? null : LATENCY_ROUTE_NAMES[route]
  }

  /** What follows the number in use: for this input, and on which route. */
  const currentWhere = (): string => {
    const name = routeName()
    if (name === null) return ' for this input.'
    return micLatencyMeasuredOnRoute()
      ? ` for this input on ${name}.`
      : ` for this input, not yet measured on ${name}. A run now keeps one for ${name} alone.`
  }

  /** Short sine burst with ramps at both ends — a bare start/stop pops. */
  const scheduleClick = (audio: AudioContext, at: number): void => {
    const osc = audio.createOscillator()
    const gain = audio.createGain()
    osc.type = 'sine'
    osc.frequency.value = LATENCY_CLICK_HZ
    gain.gain.setValueAtTime(0, at)
    gain.gain.linearRampToValueAtTime(0.5, at + 0.003)
    gain.gain.linearRampToValueAtTime(0, at + 0.04)
    osc.connect(gain).connect(audio.destination)
    osc.start(at)
    osc.stop(at + 0.06)
  }

  const finish = (): void => {
    const audio = ctx
    // Read while the clock still runs: the Studio adds what it buffers beyond this.
    runPathMs = audio === null ? null : audioOutputPathSeconds(audio) * 1000
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

    setResult(measure(samples, sampleRate, startedAt, scheduled, runRoute()))
    setPhase('done')
  }

  const start = async (): Promise<void> => {
    teardown()
    setError(null)
    setResult(null)
    chunks = []
    captureStartSec = null
    // Read as the run starts: the run is measured, and kept, for this route.
    const route = currentLatencyRoute()
    setRunRoute(route)

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
    // A route with a delay of its own gets unevenly spaced clicks and a tail
    // long enough for the longest reply looked for (REQ-TV-096).
    schedule =
      route === null
        ? buildClickSchedule(
            firstClick,
            LATENCY_CLICK_COUNT,
            LATENCY_CLICK_INTERVAL_SEC,
          )
        : routeClickSchedule(firstClick)
    for (const time of schedule) scheduleClick(audio, time)

    const runFor =
      route === null
        ? LATENCY_LEAD_IN_SEC +
          LATENCY_CLICK_COUNT * LATENCY_CLICK_INTERVAL_SEC +
          TAIL_SEC
        : schedule[schedule.length - 1] - audio.currentTime + ROUTE_TAIL_SEC
    finishTimer = setTimeout(finish, runFor * 1000)
    setPhase('running')
  }

  const apply = (): void => {
    const measurement = result()
    const measured = measurement?.latencyMs
    if (measured == null) return
    // A number is kept for the route it was measured on. If the sound has
    // moved since (mirroring stopped, say), it would land on the wrong one.
    if (currentLatencyRoute() !== runRoute()) {
      setResult(null)
      setError(
        'The sound has moved to another output since that run. Run it again where you will sing.',
      )
      setPhase('idle')
      return
    }
    setMicLatencyMeasurement(measured, measurement?.spreadMs ?? null)
    setMicLatencyPathMs(runPathMs)
    const name = routeName()
    showNotification(
      name === null
        ? `Microphone latency set to ${measured} ms for this input.`
        : `Microphone latency set to ${measured} ms for this input on ${name}.`,
      'success',
    )
    props.onApplied?.(measured)
    props.onClose()
  }

  const clear = (): void => {
    const name = routeName()
    clearMicLatency()
    showNotification(
      name === null
        ? 'Microphone latency offset cleared.'
        : `Microphone latency offset cleared for ${name}.`,
      'info',
    )
    props.onCleared?.()
    props.onClose()
  }

  return (
    <div
      class={
        props.class === undefined
          ? styles.wizard
          : `${styles.wizard} ${props.class}`
      }
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
          <Show
            when={props.intro}
            fallback={
              <>
                Your device takes a moment to play a sound and another to
                capture one. Over that gap a note you sing lands late against
                the reference, and scoring blames you for it. This plays{' '}
                {LATENCY_CLICK_COUNT} clicks through your speakers, listens for
                them coming back, and measures the gap.
              </>
            }
          >
            {props.intro}
          </Show>
        </p>
        <p class={styles.note}>
          Use speakers, not headphones — the microphone has to hear the clicks.
          Moderate volume, and stay quiet for the few seconds it runs.
        </p>
        <Show when={isTvRoute(currentLatencyRoute())}>
          <p class={styles.note}>{TV_RUN_NOTE}</p>
        </Show>
        <Show when={micLatencyMs() > 0}>
          <p class={styles.current}>
            Currently set to <strong>{micLatencyMs()} ms</strong>
            {currentWhere()}
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
          <Show when={micLatencyMs() > 0 && micLatencyMeasuredOnRoute()}>
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
              <p class={styles.error}>{failureCopy(result(), runRoute())}</p>
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
