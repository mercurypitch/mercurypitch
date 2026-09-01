// Guitar electric amp — one asset-free, route-owned amplifier and cabinet stage.
// ============================================================
//
// The public input and output are stable GainNodes. Every live control is an
// AudioParam, so changing a preset never swaps a node or replaces a shaper
// curve while audio is running. This matters for both summed guide voices and
// the optional direct-input monitor, which can share the same parameter state.

const PREAMP_CURVE_AMOUNT = 2.35
const POWER_CURVE_AMOUNT = 1.2
const PREAMP_ASYMMETRY_AMOUNT = 0.22
const PARAMETER_TIME_CONSTANT_SECONDS = 0.018

export const GUITAR_ELECTRIC_AMP_FREQUENCIES_HZ = Object.freeze({
  inputHighpass: 45,
  inputLowpass: 7200,
  bass: 120,
  mid: 750,
  treble: 2800,
  presence: 3800,
  cabinetBody: 1350,
})

export const GUITAR_ELECTRIC_AMP_PARAMETER_LIMITS = Object.freeze({
  drive: [0, 1] as const,
  bass: [-1, 1] as const,
  mid: [-1, 1] as const,
  treble: [-1, 1] as const,
  presence: [-1, 1] as const,
  output: [0, 1] as const,
  asymmetry: [0, 1] as const,
})

export type GuitarElectricAmpCabinet = 'open' | 'balanced' | 'dark'

export const GUITAR_ELECTRIC_AMP_CABINETS = Object.freeze([
  'open',
  'balanced',
  'dark',
] as const satisfies readonly GuitarElectricAmpCabinet[])

export interface GuitarElectricAmpParameters {
  readonly enabled: boolean
  readonly drive: number
  readonly bass: number
  readonly mid: number
  readonly treble: number
  readonly presence: number
  readonly output: number
  readonly cabinet: GuitarElectricAmpCabinet
  readonly asymmetry: number
}

/** The safe Edge voicing used by Guitar Night's shared and monitor stages. */
export const DEFAULT_GUITAR_ELECTRIC_AMP_PARAMETERS: GuitarElectricAmpParameters =
  Object.freeze({
    enabled: true,
    drive: 0.42,
    bass: 0.08,
    mid: 0.1,
    treble: -0.08,
    presence: 0.1,
    output: 0.6,
    cabinet: 'balanced',
    asymmetry: 0.18,
  })

export interface GuitarElectricAmpVoicing {
  readonly inputHeadroomGain: number
  readonly preampDriveGain: number
  readonly preampCompensationGain: number
  readonly powerDriveGain: number
  readonly powerCompensationGain: number
  readonly bassGainDb: number
  readonly midGainDb: number
  readonly trebleGainDb: number
  readonly presenceGainDb: number
  readonly cabinetBodyGainDb: number
  readonly cabinetHighpassHz: number
  readonly cabinetLowpassHz: number
  readonly outputGain: number
}

export interface GuitarElectricAmpStage {
  readonly input: GainNode
  readonly output: GainNode
  readonly nodes: readonly AudioNode[]
  getParameters(): GuitarElectricAmpParameters
  setParameters(
    parameters: Partial<GuitarElectricAmpParameters>,
    atTime?: number,
  ): GuitarElectricAmpParameters
  setBypassed(bypassed: boolean, atTime?: number): void
  dispose(): void
}

/** The original lightweight stage retained by standalone per-voice synths. */
export interface LegacyGuitarElectricAmpStage {
  readonly input: WaveShaperNode
  readonly output: BiquadFilterNode
  readonly nodes: readonly AudioNode[]
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

function finiteInRange(
  value: unknown,
  fallback: number,
  range: readonly [number, number],
): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? clamp(value, range[0], range[1])
    : fallback
}

function isGuitarElectricAmpCabinet(
  value: unknown,
): value is GuitarElectricAmpCabinet {
  return GUITAR_ELECTRIC_AMP_CABINETS.some((cabinet) => cabinet === value)
}

