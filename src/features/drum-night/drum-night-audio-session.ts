// ============================================================
// Drum Night audio session — one gesture-owned route output
// ============================================================
//
// Construction is deliberately inert. The kit player crosses this boundary
// only from Play, a pad/key strike, or the explicit MIDI connection action;
// teardown closes the context because no other route owns it.

export interface DrumNightAudioSession {
  contextForGesture(): AudioContext | null
  outputForGesture(): AudioNode | null
  /** Passive scheduler access; never creates or resumes a context. */
  activeContext(): AudioContext | null
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
  let output: GainNode | null = null
  let disposed = false

  const ensureSession = (): boolean => {
    if (disposed) return false
    if (context !== null && output !== null && context.state !== 'closed') {
      return true
    }

    let nextContext: AudioContext | null = null
    let nextOutput: GainNode | null = null
    try {
      nextContext = (options.createContext ?? createBrowserAudioContext)()
      nextOutput = nextContext.createGain()
      nextOutput.gain.setValueAtTime(1, nextContext.currentTime)
      nextOutput.connect(nextContext.destination)
      context = nextContext
      output = nextOutput
      return true
    } catch {
      try {
        nextOutput?.disconnect()
      } catch {
        // A partially-created graph has no remaining live route owner.
      }
      if (nextContext !== null && nextContext.state !== 'closed') {
        void nextContext.close().catch(() => undefined)
      }
      context = null
      output = null
      return false
    }
  }

  return {
    contextForGesture(): AudioContext | null {
      return ensureSession() ? context : null
    },
    outputForGesture(): AudioNode | null {
      return ensureSession() ? output : null
    },
    activeContext(): AudioContext | null {
      return context !== null && context.state !== 'closed' ? context : null
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
      const activeOutput = output
      const activeContext = context
      output = null
      context = null
      try {
        activeOutput?.disconnect()
      } catch {
        // A closed context has already detached its output graph.
      }
      if (activeContext !== null && activeContext.state !== 'closed') {
        await activeContext.close().catch(() => undefined)
      }
    },
  }
}
