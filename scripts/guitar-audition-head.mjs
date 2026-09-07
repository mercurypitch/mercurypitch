// ============================================================
// Guitar audition head — developer-only nonlinear, stateful tone experiment.
// ============================================================
// Not a physical amplifier model or production dependency. No cabinet is
// included: the harness supplies the same cabinet and output level matching.
// The caller owns source envelopes and disposes only after playback is silent.

export const AUDITION_HEAD_SETTINGS = Object.freeze({
  curveLength: 4097,
  oversample: '4x',
  preampGain: 9,
  interstageGain: 2.5,
  powerDrive: 1.3,
  envelopeHz: 10,
  sagDepth: 0.22,
  outputGain: 0.3,
})

const ORIGINAL_PROFILE = Object.freeze({
  ...AUDITION_HEAD_SETTINGS,
  inputHighpassHz: 70,
  inputLowpassHz: 6500,
  preampSlope: 2.7,
  preampAsymmetry: 0.35,
  couplingHz: 100,
  interstageLowpassHz: 4300,
  interstageSlope: 2.7,
  interstageAsymmetry: -0.2,
  powerCouplingHz: 35,
  powerSlope: 2.7,
  powerAsymmetry: 0.12,
  outputHighpassHz: 25,
  outputLowpassHz: 8500,
  preBassHz: 220,
  preBassDb: 0,
  bodyHz: 180,
  bodyDb: 0,
  fizzHz: 3200,
  fizzQ: 0.8,
  fizzDb: 0,
})

// Fixed listening alternatives, not app presets or claims of circuit accuracy.
// Both reduce low-frequency energy before clipping, then restore some body
// AFTER all clipping. This is not equivalent to a bass EQ on the finished tone:
// fewer low fundamentals compete for headroom inside the nonlinear stages.
// Articulate asks whether less downstream flattening keeps overlapping picks;
// tight keeps more preamp drive, with a deeper pre-clipping low shelf.
export const AUDITION_HEAD_PROFILES = Object.freeze({
  original: ORIGINAL_PROFILE,
  articulate: Object.freeze({
    ...ORIGINAL_PROFILE,
    preampGain: 5.5,
    interstageGain: 1.45,
    powerDrive: 1.05,
    preampSlope: 2.35,
    preampAsymmetry: 0.15,
    interstageSlope: 1.55,
    interstageAsymmetry: -0.06,
    powerSlope: 1.2,
    powerAsymmetry: 0.02,
    inputHighpassHz: 75,
    couplingHz: 95,
    interstageLowpassHz: 4500,
    outputLowpassHz: 7500,
    preBassDb: -4,
    bodyDb: 2.5,
    fizzDb: -2.5,
    sagDepth: 0.1,
  }),
  tight: Object.freeze({
    ...ORIGINAL_PROFILE,
    preampGain: 8,
    interstageGain: 1.8,
    powerDrive: 1.1,
    preampSlope: 2.5,
    preampAsymmetry: 0.2,
    interstageSlope: 1.65,
    interstageAsymmetry: -0.08,
    powerSlope: 1.25,
    powerAsymmetry: 0.04,
    inputHighpassHz: 85,
    couplingHz: 110,
    interstageLowpassHz: 4600,
    outputLowpassHz: 7600,
    preBassDb: -6,
    bodyDb: 3,
    fizzHz: 3400,
    fizzQ: 0.85,
    fizzDb: -2,
    sagDepth: 0.08,
  }),
})

export function getAuditionHeadSettings(profile = 'original') {
  if (!Object.hasOwn(AUDITION_HEAD_PROFILES, profile)) {
    throw new Error(`Unknown audition head profile: ${profile}`)
  }
  return AUDITION_HEAD_PROFILES[profile]
}

/** A zero-centered asymmetric transfer; input beyond the LUT rails saturates. */
export function auditionSoftClip(sample, asymmetry = 0.35, slope = 2.7) {
  if (!Number.isFinite(sample)) return 0
  const x = Math.max(-1, Math.min(1, sample))
  const skew = Number.isFinite(asymmetry)
    ? Math.max(-0.45, Math.min(0.45, asymmetry))
    : 0
  // A slope above twice the maximum skew keeps the transfer monotonic.
  const boundedSlope = Number.isFinite(slope)
    ? Math.max(1, Math.min(4, slope))
    : 2.7
  return (
    Math.tanh(boundedSlope * x + skew * x * x) /
    Math.tanh(boundedSlope + Math.abs(skew))
  )
}

