// ============================================================
// Melody contour compiler — one validated curve for sight, sound and judging.
// ============================================================
//
// Authored notes stay relative to a calibrated root. Compilation is the only
// place that resolves feel, pace, transposition, silent gaps and interpolation,
// so a renderer or reference player cannot quietly diverge from the judge.

export type MelodyConnection = 'glide' | 'separate-note'

export interface MelodyVibratoDefinition {
  kind: 'vibrato'
  depthCents: number
  rateHz: number
}

export interface MelodyAnchorDefinition {
  id: string
  offsetSemitones: number
  landingSeconds?: number
  /** Duration and articulation from this anchor to the next one. */
  transitionSeconds?: number
  connection?: MelodyConnection
  ornament?: MelodyVibratoDefinition
}

export interface MelodyPhraseDefinition {
  id: string
  anchors: readonly MelodyAnchorDefinition[]
  /** A phrase boundary is an optional breath, never a required silence timer. */
  allowBreathAfter: boolean
}

export interface MelodyFeelDefinition {
  landingSeconds: number
  finalLandingSeconds: number
  transitionSeconds: number
  breathSeconds: number
  connection: MelodyConnection
}

export interface MelodyDefinition {
  id: string
  version: number
  title: string
  description: string
  feel: MelodyFeelDefinition
  phrases: readonly MelodyPhraseDefinition[]
}

export interface MelodyCompileLimits {
  maximumPhrases: number
  maximumAnchorsPerPhrase: number
  maximumTotalAnchors: number
  minimumLandingSeconds: number
  maximumLandingSeconds: number
  minimumTransitionSeconds: number
  maximumTransitionSeconds: number
  maximumBreathSeconds: number
  maximumDurationSeconds: number
  maximumRangeSemitones: number
  minimumPace: number
  maximumPace: number
  minimumSamplesPerSecond: number
  maximumSamplesPerSecond: number
  maximumVibratoDepthCents: number
  minimumVibratoRateHz: number
  maximumVibratoRateHz: number
}

export const DEFAULT_MELODY_COMPILE_LIMITS: MelodyCompileLimits = {
  maximumPhrases: 8,
  maximumAnchorsPerPhrase: 32,
  maximumTotalAnchors: 64,
  minimumLandingSeconds: 0.05,
  maximumLandingSeconds: 4,
  minimumTransitionSeconds: 0.05,
  maximumTransitionSeconds: 4,
  maximumBreathSeconds: 10,
  maximumDurationSeconds: 90,
  maximumRangeSemitones: 24,
  minimumPace: 0.25,
  maximumPace: 4,
  minimumSamplesPerSecond: 20,
  maximumSamplesPerSecond: 480,
  maximumVibratoDepthCents: 100,
  minimumVibratoRateHz: 1,
  maximumVibratoRateHz: 12,
}

export interface MelodyCompileOptions {
  /** Calibrated comfortable pitch before optional transposition. */
  rootMidi: number
  transposeSemitones?: number
  /** Duration multiplier. Pitch and contour shape are unchanged. */
  pace?: number
  samplesPerSecond?: number
  allowedRange?: { minimumMidi: number; maximumMidi: number }
  limits?: Partial<MelodyCompileLimits>
}

export type CompiledMelodySegmentKind =
  | 'landing'
  | 'glide'
  | 'separate-note'
  | 'breath'

export interface CompiledMelodySegment {
  id: string
  kind: CompiledMelodySegmentKind
  phraseIndex: number
  startSeconds: number
  endSeconds: number
  phaseStart: number
  phaseEnd: number
  fromMidi: number | null
  toMidi: number | null
  fromAnchorId?: string
  toAnchorId?: string
  ornament?: MelodyVibratoDefinition
}

export interface CompiledMelodyAnchor {
  id: string
  phraseId: string
  phraseIndex: number
  anchorIndex: number
  midi: number
  startSeconds: number
  completedAtSeconds: number
  completedPhase: number
}

