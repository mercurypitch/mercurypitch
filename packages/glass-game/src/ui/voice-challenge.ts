// Voice challenge session — one microphone generation owns calibration, references and scoring.

import type { BreakableDefinition, ChallengeDefinition, GameEvent, GlassGame, LevelDefinition, PitchObservation, PitchTargetId, PitchTargets, } from '../contracts'
import { createChallengeJudge } from '../core/challenge'
import type { GlassGameHost, GlassSound, GlassVoiceSession } from '../host'
import type { MicrophoneIssue } from './mic-error'
import { microphoneIssue } from './mic-error'

export type VoiceChallengeMode =
  | 'off'
  | 'permission'
  | 'finding'
  | 'reference'
  | 'singing'

export interface VoiceChallengeSnapshot {
  mode: VoiceChallengeMode
  pitch: number | null
  target: number | null
  encounterId: string | null
  findingTarget: PitchTargetId | null
  message: string
  hint: string
  pair: boolean
  stepIndex: number
  stepCount: number
  stepCharge: number
  targets: PitchTargets
}

interface VoiceChallengeOptions {
  host: Pick<
    GlassGameHost,
    'createVoice' | 'createSound' | 'readPreference' | 'writePreference'
  >
  game: GlassGame
  level: LevelDefinition
  canPlay(): boolean
  beforeCapture(): Promise<void>
  onChange(snapshot: VoiceChallengeSnapshot): void
  onEvents(events: GameEvent[]): void
  onError(message: string, microphone?: MicrophoneIssue): void
  onPauseAudio(): void
  onReleaseVoice(): void
  now?: () => number
}

export interface VoiceChallengeController {
  snapshot(): VoiceChallengeSnapshot
  start(encounterId: string): Promise<void>
  replay(): Promise<void>
  refind(): void
  cancel(): void
  completeBreak(): void
  dispose(): void
}

interface PairCalibration {
  version: 1
  low: number
  high?: number
}

const PAIR_PREFERENCE = 'comfortable-pair'
const CALIBRATION_VERSION = 1
const MIN_MIDI = 36
const MAX_MIDI = 84
const CONFIDENCE_FLOOR = 0.5
const MAXIMUM_SAMPLE_AGE_MS = 150
const MAXIMUM_SAMPLE_GAP_SECONDS = 0.1
const MAXIMUM_CALIBRATION_DRIFT = 0.8
const MINIMUM_CALIBRATION_SAMPLES = 12
const MINIMUM_CALIBRATION_SECONDS = 0.45

function validMidi(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= MIN_MIDI &&
    value <= MAX_MIDI
  )
}

function readComfortable(host: VoiceChallengeOptions['host']): number | null {
  const midi = Number(host.readPreference('comfortable-note') ?? '')
  return validMidi(midi) ? midi : null
}

function readPair(raw: string | null): PairCalibration | null {
  if (raw === null || raw === '') return null
  try {
    const value = JSON.parse(raw) as Partial<PairCalibration>
    if (value.version !== CALIBRATION_VERSION || !validMidi(value.low))
      return null
    if (value.high === undefined)
      return { version: CALIBRATION_VERSION, low: value.low }
    if (!validMidi(value.high) || value.high <= value.low) return null
    return {
      version: CALIBRATION_VERSION,
      low: value.low,
      high: value.high,
    }
  } catch {
    return null
  }
}

function steps(definition: ChallengeDefinition) {
  return definition.kind === 'ordered-pair'
    ? definition.steps
    : [definition.step]
}

function pairTolerances(level: LevelDefinition): {
  low: number
  high: number
} {
  let low = 0
  let high = 0
  for (const breakable of level.breakables)
    for (const step of steps(breakable.challenge)) {
      if (step.target === 'low') low = Math.max(low, step.hold.toleranceCents)
      else if (step.target === 'high')
        high = Math.max(high, step.hold.toleranceCents)
    }
  return { low, high }
}

function pairIsDistinct(
  low: number,
  high: number,
  tolerance: { low: number; high: number },
): boolean {
  return high > low && (high - low) * 100 > tolerance.low + tolerance.high
}

function copyTargets(targets: PitchTargets): PitchTargets {
  return { ...targets }
}

