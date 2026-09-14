// ============================================================
// Shared audio context — one clock for every lane in an app
// ============================================================
//
// An AudioContext is an app's scarcest audio resource: older Chrome capped
// a tab at six, each one costs its own output stream, and — the reason that
// actually bites — each one runs its own clock. A tap stamped by the tap
// driver's context cannot be judged against a note scheduled on the asset
// output's context, because `currentTime` means a different instant in each.
//
// Beside Cue used to construct five (asset output, the onboarding cinematic,
// the tap tuner, and both glass drivers) and the 3D glass world would have
// made six. This module is the one owner; everything else takes a named
// lease. See `apps/beside-cue/docs/games/glass-3d.md` §7.
//
// It lives here, in `packages/audio-io`, because Beside Cue is no longer the
// only app with the problem: the root MercuryPitch tree constructs around
// thirty-five unmanaged contexts, none of which handle the iOS
// `'interrupted'` state below (hazard 2 in the native plan). Those rooms
// adopt this module one at a time rather than in a sweep, so the state below
// is module-global per BUNDLE — each app gets its own clock, which is what
// "one per app" has always meant.
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

export interface SharedAudioLeaseOptions {
  /**
   * Cancel pending playback synchronously, then return the remaining release
   * time in milliseconds. The clock grants at most 250 ms before suspension.
   * Owners without a release keep the existing immediate-suspend behavior.
   */
  readonly prepareToSuspend?: () => number
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
let explicitlySuspended = false
let suspendTimer: ReturnType<typeof setTimeout> | undefined
let suspendDeadline = 0
let suspendGeneration = 0
const owners = new Map<
  symbol,
  SharedAudioLeaseOptions & { readonly owner: string }
>()

function cancelPendingSuspension(): void {
  suspendGeneration += 1
  if (suspendTimer !== undefined) clearTimeout(suspendTimer)
  suspendTimer = undefined
  suspendDeadline = 0
}

function requestSuspension(audioContext: AudioContext): void {
  let grace = 0
  // A callback can release its own lease; don't iterate a live ownership map.
  for (const owner of [...owners.values()]) {
    try {
      const remaining = owner.prepareToSuspend?.() ?? 0
      if (Number.isFinite(remaining))
        grace = Math.max(grace, Math.min(250, remaining))
    } catch {
      // One output must not prevent the shared clock from being parked.
    }
  }
  if (audioContext.state !== 'running') return
  const deadline = Date.now() + grace
  // Repeated native/page events must never prolong a release already underway.
  if (suspendTimer !== undefined && suspendDeadline <= deadline) return
  cancelPendingSuspension()
  const generation = suspendGeneration
  const suspend = (): void => {
    if (generation !== suspendGeneration || context !== audioContext) return
    suspendTimer = undefined
    suspendDeadline = 0
    if (audioContext.state !== 'running') return
    try {
      void Promise.resolve(audioContext.suspend()).catch(() => undefined)
    } catch {
      // The OS can suspend or close it before this bounded release finishes.
    }
  }
  if (grace <= 0) {
    suspend()
  } else {
    suspendDeadline = deadline
    suspendTimer = setTimeout(suspend, grace)
  }
}

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
    void Promise.resolve(audioContext.resume())
      .then(() => {
        parkIfNoLongerActive(audioContext)
      })
      .catch(() => undefined)
  } catch {
    // A closed context rejects synchronously in some engines. Nothing to do.
  }
}

function parkIfNoLongerActive(audioContext: AudioContext): boolean {
  if (context !== audioContext) return true
  if (owners.size > 0 && !isPageHidden() && !explicitlySuspended) return false
  requestSuspension(audioContext)
  return true
}

