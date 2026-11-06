// Studio storage choices — Full quality or Save space as two radios, the same in the first-import question and in Song options.
import { createUniqueId, For } from 'solid-js'
import type { StudioStorageQuality } from '@/lib/studio/audio/storage-quality'
import { STUDIO_STORAGE_CHOICES } from './storage-copy'
import styles from './StudioStorage.module.css'

export function StudioStorageChoices(props: {
  legend: string
  quality: StudioStorageQuality
  onChoose: (quality: StudioStorageQuality) => void
}) {
  const name = createUniqueId()
  return (
    <fieldset class={styles.choices}>
      <legend class={styles.legend}>{props.legend}</legend>
      <For each={STUDIO_STORAGE_CHOICES}>
        {(choice) => (
          <label class={styles.choice}>
            <input
              type="radio"
              name={name}
              value={choice.quality}
              checked={props.quality === choice.quality}
              onChange={() => props.onChoose(choice.quality)}
            />
            <span class={styles.choiceText}>
              <strong>{choice.label}</strong>
              <span>{choice.note}</span>
            </span>
          </label>
        )}
      </For>
    </fieldset>
  )
}
