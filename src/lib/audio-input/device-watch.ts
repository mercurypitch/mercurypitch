// ============================================================
// Device watch — the inputs as the browser lists them, kept current
// ============================================================
//
// The browser half of the roster; mic-roster.ts is the pure half. Reading
// `enumerateDevices()`, following `devicechange`, and reading which device a
// live capture track says it opened, for every surface that names inputs:
// the Settings mic check, First Light's waiting screen, and Studio's and
// Jam's input lists.

import type { ListeningTrack } from './mic-roster'

/** `devicechange` arrives in bursts while a device settles; read once after. */
export const DEVICE_SETTLE_MS = 250

/** The browser's device list, where there is a browser to ask. */
const mediaDevices = (): MediaDevices | undefined =>
  typeof navigator === 'undefined' ? undefined : navigator.mediaDevices

/** The connected devices, or null where the browser will not list them. */
export async function listDevices(): Promise<MediaDeviceInfo[] | null> {
  const media = mediaDevices()
  if (typeof media?.enumerateDevices !== 'function') return null
  try {
    return await media.enumerateDevices()
  } catch {
    return null
  }
}

/**
 * The audio inputs alone. A browser that will not list them (no device
 * list, or enumeration refused in a cross-origin frame or with media
 * blocked) lists none, rather than failing the picker that asked.
 */
export async function listAudioInputDevices(): Promise<MediaDeviceInfo[]> {
  const devices = await listDevices()
  return devices === null
    ? []
    : devices.filter((device) => device.kind === 'audioinput')
}

/**
 * Call `onChange` once a burst of `devicechange` events has settled; with a
 * settle of 0, at every event as it comes. Returns the unsubscribe.
 */
export function watchDeviceChanges(
  onChange: () => void,
  settleMs = DEVICE_SETTLE_MS,
): () => void {
  const media = mediaDevices()
  let timer: ReturnType<typeof setTimeout> | undefined
  const onDeviceChange = (): void => {
    clearTimeout(timer)
    if (settleMs > 0) timer = setTimeout(onChange, settleMs)
    else onChange()
  }
  media?.addEventListener?.('devicechange', onDeviceChange)
  return () => {
    clearTimeout(timer)
    media?.removeEventListener?.('devicechange', onDeviceChange)
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