function isPairChallenge(definition: ChallengeDefinition): boolean {
  return (
    definition.kind === 'ordered-pair' ||
    steps(definition).some(
      (step) => step.target === 'low' || step.target === 'high',
    )
  )
}

function targetCopy(target: PitchTargetId): string {
  if (target === 'low') return 'the lower note'
  if (target === 'high') return 'the higher note'
  return 'your note'
}

function calibrationQueue(
  definition: ChallengeDefinition,
  targets: PitchTargets,
): PitchTargetId[] {
  const required = new Set(steps(definition).map((step) => step.target))
  const queue: PitchTargetId[] = []
  if (required.has('comfortable') && targets.comfortable === undefined)
    queue.push('comfortable')
  if (
    (required.has('low') || required.has('high')) &&
    targets.low === undefined
  )
    queue.push('low')
  if (required.has('high') && targets.high === undefined) queue.push('high')
  return queue
}

function findingCopy(target: PitchTargetId): { message: string; hint: string } {
  if (target === 'low')
    return {
      message: 'Hum low, gently.',
      hint: 'Choose an easy note in the lower part of your voice and hold it steady.',
    }
  if (target === 'high')
    return {
      message: 'Hum higher, gently.',
      hint: 'Choose an easy higher note that sounds clearly different. Stay comfortable; never strain.',
    }
  return {
    message: 'Hum an easy note.',
    hint: 'Keep it easy and steady. No need to be loud.',
  }
}

function referenceCopy(definition: ChallengeDefinition): {
  message: string
  hint: string
} {
  if (definition.kind === 'settle-wave')
    return {
      message: 'Listen first.',
      hint: `Hear ${definition.wave.requiredCycles} gentle waves above and below the note, then a return to the middle. Your turn begins after it is quiet.`,
    }
  return definition.kind === 'ordered-pair'
    ? {
        message: 'Listen first.',
        hint: 'Your turn begins after the second note becomes quiet.',
      }
    : {
        message: 'Listen first.',
        hint: 'Your turn begins when the reference becomes quiet.',
      }
}

function singingCopy(definition: ChallengeDefinition): {
  message: string
  hint: string
} {
  if (definition.kind === 'settle-wave')
    return {
      message: 'Hold your note.',
      hint: 'Begin with a comfortable steady hum. Then we will let it sway gently.',
    }
  if (definition.kind === 'ordered-pair') {
    const [first, second] = definition.steps
    return {
      message: `Sing ${first.target}, then ${second.target}.`,
      hint: 'Let the first note settle, then move to the second. Pause for a breath whenever you need.',
    }
  }
  return {
    message: 'Hold it gently.',
    hint: 'A steady hum works. No need to be loud.',
  }
}

