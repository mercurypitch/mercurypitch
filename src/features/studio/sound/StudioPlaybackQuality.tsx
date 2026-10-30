// Studio playback quality control — Auto, Best, Balanced or Light for this device, in the Sound panel.
import { createMemo, For } from 'solid-js'
import type { StudioPlaybackChoice } from '@/lib/studio/playback/playback-quality'
import { PLAYBACK_TIER_LABELS } from '@/lib/studio/playback/playback-quality'
import type { StudioSongShape } from '@/lib/studio/playback/song-load'
import common from '../StudioPage.module.css'
import styles from './StudioSound.module.css'
import { usePlaybackQuality } from './usePlaybackQuality'

const CHOICES: readonly StudioPlaybackChoice[] = [
  'auto',
  'best',
  'balanced',
  'light',
]

const NOTES: Readonly<Record<StudioPlaybackChoice, string>> = {
  auto: 'Sized to this song',
  best: 'Same as export',
  balanced: 'Shared reverbs',
  light: 'For slower devices',
}

/** A device setting, not the project's: it stays usable on a read-only project. */
export function StudioPlaybackQuality(props: { song: StudioSongShape }) {
  const quality = usePlaybackQuality()
  // What Auto plays this song at, as the song changes: lanes muted, added or given another sound.
  const auto = createMemo(() => quality.autoTier(props.song))
  const label = (choice: StudioPlaybackChoice): string =>
    choice === 'auto'
      ? `Auto (${PLAYBACK_TIER_LABELS[auto()]})`
      : PLAYBACK_TIER_LABELS[choice]
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
              <span>{label(choice)}</span>
              <span class={styles.subtle}>{NOTES[choice]}</span>
            </label>
          )}
        </For>
      </div>
      <p class={common.help}>
        Auto picks a level for this song on this device. Export always uses
        Best. A change applies from the next Play.
      </p>
    </fieldset>
  )
}
