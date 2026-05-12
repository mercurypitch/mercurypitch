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
import { melodyStore } from '@/stores'
import type { PlaybackSession, SessionItem } from '@/types'

interface SessionMiniTimelineProps {
  session: PlaybackSession
  /** When true, hide the leading session header chip. */
  compact?: boolean
}

/** Format a rest duration in milliseconds as a short, human-readable string. */
function formatRestDuration(restMs: number | undefined): string {
  const ms = restMs ?? 2000
  if (ms < 1000) return `${Math.round(ms / 100) / 10}s`
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`
  const m = Math.floor(ms / 60_000)
  const s = Math.round((ms % 60_000) / 1000)
  return s > 0 ? `${m}m ${s}s` : `${m}m`
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
    <div class="session-mini-timeline" role="list" aria-label="Session items">
      <Show
        when={props.session.items.length > 0}
        fallback={
          <span class="session-mini-empty">No items in this session</span>
        }
      >
        <For each={props.session.items}>
          {(item, index) => {
            const isRest = item.type === 'rest'
            return (
              <div
                class={`session-mini-pill ${isRest ? 'is-rest' : 'is-melody'}`}
                role="listitem"
                title={`${index() + 1}. ${labelFor(item)}`}
              >
                <span class="session-mini-pill-icon" aria-hidden="true">
                  {isRest ? <IconPause /> : <IconMusicNote />}
                </span>
                <span class="session-mini-pill-label">{labelFor(item)}</span>
              </div>
            )
          }}
        </For>
      </Show>
    </div>
  )
}