function dbToGain(decibels: number): number {
  return 10 ** (decibels / 20)
}

/** Clamp an arbitrary partial update without allowing NaN into AudioParams. */
export function normalizeGuitarElectricAmpParameters(
  parameters: Partial<GuitarElectricAmpParameters> | null | undefined,
  fallback: GuitarElectricAmpParameters = DEFAULT_GUITAR_ELECTRIC_AMP_PARAMETERS,
): GuitarElectricAmpParameters {
  const candidate = parameters ?? {}
  return {
    enabled:
      typeof candidate.enabled === 'boolean'
        ? candidate.enabled
        : fallback.enabled,
    drive: finiteInRange(
      candidate.drive,
      fallback.drive,
      GUITAR_ELECTRIC_AMP_PARAMETER_LIMITS.drive,
    ),
    bass: finiteInRange(
      candidate.bass,
      fallback.bass,
      GUITAR_ELECTRIC_AMP_PARAMETER_LIMITS.bass,
    ),
    mid: finiteInRange(
      candidate.mid,
      fallback.mid,
      GUITAR_ELECTRIC_AMP_PARAMETER_LIMITS.mid,
    ),
    treble: finiteInRange(
      candidate.treble,
      fallback.treble,
      GUITAR_ELECTRIC_AMP_PARAMETER_LIMITS.treble,
    ),
    presence: finiteInRange(
      candidate.presence,
      fallback.presence,
      GUITAR_ELECTRIC_AMP_PARAMETER_LIMITS.presence,
    ),
    output: finiteInRange(
      candidate.output,
      fallback.output,
      GUITAR_ELECTRIC_AMP_PARAMETER_LIMITS.output,
    ),
    cabinet: isGuitarElectricAmpCabinet(candidate.cabinet)
      ? candidate.cabinet
      : fallback.cabinet,
    asymmetry: finiteInRange(
      candidate.asymmetry,
      fallback.asymmetry,
      GUITAR_ELECTRIC_AMP_PARAMETER_LIMITS.asymmetry,
    ),
  }
}

/** Translate normalized controls into the fixed graph's AudioParam targets. */
export function computeGuitarElectricAmpVoicing(
  parameters: Partial<GuitarElectricAmpParameters> = {},
): GuitarElectricAmpVoicing {
  const normalized = normalizeGuitarElectricAmpParameters(parameters)
  const cabinetPosition = {
    open: 0.2,
    balanced: 0.625,
    dark: 0.9,
  }[normalized.cabinet]
  return {
    inputHeadroomGain: 0.9,
    preampDriveGain: dbToGain(-8 + normalized.drive * 16),
    preampCompensationGain: dbToGain(0.75 - normalized.drive * 4),
    powerDriveGain: dbToGain(-3 + normalized.drive * 6),
    powerCompensationGain: dbToGain(0.5 - normalized.drive * 2),
    bassGainDb: normalized.bass * 8,
    midGainDb: normalized.mid * 8,
    trebleGainDb: normalized.treble * 6,
    presenceGainDb: normalized.presence * 4,
    cabinetBodyGainDb: 0.4 + cabinetPosition * 1.2,
    cabinetHighpassHz: 65 + cabinetPosition * 25,
    cabinetLowpassHz: 7600 - cabinetPosition * 3600,
    outputGain: dbToGain(-12 + normalized.output * 15),
  }
}

type GuitarAmpFilterType =
  | 'lowpass'
  | 'highpass'
  | 'lowshelf'
  | 'highshelf'
  | 'peaking'

interface GuitarAmpFilterDefinition {
  readonly type: GuitarAmpFilterType
  readonly frequencyHz: number
  readonly q?: number
  readonly gainDb?: number
}

interface GuitarAmpBiquadCoefficients {
  readonly b0: number
  readonly b1: number
  readonly b2: number
  readonly a1: number
  readonly a2: number
}

