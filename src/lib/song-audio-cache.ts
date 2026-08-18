// ============================================================
// song-audio-cache — the big remote audio files, kept between visits
// ============================================================
//
// The demo stems are served from R2 with an ETag, a Last-Modified and no
// `Cache-Control` whatsoever, so the browser is left to heuristics for a
// 6 MB body — and on iOS that means a fresh download on every open. The
// wait a phone pays for the demo song was therefore paid again, in full,
// every single time.
//
// So the app keeps its own copy. Cache-first, bounded, and every failure
// is a miss rather than an error: a storage quota that says no must cost
// a re-download, never a song.
//
// Deliberately not the service worker's business. `sw-runtime` caches
// this build's own hashed same-origin assets and nothing else, on purpose
// — these files are cross-origin, unhashed, and two orders of magnitude
// bigger than anything in that manifest.
//
// The URL is the whole cache key, with no revalidation: these files are
// addressed by path, and the Content Studio changes a demo by pointing at
// a different object rather than by editing one. Replacing the bytes
// under a URL somebody already has would be the one way to serve a stale
// stem — bump the path instead, the way every other authored asset here
// does.
//
// Only http(s) URLs are eligible. Locally separated stems arrive as
// `blob:` URLs backed by IndexedDB, which are already on the device and
// stop resolving the moment the lease is released.

/** Bumped only when the stored shape changes; the URL is the key. */
export const SONG_AUDIO_CACHE_NAME = 'mercurypitch-song-audio-v1'

/**
 * How much audio may be kept. Six or seven demo-sized stems — enough that
 * re-opening the songs someone actually sings is free, small enough to sit
 * inside a phone's origin quota beside the database and the model cache.
 */
export const SONG_AUDIO_CACHE_BUDGET_BYTES = 96 * 1024 * 1024

/**
 * A single file this size or larger is not worth the budget: one entry
 * would evict every other and still be gone by the next visit.
 */
export const SONG_AUDIO_CACHE_MAX_ENTRY_BYTES = 32 * 1024 * 1024

/** Written by us, so a stored entry always declares its own size. */
const BYTES_HEADER = 'x-mp-cached-bytes'

/** Injectable for tests; production reads the global. */
export interface SongAudioCacheEnv {
  caches?: CacheStorage
}

function cacheStorage(env: SongAudioCacheEnv): CacheStorage | null {
  const store =
    env.caches ?? (globalThis as { caches?: CacheStorage }).caches ?? null
  return store
}

/**
 * Whether this URL is one we may keep a copy of.
 *
 * `blob:` and `data:` URLs are already local — a copy would double the
 * storage a separated song costs — and a `blob:` URL stops resolving as
 * soon as its lease is released, so a cached one would be a permanent
 * miss that still occupied the budget.
 */
export function isCacheableSongUrl(url: string): boolean {
  return url.startsWith('https://') || url.startsWith('http://')
}

function storedBytes(response: Response): number {
  const raw =
    response.headers.get(BYTES_HEADER) ?? response.headers.get('content-length')
  const parsed = Number.parseInt(raw ?? '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
}

/**
 * Make room for `incoming` bytes by dropping the oldest entries.
 *
 * `cache.keys()` answers in insertion order, so this is first-in-first-out
 * rather than least-recently-used. Refreshing recency would mean rewriting
 * a multi-megabyte entry on every hit, which costs more than the eviction
 * order is worth for a cache that holds a handful of songs.
 */
async function evictFor(
  cache: Cache,
  url: string,
  incoming: number,
): Promise<void> {
  const keys = await cache.keys()
  const entries: { request: Request; bytes: number }[] = []
  let total = incoming
  for (const request of keys) {
    // Replacing an entry does not add to the total — `put` overwrites it.
    if (request.url === url) continue
    const stored = await cache.match(request)
    const bytes = stored === undefined ? 0 : storedBytes(stored)
    entries.push({ request, bytes })
    total += bytes
  }

  for (const entry of entries) {
    if (total <= SONG_AUDIO_CACHE_BUDGET_BYTES) return
    await cache.delete(entry.request)
    total -= entry.bytes
  }
}

/** The kept copy of `url`, or null for anything at all going wrong. */
export async function readCachedSongAudio(
  url: string,
  env: SongAudioCacheEnv = {},
): Promise<ArrayBuffer | null> {
  if (!isCacheableSongUrl(url)) return null
  const store = cacheStorage(env)
  if (store === null) return null
  try {
    const cache = await store.open(SONG_AUDIO_CACHE_NAME)
    const hit = await cache.match(url)
    if (hit === undefined) return null
    const bytes = await hit.arrayBuffer()
    // A truncated entry decodes to nothing and would be re-served forever;
    // treat it as the miss it is and let the caller download again.
    return bytes.byteLength > 0 ? bytes : null
  } catch {
    return null
  }
}

/**
 * Keep `bytes` under `url`. Resolves to whether it was stored — callers
 * treat that as information, never as a failure to handle.
 *
 * The response body is copied out of `bytes` synchronously, before the
 * first await: `decodeAudioData` detaches the buffer it is handed, and
 * every caller decodes the moment this call yields.
 */
export async function writeCachedSongAudio(
  url: string,
  bytes: ArrayBuffer,
  contentType: string,
  env: SongAudioCacheEnv = {},
): Promise<boolean> {
  if (!isCacheableSongUrl(url)) return false
  if (
    bytes.byteLength === 0 ||
    bytes.byteLength > SONG_AUDIO_CACHE_MAX_ENTRY_BYTES
  ) {
    return false
  }
  const store = cacheStorage(env)
  if (store === null) return false

  // Built here, before the first await, and never after it: the caller
  // hands its buffer straight to `decodeAudioData` the moment this call
  // yields, and that detaches it.
  const body = new Response(bytes, {
    headers: {
      'content-type': contentType,
      [BYTES_HEADER]: String(bytes.byteLength),
    },
  })

  try {
    const cache = await store.open(SONG_AUDIO_CACHE_NAME)
    await evictFor(cache, url, bytes.byteLength)
    await cache.put(url, body)
    return true
  } catch {
    // A full quota, a private window that refuses storage, a browser with
    // no Cache Storage at all — none of them is worth a broken song.
    return false
  }
}
