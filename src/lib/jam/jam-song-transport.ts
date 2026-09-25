// ── Jam song transport — pop-free play, pause and seek ───────────────
//
// The jam stage drives one <audio> element for the backing track, and it
// drove it bare: `play()`, `pause()`, `currentTime = x`. Each of those is
// a full-scale discontinuity in a single sample, which on a PA is a very
// loud pop -- and a room is exactly where a song gets stopped and started
// again a dozen times in a practice.
//
// Same house rules as `preview-player.ts`, whose envelope primitives this
// reuses rather than re-deriving: exponential rise on start, exponential
// decay BEFORE the transport pauses, and a short linear dip around a
// seek. See `.claude/memory/audio-pop-free-playback.md`.
//
// ── Why this attaches lazily, and only to a RUNNING context ──────────
//
// A MediaElementAudioSourceNode diverts the element's output into the
// graph permanently -- there is no detaching it afterwards. If the
// context is suspended, or never resumes, the result is not a pop but
// total silence, which is a far worse bug than the one being fixed. So
// the graph is built on the first play that finds a running context, and
// until then the element plays natively: a pop, but audible.
//
// In practice that first play is already enveloped. The stage installs
// the shared audio-unlock listeners, so any tap in the room resumes the
// context, and a singer has tapped several times (picking the song,
// waiting for the transfer) before they reach for Play.
//
// Not always: a guest who has not tapped yet gets the host's Play as a
// message, and the tap that follows cannot help, because resume() lands
// after the tap's own handler has run. Natively, the song is in its
// ORIGINAL key whatever the room's is, so a song left playing that way is
// handed over the moment the context runs -- a cut and a fade-in, once,
// rather than the wrong key for the rest of the song. See `adopt`.

import { closeEnvelope, dipEnvelope, ENVELOPE_DEFAULTS, openEnvelope, } from '@/lib/preview-player'

/** Wall-clock headroom after a release before the element is paused, so
 *  the tail has fully retired. Mirrors preview-player's own slack. */
const RAMP_SLACK_MS = 60

export interface JamSongTransportDeps {
  /** The stage's element. Undefined until the ref is bound. */
  element: () => HTMLAudioElement | undefined
  /** The shared engine context, or null before it exists. */
  context: () => AudioContext | null
  /** Where the enveloped backing goes: the room's key graph, else the
   *  speakers. */
  output?: (ctx: AudioContext) => AudioNode
  /** The backing goes through the graph from now on, for good. Once. */
  onAttach?: () => void
  attackMs?: number
  releaseMs?: number
  seekFadeMs?: number
}

export interface JamSongTransport {
  /**
   * Fade in and play. The element's own `play()` promise is returned
   * unchanged, so the caller keeps its autoplay-policy error handling --
   * the envelope must not swallow the one failure a singer can fix.
   */
  play(): Promise<void>
  /** Fade out, then pause. A `play()` in the meantime cancels the pause. */
  pause(): void
  /** Move the playhead, dipping around the jump while it is sounding. */
  seek(toSec: number): void
  /** True once the element is routed through the gain graph. */
  enveloped(): boolean
  /**
   * Hand a song already playing natively to the graph: now if the context
   * runs, else as soon as it starts to. For a context made after the song
   * began; a play that finds the context asleep arranges this itself.
   */
  adopt(): void
  /** Drop the graph's own nodes. The element belongs to the caller. */
  dispose(): void
}

/**
 * The engine's context, made as the stage mounts so the first Play can
 * already go through the graph: constructing the engine makes none, only
 * its `init()` does. Made before any tap, it starts suspended, and the
 * stage's unlock listeners resume it on the first one. Null where no
 * context can be made; the element then plays natively.
 */
export async function prepareEngineContext(engine: {
  init: () => Promise<void>
  getAudioContext: () => AudioContext | null
}): Promise<AudioContext | null> {
  try {
    await engine.init()
  } catch {
    return null
  }
  return engine.getAudioContext()
}

