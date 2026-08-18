// ============================================================
// Guitar Night can open the demo song too
// ============================================================
//
// The room's library is the visitor's own separations, so a guitarist who
// has never run one opened it to an empty shelf. Karaoke Night's demo is
// the song that answers that, and this is the port that offers it — plus
// the composition that keeps the two libraries' failures apart, because
// "your local library could not be opened" and "the demo could not be
// reached" are not the same news.

import { afterEach, describe, expect, it, vi } from 'vitest'
import type { DemoSongManifest } from '@/features/karaoke-night/demo-song'
import { DEMO_SESSION_ID } from '@/features/karaoke-night/demo-song'
import { ASSUMED_DEMO_SECONDS, createDemoGuitarNightSongPort, } from './demo-song-port'
import type { GuitarNightOpenBackingResult, GuitarNightSongPort, GuitarNightSongSummary, } from './song-port'
import { composeGuitarNightSongPorts, DEMO_CATALOG_WAIT_MS } from './song-port'

function manifest(over: Partial<DemoSongManifest> = {}): DemoSongManifest {
  return {
    title: 'Goodbye to Spring',
    artist: 'Josh Woodward',
    attribution: { text: '', url: '', license: '', licenseUrl: '' },
    stems: {
      vocal: 'https://cdn.example/demo/vocal.m4a',
      instrumental: 'https://cdn.example/demo/instrumental.m4a',
    },
    durationSec: 246,
    ...over,
  }
}

function port(manifests: DemoSongManifest[]): GuitarNightSongPort {
  return createDemoGuitarNightSongPort({
    loadManifests: async () => Promise.resolve(manifests),
  })
}

const live = (): AbortSignal => new AbortController().signal

function aborted(): AbortSignal {
  const controller = new AbortController()
  controller.abort()
  return controller.signal
}

