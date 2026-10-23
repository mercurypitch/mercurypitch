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
// Per output route as well, where the route adds a delay of its own: a TV on
// AirPlay or HDMI plays the song well behind the phone's speaker, and
// Bluetooth further behind still, so each of those keeps its own offsets per
// input (`micLatencyByRoute`), measured on it. Until one is, the route
// borrows the input's offset from the phone's own outputs, as every route did
// before, and claims no spread for it. The phone's own outputs (the speaker,
// the earpiece, wired headphones) share the input's offset, and so does the
// web, which cannot say where its sound goes (audio-route-store.ts).
//
// Zero is the default and means uncompensated, which is exactly how the app
// behaved before this existed. Every consumer must stay a no-op at zero.
//
// Tests: src/tests/mic-latency-store.test.ts.

import { MAX_LATENCY_MS, MAX_ROUTE_LATENCY_MS } from '@/lib/mic-latency'
import { micManager } from '@/lib/mic-manager'
import { createPersistedSignal } from '@/lib/storage'
import { audioRoute } from '@/stores/audio-route-store'

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

/** Output routes that add a delay of their own, each with its own offsets. */
export type LatencyRoute = 'bluetooth' | 'airplay' | 'hdmi'

const OWN_DELAY: readonly LatencyRoute[] = ['bluetooth', 'airplay', 'hdmi']

/** Offsets measured on a route with a delay of its own, keyed `route:device`. */
export const [micLatencyByRoute, setMicLatencyByRoute] =
  createPersistedSignal<LatencyByDevice>(
    'pitchperfect_mic_latency_route',
    {},
    {
      validator: isLatencyMap,
    },
  )

