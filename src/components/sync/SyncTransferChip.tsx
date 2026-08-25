// ── SyncTransferChip ─────────────────────────────────────────────────
// The corner presence of a sync session whose dialog is closed.
//
// Sits where notifications land (top right) so a transfer pushed to the
// background has one obvious place to be — REQ-SYNC-030. Tapping it
// brings the dialog back; it carries no destructive controls of its
// own, because a mis-tap here must cost nothing.

import type { Component } from 'solid-js'
import { createMemo, Show } from 'solid-js'
import { Portal } from 'solid-js/web'
import type { SyncTransfer } from '@/stores/sync-store'
import { isLiveTransfer, syncPeerLabel, syncQueue, syncState, syncTransfers, } from '@/stores/sync-store'
import { openSyncModal } from '@/stores/sync-ui-store'
import { DeviceSync } from '../icons'
import styles from './SyncTransferChip.module.css'

export const SyncTransferChip: Component = () => {
  // Memos, not plain calls: `syncTransfers` is republished on every 16KB
  // chunk, and the chip is always on screen while one is moving. The
  // percentage only changes a hundred times a transfer, so gating the
  // DOM write on the rounded value is the difference between ~100
  // updates and several thousand.
  const current = createMemo<SyncTransfer | undefined>(() =>
    syncTransfers().find(isLiveTransfer),
  )
  const pct = createMemo(() => Math.round((current()?.ratio ?? 0) * 100))

  const label = (): string => {
    const t = current()
    if (t !== undefined) {
      const verb =
        t.status === 'packing'
          ? 'Packing'
          : t.status === 'preparing'
            ? 'Preparing'
            : t.direction === 'out'
              ? 'Sending'
              : 'Receiving'
      // `preparing` has no honest number behind it — see `sync-preparing`.
      const suffix = t.status === 'preparing' ? '' : ` — ${pct()}%`
      return `${verb} “${t.title}”${suffix}`
    }
    if (syncState() === 'connected') {
      return `Sync ready: ${syncPeerLabel() ?? 'another device'}`
    }
    return 'Sync open — waiting for the other device'
  }

  return (
    <Portal>
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
          <span class={styles.text}>
            {label()}
            <Show when={syncQueue().length > 0}>
              {' '}
              · {syncQueue().length} more queued
            </Show>
          </span>
        </span>
        <Show when={current()} keyed>
          {(t) => (
            <Show when={t.status !== 'preparing'}>
              <span class={styles.bar}>
                <span class={styles.barFill} style={{ width: `${pct()}%` }} />
              </span>
            </Show>
          )}
        </Show>
      </button>
    </Portal>
  )
}