export function createAuditionCurve(kind, profile = 'original') {
  const settings = getAuditionHeadSettings(profile)
  const transfers = {
    preamp: (x) =>
      auditionSoftClip(x, settings.preampAsymmetry, settings.preampSlope),
    interstage: (x) =>
      auditionSoftClip(
        x,
        settings.interstageAsymmetry,
        settings.interstageSlope,
      ),
    power: (x) =>
      auditionSoftClip(x, settings.powerAsymmetry, settings.powerSlope),
    rectify: (x) => Math.abs(x),
    envelope: (x) => Math.max(0, Math.min(1, x)),
  }
  const transfer = transfers[kind]
  if (typeof transfer !== 'function' || !Object.hasOwn(transfers, kind)) {
    throw new Error(`Unknown audition curve: ${kind}`)
  }
  const length = settings.curveLength
  return Float32Array.from({ length }, (_, index) =>
    transfer((2 * index) / (length - 1) - 1),
  )
}

/** Build while stopped; no destination connection, source, timer or worklet. */
export function createAuditionHead(
  context,
  { sag = true, profile = 'original' } = {},
) {
  const settings = getAuditionHeadSettings(profile)
  const nodes = []
  let disposed = false
  const own = (node) => {
    nodes.push(node)
    return node
  }
  const gain = (value) => {
    const node = own(context.createGain())
    node.gain.value = value
    return node
  }
  const filter = (type, frequency, q = Math.SQRT1_2, gainDb = 0) => {
    const node = own(context.createBiquadFilter())
    node.type = type
    node.frequency.value = Math.min(frequency, context.sampleRate * 0.45)
    node.Q.value = q
    if (gainDb !== 0) node.gain.value = gainDb
    return node
  }
  const shaper = (kind, oversample = settings.oversample) => {
    const node = own(context.createWaveShaper())
    node.curve = createAuditionCurve(kind, profile)
    node.oversample = oversample
    return node
  }
  const connect = (...chain) => {
    for (let i = 1; i < chain.length; i++) chain[i - 1].connect(chain[i])
  }
  const dispose = () => {
    if (disposed) return
    disposed = true
    for (const node of nodes) node.disconnect()
  }

  try {
    const input = gain(1)
    const output = gain(settings.outputGain)
    const inputHighpass = filter('highpass', settings.inputHighpassHz)
    const inputLowpass = filter('lowpass', settings.inputLowpassHz)
    const preampDrive = gain(settings.preampGain)
    const preamp = shaper('preamp')
    const coupling = filter('highpass', settings.couplingHz)
    const interstageLowpass = filter('lowpass', settings.interstageLowpassHz)
    const interstageDrive = gain(settings.interstageGain)
    const interstage = shaper('interstage')
    const powerCoupling = filter('highpass', settings.powerCouplingHz)
    const attenuation = gain(1)
    const powerDrive = gain(settings.powerDrive)
    const power = shaper('power')
    const outputHighpass = filter('highpass', settings.outputHighpassHz)
    const outputLowpass = filter('lowpass', settings.outputLowpassHz)
    // Do not allocate pass-through EQ for the original: its graph and lookup
    // bytes stay identical to the first owner listening control.
    const preBass =
      settings.preBassDb !== 0
        ? [
            filter(
              'lowshelf',
              settings.preBassHz,
              Math.SQRT1_2,
              settings.preBassDb,
            ),
          ]
        : []
    const body =
      settings.bodyDb !== 0
        ? [filter('lowshelf', settings.bodyHz, Math.SQRT1_2, settings.bodyDb)]
        : []
    const fizz =
      settings.fizzDb !== 0
        ? [filter('peaking', settings.fizzHz, settings.fizzQ, settings.fizzDb)]
        : []

    connect(
      input,
      inputHighpass,
      inputLowpass,
      ...preBass,
      preampDrive,
      preamp,
      coupling,
      interstageLowpass,
      interstageDrive,
      interstage,
      powerCoupling,
      attenuation,
      powerDrive,
      power,
      outputHighpass,
      ...body,
      ...fizz,
      outputLowpass,
      output,
    )

    if (sag) {
      // Feed-forward history dependence, not circuit/power-supply simulation.
      // Rectified clipped amplitude → critically damped 10 Hz envelope. Clamp
      // even filter transients to [0,1], keeping power gain in [1-sagDepth,1].
      // AudioParam input adds to the fixed base 1; nothing feeds the head input.
      const rectifier = shaper('rectify', 'none')
      const envelope = filter('lowpass', settings.envelopeHz, 0.5)
      const boundedEnvelope = shaper('envelope', 'none')
      const depth = gain(-settings.sagDepth)
      connect(interstage, rectifier, envelope, boundedEnvelope, depth)
      depth.connect(attenuation.gain)
    }

    return { input, output, nodes, dispose }
  } catch (error) {
    dispose()
    throw error
  }
}
