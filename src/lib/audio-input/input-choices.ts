// ============================================================
// Input choices — an input picker's rows: the default, each input by name, a chosen one that is gone, and an interface's channels
// ============================================================
//
// The browser names its inputs only once the page may use the microphone
// (enumerateDevices): until then the list holds the default alone, and an
// input without a name yet is numbered as a device. A choice is kept by id
// with the name it had, so an input that is gone stays in the list, named
// and marked not connected, while the caller records from the default
// meanwhile. Chromium's own "default" and "communications" entries are left
// out: the first row, null, stands for them (isPseudoEntry, mic-roster.ts).
//
// A device is never called "Input N": that is a channel, a jack on an
// interface ("Input 2"), as Guitar Night names them too. An input's
// channels are rows of their own, and the null channel takes all of them.
//
// Studio's input lists read their rows from here. Jam keeps the browser's
// role entries as rows of their own, so it lists its inputs itself
// (jam-audio-source.ts).

import { isPseudoEntry } from './mic-roster'

/** One row of an input picker: null is the system's default input, or what the picker follows. */
export interface InputChoice {
  readonly id: string | null
  readonly label: string
  readonly connected: boolean
}

/** A device as a picker reads it. */
type PickerDevice = Pick<MediaDeviceInfo, 'deviceId' | 'label'>

/**
 * The input list: the null row first, then every named input, then the
 * chosen one when it is not connected. An input without a name yet is
 * numbered. The null row is "Default input" unless the picker names what
 * it follows (`nullLabel`).
 */
export function inputChoices(
  devices: readonly PickerDevice[],
  chosen: { readonly id: string | null; readonly label: string | null },
  nullLabel = 'Default input',
): InputChoice[] {
  const inputs = devices.filter(
    (device) => device.deviceId !== '' && !isPseudoEntry(device),
  )
  const choices: InputChoice[] = [
    { id: null, label: nullLabel, connected: true },
    ...inputs.map((device, index) => ({
      id: device.deviceId,
      label: device.label !== '' ? device.label : `Device ${index + 1}`,
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

/** One row of a channel picker: null takes every channel, mixed; a number is 0-based. */
export interface ChannelChoice {
  readonly channel: number | null
  readonly label: string
  /** The input has this channel; false for a chosen one past its count. */
  readonly present: boolean
}

/**
 * An input's channels: all of them first, then each by its jack's name,
 * "Input 1" up, and a chosen channel past the count, marked, so the picker
 * still shows what is kept.
 */
export function channelChoices(
  channelCount: number,
  chosen: number | null,
): ChannelChoice[] {
  const count = Math.max(0, Math.floor(channelCount))
  const choices: ChannelChoice[] = [
    { channel: null, label: 'All inputs, mixed', present: true },
    ...Array.from({ length: count }, (_, channel) => ({
      channel,
      label: `Input ${channel + 1}`,
      present: true,
    })),
  ]
  if (chosen !== null && chosen >= count)
    choices.push({
      channel: chosen,
      label: `Input ${chosen + 1} (not on this input)`,
      present: false,
    })
  return choices
}