export interface CompiledMelodyPhrase {
  id: string
  index: number
  startSeconds: number
  endSeconds: number
  phaseStart: number
  phaseEnd: number
  allowBreathAfter: boolean
  anchors: readonly CompiledMelodyAnchor[]
  segments: readonly CompiledMelodySegment[]
}

export interface MelodyContourPoint {
  timeSeconds: number
  phase: number
  midi: number | null
  baseMidi: number | null
  kind: CompiledMelodySegmentKind
  phraseIndex: number
  segmentId: string
  anchorId?: string
}

export interface CompiledMelody {
  id: string
  version: number
  rootMidi: number
  transposeSemitones: number
  pace: number
  durationSeconds: number
  singingSeconds: number
  minimumMidi: number
  maximumMidi: number
  phrases: readonly CompiledMelodyPhrase[]
  anchors: readonly CompiledMelodyAnchor[]
  segments: readonly CompiledMelodySegment[]
  /** Uniform timeline samples for reference automation and display geometry. */
  samples: readonly MelodyContourPoint[]
}

interface RawSegment {
  id: string
  kind: CompiledMelodySegmentKind
  phraseIndex: number
  startSeconds: number
  endSeconds: number
  fromMidi: number | null
  toMidi: number | null
  fromAnchorId?: string
  toAnchorId?: string
  ornament?: MelodyVibratoDefinition
}

interface RawPhrase {
  definition: MelodyPhraseDefinition
  index: number
  startSeconds: number
  endSeconds: number
  anchors: Array<
    Omit<CompiledMelodyAnchor, 'completedPhase'> & { landingSegmentId: string }
  >
  segmentIds: string[]
}

function finite(value: number): boolean {
  return Number.isFinite(value)
}

function mergeLimits(
  overrides: Partial<MelodyCompileLimits> | undefined,
): MelodyCompileLimits {
  const limits = { ...DEFAULT_MELODY_COMPILE_LIMITS, ...overrides }
  for (const [name, value] of Object.entries(limits)) {
    if (!finite(value) || value < 0)
      throw new Error(
        `Melody compile limit ${name} must be finite and non-negative.`,
      )
  }
  if (
    limits.minimumLandingSeconds > limits.maximumLandingSeconds ||
    limits.minimumTransitionSeconds > limits.maximumTransitionSeconds ||
    limits.minimumPace > limits.maximumPace ||
    limits.minimumSamplesPerSecond > limits.maximumSamplesPerSecond ||
    limits.minimumVibratoRateHz > limits.maximumVibratoRateHz
  )
    throw new Error(
      'Melody compile limits have an inverted minimum and maximum.',
    )
  return limits
}

function requireId(value: string, label: string): void {
  if (typeof value !== 'string' || value.trim().length === 0)
    throw new Error(`${label} must have a non-empty id.`)
}

function requireDuration(
  value: number,
  minimum: number,
  maximum: number,
  label: string,
): void {
  if (!finite(value) || value < minimum || value > maximum)
    throw new Error(`${label} must be within [${minimum}, ${maximum}] seconds.`)
}

function resolveLandingSeconds(
  definition: MelodyDefinition,
  anchor: MelodyAnchorDefinition,
  final: boolean,
): number {
  return (
    anchor.landingSeconds ??
    (final
      ? definition.feel.finalLandingSeconds
      : definition.feel.landingSeconds)
  )
}