describe('the demo as a Guitar Night song', () => {
  it('offers nothing until the catalog has been read', () => {
    expect(port([manifest()]).completedSongs()).toEqual([])
  })

  it('names it as a demo rather than as something prepared here', async () => {
    const demo = port([manifest()])
    await demo.initialize()

    expect(demo.completedSongs()).toEqual([
      {
        sessionId: DEMO_SESSION_ID,
        title: 'Goodbye to Spring',
        createdAt: 0,
        source: 'demo',
        subtitle: 'Demo song · Josh Woodward',
      },
    ])
  })

  it('opens as a two-stem mix with both parts audible', async () => {
    const demo = port([manifest()])
    await demo.initialize()

    const result = await demo.openSession(DEMO_SESSION_ID, live())
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.lease.title).toBe('Goodbye to Spring')
    expect(result.lease.stems).toEqual([
      {
        kind: 'vocal',
        url: 'https://cdn.example/demo/vocal.m4a',
        sizeBytes: 0,
        durationSeconds: 246,
      },
      {
        kind: 'instrumental',
        url: 'https://cdn.example/demo/instrumental.m4a',
        sizeBytes: 0,
        durationSeconds: 246,
      },
    ])
    expect(result.lease.defaultMix).toEqual({
      kind: 'mixed-instrumental',
      audible: ['vocal', 'instrumental'],
      muted: [],
    })
    // Nothing was leased, so releasing must be safe and must do nothing.
    expect(() => result.lease.release()).not.toThrow()
  })

  it('namespaces a second demo under its own slug', async () => {
    const demo = port([manifest({ slug: 'winter-hymn', title: 'Winter Hymn' })])
    await demo.initialize()

    expect(demo.completedSongs()[0]?.sessionId).toBe(
      `${DEMO_SESSION_ID}:winter-hymn`,
    )
  })

  it('leaves out a demo that is missing a stem', async () => {
    const demo = port([
      manifest({ stems: { instrumental: 'https://cdn.example/i.m4a' } }),
      manifest({ slug: 'half', stems: { vocal: 'https://cdn.example/v.m4a' } }),
    ])
    await demo.initialize()

    // A row that can only ever fail to open is worse than no row.
    expect(demo.completedSongs()).toEqual([])
  })

  it('assumes an undeclared demo is long', async () => {
    // The transport decides decode-versus-stream from the duration, and a
    // song worth nothing at all is one a phone will try to decode whole.
    for (const durationSec of [undefined, 0]) {
      const demo = port([manifest({ durationSec })])
      await demo.initialize()
      const result = await demo.openSession(DEMO_SESSION_ID, live())
      expect(result.ok).toBe(true)
      if (!result.ok) continue
      expect(result.lease.stems[0]?.durationSeconds).toBe(ASSUMED_DEMO_SECONDS)
    }
  })

  it('reports a session it has never heard of', async () => {
    const demo = port([manifest()])
    await demo.initialize()

    expect(await demo.openSession('some-uvr-session', live())).toEqual({
      ok: false,
      code: 'not-found',
    })
  })

  it('stops before doing any work for a request already called off', async () => {
    const demo = port([manifest()])
    await demo.initialize()

    expect(await demo.openSession(DEMO_SESSION_ID, aborted())).toEqual({
      ok: false,
      code: 'aborted',
    })
  })

  it('keeps the newest refresh when two overlap', async () => {
    let releaseFirst: (value: DemoSongManifest[]) => void = () => undefined
    const responses: Promise<DemoSongManifest[]>[] = [
      new Promise((resolve) => {
        releaseFirst = resolve
      }),
      Promise.resolve([manifest({ slug: 'newer', title: 'Newer Demo' })]),
    ]
    const demo = createDemoGuitarNightSongPort({
      loadManifests: () => responses.shift() ?? Promise.resolve([]),
    })

    const first = demo.initialize()
    await demo.initialize()
    // The slow first read lands last and must not overwrite what the
    // second one already answered.
    releaseFirst([manifest({ slug: 'older', title: 'Older Demo' })])
    await first

    expect(demo.completedSongs().map((song) => song.title)).toEqual([
      'Newer Demo',
    ])
  })

  it('reads the app\u2019s demo list when given no reader of its own', async () => {
    // The default is `loadDemoSongs`, which goes to the API and then to
    // the shipped manifest. Neither is reachable here, so the point is
    // only that the port survives it and offers nothing.
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Promise.reject(new Error('offline'))),
    )
    const demo = createDemoGuitarNightSongPort()
    await demo.initialize()

    expect(demo.completedSongs()).toEqual([])
    vi.unstubAllGlobals()
  })
})

// ============================================================
// Two libraries, one catalog
// ============================================================

function stubPort(
  over: Partial<GuitarNightSongPort> = {},
): GuitarNightSongPort {
  return {
    initialize: async () => Promise.resolve(),
    completedSongs: () => [],
    openSession: async () =>
      Promise.resolve<GuitarNightOpenBackingResult>({
        ok: false,
        code: 'not-found',
      }),
    ...over,
  }
}

function song(sessionId: string): GuitarNightSongSummary {
  return { sessionId, title: sessionId, createdAt: 1 }
}

afterEach(() => {
  vi.useRealTimers()
})

