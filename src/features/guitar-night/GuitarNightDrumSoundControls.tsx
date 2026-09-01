// ============================================================
// Guitar Night drum sound controls — compact next-play kit and feel picker
// ============================================================
//
// The controls persist lightweight identities only. Choosing a sampled kit is
// audio-inert; the room imports its player and requests bytes from Play.

import { createSignal, For } from 'solid-js'
import { GUITAR_NIGHT_DRUM_FEEL_OPTIONS, GUITAR_NIGHT_DRUM_KIT_OPTIONS, readGuitarNightDrumSound, writeGuitarNightDrumSound, } from './guitar-night-drum-sound'
import styles from './GuitarNightApp.module.css'

interface GuitarNightDrumSoundControlsProps {
  disabled?: boolean
}

export function GuitarNightDrumSoundControls(
  props: GuitarNightDrumSoundControlsProps,
) {
  const initial = readGuitarNightDrumSound()
  const [kitId, setKitId] = createSignal(initial.kitId)
  const [feelId, setFeelId] = createSignal(initial.feelId)

  const persist = (
    nextKitId: typeof initial.kitId,
    nextFeelId: typeof initial.feelId,
  ): void => {
    setKitId(nextKitId)
    setFeelId(nextFeelId)
    writeGuitarNightDrumSound({ kitId: nextKitId, feelId: nextFeelId })
  }

  return (
    <fieldset
      class={styles.drumSoundControls}
      data-testid="guitar-night-drum-sound-controls"
      disabled={props.disabled}
    >
      <legend>Drum sound</legend>
      <label>
        <span>Kit</span>
        <select
          aria-label="Guitar Night drum kit"
          value={kitId()}
          onChange={(event) => {
            const nextKitId = event.currentTarget.value as typeof initial.kitId
            persist(nextKitId, feelId())
          }}
        >
          <For each={GUITAR_NIGHT_DRUM_KIT_OPTIONS}>
            {(option) => <option value={option.id}>{option.label}</option>}
          </For>
        </select>
      </label>
      <label>
        <span>Feel</span>
        <select
          aria-label="Guitar Night generated drum feel"
          value={feelId()}
          onChange={(event) => {
            const nextFeelId = event.currentTarget
              .value as typeof initial.feelId
            persist(kitId(), nextFeelId)
          }}
        >
          <For each={GUITAR_NIGHT_DRUM_FEEL_OPTIONS}>
            {(option) => <option value={option.id}>{option.label}</option>}
          </For>
        </select>
      </label>
      <small>Applies on next Play. Sampled kits load only then.</small>
    </fieldset>
  )
}
