// ============================================================
// Input choices — an input picker's rows: the default, each input by name, and a chosen one that is gone
// ============================================================
//
// The browser names its inputs only once the page may use the microphone
// (enumerateDevices): until then the list holds the default alone, and an
// input without a name yet is numbered. A choice is kept by id with the name
// it had, so an input that is gone stays in the list, named and marked not
// connected, while the caller records from the default meanwhile. Chromium's
// own "default" and "communications" entries are left out: "Default input"
// stands for them (isPseudoEntry, mic-roster.ts).
//
// Studio's input list reads its rows from here. Jam keeps the browser's
// role entries as rows of their own and names an unnamed device differently,
// so it lists its inputs itself (jam-audio-source.ts).

import { isPseudoEntry } from './mic-roster'

/** One row of an input picker: null is the system's default input. */
export interface InputChoice {
  readonly id: string | null
  readonly label: string
  readonly connected: boolean
}

/** A device as a picker reads it. */
type PickerDevice = Pick<MediaDeviceInfo, 'deviceId' | 'label'>

/**
 * The input list: the default first, then every named input, then the
 * chosen one when it is not connected. An input without a name yet is
 * numbered.
 */
export function inputChoices(
  devices: readonly PickerDevice[],
  chosen: { readonly id: string | null; readonly label: string | null },
): InputChoice[] {
  const inputs = devices.filter(
    (device) => device.deviceId !== '' && !isPseudoEntry(device),
  )
  const choices: InputChoice[] = [
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
export function inputsNamed(devices: readonly PickerDevice[]): boolean {
  return devices.some((device) => device.label !== '' && !isPseudoEntry(device))
}
