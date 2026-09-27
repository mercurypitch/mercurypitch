// ============================================================
// The Storage screen's small parts: a category's dot, and its Clear
// ============================================================
//
// Shared by StorageScreen and the imported songs' row
// (StorageImportedSongs.tsx), which a store build does not carry.

import type { JSX } from 'solid-js'

/** The categories, in the order the screen lists them. Each has its colour
 *  class, on its row's dot and on its part of the bar. `songs` is the
 *  singer's own Karaoke songs, in a build that imports them. */
export type StorageCategory = 'takes' | 'prints' | 'models' | 'songs' | 'rooms'

export function Dot(props: { category: StorageCategory }): JSX.Element {
  return <span class={`mp-storage__dot is-${props.category}`} />
}

export function ClearButton(props: {
  label: string
  disabled: boolean
  onPress?: () => void
  /** The word on the button: Clear, or Remove for songs (mock 9c). */
  text?: string
}): JSX.Element {
  return (
    <button
      type="button"
      class="mp-set-button mp-set-button--secondary mp-set-button--small"
      aria-label={props.label}
      disabled={props.disabled}
      onClick={() => props.onPress?.()}
    >
      {props.text ?? 'Clear'}
    </button>
  )
}
