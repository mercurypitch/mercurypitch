// PlayAlongSelect — one consistent role picker for UVR and mixer surfaces.

import type { Component } from 'solid-js'
import { createMemo, createResource, For } from 'solid-js'
import { listStemTypes } from '@/db/services/uvr-service'
import type { PlayAlongPreset, PlayAlongStemKey, } from '@/features/stem-mixer/play-along'
import { isPlayAlongStemKey, playAlongPresets, } from '@/features/stem-mixer/play-along'
import styles from './PlayAlongSelect.module.css'

interface PlayAlongSelectProps {
  sessionId?: string
  /** Stems already known by the host, so the core choices render immediately. */
  availableStems: readonly PlayAlongStemKey[]
  /** Discover locally stored full-band parts for library rows. */
  discoverStoredStems?: boolean
  /** Hold the picker while a host-owned stem discovery is still in flight. */
  loading?: boolean
  onSelect: (preset: PlayAlongPreset) => void
  ariaLabel?: string
  compact?: boolean
  disabled?: boolean
  class?: string
}

export const PlayAlongSelect: Component<PlayAlongSelectProps> = (props) => {
  const [storedStems] = createResource(
    () =>
      props.discoverStoredStems === true && props.sessionId !== undefined
        ? props.sessionId
        : undefined,
    listStemTypes,
    // A resource without an initial value suspends its nearest host while the
    // IndexedDB lookup is pending. In the Songs drawer that replaced the
    // entire active mixer with a route-level loading screen even though the
    // playing audio never changed. Keep the picker in its own explicit
    // "Finding roles" state instead.
    { initialValue: [] },
  )
  const presets = createMemo(() => {
    const stems = new Set<PlayAlongStemKey>(props.availableStems)
    // `latest` remains reactive but deliberately does not register with a
    // parent Suspense boundary while a refetch is pending.
    for (const key of storedStems.latest) {
      if (isPlayAlongStemKey(key)) stems.add(key)
    }
    return playAlongPresets([...stems])
  })
  const isLoading = () =>
    props.loading === true ||
    (props.discoverStoredStems === true && storedStems.loading)

  const handleChange = (event: Event): void => {
    const select = event.currentTarget as HTMLSelectElement
    const preset = presets().find((candidate) => candidate.id === select.value)
    select.value = ''
    if (preset !== undefined) props.onSelect(preset)
  }

  return (
    <span
      class={`${styles.root} ${props.compact === true ? styles.compact : ''} ${props.class ?? ''}`}
      title="Choose what you perform; MercuryPitch mutes that part"
      aria-busy={isLoading()}
    >
      <select
        class={styles.select}
        value=""
        aria-label={props.ariaLabel ?? 'Choose a play-along role'}
        disabled={
          props.disabled === true || isLoading() || presets().length === 0
        }
        onChange={handleChange}
      >
        <option value="" disabled>
          {isLoading() ? 'Finding roles…' : 'Play along…'}
        </option>
        <For each={isLoading() ? [] : presets()}>
          {(preset) => (
            <option value={preset.id} title={preset.description}>
              {preset.label}
            </option>
          )}
        </For>
      </select>
    </span>
  )
}
