// ============================================================
// Mic Latency Store — the measured round trip, per input device
// ============================================================
//
// Per device on purpose: a USB interface and a laptop's built-in mic differ by
// more than the offset itself, so one number for the machine would be wrong on
// whichever device was not measured. Keyed by the MicManager's preferred
// device id, with `DEFAULT_DEVICE_KEY` standing for "whatever the OS picks" —
// the case for most people, who never open the device list.
//
// Zero is the default and means uncompensated, which is exactly how the app
// behaved before this existed. Every consumer must stay a no-op at zero.
//
// Tests: src/tests/mic-latency-store.test.ts.

import { MAX_LATENCY_MS } from '@/lib/mic-latency'
import { micManager } from '@/lib/mic-manager'
import { createPersistedSignal } from '@/lib/storage'

/** Key for the OS-default input, which has no device id of its own. */
export const DEFAULT_DEVICE_KEY = 'default'

type LatencyByDevice = Record<string, number>

const isLatencyMap = (v: unknown): v is LatencyByDevice =>
  typeof v === 'object' &&
  v !== null &&
  !Array.isArray(v) &&
  Object.values(v).every((n) => typeof n === 'number' && Number.isFinite(n))

export const [micLatencyByDevice, setMicLatencyByDevice] =
  createPersistedSignal<LatencyByDevice>(
    'pitchperfect_mic_latency',
    {},
    {
      validator: isLatencyMap,
    },
  )

/** The device the offsets are keyed by right now. */
export function currentMicDeviceKey(): string {
  return micManager.getPreferredDevice() ?? DEFAULT_DEVICE_KEY
}

/**
 * Round-trip latency for the current input in ms. Zero when it has never been
 * measured — callers rely on that meaning "change nothing".
 */
export function micLatencyMs(): number {
  return micLatencyByDevice()[currentMicDeviceKey()] ?? 0
}

/** The same number in seconds, which is what the audio clock deals in. */
export function micLatencySec(): number {
  return micLatencyMs() / 1000
}

/** Store a measured offset against the current input, clamped to the believable range. */
export function setMicLatencyMs(ms: number): void {
  const clamped = Math.max(0, Math.min(MAX_LATENCY_MS, Math.round(ms)))
  const key = currentMicDeviceKey()
  setMicLatencyByDevice((prev) => ({ ...prev, [key]: clamped }))
}

/** Forget the current input's offset, back to uncompensated. */
export function clearMicLatency(): void {
  const key = currentMicDeviceKey()
  setMicLatencyByDevice((prev) => {
    if (!(key in prev)) return prev
    const next = { ...prev }
    delete next[key]
    return next
  })
}
