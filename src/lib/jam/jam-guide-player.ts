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

export interface JamGuidePlayerDeps {
  /** The shared engine's context; null until the engine has initialised. */
  context: () => AudioContext | null
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

  let gain: GainNode | null = null
  let volume = 0.5
  let source: AudioBufferSourceNode | null = null
  let startedAtCtxTime = 0
  let startOffsetSec = 0

  const ensureGain = (ctx: AudioContext): GainNode => {
    if (gain === null) {
      gain = ctx.createGain()
      gain.gain.value = volume
      gain.connect(ctx.destination)
    }
    return gain
  }

  const stop = (): void => {
    const s = source
    source = null
    if (s === null) return
    s.onended = null
    try {
      s.stop()
    } catch {
      // Never started or already ended — either way it is stopped.
    }
    s.disconnect()
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
      stop()
      // Past the end of the stem there is nothing to play — a vocal can
      // legitimately be shorter than the backing track's outro.
      const offset = Math.max(0, offsetSec)
      if (offset >= buf.duration) return false
      const g = ensureGain(ctx)
      g.gain.value = volume
      const s = ctx.createBufferSource()
      s.buffer = buf
      s.connect(g)
      s.onended = () => {
        if (source === s) source = null
      }
      s.start(0, offset)
      source = s
      startedAtCtxTime = ctx.currentTime
      startOffsetSec = offset
      return true
    },

    stop,

    setVolume(v) {
      volume = v
      if (gain !== null) gain.gain.value = v
    },

    playing: () => source !== null,

    positionSec() {
      const ctx = deps.context()
      if (source === null || ctx === null) return null
      return startOffsetSec + (ctx.currentTime - startedAtCtxTime)
    },

    dispose() {
      if (disposed) return
      disposed = true
      generation += 1
      stop()
      if (gain !== null) {
        gain.disconnect()
        gain = null
      }
      buffer = null
      bufferUrl = null
    },
  }
}
