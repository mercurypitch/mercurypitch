// Guitar Studio processor wraps a prepared head with live controls and the approved full-length cabinet.
import { GUITAR_AMP_CABINET_TRIM_DB } from './guitar-amp-cabinet'
import type { GuitarElectricAmpParameters } from './guitar-electric-amp'
import { createGuitarStudioHead } from './guitar-studio-head'

export interface GuitarAmpProcessor {
  input: AudioNode
  output: AudioNode
  nodes: readonly AudioNode[]
  setParameters(parameters: GuitarElectricAmpParameters, at: number): void
  dispose(): void
}

/** Hold the instantaneous value before replacing automation on a live control. */
export function setGuitarAmpTarget(
  param: AudioParam,
  value: number,
  at: number,
): void {
  const held = param.value
  if (typeof param.cancelAndHoldAtTime === 'function')
    param.cancelAndHoldAtTime(at)
  else {
    param.cancelScheduledValues(at)
    param.setValueAtTime(held, at)
  }
  param.setTargetAtTime(value, at, 0.012)
}

/** Neither creates a context nor opens an input; the caller owns activation. */
export function createGuitarStudioProcessor(
  context: BaseAudioContext,
  parameters: GuitarElectricAmpParameters,
  kernel: AudioBuffer,
): GuitarAmpProcessor {
  const head = createGuitarStudioHead(context, {
    head: parameters.head ?? 'definition',
    character: parameters.character ?? 1,
  })
  const nodes: AudioNode[] = [...head.nodes]
  let disposed = false
  let convolver: ConvolverNode | undefined
  const own = <T extends AudioNode>(node: T): T => {
    nodes.push(node)
    return node
  }
  const dispose = (): void => {
    if (disposed) return
    disposed = true
    head.dispose()
    for (const node of nodes.slice(head.nodes.length)) node.disconnect()
    if (convolver !== undefined) convolver.buffer = null
  }
  try {
    const input = own(context.createGain())
    const output = own(context.createGain())
    const filter = (
      type: BiquadFilterType,
      frequency: number,
    ): BiquadFilterNode => {
      const node = own(context.createBiquadFilter())
      node.type = type
      node.frequency.value = Math.min(frequency, context.sampleRate * 0.45)
      node.Q.value = Math.SQRT1_2
      return node
    }
    const bass = filter('lowshelf', 120)
    const mid = filter('peaking', 750)
    const treble = filter('highshelf', 2800)
    const presence = filter('peaking', 3800)
    convolver = own(context.createConvolver())
    convolver.normalize = false
    convolver.buffer = kernel
    // The audition cabinet replaces the Lite filters; never double-cabinet.
    input.connect(head.input)
    head.output.connect(bass)
    bass.connect(mid)
    mid.connect(treble)
    treble.connect(presence)
    presence.connect(convolver)
    convolver.connect(output)
    const controls = (
      next: GuitarElectricAmpParameters,
    ): [AudioParam, number][] => [
      [input.gain, 10 ** (((next.drive - 0.7) * 24) / 20)],
      [bass.gain, next.bass * 8],
      [mid.gain, next.mid * 8],
      [treble.gain, next.treble * 6],
      [presence.gain, next.presence * 4],
      [
        output.gain,
        10 ** ((GUITAR_AMP_CABINET_TRIM_DB + (next.output - 0.6) * 20) / 20),
      ],
    ]
    for (const [param, value] of controls(parameters)) param.value = value
    return {
      input,
      output,
      nodes,
      setParameters(next, at) {
        if (disposed) return
        for (const [param, value] of controls(next))
          setGuitarAmpTarget(param, value, at)
      },
      dispose,
    }
  } catch (error) {
    dispose()
    throw error
  }
}
