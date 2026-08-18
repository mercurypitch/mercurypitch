// ============================================================
// song-audio-cache — the copy that means the song downloads once
// ============================================================
//
// The behaviour being pinned is mostly what happens when storage says no.
// Every one of these paths is reachable in the wild — a private window
// with no Cache Storage, a full quota, an entry evicted by the browser
// between two lines of the same function — and every one of them has to
// come out as "download it again", never as a broken song.

import { afterEach, describe, expect, it, vi } from 'vitest'
import { isCacheableSongUrl, readCachedSongAudio, SONG_AUDIO_CACHE_BUDGET_BYTES, SONG_AUDIO_CACHE_MAX_ENTRY_BYTES, SONG_AUDIO_CACHE_NAME, writeCachedSongAudio, } from './song-audio-cache'

const STEM = 'https://cdn.example/demo/goodbye-to-spring/vocal.m4a'
const OTHER = 'https://cdn.example/demo/goodbye-to-spring/instrumental.m4a'

/** The Cache API accepts a URL string, a URL, or the Request `keys()` gave. */
function keyOf(key: RequestInfo | URL): string {
  if (typeof key === 'string') return key
  if (key instanceof URL) return key.href
  return (key as Request).url
}

/**
 * Keyed by the full URL rather than by pathname: everything this cache
 * holds is cross-origin, which is exactly what the service worker's own
 * cache refuses to touch.
 */
class FakeCache {
  readonly entries = new Map<string, Response>()
  putFails: Error | null = null

  async match(key: RequestInfo | URL): Promise<Response | undefined> {
    // The real Cache hands out a fresh body each time; without the clone a
    // second read in one test throws instead of the assertion failing.
    return Promise.resolve(this.entries.get(keyOf(key))?.clone())
  }

  async put(key: RequestInfo | URL, response: Response): Promise<void> {
    if (this.putFails !== null) throw this.putFails
    this.entries.set(keyOf(key), response)
    return Promise.resolve()
  }

  async keys(): Promise<Request[]> {
    return Promise.resolve(
      [...this.entries.keys()].map((url) => ({ url }) as unknown as Request),
    )
  }

  async delete(key: RequestInfo | URL): Promise<boolean> {
    return Promise.resolve(this.entries.delete(keyOf(key)))
  }
}

class FakeCacheStorage {
  readonly opened = new Map<string, FakeCache>()
  openFails: Error | null = null

  async open(name: string): Promise<FakeCache> {
    if (this.openFails !== null) throw this.openFails
    const existing = this.opened.get(name)
    if (existing !== undefined) return Promise.resolve(existing)
    const created = new FakeCache()
    this.opened.set(name, created)
    return Promise.resolve(created)
  }
}

function env(store: FakeCacheStorage) {
  return { caches: store as unknown as CacheStorage }
}

function bytes(length: number, fill = 7): ArrayBuffer {
  return new Uint8Array(length).fill(fill).buffer
}

/**
 * An entry that CLAIMS a size without holding one. Eviction reads the size
 * off the stored headers, so a megabyte-scale budget can be filled without
 * a megabyte-scale allocation.
 */
function claiming(megabytes: number): Response {
  return new Response(new Uint8Array(1), {
    headers: { 'x-mp-cached-bytes': String(megabytes * 1024 * 1024) },
  })
}

afterEach(() => {
  Reflect.deleteProperty(globalThis as unknown as object, 'caches')
  vi.restoreAllMocks()
})

describe('what may be kept', () => {
  it('keeps remote audio', () => {
    expect(isCacheableSongUrl(STEM)).toBe(true)
    expect(isCacheableSongUrl('http://localhost:3000/demo.m4a')).toBe(true)
  })

  it('refuses everything that is already on the device', () => {
    // A blob: URL is IndexedDB audio the app already holds, and it stops
    // resolving the moment its lease is released — a cached one would be a
    // permanent miss still occupying the budget.
    expect(isCacheableSongUrl('blob:https://app.example/9f2c')).toBe(false)
    expect(isCacheableSongUrl('data:audio/mp4;base64,AAAA')).toBe(false)
    expect(isCacheableSongUrl('/karaoke-demo-song.json')).toBe(false)
  })
})

