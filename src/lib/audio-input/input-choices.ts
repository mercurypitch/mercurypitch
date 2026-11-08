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
// channels are rows of their own, as a DAW's record input lists them: each
// input, then each aligned pair ("Inputs 1 + 2"), after the default, which
// says what it takes once the input's channel count is known.
//
// Studio's input lists read their rows from here. Jam keeps the browser's
// role entries as rows of their own, so it lists its inputs itself
// (jam-audio-source.ts).

import type { ChannelPick } from './input-channels'
import { channelPicks, defaultChannelPick, samePick } from './input-channels'
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

/** A pick by its jacks' names, 1-based: "Input 2", or "Inputs 1 + 2". */
export function channelPickLabel(pick: ChannelPick): string {
  return pick.pair
    ? `Inputs ${pick.channel + 1} + ${pick.channel + 2}`
    : `Input ${pick.channel + 1}`
}

/** One row of a channel picker: null is the default, which the input's channel count decides. */
export interface ChannelChoice {
  readonly pick: ChannelPick | null
  readonly label: string
  /** False for a kept pick the input does not have, as far as its count is known. */
  readonly present: boolean
}

/**
 * An input's channel picker: the default first, named for what it takes
 * once the count is known ("Default: Inputs 1 + 2"), then each input and
 * each aligned pair the input has. A kept pick the input does not have
 * stays, marked, so the picker still shows what is kept; while the count
 * is not known it is listed as it is.
 */
export function channelChoices(
  channelCount: number | null,
  chosen: ChannelPick | null,
): ChannelChoice[] {
  const count =
    channelCount === null ? null : Math.max(0, Math.floor(channelCount))
  const choices: ChannelChoice[] = [
    {
      pick: null,
      label:
        count === null || count === 0
          ? 'Default'
          : `Default: ${channelPickLabel(defaultChannelPick(count))}`,
      present: true,
    },
    ...channelPicks(count ?? 0).map((pick) => ({
      pick,
      label: channelPickLabel(pick),
      present: true,
    })),
  ]
  if (chosen !== null && !choices.some((row) => samePick(row.pick, chosen)))
    choices.push({
      pick: chosen,
      label:
        count === null
          ? channelPickLabel(chosen)
          : `${channelPickLabel(chosen)} (not on this input)`,
      present: count === null,
    })
  return choices
}
