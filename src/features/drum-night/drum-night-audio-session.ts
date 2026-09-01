// ============================================================
// Drum Night audio session — one gesture-owned route output
// ============================================================
//
// Construction is deliberately inert. The kit player crosses this boundary
// only from Play or a live pad/key/MIDI strike; connecting MIDI requests only
// device permission. Teardown closes the context because no other route owns it.

export interface DrumNightAudioSession {
  contextForGesture(): AudioContext | null
  outputForGesture(): AudioNode | null
  /** Passive scheduler access; never creates or resumes a context. */
  activeContext(): AudioContext | null
  /** Passive output access; never creates or resumes an audio graph. */
  activeOutput(): AudioNode | null
  /** Map a performance timestamp only while the gesture-owned graph exists. */
  performanceTimestampToContextTime(timestampMs: number): number | null
  dispose(): Promise<void>
}

export interface DrumNightAudioSessionOptions {
  readonly createContext?: () => AudioContext
  readonly nowMs?: () => number
}

type SafariAudioWindow = typeof globalThis & {
  webkitAudioContext?: typeof AudioContext
}

export const DRUM_NIGHT_OUTPUT_MAKEUP_DB = 4
export const DRUM_NIGHT_OUTPUT_SAFETY_DB = -1
export const DRUM_NIGHT_OUTPUT_COMPRESSOR = Object.freeze({
  thresholdDb: -3,
  kneeDb: 2,
  ratio: 12,
  attackSeconds: 0.002,
  releaseSeconds: 0.12,
})

function dbToGain(decibels: number): number {
  return 10 ** (decibels / 20)
}

function disconnectNode(node: AudioNode | null): void {
  try {
    node?.disconnect()
  } catch {
    // A closed or partially-created graph may already have detached the node.
  }
}

function createBrowserAudioContext(): AudioContext {
  const AudioContextConstructor =
    globalThis.AudioContext ??
    (globalThis as SafariAudioWindow).webkitAudioContext
  if (AudioContextConstructor === undefined) {
    throw new Error('Web Audio is not available in this browser.')
  }
  return new AudioContextConstructor({ latencyHint: 'interactive' })
}

/** Create an inert route session; its first getter is the user-gesture seam. */
export function createDrumNightAudioSession(
  options: DrumNightAudioSessionOptions = {},
): DrumNightAudioSession {
  let context: AudioContext | null = null
  let makeup: GainNode | null = null
  let compressor: DynamicsCompressorNode | null = null
  let safety: GainNode | null = null
  let disposed = false

  const ensureSession = (): boolean => {
    if (disposed) return false
    if (
      context !== null &&
      makeup !== null &&
      compressor !== null &&
      safety !== null &&
      context.state !== 'closed'
    ) {
      return true
    }

    let nextContext: AudioContext | null = null
    let nextMakeup: GainNode | null = null
    let nextCompressor: DynamicsCompressorNode | null = null
    let nextSafety: GainNode | null = null
    try {
      nextContext = (options.createContext ?? createBrowserAudioContext)()
      nextMakeup = nextContext.createGain()
      nextCompressor = nextContext.createDynamicsCompressor()
      nextSafety = nextContext.createGain()
      nextMakeup.gain.setValueAtTime(
        dbToGain(DRUM_NIGHT_OUTPUT_MAKEUP_DB),
        nextContext.currentTime,
      )
      nextCompressor.threshold.setValueAtTime(
        DRUM_NIGHT_OUTPUT_COMPRESSOR.thresholdDb,
        nextContext.currentTime,
      )
      nextCompressor.knee.setValueAtTime(
        DRUM_NIGHT_OUTPUT_COMPRESSOR.kneeDb,
        nextContext.currentTime,
      )
      nextCompressor.ratio.setValueAtTime(
        DRUM_NIGHT_OUTPUT_COMPRESSOR.ratio,
        nextContext.currentTime,
      )
      nextCompressor.attack.setValueAtTime(
        DRUM_NIGHT_OUTPUT_COMPRESSOR.attackSeconds,
        nextContext.currentTime,
      )
      nextCompressor.release.setValueAtTime(
        DRUM_NIGHT_OUTPUT_COMPRESSOR.releaseSeconds,
        nextContext.currentTime,
      )
      nextSafety.gain.setValueAtTime(
        dbToGain(DRUM_NIGHT_OUTPUT_SAFETY_DB),
        nextContext.currentTime,
      )
      nextMakeup.connect(nextCompressor)
      nextCompressor.connect(nextSafety)
      nextSafety.connect(nextContext.destination)
      context = nextContext
      makeup = nextMakeup
      compressor = nextCompressor
      safety = nextSafety
      return true
    } catch {
      disconnectNode(nextMakeup)
      disconnectNode(nextCompressor)
      disconnectNode(nextSafety)
      if (nextContext !== null && nextContext.state !== 'closed') {
        void nextContext.close().catch(() => undefined)
      }
      context = null
      makeup = null
      compressor = null
      safety = null
      return false
    }
  }

  return {
    contextForGesture(): AudioContext | null {
      return ensureSession() ? context : null
    },
    outputForGesture(): AudioNode | null {
      return ensureSession() ? makeup : null
    },
    activeContext(): AudioContext | null {
      return context !== null && context.state !== 'closed' ? context : null
    },
    activeOutput(): AudioNode | null {
      return context !== null && context.state !== 'closed' ? makeup : null
    },
    performanceTimestampToContextTime(timestampMs: number): number | null {
      const activeContext =
        context !== null && context.state !== 'closed' ? context : null
      if (activeContext === null || !Number.isFinite(timestampMs)) return null
      const nowMs = (options.nowMs ?? (() => performance.now()))()
      if (!Number.isFinite(nowMs)) return null
      return activeContext.currentTime + (timestampMs - nowMs) / 1000
    },
    async dispose(): Promise<void> {
      if (disposed) return
      disposed = true
      const activeMakeup = makeup
      const activeCompressor = compressor
      const activeSafety = safety
      const activeContext = context
      makeup = null
      compressor = null
      safety = null
      context = null
      disconnectNode(activeMakeup)
      disconnectNode(activeCompressor)
      disconnectNode(activeSafety)
      if (activeContext !== null && activeContext.state !== 'closed') {
        await activeContext.close().catch(() => undefined)
      }
    },
  }
}
