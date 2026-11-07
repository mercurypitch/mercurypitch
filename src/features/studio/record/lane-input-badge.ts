// Studio lane input badge — what a lane header's chip says for a lane with an input or a channel of its own, and the whole of it for its title and a screen reader.
import type { StudioLaneInput } from '@/lib/studio/record/lane-inputs'

export interface StudioLaneInputBadge {
  /** On the chip: the channel ("In 2"), else the input's first word. */
  readonly short: string
  /** The input and the channel in full, to follow "records from". */
  readonly full: string
}

/**
 * An input's short name: its first word, and the device inside Windows'
 * "Microphone (Realtek(R) Audio)", where the first word is the same for
 * every microphone.
 */
export function studioInputShortName(label: string): string {
  const trimmed = label.trim()
  const named =
    /^(?:microphone|line in|line)\s*\((.+)\)$/i.exec(trimmed)?.[1] ?? trimmed
  const word = named.split(/\s+/)[0]?.replace(/\(.*$/, '') ?? ''
  return word !== '' ? word : trimmed
}

/**
 * The chip for a lane's input, or null for a lane that follows the Studio's
 * input and records all of it: its header looks as every lane's did.
 */
export function studioLaneInputBadge(
  lane: StudioLaneInput,
  studioInputName: string,
): StudioLaneInputBadge | null {
  if (lane.deviceId === null && lane.channel === null) return null
  const device =
    lane.deviceId === null
      ? `the Studio's input (${studioInputName})`
      : (lane.label ?? 'its own input')
  if (lane.channel === null)
    return { short: studioInputShortName(device), full: device }
  return {
    short: `In ${lane.channel + 1}`,
    full: `${device}, Input ${lane.channel + 1}`,
  }
}
