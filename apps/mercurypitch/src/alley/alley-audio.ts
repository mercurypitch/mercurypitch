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
//
// IT REPORTS EVERY STEP through an optional `report` dep: the context made
// (state, rate, latencies), the activation, the read (url, status, ok,
// bytes, ms), the decode (duration, channels, rate, ms, or the error), the
// start (state, clock), every state change including WebKit's
// 'interrupted', and stale, retired and stopped. The app hands it the
// device's audio recorder (src/lib/audio-diagnostics.ts), so the next time a
// door is silent on a phone, the Developer screen says at which step.

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

/** A read, with the status the bytes came with: 0 is iOS's packaged shape. */
export interface AmbientRead {
  bytes: ArrayBuffer
  status: number
  ok: boolean
}

/** Where each step goes: the app's audio recorder, or nowhere. */
export type AmbientReport = (
  event: string,
  detail?: Record<string, unknown>,
  failed?: boolean,
) => void

/** The live context, read, not handed out: it stays this module's own. */
export interface AmbientContextView {
  state: string
  sampleRate: number
  currentTime: number
}

export interface AmbientDeps {
  createContext: () => AudioContext | null
  /** `fetchAssetRead` in the app: the shared packaged-asset rule. */
  load: (url: string) => Promise<AmbientRead>
  /** `activateAudioPlayback` in the app; the gesture's half of iOS. */
  activate: (target: AmbientActivation) => Promise<void>
  setTimer?: (fn: () => void, ms: number) => unknown
  report?: AmbientReport
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
  /**
   * The page is visible again after being hidden. iOS can leave a context
   * reporting 'running' on a dead output after that (audio-unlock.ts), and a
   * resume does not bring it back: the next door tap replaces it, inside its
   * gesture, instead of starting a silent source on it.
   */
  recover: () => void
  /**
   * The alley has gone. Once every fade has finished, close the context and
   * drop the decoded buffers (about 10 MB of PCM for the two rooms); the next
   * door tap rebuilds both. A start in between keeps them.
   */
  dispose: () => void
  /** The context's state, rate and clock, or null before the first tap. */
  context: () => AmbientContextView | null
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
  const report: AmbientReport = deps.report ?? (() => {})
  const clock = (): number => globalThis.performance.now()
  const since = (began: number): number => Math.round(clock() - began)
  let ctx: AudioContext | null = null
  let current: Voice | null = null
  /** The last voice that got a source, until that source is stopped. */
  let audible: Voice | null = null
  let token = 0
  let started = 0
  let lastStop: number | null = null
  const buffers = new Map<AmbientKind, Promise<AudioBuffer>>()
  const releases = new Set<Promise<void>>()
  /**
   * The context cannot be trusted to sound: iOS interrupted it (a call, Siri,
   * Control Center), a resume inside a tap left it not running, or the page
   * came back from the background. The next tap replaces it.
   */
  let stale = false

  const retire = (): void => {
    const old = ctx
    ctx = null
    stale = false
    if (old !== null) report('retired', { state: old.state })
    if (old !== null && old.state !== 'closed') {
      void old.close().catch(() => {})
    }
  }

  const makeContext = (): AudioContext | null => {
    let made: AudioContext | null
    try {
      made = deps.createContext()
    } catch (error) {
      report('context-failed', { error }, true)
      throw error
    }
    if (made === null) {
      report('context-failed', { error: 'no AudioContext on this page' }, true)
      return null
    }
    report('context', {
      state: made.state,
      sampleRate: made.sampleRate,
      baseLatency: made.baseLatency,
      outputLatency: made.outputLatency,
    })
    made.addEventListener('statechange', () => {
      report('statechange', { state: made.state })
      if ((made.state as string) === 'interrupted' && ctx === made) {
        stale = true
        report('stale', { reason: 'interrupted' })
      }
    })
    return made
  }

  const ensureContext = (): AudioContext | null => {
    // Replaced here, inside the tap: a context made anywhere else is born
    // suspended on iOS. 'interrupted' is WebKit's own state, not in the type.
    const interrupted = (ctx?.state as string | undefined) === 'interrupted'
    if (ctx !== null && (stale || interrupted)) retire()
    if (ctx === null || ctx.state === 'closed') ctx = makeContext()
    return ctx
  }

