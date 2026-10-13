// ============================================================
// SessionMiniTimeline — read-only, compact variant of
// SessionEditorTimeline. Used inside SessionLibraryModal so each
// session card can preview its melodies + rests without exposing
// any editing affordances (no drag, no delete, no add-rest zones).
//
// Visual contract:
//   - One pill per session item, in order.
//   - Melody items show: music-note icon + melody name (or fallback label).
//   - Rest items show: pause icon + duration (e.g. "2s").
//   - Pills wrap on narrow screens; horizontal-scrolls on wide.
//
// Why a separate component instead of reusing SessionEditorTimeline?
// SessionEditorTimeline owns drag/drop, deletion, and store-mutating
// callbacks; threading "read-only" flags through it would make that
// component's API significantly murkier. A purpose-built read-only
// view keeps each component's responsibility narrow.
// ============================================================

import type { Component } from 'solid-js'
import { For, Show } from 'solid-js'
import { IconMusicNote, IconPause } from '@/components/hidden-features-icons'
import { formatRestDuration } from '@/lib/format-time'
import { melodyStore } from '@/stores'
import type { PlaybackSession, SessionItem } from '@/types'
import styles from './SessionMiniTimeline.module.css'

interface SessionMiniTimelineProps {
  session: PlaybackSession
  /** When true, hide the leading session header chip. */
  compact?: boolean
}

/** Resolve a display label for a single session item. */
function labelFor(item: SessionItem): string {
  if (item.type === 'rest') {
    return formatRestDuration(item.restMs)
  }
  // Prefer the explicitly-stored item label (e.g. preset name); otherwise
  // resolve via melodyStore.getMelody when a melodyId is present; finally
  // fall back to a generic "Melody" string so the pill is never blank.
  if (item.label !== undefined && item.label.length > 0) {
    return item.label
  }
  if (item.melodyId !== undefined) {
    const data = melodyStore.getMelody(item.melodyId)
    if (data) return data.name
  }
  return 'Melody'
}

export const SessionMiniTimeline: Component<SessionMiniTimelineProps> = (
  props,
) => {
  return (
    <div
      class={styles.sessionMiniTimeline}
      role="list"
      aria-label="Session items"
    >
      <Show
        when={props.session.items.length > 0}
        fallback={
          <span class={styles.sessionMiniEmpty}>No items in this session</span>
        }
      >
        <For each={props.session.items}>
          {(item, index) => {
            const isRest = item.type === 'rest'
            return (
              <div
                class={`${styles.sessionMiniPill} ${isRest ? styles.isRest : styles.isMelody}`}
                role="listitem"
                title={`${index() + 1}. ${labelFor(item)}`}
              >
                <span class={styles.sessionMiniPillIcon} aria-hidden="true">
                  {isRest ? <IconPause /> : <IconMusicNote />}
                </span>
                <span class={styles.sessionMiniPillLabel}>
                  {labelFor(item)}
                </span>
              </div>
            )
          }}
        </For>
      </Show>
    </div>
  )
}
