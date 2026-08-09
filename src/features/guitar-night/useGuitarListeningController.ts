// Guitar Night Listening captures explicit, local pitch evidence for truthful Jam Doctor readouts.
// ============================================================
//
// Two paths, deliberately, because *when* and *what* are different questions:
//
//   attacks   Found on the audio thread, one render quantum at a time, and
//             stamped with the audio clock's own frame counter. This is the
//             only path whose timestamps are worth anything musically.
//   pitch     Read from an analyser on the frame loop, because naming a note
//             needs a window tens of milliseconds wide and a few milliseconds
//             of lag in the answer costs nothing.
//
// A pitch reading is attached to the strike it belongs to, so an attack keeps
// its exact time and still ends up knowing what note it was.
//
// If the worklet cannot load, the frame loop finds attacks too — coarsely, at
// whatever rate the renderer happens to be running. That is a real difference
// in evidence quality, so it is reported as `timingSource` rather than hidden;
// nothing downstream should make fine timing claims on the coarse path.

import { createMemo, createSignal, onCleanup } from 'solid-js'
import type { GuitarSessionAudioGraph } from '@/features/guitar/backing/guitar-session-audio-graph'
import type { GuitarInputTap } from '@/lib/guitar/guitar-input-node'
import { connectGuitarInputWorklet } from '@/lib/guitar/guitar-input-node'
import type { GuitarInputEvent, GuitarInputHealthReading, } from '@/lib/guitar/input-events'
import { attachPitchToLatestAttack, createNoiseFloorFollower, describeInputHealth, frameToSeconds, playedAt, } from '@/lib/guitar/input-events'
import type { LatencyFailure } from '@/lib/mic-latency'
import { LATENCY_CLICK_COUNT, LATENCY_CLICK_INTERVAL_SEC, LATENCY_LEAD_IN_SEC, matchOnsetDeltas, summariseLatency, } from '@/lib/mic-latency'
import { micManager } from '@/lib/mic-manager'
import { registerMicIndicator } from '@/lib/mic-sentinel'
import { PitchDetector } from '@/lib/pitch-detector'
import { buildClickSchedule } from '@/lib/tap-calibration'
import { micLatencyMs, micLatencySec, setMicLatencyMs, } from '@/stores/mic-latency-store'

const CONSUMER_ID = 'guitar-night-listening'
const MAX_EVENTS = 256
const ANALYSER_SIZE = 2048
// Longer than the sample detector's 45 ms refractory period and several frame
// callbacks, while still admitting sixteenth notes at common practice tempos.
const COARSE_RESTRIKE_DEBOUNCE_SECONDS = 0.08

/** What to say about a run that produced no number. */
const CALIBRATION_FAILURES: Record<LatencyFailure, string> = {
  'not-heard':
    'The clicks never came back — calibration needs speakers, not headphones.',
  'too-few-hits':
    'Too few clicks came back to trust the result. Try again somewhere quieter.',
  'out-of-range':
    'That measured further out than any real round trip. Nothing was saved.',
}

export type GuitarListeningStatus =
  | 'off'
  | 'requesting'
  | 'listening'
  | 'calibrating'
  | 'error'

/**
 * Where an attack's timestamp came from. The audio clock is sample-exact; the
 * frame loop is whatever the renderer managed, and can be tens of milliseconds
 * out under load.
 */
export type GuitarTimingSource = 'audio-clock' | 'frame-loop'

export type { GuitarInputEvent }

export interface GuitarListeningObservation {
  label: string
  value: string
  detail: string
}

interface GuitarListeningControllerOptions {
  activateAudio(): Promise<boolean>
  getAudioGraph(): GuitarSessionAudioGraph | null
}

function median(values: readonly number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
    : (sorted[middle] ?? 0)
}

