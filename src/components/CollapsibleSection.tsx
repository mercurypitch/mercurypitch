// ============================================================
// CollapsibleSection — a sidebar section with a clickable header
// (title + chevron) that collapses/expands its body. Open state
// persists per section so users can compact the sidebar.
// ============================================================

import type { Component, JSX } from 'solid-js'
import { Show } from 'solid-js'
import { createPersistedSignal } from '@/lib/storage'
import styles from './CollapsibleSection.module.css'
import { ChevronDown, ChevronUp } from './icons'

interface CollapsibleSectionProps {
  title: string
  /** localStorage key for the persisted open/closed state. */
  storageKey: string
  defaultOpen?: boolean
  children: JSX.Element
}

export const CollapsibleSection: Component<CollapsibleSectionProps> = (
  props,
) => {
  const [open, setOpen] = createPersistedSignal<boolean>(
    // storageKey is a stable per-section constant; safe to read at init.
    props.storageKey, // eslint-disable-line solid/reactivity
    props.defaultOpen ?? true,
  )
  return (
    <div class={styles.section}>
      <button
        type="button"
        class={styles.header}
        aria-expanded={open()}
        onClick={() => setOpen(!open())}
      >
        <span class={styles.title}>{props.title}</span>
        <Show when={open()} fallback={<ChevronDown size={16} />}>
          <ChevronUp />
        </Show>
      </button>
      <Show when={open()}>
        <div class={styles.body}>{props.children}</div>
      </Show>
    </div>
  )
}
