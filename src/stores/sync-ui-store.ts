// ── Sync UI state ────────────────────────────────────────────────────
// Whether the sync dialog is showing, whether a session is alive behind
// it, and — in the words the surfaces say out loud — what that session
// is doing. Nothing else.
//
// A leaf on purpose: the app shell, the standalone Karaoke Night page,
// UvrPanel and the karaoke rail all import this statically to open the
// dialog, and none of them may pay for the WebRTC/bundle machinery at
// first paint. That machinery (sync-store) imports THIS module — never
// the other way round — and speaks through the setters below.

import { createSignal } from 'solid-js'

const [syncModalOpen, setSyncModalOpen] = createSignal(false)
/** Mirrored by sync-store: true while a session exists (any state but idle). */
const [syncSessionLive, setSyncSessionLive] = createSignal(false)

/**
 * What a live session is doing, for the surfaces that describe it in
 * words rather than merely react to it.
 *
 * Deliberately not the transfer itself. `SyncTransfer` carries a raw
 * ratio and a status the receiver reads differently from the sender, and
 * two surfaces already turned that into prose independently. This is the
 * prose's one set of inputs, so the corner chip and Karaoke Night's
 * "Other devices" card cannot drift apart — and so the card can read a
 * session without importing the module that runs one.
 */
export type SyncSummaryActivity =
  | 'packing'
  | 'preparing'
  | 'sending'
  | 'receiving'

export interface SyncSessionSummary {
  /** True once the channel to the far device is open. */
  connected: boolean
  /** The far device's self-given name, once it has said one. */
  peerLabel: string | null
  /** The one song on the wire, or null while nothing is moving. */
  transfer: {
    title: string
    activity: SyncSummaryActivity
    /**
     * Whole percent, already rounded — or null while `preparing`, which
     * has no honest number behind it (see `sync-preparing`).
     *
     * Rounded at the source because the transfer republishes on every
     * 16KB chunk: with the percentage whole, `equals` below drops the
     * thousands of ticks that would say exactly the same sentence.
     */
    pct: number | null
  } | null
  /** Songs waiting their turn behind it. */
  queued: number
}

const ACTIVITY_VERB: Record<SyncSummaryActivity, string> = {
  packing: 'Packing',
  preparing: 'Preparing',
  sending: 'Sending',
  receiving: 'Receiving',
}

function sameSummary(
  a: SyncSessionSummary | null,
  b: SyncSessionSummary | null,
): boolean {
  if (a === null || b === null) return a === b
  if (
    a.connected !== b.connected ||
    a.peerLabel !== b.peerLabel ||
    a.queued !== b.queued
  ) {
    return false
  }
  const x = a.transfer
  const y = b.transfer
  if (x === null || y === null) return x === y
  return x.title === y.title && x.activity === y.activity && x.pct === y.pct
}

/**
 * Mirrored by sync-store: the live session, or null when there is none.
 *
 * The custom `equals` is what makes this cheap enough for a signal every
 * chunk touches — a fresh object per 16KB that reads the same as the
 * last one never reaches a consumer.
 */
const [syncSummary, setSyncSummary] = createSignal<SyncSessionSummary | null>(
  null,
  { equals: sameSummary },
)

/** The one sentence a live session gets, wherever it is shown. */
export function syncSummaryLabel(summary: SyncSessionSummary): string {
  const queue = summary.queued > 0 ? ` · ${summary.queued} more queued` : ''
  const t = summary.transfer
  if (t !== null) {
    const pct = t.pct === null ? '' : ` — ${t.pct}%`
    return `${ACTIVITY_VERB[t.activity]} “${t.title}”${pct}${queue}`
  }
  if (summary.connected) {
    return `Sync ready: ${summary.peerLabel ?? 'another device'}${queue}`
  }
  return `Sync open — waiting for the other device${queue}`
}

/** A song id handed to openSyncModal, waiting for the modal to mount. */
let pendingSessionId: string | null = null

/**
 * What sync-store wants to hear about the dialog: hidden (decide whether
 * the session behind it lives on) and shown (stop any idle countdown).
 * Registered when sync-store loads; until then there is no session, so
 * there is nothing to decide.
 */
interface SyncUiLifecycle {
  onForeground(): void
  onBackground(): void
}
let lifecycle: SyncUiLifecycle | null = null

export function registerSyncUiLifecycle(hooks: SyncUiLifecycle): void {
  lifecycle = hooks
}

/** Show the sync dialog, optionally straight onto sending one song. */
export function openSyncModal(sessionId?: string): void {
  pendingSessionId = sessionId ?? null
  setSyncModalOpen(true)
  lifecycle?.onForeground()
}

/**
 * Hide the sync dialog. What happens to the session behind it is
 * sync-store's call (registerSyncUiLifecycle): a connected pair stays
 * ready behind the corner chip, a half-opened one is torn down.
 */
export function closeSyncModal(): void {
  setSyncModalOpen(false)
  lifecycle?.onBackground()
}

/** One-shot: the song openSyncModal was asked to send, then nothing. */
export function takeSyncModalSessionId(): string | null {
  const id = pendingSessionId
  pendingSessionId = null
  return id
}

export {
  setSyncSessionLive,
  setSyncSummary,
  syncModalOpen,
  syncSessionLive,
  syncSummary,
}
