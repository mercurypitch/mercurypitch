// Studio MIDI access line — what a picker says of MIDI, and the press that asks for it: the lane picker's and the Inputs view's.
import { Show } from 'solid-js'
import styles from '../../StudioPage.module.css'
import type { StudioMidiAccess } from './studio-midi-access'
import { studioMidiAccessWords, studioMidiAskable } from './studio-midi-choices'

export function StudioMidiAccessLine(props: {
  access: StudioMidiAccess
  /** The press's words. */
  ask: string
  disabled?: boolean
}) {
  const words = () =>
    studioMidiAccessWords(props.access.state(), props.access.ports().length)
  return (
    <>
      <Show when={words()}>
        {(said) => (
          <p class={styles.help} role="status">
            {said()}
          </p>
        )}
      </Show>
      <Show when={studioMidiAskable(props.access.state())}>
        <button
          type="button"
          class={styles.textButton}
          data-studio-midi-ask=""
          disabled={props.disabled === true}
          onClick={() => void props.access.request()}
        >
          {props.ask}
        </button>
      </Show>
    </>
  )
}
