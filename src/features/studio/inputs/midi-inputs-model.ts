// Studio MIDI inputs model — the Inputs view's MIDI rows: each port the browser lists with the lanes played from it, then each lane's port that is not connected, with its lanes.
import type { StudioLaneInput } from '@/lib/studio/record/lane-inputs'
import { isMidiLaneInput } from '@/lib/studio/record/lane-inputs'
import type { StudioMidiPort } from '../record/midi/studio-midi-access'

export interface StudioMidiInputRow {
  readonly id: string
  readonly name: string
  readonly manufacturer: string | null
  readonly connected: boolean
  /** The lanes played from it, by name. */
  readonly lanes: readonly string[]
}

/**
 * The rows, once MIDI is allowed: each port listed, and after them each
 * port a lane keeps that is not listed, as not connected. A lane finds its
 * port by its id, then its name, as its arm does.
 */
export function studioMidiInputRows(
  ports: readonly StudioMidiPort[],
  lanes: readonly { readonly name: string; readonly input: StudioLaneInput }[],
): StudioMidiInputRow[] {
  const played = lanes.flatMap((lane) =>
    isMidiLaneInput(lane.input) ? [{ name: lane.name, input: lane.input }] : [],
  )
  const placed = new Set<string>()
  const rows: StudioMidiInputRow[] = ports.map((port) => {
    const here = played.filter(
      (lane) =>
        lane.input.portId === port.id ||
        (lane.input.label !== null && lane.input.label === port.name),
    )
    for (const lane of here) placed.add(lane.name)
    return { ...port, connected: true, lanes: here.map((lane) => lane.name) }
  })
  const gone = new Map<string, StudioMidiInputRow>()
  for (const lane of played) {
    if (placed.has(lane.name)) continue
    const row = gone.get(lane.input.portId)
    gone.set(lane.input.portId, {
      id: lane.input.portId,
      name: lane.input.label ?? 'MIDI input',
      manufacturer: null,
      connected: false,
      lanes: [...(row?.lanes ?? []), lane.name],
    })
  }
  return [...rows, ...gone.values()]
}
