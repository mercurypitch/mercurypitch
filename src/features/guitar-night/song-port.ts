// Guitar Night song ports describe prepared local backing without owning playback.
// ============================================================

export type GuitarNightStemKind =
  | 'vocal'
  | 'instrumental'
  | 'drums'
  | 'bass'
  | 'guitar'
  | 'piano'
  | 'other'

export interface GuitarNightSongSummary {
  sessionId: string
  title: string
  createdAt: number
  /**
   * Where the song came from. `device` is a separation this visitor
   * prepared and the room counts as "on this device"; `demo` is the
   * shared song the app offers, which lives on the network and belongs to
   * nobody's library. Absent means device, which is what every caller
   * before the demo existed meant.
   */
  source?: 'device' | 'demo'
  /**
   * Shown under the title in place of the prepared date. A demo has no
   * prepared date to show — it was never prepared here.
   */
  subtitle?: string
}

export interface GuitarNightStemAsset {
  kind: GuitarNightStemKind
  url: string
  sizeBytes: number
  durationSeconds?: number
}

export type GuitarNightDefaultMix =
  | {
      kind: 'parts'
      audible: readonly GuitarNightStemKind[]
      muted: readonly [] | readonly ['guitar']
    }
  | {
      kind: 'mixed-instrumental'
      audible: readonly ('vocal' | 'instrumental')[]
      muted: readonly []
    }

export interface GuitarNightBackingLease {
  sessionId: string
  title: string
  stems: readonly GuitarNightStemAsset[]
  defaultMix: GuitarNightDefaultMix
  /**
   * Same meaning as on the summary, and read for the same reason: a demo
   * is not a separation session, so the room must not offer it the
   * band-split upgrade — that path reconnects to a durable UVR record
   * this song has never had. Absent means device.
   */
  source?: 'device' | 'demo'
  release(): void
}

export type GuitarNightOpenBackingResult =
  | { ok: true; lease: GuitarNightBackingLease }
  | {
      ok: false
      code: 'not-found' | 'not-completed' | 'missing-local-audio' | 'aborted'
    }

export interface GuitarNightSongPort {
  initialize(): Promise<void>
  completedSongs(): readonly GuitarNightSongSummary[]
  openSession(
    sessionId: string,
    signal: AbortSignal,
  ): Promise<GuitarNightOpenBackingResult>
}

export interface GuitarNightBackingPlan {
  kind: GuitarNightDefaultMix['kind']
  requested: readonly GuitarNightStemKind[]
}

const PART_STEMS: readonly GuitarNightStemKind[] = [
  'drums',
  'bass',
  'guitar',
  'piano',
  'other',
]

export function planGuitarNightBacking(
  available: readonly GuitarNightStemKind[],
): GuitarNightBackingPlan {
  const kinds = new Set(available)
  const accompanimentParts = PART_STEMS.filter(
    (kind) => kind !== 'guitar' && kinds.has(kind),
  )

  if (accompanimentParts.length > 0) {
    return {
      kind: 'parts',
      requested: [
        ...(kinds.has('vocal') ? (['vocal'] as const) : []),
        ...PART_STEMS.filter((kind) => kinds.has(kind)),
      ],
    }
  }

  return {
    kind: 'mixed-instrumental',
    requested: (['vocal', 'instrumental'] as const).filter((kind) =>
      kinds.has(kind),
    ),
  }
}

/**
 * Resolve the default mix from the stems that were actually leased. Durable
 * blobs can disappear between discovery and hydration, so UI claims must not
 * rely on the earlier availability snapshot.
 */
export function resolveGuitarNightDefaultMix(
  leased: readonly GuitarNightStemKind[],
): GuitarNightDefaultMix | null {
  const kinds = new Set(leased)
  const accompanimentParts = PART_STEMS.filter(
    (kind) => kind !== 'guitar' && kinds.has(kind),
  )

  if (accompanimentParts.length > 0) {
    return {
      kind: 'parts',
      audible: leased.filter((kind) => kind !== 'guitar'),
      muted: kinds.has('guitar') ? ['guitar'] : [],
    }
  }

  if (!kinds.has('instrumental')) return null
  return {
    kind: 'mixed-instrumental',
    audible: leased.filter(
      (kind): kind is 'vocal' | 'instrumental' =>
        kind === 'vocal' || kind === 'instrumental',
    ),
    muted: [],
  }
}

/**
 * How long the shelf waits on the demo catalog before opening without it.
 *
 * Generous for a few hundred bytes of manifest, and short enough not to
 * read as a hang. It exists because the demo lives on the network and the
 * rest of the library lives on the device: a visitor on a dead connection
 * must still get their own songs.
 */
export const DEMO_CATALOG_WAIT_MS = 4000

/**
 * Resolve when `work` settles, or when `ms` is up — whichever is first.
 * `work` must already be caught: this only ever waits, never handles.
 */
function settleWithin(work: Promise<unknown>, ms: number): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms)
    void work.then(() => {
      clearTimeout(timer)
      resolve()
    })
  })
}

/**
 * One library out of two sources: the songs this device has separated,
 * and the demo the app offers to anyone who has separated nothing yet.
 *
 * The two fail differently, and the split matters. A device library that
 * cannot be opened is the visitor's own problem to see and retry — it is
 * what "Your local library could not be opened" means — so that failure
 * still propagates. A demo that cannot be reached is a network the room
 * has no claim on, so it costs the demo and nothing else — including the
 * time it would otherwise spend holding the shelf shut.
 */
export function composeGuitarNightSongPorts(
  device: GuitarNightSongPort,
  demo: GuitarNightSongPort,
): GuitarNightSongPort {
  return {
    initialize: async () => {
      const demoReady = demo.initialize().catch(() => undefined)
      await device.initialize()
      await settleWithin(demoReady, DEMO_CATALOG_WAIT_MS)
    },

    completedSongs: () => [
      ...device.completedSongs(),
      ...demo.completedSongs(),
    ],

    openSession: async (sessionId, signal) => {
      const fromDevice = await device.openSession(sessionId, signal)
      // Anything but "no such session" is the device's answer to keep: a
      // prepared song whose audio has gone must not be reported as the
      // demo failing to load.
      if (fromDevice.ok || fromDevice.code !== 'not-found') return fromDevice
      if (signal.aborted) return { ok: false, code: 'aborted' }
      return demo.openSession(sessionId, signal)
    },
  }
}