function handleStateChange(): void {
  const audioContext = context
  if (audioContext === undefined || !isInterrupted(audioContext)) return
  // Only reach for it while the page is in front — a resume from the
  // background is refused anyway, and the visibility handler will retry.
  if (owners.size === 0 || isPageHidden() || explicitlySuspended) return
  // Outputs must observe the interruption before a resume can make their
  // disconnected sources' audio clocks advance again.
  queueMicrotask(() => {
    if (context !== audioContext || !isInterrupted(audioContext)) return
    if (owners.size === 0 || isPageHidden() || explicitlySuspended) return
    resumeQuietly(audioContext)
  })
}

function handleVisibilityChange(): void {
  const audioContext = context
  if (audioContext === undefined) return

  if (isPageHidden()) {
    if (audioContext.state === 'running' && !explicitlySuspended)
      suspendedByPage = true
    requestSuspension(audioContext)
    return
  }

  // A native inactive event can arrive while the document still says visible.
  if (explicitlySuspended) return
  cancelPendingSuspension()

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
export function acquireSharedAudioContext(
  owner: string,
  options: SharedAudioLeaseOptions = {},
): SharedAudioLease {
  const token = Symbol(owner)
  owners.set(token, { owner, ...options })
  let released = false

  return {
    owner,

    peek: () => context ?? null,

    ensure: () => (released ? (context ?? null) : ensureContext()),

    async unlock() {
      if (released) return false
      cancelSharedAudioContextSuspension()
      const audioContext = ensureContext()
      if (audioContext === null) return false
      try {
        await audioContext.resume()
      } catch {
        return false
      }
      // Native/page transitions can arrive while resume() is pending. Inspect
      // current intent: a newer gesture may have brought the app back already.
      if (parkIfNoLongerActive(audioContext) || released) return false
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
      cancelPendingSuspension()
      try {
        void Promise.resolve(audioContext.suspend()).catch(() => undefined)
      } catch {
        // Already suspended, interrupted or closed. Nothing to park.
      }
    },
  }
}

/**
 * Parks the clock without holding a lease, and without arming the automatic
 * resume that following the page installs.
 *
 * For the one event a browser does not have: the OS moving the whole app to
 * the background. A WebView's `visibilitychange` and the platform's own
 * app-state event disagree exactly where it matters — a call arriving, the
 * app switcher, a screen lock — and a context left running through that keeps
 * an output stream open behind an app nobody can see.
 *
 * Outputs may request a bounded release before the clock parks. Native intent
 * blocks automatic page/interruption resumes until foreground handling calls
 * cancelSharedAudioContextSuspension(), or a fresh gesture calls unlock().
 * Cancelling intent alone does not resume the clock or replay stopped sound.
 */
export function suspendSharedAudioContext(): void {
  explicitlySuspended = true
  suspendedByPage = false
  const audioContext = context
  if (audioContext !== undefined) requestSuspension(audioContext)
}

/** Clears a native suspension intent without resuming playback or the clock. */
export function cancelSharedAudioContextSuspension(): void {
  explicitlySuspended = false
  cancelPendingSuspension()
}

/**
 * Recovers an already-owned foreground clock without creating audio or
 * replaying stopped sources. Call after clearing native suspension intent.
 * A platform refusal remains retryable through the next gesture's unlock().
 */
export function resumeSharedAudioContext(): void {
  const audioContext = context
  if (
    audioContext === undefined ||
    owners.size === 0 ||
    isPageHidden() ||
    explicitlySuspended ||
    audioContext.state === 'closed'
  ) {
    return
  }
  cancelPendingSuspension()
  suspendedByPage = false
  if (audioContext.state !== 'running') resumeQuietly(audioContext)
}

/** The names currently holding a lease, for tests and DEV readouts. */
export function sharedAudioContextOwners(): readonly string[] {
  return [...owners.values()].map(({ owner }) => owner)
}

/**
 * Tears the shared context down and reconfigures how the next one is built.
 * Tests only — the app never disposes its context (see the header).
 */
export function resetSharedAudioContext(
  options: SharedAudioContextOptions = {},
): void {
  cancelSharedAudioContextSuspension()
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