/** Their spreads, kept as `micLatencySpreadByDevice` is. */
export const [micLatencySpreadByRoute, setMicLatencySpreadByRoute] =
  createPersistedSignal<LatencyByDevice>(
    'pitchperfect_mic_latency_route_spread',
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

/**
 * The route the offsets are kept for now: one with a delay of its own, or
 * null for the phone's own outputs, the web, and a phone not yet read.
 */
export function currentLatencyRoute(): LatencyRoute | null {
  const now = audioRoute()
  return OWN_DELAY.find((route) => route === now) ?? null
}

/** Each route's name, as the latency screens say it. */
export const LATENCY_ROUTE_NAMES: Readonly<Record<LatencyRoute, string>> = {
  bluetooth: 'Bluetooth',
  airplay: 'AirPlay',
  hdmi: 'HDMI',
}

const routeKey = (route: LatencyRoute, deviceKey: string): string =>
  `${route}:${deviceKey}`

/**
 * The key the current input's measurement is kept under on the route the
 * sound takes now: the input's own on the phone's outputs and the web,
 * `route:input` on a route with a delay of its own. For what keeps a fact
 * beside each measurement (the phone's day of it, latency-measured.ts).
 */
export function currentLatencyKey(): string {
  const route = currentLatencyRoute()
  const deviceKey = currentMicDeviceKey()
  return route === null ? deviceKey : routeKey(route, deviceKey)
}

/**
 * The keys a device's values may be under: its own, then, for a resolved
 * system-default route, the alias older releases stored it under. Once the
 * browser resolves that route, the old calibration stays useful until the
 * player measures the physical input again; an exact value always wins.
 */
function keysFor(deviceId: string | null): string[] {
  const key = deviceId ?? DEFAULT_DEVICE_KEY
  if (
    key !== DEFAULT_DEVICE_KEY &&
    micManager.getPreferredDevice() === null &&
    micManager.getResolvedDevice() === key
  ) {
    return [key, DEFAULT_DEVICE_KEY]
  }
  return [key]
}

function valueForDevice(
  values: LatencyByDevice,
  deviceId: string | null,
): number | undefined {
  for (const key of keysFor(deviceId)) {
    const value = values[key]
    if (value !== undefined) return value
  }
  return undefined
}

/** A value measured on `route` itself, or undefined while it borrows. */
function valueOnRoute(
  values: LatencyByDevice,
  route: LatencyRoute,
  deviceId: string | null,
): number | undefined {
  for (const key of keysFor(deviceId)) {
    const value = values[routeKey(route, key)]
    if (value !== undefined) return value
  }
  return undefined
}

/** Read one known opened route even when MicManager had to fall back to it. */
export function micLatencyMsForDevice(deviceId: string | null): number {
  const route = currentLatencyRoute()
  const own =
    route === null
      ? undefined
      : valueOnRoute(micLatencyByRoute(), route, deviceId)
  return own ?? valueForDevice(micLatencyByDevice(), deviceId) ?? 0
}

/**
 * Round-trip latency for the current input in ms. Zero when it has never been
 * measured — callers rely on that meaning "change nothing".
 */
export function micLatencyMs(): number {
  return micLatencyMsForDevice(currentMicDeviceKey())
}

/** The same number in seconds, which is what the audio clock deals in. */
export function micLatencySec(): number {
  return micLatencyMs() / 1000
}

/**
 * Read spread evidence for the actual opened route, not its stale request.
 * A route that borrows its offset from the phone's own outputs has no
 * spread to stand behind: it compensates, but supports no early/late claim.
 */
export function micLatencySpreadMsForDevice(
  deviceId: string | null,
): number | null {
  const route = currentLatencyRoute()
  if (route === null) {
    return valueForDevice(micLatencySpreadByDevice(), deviceId) ?? null
  }
  if (valueOnRoute(micLatencyByRoute(), route, deviceId) === undefined) {
    return null
  }
  return valueOnRoute(micLatencySpreadByRoute(), route, deviceId) ?? null
}

/** Calibration spread for the current input, or null for legacy/unknown runs. */
export function micLatencySpreadMs(): number | null {
  return micLatencySpreadMsForDevice(currentMicDeviceKey())
}

/**
 * Whether the offset in use was measured on the route the sound takes now.
 * False on a route with a delay of its own that still borrows the input's
 * offset, and for an input never measured at all.
 */
export function micLatencyMeasuredOnRoute(): boolean {
  const deviceId = currentMicDeviceKey()
  const route = currentLatencyRoute()
  return route === null
    ? valueForDevice(micLatencyByDevice(), deviceId) !== undefined
    : valueOnRoute(micLatencyByRoute(), route, deviceId) !== undefined
}

/**
 * One measurement for `deviceKey`, clamped to the believable range, kept for
 * the route the sound takes now: its own maps for a route with a delay of
 * its own, the input's otherwise. A route with a delay of its own believes up
 * to a second (`MAX_ROUTE_LATENCY_MS`), the phone's own outputs half that.
 * An unknown spread is stored as absent.
 */
function keepMeasurement(
  deviceKey: string,
  latencyMs: number,
  spreadMs: number | null,
): void {
  const route = currentLatencyRoute()
  const ceiling = route === null ? MAX_LATENCY_MS : MAX_ROUTE_LATENCY_MS
  const latency = Math.max(0, Math.min(ceiling, Math.round(latencyMs)))
  const key = route === null ? deviceKey : routeKey(route, deviceKey)
  const setLatency =
    route === null ? setMicLatencyByDevice : setMicLatencyByRoute
  const setSpread =
    route === null ? setMicLatencySpreadByDevice : setMicLatencySpreadByRoute
  setLatency((prev) => ({ ...prev, [key]: latency }))
  setSpread((prev) => {
    if (spreadMs === null || !Number.isFinite(spreadMs) || spreadMs < 0) {
      if (!(key in prev)) return prev
      const next = { ...prev }
      delete next[key]
      return next
    }
    return { ...prev, [key]: Math.round(spreadMs) }
  })
}

/** Store a measured offset against the current input, clamped to the believable range. */
export function setMicLatencyMs(ms: number): void {
  keepMeasurement(currentMicDeviceKey(), ms, null)
}

/** Store one complete measurement, including the evidence quality it achieved. */
export function setMicLatencyMeasurement(
  latencyMs: number,
  spreadMs: number | null,
): void {
  keepMeasurement(currentMicDeviceKey(), latencyMs, spreadMs)
}

/** Store calibration against the actual opened route after device fallback. */
export function setMicLatencyMeasurementForDevice(
  deviceId: string | null,
  latencyMs: number,
  spreadMs: number | null,
): void {
  keepMeasurement(deviceId ?? DEFAULT_DEVICE_KEY, latencyMs, spreadMs)
}

/**
 * Forget the current input's offset, back to uncompensated: on a route with
 * a delay of its own, the one measured there, which leaves the input's own
 * offset for the phone's outputs to keep.
 */
export function clearMicLatency(): void {
  const keys = keysFor(currentMicDeviceKey())
  const route = currentLatencyRoute()
  const own = route === null ? keys : keys.map((key) => routeKey(route, key))
  const forget = (prev: LatencyByDevice): LatencyByDevice => {
    if (!own.some((key) => key in prev)) return prev
    const next = { ...prev }
    for (const key of own) delete next[key]
    return next
  }
  if (route === null) {
    setMicLatencyByDevice(forget)
    setMicLatencySpreadByDevice(forget)
  } else {
    setMicLatencyByRoute(forget)
    setMicLatencySpreadByRoute(forget)
  }
}
