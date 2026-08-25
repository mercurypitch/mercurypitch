// ── SyncTransferChip ─────────────────────────────────────────────────
// The corner presence of a sync session whose dialog is closed.
//
// Sits where notifications land (top right) so a transfer pushed to the
// background has one obvious place to be — REQ-SYNC-030. Tapping it
// brings the dialog back; it carries no destructive controls of its
// own, because a mis-tap here must cost nothing.
//
// Reads the summary sync-store mirrors into sync-ui rather than the
// session itself: the wording is shared with Karaoke Night's "Other
// devices" card (REQ-SYNC-036), the percentage is rounded at the source
// so a 16KB chunk that changes nothing on screen changes nothing here,
// and the chip stays a leaf that a standalone page can show without
// loading the WebRTC machinery behind it.

import type { Component } from 'solid-js'
import { Show } from 'solid-js'
import { Portal } from 'solid-js/web'
import { openSyncModal, syncSummary, syncSummaryLabel, } from '@/stores/sync-ui-store'
import { DeviceSync } from '../icons'
import styles from './SyncTransferChip.module.css'

export const SyncTransferChip: Component = () => {
  // Null both when nothing is moving and while `preparing` — which has
  // no honest number — so the bar is absent rather than empty. Read as
  // "is there a number", never as truthiness: 0% is a number.
  const pct = (): number | null => syncSummary()?.transfer?.pct ?? null

  return (
    <Portal>
      <Show when={syncSummary()}>
        {(summary) => (
          <button
            type="button"
            class={styles.chip}
            onClick={() => openSyncModal()}
            title="Open the sync dialog"
            data-testid="sync-chip"
          >
            <span class={styles.row}>
              <span class={styles.icon}>
                <DeviceSync />
              </span>
              <span class={styles.text}>{syncSummaryLabel(summary())}</span>
            </span>
            <Show when={pct() !== null}>
              <span class={styles.bar}>
                <span
                  class={styles.barFill}
                  style={{ width: `${pct() ?? 0}%` }}
                />
              </span>
            </Show>
          </button>
        )}
      </Show>
    </Portal>
  )
}