export function summarizeGuitarListeningEvidence(
  events: readonly GuitarInputEvent[],
): readonly GuitarListeningObservation[] {
  if (events.length === 0) return []
  const attacks = events.filter((event) => event.kind === 'attack')
  const identified = events.filter((event) => event.pitch !== null)
  const observations: GuitarListeningObservation[] = [
    {
      label: 'Attacks heard',
      value: String(attacks.length),
      detail: 'Fresh note attacks captured in this take.',
    },
  ]

  // Legato moves are real playing and worth showing, but they are not picks
  // and the spacing figures below must not be built from them.
  const legato = events.length - attacks.length
  if (legato > 0) {
    observations.push({
      label: 'Notes without a pick',
      value: String(legato),
      detail: 'Hammer-ons, pull-offs or slides — heard as pitch changes.',
    })
  }

  if (identified.length < events.length) {
    observations.push({
      label: 'Notes identified',
      value: `${identified.length} of ${events.length}`,
      detail: 'The rest were heard but not clear enough to name.',
    })
  }

  if (identified.length >= 3) {
    const clarity = median(identified.map((event) => event.pitch?.clarity ?? 0))
    observations.push({
      label: 'Median clarity',
      value: `${Math.round(clarity * 100)}%`,
      detail: 'Detector confidence across identified notes.',
    })
  }

  if (attacks.length >= 4) {
    const intervals = attacks
      .slice(1)
      .map(
        (event, index) => (event.at - (attacks[index]?.at ?? event.at)) * 1000,
      )
      .filter((interval) => interval > 45 && interval < 5000)
    if (intervals.length >= 3) {
      const center = median(intervals)
      const deviation = median(
        intervals.map((interval) => Math.abs(interval - center)),
      )
      observations.push({
        label: 'Attack spacing',
        value: `±${Math.round(deviation)} ms`,
        detail: `Median spacing ${Math.round(center)} ms; lower variation is steadier.`,
      })
    }
  }

  const midiValues = identified.map((event) => event.pitch?.midi ?? 0)
  if (midiValues.length > 0) {
    const range = Math.max(...midiValues) - Math.min(...midiValues)
    if (range > 0) {
      observations.push({
        label: 'Range heard',
        value: `${range} semitones`,
        detail: 'Lowest-to-highest identified note in this take.',
      })
    }
  }

  return observations
}

function rms(samples: Float32Array): number {
  let sum = 0
  for (let index = 0; index < samples.length; index += 1) {
    sum += samples[index] * samples[index]
  }
  return Math.sqrt(sum / Math.max(1, samples.length))
}

/**
 * Loudest sample in the window. Health is judged on peak, not on the RMS the
 * onset heuristic uses: a signal clipping at ±1 has an RMS around 0.7, so an
 * RMS-based check would never once report the one fault that matters most.
 */
function peakOf(samples: Float32Array): number {
  let peak = 0
  for (let index = 0; index < samples.length; index += 1) {
    const magnitude = Math.abs(samples[index] ?? 0)
    if (magnitude > peak) peak = magnitude
  }
  return peak
}

interface ScheduledCalibrationClick {
  cancel(): void
}

/** A short bright tick, loud enough for the room to hear itself play it. */
function scheduleCalibrationClick(
  context: AudioContext,
  at: number,
): ScheduledCalibrationClick {
  const oscillator = context.createOscillator()
  const gain = context.createGain()
  let connected = true
  const disconnect = (): void => {
    if (!connected) return
    connected = false
    oscillator.disconnect()
    gain.disconnect()
  }
  oscillator.type = 'square'
  oscillator.frequency.value = 1400
  gain.gain.setValueAtTime(0.0001, at)
  gain.gain.exponentialRampToValueAtTime(0.5, at + 0.001)
  gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.012)
  oscillator.connect(gain)
  gain.connect(context.destination)
  oscillator.onended = disconnect
  oscillator.start(at)
  oscillator.stop(at + 0.03)
  return {
    cancel() {
      try {
        oscillator.stop()
      } catch {
        // A click that already ended is already silent; it still disconnects.
      }
      disconnect()
    },
  }
}

