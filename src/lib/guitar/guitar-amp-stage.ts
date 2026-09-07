// Guitar amp facade keeps stable ports, a working Lite fallback and bounded, click-free Studio graph changes.
import { loadGuitarAmpCabinet, reportGuitarAmpProcessingFailure, subscribeGuitarAmpCabinetStatus, } from './guitar-amp-cabinet'
import type { GuitarElectricAmpParameters, GuitarElectricAmpStage, } from './guitar-electric-amp'
import { createGuitarElectricAmpStage, normalizeGuitarElectricAmpParameters, } from './guitar-electric-amp'
import type { GuitarAmpProcessor } from './guitar-studio-processor'
import { createGuitarStudioProcessor, setGuitarAmpTarget, } from './guitar-studio-processor'

interface GuitarAmpStageOptions {
  /** Prepared-kernel seam for offline rendering; application callers load lazily. */
  cabinetBuffer?: AudioBuffer
  loadCabinet?: (context: BaseAudioContext) => Promise<AudioBuffer>
}

interface Slot {
  key: string
  processor: GuitarAmpProcessor
  gate: GainNode
}

export interface GuitarAmpStage extends GuitarElectricAmpStage {
  getStatus(): 'bypassed' | 'lite' | 'loading' | 'ready' | 'fallback'
}

function createPorts(context: BaseAudioContext): {
  input: GainNode
  output: GainNode
  dry: GainNode
} {
  const nodes: GainNode[] = []
  const gain = (): GainNode => {
    const node = context.createGain()
    nodes.push(node)
    return node
  }
  try {
    const input = gain()
    const output = gain()
    const dry = gain()
    input.connect(dry)
    dry.connect(output)
    return { input, output, dry }
  } catch (error) {
    for (const node of nodes) node.disconnect()
    throw error
  }
}