describe('a song that has been downloaded once', () => {
  it('comes back from the cache the next time', async () => {
    const store = new FakeCacheStorage()
    expect(
      await writeCachedSongAudio(STEM, bytes(1024), 'audio/mp4', env(store)),
    ).toBe(true)

    const hit = await readCachedSongAudio(STEM, env(store))
    expect(hit).not.toBeNull()
    expect(hit?.byteLength).toBe(1024)
    expect(new Uint8Array(hit!)[0]).toBe(7)
  })

  it('is stored under a cache of its own, keyed by the whole URL', async () => {
    const store = new FakeCacheStorage()
    await writeCachedSongAudio(STEM, bytes(64), 'audio/mp4', env(store))

    const cache = store.opened.get(SONG_AUDIO_CACHE_NAME)
    expect(cache).toBeDefined()
    expect([...cache!.entries.keys()]).toEqual([STEM])
    expect(cache!.entries.get(STEM)?.headers.get('content-type')).toBe(
      'audio/mp4',
    )
  })

  it('is a miss for a URL nobody has asked for yet', async () => {
    const store = new FakeCacheStorage()
    await writeCachedSongAudio(STEM, bytes(64), 'audio/mp4', env(store))
    expect(await readCachedSongAudio(OTHER, env(store))).toBeNull()
  })

  it('reads the cache the page owns when no store is handed in', async () => {
    const store = new FakeCacheStorage()
    Object.defineProperty(globalThis, 'caches', {
      value: store,
      configurable: true,
      writable: true,
    })

    expect(await writeCachedSongAudio(STEM, bytes(32), 'audio/mp4')).toBe(true)
    expect((await readCachedSongAudio(STEM))?.byteLength).toBe(32)
  })
})

describe('storage that says no', () => {
  it('is a miss, not a failure, where there is no Cache Storage at all', async () => {
    expect(await readCachedSongAudio(STEM)).toBeNull()
    expect(await writeCachedSongAudio(STEM, bytes(64), 'audio/mp4')).toBe(false)
  })

  it('is a miss when the cache cannot even be opened', async () => {
    const store = new FakeCacheStorage()
    store.openFails = new Error('SecurityError')

    expect(await readCachedSongAudio(STEM, env(store))).toBeNull()
    expect(
      await writeCachedSongAudio(STEM, bytes(64), 'audio/mp4', env(store)),
    ).toBe(false)
  })

  it('reports a refused write rather than throwing it at the load', async () => {
    const store = new FakeCacheStorage()
    const cache = await store.open(SONG_AUDIO_CACHE_NAME)
    cache.putFails = new Error('QuotaExceededError')

    expect(
      await writeCachedSongAudio(STEM, bytes(1024), 'audio/mp4', env(store)),
    ).toBe(false)
  })

  it('never touches storage for audio that is already local', async () => {
    const store = new FakeCacheStorage()
    const blob = 'blob:https://app.example/9f2c'

    expect(await readCachedSongAudio(blob, env(store))).toBeNull()
    expect(
      await writeCachedSongAudio(blob, bytes(64), 'audio/mp4', env(store)),
    ).toBe(false)
    expect(store.opened.size).toBe(0)
  })

  it('treats a truncated entry as the miss it is', async () => {
    const store = new FakeCacheStorage()
    const cache = await store.open(SONG_AUDIO_CACHE_NAME)
    // Empty bodies decode to nothing. Served from cache forever, they would
    // be a song that never plays again and no download that could fix it.
    cache.entries.set(STEM, new Response(new Uint8Array(0)))

    expect(await readCachedSongAudio(STEM, env(store))).toBeNull()
  })
})