export function useGuitarListeningController(
  options: GuitarListeningControllerOptions,
) {
  const [status, setStatus] = createSignal<GuitarListeningStatus>('off')
  const [error, setError] = createSignal<string | null>(null)
  const [currentNote, setCurrentNote] = createSignal<string | null>(null)
  const [detectedMidi, setDetectedMidi] = createSignal<number | null>(null)
  const [clarity, setClarity] = createSignal(0)
  const [events, setEvents] = createSignal<readonly GuitarInputEvent[]>([])
  const [timingSource, setTimingSource] =
    createSignal<GuitarTimingSource>('frame-loop')
  const [health, setHealth] = createSignal<GuitarInputHealthReading | null>(
    null,
  )
  const observations = createMemo(() =>
    summarizeGuitarListeningEvidence(events()),
  )

  let source: MediaStreamAudioSourceNode | null = null
  let analyser: AnalyserNode | null = null
  let tap: GuitarInputTap | null = null
  let frame = 0
  let generation = 0
  let heldMidi: number | null = null
  let lastCoarseAttackAt: number | null = null
  let lastCoarseAttackMidi: number | null = null
  let cancelCalibrationRun: (() => void) | null = null
  // While a calibration run is going, attacks are evidence about the route,
  // not about the player, and must not land in the take.
  let calibrationHits: number[] | null = null

  const pushEvent = (event: GuitarInputEvent): void => {
    setEvents((previous) => [...previous.slice(-(MAX_EVENTS - 1)), event])
  }

  const stopNodes = (): void => {
    cancelCalibrationRun?.()
    cancelCalibrationRun = null
    if (frame !== 0) cancelAnimationFrame(frame)
    frame = 0
    tap?.dispose()
    tap = null
    source?.disconnect()
    analyser?.disconnect()
    source = null
    analyser = null
    heldMidi = null
    lastCoarseAttackAt = null
    lastCoarseAttackMidi = null
    calibrationHits = null
  }

  const stop = (): void => {
    generation += 1
    stopNodes()
    micManager.release(CONSUMER_ID)
    setStatus('off')
    setCurrentNote(null)
    setDetectedMidi(null)
    setClarity(0)
    setHealth(null)
    setTimingSource('frame-loop')
  }

  // Watchdog registration (repo rule: every mic surface registers): the
  // room's Listening chip reads this status — a confirmed icon-on with no
  // live track heals through the surface's own stop path.
  onCleanup(
    registerMicIndicator(
      CONSUMER_ID,
      // Deliberately non-reactive: the sentinel polls these accessors on
      // its own low-frequency interval — no tracked scope involved.
      // eslint-disable-next-line solid/reactivity
      () => status() !== 'off' && status() !== 'error',

      () => stop(),
    ),
  )

  const start = async (): Promise<boolean> => {
    if (status() !== 'off' && status() !== 'error') return true
    generation += 1
    const currentGeneration = generation
    stopNodes()
    setEvents([])
    setError(null)
    setStatus('requesting')

    try {
      if (
        !(await options.activateAudio()) ||
        currentGeneration !== generation
      ) {
        throw new Error('The room audio clock could not start.')
      }
      const graph = options.getAudioGraph()
      if (graph === null)
        throw new Error('The room audio clock is unavailable.')
      const stream = await micManager.acquire(CONSUMER_ID)
      if (currentGeneration !== generation) {
        micManager.release(CONSUMER_ID)
        return false
      }

      const context = graph.context

      const nextSource = context.createMediaStreamSource(stream)
      const nextAnalyser = context.createAnalyser()
      nextAnalyser.fftSize = ANALYSER_SIZE
      nextAnalyser.smoothingTimeConstant = 0
      nextSource.connect(nextAnalyser)
      source = nextSource
      analyser = nextAnalyser

      // Messages arrive from the audio thread, not from a tracked scope. The
      // latency read inside wants whatever was measured at the moment the
      // strike landed — subscribing to it would be meaningless here.

      tap = await connectGuitarInputWorklet(context, nextSource, (message) => {
        if (currentGeneration !== generation) return
        if (message.type === 'level') {
          setHealth(describeInputHealth(message.peak, message.noiseFloor))
          return
        }
        const capturedAt = frameToSeconds(message.atFrame, context.sampleRate)
        if (calibrationHits !== null) {
          calibrationHits.push(capturedAt)
          return
        }
        pushEvent({
          kind: 'attack',
          source: 'microphone',
          at: playedAt(capturedAt, micLatencySec()),
          capturedAt,
          level: message.level,
          pitch: null,
        })
      })
      if (currentGeneration !== generation) {
        stopNodes()
        micManager.release(CONSUMER_ID)
        return false
      }
      setTimingSource(tap === null ? 'frame-loop' : 'audio-clock')

      const samples = new Float32Array(nextAnalyser.fftSize)
      // How far back the analyser's window reaches. A note named from it began
      // at least this long ago, which is what the strike it belongs to knows.
      const windowSeconds = nextAnalyser.fftSize / context.sampleRate
      const detector = new PitchDetector({
        algorithm: 'mpm',
        sampleRate: context.sampleRate,
        bufferSize: nextAnalyser.fftSize,
        minFrequency: 55,
        maxFrequency: 1600,
        minConfidence: 0.38,
        minAmplitude: 0.018,
      })
      const fallbackNoiseFloor = createNoiseFloorFollower()
      let smoothedRms = 0.008
      let silentFrames = 0
      let lastFrameAt = context.currentTime
      setStatus('listening')

      const tick = (): void => {
        if (currentGeneration !== generation || analyser === null) return
        analyser.getFloatTimeDomainData(samples)
        const amplitude = rms(samples)
        const now = context.currentTime
        const capturedAt = now - windowSeconds
        const onset = amplitude > smoothedRms * 1.75 && amplitude > 0.025
        smoothedRms = smoothedRms * 0.9 + amplitude * 0.1

        // Only the coarse path needs its own level meter and its own attacks;
        // with the worklet running, both come from the audio thread instead.
        if (tap === null) {
          const peak = peakOf(samples)
          const floor = fallbackNoiseFloor.push(
            peak,
            Math.max(0.001, now - lastFrameAt),
          )
          setHealth(describeInputHealth(peak, floor))
        }
        lastFrameAt = now

        const detected = detector.detect(samples)
        if (detected.frequency > 0 && detected.clarity >= 0.38) {
          const midi = Math.round(69 + 12 * Math.log2(detected.frequency / 440))
          const label = `${detected.noteName}${detected.octave}`
          setCurrentNote(label)
          setDetectedMidi(midi)
          setClarity(detected.clarity)
          silentFrames = 0

          if (calibrationHits === null) {
            const pitch = {
              midi,
              noteName: label,
              cents: detected.cents,
              clarity: detected.clarity,
            }
            const at = playedAt(capturedAt, micLatencySec())
            const coarseAttack =
              tap === null &&
              onset &&
              (lastCoarseAttackAt === null ||
                lastCoarseAttackMidi !== midi ||
                at - lastCoarseAttackAt >= COARSE_RESTRIKE_DEBOUNCE_SECONDS)
            if (coarseAttack) {
              heldMidi = midi
              lastCoarseAttackAt = at
              lastCoarseAttackMidi = midi
              pushEvent({
                kind: 'attack',
                source: 'microphone',
                at,
                capturedAt,
                level: amplitude,
                pitch,
              })
            } else {
              const attached = attachPitchToLatestAttack(events(), pitch, at)
              if (attached !== events()) {
                setEvents(attached)
                heldMidi = midi
              } else if (heldMidi !== midi) {
                // A note the strike path never claimed: either a legato move, or
                // a pitch change that arrived without a fresh coarse onset.
                heldMidi = midi
                pushEvent({
                  kind: 'pitch-change',
                  source: 'microphone',
                  at,
                  capturedAt,
                  level: amplitude,
                  pitch,
                })
              }
            }
          }
        } else {
          silentFrames += 1
          if (silentFrames >= 3) heldMidi = null
          if (silentFrames >= 6) {
            setCurrentNote(null)
            setDetectedMidi(null)
            setClarity(0)
          }
        }
        frame = requestAnimationFrame(tick)
      }
      frame = requestAnimationFrame(tick)
      return true
    } catch (caught) {
      if (currentGeneration !== generation) return false
      stopNodes()
      micManager.release(CONSUMER_ID)
      const message =
        typeof caught === 'object' &&
        caught !== null &&
        'message' in caught &&
        typeof caught.message === 'string'
          ? caught.message
          : 'Listening could not open this input.'
      setError(message)
      setStatus('error')
      return false
    }
  }

  /**
   * Play a run of clicks out loud and time how long they take to come back.
   * Only works over speakers — on headphones the microphone hears nothing and
   * this says so rather than saving a made-up number.
   */
  const calibrate = async (): Promise<boolean> => {
    if (status() !== 'listening' || tap === null) return false
    const graph = options.getAudioGraph()
    if (graph === null) return false

    const currentGeneration = generation
    const context = graph.context
    const hits: number[] = []
    calibrationHits = hits
    setStatus('calibrating')

    const clickTimes = buildClickSchedule(
      context.currentTime + LATENCY_LEAD_IN_SEC,
      LATENCY_CLICK_COUNT,
      LATENCY_CLICK_INTERVAL_SEC,
    )
    const clicks = clickTimes.map((at) => scheduleCalibrationClick(context, at))

    const runSeconds =
      LATENCY_LEAD_IN_SEC + LATENCY_CLICK_COUNT * LATENCY_CLICK_INTERVAL_SEC
    const completed = await new Promise<boolean>((resolve) => {
      let settled = false
      let timeout = 0

      function cancel(): void {
        finish(false)
      }

      function finish(didComplete: boolean): void {
        if (settled) return
        settled = true
        window.clearTimeout(timeout)
        for (const click of clicks) click.cancel()
        if (cancelCalibrationRun === cancel) cancelCalibrationRun = null
        resolve(didComplete)
      }
      cancelCalibrationRun = cancel
      timeout = window.setTimeout(
        () => finish(true),
        Math.round(runSeconds * 1000) + 400,
      )
    })
    if (!completed || currentGeneration !== generation) return false
    calibrationHits = null
    setStatus('listening')

    // The wizard in @/features/mic-feedback records a buffer and finds its
    // onsets afterwards. Here the worklet has already found them, at the render
    // quantum, so only the matching and the verdict are shared — and they must
    // be, or two places in the app would disagree about the same measurement.
    const deltas = matchOnsetDeltas(clickTimes, hits)
    const result = summariseLatency(deltas, hits.length)
    if (result.latencyMs === null) {
      setError(CALIBRATION_FAILURES[result.failure ?? 'not-heard'])
      return false
    }
    setMicLatencyMs(result.latencyMs)
    setError(null)
    return true
  }

  const clearTake = (): void => {
    setEvents([])
  }

  onCleanup(() => {
    generation += 1
    stopNodes()
    micManager.release(CONSUMER_ID)
  })

  return {
    status,
    error,
    currentNote,
    detectedMidi,
    clarity,
    events,
    observations,
    timingSource,
    latencyMs: micLatencyMs,
    health,
    start,
    stop,
    calibrate,
    clearTake,
  }
}
