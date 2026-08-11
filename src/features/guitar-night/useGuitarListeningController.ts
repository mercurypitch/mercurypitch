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
import type { GuitarInputDeviceOption, GuitarInputProfileKind, GuitarInputProfileSnapshot, } from '@/lib/guitar/guitar-input-profile'
import { guitarInputProfileLabel, loadGuitarAudioInputId, loadGuitarInputProfile, loadGuitarMidiInputId, saveGuitarAudioInputId, saveGuitarInputProfile, saveGuitarMidiInputId, } from '@/lib/guitar/guitar-input-profile'
import type { GuitarMidiNoteMessage, GuitarMidiPort, } from '@/lib/guitar/guitar-midi-input'
import { GuitarMidiInputAdapter, mapMidiTimestampToAudioClock, } from '@/lib/guitar/guitar-midi-input'
import type { GuitarTakeEvent, GuitarTakeRecorder, GuitarTakeSnapshot, } from '@/lib/guitar/guitar-take-recorder'
import { createGuitarTakeRecorder } from '@/lib/guitar/guitar-take-recorder'
import type { GuitarInputCapture, GuitarInputEvent, GuitarInputHealthReading, GuitarInputTimingSource, } from '@/lib/guitar/input-events'
import { attachPitchToLatestAttack, createNoiseFloorFollower, describeInputHealth, frameToSeconds, PITCH_ATTACH_WINDOW_MS, playedAt, } from '@/lib/guitar/input-events'
import type { LatencyFailure } from '@/lib/mic-latency'
import { LATENCY_CLICK_COUNT, LATENCY_CLICK_INTERVAL_SEC, LATENCY_LEAD_IN_SEC, matchOnsetDeltas, summariseLatency, } from '@/lib/mic-latency'
import { listAudioInputs, micManager } from '@/lib/mic-manager'
import { registerMicIndicator } from '@/lib/mic-sentinel'
import { midiToNoteNameOctave } from '@/lib/note-utils'
import { PitchDetector } from '@/lib/pitch-detector'
import { buildClickSchedule } from '@/lib/tap-calibration'
import { micLatencyMsForDevice, micLatencySpreadMsForDevice, setMicLatencyMeasurementForDevice, } from '@/stores/mic-latency-store'
import { buildGuitarTakeEvidenceReport, downloadGuitarInputEvidenceReport, guitarInputEvidenceExportEnabled, } from './guitar-input-evidence-export'

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
export type GuitarTimingSource = GuitarInputTimingSource