describe('what is not worth keeping', () => {
  it('declines an empty body', async () => {
    const store = new FakeCacheStorage()
    expect(
      await writeCachedSongAudio(STEM, bytes(0), 'audio/mp4', env(store)),
    ).toBe(false)
    expect(store.opened.size).toBe(0)
  })

  it('declines a file big enough to evict the whole cache by itself', async () => {
    const store = new FakeCacheStorage()
    const huge = bytes(SONG_AUDIO_CACHE_MAX_ENTRY_BYTES + 1)

    expect(
      await writeCachedSongAudio(STEM, huge, 'audio/mp4', env(store)),
    ).toBe(false)
    expect(store.opened.size).toBe(0)
  })
})

describe('staying inside the budget', () => {
  const mib = (n: number) => n * 1024 * 1024

  it('drops the oldest entries, and only as many as it has to', async () => {
    const store = new FakeCacheStorage()
    const cache = await store.open(SONG_AUDIO_CACHE_NAME)
    cache.entries.set('https://cdn.example/a.m4a', claiming(40))
    cache.entries.set('https://cdn.example/b.m4a', claiming(40))
    cache.entries.set('https://cdn.example/c.m4a', claiming(40))

    expect(mib(120)).toBeGreaterThan(SONG_AUDIO_CACHE_BUDGET_BYTES)
    expect(
      await writeCachedSongAudio(STEM, bytes(1024), 'audio/mp4', env(store)),
    ).toBe(true)

    // 120 MiB over a 96 MiB budget: one eviction brings it to 80, which is
    // room enough, so `b` and `c` stay.
    expect([...cache.entries.keys()]).toEqual([
      'https://cdn.example/b.m4a',
      'https://cdn.example/c.m4a',
      STEM,
    ])
  })

  it('evicts nothing while there is room', async () => {
    const store = new FakeCacheStorage()
    const cache = await store.open(SONG_AUDIO_CACHE_NAME)
    cache.entries.set('https://cdn.example/a.m4a', claiming(10))

    await writeCachedSongAudio(STEM, bytes(1024), 'audio/mp4', env(store))
    expect([...cache.entries.keys()]).toEqual([
      'https://cdn.example/a.m4a',
      STEM,
    ])
  })

  it('does not count the entry it is about to replace', async () => {
    const store = new FakeCacheStorage()
    const cache = await store.open(SONG_AUDIO_CACHE_NAME)
    cache.entries.set('https://cdn.example/a.m4a', claiming(60))
    cache.entries.set(STEM, claiming(60))

    // A naive sum reads 120 MiB and throws away `a` to make room for a
    // stem that is only overwriting itself.
    await writeCachedSongAudio(STEM, bytes(1024), 'audio/mp4', env(store))
    expect(cache.entries.has('https://cdn.example/a.m4a')).toBe(true)
  })

  it('counts an entry with no declared size as nothing', async () => {
    const store = new FakeCacheStorage()
    const cache = await store.open(SONG_AUDIO_CACHE_NAME)
    // Nothing writes these — but a browser that dropped our header, or an
    // entry from an older shape, must not be read as an infinite size and
    // evict the cache it belongs to.
    cache.entries.set('https://cdn.example/a.m4a', new Response('x'))

    await writeCachedSongAudio(STEM, bytes(1024), 'audio/mp4', env(store))
    expect(cache.entries.has('https://cdn.example/a.m4a')).toBe(true)
  })

  it('falls back to content-length when our own header is missing', async () => {
    const store = new FakeCacheStorage()
    const cache = await store.open(SONG_AUDIO_CACHE_NAME)
    cache.entries.set(
      'https://cdn.example/a.m4a',
      new Response('x', { headers: { 'content-length': String(mib(120)) } }),
    )

    await writeCachedSongAudio(STEM, bytes(1024), 'audio/mp4', env(store))
    expect(cache.entries.has('https://cdn.example/a.m4a')).toBe(false)
  })

  it('survives an entry the browser evicted between listing and reading it', async () => {
    const store = new FakeCacheStorage()
    const cache = await store.open(SONG_AUDIO_CACHE_NAME)
    cache.entries.set('https://cdn.example/a.m4a', claiming(40))
    vi.spyOn(cache, 'match').mockResolvedValue(undefined)

    expect(
      await writeCachedSongAudio(STEM, bytes(1024), 'audio/mp4', env(store)),
    ).toBe(true)
  })
})