function guitarAmpBiquadCoefficients(
  filter: GuitarAmpFilterDefinition,
  sampleRate: number,
): GuitarAmpBiquadCoefficients {
  const frequencyHz = clamp(filter.frequencyHz, 1, sampleRate * 0.499)
  const omega = (2 * Math.PI * frequencyHz) / sampleRate
  const cosine = Math.cos(omega)
  const sine = Math.sin(omega)
  const q = Math.max(0.001, filter.q ?? 1)
  const amplitude = 10 ** ((filter.gainDb ?? 0) / 40)
  const shelfRoot = Math.sqrt(amplitude)
  let alpha = sine / (2 * q)
  let b0: number
  let b1: number
  let b2: number
  let a0: number
  let a1: number
  let a2: number

  switch (filter.type) {
    case 'lowpass':
      b0 = (1 - cosine) / 2
      b1 = 1 - cosine
      b2 = b0
      a0 = 1 + alpha
      a1 = -2 * cosine
      a2 = 1 - alpha
      break
    case 'highpass':
      b0 = (1 + cosine) / 2
      b1 = -(1 + cosine)
      b2 = b0
      a0 = 1 + alpha
      a1 = -2 * cosine
      a2 = 1 - alpha
      break
    case 'peaking':
      b0 = 1 + alpha * amplitude
      b1 = -2 * cosine
      b2 = 1 - alpha * amplitude
      a0 = 1 + alpha / amplitude
      a1 = -2 * cosine
      a2 = 1 - alpha / amplitude
      break
    case 'lowshelf':
      alpha = (sine / 2) * Math.sqrt(2)
      b0 =
        amplitude *
        (amplitude + 1 - (amplitude - 1) * cosine + 2 * shelfRoot * alpha)
      b1 = 2 * amplitude * (amplitude - 1 - (amplitude + 1) * cosine)
      b2 =
        amplitude *
        (amplitude + 1 - (amplitude - 1) * cosine - 2 * shelfRoot * alpha)
      a0 = amplitude + 1 + (amplitude - 1) * cosine + 2 * shelfRoot * alpha
      a1 = -2 * (amplitude - 1 + (amplitude + 1) * cosine)
      a2 = amplitude + 1 + (amplitude - 1) * cosine - 2 * shelfRoot * alpha
      break
    case 'highshelf':
      alpha = (sine / 2) * Math.sqrt(2)
      b0 =
        amplitude *
        (amplitude + 1 + (amplitude - 1) * cosine + 2 * shelfRoot * alpha)
      b1 = -2 * amplitude * (amplitude - 1 + (amplitude + 1) * cosine)
      b2 =
        amplitude *
        (amplitude + 1 + (amplitude - 1) * cosine - 2 * shelfRoot * alpha)
      a0 = amplitude + 1 - (amplitude - 1) * cosine + 2 * shelfRoot * alpha
      a1 = 2 * (amplitude - 1 - (amplitude + 1) * cosine)
      a2 = amplitude + 1 - (amplitude - 1) * cosine - 2 * shelfRoot * alpha
      break
  }

  return {
    b0: b0 / a0,
    b1: b1 / a0,
    b2: b2 / a0,
    a1: a1 / a0,
    a2: a2 / a0,
  }
}

function guitarAmpBiquadMagnitude(
  coefficients: GuitarAmpBiquadCoefficients,
  frequencyHz: number,
  sampleRate: number,
): number {
  const omega = (2 * Math.PI * frequencyHz) / sampleRate
  const cosine = Math.cos(omega)
  const sine = Math.sin(omega)
  const cosineDouble = Math.cos(omega * 2)
  const sineDouble = Math.sin(omega * 2)
  const numeratorReal =
    coefficients.b0 + coefficients.b1 * cosine + coefficients.b2 * cosineDouble
  const numeratorImaginary =
    -coefficients.b1 * sine - coefficients.b2 * sineDouble
  const denominatorReal =
    1 + coefficients.a1 * cosine + coefficients.a2 * cosineDouble
  const denominatorImaginary =
    -coefficients.a1 * sine - coefficients.a2 * sineDouble
  return Math.sqrt(
    (numeratorReal ** 2 + numeratorImaginary ** 2) /
      (denominatorReal ** 2 + denominatorImaginary ** 2),
  )
}

