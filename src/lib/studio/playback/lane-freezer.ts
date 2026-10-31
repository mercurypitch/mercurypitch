// ============================================================
// Studio lane freezer — renders the lanes a song needs frozen, in the background, and lends them to runs
// ============================================================
//
// The freezer follows the open song (update), asks the freeze plan
// (lane-freeze-plan.ts) which lanes to render, and renders them one or two
// at a time on offline contexts, which run on threads of their own beside
// the realtime one. A lane edited in the last few seconds waits: the plan
// skips it until it has been left alone, so a fader drag or a trim in
// progress never starts a render it would outdate.
//
// A run built later holds the renders that match its lanes (hold) until it
// is released; a render whose lane changed goes once nothing holds it. The
// renders count against the Studio memory budget, at most three quarters of
// it, and an import or an export that needs the room takes back the ones no
// run holds. A run already playing keeps what it was built with: renders
// that finish while it plays are heard from the next Play.
import { measureTrackLatencies } from '@/lib/studio-fx/mixdown'
import { isStudioMemoryRefusal, registerStudioMemoryReclaimer, reserveStudioMemory, studioWorkingBytes, } from '../memory-budget'
import type { StudioPlannedLane } from '../model/arrangement-plan'
import { compileStudioArrangement } from '../model/arrangement-plan'
import type { StudioAsset, StudioProject } from '../model/types'
import { STUDIO_SAMPLE_RATE } from '../model/types'
import type { StudioBufferCache } from './buffer-cache'
import { createStudioBufferCache } from './buffer-cache'
import type { StudioFrozenLane } from './lane-freeze'
import { laneFreezeKey, laneFreezeKeys } from './lane-freeze'
import type { StudioFreezeCandidate } from './lane-freeze-plan'
import { chooseLaneFreezes, frozenLaneBytes } from './lane-freeze-plan'
import { laneRenderWorkingBytes, renderLaneFreeze } from './lane-freeze-render'
import type { StudioPlaybackChoice } from './playback-quality'
import { playbackQualityState, playbackVoiceChainUs, subscribePlaybackQuality, } from './playback-quality'

/** How long a lane is left alone before it is rendered. */
export const FREEZE_SETTLE_MS = 3000
/** The share of the Studio memory budget renders may hold: an import or export takes back what no run holds. */
export const FREEZE_MEMORY_SHARE = 0.75

/** The renders a run plays, held until it is released. */
export interface StudioFreezeHold {
  readonly lanes: ReadonlyMap<string, StudioFrozenLane>
  release(): void
}

/** What a run asks of the freezer. */
export interface StudioFreezeLookup {
  /** The renders that match `project`'s lanes now, held; null when none do. */
  hold(
    project: StudioProject,
    assets: readonly StudioAsset[],
  ): StudioFreezeHold | null
  /** Whether a run built now would play other renders than `frozen`. */
  differs(
    project: StudioProject,
    assets: readonly StudioAsset[],
    frozen: ReadonlyMap<string, StudioFrozenLane>,
  ): boolean
}

/** What the Sound panel shows of the freezer. */
export interface StudioLaneFreezeStatus {
  /** Lanes the song needs rendered to fit, the rendered ones included. */
  readonly wanted: number
  /** Of those, how many are rendered. */
  readonly ready: number
  readonly rendering: boolean
  /** The lanes the next Play plays from a render. */
  readonly frozen: ReadonlySet<string>
}

const IDLE_STATUS: StudioLaneFreezeStatus = {
  wanted: 0,
  ready: 0,
  rendering: false,
  frozen: new Set(),
}
let status = IDLE_STATUS
const statusListeners = new Set<(status: StudioLaneFreezeStatus) => void>()

export function laneFreezeStatus(): StudioLaneFreezeStatus {
  return status
}

export function subscribeLaneFreezeStatus(
  listener: (status: StudioLaneFreezeStatus) => void,
): () => void {
  statusListeners.add(listener)
  return () => statusListeners.delete(listener)
}