function validateDefinition(
  definition: MelodyDefinition,
  limits: MelodyCompileLimits,
): void {
  requireId(definition.id, 'Melody')
  if (!Number.isInteger(definition.version) || definition.version < 1)
    throw new Error('Melody version must be a positive integer.')
  if (
    !Array.isArray(definition.phrases) ||
    definition.phrases.length === 0 ||
    definition.phrases.length > limits.maximumPhrases
  )
    throw new Error(
      `Melody must contain between 1 and ${limits.maximumPhrases} phrases.`,
    )
  requireDuration(
    definition.feel.landingSeconds,
    limits.minimumLandingSeconds,
    limits.maximumLandingSeconds,
    'Default landing',
  )
  requireDuration(
    definition.feel.finalLandingSeconds,
    limits.minimumLandingSeconds,
    limits.maximumLandingSeconds,
    'Final landing',
  )
  requireDuration(
    definition.feel.transitionSeconds,
    limits.minimumTransitionSeconds,
    limits.maximumTransitionSeconds,
    'Default transition',
  )
  if (
    !finite(definition.feel.breathSeconds) ||
    definition.feel.breathSeconds < 0 ||
    definition.feel.breathSeconds > limits.maximumBreathSeconds
  )
    throw new Error(
      `Breath duration must be within [0, ${limits.maximumBreathSeconds}] seconds.`,
    )
  if (!['glide', 'separate-note'].includes(definition.feel.connection))
    throw new Error('Melody feel has an unsupported connection.')

  const ids = new Set<string>()
  let anchorCount = 0
  let minimumOffset = Infinity
  let maximumOffset = -Infinity
  definition.phrases.forEach((phrase, phraseIndex) => {
    const anchors: readonly MelodyAnchorDefinition[] = phrase.anchors
    requireId(phrase.id, 'Phrase')
    if (ids.has(phrase.id))
      throw new Error(`Duplicate melody id: ${phrase.id}.`)
    ids.add(phrase.id)
    if (
      !Array.isArray(anchors) ||
      anchors.length < 2 ||
      anchors.length > limits.maximumAnchorsPerPhrase
    )
      throw new Error(
        `Phrase ${phrase.id} must contain between 2 and ${limits.maximumAnchorsPerPhrase} anchors.`,
      )
    const finalPhrase = phraseIndex === definition.phrases.length - 1
    if (!finalPhrase && phrase.allowBreathAfter !== true)
      throw new Error(`Phrase ${phrase.id} must declare its breath boundary.`)
    if (finalPhrase && phrase.allowBreathAfter === true)
      throw new Error(
        `Final phrase ${phrase.id} cannot end with a breath boundary.`,
      )
    anchors.forEach((anchor, anchorIndex) => {
      requireId(anchor.id, 'Anchor')
      if (ids.has(anchor.id))
        throw new Error(`Duplicate melody id: ${anchor.id}.`)
      ids.add(anchor.id)
      if (!finite(anchor.offsetSemitones))
        throw new Error(`Anchor ${anchor.id} has a non-finite pitch offset.`)
      minimumOffset = Math.min(minimumOffset, anchor.offsetSemitones)
      maximumOffset = Math.max(maximumOffset, anchor.offsetSemitones)
      requireDuration(
        resolveLandingSeconds(
          definition,
          anchor,
          anchorIndex === anchors.length - 1,
        ),
        limits.minimumLandingSeconds,
        limits.maximumLandingSeconds,
        `Landing ${anchor.id}`,
      )
      const finalAnchor = anchorIndex === anchors.length - 1
      if (finalAnchor) {
        if (
          anchor.transitionSeconds !== undefined ||
          anchor.connection !== undefined
        )
          throw new Error(
            `Final anchor ${anchor.id} cannot define a transition.`,
          )
      } else {
        requireDuration(
          anchor.transitionSeconds ?? definition.feel.transitionSeconds,
          limits.minimumTransitionSeconds,
          limits.maximumTransitionSeconds,
          `Transition ${anchor.id}`,
        )
        const connection = anchor.connection ?? definition.feel.connection
        if (!['glide', 'separate-note'].includes(connection))
          throw new Error(`Anchor ${anchor.id} has an unsupported connection.`)
      }
      if (anchor.ornament !== undefined) {
        if (anchor.ornament.kind !== 'vibrato')
          throw new Error(`Anchor ${anchor.id} has an unsupported ornament.`)
        if (
          !finite(anchor.ornament.depthCents) ||
          anchor.ornament.depthCents <= 0 ||
          anchor.ornament.depthCents > limits.maximumVibratoDepthCents
        )
          throw new Error(`Anchor ${anchor.id} has an invalid vibrato depth.`)
        if (
          !finite(anchor.ornament.rateHz) ||
          anchor.ornament.rateHz < limits.minimumVibratoRateHz ||
          anchor.ornament.rateHz > limits.maximumVibratoRateHz
        )
          throw new Error(`Anchor ${anchor.id} has an invalid vibrato rate.`)
      }
      anchorCount++
    })
  })
  if (anchorCount > limits.maximumTotalAnchors)
    throw new Error(
      `Melody has ${anchorCount} anchors; maximum is ${limits.maximumTotalAnchors}.`,
    )
  if (maximumOffset - minimumOffset > limits.maximumRangeSemitones)
    throw new Error(
      `Melody range exceeds ${limits.maximumRangeSemitones} semitones.`,
    )
}

