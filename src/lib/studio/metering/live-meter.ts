// Studio live-meter attachment — borrowed context, silent analysis branch and bounded cleanup.
import { reserveStudioMemory } from '../memory-budget'
import workletUrl from './meter.worklet.ts?worker&url'
import type { StudioMeterSnapshot } from './stream-meter'
import { studioMeterWorkingBytes } from './stream-meter'

const loading = new WeakMap<AudioContext, Promise<boolean>>()
const ready = new WeakSet<AudioContext>()

export function prepareStudioLiveMeter(
  context: AudioContext,
): Promise<boolean> {
  if (typeof context.audioWorklet?.addModule !== 'function')
    return Promise.resolve(false)
  let pending = loading.get(context)
  if (!pending) {
    pending = context.audioWorklet
      .addModule(workletUrl)
      .then(() => {
        ready.add(context)
        return true
      })
      .catch(() => {
        loading.delete(context)
        return false
      })
    loading.set(context, pending)
  }
  return pending
}

/** A borrowed clock can outlive this graph; disconnect alone does not stop a worklet. */
function ownMeterProcessor(
  context: AudioContext,
  node: AudioWorkletNode,
  release: () => void,
) {
  let snapshot: StudioMeterSnapshot | null = null
  let disposed = false
  let released = false
  const finish = () => {
    if (released) return
    released = true
    context.removeEventListener('statechange', closed)
    node.port.onmessage = null
    node.port.close()
    release()
  }
  const closed = () => {
    if (context.state === 'closed') finish()
  }
  node.port.onmessage = (
    event: MessageEvent<StudioMeterSnapshot | { kind: 'disposed' }>,
  ) => {
    if ('kind' in event.data) finish()
    else if (!disposed) snapshot = event.data
  }
  return {
    read: () => snapshot,
    clearPeakHold: () => {
      if (!disposed) node.port.postMessage('clear-hold')
    },
    dispose() {
      if (disposed) return
      disposed = true
      snapshot = null
      context.addEventListener('statechange', closed)
      if (context.state === 'closed') finish()
      else node.port.postMessage('dispose')
    },
  }
}

export function createStudioLiveMeter(
  context: AudioContext,
  source: AudioNode,
  startAtTime: number,
) {
  if (!ready.has(context)) return null
  const release = reserveStudioMemory(
    studioMeterWorkingBytes({ sampleRate: context.sampleRate, channels: 2 }),
  )
  let node: AudioWorkletNode | undefined
  let sink: GainNode | undefined
  let owner: ReturnType<typeof ownMeterProcessor> | undefined
  const disconnect = () => {
    if (node) {
      try {
        source.disconnect(node)
      } catch {
        /* The branch may not have connected. */
      }
      node.disconnect()
    }
    sink?.disconnect()
  }
  try {
    node = new AudioWorkletNode(context, 'studio-meter', {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [2],
      channelCount: 2,
      channelCountMode: 'explicit',
      channelInterpretation: 'speakers',
      processorOptions: { startAtTime },
    })
    owner = ownMeterProcessor(context, node, release)
    sink = context.createGain()
    sink.gain.value = 0
    source.connect(node)
    node.connect(sink)
    sink.connect(context.destination)
    const owned = owner
    let disposed = false
    return {
      read: owned.read,
      clearPeakHold: owned.clearPeakHold,
      dispose() {
        if (disposed) return
        disposed = true
        disconnect()
        owned.dispose()
      },
    }
  } catch {
    disconnect()
    if (owner) owner.dispose()
    else release()
    return null
  }
}
