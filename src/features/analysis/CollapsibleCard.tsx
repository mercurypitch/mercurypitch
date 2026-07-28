// ============================================================
// CollapsibleCard — a dashboard card that can fold away
//
// The dense sections (spectrogram, timbre, trace) are open on desktop and
// closed on a phone, so the first screen stays readable without putting any
// section out of reach — every one is a tap away at every width.
//
// Matches the tour's `reveal` contract from CollapsibleSection: an
// aria-expanded toggle carrying data-collapsible="<storageKey>", so a step can
// expand a section the user folded and re-collapse it afterwards.
// ============================================================

import type { Component, JSX } from 'solid-js'
import { Show } from 'solid-js'
import { ChevronDown, ChevronUp } from '@/components/icons'
import { createPersistedSignal } from '@/lib/storage'
import { isNarrow } from '@/lib/use-viewport'
import styles from './AnalysisDashboard.module.css'

export interface CollapsibleCardProps {
  title: string
  /** Short qualifier next to the title — e.g. where the numbers came from. */
  note?: string
  /** localStorage key for the persisted open/closed state. */
  storageKey: string
  /** Value for the section's data-tour hook. */
  tour?: string
  children: JSX.Element
}

export const CollapsibleCard: Component<CollapsibleCardProps> = (props) => {
  const [open, setOpen] = createPersistedSignal<boolean>(
    // storageKey is a stable per-section constant; safe to read at init.
    props.storageKey, // eslint-disable-line solid/reactivity
    // Phones start folded, desktops start open. Once the user decides, their
    // choice persists and this default no longer applies.
    !isNarrow(),
  )

  return (
    <section class={styles.card} data-tour={props.tour}>
      <button
        type="button"
        class={styles.collapseHeader}
        aria-expanded={open()}
        data-collapsible={props.storageKey}
        onClick={() => setOpen(!open())}
      >
        <span class={styles.cardTitle} style={{ margin: 0 }}>
          {props.title}
          <Show when={props.note !== undefined}>
            <span class={styles.cardNote}>{props.note}</span>
          </Show>
        </span>
        <Show when={open()} fallback={<ChevronDown size={16} />}>
          <ChevronUp />
        </Show>
      </button>
      <Show when={open()}>
        <div class={styles.collapseBody}>{props.children}</div>
      </Show>
    </section>
  )
}