function phaseAtSegmentEnd(
  segments: readonly CompiledMelodySegment[],
  id: string,
): number {
  const segment = segments.find((candidate) => candidate.id === id)
  if (!segment) throw new Error(`Compiled melody lost segment ${id}.`)
  return segment.phaseEnd
}

/** Validate and compile authored relative notes into an absolute contour. */
export function compileMelody(
  definition: MelodyDefinition,
  options: MelodyCompileOptions,
): CompiledMelody {
  const limits = mergeLimits(options.limits)
  validateDefinition(definition, limits)
  const pace = options.pace ?? 1
  const transposeSemitones = options.transposeSemitones ?? 0
  const samplesPerSecond = options.samplesPerSecond ?? 120
  if (!finite(options.rootMidi))
    throw new Error('Melody root MIDI must be finite.')
  if (!finite(transposeSemitones))
    throw new Error('Melody transposition must be finite.')
  if (!finite(pace) || pace < limits.minimumPace || pace > limits.maximumPace)
    throw new Error(
      `Melody pace must be within [${limits.minimumPace}, ${limits.maximumPace}].`,
    )
  if (
    !finite(samplesPerSecond) ||
    samplesPerSecond < limits.minimumSamplesPerSecond ||
    samplesPerSecond > limits.maximumSamplesPerSecond
  )
    throw new Error(
      `Melody sample rate must be within [${limits.minimumSamplesPerSecond}, ${limits.maximumSamplesPerSecond}].`,
    )
  const allowedRange = options.allowedRange ?? {
    minimumMidi: 0,
    maximumMidi: 127,
  }
  if (
    !finite(allowedRange.minimumMidi) ||
    !finite(allowedRange.maximumMidi) ||
    allowedRange.minimumMidi > allowedRange.maximumMidi
  )
    throw new Error('Melody allowed range is invalid.')

  const absoluteRoot = options.rootMidi + transposeSemitones
  const offsets = definition.phrases.flatMap((phrase) =>
    phrase.anchors.map((anchor) => anchor.offsetSemitones),
  )
  const minimumMidi = absoluteRoot + Math.min(...offsets)
  const maximumMidi = absoluteRoot + Math.max(...offsets)
  if (
    minimumMidi < allowedRange.minimumMidi ||
    maximumMidi > allowedRange.maximumMidi
  )
    throw new Error(
      `Melody range [${minimumMidi}, ${maximumMidi}] does not fit the allowed range.`,
    )

  let timeSeconds = 0
  const rawSegments: RawSegment[] = []
  const rawPhrases: RawPhrase[] = []
  for (const [phraseIndex, phrase] of definition.phrases.entries()) {
    const phraseStart = timeSeconds
    const anchors: RawPhrase['anchors'] = []
    const segmentIds: string[] = []
    for (const [anchorIndex, anchor] of phrase.anchors.entries()) {
      const midi = absoluteRoot + anchor.offsetSemitones
      const finalAnchor = anchorIndex === phrase.anchors.length - 1
      const landingSeconds =
        resolveLandingSeconds(definition, anchor, finalAnchor) * pace
      const landingSegmentId = `${phrase.id}:${anchor.id}:landing`
      const startSeconds = timeSeconds
      rawSegments.push({
        id: landingSegmentId,
        kind: 'landing',
        phraseIndex,
        startSeconds,
        endSeconds: startSeconds + landingSeconds,
        fromMidi: midi,
        toMidi: midi,
        fromAnchorId: anchor.id,
        toAnchorId: anchor.id,
        ornament: anchor.ornament,
      })
      segmentIds.push(landingSegmentId)
      timeSeconds += landingSeconds
      anchors.push({
        id: anchor.id,
        phraseId: phrase.id,
        phraseIndex,
        anchorIndex,
        midi,
        startSeconds,
        completedAtSeconds: timeSeconds,
        landingSegmentId,
      })
      if (finalAnchor) continue
      const next = phrase.anchors[anchorIndex + 1]
      const transitionSeconds =
        (anchor.transitionSeconds ?? definition.feel.transitionSeconds) * pace
      const connection = anchor.connection ?? definition.feel.connection
      const transitionSegmentId = `${phrase.id}:${anchor.id}:${next.id}:${connection}`
      rawSegments.push({
        id: transitionSegmentId,
        kind: connection,
        phraseIndex,
        startSeconds: timeSeconds,
        endSeconds: timeSeconds + transitionSeconds,
        fromMidi: connection === 'glide' ? midi : null,
        toMidi:
          connection === 'glide' ? absoluteRoot + next.offsetSemitones : null,
        fromAnchorId: anchor.id,
        toAnchorId: next.id,
      })
      segmentIds.push(transitionSegmentId)
      timeSeconds += transitionSeconds
    }
    rawPhrases.push({
      definition: phrase,
      index: phraseIndex,
      startSeconds: phraseStart,
      endSeconds: timeSeconds,
      anchors,
      segmentIds,
    })
    if (phrase.allowBreathAfter) {
      const breathSeconds = definition.feel.breathSeconds * pace
      const nextPhrase = definition.phrases[phraseIndex + 1]
      rawSegments.push({
        id: `${phrase.id}:${nextPhrase.id}:breath`,
        kind: 'breath',
        phraseIndex,
        startSeconds: timeSeconds,
        endSeconds: timeSeconds + breathSeconds,
        fromMidi: null,
        toMidi: null,
      })
      timeSeconds += breathSeconds
    }
  }
  if (timeSeconds > limits.maximumDurationSeconds)
    throw new Error(
      `Compiled melody lasts ${timeSeconds} seconds; maximum is ${limits.maximumDurationSeconds}.`,
    )

  const singingSeconds = rawSegments.reduce(
    (sum, segment) =>
      sum +
      (segment.kind === 'landing' || segment.kind === 'glide'
        ? segment.endSeconds - segment.startSeconds
        : 0),
    0,
  )
  let singingElapsed = 0
  const segments: CompiledMelodySegment[] = rawSegments.map((segment) => {
    const singingDuration =
      segment.kind === 'landing' || segment.kind === 'glide'
        ? segment.endSeconds - segment.startSeconds
        : 0
    const phaseStart = singingElapsed / singingSeconds
    singingElapsed += singingDuration
    return {
      ...segment,
      phaseStart,
      phaseEnd: singingElapsed / singingSeconds,
    }
  })
  const phrases: CompiledMelodyPhrase[] = rawPhrases.map((phrase) => {
    const phraseSegments = phrase.segmentIds.map((id) => {
      const segment = segments.find((candidate) => candidate.id === id)
      if (!segment) throw new Error(`Compiled melody lost segment ${id}.`)
      return segment
    })
    const anchors = phrase.anchors.map(({ landingSegmentId, ...anchor }) => ({
      ...anchor,
      completedPhase: phaseAtSegmentEnd(segments, landingSegmentId),
    }))
    return {
      id: phrase.definition.id,
      index: phrase.index,
      startSeconds: phrase.startSeconds,
      endSeconds: phrase.endSeconds,
      phaseStart: phraseSegments[0].phaseStart,
      phaseEnd: phraseSegments.at(-1)!.phaseEnd,
      allowBreathAfter: phrase.definition.allowBreathAfter,
      anchors,
      segments: phraseSegments,
    }
  })
  const anchors = phrases.flatMap((phrase) => phrase.anchors)
  const sampleCount = Math.ceil(timeSeconds * samplesPerSecond)
  const partial: Omit<CompiledMelody, 'samples'> = {
    id: definition.id,
    version: definition.version,
    rootMidi: options.rootMidi,
    transposeSemitones,
    pace,
    durationSeconds: timeSeconds,
    singingSeconds,
    minimumMidi,
    maximumMidi,
    phrases,
    anchors,
    segments,
  }
  const compiled = partial as CompiledMelody
  const samples = Array.from({ length: sampleCount + 1 }, (_, index) =>
    sampleMelodyAtTime(
      compiled,
      (index / sampleCount) * compiled.durationSeconds,
    ),
  )
  return { ...partial, samples }
}

