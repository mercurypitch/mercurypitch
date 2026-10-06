// ============================================================
// MuseumJourneySoundControls — museum sound preferences without audio ownership.
// ============================================================

import { Show } from 'solid-js'
import type { MuseumAudioPreferences } from '../host'
import styles from './MuseumJourney.module.css'

interface MuseumJourneySoundControlsProps {
  preferences: MuseumAudioPreferences | undefined
  onChange(patch: Partial<MuseumAudioPreferences>): void
}

export function MuseumJourneySoundControls(
  props: MuseumJourneySoundControlsProps,
) {
  return (
    <Show when={props.preferences}>
      {(preferences) => (
        <div class={styles.soundControls}>
          <label class={styles.soundToggle}>
            <input
              type="checkbox"
              checked={preferences().muted}
              onChange={(event) =>
                props.onChange({ muted: event.currentTarget.checked })
              }
            />
            Mute museum sound
          </label>
          <label>
            <span>
              Music{' '}
              <output>{Math.round(preferences().musicVolume * 100)}%</output>
            </span>
            <input
              type="range"
              min="0"
              max="100"
              step="1"
              aria-label="Museum music volume"
              value={Math.round(preferences().musicVolume * 100)}
              onInput={(event) =>
                props.onChange({
                  musicVolume: Number(event.currentTarget.value) / 100,
                })
              }
            />
          </label>
          <label>
            <span>
              Ambience{' '}
              <output>{Math.round(preferences().ambienceVolume * 100)}%</output>
            </span>
            <input
              type="range"
              min="0"
              max="100"
              step="1"
              aria-label="Museum ambience volume"
              value={Math.round(preferences().ambienceVolume * 100)}
              onInput={(event) =>
                props.onChange({
                  ambienceVolume: Number(event.currentTarget.value) / 100,
                })
              }
            />
          </label>
        </div>
      )}
    </Show>
  )
}
