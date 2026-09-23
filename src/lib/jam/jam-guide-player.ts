// ── Jam guide player ─────────────────────────────────────────────────
// The guide vocal, played through Web Audio instead of a second <audio>
// element.
//
// TV browsers run a single hardware media pipeline: the moment a second
// media element calls play(), the first is paused — which a singer hears
// as the guide vocal "soloing" over a backing track that just stopped.
// A decoded AudioBuffer through a GainNode never touches the media
// pipeline, so the backing track's element keeps playing whatever the
// guide does. The karaoke stage already mixes its stems exactly this
// way, on the same devices.
//
// Decode is lazy — the buffer is only fetched when somebody first turns
// the guide up — because most rooms never do, and a decoded song is tens
// of megabytes a TV would rather not hold for nothing.
//
// Every start and stop is cross-faded. A buffer source cannot be seeked,
// so following the transport means replacing the source — and the follow
// effect does that whenever the guide drifts 120ms from the song. Cutting
// one waveform mid-cycle and splicing in another at full scale is a
// click, and at the rate this restarts it was a click track. Each source
// gets its own gain to fade on, under the master that carries the level.

/**
 * Cross-fade across a restart. Long enough to retire a waveform without
 * a click, short enough that a seek still lands where you asked.
 */
const FADE_SEC = 0.015

/** Fade before a stop. Nothing follows it, so it can afford to breathe. */
const STOP_FADE_SEC = 0.04

/** Level changes ride a ramp too: a slider dragged in steps steps audibly. */
const LEVEL_RAMP_SEC = 0.02

export interface JamGuidePlayerDeps {
  /** The shared engine's context; null until the engine has initialised. */
  context: () => AudioContext | null
  /** Where the guide goes: the room's key graph, else the speakers. */
  output?: (ctx: AudioContext) => AudioNode
  /** Seam for tests. Defaults to fetch(url) → arrayBuffer. */
  fetchArrayBuffer?: (url: string) => Promise<ArrayBuffer>
}

export interface JamGuidePlayer {
  /**
   * Decode the stem behind `url`, or reuse the cached decode. A different
   * url stops playback and replaces the cache. Resolves false when the
   * fetch or decode fails, or no context exists yet.
   */
  load(url: string): Promise<boolean>
  /** The url whose decode is currently held, if any. */
  loadedUrl(): string | null
  /**
   * Start (or restart) at offsetSec. Restarting IS the seek: a buffer
   * source cannot move once started, so following the transport means a
   * new source at the new offset. Omitting volume keeps the last one.
   * Returns false when there is nothing decoded to play.
   */
  start(offsetSec: number, volume?: number): boolean
  stop(): void
  setVolume(v: number): void
  playing(): boolean
  /** Song position implied by the context clock, or null when stopped. */
  positionSec(): number | null
  dispose(): void
}

