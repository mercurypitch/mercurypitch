// Studio MIDI choices — a lane picker's MIDI rows, after its audio inputs: each port the browser lists, and the lane's own when it lists it no more; and what to say of MIDI's state beside the picker.
import type { StudioLaneMidiInput } from '@/lib/studio/record/lane-inputs'
import type { StudioMidiPort, StudioMidiState } from './studio-midi-access'

export interface StudioMidiChoice {
  /** The option's value: `midi:` and the port's id, apart from every audio input's. */
  readonly value: string
  readonly portId: string
  /** The port's name, kept as the second key to find it by. */
  readonly name: string | null
  readonly label: string
}

const valueOf = (portId: string) => `midi:${portId}`

/**
 * The MIDI rows: each port listed now, by name, then the lane's own port
 * when it is not among them: "(not connected)" once MIDI is allowed and the
 * browser lists it no more, and plain before MIDI was asked for this visit.
 */
export function studioMidiChoices(
  ports: readonly StudioMidiPort[],
  kept: StudioLaneMidiInput | null,
  listed: boolean,
): StudioMidiChoice[] {
  const rows = ports.map((port) => ({
    value: valueOf(port.id),
    portId: port.id,
    name: port.name,
    label: port.name,
  }))
  if (kept === null) return rows
  const found = rows.find(
    (row) =>
      row.portId === kept.portId ||
      (kept.label !== null && row.name === kept.label),
  )
  if (found !== undefined) return rows
  const name = kept.label ?? 'MIDI input'
  return [
    ...rows,
    {
      value: valueOf(kept.portId),
      portId: kept.portId,
      name: kept.label,
      label: listed ? `${name} (not connected)` : name,
    },
  ]
}

/** Which row is the lane's: its port by id, else by name. */
export function chosenMidiChoice(
  rows: readonly StudioMidiChoice[],
  kept: StudioLaneMidiInput | null,
): StudioMidiChoice | null {
  if (kept === null) return null
  return (
    rows.find((row) => row.portId === kept.portId) ??
    rows.find((row) => kept.label !== null && row.name === kept.label) ??
    null
  )
}

const ACCESS_WORDS: Partial<Record<StudioMidiState, string>> = {
  requesting: 'Asking for MIDI…',
  denied:
    "Studio may not use MIDI. Allow it in the browser's site settings, then try again.",
  failed: "Studio couldn't open MIDI. Try again.",
  unsupported:
    "This browser can't use MIDI keyboards or pads. Chrome, Edge and Firefox on a computer can.",
}

/** What to say of MIDI beside a picker; null when the ports say it all. */
export function studioMidiAccessWords(
  state: StudioMidiState,
  ports: number,
): string | null {
  if (state === 'granted')
    return ports === 0 ? 'No MIDI keyboard or pad is connected.' : null
  return ACCESS_WORDS[state] ?? null
}

/** MIDI can be asked for from a press: not yet, or again after a refusal. */
export function studioMidiAskable(state: StudioMidiState): boolean {
  return state === 'idle' || state === 'denied' || state === 'failed'
}
