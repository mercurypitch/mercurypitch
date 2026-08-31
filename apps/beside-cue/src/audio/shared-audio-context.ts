// ============================================================
// Shared audio context — one clock for every Beside Cue lane
// ============================================================
//
// An AudioContext is the app's scarcest audio resource: older Chrome capped
// a tab at six, each one costs its own output stream, and — the reason that
// actually bites — each one runs its own clock. A tap stamped by the tap
// driver's context cannot be judged against a note scheduled on the asset
// output's context, because `currentTime` means a different instant in each.
//
// Beside Cue used to construct five (asset output, the onboarding cinematic,
// the tap tuner, and both glass drivers) and the 3D glass world would have
// made six. This module is the one owner; everything else takes a named
// lease. See docs/games/glass-3d.md §7.
//
// Lifetime rules, all of them platform-forced:
//   - CREATE AND RESUME INSIDE THE USER GESTURE. iOS WKWebView hands back a
//     suspended context and only a gesture-scoped resume() lifts it, so
//     `ensure()` and `unlock()` must be reached before the first `await` of
//     whatever the tap started (the pattern in the glass handoff doc: context
//     and mic stream both acquired inside the tap).
//   - Never close it in the app. close() is one-way, and a replacement would
//     need a fresh gesture the player has no reason to give. Leases suspend
//     the context; only tests dispose it.
//   - Watch `statechange`. iOS parks a context at 'interrupted' for a phone
//     call, Siri, or another app taking the route, and that event is the only
//     notice we get. 'interrupted' is not in the DOM's AudioContextState.
//   - Follow the page. Beside Cue's frame loop stops when the tab hides; the
//     sound stops with it and comes back on the way in.
//
// What this module deliberately does NOT touch: the microphone constraints.
// echoCancellation, noiseSuppression and autoGainControl stay off (they live
// in pitch-engine's mic-manager) because honest pitch depends on it. A
// feedback loop between the glass tone and the mic is answered by moving the
// tone out of the register being measured, never by switching those on.

/** A named claim on the shared context. Every audio owner takes one. */
export interface SharedAudioLease {
  readonly owner: string
  /** The context if one exists yet — null before anybody has called ensure(). */
  peek(): AudioContext | null
  /**
   * Create the context if it does not exist yet, and return it. Call this
   * synchronously inside the user gesture that permits sound; null means the
   * platform has no Web Audio at all.
   */
  ensure(): AudioContext | null
  /** ensure() and resume(), from inside the gesture. False when unavailable. */
  unlock(): Promise<boolean>
  /** Drop the claim. Safe to call twice; the last one out suspends the clock. */
  release(): void
}

export interface SharedAudioContextOptions {
  /** Test seam. Production always builds a real AudioContext. */
  readonly createContext?: () => AudioContext | undefined
}

function defaultContext(): AudioContext | undefined {
  if (typeof AudioContext === 'undefined') return undefined
  return new AudioContext()
}

let makeContext: () => AudioContext | undefined = defaultContext
let context: AudioContext | undefined
let constructionFailed = false
let suspendedByPage = false
let pageListenerAttached = false
const owners = new Map<symbol, string>()

/** iOS-only state; the DOM's AudioContextState union does not name it. */
function isInterrupted(audioContext: AudioContext): boolean {
  return String(audioContext.state) === 'interrupted'
}

function isPageHidden(): boolean {
  return (
    typeof document !== 'undefined' && document.visibilityState === 'hidden'
  )
}

function resumeQuietly(audioContext: AudioContext): void {
  try {
    void Promise.resolve(audioContext.resume()).catch(() => undefined)
  } catch {
    // A closed context rejects synchronously in some engines. Nothing to do.
  }
}

function handleStateChange(): void {
  const audioContext = context
  if (audioContext === undefined || !isInterrupted(audioContext)) return
  // Only reach for it while the page is in front — a resume from the
  // background is refused anyway, and the visibility handler will retry.
  if (owners.size === 0 || isPageHidden()) return
  resumeQuietly(audioContext)
}

function handleVisibilityChange(): void {
  const audioContext = context
  if (audioContext === undefined) return

  if (isPageHidden()) {
    if (audioContext.state !== 'running') return
    suspendedByPage = true
    try {
      void Promise.resolve(audioContext.suspend()).catch(() => {
        suspendedByPage = false
      })
    } catch {
      suspendedByPage = false
    }
    return
  }

  // Nobody is listening: leave the hardware parked rather than waking it,
  // and keep the flag so the next lease still gets its clock back.
  if (owners.size === 0) return
  if (!suspendedByPage && !isInterrupted(audioContext)) return
  suspendedByPage = false
  resumeQuietly(audioContext)
}

function attachListeners(audioContext: AudioContext): void {
  if (typeof audioContext.addEventListener === 'function') {
    audioContext.addEventListener('statechange', handleStateChange)
  }
  if (pageListenerAttached || typeof document === 'undefined') return
  document.addEventListener('visibilitychange', handleVisibilityChange)
  pageListenerAttached = true
}

function ensureContext(): AudioContext | null {
  if (context !== undefined) return context
  if (constructionFailed) return null
  let created: AudioContext | undefined
  try {
    created = makeContext()
  } catch {
    constructionFailed = true
    return null
  }
  if (created === undefined) return null
  context = created
  attachListeners(created)
  return created
}

/**
 * Claims the shared context under a name. Acquiring is cheap and does not
 * build anything: the context appears on the first ensure()/unlock(), which
 * the owner is expected to make from a user gesture.
 */
export function acquireSharedAudioContext(owner: string): SharedAudioLease {
  const token = Symbol(owner)
  owners.set(token, owner)
  let released = false

  return {
    owner,

    peek: () => context ?? null,

    ensure: () => (released ? (context ?? null) : ensureContext()),

    async unlock() {
      if (released) return false
      const audioContext = ensureContext()
      if (audioContext === null) return false
      try {
        await audioContext.resume()
      } catch {
        return false
      }
      suspendedByPage = false
      return audioContext.state !== 'closed'
    },

    release() {
      if (released) return
      released = true
      owners.delete(token)
      // The context outlives every lease — closing it would cost a gesture to
      // get back. Park the clock instead, so a forgotten oscillator cannot
      // keep the output stream alive between screens.
      const audioContext = context
      if (owners.size > 0 || audioContext === undefined) return
      if (audioContext.state !== 'running') return
      try {
        void Promise.resolve(audioContext.suspend()).catch(() => undefined)
      } catch {
        // Already suspended, interrupted or closed. Nothing to park.
      }
    },
  }
}

/** The names currently holding a lease, for tests and DEV readouts. */
export function sharedAudioContextOwners(): readonly string[] {
  return [...owners.values()]
}

/**
 * Tears the shared context down and reconfigures how the next one is built.
 * Tests only — the app never disposes its context (see the header).
 */
export function resetSharedAudioContext(
  options: SharedAudioContextOptions = {},
): void {
  const audioContext = context
  if (audioContext !== undefined) {
    if (typeof audioContext.removeEventListener === 'function') {
      audioContext.removeEventListener('statechange', handleStateChange)
    }
    try {
      void Promise.resolve(audioContext.close()).catch(() => undefined)
    } catch {
      // A context that is already closed needs nothing.
    }
  }
  if (pageListenerAttached && typeof document !== 'undefined') {
    document.removeEventListener('visibilitychange', handleVisibilityChange)
  }
  pageListenerAttached = false
  context = undefined
  constructionFailed = false
  suspendedByPage = false
  owners.clear()
  makeContext = options.createContext ?? defaultContext
}
