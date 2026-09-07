// ============================================================
// Guitar studio head — immutable cascaded drive with bounded envelope memory.
// ============================================================
// Promotes the auditioned recipes without a cabinet or transport owner. This
// is a tone model, not a physical amplifier simulation. Build a replacement
// while inaudible; the caller owns live crossfades, source envelopes, cabinet,
// and output level, and disposes this graph only after its signal is silent.

export type GuitarStudioHeadModel = 'definition' | 'heavy' | 'lead'

export interface GuitarStudioHeadOptions {
  head: GuitarStudioHeadModel
  character: number
}

export interface GuitarStudioHeadStage {
  readonly input: GainNode
  readonly output: GainNode
  readonly nodes: readonly AudioNode[]
  dispose(): void
}

export interface GuitarStudioHeadProfile {
  readonly curveLength: number
  readonly oversample: OverSampleType
  readonly preampGain: number
  readonly interstageGain: number
  readonly powerDrive: number
  readonly envelopeHz: number
  readonly sagDepth: number
  readonly outputGain: number
  readonly inputHighpassHz: number
  readonly inputLowpassHz: number
  readonly preampSlope: number
  readonly preampAsymmetry: number
  readonly couplingHz: number
  readonly interstageLowpassHz: number
  readonly interstageSlope: number
  readonly interstageAsymmetry: number
  readonly powerCouplingHz: number
  readonly powerSlope: number
  readonly powerAsymmetry: number
  readonly outputHighpassHz: number
  readonly outputLowpassHz: number
  readonly preBassHz: number
  readonly preBassDb: number
  readonly bodyHz: number
  readonly bodyDb: number
  readonly fizzHz: number
  readonly fizzQ: number
  readonly fizzDb: number
  /** Optional post-clipping bell; absent on the original auditioned heads. */
  readonly midVoicing?: Readonly<{
    frequencyHz: number
    q: number
    gainDb: number
  }>
}