export type GuitarMidiConnectionStatus =
  | 'idle'
  | 'requesting'
  | 'ready'
  | 'unavailable'
  | 'error'

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
  droppedEventCount = 0,
): readonly GuitarListeningObservation[] {
  if (events.length === 0) return []
  const attacks = events.filter((event) => event.kind === 'attack')
  const noteEvents = events.filter((event) => event.kind !== 'release')
  const identified = noteEvents.filter((event) => event.pitch !== null)
  const observations: GuitarListeningObservation[] = []

  if (droppedEventCount > 0) {
    observations.push({
      label: 'Take window',
      value: `Latest ${events.length}`,
      detail: `${droppedEventCount} earlier ${droppedEventCount === 1 ? 'event has' : 'events have'} left this memory-only review window.`,
    })
  }

  observations.push({
    label: droppedEventCount > 0 ? 'Recent attacks' : 'Attacks heard',
    value: String(attacks.length),
    detail:
      droppedEventCount > 0
        ? 'Fresh note attacks in the retained review window.'
        : 'Fresh note attacks captured in this take.',
  })

  // Legato moves are real playing and worth showing, but they are not picks
  // and the spacing figures below must not be built from them.
  const legato = events.filter((event) => event.kind === 'pitch-change').length
  if (legato > 0) {
    observations.push({
      label: 'Notes without a pick',
      value: String(legato),
      detail: 'Hammer-ons, pull-offs or slides — heard as pitch changes.',
    })
  }

  if (identified.length < noteEvents.length) {
    observations.push({
      label: 'Notes identified',
      value: `${identified.length} of ${noteEvents.length}`,
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

const MAX_WEB_AUDIO_SPLITTER_CHANNELS = 32

/** Use every channel Web Audio can address, and fail instead of truncating. */
export function guitarInputAnalysisChannelCount(
  reportedChannelCount: number,
  sourceChannelCount: number,
): number {
  const exposed =
    Number.isFinite(reportedChannelCount) && reportedChannelCount > 0
      ? Math.floor(reportedChannelCount)
      : Number.isFinite(sourceChannelCount) && sourceChannelCount > 0
        ? Math.floor(sourceChannelCount)
        : 1
  if (exposed > MAX_WEB_AUDIO_SPLITTER_CHANNELS) {
    throw new Error(
      `This input exposes ${exposed} channels, but this browser can inspect at most ${MAX_WEB_AUDIO_SPLITTER_CHANNELS}. Route the guitar within channels 1–${MAX_WEB_AUDIO_SPLITTER_CHANNELS}.`,
    )
  }
  return Math.max(1, exposed)
}

/** Pick one intact input channel instead of downmixing phase-opposed signals. */
export function strongestGuitarInputChannel(
  windows: readonly Float32Array[],
): number {
  let selected = 0
  let selectedLevel = -1
  for (let index = 0; index < windows.length; index += 1) {
    const window = windows[index]
    if (window === undefined) continue
    const level = rms(window)
    if (level > selectedLevel) {
      selected = index
      selectedLevel = level
    }
  }
  return selected
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
  const [inputProfile, setInputProfileSignal] =
    createSignal<GuitarInputProfileKind>(loadGuitarInputProfile())
  const [audioInputs, setAudioInputs] = createSignal<
    readonly GuitarInputDeviceOption[]
  >([])
  const [selectedAudioInputId, setSelectedAudioInputIdSignal] = createSignal<
    string | null
  >(loadGuitarAudioInputId())
  const [activeAudioInputId, setActiveAudioInputId] = createSignal<
    string | null
  >(null)
  const [midiInputs, setMidiInputs] = createSignal<readonly GuitarMidiPort[]>(
    [],
  )
  const [selectedMidiInputId, setSelectedMidiInputIdSignal] = createSignal<
    string | null
  >(loadGuitarMidiInputId())
  const [midiConnectionStatus, setMidiConnectionStatus] =
    createSignal<GuitarMidiConnectionStatus>('idle')
  const inputProfileLabel = createMemo(() =>
    guitarInputProfileLabel(inputProfile()),
  )
  const [status, setStatus] = createSignal<GuitarListeningStatus>('off')
  const [error, setError] = createSignal<string | null>(null)
  const [notice, setNotice] = createSignal<string | null>(null)
  const [canTakeOverInput, setCanTakeOverInput] = createSignal(false)
  const [inputTakeoverPending, setInputTakeoverPending] = createSignal(false)
  const [currentNote, setCurrentNote] = createSignal<string | null>(null)
  const [detectedMidi, setDetectedMidi] = createSignal<number | null>(null)
  const [clarity, setClarity] = createSignal(0)
  const [take, setTake] = createSignal<GuitarTakeSnapshot | null>(null)
  const evidenceExportEnabled = createMemo(() =>
    guitarInputEvidenceExportEnabled(),
  )
  const canExportEvidence = createMemo(
    () => evidenceExportEnabled() && take() !== null,
  )
  const events = createMemo<readonly GuitarTakeEvent[]>(
    () => take()?.events ?? [],
  )
  const [liveTimingSource, setTimingSource] =
    createSignal<GuitarTimingSource>('frame-loop')
  const timingSource = createMemo<GuitarTimingSource>(
    () => take()?.clock.attack.timingSource ?? liveTimingSource(),
  )
  const latencyMs = createMemo(() =>
    inputProfile() === 'midi'
      ? 0
      : micLatencyMsForDevice(activeAudioInputId() ?? selectedAudioInputId()),
  )
  const [health, setHealth] = createSignal<GuitarInputHealthReading | null>(
    null,
  )
  const observations = createMemo(() =>
    summarizeGuitarListeningEvidence(events(), take()?.droppedEventCount ?? 0),
  )

  let source: MediaStreamAudioSourceNode | null = null
  let pitchAnalysers: AnalyserNode[] = []
  let pitchSplitter: ChannelSplitterNode | null = null
  let tap: GuitarInputTap | null = null
  let frame = 0
  let generation = 0
  let disposed = false
  let heldMidi: number | null = null
  let lastCoarseAttackAt: number | null = null
  let lastCoarseAttackMidi: number | null = null
  let midiRefreshError: string | null = null
  let cancelCalibrationRun: (() => void) | null = null
  let takeRecorder: GuitarTakeRecorder | null = null
  let takeContext: AudioContext | null = null
  let takeLatencySeconds = 0
  let takeStartedAtSeconds = 0
  let scheduledTakeEndSeconds: number | null = null
  let completionTimer = 0
  let completionGeneration = 0
  let takeSequence = 0
  let takeBeforeRecording: GuitarTakeSnapshot | null = null
  let midiAdapter: GuitarMidiInputAdapter | null = null
  let ownsMic = false
  let stoppingInput = false
  let activeInput: GuitarInputProfileSnapshot = {
    kind: inputProfile(),
    requestedDeviceId:
      inputProfile() === 'midi'
        ? selectedMidiInputId()
        : selectedAudioInputId(),
    activeDeviceId: null,
    activeDeviceLabel: null,
  }
  const heldMidiVoices = new Map<string, GuitarMidiNoteMessage>()
  // While a calibration run is going, attacks are evidence about the route,
  // not about the player, and must not land in the take.
  let calibrationHits: number[] | null = null

  const publishTake = (): void => {
    setTake(takeRecorder?.snapshot() ?? null)
  }

  const beginTake = (
    context: AudioContext,
    attackTimingSource: GuitarTimingSource,
    startedAtSeconds = context.currentTime,
  ): void => {
    takeRecorder?.cancel()
    takeSequence += 1
    const measuredLatencyMs =
      activeInput.kind === 'midi'
        ? 0
        : micLatencyMsForDevice(activeInput.activeDeviceId)
    const latencySpreadMs =
      activeInput.kind === 'midi'
        ? null
        : micLatencySpreadMsForDevice(activeInput.activeDeviceId)
    takeLatencySeconds = measuredLatencyMs / 1000
    takeStartedAtSeconds = startedAtSeconds
    scheduledTakeEndSeconds = null
    takeRecorder = createGuitarTakeRecorder({
      takeId: `${CONSUMER_ID}-${takeSequence}`,
      startedAtSeconds,
      sampleRate: context.sampleRate,
      input: activeInput,
      latency: {
        seconds: takeLatencySeconds,
        provenance:
          activeInput.kind === 'midi'
            ? 'midi-route-unmeasured'
            : measuredLatencyMs > 0
              ? 'stored-round-trip'
              : 'none',
        uncertaintySeconds:
          latencySpreadMs === null ? null : latencySpreadMs / 1000,
      },
      attackTimingSource,
      maxEvents: MAX_EVENTS,
    })
    takeContext = context
    publishTake()
  }

  const cancelTake = (): void => {
    takeRecorder?.cancel()
    takeRecorder = null
    takeContext = null
    takeLatencySeconds = 0
    takeStartedAtSeconds = 0
    scheduledTakeEndSeconds = null
    takeBeforeRecording = null
    setTake(null)
  }

  const completeTake = (endedAtSeconds?: number): void => {
    if (takeRecorder === null || takeContext === null) return
    setTake(takeRecorder.complete(endedAtSeconds ?? takeContext.currentTime))
    takeRecorder = null
    takeContext = null
    takeLatencySeconds = 0
    takeStartedAtSeconds = 0
    scheduledTakeEndSeconds = null
    takeBeforeRecording = null
  }

  const pushEvent = (capture: GuitarInputCapture): void => {
    const recorder = takeRecorder
    if (recorder === null) return
    if (recorder.append(capture) !== null) publishTake()
  }

  const observeTakeHealth = (
    reading: GuitarInputHealthReading,
    atSeconds: number,
  ): void => {
    const recorder = takeRecorder
    if (
      recorder === null ||
      atSeconds < takeStartedAtSeconds ||
      (scheduledTakeEndSeconds !== null && atSeconds >= scheduledTakeEndSeconds)
    ) {
      return
    }
    recorder.observeHealth(reading.state)
  }

  const releaseMicHold = (): void => {
    if (!ownsMic) return
    ownsMic = false
    micManager.release(CONSUMER_ID)
  }

  let handleInputLoss: (message: string) => void = () => undefined

  const handleMidiNote = (message: GuitarMidiNoteMessage): void => {
    const context = takeContext
    if (status() !== 'listening' || context === null) return
    const mapped = mapMidiTimestampToAudioClock(
      message.eventTimestampMs,
      message.observedPerformanceMs,
      context.currentTime,
    )
    const noteName = midiToNoteNameOctave(message.midi)
    const pitch = {
      midi: message.midi,
      noteName,
      cents: 0,
      clarity: 1,
    }

    if (message.kind === 'attack') {
      heldMidiVoices.set(message.voiceId, message)
      setCurrentNote(noteName)
      setDetectedMidi(message.midi)
      setClarity(1)
    } else {
      heldMidiVoices.delete(message.voiceId)
      const remaining = [...heldMidiVoices.values()].at(-1)
      setCurrentNote(
        remaining === undefined ? null : midiToNoteNameOctave(remaining.midi),
      )
      setDetectedMidi(remaining?.midi ?? null)
      setClarity(remaining === undefined ? 0 : 1)
    }

    const reading: GuitarInputHealthReading = {
      state: 'good',
      hint: 'MIDI notes are arriving.',
    }
    setHealth(reading)
    observeTakeHealth(reading, mapped.capturedAtSeconds)
    pushEvent({
      kind: message.kind,
      source: 'midi',
      voiceId: message.voiceId,
      level: message.velocity / 127,
      pitch,
      clock: {
        kind: 'web-midi',
        eventTimestampMs: mapped.eventTimestampMs,
        observedPerformanceMs: mapped.observedPerformanceMs,
        mappedAudioTime: mapped.capturedAtSeconds,
        inputId: message.inputId,
        channel: message.channel,
      },
    })
  }

  const ensureMidiAdapter = (): GuitarMidiInputAdapter => {
    if (midiAdapter !== null) return midiAdapter
    midiAdapter = new GuitarMidiInputAdapter({
      onNote: handleMidiNote,
      onPortsChanged: (ports, activePortId) => {
        setMidiInputs(ports)
        if (activePortId !== null && selectedMidiInputId() === null) {
          setSelectedMidiInputIdSignal(activePortId)
          saveGuitarMidiInputId(activePortId)
        }
        if (
          !stoppingInput &&
          status() === 'listening' &&
          inputProfile() === 'midi' &&
          activePortId === null
        ) {
          handleInputLoss('The selected MIDI input disconnected.')
        }
      },
    })
    midiAdapter.selectPort(selectedMidiInputId())
    return midiAdapter
  }

  const refreshAudioInputs = async (): Promise<void> => {
    try {
      const devices = await listAudioInputs()
      setAudioInputs(
        devices.map((device, index) => ({
          id: device.deviceId,
          label: device.label.trim() || `Audio input ${index + 1}`,
        })),
      )
    } catch {
      setAudioInputs([])
    }
  }

  const refreshMidiInputs = async (): Promise<boolean> => {
    setMidiConnectionStatus('requesting')
    try {
      const adapter = ensureMidiAdapter()
      const ports = await adapter.connect()
      adapter.selectPort(selectedMidiInputId())
      setMidiInputs(ports)
      const ready = adapter.selectedPortId() !== null
      setMidiConnectionStatus(ready ? 'ready' : 'unavailable')
      if (midiRefreshError !== null && error() === midiRefreshError) {
        setError(null)
      }
      midiRefreshError = null
      return ready
    } catch (caught) {
      setMidiConnectionStatus('error')
      if (inputProfile() === 'midi') {
        const message =
          caught instanceof Error
            ? caught.message
            : 'MIDI input could not open in this browser.'
        midiRefreshError = message
        setError(message)
      }
      return false
    }
  }

  const stopNodes = (): void => {
    stoppingInput = true
    completionGeneration += 1
    if (completionTimer !== 0) window.clearTimeout(completionTimer)
    completionTimer = 0
    cancelCalibrationRun?.()
    cancelCalibrationRun = null
    if (frame !== 0) cancelAnimationFrame(frame)
    frame = 0
    tap?.dispose()
    tap = null
    source?.disconnect()
    for (const channelAnalyser of pitchAnalysers) {
      channelAnalyser.disconnect()
    }
    pitchSplitter?.disconnect()
    source = null
    pitchAnalysers = []
    pitchSplitter = null
    midiAdapter?.disconnect()
    midiAdapter = null
    heldMidiVoices.clear()
    heldMidi = null
    lastCoarseAttackAt = null
    lastCoarseAttackMidi = null
    calibrationHits = null
    stoppingInput = false
  }

  const stop = (): void => {
    generation += 1
    completeTake()
    stopNodes()
    releaseMicHold()
    setStatus('off')
    setCurrentNote(null)
    setDetectedMidi(null)
    setClarity(0)
    setHealth(null)
    setCanTakeOverInput(false)
    setNotice(null)
    setTimingSource('frame-loop')
  }

  /** Abort an unopened assessment and restore the last finished review. */
  const cancel = (options: { preserveNotice?: boolean } = {}): void => {
    generation += 1
    takeRecorder?.cancel()
    takeRecorder = null
    takeContext = null
    takeLatencySeconds = 0
    takeStartedAtSeconds = 0
    scheduledTakeEndSeconds = null
    setTake(takeBeforeRecording)
    takeBeforeRecording = null
    stopNodes()
    releaseMicHold()
    setStatus('off')
    setCurrentNote(null)
    setDetectedMidi(null)
    setClarity(0)
    setHealth(null)
    setCanTakeOverInput(false)
    if (options.preserveNotice !== true) setNotice(null)
    setTimingSource('frame-loop')
  }

  /**
   * Re-anchor the live input to an exact scheduled score boundary. The start
   * may be in the near future; the recorder will discard count-in evidence.
   */
  const armTakeAt = (startedAtSeconds: number): boolean => {
    if (
      takeContext === null ||
      !Number.isFinite(startedAtSeconds) ||
      startedAtSeconds < 0 ||
      status() !== 'listening'
    ) {
      return false
    }
    completionGeneration += 1
    if (completionTimer !== 0) window.clearTimeout(completionTimer)
    completionTimer = 0
    beginTake(takeContext, liveTimingSource(), startedAtSeconds)
    return true
  }

  /**
   * Keep analysis alive just long enough to attach the final pitch reading,
   * then close the take at the scheduler's exact end rather than at callback
   * delivery time.
   */
  const completeTakeAt = (endedAtSeconds: number): boolean => {
    const context = takeContext
    if (
      context === null ||
      takeRecorder === null ||
      !Number.isFinite(endedAtSeconds) ||
      endedAtSeconds < takeStartedAtSeconds
    ) {
      return false
    }
    if (completionTimer !== 0) window.clearTimeout(completionTimer)
    scheduledTakeEndSeconds = endedAtSeconds
    const currentGeneration = generation
    const currentCompletion = ++completionGeneration
    const settleSeconds = (PITCH_ATTACH_WINDOW_MS + 30) / 1000
    const delayMs = Math.max(
      0,
      (endedAtSeconds + settleSeconds - context.currentTime) * 1000,
    )
    completionTimer = window.setTimeout(() => {
      completionTimer = 0
      if (
        currentGeneration !== generation ||
        currentCompletion !== completionGeneration
      ) {
        return
      }
      generation += 1
      completeTake(endedAtSeconds)
      stopNodes()
      releaseMicHold()
      setStatus('off')
      setCurrentNote(null)
      setDetectedMidi(null)
      setClarity(0)
      setHealth(null)
      setNotice(null)
      setTimingSource('frame-loop')
    }, delayMs)
    return true
  }

  handleInputLoss = (message: string): void => {
    if (stoppingInput || status() === 'off' || status() === 'error') {
      return
    }
    generation += 1
    completeTake()
    stopNodes()
    releaseMicHold()
    setCurrentNote(null)
    setDetectedMidi(null)
    setClarity(0)
    setHealth(null)
    setNotice(null)
    setError(message)
    setCanTakeOverInput(false)
    setStatus('error')
  }

  onCleanup(
    micManager.registerRunGuard(`${CONSUMER_ID}-take`, () => {
      const snapshot = takeRecorder?.snapshot()
      return (
        ownsMic &&
        snapshot?.lifecycle === 'recording' &&
        inputProfile() !== 'midi'
      )
    }),
  )

  onCleanup(
    micManager.subscribe((state) => {
      if (!ownsMic || stoppingInput || state.active) return
      handleInputLoss(
        state.error?.message ?? 'The selected audio input disconnected.',
      )
    }),
  )

  // Watchdog registration (repo rule: every mic surface registers): the
  // room's Listening chip reads this status — a confirmed icon-on with no
  // live track heals through the surface's own stop path.
  onCleanup(
    registerMicIndicator(
      CONSUMER_ID,
      // Deliberately non-reactive: the sentinel polls these accessors on
      // its own low-frequency interval — no tracked scope involved.
      // eslint-disable-next-line solid/reactivity
      () =>
        inputProfile() !== 'midi' && status() !== 'off' && status() !== 'error',

      () => stop(),
    ),
  )

  const selectInputProfile = async (
    kind: GuitarInputProfileKind,
  ): Promise<void> => {
    if (inputProfile() === kind) {
      if (kind === 'midi') await refreshMidiInputs()
      else await refreshAudioInputs()
      return
    }
    // Route changes invalidate an in-flight cross-tab handoff. If that handoff
    // later succeeds, its generation guard gives the unused lock back instead
    // of opening whichever new route happens to be selected by then.
    generation += 1
    if (status() !== 'off' && status() !== 'error') stop()
    else if (midiAdapter !== null) stopNodes()
    setActiveAudioInputId(null)
    setInputProfileSignal(kind)
    saveGuitarInputProfile(kind)
    setError(null)
    setNotice(null)
    setHealth(null)
    setTimingSource(kind === 'midi' ? 'midi-clock' : 'frame-loop')
    if (kind === 'midi') await refreshMidiInputs()
    else await refreshAudioInputs()
  }

  const selectAudioInput = async (deviceId: string | null): Promise<void> => {
    generation += 1
    if (status() !== 'off' && status() !== 'error') stop()
    const next = deviceId !== null && deviceId.length > 0 ? deviceId : null
    setActiveAudioInputId(null)
    setSelectedAudioInputIdSignal(next)
    saveGuitarAudioInputId(next)
    setError(null)
    setNotice(null)
    await micManager.setPreferredDevice(next)
    await refreshAudioInputs()
  }

  const selectMidiInput = async (deviceId: string | null): Promise<void> => {
    generation += 1
    if (status() !== 'off' && status() !== 'error') stop()
    const next = deviceId !== null && deviceId.length > 0 ? deviceId : null
    setSelectedMidiInputIdSignal(next)
    saveGuitarMidiInputId(next)
    const adapter = ensureMidiAdapter()
    const selected = adapter.selectPort(next)
    setMidiConnectionStatus(selected ? 'ready' : 'unavailable')
    setError(null)
    setNotice(null)
    if (!selected) await refreshMidiInputs()
  }

  const start = async (): Promise<boolean> => {
    if (disposed) return false
    if (status() !== 'off' && status() !== 'error') return true
    generation += 1
    const currentGeneration = generation
    const previousTake = take()
    const requestedProfile = inputProfile()
    stopNodes()
    setActiveAudioInputId(null)
    setError(null)
    setNotice(null)
    setCanTakeOverInput(false)
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
      const context = graph.context

      if (requestedProfile === 'midi') {
        if (!(await refreshMidiInputs()) || currentGeneration !== generation) {
          throw new Error(
            midiConnectionStatus() === 'error'
              ? (error() ?? 'MIDI input could not open.')
              : 'No selected MIDI input is connected.',
          )
        }
        const activePortId = midiAdapter?.selectedPortId() ?? null
        const activePort = midiInputs().find((port) => port.id === activePortId)
        activeInput = {
          kind: 'midi',
          requestedDeviceId: selectedMidiInputId(),
          activeDeviceId: activePortId,
          activeDeviceLabel: activePort?.label ?? null,
        }
        setActiveAudioInputId(null)
        setTimingSource('midi-clock')
        takeBeforeRecording =
          previousTake?.lifecycle === 'completed' ? previousTake : null
        beginTake(context, 'midi-clock')
        setHealth({ state: 'good', hint: 'MIDI input is ready.' })
        setStatus('listening')
        return true
      }

      const requestedDeviceId = selectedAudioInputId()
      await micManager.setPreferredDevice(requestedDeviceId)
      const stream = await micManager.acquire(CONSUMER_ID)
      ownsMic = true
      if (currentGeneration !== generation) {
        releaseMicHold()
        return false
      }

      await refreshAudioInputs()
      const track = stream.getAudioTracks?.()[0]
      const reportedDeviceId = track?.getSettings?.().deviceId?.trim()
      const actualDeviceId =
        reportedDeviceId !== undefined && reportedDeviceId.length > 0
          ? reportedDeviceId
          : null
      const activeDevice = audioInputs().find(
        (device) => device.id === actualDeviceId,
      )
      const reportedDeviceLabel = track?.label?.trim()
      const listedDeviceLabel = activeDevice?.label.trim()
      const activeDeviceLabel =
        reportedDeviceLabel !== undefined && reportedDeviceLabel.length > 0
          ? reportedDeviceLabel
          : listedDeviceLabel !== undefined && listedDeviceLabel.length > 0
            ? listedDeviceLabel
            : null
      activeInput = {
        kind: requestedProfile,
        requestedDeviceId,
        activeDeviceId: actualDeviceId,
        activeDeviceLabel,
      }
      setActiveAudioInputId(actualDeviceId)
      if (requestedDeviceId !== null && actualDeviceId !== requestedDeviceId) {
        setSelectedAudioInputIdSignal(actualDeviceId)
        saveGuitarAudioInputId(actualDeviceId)
        setNotice(
          actualDeviceId === null
            ? 'The browser opened an input but did not identify which one.'
            : `The saved input is unavailable. Listening through ${activeDeviceLabel ?? 'the system default'}.`,
        )
      }

      const nextSource = context.createMediaStreamSource(stream)
      const reportedChannelCount = Number(track?.getSettings?.().channelCount)
      const sourceChannelCount = Number(nextSource.channelCount)
      const channelCount = guitarInputAnalysisChannelCount(
        reportedChannelCount,
        sourceChannelCount,
      )
      const nextPitchAnalysers = Array.from({ length: channelCount }, () => {
        const channelAnalyser = context.createAnalyser()
        channelAnalyser.fftSize = ANALYSER_SIZE
        channelAnalyser.smoothingTimeConstant = 0
        return channelAnalyser
      })
      const canSplitChannels =
        channelCount > 1 && typeof context.createChannelSplitter === 'function'
      if (canSplitChannels) {
        const splitter = context.createChannelSplitter(channelCount)
        nextSource.connect(splitter)
        nextPitchAnalysers.forEach((channelAnalyser, channel) => {
          splitter.connect(channelAnalyser, channel)
        })
        pitchSplitter = splitter
      } else {
        nextSource.connect(nextPitchAnalysers[0])
      }
      source = nextSource
      pitchAnalysers = nextPitchAnalysers

      // Messages arrive from the audio thread, not from a tracked scope. Keep
      // their exact frame evidence intact; the recorder applies the one
      // latency snapshot pinned when this take begins.

      tap = await connectGuitarInputWorklet(context, nextSource, (message) => {
        if (currentGeneration !== generation) return
        if (message.type === 'level') {
          const reading = describeInputHealth(message.peak, message.noiseFloor)
          setHealth(reading)
          observeTakeHealth(
            reading,
            playedAt(
              frameToSeconds(message.atFrame, context.sampleRate),
              takeLatencySeconds,
            ),
          )
          return
        }
        const capturedAt = frameToSeconds(message.atFrame, context.sampleRate)
        if (calibrationHits !== null) {
          calibrationHits.push(capturedAt)
          return
        }
        pushEvent({
          kind: 'attack',
          source: requestedProfile,
          voiceId: null,
          level: message.level,
          clock: {
            kind: 'audio-worklet',
            atFrame: message.atFrame,
            sampleRate: context.sampleRate,
          },
          pitch: null,
        })
      })
      if (currentGeneration !== generation) {
        stopNodes()
        releaseMicHold()
        return false
      }
      const nextTimingSource = tap === null ? 'frame-loop' : 'audio-clock'
      setTimingSource(nextTimingSource)
      takeBeforeRecording =
        previousTake?.lifecycle === 'completed' ? previousTake : null
      beginTake(context, nextTimingSource)

      const channelSamples = nextPitchAnalysers.map(
        (channelAnalyser) => new Float32Array(channelAnalyser.fftSize),
      )
      // How far back the analyser's window reaches. A note named from it began
      // at least this long ago, which is what the strike it belongs to knows.
      const windowSeconds = ANALYSER_SIZE / context.sampleRate
      const detector = new PitchDetector({
        algorithm: 'mpm',
        sampleRate: context.sampleRate,
        bufferSize: ANALYSER_SIZE,
        minFrequency: 55,
        maxFrequency: 1600,
        minConfidence: 0.38,
        minAmplitude: 0.018,
      })
      const fallbackNoiseFloor = createNoiseFloorFollower()
      let smoothedRms = 0.008
      let silentFrames = 0
      let uncertainFrames = 0
      let lastFrameAt = context.currentTime
      setStatus('listening')

      const tick = (): void => {
        if (currentGeneration !== generation || pitchAnalysers.length === 0) {
          return
        }
        nextPitchAnalysers.forEach((channelAnalyser, channel) => {
          const samples = channelSamples[channel]
          if (samples !== undefined) {
            channelAnalyser.getFloatTimeDomainData(samples)
          }
        })
        const samples =
          channelSamples[strongestGuitarInputChannel(channelSamples)] ??
          channelSamples[0]
        if (samples === undefined) return
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
          const reading = describeInputHealth(peak, floor)
          setHealth(reading)
          observeTakeHealth(reading, playedAt(now, takeLatencySeconds))
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
          uncertainFrames = 0

          if (calibrationHits === null) {
            const pitch = {
              midi,
              noteName: label,
              cents: detected.cents,
              clarity: detected.clarity,
            }
            const at = playedAt(capturedAt, takeLatencySeconds)
            const frameClock = {
              kind: 'frame-loop' as const,
              observedAt: now,
              windowStartAt: capturedAt,
              sampleRate: context.sampleRate,
              windowFrames: ANALYSER_SIZE,
            }
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
                source: requestedProfile,
                voiceId: null,
                level: amplitude,
                clock: frameClock,
                pitch,
              })
            } else {
              const currentEvents = events()
              const attached = attachPitchToLatestAttack(
                currentEvents,
                pitch,
                at,
              )
              if (attached !== currentEvents) {
                const enriched = attached.findLast(
                  (event) => event.kind === 'attack',
                )
                const recorder = takeRecorder
                if (
                  enriched !== undefined &&
                  recorder !== null &&
                  recorder.replace(enriched.id, enriched) !== null
                ) {
                  publishTake()
                }
                heldMidi = midi
              } else if (heldMidi !== midi) {
                // A note the strike path never claimed: either a legato move, or
                // a pitch change that arrived without a fresh coarse onset.
                heldMidi = midi
                pushEvent({
                  kind: 'pitch-change',
                  source: requestedProfile,
                  voiceId: null,
                  level: amplitude,
                  clock: frameClock,
                  pitch,
                })
              }
            }
          }
        } else {
          silentFrames += 1
          if (amplitude >= 0.025 && calibrationHits === null) {
            uncertainFrames += 1
            const currentHealth = health()?.state
            if (
              uncertainFrames === 3 &&
              currentHealth !== 'clipping' &&
              currentHealth !== 'hot' &&
              currentHealth !== 'noisy'
            ) {
              const reading: GuitarInputHealthReading = {
                state: 'uncertain',
                hint: 'Signal is present, but the note is not stable enough to name.',
              }
              setHealth(reading)
              observeTakeHealth(
                reading,
                playedAt(capturedAt, takeLatencySeconds),
              )
            }
          } else {
            uncertainFrames = 0
          }
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
      takeRecorder?.cancel()
      takeRecorder = null
      takeContext = null
      takeLatencySeconds = 0
      takeStartedAtSeconds = 0
      scheduledTakeEndSeconds = null
      takeBeforeRecording = null
      setTake(previousTake)
      stopNodes()
      releaseMicHold()
      setNotice(null)
      const message =
        typeof caught === 'object' &&
        caught !== null &&
        'message' in caught &&
        typeof caught.message === 'string'
          ? caught.message
          : 'Listening could not open this input.'
      setCanTakeOverInput(micManager.getError()?.kind === 'held-elsewhere')
      setError(message)
      setStatus('error')
      return false
    }
  }

  const useInputHere = async (): Promise<boolean> => {
    if (!canTakeOverInput() || inputTakeoverPending()) return false
    const takeoverGeneration = generation
    setInputTakeoverPending(true)
    try {
      const moved = await micManager.takeOverFromOtherTab()
      if (disposed || takeoverGeneration !== generation) {
        if (moved) await micManager.releaseTakeoverIfUnused()
        return false
      }
      if (!moved) {
        setError('The other tab is still using this input.')
        return false
      }
      setCanTakeOverInput(false)
      setStatus('off')
      const started = await start()
      if (!started) await micManager.releaseTakeoverIfUnused()
      return started
    } finally {
      if (!disposed) setInputTakeoverPending(false)
    }
  }

  const exportEvidenceReport = (): boolean => {
    // The public take signal updates on events and completion. Read the
    // recorder directly here as well so a mid-take export includes the latest
    // aggregate health counts without publishing frame-rate snapshots to UI.
    const snapshot = takeRecorder?.snapshot() ?? take()
    if (snapshot === null || !evidenceExportEnabled()) return false
    return downloadGuitarInputEvidenceReport(
      buildGuitarTakeEvidenceReport(snapshot),
    )
  }

  /**
   * Play a run of clicks out loud and time how long they take to come back.
   * Only works over speakers — on headphones the microphone hears nothing and
   * this says so rather than saving a made-up number.
   */
  const calibrate = async (): Promise<boolean> => {
    if (
      status() !== 'listening' ||
      tap === null ||
      inputProfile() !== 'microphone'
    ) {
      return false
    }
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
      setNotice(CALIBRATION_FAILURES[result.failure ?? 'not-heard'])
      return false
    }
    setMicLatencyMeasurementForDevice(
      activeInput.activeDeviceId,
      result.latencyMs,
      result.spreadMs,
    )
    // A calibration changes the meaning of player time. Start a clean take at
    // this exact audio-clock position so no result window can mix the old and
    // new correction while the UI already describes the new route value.
    beginTake(context, liveTimingSource())
    setError(null)
    setNotice(null)
    return true
  }

  const clearTake = (): void => {
    const context = takeContext
    const currentStatus = status()
    if (
      context !== null &&
      (currentStatus === 'listening' || currentStatus === 'calibrating')
    ) {
      beginTake(context, liveTimingSource())
      return
    }
    cancelTake()
  }

  onCleanup(() => {
    disposed = true
    generation += 1
    cancelTake()
    stopNodes()
    releaseMicHold()
  })

  return {
    status,
    error,
    notice,
    canTakeOverInput,
    inputTakeoverPending,
    currentNote,
    detectedMidi,
    clarity,
    take,
    evidenceExportEnabled,
    canExportEvidence,
    events,
    observations,
    inputProfile,
    inputProfileLabel,
    audioInputs,
    selectedAudioInputId,
    midiInputs,
    selectedMidiInputId,
    midiConnectionStatus,
    timingSource,
    latencyMs,
    health,
    selectInputProfile,
    selectAudioInput,
    selectMidiInput,
    refreshAudioInputs,
    refreshMidiInputs,
    start,
    useInputHere,
    exportEvidenceReport,
    stop,
    cancel,
    armTakeAt,
    completeTakeAt,
    calibrate,
    clearTake,
  }
}
