// ============================================================
// Studio inputs — the audio inputs a take can record from, as the browser lists them, kept current
// ============================================================
//
// The browser names its inputs only once the page may use the microphone
// (enumerateDevices): until then the list holds the default alone, and the
// first arm brings the names (useStudioRecorder reads the list again after
// it). An input plugged in or pulled out changes the list as it happens:
// Studio reads at every devicechange, without the settle the mic check
// waits for. The choice is kept by id, with the name it had
// (record-settings.ts), and the take records from the default input while
// the chosen one is gone (MicManager.acquireFrom). The Sound panel's rows
// are the shared input choices (@/lib/audio-input/input-choices).
import type { Accessor } from 'solid-js'
import { createSignal, onCleanup } from 'solid-js'
import { listAudioInputDevices, watchDeviceChanges, } from '@/lib/audio-input/device-watch'

/** The browser's audio inputs, read now and on every plug or unplug. */
export function createStudioInputs(): {
  devices: Accessor<readonly MediaDeviceInfo[]>
  refresh(): Promise<void>
} {
  const [devices, setDevices] = createSignal<readonly MediaDeviceInfo[]>([])
  let disposed = false
  const refresh = async () => {
    const listed = await listAudioInputDevices()
    if (!disposed) setDevices(listed)
  }
  const unwatch = watchDeviceChanges(() => void refresh(), 0)
  onCleanup(() => {
    disposed = true
    unwatch()
  })
  void refresh()
  return { devices, refresh }
}
