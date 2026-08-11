// ============================================================
// Mic Latency Store — the measured round trip, per input device
// ============================================================
//
// Per device on purpose: a USB interface and a laptop's built-in mic differ by
// more than the offset itself, so one number for the machine would be wrong on
// whichever device was not measured. Keyed by the MicManager's preferred
// resolved device id. `DEFAULT_DEVICE_KEY` remains the backwards-compatible
// alias for measurements saved before the browser exposed the physical input.
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

/**
 * The calibration's interquartile spread, kept separately so the long-lived
 * numeric offset map remains backwards compatible. A missing spread means an
 * older measurement can compensate playback, but cannot support an absolute
 * early/late claim.
 */
export const [micLatencySpreadByDevice, setMicLatencySpreadByDevice] =
  createPersistedSignal<LatencyByDevice>(
    'pitchperfect_mic_latency_spread',
    {},
    {
      validator: isLatencyMap,
    },
  )

/** The device the offsets are keyed by right now. */
export function currentMicDeviceKey(): string {
  return (
    micManager.getResolvedDevice() ??
    micManager.getPreferredDevice() ??
    DEFAULT_DEVICE_KEY
  )
}

function valueForDevice(
  values: LatencyByDevice,
  deviceId: string | null,
): number | undefined {
  const key = deviceId ?? DEFAULT_DEVICE_KEY
  const exact = values[key]
  if (exact !== undefined) return exact

  // Older releases stored the system-default route under one alias. Once the
  // browser resolves that route, keep the old calibration useful until the
  // player measures the physical input again; an exact value always wins.
  if (
    key !== DEFAULT_DEVICE_KEY &&
    micManager.getPreferredDevice() === null &&
    micManager.getResolvedDevice() === key
  ) {
    return values[DEFAULT_DEVICE_KEY]
  }
  return undefined
}

/**
 * Round-trip latency for the current input in ms. Zero when it has never been
 * measured — callers rely on that meaning "change nothing".
 */
export function micLatencyMs(): number {
  return valueForDevice(micLatencyByDevice(), currentMicDeviceKey()) ?? 0
}

/** Read one known opened route even when MicManager had to fall back to it. */
export function micLatencyMsForDevice(deviceId: string | null): number {
  return valueForDevice(micLatencyByDevice(), deviceId) ?? 0
}

/** The same number in seconds, which is what the audio clock deals in. */
export function micLatencySec(): number {
  return micLatencyMs() / 1000
}

/** Calibration spread for the current input, or null for legacy/unknown runs. */
export function micLatencySpreadMs(): number | null {
  return (
    valueForDevice(micLatencySpreadByDevice(), currentMicDeviceKey()) ?? null
  )
}

/** Read spread evidence for the actual opened route, not its stale request. */
export function micLatencySpreadMsForDevice(
  deviceId: string | null,
): number | null {
  return valueForDevice(micLatencySpreadByDevice(), deviceId) ?? null
}

/** Store a measured offset against the current input, clamped to the believable range. */
export function setMicLatencyMs(ms: number): void {
  const clamped = Math.max(0, Math.min(MAX_LATENCY_MS, Math.round(ms)))
  const key = currentMicDeviceKey()
  setMicLatencyByDevice((prev) => ({ ...prev, [key]: clamped }))
  setMicLatencySpreadByDevice((prev) => {
    if (!(key in prev)) return prev
    const next = { ...prev }
    delete next[key]
    return next
  })
}

/** Store one complete measurement, including the evidence quality it achieved. */
export function setMicLatencyMeasurement(
  latencyMs: number,
  spreadMs: number | null,
): void {
  const clampedLatency = Math.max(
    0,
    Math.min(MAX_LATENCY_MS, Math.round(latencyMs)),
  )
  const key = currentMicDeviceKey()
  setMicLatencyByDevice((prev) => ({ ...prev, [key]: clampedLatency }))
  setMicLatencySpreadByDevice((prev) => {
    if (spreadMs === null || !Number.isFinite(spreadMs) || spreadMs < 0) {
      if (!(key in prev)) return prev
      const next = { ...prev }
      delete next[key]
      return next
    }
    return { ...prev, [key]: Math.round(spreadMs) }
  })
}

/** Store calibration against the actual opened route after device fallback. */
export function setMicLatencyMeasurementForDevice(
  deviceId: string | null,
  latencyMs: number,
  spreadMs: number | null,
): void {
  const clampedLatency = Math.max(
    0,
    Math.min(MAX_LATENCY_MS, Math.round(latencyMs)),
  )
  const key = deviceId ?? DEFAULT_DEVICE_KEY
  setMicLatencyByDevice((prev) => ({ ...prev, [key]: clampedLatency }))
  setMicLatencySpreadByDevice((prev) => {
    if (spreadMs === null || !Number.isFinite(spreadMs) || spreadMs < 0) {
      if (!(key in prev)) return prev
      const next = { ...prev }
      delete next[key]
      return next
    }
    return { ...prev, [key]: Math.round(spreadMs) }
  })
}

/** Forget the current input's offset, back to uncompensated. */
export function clearMicLatency(): void {
  const key = currentMicDeviceKey()
  const keys = new Set([key])
  if (
    key !== DEFAULT_DEVICE_KEY &&
    micManager.getPreferredDevice() === null &&
    micManager.getResolvedDevice() === key
  ) {
    keys.add(DEFAULT_DEVICE_KEY)
  }
  setMicLatencyByDevice((prev) => {
    if (![...keys].some((candidate) => candidate in prev)) return prev
    const next = { ...prev }
    for (const candidate of keys) delete next[candidate]
    return next
  })
  setMicLatencySpreadByDevice((prev) => {
    if (![...keys].some((candidate) => candidate in prev)) return prev
    const next = { ...prev }
    for (const candidate of keys) delete next[candidate]
    return next
  })
}