function segmentAtTime(
  melody: Pick<CompiledMelody, 'segments' | 'durationSeconds'>,
  timeSeconds: number,
): CompiledMelodySegment {
  const bounded = Math.max(0, Math.min(melody.durationSeconds, timeSeconds))
  return (
    melody.segments.find((segment) => bounded < segment.endSeconds) ??
    melody.segments.at(-1)!
  )
}

/** Sample the exact curve shared by display, reference automation and judge. */
export function sampleMelodyAtTime(
  melody: Pick<CompiledMelody, 'segments' | 'durationSeconds'>,
  timeSeconds: number,
): MelodyContourPoint {
  if (!finite(timeSeconds))
    throw new Error('Melody sample time must be finite.')
  const bounded = Math.max(0, Math.min(melody.durationSeconds, timeSeconds))
  const segment = segmentAtTime(melody, bounded)
  const duration = segment.endSeconds - segment.startSeconds
  const amount = duration > 0 ? (bounded - segment.startSeconds) / duration : 1
  const unit = Math.max(0, Math.min(1, amount))
  let baseMidi: number | null = null
  if (segment.kind === 'landing') baseMidi = segment.fromMidi
  else if (segment.kind === 'glide') {
    const eased = unit * unit * (3 - 2 * unit)
    baseMidi = segment.fromMidi! + (segment.toMidi! - segment.fromMidi!) * eased
  }
  let midi = baseMidi
  if (midi !== null && segment.ornament !== undefined) {
    const localSeconds = bounded - segment.startSeconds
    const edgeEnvelope = Math.sin(Math.PI * unit) ** 2
    midi +=
      (segment.ornament.depthCents / 100) *
      edgeEnvelope *
      Math.sin(2 * Math.PI * segment.ornament.rateHz * localSeconds)
  }
  return {
    timeSeconds: bounded,
    phase: segment.phaseStart + (segment.phaseEnd - segment.phaseStart) * unit,
    midi,
    baseMidi,
    kind: segment.kind,
    phraseIndex: segment.phraseIndex,
    segmentId: segment.id,
    anchorId: segment.kind === 'landing' ? segment.fromAnchorId : undefined,
  }
}

/** Convert a normalized sung prefix back onto the same compiled curve. */
export function sampleMelodyAtPhase(
  melody: Pick<CompiledMelody, 'segments' | 'durationSeconds'>,
  phase: number,
): MelodyContourPoint {
  if (!finite(phase)) throw new Error('Melody phase must be finite.')
  const bounded = Math.max(0, Math.min(1, phase))
  const pitched = melody.segments.filter(
    (segment) => segment.kind === 'landing' || segment.kind === 'glide',
  )
  const segment =
    pitched.find((candidate) => bounded <= candidate.phaseEnd + 1e-12) ??
    pitched.at(-1)!
  const span = segment.phaseEnd - segment.phaseStart
  const amount = span > 0 ? (bounded - segment.phaseStart) / span : 1
  return sampleMelodyAtTime(
    melody,
    segment.startSeconds +
      Math.max(0, Math.min(1, amount)) *
        (segment.endSeconds - segment.startSeconds),
  )
}

export function melodyMidiToFrequency(midi: number): number {
  if (!finite(midi)) throw new Error('Melody MIDI pitch must be finite.')
  return 440 * 2 ** ((midi - 69) / 12)
}