/**
 * Deterministic magnitude reference for the fixed Web Audio tone/cab filters.
 * Nonlinear stages and output trim are deliberately excluded: this seam makes
 * preset voicing measurable without pretending that a static response predicts
 * how a driven chord will sound.
 */
export function computeGuitarElectricAmpToneResponse(
  parameters: Partial<GuitarElectricAmpParameters>,
  frequenciesHz: readonly number[],
  sampleRate = 48_000,
): Float32Array<ArrayBuffer> {
  const safeSampleRate =
    Number.isFinite(sampleRate) && sampleRate >= 8_000 ? sampleRate : 48_000
  const voicing = computeGuitarElectricAmpVoicing(parameters)
  const filters: readonly GuitarAmpFilterDefinition[] = [
    {
      type: 'highpass',
      frequencyHz: GUITAR_ELECTRIC_AMP_FREQUENCIES_HZ.inputHighpass,
      q: 0.7,
    },
    {
      type: 'lowpass',
      frequencyHz: GUITAR_ELECTRIC_AMP_FREQUENCIES_HZ.inputLowpass,
      q: 0.55,
    },
    {
      type: 'lowshelf',
      frequencyHz: GUITAR_ELECTRIC_AMP_FREQUENCIES_HZ.bass,
      gainDb: voicing.bassGainDb,
    },
    {
      type: 'peaking',
      frequencyHz: GUITAR_ELECTRIC_AMP_FREQUENCIES_HZ.mid,
      q: 0.75,
      gainDb: voicing.midGainDb,
    },
    {
      type: 'highshelf',
      frequencyHz: GUITAR_ELECTRIC_AMP_FREQUENCIES_HZ.treble,
      gainDb: voicing.trebleGainDb,
    },
    {
      type: 'peaking',
      frequencyHz: GUITAR_ELECTRIC_AMP_FREQUENCIES_HZ.presence,
      q: 0.8,
      gainDb: voicing.presenceGainDb,
    },
    {
      type: 'peaking',
      frequencyHz: GUITAR_ELECTRIC_AMP_FREQUENCIES_HZ.cabinetBody,
      q: 0.72,
      gainDb: voicing.cabinetBodyGainDb,
    },
    {
      type: 'highpass',
      frequencyHz: voicing.cabinetHighpassHz,
      q: 0.7,
    },
    {
      type: 'lowpass',
      frequencyHz: voicing.cabinetLowpassHz,
      q: 0.72,
    },
  ]
  const coefficients = filters.map((filter) =>
    guitarAmpBiquadCoefficients(filter, safeSampleRate),
  )
  const response = new Float32Array(frequenciesHz.length)
  for (let index = 0; index < frequenciesHz.length; index += 1) {
    const frequencyHz = clamp(
      Number.isFinite(frequenciesHz[index]) ? frequenciesHz[index] : 1,
      1,
      safeSampleRate * 0.499,
    )
    let magnitude = 1
    for (const filter of coefficients) {
      magnitude *= guitarAmpBiquadMagnitude(filter, frequencyHz, safeSampleRate)
    }
    response[index] = 20 * Math.log10(Math.max(magnitude, Number.EPSILON))
  }
  return response
}

function normalizedTanh(input: number, amount: number): number {
  const finite = Number.isFinite(input) ? input : 0
  const bounded = clamp(finite, -1, 1)
  return Math.tanh(bounded * amount) / Math.tanh(amount)
}

/** The original memoryless drive seam, kept for callers and comparisons. */
export function shapeGuitarElectricDrive(input: number): number {
  return normalizedTanh(input, PREAMP_CURVE_AMOUNT)
}

