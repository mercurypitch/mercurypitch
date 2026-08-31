// Guitar electric amp — one asset-free, route-owned amplifier and cabinet stage.
// ============================================================
//
// The public input and output are stable GainNodes. Every live control is an
// AudioParam, so changing a preset never swaps a node or replaces a shaper
// curve while audio is running. This matters for both summed guide voices and
// the optional direct-input monitor, which can share the same parameter state.

const PREAMP_CURVE_AMOUNT = 2.5
const POWER_CURVE_AMOUNT = 1.35
const PREAMP_ASYMMETRY_AMOUNT = 0.16
const PARAMETER_TIME_CONSTANT_SECONDS = 0.018

export const GUITAR_ELECTRIC_AMP_FREQUENCIES_HZ = Object.freeze({
  inputHighpass: 45,
  bass: 120,
  mid: 750,
  treble: 3200,
  presence: 4200,
  cabinetBody: 1800,
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
    drive: 0.5,
    bass: 0,
    mid: 0,
    treble: 0,
    presence: 2 / 3,
    output: 0.8,
    cabinet: 'balanced',
    asymmetry: 0.16,
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
    preampDriveGain: dbToGain(-6 + normalized.drive * 12),
    preampCompensationGain: dbToGain(-normalized.drive * 1.5),
    powerDriveGain: dbToGain(-2 + normalized.drive * 4),
    powerCompensationGain: dbToGain(-normalized.drive * 0.75),
    bassGainDb: normalized.bass * 9,
    midGainDb: normalized.mid * 10,
    trebleGainDb: normalized.treble * 8,
    presenceGainDb: normalized.presence * 6,
    cabinetBodyGainDb: cabinetPosition * 2.8,
    cabinetHighpassHz: 65 + cabinetPosition * 25,
    cabinetLowpassHz: 7500 - cabinetPosition * 4000,
    outputGain: dbToGain(-12 + normalized.output * 15),
  }
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
 * All tone controls are conventional approximations: low shelf at 120 Hz,
 * broad mid bell at 750 Hz, high shelf at 3.2 kHz, and presence at 4.2 kHz.
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
  inputHighpass.connect(preampDrive)
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
