// Studio playback quality control — Auto, Best, Balanced or Light for this device, in the Sound panel.
import { For } from 'solid-js'
import type { StudioPlaybackChoice } from '@/lib/studio/playback/playback-quality'
import { PLAYBACK_TIER_LABELS } from '@/lib/studio/playback/playback-quality'
import common from '../StudioPage.module.css'
import styles from './StudioSound.module.css'
import { usePlaybackQuality } from './usePlaybackQuality'

const CHOICES: readonly StudioPlaybackChoice[] = [
  'auto',
  'best',
  'balanced',
  'light',
]

const NOTES: Readonly<Record<Exclude<StudioPlaybackChoice, 'auto'>, string>> = {
  best: 'Same as export',
  balanced: 'Shared reverbs',
  light: 'For slower devices',
}

/** A device setting, not the project's: it stays usable on a read-only project. */
export function StudioPlaybackQuality() {
  const quality = usePlaybackQuality()
  const note = (choice: StudioPlaybackChoice): string => {
    if (choice !== 'auto') return NOTES[choice]
    const state = quality.state()
    return state.choice === 'auto'
      ? `Using ${PLAYBACK_TIER_LABELS[state.tier]}`
      : `Picks ${PLAYBACK_TIER_LABELS[state.autoTier]}`
  }
  return (
    <fieldset class={styles.section} data-studio-playback-quality>
      <legend>Playback quality</legend>
      <div class={styles.presets}>
        <For each={CHOICES}>
          {(choice) => (
            <label class={styles.preset}>
              <input
                type="radio"
                name="studio-playback-quality"
                value={choice}
                checked={quality.state().choice === choice}
                onChange={() => quality.choose(choice)}
              />
              <span>{PLAYBACK_TIER_LABELS[choice]}</span>
              <span class={styles.subtle}>{note(choice)}</span>
            </label>
          )}
        </For>
      </div>
      <p class={common.help}>
        Auto picks a level for this device. Export always uses Best. A change
        applies from the next Play.
      </p>
    </fieldset>
  )
}
