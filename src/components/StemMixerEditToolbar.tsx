// ============================================================
// StemMixerEditToolbar — a compact floating toolbar shown while editing the
// detected vocal notes. It replaces editing through the (occluding) analysis
// panel: the panel collapses in edit mode and this bar sits at the bottom,
// leaving the pitch lane fully visible and clickable.
// ============================================================

import type { Component } from 'solid-js'
import { For, onCleanup, onMount } from 'solid-js'
import { CheckSmall, Merge, RotateCcw, Split, Trash2 } from '@/components/icons'
import styles from './StemMixerEditToolbar.module.css'

interface StemMixerEditToolbarProps {
  pitchView: 'edited' | 'original' | 'both'
  setPitchView: (v: 'edited' | 'original' | 'both') => void
  hasEdits: boolean
  hasSelection: boolean
  onDelete: () => void
  onSplit: () => void
  onMerge: () => void
  onUndo: () => void
  onReset: () => void
  onDone: () => void
}

const VIEWS = [
  ['original', 'Original'],
  ['edited', 'Edited'],
  ['both', 'Both'],
] as const

export const StemMixerEditToolbar: Component<StemMixerEditToolbarProps> = (
  props,
) => {
  // Escape exits edit mode.
  const onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') {
      e.stopPropagation()
      props.onDone()
    }
  }
  onMount(() => window.addEventListener('keydown', onKey))
  onCleanup(() => window.removeEventListener('keydown', onKey))

  return (
    <div
      class={styles.bar}
      data-testid="stem-edit-toolbar"
      role="toolbar"
      aria-label="Pitch note editing"
    >
      <div
        class={styles.segment}
        role="group"
        aria-label="Pitch comparison view"
      >
        <For each={VIEWS}>
          {([value, label]) => (
            <button
              type="button"
              classList={{ [styles.active]: props.pitchView === value }}
              aria-pressed={props.pitchView === value}
              onClick={() => props.setPitchView(value)}
            >
              {label}
            </button>
          )}
        </For>
      </div>

      <div class={styles.divider} />

      <button
        type="button"
        class={`${styles.iconBtn} ${styles.danger}`}
        title="Delete note"
        aria-label="Delete note"
        disabled={!props.hasSelection}
        onClick={() => props.onDelete()}
      >
        <Trash2 />
      </button>
      <button
        type="button"
        class={styles.iconBtn}
        title="Split note"
        aria-label="Split note"
        disabled={!props.hasSelection}
        onClick={() => props.onSplit()}
      >
        <Split />
      </button>
      <button
        type="button"
        class={styles.iconBtn}
        title="Merge with next note"
        aria-label="Merge with next note"
        disabled={!props.hasSelection}
        onClick={() => props.onMerge()}
      >
        <Merge />
      </button>

      <div class={styles.divider} />

      <button
        type="button"
        class={styles.iconBtn}
        title="Undo edit"
        aria-label="Undo edit"
        disabled={!props.hasEdits}
        onClick={() => props.onUndo()}
      >
        <RotateCcw />
      </button>
      <button
        type="button"
        class={styles.textBtn}
        title="Reset all edits (remove the manual layer)"
        disabled={!props.hasEdits}
        onClick={() => props.onReset()}
      >
        Reset
      </button>

      <div class={styles.divider} />

      <span class={styles.hint}>
        {props.hasSelection ? 'Drag to move / resize / retune' : 'Click a note'}
      </span>

      <button
        type="button"
        class={styles.done}
        title="Done editing"
        onClick={() => props.onDone()}
      >
        <CheckSmall size={15} /> Done
      </button>
    </div>
  )
}