/** One facade per summed electric track or explicit DI monitor, never per string. */
export function createGuitarAmpStage(
  context: BaseAudioContext,
  initial?: Partial<GuitarElectricAmpParameters>,
  options: GuitarAmpStageOptions = {},
): GuitarAmpStage {
  let parameters = normalizeGuitarElectricAmpParameters(initial)
  const owner = {}
  const { input, output, dry } = createPorts(context)
  dry.gain.value = parameters.enabled ? 0 : 1
  let kernel = options.cabinetBuffer
  let loading = false
  let failed = false
  let disposed = false
  let current: Slot | undefined
  let retiring: Slot | undefined
  let timer: ReturnType<typeof setTimeout> | undefined
  let settleAt = 0
  let requestedAt = context.currentTime
  let removeResumeListener: (() => void) | undefined

  const desiredKey = (): string => {
    if (!parameters.enabled) return 'bypassed'
    if (parameters.engine !== 'studio' || kernel === undefined || failed)
      return 'lite'
    return parameters.head === 'heavy'
      ? 'studio-heavy'
      : `studio-${parameters.character ?? 1}`
  }
  const release = (slot: Slot | undefined): void => {
    if (slot === undefined) return
    input.disconnect(slot.processor.input)
    slot.processor.dispose()
    slot.gate.disconnect()
  }
  const build = (key: string): Slot => {
    const processor =
      key === 'lite'
        ? createGuitarElectricAmpStage(context, {
            ...parameters,
            enabled: true,
          })
        : createGuitarStudioProcessor(context, parameters, kernel!)
    let gate: GainNode | undefined
    let connected = false
    try {
      gate = context.createGain()
      gate.gain.value = 0
      input.connect(processor.input)
      connected = true
      processor.output.connect(gate)
      gate.connect(output)
      return { key, processor, gate }
    } catch (error) {
      if (connected) input.disconnect(processor.input)
      processor.dispose()
      gate?.disconnect()
      throw error
    }
  }
  const updateControls = (slot: Slot | undefined, at: number): void => {
    // Facade owns bypass. Neither processor may open a second dry path.
    slot?.processor.setParameters({ ...parameters, enabled: true }, at)
  }

  const reconcile = (initializing = false): void => {
    if (disposed || timer !== undefined) return
    const key = desiredKey()
    if (key === current?.key || (key === 'bypassed' && current === undefined))
      return
    let next: Slot | undefined
    if (key !== 'bypassed') {
      try {
        next = build(key)
      } catch {
        // Construction must not take working playback down. Keep its Lite path.
        failed = true
        reportGuitarAmpProcessingFailure(owner, true)
        if (current?.key === 'lite') return
        next = build('lite')
      }
    }
    if (initializing) {
      current = next
      if (current !== undefined) current.gate.gain.value = 1
      return
    }
    // Warm new stateful filters before admitting them. Coalesce rapid drags:
    // never allocate a third processor while this pair is crossing over.
    const at = Math.max(context.currentTime + 0.03, requestedAt)
    retiring = current
    current = next
    setGuitarAmpTarget(dry.gain, parameters.enabled ? 0 : 1, at)
    if (retiring !== undefined) setGuitarAmpTarget(retiring.gate.gain, 0, at)
    if (current !== undefined) setGuitarAmpTarget(current.gate.gain, 1, at)
    settleAt = at + 0.18
    const finish = (): void => {
      if (disposed) return
      if (context.state !== 'running' && context.state !== 'closed') {
        // A parked context needs no polling. Keep the transition ownership
        // until audio resumes, and remove this listener on either path.
        const resume = (): void => {
          if (context.state !== 'running' && context.state !== 'closed') return
          removeResumeListener?.()
          removeResumeListener = undefined
          finish()
        }
        context.addEventListener('statechange', resume)
        removeResumeListener = () =>
          context.removeEventListener('statechange', resume)
        return
      }
      // Wall time may pass while audio is suspended. Never truncate its fade.
      if (context.currentTime < settleAt && context.state !== 'closed') {
        timer = setTimeout(finish, 25)
        return
      }
      release(retiring)
      retiring = undefined
      timer = undefined
      reconcile()
    }
    timer = setTimeout(finish, 25)
  }

  const prepare = (): void => {
    if (
      disposed ||
      !parameters.enabled ||
      parameters.engine !== 'studio' ||
      kernel !== undefined ||
      loading ||
      failed
    )
      return
    loading = true
    void (options.loadCabinet ?? loadGuitarAmpCabinet)(context)
      .then((buffer) => {
        if (disposed) return
        loading = false
        kernel = buffer
        reconcile()
      })
      .catch(() => {
        if (disposed) return
        loading = false
        failed = true
      })
  }
  const unsubscribe = subscribeGuitarAmpCabinetStatus((status) => {
    if (status !== 'idle' || disposed) return
    failed = false
    kernel = undefined
    prepare()
  })
  try {
    reconcile(true)
    prepare()
  } catch (error) {
    unsubscribe()
    reportGuitarAmpProcessingFailure(owner, false)
    input.disconnect()
    dry.disconnect()
    output.disconnect()
    throw error
  }

  return {
    input,
    output,
    get nodes() {
      return [
        input,
        output,
        dry,
        ...(current === undefined
          ? []
          : [...current.processor.nodes, current.gate]),
        ...(retiring === undefined
          ? []
          : [...retiring.processor.nodes, retiring.gate]),
      ]
    },
    getParameters: () => ({ ...parameters }),
    getStatus() {
      if (!parameters.enabled) return 'bypassed'
      if (parameters.engine !== 'studio') return 'lite'
      if (failed) return 'fallback'
      return kernel === undefined ? 'loading' : 'ready'
    },
    setParameters(next, atTime = context.currentTime) {
      if (disposed) return { ...parameters }
      parameters = normalizeGuitarElectricAmpParameters(next, parameters)
      const at = Number.isFinite(atTime)
        ? Math.max(context.currentTime, atTime)
        : context.currentTime
      requestedAt = at
      // If no wet processor is ready yet, keep dry audible until reconcile
      // schedules the new processor and dry fade at the same audio time.
      if (!parameters.enabled || current !== undefined)
        setGuitarAmpTarget(dry.gain, parameters.enabled ? 0 : 1, at)
      updateControls(current, at)
      updateControls(retiring, at)
      // Bypass responds immediately even if a previous character fade is pending.
      if (!parameters.enabled) {
        if (current !== undefined) setGuitarAmpTarget(current.gate.gain, 0, at)
        if (retiring !== undefined)
          setGuitarAmpTarget(retiring.gate.gain, 0, at)
      } else if (current !== undefined) {
        setGuitarAmpTarget(current.gate.gain, 1, at)
      }
      reconcile()
      prepare()
      return { ...parameters }
    },
    setBypassed(bypassed, atTime) {
      this.setParameters({ enabled: !bypassed }, atTime)
    },
    dispose() {
      if (disposed) return
      disposed = true
      unsubscribe()
      reportGuitarAmpProcessingFailure(owner, false)
      removeResumeListener?.()
      if (timer !== undefined) clearTimeout(timer)
      release(current)
      release(retiring)
      current = undefined
      retiring = undefined
      input.disconnect()
      dry.disconnect()
      output.disconnect()
    },
  }
}
