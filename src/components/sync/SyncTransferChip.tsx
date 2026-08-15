// ── SyncTransferChip ─────────────────────────────────────────────────
// The corner presence of a sync session whose dialog is closed.
//
// Sits where notifications land (top right) so a transfer pushed to the
// background has one obvious place to be — REQ-SYNC-030. Tapping it
// brings the dialog back; it carries no destructive controls of its
// own, because a mis-tap here must cost nothing.

import type { Component } from 'solid-js'
import { Show } from 'solid-js'
import { Portal } from 'solid-js/web'
import type { SyncTransfer } from '@/stores/sync-store'
import { syncPeerLabel, syncQueue, syncState, syncTransfers, } from '@/stores/sync-store'
import { openSyncModal } from '@/stores/sync-ui'
import { DeviceSync } from '../icons'
import styles from './SyncTransferChip.module.css'

const isLive = (t: SyncTransfer): boolean =>
  t.status === 'packing' ||
  t.status === 'preparing' ||
  t.status === 'transferring'

export const SyncTransferChip: Component = () => {
  const current = (): SyncTransfer | undefined => syncTransfers().find(isLive)

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
      const pct =
        t.status === 'preparing' ? '' : ` — ${Math.round(t.ratio * 100)}%`
      return `${verb} “${t.title}”${pct}`
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
        <Show
          when={current() !== undefined && current()!.status !== 'preparing'}
        >
          <span class={styles.bar}>
            <span
              class={styles.barFill}
              style={{ width: `${Math.round((current()?.ratio ?? 0) * 100)}%` }}
            />
          </span>
        </Show>
      </button>
    </Portal>
  )
}

export default SyncTransferChip