const HEAVY: GuitarStudioHeadProfile = Object.freeze({
  curveLength: 4097,
  oversample: '4x',
  preampGain: 9,
  interstageGain: 2.5,
  powerDrive: 1.3,
  envelopeHz: 10,
  sagDepth: 0.22,
  outputGain: 0.3,
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

const ARTICULATE: GuitarStudioHeadProfile = Object.freeze({
  ...HEAVY,
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
})

const TIGHT: GuitarStudioHeadProfile = Object.freeze({
  ...HEAVY,
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
})

// First solo-head audition: earlier saturation lifts a decaying note without
// the Heavy head's harder final clipping. Low-end cleanup happens before
// drive; a broad mid bell and a softer upper edge follow it. This is not a
// compressor, noise gate, reference-amp capture, or a delay/reverb preset.
const LEAD: GuitarStudioHeadProfile = Object.freeze({
  ...HEAVY,
  preampGain: 11.5,
  interstageGain: 2.1,
  powerDrive: 1.15,
  preampSlope: 2.65,
  preampAsymmetry: 0.22,
  interstageSlope: 1.85,
  interstageAsymmetry: -0.1,
  powerSlope: 1.4,
  powerAsymmetry: 0.04,
  inputHighpassHz: 75,
  couplingHz: 100,
  interstageLowpassHz: 4300,
  outputLowpassHz: 7000,
  preBassDb: -5.5,
  bodyDb: 1.5,
  fizzHz: 3300,
  fizzQ: 0.8,
  fizzDb: -3.5,
  envelopeHz: 8,
  sagDepth: 0.16,
  outputGain: 0.25,
  midVoicing: Object.freeze({ frequencyHz: 1200, q: 0.7, gainDb: 3 }),
})

export function normalizeGuitarStudioHeadOptions(
  options: Partial<GuitarStudioHeadOptions> = {},
): Readonly<GuitarStudioHeadOptions> {
  return Object.freeze({
    head:
      options.head === 'heavy' || options.head === 'lead'
        ? options.head
        : 'definition',
    character:
      typeof options.character === 'number' &&
      Number.isFinite(options.character)
        ? Math.max(0, Math.min(1, options.character))
        : 1,
  })
}

export function getGuitarStudioHeadProfile(
  options: GuitarStudioHeadOptions,
): GuitarStudioHeadProfile {
  const { head, character } = normalizeGuitarStudioHeadOptions(options)
  if (head === 'heavy') return HEAVY
  if (head === 'lead') return LEAD
  // Literal endpoints preserve the audition's exact coefficients and PCM.
  if (character === 0) return ARTICULATE
  if (character === 1) return TIGHT
  const values = Object.entries(ARTICULATE).map(([key, start]) => [
    key,
    typeof start === 'number'
      ? start +
        ((TIGHT[key as keyof GuitarStudioHeadProfile] as number) - start) *
          character
      : start,
  ])
  return Object.freeze(Object.fromEntries(values)) as GuitarStudioHeadProfile
}

/** The transfer is zero at silence; slope bounds keep every skew monotonic. */
export function shapeGuitarStudioHead(
  sample: number,
  asymmetry = 0.35,
  slope = 2.7,
): number {
  if (!Number.isFinite(sample)) return 0
  const x = Math.max(-1, Math.min(1, sample))
  const skew = Number.isFinite(asymmetry)
    ? Math.max(-0.45, Math.min(0.45, asymmetry))
    : 0
  const boundedSlope = Number.isFinite(slope)
    ? Math.max(1, Math.min(4, slope))
    : 2.7
  return (
    Math.tanh(boundedSlope * x + skew * x * x) /
    Math.tanh(boundedSlope + Math.abs(skew))
  )
}

export type GuitarStudioHeadCurve =
  | 'preamp'
  | 'interstage'
  | 'power'
  | 'rectify'
  | 'envelope'

export function createGuitarStudioHeadCurve(
  kind: GuitarStudioHeadCurve,
  profile: GuitarStudioHeadProfile,
): Float32Array<ArrayBuffer> {
  const transfers: Record<GuitarStudioHeadCurve, (sample: number) => number> = {
    preamp: (x) =>
      shapeGuitarStudioHead(x, profile.preampAsymmetry, profile.preampSlope),
    interstage: (x) =>
      shapeGuitarStudioHead(
        x,
        profile.interstageAsymmetry,
        profile.interstageSlope,
      ),
    power: (x) =>
      shapeGuitarStudioHead(x, profile.powerAsymmetry, profile.powerSlope),
    rectify: (x) => Math.abs(x),
    envelope: (x) => Math.max(0, Math.min(1, x)),
  }
  if (!Object.hasOwn(transfers, kind))
    throw new Error(`Unknown studio head curve: ${kind}`)
  return Float32Array.from({ length: profile.curveLength }, (_, index) =>
    transfers[kind]((2 * index) / (profile.curveLength - 1) - 1),
  )
}

export function createGuitarStudioHead(
  context: BaseAudioContext,
  options: GuitarStudioHeadOptions,
): GuitarStudioHeadStage {
  const profile = getGuitarStudioHeadProfile(options)
  const nodes: AudioNode[] = []
  let disposed = false
  const own = <T extends AudioNode>(node: T): T => {
    nodes.push(node)
    return node
  }
  const gain = (value: number): GainNode => {
    const node = own(context.createGain())
    node.gain.value = value
    return node
  }
  const filter = (
    type: BiquadFilterType,
    frequency: number,
    q = Math.SQRT1_2,
    gainDb = 0,
  ): BiquadFilterNode => {
    const node = own(context.createBiquadFilter())
    node.type = type
    node.frequency.value = Math.min(frequency, context.sampleRate * 0.45)
    node.Q.value = q
    if (gainDb !== 0) node.gain.value = gainDb
    return node
  }
  const shaper = (
    kind: GuitarStudioHeadCurve,
    oversample: OverSampleType = profile.oversample,
  ): WaveShaperNode => {
    const node = own(context.createWaveShaper())
    node.curve = createGuitarStudioHeadCurve(kind, profile)
    node.oversample = oversample
    return node
  }
  const connect = (...chain: AudioNode[]): void => {
    for (let index = 1; index < chain.length; index++)
      chain[index - 1].connect(chain[index])
  }
  const dispose = (): void => {
    if (disposed) return
    disposed = true
    for (const node of nodes) node.disconnect()
  }

  try {
    const input = gain(1)
    const output = gain(profile.outputGain)
    const inputHighpass = filter('highpass', profile.inputHighpassHz)
    const inputLowpass = filter('lowpass', profile.inputLowpassHz)
    const preampDrive = gain(profile.preampGain)
    const preamp = shaper('preamp')
    const coupling = filter('highpass', profile.couplingHz)
    const interstageLowpass = filter('lowpass', profile.interstageLowpassHz)
    const interstageDrive = gain(profile.interstageGain)
    const interstage = shaper('interstage')
    const powerCoupling = filter('highpass', profile.powerCouplingHz)
    const attenuation = gain(1)
    const powerDrive = gain(profile.powerDrive)
    const power = shaper('power')
    const outputHighpass = filter('highpass', profile.outputHighpassHz)
    const outputLowpass = filter('lowpass', profile.outputLowpassHz)
    // Heavy omits these filters exactly as in the original audition. The
    // Definition shelf removes bass before saturation, restoring body only
    // after all clipping; it is not a final-output bass EQ or a clean blend.
    const preBass =
      profile.preBassDb !== 0
        ? [
            filter(
              'lowshelf',
              profile.preBassHz,
              Math.SQRT1_2,
              profile.preBassDb,
            ),
          ]
        : []
    const body =
      profile.bodyDb !== 0
        ? [filter('lowshelf', profile.bodyHz, Math.SQRT1_2, profile.bodyDb)]
        : []
    const fizz =
      profile.fizzDb !== 0
        ? [filter('peaking', profile.fizzHz, profile.fizzQ, profile.fizzDb)]
        : []
    const mid =
      profile.midVoicing === undefined
        ? []
        : [
            filter(
              'peaking',
              profile.midVoicing.frequencyHz,
              profile.midVoicing.q,
              profile.midVoicing.gainDb,
            ),
          ]
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
      ...mid,
      ...fizz,
      outputLowpass,
      output,
    )

    // Feed-forward rectified history, not a physical supply simulation. The
    // critically damped envelope is clamped even through filter transients,
    // keeping this additive AudioParam modulation in [1-sagDepth, 1].
    const rectifier = shaper('rectify', 'none')
    const envelope = filter('lowpass', profile.envelopeHz, 0.5)
    const boundedEnvelope = shaper('envelope', 'none')
    const depth = gain(-profile.sagDepth)
    connect(interstage, rectifier, envelope, boundedEnvelope, depth)
    depth.connect(attenuation.gain)

    return { input, output, nodes: Object.freeze(nodes), dispose }
  } catch (error) {
    dispose()
    throw error
  }
}
