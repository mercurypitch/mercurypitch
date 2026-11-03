// ============================================================
// Studio inputs — the audio inputs a take can record from, by name, as the browser lists them
// ============================================================
//
// The browser names its inputs only once the page may use the microphone
// (enumerateDevices): until then the list holds the default alone, and the
// first arm brings the names. An input plugged in or pulled out changes the
// list as it happens (devicechange). The choice is kept by id, with the name
// it had (record-settings.ts), so an input that is gone is still named in
// the list, and the take records from the default input meanwhile
// (MicManager.acquireFrom). The browser's own "default" and
// "communications" entries are left out: "Default input" stands for them.
import type { Accessor } from 'solid-js'
import { createSignal, onCleanup } from 'solid-js'
import { listAudioInputs } from '@/lib/mic-manager'

/** One row of the input list: null is the system's default input. */
export interface StudioInputChoice {
  readonly id: string | null
  readonly label: string
  readonly connected: boolean
}

const BROWSER_ROUTES = new Set(['default', 'communications'])

/**
 * The input list: the default first, then every named input, then the
 * chosen one when it is not connected. An input without a name yet is
 * numbered.
 */
export function studioInputChoices(
  devices: readonly Pick<MediaDeviceInfo, 'deviceId' | 'label'>[],
  chosen: { readonly id: string | null; readonly label: string | null },
): StudioInputChoice[] {
  const inputs = devices.filter(
    (device) => device.deviceId !== '' && !BROWSER_ROUTES.has(device.deviceId),
  )
  const choices: StudioInputChoice[] = [
    { id: null, label: 'Default input', connected: true },
    ...inputs.map((device, index) => ({
      id: device.deviceId,
      label: device.label !== '' ? device.label : `Input ${index + 1}`,
      connected: true,
    })),
  ]
  if (
    chosen.id !== null &&
    !inputs.some((device) => device.deviceId === chosen.id)
  )
    choices.push({
      id: chosen.id,
      label: `${chosen.label ?? 'The input you chose'} (not connected)`,
      connected: false,
    })
  return choices
}

/** Whether the browser has named any input yet: it does once the page may use the microphone. */
export function studioInputsNamed(
  devices: readonly Pick<MediaDeviceInfo, 'deviceId' | 'label'>[],
): boolean {
  return devices.some(
    (device) => device.label !== '' && !BROWSER_ROUTES.has(device.deviceId),
  )
}

/** The browser's audio inputs, read now and on every plug or unplug. */
export function createStudioInputs(): {
  devices: Accessor<readonly MediaDeviceInfo[]>
  refresh(): Promise<void>
} {
  const [devices, setDevices] = createSignal<readonly MediaDeviceInfo[]>([])
  let disposed = false
  const refresh = async () => {
    const listed = await listAudioInputs().catch(() => [])
    if (!disposed) setDevices(listed)
  }
  const media =
    typeof navigator === 'undefined' ? undefined : navigator.mediaDevices
  const onChange = () => void refresh()
  media?.addEventListener?.('devicechange', onChange)
  onCleanup(() => {
    disposed = true
    media?.removeEventListener?.('devicechange', onChange)
  })
  void refresh()
  return { devices, refresh }
}
