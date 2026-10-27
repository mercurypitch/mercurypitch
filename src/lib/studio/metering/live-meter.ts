// Studio live-meter attachment — borrowed context, silent analysis branches and bounded cleanup.
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
function ownMeterProcessor<T>(
  context: AudioContext,
  node: AudioWorkletNode,
  release: () => void,
  receive: (data: T) => void,
) {
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
  node.port.onmessage = (event: MessageEvent<T | { kind: 'disposed' }>) => {
    const data = event.data
    if (typeof data === 'object' && data !== null && 'kind' in data) finish()
    else if (!disposed) receive(data as T)
  }
  return {
    clearPeakHold: () => {
      if (!disposed) node.port.postMessage('clear-hold')
    },
    dispose() {
      if (disposed) return
      disposed = true
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
  let snapshot: StudioMeterSnapshot | null = null
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
    owner = ownMeterProcessor<StudioMeterSnapshot>(
      context,
      node,
      release,
      (data) => {
        snapshot = data
      },
    )
    sink = context.createGain()
    sink.gain.value = 0
    source.connect(node)
    node.connect(sink)
    sink.connect(context.destination)
    const owned = owner
    let disposed = false
    return {
      read: () => snapshot,
      clearPeakHold: owned.clearPeakHold,
      dispose() {
        if (disposed) return
        disposed = true
        snapshot = null
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

/**
 * Every lane's post-fader peak through one worklet node, an input per lane:
 * each lane is tapped once, and the audio thread sends all of them about 30
 * times a second. Peaks are the louder channel's, so a lane panned hard to
 * one side reads its true level instead of a mono sum 6 dB under it.
 */
export function createStudioLaneMeter(
  context: AudioContext,
  lanes: ReadonlyMap<string, AudioNode>,
  startAtTime: number,
) {
  if (!ready.has(context) || lanes.size === 0) return null
  const ids = [...lanes.keys()]
  // The highest sample each lane sent since the last read, and whether any came.
  const peaks = new Float32Array(ids.length)
  let fresh = false
  let node: AudioWorkletNode | undefined
  let sink: GainNode | undefined
  let owner: ReturnType<typeof ownMeterProcessor> | undefined
  const tapped: AudioNode[] = []
  const disconnect = () => {
    for (const lane of tapped) {
      try {
        lane.disconnect(node!)
      } catch {
        /* Already gone with its graph. */
      }
    }
    node?.disconnect()
    sink?.disconnect()
  }
  try {
    node = new AudioWorkletNode(context, 'studio-lane-meter', {
      numberOfInputs: ids.length,
      numberOfOutputs: 1,
      outputChannelCount: [1],
      channelCount: 2,
      channelCountMode: 'explicit',
      channelInterpretation: 'speakers',
      processorOptions: { startAtTime },
    })
    owner = ownMeterProcessor<Float32Array>(
      context,
      node,
      () => {},
      (data) => {
        for (let lane = 0; lane < peaks.length; lane++)
          peaks[lane] = Math.max(peaks[lane], data[lane] ?? 0)
        fresh = true
      },
    )
    sink = context.createGain()
    sink.gain.value = 0
    for (const [index, id] of ids.entries()) {
      const lane = lanes.get(id)!
      lane.connect(node, 0, index)
      tapped.push(lane)
    }
    node.connect(sink)
    sink.connect(context.destination)
    const owned = owner
    let disposed = false
    return {
      /**
       * Each lane's peak since the last read, as a linear amplitude; reading
       * clears them. Null when nothing came since: the audio thread sends
       * about as often as the meter tick reads, so some ticks find nothing,
       * and that is not silence.
       */
      read(): ReadonlyMap<string, number> | null {
        if (!fresh) return null
        fresh = false
        const read = new Map<string, number>()
        for (const [index, id] of ids.entries()) read.set(id, peaks[index])
        peaks.fill(0)
        return read
      },
      dispose() {
        if (disposed) return
        disposed = true
        disconnect()
        owned.dispose()
      },
    }
  } catch {
    disconnect()
    owner?.dispose()
    return null
  }
}
