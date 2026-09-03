// The room's notes, as a ladder.
// ============================================================
//
// A chamber's modes are whole-number multiples of one fundamental, so
// they are RUNGS -- and the rungs get closer as they climb, an octave
// from 1 to 2 and a minor third from 5 to 6. Drawn to scale in
// semitones, which is the one drawing that makes that fact obvious
// without saying it: the gaps at the top are visibly tighter.
//
// Without this the room's pitch is a secret, and a secret pitch is a
// guessing game. It is toggleable anyway, because a player who wants to
// find the note by ear should be allowed to (§5).

import { midiToNote } from '@irchiinnuss/pitch-engine'
import { For, Show } from 'solid-js'
import { modeMidi } from '../sim/chamber3d'

interface ModeLadderProps {
  modes: readonly number[]
  fundamentalMidi: number
  /** Which rung the voice is nearest, or null for silence. */
  nearest: number | null
  /** Semitones off that rung. Negative is flat. */
  semisOff: number
  /** Whether that is close enough to be exciting the mode. */
  onIt: boolean
  /** 0..1 per mode, in the same order: how far that mode's pane has
   * charged. Absent modes simply do not fill. */
  charge: readonly number[]
}

const noteName = (midi: number): string => {
  const n = midiToNote(Math.round(midi))
  return `${n.name}${n.octave}`
}

export const ModeLadder = (props: ModeLadderProps) => {
  /** Where a rung sits, 0 at the lowest mode and 1 at the highest, in
   * SEMITONES rather than in mode number -- otherwise the ladder is
   * evenly spaced and lies about the thing it exists to show. */
  const at = (mode: number): number => {
    const spans = props.modes.map((m) => modeMidi(0, m))
    const lo = Math.min(...spans)
    const hi = Math.max(...spans)
    if (hi - lo < 1e-6) return 0
    return (modeMidi(0, mode) - lo) / (hi - lo)
  }

  return (
    <div class="mode-ladder" aria-label="The room's notes">
      <For each={props.modes}>
        {(mode, i) => (
          <div
            class="mode-ladder__rung"
            classList={{
              'is-near': props.nearest === mode,
              'is-on': props.nearest === mode && props.onIt,
            }}
            style={{ bottom: `${at(mode) * 100}%` }}
          >
            <i style={{ width: `${(props.charge[i()] ?? 0) * 100}%` }} />
            <span>{noteName(modeMidi(props.fundamentalMidi, mode))}</span>
            <Show when={props.nearest === mode && !props.onIt}>
              <b>{props.semisOff < 0 ? 'flat' : 'sharp'}</b>
            </Show>
          </div>
        )}
      </For>
    </div>
  )
}