describe('the device library and the demo together', () => {
  it('lists the visitor’s own songs first', () => {
    const composed = composeGuitarNightSongPorts(
      stubPort({ completedSongs: () => [song('mine')] }),
      stubPort({
        completedSongs: () => [{ ...song('demo'), source: 'demo' }],
      }),
    )

    expect(composed.completedSongs().map((s) => s.sessionId)).toEqual([
      'mine',
      'demo',
    ])
  })

  it('still fails loudly when the device library cannot be opened', async () => {
    const composed = composeGuitarNightSongPorts(
      stubPort({
        initialize: async () => Promise.reject(new Error('IndexedDB blocked')),
      }),
      stubPort(),
    )

    // This is what the room's "Your local library could not be opened"
    // and its Try again are built on — swallowing it would leave a
    // visitor staring at a shelf that is silently empty.
    await expect(composed.initialize()).rejects.toThrow('IndexedDB blocked')
  })

  it('does not let an unreachable demo cost the device library', async () => {
    const composed = composeGuitarNightSongPorts(
      stubPort({ completedSongs: () => [song('mine')] }),
      stubPort({
        initialize: async () => Promise.reject(new Error('offline')),
      }),
    )

    await expect(composed.initialize()).resolves.toBeUndefined()
    expect(composed.completedSongs()).toHaveLength(1)
  })

  it('opens the shelf without waiting out a demo that never answers', async () => {
    vi.useFakeTimers()
    try {
      const composed = composeGuitarNightSongPorts(
        stubPort({ completedSongs: () => [song('mine')] }),
        // A dead connection: the manifest fetch simply never settles.
        stubPort({ initialize: () => new Promise(() => undefined) }),
      )

      let opened = false
      void composed.initialize().then(() => {
        opened = true
      })
      await vi.advanceTimersByTimeAsync(DEMO_CATALOG_WAIT_MS - 1)
      expect(opened).toBe(false)

      await vi.advanceTimersByTimeAsync(1)
      // The visitor's own songs live on this device and must not be held
      // shut behind a network the demo lives on.
      expect(opened).toBe(true)
      expect(composed.completedSongs()).toHaveLength(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('does not sit on the timer once the demo has answered', async () => {
    vi.useFakeTimers()
    try {
      const composed = composeGuitarNightSongPorts(stubPort(), stubPort())
      await composed.initialize()

      // Nothing left pending: a wait that outlived its answer would keep a
      // timer alive for four seconds after every library open.
      expect(vi.getTimerCount()).toBe(0)
    } finally {
      vi.useRealTimers()
    }
  })

  it('asks the demo only for a session the device does not have', async () => {
    const deviceOpen = vi.fn(async () =>
      Promise.resolve<GuitarNightOpenBackingResult>({
        ok: false,
        code: 'not-found',
      }),
    )
    const demoOpen = vi.fn(async () =>
      Promise.resolve<GuitarNightOpenBackingResult>({
        ok: false,
        code: 'not-found',
      }),
    )
    const composed = composeGuitarNightSongPorts(
      stubPort({ openSession: deviceOpen }),
      stubPort({ openSession: demoOpen }),
    )

    await composed.openSession('anything', live())
    expect(deviceOpen).toHaveBeenCalledOnce()
    expect(demoOpen).toHaveBeenCalledOnce()
  })

  it('never asks the demo about a song the device already answered for', async () => {
    const demoOpen = vi.fn()
    const composed = composeGuitarNightSongPorts(
      stubPort({
        openSession: async () =>
          Promise.resolve<GuitarNightOpenBackingResult>({
            ok: false,
            code: 'missing-local-audio',
          }),
      }),
      stubPort({ openSession: demoOpen }),
    )

    // A prepared song whose audio has gone must not be reported as the
    // demo failing to load.
    expect(await composed.openSession('mine', live())).toEqual({
      ok: false,
      code: 'missing-local-audio',
    })
    expect(demoOpen).not.toHaveBeenCalled()
  })

  it('hands back the device’s lease untouched', async () => {
    const lease = {
      sessionId: 'mine',
      title: 'Mine',
      stems: [],
      defaultMix: { kind: 'mixed-instrumental', audible: [], muted: [] },
      release: () => undefined,
    } as unknown as Extract<GuitarNightOpenBackingResult, { ok: true }>['lease']
    const composed = composeGuitarNightSongPorts(
      stubPort({
        openSession: async () => Promise.resolve({ ok: true, lease } as const),
      }),
      stubPort(),
    )

    const result = await composed.openSession('mine', live())
    expect(result.ok && result.lease).toBe(lease)
  })

  it('stops between the two when the request was called off', async () => {
    const demoOpen = vi.fn()
    const composed = composeGuitarNightSongPorts(
      stubPort(),
      stubPort({ openSession: demoOpen }),
    )

    expect(await composed.openSession('anything', aborted())).toEqual({
      ok: false,
      code: 'aborted',
    })
    expect(demoOpen).not.toHaveBeenCalled()
  })
})
