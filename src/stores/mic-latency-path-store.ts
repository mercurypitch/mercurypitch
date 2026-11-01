// ============================================================
// Mic latency path store — the output path of the clock each round trip was measured on, kept beside the measurement
// ============================================================
//
// The latency wizard measures on a context of its own, which buffers as
// little as the device allows ('interactive'). The Studio plays on a clock
// that buffers more ('playback', web-audio-lease.ts): in headless Chromium
// 148, 21 ms of base latency and 72 to 80 ms of output latency against 11
// and 40 to 48 ms. A round trip measured on the wizard's clock is short on
// the Studio's by that difference, so the wizard keeps the path it measured
// on, and the Studio adds what its own clock buffers beyond it
// (studioRoundTrip in take-timing.ts). A measurement kept before this
// existed has no path, and is used as it is.
//
// Keyed the way the measurement is (currentLatencyKey): per input, and per
// output route with a delay of its own.
import { createPersistedSignal } from '@/lib/storage'
import { currentLatencyKey } from './mic-latency-store'

type PathByKey = Record<string, number>

const isPathMap = (value: unknown): value is PathByKey =>
  typeof value === 'object' &&
  value !== null &&
  !Array.isArray(value) &&
  Object.values(value).every(
    (n) => typeof n === 'number' && Number.isFinite(n) && n >= 0,
  )

export const [micLatencyPathByKey, setMicLatencyPathByKey] =
  createPersistedSignal<PathByKey>(
    'mercurypitch_mic_latency_path',
    {},
    {
      validator: isPathMap,
    },
  )

/** Keep the output path, in ms, of the clock the measurement now kept was made on; null forgets it. */
export function setMicLatencyPathMs(pathMs: number | null): void {
  const key = currentLatencyKey()
  setMicLatencyPathByKey((prev) => {
    const next = { ...prev }
    if (pathMs === null || !Number.isFinite(pathMs) || pathMs < 0)
      delete next[key]
    else next[key] = Math.round(pathMs * 10) / 10
    return next
  })
}

/** The output path the current input's measurement was made on, in ms, or null when not kept. */
export function micLatencyPathMs(): number | null {
  return micLatencyPathByKey()[currentLatencyKey()] ?? null
}