function shapeFixedAsymmetricPreamp(input: number): number {
  const finite = Number.isFinite(input) ? input : 0
  const bounded = clamp(finite, -1, 1)
  const polarityScale =
    bounded >= 0 ? 1 + PREAMP_ASYMMETRY_AMOUNT : 1 - PREAMP_ASYMMETRY_AMOUNT
  return clamp(
    Math.tanh(bounded * PREAMP_CURVE_AMOUNT * polarityScale) /
      Math.tanh(PREAMP_CURVE_AMOUNT),
    -1,
    1,
  )
}

/** Pure equivalent of the ramp-controlled preamp branch. */
export function shapeGuitarElectricPreamp(
  input: number,
  drive = DEFAULT_GUITAR_ELECTRIC_AMP_PARAMETERS.drive,
  asymmetry = DEFAULT_GUITAR_ELECTRIC_AMP_PARAMETERS.asymmetry,
): number {
  const normalized = normalizeGuitarElectricAmpParameters({
    drive,
    asymmetry,
  })
  const voicing = computeGuitarElectricAmpVoicing(normalized)
  const driven = input * voicing.inputHeadroomGain * voicing.preampDriveGain
  const symmetric = normalizedTanh(driven, PREAMP_CURVE_AMOUNT)
  const asymmetric = shapeFixedAsymmetricPreamp(driven)
  return (
    (symmetric + (asymmetric - symmetric) * normalized.asymmetry) *
    voicing.preampCompensationGain
  )
}

/** Pure equivalent of the gentler downstream power-stage compression. */
export function shapeGuitarElectricPowerAmp(
  input: number,
  drive = DEFAULT_GUITAR_ELECTRIC_AMP_PARAMETERS.drive,
): number {
  const normalized = normalizeGuitarElectricAmpParameters({ drive })
  const voicing = computeGuitarElectricAmpVoicing(normalized)
  return (
    normalizedTanh(input * voicing.powerDriveGain, POWER_CURVE_AMOUNT) *
    voicing.powerCompensationGain
  )
}

function createCurve(
  shaper: (input: number) => number,
  sampleCount = 2048,
): Float32Array<ArrayBuffer> {
  const curve = new Float32Array(sampleCount)
  for (let index = 0; index < curve.length; index += 1) {
    const input = (index / (curve.length - 1)) * 2 - 1
    curve[index] = shaper(input)
  }
  return curve
}

const PREAMP_SYMMETRIC_CURVE = createCurve((input) =>
  normalizedTanh(input, PREAMP_CURVE_AMOUNT),
)
const PREAMP_ASYMMETRIC_CURVE = createCurve(shapeFixedAsymmetricPreamp)
const POWER_CURVE = createCurve((input) =>
  normalizedTanh(input, POWER_CURVE_AMOUNT),
)
const LEGACY_ELECTRIC_DRIVE_CURVE = createCurve(shapeGuitarElectricDrive, 1024)

/**
 * Build the exact pre-Guitar-Night amp used inside standalone electric voices.
 * Keep this intentionally small: those callers create one stage per voice.
 */
export function createLegacyGuitarElectricAmpStage(
  context: BaseAudioContext,
): LegacyGuitarElectricAmpStage {
  const drive = context.createWaveShaper()
  drive.curve = LEGACY_ELECTRIC_DRIVE_CURVE
  drive.oversample = '2x'

  const presence = context.createBiquadFilter()
  presence.type = 'peaking'
  presence.frequency.value = 2800
  presence.Q.value = 0.9
  presence.gain.value = 4

  const cabinet = context.createBiquadFilter()
  cabinet.type = 'lowpass'
  cabinet.frequency.value = 5000
  cabinet.Q.value = 0.7

  drive.connect(presence)
  presence.connect(cabinet)

  return {
    input: drive,
    output: cabinet,
    nodes: [drive, presence, cabinet],
  }
}

