// ============================================================
// Studio inputs view model — every audio input, what it is, its channels, its round trip, what to know about it, and which lanes record what of it
// ============================================================
//
// The Inputs view is the Studio's I/O view. This is its content, worked out
// from plain values so it is tested without a browser: the roster's inputs
// (mic-roster.ts folds Chromium's role entries into flags and guesses each
// one's kind), each input's channel count as an arm or a check last found
// it (lane-inputs.ts), its round trip from the per-device latency store,
// and the lanes. A lane is listed under the input an arm would open for it
// (planStudioLaneInput: its own as the browser lists it, else the Studio's,
// else the system default) and on the row of what it takes: its pick where
// the input has it, else the default. An input's rows are the default,
// named for what it takes, then each input and each aligned pair
// (channelChoices); none until its count is known.

import type { ChannelPick } from '@/lib/audio-input/input-channels'
import { isAvailablePick, loudestChannel, samePick, } from '@/lib/audio-input/input-channels'
import { channelChoices } from '@/lib/audio-input/input-choices'
import { INPUT_KIND_LABEL } from '@/lib/audio-input/input-kinds'
import type { GuitarInputHealth } from '@/lib/audio-input/level-health'
import type { DeviceInfoLike, InputKind, RosterInput, } from '@/lib/audio-input/mic-roster'
import { buildRoster } from '@/lib/audio-input/mic-roster'
import type { InputChannelCount, StudioLaneInput, } from '@/lib/studio/record/lane-inputs'
import { isMidiLaneInput, knownInputChannels, planStudioLaneInput, } from '@/lib/studio/record/lane-inputs'

/** A lane as the view lists it. */
export interface StudioInputsLane {
  readonly id: string
  readonly name: string
  readonly input: StudioLaneInput
}

export interface StudioInputsModelInput {
  /** The browser's audio inputs, with Chromium's role entries. */
  readonly devices: readonly DeviceInfoLike[]
  /** The Studio's input from the Sound panel; null for the system default. */
  readonly studioDeviceId: string | null
  readonly lanes: readonly StudioInputsLane[]
  /** Every input's channel count found on this device. */
  readonly counts: readonly InputChannelCount[]
  /** An input's measured round trip in ms by its id, null for the system default; 0 when never measured. */
  latencyMs(deviceId: string | null): number
}

/** One row of an input: the default, one input, or an aligned pair. */
export interface StudioInputRow {
  /** Null for the default. */
  readonly pick: ChannelPick | null
  readonly label: string
  /** The lanes that record this row, by name. */
  readonly lanes: readonly string[]
}

export interface StudioInputDevice {
  readonly deviceId: string
  /** What a check or the latency check opens it by: null for the system default, as a lane that follows it opens it. */
  readonly openId: string | null
  readonly name: string
  readonly kind: InputKind
  /** Its kind in a word; empty for one the roster could not tell. */
  readonly kindLabel: string
  readonly isDefault: boolean
  /** Its channels as an arm or a check last found them; null until one has. */
  readonly channels: number | null
  /** Its measured round trip in ms; null when never measured. */
  readonly latencyMs: number | null
  /** What to know before recording from it; null when nothing. */
  readonly warning: string | null
  /** Every lane that records from it, by name. */
  readonly lanes: readonly string[]
  readonly rows: readonly StudioInputRow[]
}

export interface StudioInputsModel {
  /** The browser names its inputs: the page may use the microphone. */
  readonly named: boolean
  readonly devices: readonly StudioInputDevice[]
}

/** What to know about the kinds that change a recording on their own. */
export const STUDIO_INPUT_WARNINGS: Readonly<
  Partial<Record<InputKind, string>>
> = {
  bluetooth:
    'Bluetooth adds delay, and drops to call quality while its microphone is open. A wired input records better.',
  loopback: 'Records what this computer plays, not a microphone.',
  virtual:
    'An app makes this input, and it passes on only what that app sends, which is often nothing.',
}

/** The level states a meter names: the ones a musician acts on. */
export const STUDIO_METER_WORDS: Readonly<
  Partial<Record<GuitarInputHealth, string>>
> = {
  clipping: 'Clipping',
  hot: 'Hot',
  quiet: 'Quiet',
  silent: 'Silent',
}

/** An input's round trip in words. */
export function studioLatencyWords(latencyMs: number | null): string {
  return latencyMs === null ? 'Not measured' : `${latencyMs} ms round trip`
}

/** Which input the signal is on, from each single input's peak in order; null while all are silent. */
export function studioSignalOn(peaks: readonly number[]): string | null {
  const loudest = loudestChannel(peaks)
  return loudest === null ? null : `Signal on Input ${loudest + 1}`
}

/** An input's channel count by its id, then its name; the system default's by Chromium's `default` too. */
function channelsOf(
  device: RosterInput,
  counts: readonly InputChannelCount[],
): number | null {
  const own = knownInputChannels(counts, {
    deviceId: device.deviceId,
    label: device.name,
  })
  if (own !== null || !device.isDefault) return own
  return knownInputChannels(counts, { deviceId: 'default', label: null })
}

/** The row a lane's pick lands on: its own where the input has it, else the default. */
const rowOf = (pick: ChannelPick | null, channels: number) =>
  pick !== null && isAvailablePick(pick, channels) ? pick : null

export function studioInputsModel(
  input: StudioInputsModelInput,
): StudioInputsModel {
  const roster = buildRoster(input.devices)
  if (!roster.labelled) return { named: false, devices: [] }
  const fallback =
    roster.inputs.find((device) => device.isDefault) ?? roster.inputs[0] ?? null
  // A MIDI lane records no audio input: it is listed with its port.
  const placed = input.lanes.flatMap((lane) => {
    if (isMidiLaneInput(lane.input)) return []
    const plan = planStudioLaneInput(
      lane.input,
      input.studioDeviceId,
      input.devices,
    )
    const device =
      roster.inputs.find((each) => each.deviceId === plan.deviceId) ?? fallback
    return [{ name: lane.name, device, pick: plan.pick }]
  })
  const devices = roster.inputs.map((device): StudioInputDevice => {
    const channels = channelsOf(device, input.counts)
    const here = placed.filter((lane) => lane.device === device)
    const measured =
      input.latencyMs(device.deviceId) ||
      (device.isDefault ? input.latencyMs(null) : 0)
    return {
      deviceId: device.deviceId,
      openId: device.isDefault ? null : device.deviceId,
      name: device.name,
      kind: device.kind,
      kindLabel: INPUT_KIND_LABEL[device.kind],
      isDefault: device.isDefault,
      channels,
      latencyMs: measured > 0 ? measured : null,
      warning: STUDIO_INPUT_WARNINGS[device.kind] ?? null,
      lanes: here.map((lane) => lane.name),
      rows:
        channels === null
          ? []
          : channelChoices(channels, null).map((choice) => ({
              pick: choice.pick,
              label: choice.label,
              lanes: here
                .filter((lane) =>
                  samePick(rowOf(lane.pick, channels), choice.pick),
                )
                .map((lane) => lane.name),
            })),
    }
  })
  return { named: true, devices }
}
