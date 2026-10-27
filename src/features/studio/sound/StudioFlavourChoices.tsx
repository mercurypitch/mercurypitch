// Studio flavour choices — the song's flavours as pressed buttons, shared by the Sound panel and the mixing desk.
import { For } from 'solid-js'
import type { StudioSoundEdit } from '@/lib/studio/model/sound-commands'
import type { StudioProject } from '@/lib/studio/model/types'
import { MACRO_KEYS, MIX_FLAVOURS } from '@/lib/studio-fx/mix-macros'
import styles from './StudioSound.module.css'

interface StudioFlavourChoicesProps {
  project: StudioProject
  enabled: boolean
  onCommand(command: StudioSoundEdit): boolean
}

/** True once a macro has moved away from the chosen flavour's own setting. */
export function studioSoundAdjusted(project: StudioProject): boolean {
  const flavour = MIX_FLAVOURS.find((item) => item.id === project.mix.flavourId)
  return MACRO_KEYS.some(
    (key) => project.mix.macros[key] !== flavour?.macros[key],
  )
}

export function StudioFlavourChoices(props: StudioFlavourChoicesProps) {
  return (
    <For each={MIX_FLAVOURS}>
      {(flavour) => (
        <button
          type="button"
          class={styles.choice}
          aria-pressed={props.project.mix.flavourId === flavour.id}
          disabled={!props.enabled}
          onClick={() =>
            props.onCommand({
              type: 'set-sound-flavour',
              flavourId: flavour.id,
            })
          }
        >
          {flavour.label}
        </button>
      )}
    </For>
  )
}
