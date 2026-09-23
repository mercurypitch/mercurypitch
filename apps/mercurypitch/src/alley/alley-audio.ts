// ============================================================
// The room ambients a selected door fades in
// ============================================================
//
// One dedicated AudioContext, created INSIDE the door tap and resumed there,
// through the app's own `activateAudioPlayback` (src/lib/audio-unlock.ts,
// MISTAKES.md "route every start through activateAudioPlayback") — which also
// plays the silent clip that moves iOS off the ambient session the ring switch
// mutes. Sound never starts on arrival: `start` is only ever called from a tap.
//
// A LOOPING BUFFER, NOT AN <audio loop>. The ambients are AAC in m4a, and the
// decoder's priming samples put an audible gap at every wrap of a media
// element's loop. An `AudioBufferSourceNode` with `loop = true`, decoded
// through this same context, wraps sample-exactly (S4 brief §4). One source
// per start; a source is never restarted, so a second start builds a new one.
//
// THE FADES ARE A GainNode. `HTMLMediaElement.volume` is read-only on iOS, and
// the house envelope (.claude/memory/audio-pop-free-playback.md) is what every
// audible start and stop in this app uses: an exponential attack from the
// 1e-4 floor, a `setTargetAtTime` release with a time constant of a fifth of
// its length, and the source stopped only after the release plus slack.
//
// Injectable end to end — the context, the fetch and the activation — so the
// schedule is tested against a fake context rather than trusted.

import type { AmbientKind } from './alley-plate'
import { AMBIENT_URL } from './alley-plate'

/** Where the ambient sits once it has faded in. */
export const AMBIENT_LEVEL = 0.85
/** An exponential ramp cannot start from zero. */
export const GAIN_FLOOR = 1e-4
/** The stop waits this long past the release before it stops the source. */
export const RELEASE_SLACK_MS = 60

export interface AmbientActivation {
  getAudioContext: () => AudioContext | null
  init: () => Promise<void>
  resume: () => Promise<void>
}

export interface AmbientDeps {
  createContext: () => AudioContext | null
  load: (url: string) => Promise<ArrayBuffer>
  /** `activateAudioPlayback` in the app; the gesture's half of iOS. */
  activate: (target: AmbientActivation) => Promise<void>
  setTimer?: (fn: () => void, ms: number) => unknown
}

export interface AlleyAmbient {
  /** Call from inside the tap. Fades `kind` in over `fadeMs`. */
  start: (kind: AmbientKind, fadeMs: number) => void
  /**
   * Fade whatever is sounding out over `fadeMs`. Resolves once the source has
   * been stopped — the moment the alley is silent, which is what a room's own
   * arrival waits for.
   */
  stop: (fadeMs: number) => Promise<void>
  /** The kind sounding or fading in, or null. */
  sounding: () => AmbientKind | null
  /** The live gain of the last voice with a source, 0 once it is stopped. */
  level: () => number
  /** Sources started since this ambient was made. For the walk and tests. */
  sourcesStarted: () => number
  /**
   * `performance.now()` when a source was last stopped, or null. The walk
   * orders a room's microphone after it.
   */
  stoppedAt: () => number | null
}

interface Voice {
  kind: AmbientKind
  gain: GainNode
  source: AudioBufferSourceNode | null
  releasing: boolean
}