  /** Every start that ends without a source says why, on the console. */
  const didNotStart = (kind: AmbientKind, error: unknown): void => {
    console.warn(
      '[alley] ambient did not start',
      kind,
      AMBIENT_URL[kind],
      error,
    )
  }

  const read = async (url: string): Promise<ArrayBuffer> => {
    const began = clock()
    try {
      const got = await deps.load(url)
      const { status, ok } = got
      const bytes = got.bytes.byteLength
      report('fetched', { url, status, ok, bytes, ms: since(began) })
      return got.bytes
    } catch (error) {
      report('fetch-failed', { url, error, ms: since(began) }, true)
      throw error
    }
  }

  const decode = async (
    context: AudioContext,
    url: string,
    bytes: ArrayBuffer,
  ): Promise<AudioBuffer> => {
    const began = clock()
    try {
      const decoded = await context.decodeAudioData(bytes)
      report('decoded', {
        url,
        duration: decoded.duration,
        channels: decoded.numberOfChannels,
        sampleRate: decoded.sampleRate,
        ms: since(began),
      })
      return decoded
    } catch (error) {
      report('decode-failed', { url, error, ms: since(began) }, true)
      throw error
    }
  }

  const buffer = (context: AudioContext, kind: AmbientKind) => {
    let pending = buffers.get(kind)
    if (pending === undefined) {
      const url = AMBIENT_URL[kind]
      pending = read(url).then((bytes) => decode(context, url, bytes))
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
        if (voice.source !== null) {
          lastStop = globalThis.performance.now()
          report('stopped', { kind: voice.kind })
        }
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
    if (live === null) {
      // No context was made: no constructor on this page, or one that threw
      // (too many open, a WebView that refuses). A throw rejected the
      // activation, and returning with it unhandled is an unhandled rejection
      // -- which the native index.html watchdog paints as "Mercury Pitch did
      // not start" over an app that is running. Handled, and said.
      void activation.then(
        () => didNotStart(kind, new Error('No AudioContext on this page')),
        (error: unknown) => didNotStart(kind, error),
      )
      return
    }

    const gain = live.createGain()
    gain.gain.value = GAIN_FLOOR
    gain.connect(live.destination)
    const voice: Voice = { kind, gain, source: null, releasing: false }
    current = voice

    const activated = activation.then(
      () =>
        report('activated', {
          state: live.state,
          currentTime: live.currentTime,
        }),
      (error: unknown) =>
        report('activation-failed', { state: live.state, error }, true),
    )

    void Promise.all([activated, buffer(live, kind)])
      .then(([, decoded]) => {
        // Resumed inside the tap and still not running: this one is not
        // coming back, and the next tap makes another.
        if (live.state !== 'running' && ctx === live) {
          stale = true
          report('stale', {
            reason: 'not running after resume',
            state: live.state,
          })
        }
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
        report('started', { kind, state: live.state, currentTime: now })
        voice.source = source
        audible = voice
        gain.gain.exponentialRampToValueAtTime(
          AMBIENT_LEVEL,
          now + Math.max(fadeMs, 1) / 1000,
        )
      })
      .catch((error: unknown) => {
        // No decoder for this file, or no file: the door stays silent, which
        // is a door without an ambient rather than a broken one. But said out
        // loud: this catch was empty, and that is how the iOS status-0 read
        // stayed invisible through two device rounds.
        didNotStart(kind, error)
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

  const recover = (): void => {
    if (ctx === null) return
    stale = true
    report('stale', { reason: 'page came back', state: ctx.state })
  }

  const dispose = (): void => {
    const at = token
    void Promise.all([...releases]).then(() => {
      // Something started since: the alley is back, and so is its sound.
      if (token !== at || current !== null) return
      buffers.clear()
      retire()
    })
  }

  return {
    start,
    stop,
    recover,
    dispose,
    sounding: () => (current?.releasing === false ? current.kind : null),
    level: () => (audible?.source ? audible.gain.gain.value : 0),
    sourcesStarted: () => started,
    context: () =>
      ctx === null
        ? null
        : {
            state: ctx.state,
            sampleRate: ctx.sampleRate,
            currentTime: ctx.currentTime,
          },
    stoppedAt: () => lastStop,
  }
}