export function createJamSongTransport(
  deps: JamSongTransportDeps,
): JamSongTransport {
  const attackS = (deps.attackMs ?? ENVELOPE_DEFAULTS.attackMs) / 1000
  const releaseS = (deps.releaseMs ?? ENVELOPE_DEFAULTS.releaseMs) / 1000
  const seekFadeS = (deps.seekFadeMs ?? ENVELOPE_DEFAULTS.seekFadeMs) / 1000

  let ctx: AudioContext | null = null
  let source: MediaElementAudioSourceNode | null = null
  let gain: GainNode | null = null
  let disposed = false
  let wantPlaying = false
  let pauseTimer: ReturnType<typeof setTimeout> | undefined
  let seekTimer: ReturnType<typeof setTimeout> | undefined
  /** The asleep context a natively playing song waits on. */
  let watched: AudioContext | null = null
  /** Bumped by every transport edge, so a dip still in flight when the
   *  next one lands knows the gain is no longer its to lift. */
  let revision = 0

  const clearPauseTimer = (): void => {
    if (pauseTimer === undefined) return
    clearTimeout(pauseTimer)
    pauseTimer = undefined
  }

  const clearSeekTimer = (): void => {
    if (seekTimer === undefined) return
    clearTimeout(seekTimer)
    seekTimer = undefined
  }

  /** The room's key graph, or the speakers when it cannot be had. */
  const outputFor = (c: AudioContext): AudioNode => {
    try {
      return deps.output?.(c) ?? c.destination
    } catch {
      return c.destination
    }
  }

  /**
   * Build the graph, once, and only against a context that is actually
   * running. Returns false when the element must keep playing natively.
   *
   * `createMediaElementSource` throws if the element already belongs to
   * another graph — a real possibility after a hot reload — and a throw
   * here must leave the element playing rather than take the room down.
   * Handing the element over is permanent, so its gain is wired first: a
   * failure after the hand-over would be silence. A key graph that cannot
   * be had sends the backing to the speakers, in the original key.
   */
  const attach = (el: HTMLAudioElement): boolean => {
    if (gain !== null && ctx !== null) return true
    const candidate = deps.context()
    if (candidate === null || candidate.state !== 'running') return false
    let g: GainNode | null = null
    try {
      g = candidate.createGain()
      // Silent until the envelope opens: the element is about to start,
      // and the first audible sample must not be at full scale.
      g.gain.value = 0
      g.connect(outputFor(candidate))
      const src = candidate.createMediaElementSource(el)
      src.connect(g)
      ctx = candidate
      source = src
      gain = g
      deps.onAttach?.()
      return true
    } catch {
      g?.disconnect()
      return false
    }
  }

  const playing = (el: HTMLAudioElement): boolean => !el.paused && !el.ended

  const unwatch = (): void => {
    watched?.removeEventListener('statechange', onStateChange)
    watched = null
  }

  const watch = (c: AudioContext): void => {
    if (watched === c) return
    unwatch()
    watched = c
    c.addEventListener('statechange', onStateChange)
  }

  const adopt = (): void => {
    if (disposed) return
    const el = deps.element()
    if (gain !== null || el === undefined || !wantPlaying || !playing(el)) {
      unwatch()
      return
    }
    const c = deps.context()
    if (c === null) return
    if (c.state !== 'running') {
      watch(c)
      return
    }
    unwatch()
    // The element's own output stops here; the envelope brings the song
    // back from silence.
    if (attach(el) && gain !== null && ctx !== null)
      openEnvelope(gain, ctx, attackS)
  }

  function onStateChange(): void {
    if (watched?.state === 'running') adopt()
  }

  return {
    play() {
      if (disposed) return Promise.resolve()
      const el = deps.element()
      if (el === undefined) return Promise.resolve()
      wantPlaying = true
      revision += 1
      const intent = revision
      // A pause that has not fired yet means the element never stopped.
      // Cancelling it here is what makes a quick stop/start inaudible
      // instead of a fade-out chased by a fade-in.
      clearPauseTimer()

      const enveloped = attach(el)
      if (!enveloped) {
        const asleep = deps.context()
        if (asleep !== null && asleep.state !== 'running') watch(asleep)
      }
      const g = gain
      const c = ctx
      if (enveloped && g !== null && c !== null) {
        g.gain.cancelScheduledValues(c.currentTime)
        g.gain.setValueAtTime(0, c.currentTime)
      }

      // Called synchronously, inside whatever gesture got us here: an
      // await before this is how a play becomes an autoplay refusal.
      const started = el.play()
      if (!enveloped || g === null || c === null) return started
      return started.then(() => {
        // Opened only once playback has really begun. Ramping from the
        // moment of the call would spend the attack on silence and the
        // first audible sample would be at full scale again.
        if (disposed || intent !== revision || !wantPlaying) return
        openEnvelope(g, c, attackS)
      })
    },

    pause() {
      if (disposed) return
      const el = deps.element()
      if (el === undefined) return
      wantPlaying = false
      revision += 1
      // A pending seek is deliberately left alone. A stop IS a rewind
      // followed by a pause, and cancelling the rewind here is how the
      // song would come back from the middle next time. The seek's own
      // guard sees `wantPlaying` and declines to lift the dip.
      const g = gain
      const c = ctx
      if (g === null || c === null) {
        el.pause()
        return
      }
      // Already stopping: the running release is the right one.
      if (pauseTimer !== undefined) return
      closeEnvelope(g, c, releaseS)
      pauseTimer = setTimeout(
        () => {
          pauseTimer = undefined
          // A play() during the tail cleared this timer; if one arrived
          // and re-armed since, wantPlaying is the truth.
          if (disposed || wantPlaying) return
          el.pause()
        },
        releaseS * 1000 + RAMP_SLACK_MS,
      )
    },

    seek(toSec) {
      if (disposed || !Number.isFinite(toSec)) return
      const el = deps.element()
      if (el === undefined) return
      const target = Math.max(0, toSec)
      clearSeekTimer()
      const g = gain
      const c = ctx
      // Nothing is sounding, so there is no discontinuity to hide and a
      // dip would only delay the move.
      if (g === null || c === null || !wantPlaying || !playing(el)) {
        el.currentTime = target
        return
      }
      revision += 1
      const intent = revision
      dipEnvelope(g, c, seekFadeS, 0)
      seekTimer = setTimeout(
        () => {
          seekTimer = undefined
          if (disposed) return
          // The move always happens: a transport edge arriving mid-dip
          // changes who owns the gain, not where the song should be.
          el.currentTime = target
          // Something else took the gain while the dip was in flight --
          // a pause's release, or a play re-opening from silence. Lifting
          // the dip now would fight it.
          if (intent !== revision || !wantPlaying) return
          dipEnvelope(g, c, seekFadeS, 1)
        },
        seekFadeS * 1000 + 5,
      )
    },

    enveloped: () => gain !== null,

    adopt,

    dispose() {
      if (disposed) return
      disposed = true
      clearPauseTimer()
      clearSeekTimer()
      unwatch()
      // The element is the stage's, and Solid is tearing it down anyway.
      // Only the nodes this module made are its to release.
      source?.disconnect()
      gain?.disconnect()
      source = null
      gain = null
      ctx = null
    },
  }
}
