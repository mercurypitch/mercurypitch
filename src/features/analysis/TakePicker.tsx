// ============================================================
// Take picker — choose what to analyse
//
// Absorbs the old mobile-only UVR session gallery. The behaviour required by
// docs/specs/ears-vocal-analysis-mobile-sessions.md (REQ-VAM-001…005) lives
// here now, and applies at every viewport rather than only on phones.
// ============================================================

import type { Component } from 'solid-js'
import { For, Show } from 'solid-js'
import { TAB_KARAOKE } from '@/features/tabs/constants'
import { KARAOKE_NIGHT_PATH } from '@/lib/karaoke-night-link'
import { isNarrow } from '@/lib/use-viewport'
import { setActiveTab } from '@/stores'
import styles from './AnalysisDashboard.module.css'
import type { AnalysisTake, TakeCapability } from './takes'

const CAPABILITY_LABEL: Record<TakeCapability, string> = {
  audio: 'Full analysis',
  notes: 'Notes only',
  summary: 'Scores only',
}

const CAPABILITY_CLASS: Record<TakeCapability, string> = {
  audio: styles.badgeAudio,
  notes: styles.badgeNotes,
  summary: styles.badgeSummary,
}

const SOURCE_LABEL: Record<AnalysisTake['source'], string> = {
  live: 'Live',
  uvr: 'Song',
  practice: 'Practice',
}

function relativeDay(epochMs: number): string {
  if (!Number.isFinite(epochMs) || epochMs > Date.now()) return ''
  const days = Math.floor((Date.now() - epochMs) / 86_400_000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 30) return `${days}d ago`
  return new Date(epochMs).toLocaleDateString()
}

export interface TakePickerProps {
  takes: AnalysisTake[]
  selectedId: string | null
  onSelect: (take: AnalysisTake) => void
}

export const TakePicker: Component<TakePickerProps> = (props) => {
  // Only the synthetic live take → nothing has been recorded or practised yet.
  const hasRealTakes = () => props.takes.some((t) => t.source !== 'live')

  return (
    <section data-tour="analysis.takes">
      <h2 class={styles.pickerLabel}>What to analyse</h2>

      <div class={styles.takeRail} role="listbox" aria-label="Analysis takes">
        <For each={props.takes}>
          {(take) => (
            <button
              type="button"
              role="option"
              aria-selected={props.selectedId === take.id}
              data-testid={`take-${take.id}`}
              class={styles.takeCard}
              classList={{
                [styles.takeCardActive]: props.selectedId === take.id,
              }}
              onClick={() => props.onSelect(take)}
            >
              <span class={styles.takeTitle}>{take.title}</span>
              <span class={styles.takeMeta}>{take.subtitle}</span>
              <span class={styles.takeBadgeRow}>
                <span class={styles.badge}>{SOURCE_LABEL[take.source]}</span>
                <span
                  class={`${styles.badge} ${CAPABILITY_CLASS[take.capability]}`}
                >
                  {CAPABILITY_LABEL[take.capability]}
                </span>
              </span>
              <Show when={take.source !== 'live'}>
                <span class={styles.takeMeta}>
                  {relativeDay(take.createdAt)}
                </span>
              </Show>
            </button>
          )}
        </For>
      </div>

      <Show when={!hasRealTakes()}>
        <p class={styles.empty}>
          Nothing recorded yet. Sing into the mic above, or separate a song in{' '}
          {isNarrow() ? 'Karaoke Night' : 'Karaoke'} to analyse a full vocal.{' '}
          {/* The in-app Karaoke tab is a desk-width surface: a header of
              processing controls and a wide session table. Karaoke Night
              uploads and separates too, and is the one shaped for a phone,
              so that is where a phone is sent. */}
          <button
            type="button"
            class={styles.ghostBtn}
            onClick={() => {
              if (isNarrow()) {
                window.location.href = KARAOKE_NIGHT_PATH
                return
              }
              setActiveTab(TAB_KARAOKE)
            }}
          >
            {isNarrow() ? 'Open Karaoke Night' : 'Open Karaoke'}
          </button>
        </p>
      </Show>
    </section>
  )
}