export function createJamGuidePlayer(deps: JamGuidePlayerDeps): JamGuidePlayer {
  const fetchArrayBuffer =
    deps.fetchArrayBuffer ??
    (async (url: string) => {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`guide vocal fetch failed: ${res.status}`)
      return res.arrayBuffer()
    })

  let buffer: AudioBuffer | null = null
  let bufferUrl: string | null = null
  /** In-flight decode, so two overlapping loads of one url decode once. */
  let loading: { url: string; promise: Promise<boolean> } | null = null
  /** Bumped by load-of-a-different-url and dispose; stale decodes check it. */
  let generation = 0
  let disposed = false

  /** Carries the level, and nothing else: it outlives every source. */
  let master: GainNode | null = null
  let volume = 0.5
  /** The sounding source and the gain it fades on, as one unit. */
  let voice: { source: AudioBufferSourceNode; gain: GainNode } | null = null
  let startedAtCtxTime = 0
  let startOffsetSec = 0

  /** The room's key graph, or the speakers when it cannot be had: the
   *  guide is better heard in the original key than not at all. */
  const outputFor = (ctx: AudioContext): AudioNode => {
    try {
      return deps.output?.(ctx) ?? ctx.destination
    } catch {
      return ctx.destination
    }
  }

  const ensureMaster = (ctx: AudioContext): GainNode => {
    if (master === null) {
      master = ctx.createGain()
      master.gain.value = volume
      master.connect(outputFor(ctx))
    }
    return master
  }

  /** Let go of a source's nodes. Safe to call twice. */
  const release = (v: { source: AudioBufferSourceNode; gain: GainNode }) => {
    v.source.onended = null
    v.source.disconnect()
    v.gain.disconnect()
  }

  /**
   * Fade a source out and stop it once it is silent.
   *
   * The nodes are released on its own `ended`, not on a timer: a source
   * stopped in the future is still playing now, and disconnecting it
   * early is the cut this whole module exists to avoid.
   */
  const retire = (
    v: { source: AudioBufferSourceNode; gain: GainNode },
    ctx: AudioContext,
    fadeSec: number,
  ): void => {
    const at = ctx.currentTime
    v.gain.gain.cancelScheduledValues(at)
    v.gain.gain.setValueAtTime(v.gain.gain.value, at)
    v.gain.gain.linearRampToValueAtTime(0, at + fadeSec)
    v.source.onended = () => release(v)
    try {
      v.source.stop(at + fadeSec)
    } catch {
      // Never started, or already ended: nothing to fade.
      release(v)
    }
  }

  /** Stop without a fade. Teardown only — a click nobody will hear. */
  const stopNow = (): void => {
    const v = voice
    voice = null
    if (v === null) return
    release(v)
    try {
      v.source.stop()
    } catch {
      // Never started or already ended — either way it is stopped.
    }
  }

  const stop = (): void => {
    const v = voice
    voice = null
    if (v === null) return
    const ctx = deps.context()
    if (ctx === null) {
      release(v)
      try {
        v.source.stop()
      } catch {
        // Already gone.
      }
      return
    }
    retire(v, ctx, STOP_FADE_SEC)
  }

  const doLoad = async (url: string, gen: number): Promise<boolean> => {
    const ctx = deps.context()
    if (ctx === null) return false
    try {
      const bytes = await fetchArrayBuffer(url)
      if (gen !== generation) return false
      const decoded = await ctx.decodeAudioData(bytes)
      if (gen !== generation) return false
      buffer = decoded
      bufferUrl = url
      return true
    } catch {
      return false
    }
  }

  return {
    load(url) {
      if (disposed) return Promise.resolve(false)
      if (bufferUrl === url && buffer !== null) return Promise.resolve(true)
      if (loading !== null && loading.url === url) return loading.promise
      // A different song: whatever is sounding belongs to the old one.
      stop()
      buffer = null
      bufferUrl = null
      const gen = ++generation
      const promise = doLoad(url, gen).finally(() => {
        if (loading !== null && loading.url === url) loading = null
      })
      loading = { url, promise }
      return promise
    },

    loadedUrl: () => bufferUrl,

    start(offsetSec, nextVolume) {
      if (disposed) return false
      const ctx = deps.context()
      const buf = buffer
      if (ctx === null || buf === null) return false
      if (nextVolume !== undefined) volume = nextVolume
      // Past the end of the stem there is nothing to play — a vocal can
      // legitimately be shorter than the backing track's outro. Checked
      // before the outgoing source is touched, so a start past the end
      // leaves what is playing alone rather than killing it for nothing.
      const offset = Math.max(0, offsetSec)
      if (offset >= buf.duration) return false

      const outgoing = voice
      voice = null
      if (outgoing !== null) retire(outgoing, ctx, FADE_SEC)

      const at = ctx.currentTime
      const m = ensureMaster(ctx)
      m.gain.cancelScheduledValues(at)
      m.gain.setValueAtTime(volume, at)
      const g = ctx.createGain()
      g.gain.setValueAtTime(0, at)
      g.gain.linearRampToValueAtTime(1, at + FADE_SEC)
      g.connect(m)
      const s = ctx.createBufferSource()
      s.buffer = buf
      s.connect(g)
      const next = { source: s, gain: g }
      s.onended = () => {
        // Ran off the end of the stem on its own. Only clear the slot if
        // it is still ours: a restart has already moved on.
        if (voice === next) voice = null
        release(next)
      }
      s.start(0, offset)
      voice = next
      startedAtCtxTime = at
      startOffsetSec = offset
      return true
    },

    stop,

    setVolume(v) {
      volume = v
      const ctx = deps.context()
      if (master === null) return
      if (ctx === null) {
        master.gain.value = v
        return
      }
      const at = ctx.currentTime
      master.gain.cancelScheduledValues(at)
      master.gain.setValueAtTime(master.gain.value, at)
      master.gain.linearRampToValueAtTime(v, at + LEVEL_RAMP_SEC)
    },

    playing: () => voice !== null,

    positionSec() {
      const ctx = deps.context()
      if (voice === null || ctx === null) return null
      return startOffsetSec + (ctx.currentTime - startedAtCtxTime)
    },

    dispose() {
      if (disposed) return
      disposed = true
      generation += 1
      stopNow()
      if (master !== null) {
        master.disconnect()
        master = null
      }
      buffer = null
      bufferUrl = null
    },
  }
}