function setStatus(next: StudioLaneFreezeStatus): void {
  status = next
  for (const listener of statusListeners) listener(next)
}

export interface StudioLaneFreezerOptions {
  readCanonicalAsset(id: string): Promise<Blob>
  /** A lane froze, or renders went: a run built now would differ. */
  changed?(): void
  readonly render?: typeof renderLaneFreeze
  readonly measure?: typeof measureTrackLatencies
  readonly createCache?: () => StudioBufferCache
  /** The context the renders' audio is read into: any at 48 kHz. */
  readonly decodeContext?: () => BaseAudioContext
  readonly voiceChainUs?: () => number | undefined
  readonly choice?: () => StudioPlaybackChoice
  /** Calls back when the benchmark lands or the listener picks another quality. */
  readonly subscribe?: (listener: () => void) => () => void
  readonly now?: () => number
  readonly concurrency?: number
}

interface Entry {
  readonly lane: StudioFrozenLane
  holds: number
  /** Its lane changed: it goes once nothing holds it. */
  stale: boolean
  readonly release: () => void
}

interface Song {
  readonly project: StudioProject
  readonly assets: readonly StudioAsset[]
  /** Every lane with clips, by track, with its key. */
  readonly lanes: ReadonlyMap<
    string,
    { readonly lane: StudioPlannedLane; readonly key: string }
  >
}

const entryId = (trackId: string, key: string) => `${trackId}\n${key}`

