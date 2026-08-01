// ============================================================
// Stem peaks — tiny waveform envelopes for the stem cards
// ============================================================
// Decodes a stem once, reduces it to a few hundred |peak| buckets and
// caches by URL. The AudioBuffer itself is released right after
// bucketing (multi-minute WAVs are ~35 MB of PCM each — the cards only
// need the outline), so showing six waveforms costs kilobytes, not
// hundreds of megabytes. Decodes run sequentially for the same reason.

/** Reduce channel data to `buckets` max-|sample| values, normalized to
 *  the loudest bucket (0..1). Pure — exported for tests. */
export function peaksFromChannels(
  channels: readonly Float32Array[],
  buckets: number,
): Float32Array {
  const out = new Float32Array(buckets)
  if (channels.length === 0 || buckets <= 0) return out
  const length = channels[0].length
  if (length === 0) return out
  const perBucket = length / buckets
  for (let b = 0; b < buckets; b++) {
    const start = Math.floor(b * perBucket)
    const end = Math.min(
      length,
      Math.max(start + 1, Math.floor((b + 1) * perBucket)),
    )
    let peak = 0
    for (const ch of channels) {
      for (let i = start; i < end; i++) {
        const v = Math.abs(ch[i])
        if (v > peak) peak = v
      }
    }
    out[b] = peak
  }
  let max = 0
  for (let b = 0; b < buckets; b++) if (out[b] > max) max = out[b]
  if (max > 0) for (let b = 0; b < buckets; b++) out[b] /= max
  return out
}

const cache = new Map<string, Promise<Float32Array>>()
let decodeQueue: Promise<unknown> = Promise.resolve()
let sharedCtx: AudioContext | null = null

const PEAK_BUCKETS = 240

/**
 * Peaks for a stem URL (blob/object URLs included), cached per URL.
 * Rejections are evicted so a transient failure can be retried.
 */
export function getStemPeaks(url: string): Promise<Float32Array> {
  const hit = cache.get(url)
  if (hit) return hit
  const job = (decodeQueue = decodeQueue.then(async () => {
    const resp = await fetch(url)
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
    const bytes = await resp.arrayBuffer()
    // A plain AudioContext decodes without a user gesture (only playback
    // needs one); reused so we don't leak one context per stem.
    sharedCtx ??= new AudioContext()
    const buffer = await sharedCtx.decodeAudioData(bytes)
    const channels: Float32Array[] = []
    for (let c = 0; c < buffer.numberOfChannels; c++) {
      channels.push(buffer.getChannelData(c))
    }
    return peaksFromChannels(channels, PEAK_BUCKETS)
  })) as Promise<Float32Array>
  cache.set(url, job)
  job.catch(() => cache.delete(url))
  return job
}

/** Drop cached peaks for a URL (call when revoking an object URL). */
export function evictStemPeaks(url: string): void {
  cache.delete(url)
}

/** Draw peaks into a canvas as a mirrored bar envelope in `color`. The
 *  canvas is sized to its CSS box at device pixels before drawing. */
export function drawStemPeaks(
  canvas: HTMLCanvasElement,
  peaks: Float32Array,
  color: string,
): void {
  const dpr = window.devicePixelRatio || 1
  const w = Math.max(1, Math.round(canvas.clientWidth * dpr))
  const h = Math.max(1, Math.round(canvas.clientHeight * dpr))
  if (canvas.width !== w) canvas.width = w
  if (canvas.height !== h) canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.clearRect(0, 0, w, h)
  ctx.fillStyle = color
  const mid = h / 2
  const step = w / peaks.length
  const barW = Math.max(1, step * 0.7)
  for (let i = 0; i < peaks.length; i++) {
    const amp = Math.max(peaks[i] * mid * 0.92, h * 0.02)
    ctx.fillRect(i * step, mid - amp, barW, amp * 2)
  }
}