export function createAlleyAmbient(deps: AmbientDeps): AlleyAmbient {
  const timer =
    deps.setTimer ??
    ((fn: () => void, ms: number) => globalThis.setTimeout(fn, ms))
  let ctx: AudioContext | null = null
  let current: Voice | null = null
  /** The last voice that got a source, until that source is stopped. */
  let audible: Voice | null = null
  let token = 0
  let started = 0
  let lastStop: number | null = null
  const buffers = new Map<AmbientKind, Promise<AudioBuffer>>()
  const releases = new Set<Promise<void>>()

  const ensureContext = (): AudioContext | null => {
    if (ctx === null || ctx.state === 'closed') ctx = deps.createContext()
    return ctx
  }

  const buffer = (context: AudioContext, kind: AmbientKind) => {
    let pending = buffers.get(kind)
    if (pending === undefined) {
      pending = deps
        .load(AMBIENT_URL[kind])
        .then((bytes) => context.decodeAudioData(bytes))
      // A failed decode is not cached: the next tap may be on a better day.
      pending.catch(() => buffers.delete(kind))
      buffers.set(kind, pending)
    }
    return pending
  }

  const release = (voice: Voice, fadeMs: number): Promise<void> => {
    voice.releasing = true
    const context = ctx
    if (context !== null) {
      const now = context.currentTime
      const param = voice.gain.gain
      param.cancelScheduledValues(now)
      param.setValueAtTime(param.value, now)
      param.setTargetAtTime(0, now, Math.max(fadeMs, 1) / 1000 / 5)
    }
    const done = new Promise<void>((resolve) => {
      timer(() => {
        try {
          voice.source?.stop()
        } catch {
          /* never started, or already stopped */
        }
        if (voice.source !== null) lastStop = globalThis.performance.now()
        voice.source?.disconnect()
        voice.gain.disconnect()
        voice.source = null
        if (audible === voice) audible = null
        // Nothing left to play: let the phone's audio hardware sleep.
        if (
          current === null &&
          context !== null &&
          context.state === 'running'
        ) {
          void context.suspend().catch(() => {})
        }
        resolve()
      }, fadeMs + RELEASE_SLACK_MS)
    })
    releases.add(done)
    void done.then(() => releases.delete(done))
    return done
  }

  const start = (kind: AmbientKind, fadeMs: number): void => {
    if (current !== null && current.kind === kind && !current.releasing) return
    if (current !== null) void release(current, 200)
    current = null

    const mine = ++token
    const born: { context: AudioContext | null } = { context: null }
    // Synchronously, inside the tap: the context is born here, and
    // `activateAudioPlayback` resumes it and plays the unlock clip before its
    // first await.
    const activation = deps.activate({
      getAudioContext: () => born.context,
      init: () => {
        born.context = ensureContext()
        return Promise.resolve()
      },
      resume: () => born.context?.resume() ?? Promise.resolve(),
    })
    const live = born.context
    if (live === null) return

    const gain = live.createGain()
    gain.gain.value = GAIN_FLOOR
    gain.connect(live.destination)
    const voice: Voice = { kind, gain, source: null, releasing: false }
    current = voice

    void Promise.all([activation.catch(() => {}), buffer(live, kind)])
      .then(([, decoded]) => {
        if (mine !== token || voice.releasing) return
        const source = live.createBufferSource()
        source.buffer = decoded
        source.loop = true
        source.connect(gain)
        const now = live.currentTime
        gain.gain.cancelScheduledValues(now)
        gain.gain.setValueAtTime(GAIN_FLOOR, now)
        source.start(now)
        started += 1
        voice.source = source
        audible = voice
        gain.gain.exponentialRampToValueAtTime(
          AMBIENT_LEVEL,
          now + Math.max(fadeMs, 1) / 1000,
        )
      })
      .catch(() => {
        // No decoder for this file, or no file: the door stays silent, which
        // is a door without an ambient rather than a broken one.
        if (current === voice) current = null
        gain.disconnect()
      })
  }

  const stop = (fadeMs: number): Promise<void> => {
    token += 1
    const voice = current
    current = null
    if (voice !== null) void release(voice, fadeMs)
    return Promise.all([...releases]).then(() => undefined)
  }

  return {
    start,
    stop,
    sounding: () => (current?.releasing === false ? current.kind : null),
    level: () => (audible?.source ? audible.gain.gain.value : 0),
    sourcesStarted: () => started,
    stoppedAt: () => lastStop,
  }
}
