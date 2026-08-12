// ============================================================
// fetch-progress — download an ArrayBuffer and report bytes as they arrive
// ============================================================
//
// `await resp.arrayBuffer()` is one atomic step: a caller can report 0% before
// it and 100% after it, and nothing in between. That is fine for a 200 KB
// lyrics file and useless for a 12 MB stem on a television, where the whole
// download is a single multi-minute stretch at 0%.
//
// Reading `resp.body` a chunk at a time costs nothing extra and turns that
// stretch into real numbers. Everything here degrades rather than throws: a
// response with no `Content-Length` still reports bytes (with `total: null`,
// so the UI can show a byte count instead of a fake percentage), and a
// response with no readable body falls back to `arrayBuffer()`.

/** Bytes so far, and the expected total when the server declared one. */
export interface DownloadProgress {
  received: number
  /** `null` when the response carried no usable `Content-Length`. */
  total: number | null
  /** 0..1, or `null` when the total is unknown. */
  fraction: number | null
}

export interface FetchProgressOptions {
  signal?: AbortSignal
  /**
   * Called on every chunk. Called at least once with `received: 0` before the
   * first chunk, so a caller can swap "connecting" for "downloading" as soon
   * as the response headers land.
   */
  onProgress?: (progress: DownloadProgress) => void
}

/**
 * `Content-Length` on a compressed response describes the *encoded* size, so
 * the bytes we hand back can exceed it. Reporting >100% looks broken, and the
 * mismatch only shows up at the end, so treat the total as an estimate and
 * lift it to whatever we have actually received.
 */
function progressOf(received: number, total: number | null): DownloadProgress {
  const known = total !== null && total > 0 ? Math.max(total, received) : null
  return {
    received,
    total: known,
    fraction: known === null ? null : received / known,
  }
}

function declaredLength(resp: Response): number | null {
  // Two headers, because Cloudflare (and any compressing proxy) drops
  // Content-Length on a streamed response but can still tell us the
  // uncompressed size out of band.
  const raw =
    resp.headers.get('content-length') ??
    resp.headers.get('x-original-content-length')
  if (raw === null) return null
  const parsed = Number.parseInt(raw, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

/**
 * Fetch `url` into an ArrayBuffer, reporting bytes as they arrive.
 *
 * Throws on a non-2xx status (with the status in the message) and on abort,
 * exactly like the plain `fetch` + `arrayBuffer()` pair it replaces.
 */
export async function fetchArrayBufferWithProgress(
  url: string,
  options: FetchProgressOptions = {},
): Promise<ArrayBuffer> {
  const { signal, onProgress } = options
  const resp = await fetch(url, signal !== undefined ? { signal } : {})
  if (!resp.ok) throw new Error(`HTTP ${resp.status} for ${url}`)

  const total = declaredLength(resp)
  onProgress?.(progressOf(0, total))

  // No stream to read (a mocked Response in a test, or an opaque body):
  // one atomic read, and the caller's next report is the finished size.
  if (resp.body === null) {
    const buf = await resp.arrayBuffer()
    onProgress?.(progressOf(buf.byteLength, total ?? buf.byteLength))
    return buf
  }

  const reader = resp.body.getReader()
  const chunks: Uint8Array[] = []
  let received = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      if (value !== undefined) {
        chunks.push(value)
        received += value.byteLength
        onProgress?.(progressOf(received, total))
      }
    }
  } finally {
    // An abort mid-read leaves the body locked; releasing lets the connection
    // be torn down instead of held open until GC.
    reader.releaseLock()
  }

  // One allocation rather than repeated concatenation — a 12 MB stem would
  // otherwise copy itself ~200 times.
  const merged = new Uint8Array(received)
  let offset = 0
  for (const chunk of chunks) {
    merged.set(chunk, offset)
    offset += chunk.byteLength
  }
  onProgress?.(progressOf(received, received))
  return merged.buffer
}

/**
 * Bytes as something a person reads at a glance — the point of showing them
 * is "this is moving", so one decimal is plenty and MB is the unit that makes
 * a stem download legible.
 */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 MB'
  if (bytes < 1024) return `${Math.round(bytes)} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * Aggregate progress across several parallel downloads.
 *
 * Byte-weighted where possible: a 12 MB instrumental and a 3 MB vocal should
 * not each be worth half the bar. Until a stem's size is known it contributes
 * its share of the *count* instead, which is what keeps the bar from jumping
 * backwards as later `Content-Length`s arrive.
 */
export function aggregateProgress(parts: readonly DownloadProgress[]): {
  fraction: number
  received: number
  total: number | null
} {
  if (parts.length === 0) return { fraction: 0, received: 0, total: null }
  const received = parts.reduce((sum, p) => sum + p.received, 0)
  const sized = parts.filter((p) => p.total !== null)
  if (sized.length === parts.length) {
    const total = parts.reduce((sum, p) => sum + (p.total ?? 0), 0)
    return {
      fraction: total > 0 ? Math.min(1, received / total) : 0,
      received,
      total,
    }
  }
  // Mixed or fully unknown: average the fractions we have, and score an
  // unsized part as 0 until it finishes. Coarser, but monotonic.
  const sum = parts.reduce((acc, p) => acc + (p.fraction ?? 0), 0)
  return {
    fraction: Math.min(1, sum / parts.length),
    received,
    total: null,
  }
}