function setAudioParamTarget(
  parameter: AudioParam,
  target: number,
  atTime: number,
): void {
  const held = parameter.value
  if (typeof parameter.cancelAndHoldAtTime === 'function') {
    parameter.cancelAndHoldAtTime(atTime)
  } else {
    parameter.cancelScheduledValues(atTime)
    parameter.setValueAtTime(held, atTime)
  }
  parameter.setTargetAtTime(target, atTime, PARAMETER_TIME_CONSTANT_SECONDS)
}

function setInitialAudioParam(parameter: AudioParam, value: number): void {
  parameter.value = value
}

/**
 * Build one fixed amp/cabinet graph without activating the supplied context.
 * The input is band-limited from 45 Hz to 7.2 kHz, then shaped with a low
 * shelf at 120 Hz, broad mid bell at 750 Hz, high shelf at 2.8 kHz, and
 * presence at 3.8 kHz.
 */
export function createGuitarElectricAmpStage(
  context: BaseAudioContext,
  initial: Partial<GuitarElectricAmpParameters> = {},
): GuitarElectricAmpStage {
  const input = context.createGain()
  const output = context.createGain()
  const dry = context.createGain()
  const headroom = context.createGain()
  const inputHighpass = context.createBiquadFilter()
  const inputLowpass = context.createBiquadFilter()
  const preampDrive = context.createGain()
  const preampSymmetric = context.createWaveShaper()
  const preampAsymmetric = context.createWaveShaper()
  const preampSymmetricMix = context.createGain()
  const preampAsymmetricMix = context.createGain()
  const preampSum = context.createGain()
  const preampCompensation = context.createGain()
  const bass = context.createBiquadFilter()
  const mid = context.createBiquadFilter()
  const treble = context.createBiquadFilter()
  const powerDrive = context.createGain()
  const power = context.createWaveShaper()
  const powerCompensation = context.createGain()
  const presence = context.createBiquadFilter()
  const cabinetBody = context.createBiquadFilter()
  const cabinetHighpass = context.createBiquadFilter()
  const cabinetLowpass = context.createBiquadFilter()
  const outputLevel = context.createGain()
  const wet = context.createGain()

  inputHighpass.type = 'highpass'
  inputHighpass.frequency.value =
    GUITAR_ELECTRIC_AMP_FREQUENCIES_HZ.inputHighpass
  inputHighpass.Q.value = 0.7
  inputLowpass.type = 'lowpass'
  inputLowpass.frequency.value = GUITAR_ELECTRIC_AMP_FREQUENCIES_HZ.inputLowpass
  inputLowpass.Q.value = 0.55
  preampSymmetric.curve = PREAMP_SYMMETRIC_CURVE
  preampSymmetric.oversample = '2x'
  preampAsymmetric.curve = PREAMP_ASYMMETRIC_CURVE
  preampAsymmetric.oversample = '2x'
  bass.type = 'lowshelf'
  bass.frequency.value = GUITAR_ELECTRIC_AMP_FREQUENCIES_HZ.bass
  mid.type = 'peaking'
  mid.frequency.value = GUITAR_ELECTRIC_AMP_FREQUENCIES_HZ.mid
  mid.Q.value = 0.75
  treble.type = 'highshelf'
  treble.frequency.value = GUITAR_ELECTRIC_AMP_FREQUENCIES_HZ.treble
  power.curve = POWER_CURVE
  power.oversample = '2x'
  presence.type = 'peaking'
  presence.frequency.value = GUITAR_ELECTRIC_AMP_FREQUENCIES_HZ.presence
  presence.Q.value = 0.8
  cabinetBody.type = 'peaking'
  cabinetBody.frequency.value = GUITAR_ELECTRIC_AMP_FREQUENCIES_HZ.cabinetBody
  cabinetBody.Q.value = 0.72
  cabinetHighpass.type = 'highpass'
  cabinetHighpass.Q.value = 0.7
  cabinetLowpass.type = 'lowpass'
  cabinetLowpass.Q.value = 0.72

  input.connect(dry)
  dry.connect(output)
  input.connect(headroom)
  headroom.connect(inputHighpass)
  inputHighpass.connect(inputLowpass)
  inputLowpass.connect(preampDrive)
  preampDrive.connect(preampSymmetric)
  preampDrive.connect(preampAsymmetric)
  preampSymmetric.connect(preampSymmetricMix)
  preampAsymmetric.connect(preampAsymmetricMix)
  preampSymmetricMix.connect(preampSum)
  preampAsymmetricMix.connect(preampSum)
  preampSum.connect(preampCompensation)
  preampCompensation.connect(bass)
  bass.connect(mid)
  mid.connect(treble)
  treble.connect(powerDrive)
  powerDrive.connect(power)
  power.connect(powerCompensation)
  powerCompensation.connect(presence)
  presence.connect(cabinetBody)
  cabinetBody.connect(cabinetHighpass)
  cabinetHighpass.connect(cabinetLowpass)
  cabinetLowpass.connect(outputLevel)
  outputLevel.connect(wet)
  wet.connect(output)

  const nodes: readonly AudioNode[] = [
    input,
    dry,
    headroom,
    inputHighpass,
    inputLowpass,
    preampDrive,
    preampSymmetric,
    preampAsymmetric,
    preampSymmetricMix,
    preampAsymmetricMix,
    preampSum,
    preampCompensation,
    bass,
    mid,
    treble,
    powerDrive,
    power,
    powerCompensation,
    presence,
    cabinetBody,
    cabinetHighpass,
    cabinetLowpass,
    outputLevel,
    wet,
    output,
  ]

  let parameters = normalizeGuitarElectricAmpParameters(initial)
  let disposed = false

  const applyParameters = (
    next: GuitarElectricAmpParameters,
    atTime: number,
    immediate: boolean,
  ): void => {
    const voicing = computeGuitarElectricAmpVoicing(next)
    const assign = immediate ? setInitialAudioParam : setAudioParamTarget
    assign(headroom.gain, voicing.inputHeadroomGain, atTime)
    assign(preampDrive.gain, voicing.preampDriveGain, atTime)
    assign(preampSymmetricMix.gain, 1 - next.asymmetry, atTime)
    assign(preampAsymmetricMix.gain, next.asymmetry, atTime)
    assign(preampCompensation.gain, voicing.preampCompensationGain, atTime)
    assign(bass.gain, voicing.bassGainDb, atTime)
    assign(mid.gain, voicing.midGainDb, atTime)
    assign(treble.gain, voicing.trebleGainDb, atTime)
    assign(powerDrive.gain, voicing.powerDriveGain, atTime)
    assign(powerCompensation.gain, voicing.powerCompensationGain, atTime)
    assign(presence.gain, voicing.presenceGainDb, atTime)
    assign(cabinetBody.gain, voicing.cabinetBodyGainDb, atTime)
    assign(cabinetHighpass.frequency, voicing.cabinetHighpassHz, atTime)
    assign(cabinetLowpass.frequency, voicing.cabinetLowpassHz, atTime)
    assign(outputLevel.gain, voicing.outputGain, atTime)
    assign(wet.gain, next.enabled ? 1 : 0, atTime)
    assign(dry.gain, next.enabled ? 0 : 1, atTime)
  }

  setInitialAudioParam(input.gain, 1)
  setInitialAudioParam(output.gain, 1)
  applyParameters(parameters, context.currentTime, true)

  return {
    input,
    output,
    nodes,
    getParameters() {
      return { ...parameters }
    },
    setParameters(next, atTime = context.currentTime) {
      if (disposed) return { ...parameters }
      parameters = normalizeGuitarElectricAmpParameters(next, parameters)
      applyParameters(parameters, atTime, false)
      return { ...parameters }
    },
    setBypassed(bypassed, atTime = context.currentTime) {
      if (disposed) return
      parameters = { ...parameters, enabled: !bypassed }
      applyParameters(parameters, atTime, false)
    },
    dispose() {
      if (disposed) return
      disposed = true
      for (const node of nodes) node.disconnect()
    },
  }
}
