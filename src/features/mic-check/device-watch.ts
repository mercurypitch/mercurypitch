// ============================================================
// Device watch — the inputs as the browser lists them, kept current
// ============================================================
//
// The browser half of the roster; mic-roster.ts is the pure half. Reading
// `enumerateDevices()`, following `devicechange`, and reading which device a
// live capture track says it opened, for every surface that names inputs:
// the Settings mic check and First Light's waiting screen.

import type { ListeningTrack } from './mic-roster'

/** `devicechange` arrives in bursts while a device settles; read once after. */
export const DEVICE_SETTLE_MS = 250

/** The connected devices, or null where the browser will not list them. */
export async function listDevices(): Promise<MediaDeviceInfo[] | null> {
  const mediaDevices = navigator.mediaDevices
  if (typeof mediaDevices?.enumerateDevices !== 'function') return null
  try {
    return await mediaDevices.enumerateDevices()
  } catch {
    return null
  }
}

/**
 * Call `onChange` once a burst of `devicechange` events has settled.
 * Returns the unsubscribe.
 */
export function watchDeviceChanges(
  onChange: () => void,
  settleMs = DEVICE_SETTLE_MS,
): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined
  const onDeviceChange = (): void => {
    clearTimeout(timer)
    timer = setTimeout(onChange, settleMs)
  }
  navigator.mediaDevices?.addEventListener?.('devicechange', onDeviceChange)
  return () => {
    clearTimeout(timer)
    navigator.mediaDevices?.removeEventListener?.(
      'devicechange',
      onDeviceChange,
    )
  }
}

/** What a capture track says about the device it opened. */
export function trackIdentity(
  track: MediaStreamTrack | null | undefined,
): ListeningTrack | null {
  if (track === null || track === undefined) return null
  const settings = track.getSettings?.() ?? {}
  return {
    deviceId: settings.deviceId ?? null,
    groupId: settings.groupId ?? null,
    label: track.label === '' ? null : track.label,
  }
}
