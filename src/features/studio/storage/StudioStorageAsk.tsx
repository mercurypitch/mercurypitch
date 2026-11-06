// ============================================================
// Studio storage ask — the first import on a device asks how its audio is kept: Full quality, preselected, or Save space
// ============================================================
//
// The app's confirm dialog with the choice inside it: the trap, Escape, the
// backdrop and the keys kept from the app behind are its own. Each opening
// starts from Full quality and an empty tick, so a hurried Add audio keeps
// today's quality and asks again next visit.
import { createEffect, createSignal, createUniqueId, For } from 'solid-js'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { Plus } from '@/components/icons'
import { MercuryCheckbox } from '@/components/MercuryCheckbox'
import type { StudioStorageQuality } from '@/lib/studio/audio/storage-quality'
import { STUDIO_STORAGE_CHOICES, STUDIO_STORAGE_EXPLAINED, STUDIO_STORAGE_EXPORTS, STUDIO_STORAGE_QUESTION, } from './storage-copy'
import type { StudioStorageAskState } from './studio-storage-ask'
import styles from './StudioStorage.module.css'

export function StudioStorageAsk(props: { ask: StudioStorageAskState }) {
  const [quality, setQuality] = createSignal<StudioStorageQuality>('full')
  const [remember, setRemember] = createSignal(false)
  const name = createUniqueId()
  createEffect(() => {
    if (!props.ask.open()) return
    setQuality('full')
    setRemember(false)
  })
  return (
    <ConfirmDialog
      open={props.ask.open()}
      title={STUDIO_STORAGE_QUESTION}
      message={STUDIO_STORAGE_EXPLAINED}
      tone="primary"
      confirmLabel="Add audio"
      confirmIcon={<Plus size={16} />}
      onCancel={() => props.ask.cancel()}
      onConfirm={() =>
        props.ask.answer({ quality: quality(), remember: remember() })
      }
    >
      <fieldset class={styles.choices} data-studio-storage-ask="">
        <legend class={styles.legend}>Keep new audio at</legend>
        <For each={STUDIO_STORAGE_CHOICES}>
          {(choice) => (
            <label class={styles.choice}>
              <input
                type="radio"
                name={name}
                value={choice.quality}
                checked={quality() === choice.quality}
                onChange={() => setQuality(choice.quality)}
              />
              <span class={styles.choiceText}>
                <strong>{choice.label}</strong>
                <span>{choice.note}</span>
              </span>
            </label>
          )}
        </For>
      </fieldset>
      <p class={styles.note}>{STUDIO_STORAGE_EXPORTS}</p>
      <MercuryCheckbox
        checked={remember()}
        onChange={setRemember}
        align="start"
      >
        Remember my choice
      </MercuryCheckbox>
      <p class={styles.note}>You can change it later in Song options.</p>
    </ConfirmDialog>
  )
}