export function createVoiceChallenge(
  options: VoiceChallengeOptions,
): VoiceChallengeController {
  const now = options.now ?? (() => performance.now())
  const tolerances = pairTolerances(options.level)
  let comfortable = readComfortable(options.host)
  const storedPair = options.host.readPreference(PAIR_PREFERENCE)
  let pair = readPair(storedPair)
  if (storedPair !== null && storedPair !== '' && pair === null)
    options.host.writePreference(PAIR_PREFERENCE, '')
  if (
    pair?.high !== undefined &&
    !pairIsDistinct(pair.low, pair.high, tolerances)
  ) {
    pair = { version: CALIBRATION_VERSION, low: pair.low }
    options.host.writePreference(PAIR_PREFERENCE, JSON.stringify(pair))
  }
  let state: VoiceChallengeSnapshot = {
    mode: 'off',
    pitch: null,
    target: comfortable,
    encounterId: null,
    findingTarget: null,
    message: '',
    hint: '',
    pair: false,
    stepIndex: 0,
    stepCount: 1,
    stepCharge: 0,
    targets: comfortable === null ? {} : { comfortable },
  }
  let disposed = false
  let generation = 0
  let voice: GlassVoiceSession | null = null
  let stopObserving: (() => void) | null = null
  let sound: GlassSound | null = null
  let soundTimer: ReturnType<typeof setTimeout> | undefined
  let current: BreakableDefinition | null = null
  let targets: PitchTargets = {}
  let queue: PitchTargetId[] = []
  let samples: PitchObservation[] = []
  let lastSequence = -Infinity
  let lastCaptureSeconds = -Infinity
  let evidenceCapturedAfterMs = -Infinity

  const emit = (patch: Partial<VoiceChallengeSnapshot> = {}): void => {
    state = { ...state, ...patch, targets: copyTargets(targets) }
    options.onChange(state)
  }

  const resetEvidence = (): void => {
    samples = []
    lastSequence = -Infinity
    lastCaptureSeconds = -Infinity
  }

  const stopCapture = (): void => {
    generation++
    stopObserving?.()
    stopObserving = null
    voice?.stop()
    voice = null
    resetEvidence()
    options.onReleaseVoice()
    emit({
      mode: 'off',
      pitch: null,
      encounterId: null,
      findingTarget: null,
      message: '',
      hint: '',
      pair: false,
      stepIndex: 0,
      stepCount: 1,
      stepCharge: 0,
      target: comfortable,
    })
  }

  const stopSound = (): void => {
    clearTimeout(soundTimer)
    soundTimer = undefined
    sound?.dispose()
    sound = null
  }

  const cancel = (): void => {
    stopCapture()
    stopSound()
    current = null
    queue = []
    options.game.cancelEncounter()
    if (!disposed && options.canPlay()) options.game.setPaused(false)
  }

  const fail = (message: string, microphone?: MicrophoneIssue): void => {
    options.onPauseAudio()
    cancel()
    if (!disposed) options.onError(message, microphone)
  }

  const syncProgress = (): void => {
    const active = options.game.snapshot().activeEncounter
    if (active === null || state.mode === 'off') return
    emit({
      target: active.targetMidi,
      stepIndex: active.stepIndex,
      stepCount: active.stepCount,
      stepCharge: active.stepCharge,
    })
  }

  const writePair = (): void => {
    if (pair === null) options.host.writePreference(PAIR_PREFERENCE, '')
    else options.host.writePreference(PAIR_PREFERENCE, JSON.stringify(pair))
  }

  const prepareTargets = (definition: ChallengeDefinition): void => {
    targets = {}
    if (comfortable !== null) targets = { comfortable }
    if (pair !== null) {
      targets = { ...targets, low: pair.low }
      if (pair.high !== undefined) targets = { ...targets, high: pair.high }
    }
    queue = calibrationQueue(definition, targets)
  }

  const startFinding = (target: PitchTargetId): void => {
    samples = []
    const copy = findingCopy(target)
    emit({
      mode: 'finding',
      findingTarget: target,
      target: targets[target] ?? null,
      message: copy.message,
      hint: copy.hint,
    })
  }

  const playReferences = async (run: number): Promise<void> => {
    if (current === null || sound === null) return
    const definition = current.challenge
    const reference = referenceCopy(definition)
    emit({
      mode: 'reference',
      findingTarget: null,
      message: reference.message,
      hint: reference.hint,
    })
    try {
      for (const step of steps(definition)) {
        const midi = targets[step.target]
        if (midi === undefined)
          throw new Error('The calibrated note is unavailable.')
        emit({ target: midi })
        if (definition.kind === 'settle-wave')
          await sound.reference(
            midi,
            'gentle-wave',
            definition.wave.requiredCycles,
          )
        else await sound.reference(midi)
        if (disposed || run !== generation) return
      }
      if (disposed || run !== generation) return
      evidenceCapturedAfterMs = now()
      const latest = voice?.latest(evidenceCapturedAfterMs)
      if (latest !== null && latest !== undefined) {
        lastSequence = Math.max(lastSequence, latest.sequence)
        lastCaptureSeconds = Math.max(lastCaptureSeconds, latest.captureSeconds)
      }
      const singing = singingCopy(definition)
      emit({
        mode: 'singing',
        message: singing.message,
        hint: singing.hint,
      })
      syncProgress()
    } catch {
      if (disposed || run !== generation) return
      fail(
        'The reference note could not play. Tap Sing to try again when audio is available.',
      )
    }
  }

  const beginChallenge = async (run: number): Promise<void> => {
    if (current === null || disposed || run !== generation) return
    const resolved = createChallengeJudge(current.challenge, targets)
    if (!resolved.ok) {
      if (resolved.reason === 'ambiguous-targets') {
        if (pair !== null) {
          pair = { version: CALIBRATION_VERSION, low: pair.low }
          writePair()
          targets = { ...targets, high: undefined }
        }
        queue = ['high']
        startFinding('high')
        return
      }
      fail('Your saved note is unavailable. Tap Sing and find it again.')
      return
    }
    if (!options.canPlay()) {
      cancel()
      return
    }
    options.game.setPaused(false)
    if (!options.game.beginEncounter(current.id, targets)) {
      fail(
        'That exhibit is no longer ready. Step back onto its glowing circle.',
      )
      return
    }
    syncProgress()
    await playReferences(run)
  }

  const advanceCalibration = async (run: number): Promise<void> => {
    if (current === null || disposed || run !== generation) return
    const next = queue.shift()
    if (next !== undefined) {
      startFinding(next)
      return
    }
    await beginChallenge(run)
  }

  const acceptCalibration = (target: PitchTargetId, midi: number): boolean => {
    if (target === 'comfortable') {
      comfortable = midi
      targets = { ...targets, comfortable: midi }
      options.host.writePreference('comfortable-note', String(midi))
      return true
    }
    if (target === 'low') {
      pair = { version: CALIBRATION_VERSION, low: midi }
      targets = { ...targets, low: midi, high: undefined }
      writePair()
      return true
    }
    const low = targets.low
    if (low === undefined || !pairIsDistinct(low, midi, tolerances)) {
      const copy = findingCopy('high')
      emit({
        message: 'Try a higher note.',
        hint: copy.hint,
        target: null,
      })
      return false
    }
    pair = { version: CALIBRATION_VERSION, low, high: midi }
    targets = { ...targets, high: midi }
    writePair()
    return true
  }

  const observe = (
    observation: PitchObservation,
    observedAtMs: number,
  ): void => {
    if (
      disposed ||
      !Number.isFinite(observation.sequence) ||
      !Number.isFinite(observation.captureSeconds) ||
      !Number.isFinite(observation.capturedAtMs) ||
      observation.capturedAtMs < evidenceCapturedAfterMs ||
      observation.sequence <= lastSequence ||
      observation.captureSeconds <= lastCaptureSeconds
    )
      return
    lastSequence = observation.sequence
    lastCaptureSeconds = observation.captureSeconds
    const age = observedAtMs - observation.capturedAtMs
    const voiced =
      Number.isFinite(age) &&
      age >= -5 &&
      age <= MAXIMUM_SAMPLE_AGE_MS &&
      observation.midi !== null &&
      Number.isFinite(observation.midi) &&
      observation.confidence >= CONFIDENCE_FLOOR
    emit({ pitch: voiced ? observation.midi : null })

    if (state.mode === 'finding') {
      if (
        !voiced ||
        observation.midi! < MIN_MIDI ||
        observation.midi! > MAX_MIDI
      ) {
        samples = []
        return
      }
      const previous = samples.at(-1)
      if (
        previous !== undefined &&
        (observation.captureSeconds - previous.captureSeconds >
          MAXIMUM_SAMPLE_GAP_SECONDS ||
          Math.abs(observation.midi! - previous.midi!) >
            MAXIMUM_CALIBRATION_DRIFT)
      )
        samples = []
      samples.push(observation)
      if (samples.length > 30) samples.shift()
      if (
        samples.length < MINIMUM_CALIBRATION_SAMPLES ||
        observation.captureSeconds - samples[0].captureSeconds <
          MINIMUM_CALIBRATION_SECONDS
      )
        return
      const values = samples.map((sample) => sample.midi!).sort((a, b) => a - b)
      const midi = Math.round(values[Math.floor(values.length / 2)])
      const findingTarget = state.findingTarget
      samples = []
      if (findingTarget === null || !acceptCalibration(findingTarget, midi))
        return
      void advanceCalibration(generation)
      return
    }
    if (state.mode !== 'singing') return
    const batch = options.game.feedPitch(observation, observedAtMs)
    options.onEvents(batch)
    syncProgress()
    if (state.mode !== 'singing' || current === null) return
    if (batch.some((event) => event.type === 'challenge-reset')) {
      const firstTarget =
        current.challenge.kind === 'ordered-pair'
          ? current.challenge.steps[0].target
          : current.challenge.step.target
      const firstNote =
        firstTarget === 'low'
          ? 'lower'
          : firstTarget === 'high'
            ? 'higher'
            : 'first'
      emit({
        message:
          current.challenge.kind === 'ordered-pair'
            ? `Try ${targetCopy(firstTarget)} again.`
            : 'Hold steady again.',
        hint: `Start with the ${firstNote} note again; take your time.`,
      })
    } else if (
      batch.some((event) => event.type === 'challenge-step') &&
      options.game.snapshot().activeEncounter !== null
    ) {
      emit({
        message:
          current.challenge.kind === 'settle-wave'
            ? `Sway ${current.challenge.wave.requiredCycles === 2 ? 'twice' : `${current.challenge.wave.requiredCycles} times`}, then return.`
            : `Sing ${targetCopy(options.game.snapshot().activeEncounter!.target)}.`,
        hint:
          current.challenge.kind === 'settle-wave'
            ? `Make ${current.challenge.wave.requiredCycles} gentle waves above and below your note, then return to the middle. A semitone is enough; keep it comfortable.`
            : 'Settle the second note gently.',
      })
    }
  }

  const start = async (encounterId: string): Promise<void> => {
    if (disposed || state.mode !== 'off' || !options.canPlay()) return
    const encounter = options.level.breakables.find(
      (candidate) => candidate.id === encounterId,
    )
    if (encounter === undefined) return
    stopSound()
    current = encounter
    prepareTargets(encounter.challenge)
    const run = ++generation
    resetEvidence()
    options.game.setPaused(true)
    emit({
      mode: 'permission',
      pitch: null,
      encounterId,
      findingTarget: null,
      message: 'Opening the mic…',
      hint: 'The museum will stay still while permission opens.',
      pair: isPairChallenge(encounter.challenge),
      stepIndex: 0,
      stepCount: encounter.challenge.kind === 'hold' ? 1 : 2,
      stepCharge: 0,
      target: comfortable,
    })
    try {
      const session = options.host.createVoice()
      voice = session
      sound = options.host.createSound()
      const quiet = options.beforeCapture()
      await session.start(quiet)
      if (disposed || run !== generation || voice !== session) {
        session.stop()
        return
      }
      evidenceCapturedAfterMs = now()
      stopObserving = session.subscribe(
        (observation, observedAtMs) => {
          if (!disposed && voice === session) observe(observation, observedAtMs)
        },
        () => {
          if (disposed || voice !== session) return
          fail('Audio was interrupted. Tap Sing to try again.')
        },
      )
      await advanceCalibration(run)
    } catch (cause) {
      if (disposed || run !== generation) return
      const issue = microphoneIssue(cause)
      fail(issue.message, issue)
    }
  }

  const replay = async (): Promise<void> => {
    if (
      disposed ||
      state.mode !== 'singing' ||
      current === null ||
      voice === null ||
      sound === null
    )
      return
    const run = ++generation
    samples = []
    options.game.cancelEncounter()
    if (!options.game.beginEncounter(current.id, targets)) {
      fail(
        'That exhibit is no longer ready. Step back onto its glowing circle.',
      )
      return
    }
    await playReferences(run)
  }

  const refind = (): void => {
    if (current !== null && current.challenge.kind !== 'ordered-pair') {
      const role = current.challenge.step.target
      if (role === 'comfortable') {
        comfortable = null
        options.host.writePreference('comfortable-note', '')
      } else if (role === 'low') {
        pair = null
        options.host.writePreference(PAIR_PREFERENCE, '')
      } else if (pair !== null) {
        pair = { version: CALIBRATION_VERSION, low: pair.low }
        writePair()
      }
    } else if (current !== null) {
      pair = null
      options.host.writePreference(PAIR_PREFERENCE, '')
    }
    cancel()
  }

  const completeBreak = (): void => {
    if (state.mode === 'off') return
    stopCapture()
    sound?.shatter()
    const finishedSound = sound
    soundTimer = setTimeout(() => {
      finishedSound?.dispose()
      if (sound === finishedSound) sound = null
    }, 3000)
    current = null
    queue = []
  }

  emit()
  return {
    snapshot: () => state,
    start,
    replay,
    refind,
    cancel,
    completeBreak,
    dispose() {
      if (disposed) return
      disposed = true
      cancel()
    },
  }
}
