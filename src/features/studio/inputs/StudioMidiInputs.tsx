// Studio MIDI inputs — the Inputs view's MIDI section, beside its audio inputs: MIDI asked for from a press, then each keyboard or pad with a light while it plays and the lanes played from it.
import { For, Show } from 'solid-js'
import type { StudioProject } from '@/lib/studio/model/types'
import type { StudioLaneInput } from '@/lib/studio/record/lane-inputs'
import type { StudioMidiAccess } from '../record/midi/studio-midi-access'
import { createStudioMidiActivity } from '../record/midi/studio-midi-activity'
import { StudioMidiAccessLine } from '../record/midi/StudioMidiAccessLine'
import common from '../StudioPage.module.css'
import { studioMidiInputRows } from './midi-inputs-model'
import styles from './StudioInputs.module.css'

export function StudioMidiInputs(props: {
  access: StudioMidiAccess
  project: StudioProject
  laneInput(trackId: string): StudioLaneInput
}) {
  // The view's own: its lights listen while it is open.
  // eslint-disable-next-line solid/reactivity
  const activity = createStudioMidiActivity(props.access)
  const rows = () =>
    studioMidiInputRows(
      props.access.ports(),
      props.project.tracks.map((track) => ({
        name: track.name,
        input: props.laneInput(track.id),
      })),
    )
  return (
    <section class={styles.section} aria-labelledby="studio-inputs-midi">
      <h3 id="studio-inputs-midi">MIDI inputs</h3>
      <p class={common.help}>
        A keyboard or pads play a lane's sound: the drum kit on a drum lane, the
        piano on any other.
      </p>
      <StudioMidiAccessLine
        access={props.access}
        ask="Allow MIDI to see your keyboards and pads"
      />
      <Show when={props.access.state() === 'granted' && rows().length > 0}>
        <ul class={styles.midiPorts}>
          <For each={rows()}>
            {(row) => (
              <li class={styles.midiPort} data-studio-midi-port={row.id}>
                <span
                  class={styles.midiLight}
                  data-active={activity.lit(row.id) ? '' : undefined}
                  aria-hidden="true"
                />
                <span class={styles.midiName}>
                  {row.name}
                  <Show when={!row.connected}>
                    <span class={styles.state}> (not connected)</span>
                  </Show>
                </span>
                <span class={styles.midiLanes}>
                  {row.lanes.length > 0 ? row.lanes.join(', ') : 'No lane'}
                </span>
              </li>
            )}
          </For>
        </ul>
      </Show>
    </section>
  )
}