export function createStudioLaneFreezer(options: StudioLaneFreezerOptions) {
  const render = options.render ?? renderLaneFreeze
  const measure = options.measure ?? measureTrackLatencies
  const now = options.now ?? (() => Date.now())
  const voiceChainUs = options.voiceChainUs ?? playbackVoiceChainUs
  const choice = options.choice ?? (() => playbackQualityState().choice)
  const concurrency = options.concurrency ?? 2
  const entries = new Map<string, Entry>()
  // When each lane's key last changed: a lane edited just now waits.
  const seen = new Map<string, { key: string; at: number }>()
  const rendering = new Set<string>()
  // Keys whose render failed for another reason than memory: not retried.
  const failed = new Set<string>()
  const caches: StudioBufferCache[] = []
  let decodeContext: BaseAudioContext | null = null
  let song: Song | null = null
  let queue: string[] = []
  let wanted = 0
  let paused = false
  let disposed = false
  let memoryShort = false
  let reserving = false
  let settleTimer: ReturnType<typeof setTimeout> | undefined
  const abort = new AbortController()

  // Registered with the first render, after the transport's own: a kept run
  // lets go of its renders first, so they are free to take back.
  let unregister: (() => void) | null = null
  const reclaim = () => {
    // Its own render asking for room must not take back what it rendered.
    if (reserving) return
    let freed = false
    for (const [id, entry] of entries) {
      if (entry.holds) continue
      entries.delete(id)
      entry.release()
      freed = true
    }
    if (freed) queueMicrotask(() => afterChange())
  }
  // The benchmark sizes what fits, and the listener's quality what to aim for.
  const unsubscribe = (options.subscribe ?? subscribePlaybackQuality)(() => {
    if (disposed) return
    plan()
    publish()
    pump()
  })

  function free(id: string, entry: Entry): void {
    entries.delete(id)
    entry.release()
  }

  function reserve(bytes: number): () => void {
    reserving = true
    try {
      return reserveStudioMemory(bytes)
    } finally {
      reserving = false
    }
  }

  function matching(
    project: StudioProject,
    assets: readonly StudioAsset[],
  ): Map<string, Entry> {
    const found = new Map<string, Entry>()
    if (!entries.size) return found
    let keys: Map<string, string>
    try {
      keys = laneFreezeKeys(project, assets)
    } catch {
      return found
    }
    for (const [trackId, key] of keys) {
      const entry = entries.get(entryId(trackId, key))
      if (entry && !entry.stale) found.set(trackId, entry)
    }
    return found
  }

  function publish(): void {
    if (disposed) return
    const frozen = song ? matching(song.project, song.assets) : new Map()
    setStatus({
      wanted,
      ready: Math.min(wanted, frozen.size),
      rendering: rendering.size > 0,
      frozen: new Set(frozen.keys()),
    })
  }

  function afterChange(): void {
    if (disposed) return
    plan()
    publish()
    options.changed?.()
  }

  /** The heard lanes with clips: what costs the audio thread. */
  function heardLanes(current: Song): StudioPlannedLane[] {
    return [...current.lanes.values()]
      .map(({ lane }) => lane)
      .filter((lane) => lane.audible)
  }

  function plan(): void {
    clearTimeout(settleTimer)
    queue = []
    wanted = 0
    const current = song
    const us = voiceChainUs()
    if (!current || us === undefined || !(us > 0)) return
    const at = now()
    let nextSettle = Infinity
    const candidates: StudioFreezeCandidate[] = heardLanes(current).map(
      (lane) => {
        const trackId = lane.track.id
        const key = current.lanes.get(trackId)!.key
        const entry = entries.get(entryId(trackId, key))
        const settledAt =
          (seen.get(trackId)?.at ?? -Infinity) + FREEZE_SETTLE_MS
        if (settledAt > at) nextSettle = Math.min(nextSettle, settledAt)
        // A lane rendering now counts as frozen: it soon is.
        return {
          trackId,
          spec: lane.spec,
          bytes: entry?.lane.bytes ?? frozenLaneBytes(lane),
          ready:
            (entry !== undefined && !entry.stale) || rendering.has(trackId),
          settled: settledAt <= at && !failed.has(key),
        }
      },
    )
    const picked = choice()
    const order = chooseLaneFreezes(candidates, {
      tier: picked === 'auto' ? 'best' : picked,
      voiceChainUs: us,
      memoryBytes: studioWorkingBytes() * FREEZE_MEMORY_SHARE,
    })
    // Once memory refused a render, the song gets what is rendered until it changes.
    queue = memoryShort ? [] : order
    wanted = candidates.filter((lane) => lane.ready).length + queue.length
    if (nextSettle !== Infinity && !disposed)
      settleTimer = setTimeout(() => {
        plan()
        publish()
        pump()
      }, nextSettle - at)
  }

  function cache(): StudioBufferCache {
    return caches.pop() ?? (options.createCache ?? createStudioBufferCache)()
  }

  function decoder(): BaseAudioContext {
    decodeContext ??=
      options.decodeContext?.() ??
      new OfflineAudioContext(1, 1, STUDIO_SAMPLE_RATE)
    return decodeContext
  }

  async function renderLane(
    current: Song,
    lane: StudioPlannedLane,
    key: string,
  ): Promise<void> {
    const trackId = lane.track.id
    if (!lane.segments.length) return
    const [latency] = await measure([lane.spec], STUDIO_SAMPLE_RATE)
    abort.signal.throwIfAborted()
    const releaseWorking = reserve(laneRenderWorkingBytes(lane, latency))
    const slot = cache()
    let frozen: StudioFrozenLane
    try {
      const ids = new Set(lane.segments.map((segment) => segment.assetId))
      const lease = await slot.acquire(
        current.assets.filter((asset) => ids.has(asset.id)),
        decoder(),
        options.readCanonicalAsset,
        abort.signal,
      )
      try {
        frozen = await render(lane, lease.buffers, {
          latencyFrames: latency,
          key,
          signal: abort.signal,
        })
      } finally {
        lease.release()
      }
    } finally {
      slot.clear()
      caches.push(slot)
      releaseWorking()
    }
    const release = reserve(frozen.bytes)
    if (disposed || song?.lanes.get(trackId)?.key !== key) {
      release()
      return
    }
    unregister ??= registerStudioMemoryReclaimer(reclaim)
    entries.set(entryId(trackId, key), {
      lane: frozen,
      holds: 0,
      stale: false,
      release,
    })
  }

  function pump(): void {
    while (
      !paused &&
      !disposed &&
      song &&
      rendering.size < concurrency &&
      queue.length
    ) {
      const current = song
      const trackId = queue.shift()!
      const planned = current.lanes.get(trackId)
      if (!planned || rendering.has(trackId)) continue
      rendering.add(trackId)
      void renderLane(current, planned.lane, planned.key)
        .catch((error: unknown) => {
          if (isStudioMemoryRefusal(error)) memoryShort = true
          else if (!abort.signal.aborted) failed.add(planned.key)
        })
        .finally(() => {
          rendering.delete(trackId)
          if (disposed) return
          afterChange()
          pump()
        })
    }
    publish()
  }

  function compileSong(
    project: StudioProject,
    assets: readonly StudioAsset[],
  ): Song | null {
    try {
      const plan = compileStudioArrangement(project, assets)
      return {
        project,
        assets,
        lanes: new Map(
          plan.lanes
            .filter((lane) => lane.segments.length > 0)
            .map((lane) => [lane.track.id, { lane, key: laneFreezeKey(lane) }]),
        ),
      }
    } catch {
      return null
    }
  }

  return {
    /** Follow the song as it stands: what changed waits, what is left alone may render. */
    update(project: StudioProject, assets: readonly StudioAsset[]): void {
      if (disposed) return
      const next = compileSong(project, assets)
      const opened = song?.project.id !== project.id
      song = next
      if (opened) {
        seen.clear()
        failed.clear()
      }
      memoryShort = false
      const at = now()
      const keys = new Set<string>()
      for (const [trackId, { key }] of next?.lanes ?? []) {
        keys.add(entryId(trackId, key))
        const before = seen.get(trackId)
        // A song just opened is not being edited: its lanes may render now.
        if (!before) seen.set(trackId, { key, at: opened ? -Infinity : at })
        else if (before.key !== key) seen.set(trackId, { key, at })
      }
      for (const [id, entry] of entries) {
        if (keys.has(id)) continue
        entry.stale = true
        if (!entry.holds) free(id, entry)
      }
      plan()
      pump()
    },
    hold(
      project: StudioProject,
      assets: readonly StudioAsset[],
    ): StudioFreezeHold | null {
      const found = matching(project, assets)
      if (!found.size) return null
      for (const entry of found.values()) entry.holds++
      let released = false
      return {
        lanes: new Map(
          [...found].map(([trackId, entry]) => [trackId, entry.lane]),
        ),
        release() {
          if (released) return
          released = true
          for (const [trackId, entry] of found) {
            entry.holds--
            if (entry.stale && !entry.holds)
              free(entryId(trackId, entry.lane.key), entry)
          }
        },
      }
    },
    differs(
      project: StudioProject,
      assets: readonly StudioAsset[],
      frozen: ReadonlyMap<string, StudioFrozenLane>,
    ): boolean {
      const found = matching(project, assets)
      if (found.size !== frozen.size) return true
      for (const [trackId, entry] of found)
        if (frozen.get(trackId) !== entry.lane) return true
      return false
    },
    /** Start no render while Export, Compare or auto-balance needs the room. */
    pause(): void {
      paused = true
    },
    resume(): void {
      if (!paused) return
      paused = false
      memoryShort = false
      plan()
      pump()
    },
    dispose(): void {
      if (disposed) return
      disposed = true
      clearTimeout(settleTimer)
      abort.abort()
      unregister?.()
      unsubscribe()
      // A render a run still holds goes when that run lets it go.
      for (const [id, entry] of entries) {
        entry.stale = true
        if (!entry.holds) free(id, entry)
      }
      for (const slot of caches) slot.dispose()
      caches.length = 0
      setStatus(IDLE_STATUS)
    },
  }
}

export type StudioLaneFreezer = ReturnType<typeof createStudioLaneFreezer>
