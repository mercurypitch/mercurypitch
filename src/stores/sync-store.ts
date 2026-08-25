// ── Sync store ───────────────────────────────────────────────────────
// One person, two devices, a room code between them.
//
// The receiving device opens a room and shows its code; the sending
// device joins with the code and pushes songs. Receiver-hosts on purpose:
// it is the same shape the TV handoff needs later (the TV — the device
// that cannot type — is the one that displays, see
// docs/plans/tv-qr-handoff.md), and it means the device gaining storage
// is the one that consented by opening the door.
//
// This store is glue: the peer (lib/sync/sync-peer), the wire protocol
// (lib/sync/sync-protocol) and the bundle service
// (db/services/portable-bundle-service) each know nothing about each
// other; the signals here are for the modal to render.
//
// See docs/plans/device-sync.md (Phase 5).

import { createEffect, createMemo, createRoot, createSignal, onCleanup, } from 'solid-js'
import { storageEstimate } from '@/db/durable-write'
import { requestPersistentStorage } from '@/db/persistent-storage'
import { buildPortableBundle, importPortableBundle, } from '@/db/services/portable-bundle-service'
import { formatBytes } from '@/lib/fetch-progress'
import { awaitDirectRoute } from '@/lib/jam/jam-song-transfer'
import { platform } from '@/lib/platform'
import type { PortableBundleManifest } from '@/lib/portable/portable-bundle'
import { isReadableManifest } from '@/lib/portable/portable-bundle'
import { normalizeRoomCode } from '@/lib/room-code'
import { syncDeviceLabel } from '@/lib/sync/device-label'
import type { SyncPeer } from '@/lib/sync/sync-peer'
import { createSyncPeer } from '@/lib/sync/sync-peer'
import type { BundleReceiver, BundleSender, SyncWireMessage, } from '@/lib/sync/sync-protocol'
import { isSyncWireMessage, receiveBundleOverWire, sendBundleOverWire, } from '@/lib/sync/sync-protocol'
import { showNotification } from '@/stores/notifications-store'
import { registerSyncUiLifecycle, setSyncSessionLive, syncModalOpen, } from '@/stores/sync-ui-store'
import type { UvrSession } from '@/stores/uvr-store'
import { getAllUvrSessions, getUvrSession, initSessionStore, } from '@/stores/uvr-store'

/**
 * Song audio must never cross a TURN relay — it is the same bandwidth
 * rule the jam room enforces, for the same reason: the relay is a shared,
 * metered resource and a library is gigabytes.
 */
const RELAY_REFUSAL =
  'These devices could only reach each other through a relay, and songs are too big to send that way. Put both on the same Wi-Fi and try again.'

/**
 * Different problem, different sentence.
 *
 * "We could not work out how you are connected" is not "you are on
 * different networks", and telling somebody to change their Wi-Fi when
 * their Wi-Fi was never the problem sends them off to check a VPN,
 * restart a router, and come back to find it working anyway.
 */
const ROUTE_UNKNOWN_REFUSAL =
  'Could not confirm a direct connection between these devices, so the song was not sent. Wait a moment and press Send again.'

export type SyncSessionState = 'idle' | 'starting' | 'waiting' | 'connected'

export interface SyncTransfer {
  /** The song's identity — the same fileHash every device agrees on. */
  fileHash: string
  title: string
  direction: 'out' | 'in'
  /**
   * `preparing` is the receiver's view of the sender's `packing`: it knows
   * a song is being made ready for it, and nothing more. There is no
   * ratio behind it on purpose — see `sync-preparing`.
   */
  status:
    | 'packing'
    | 'preparing'
    | 'transferring'
    | 'done'
    | 'already'
    | 'failed'
  /** 0-1 of the current activity. */
  ratio: number
  /** Total part bytes, once known. */
  bytes: number
  elapsedMs?: number
  mbps?: number
  message?: string
}

/**
 * Is this transfer still moving? The one place that decides, because the
 * answer drives four unrelated things — the wake lock, the idle
 * countdown, the corner chip and the dialog's closing hint. Five
 * hand-copied versions of this list meant a new status could desync any
 * one of them silently (only a rename would be compiler-caught).
 */
export function isLiveTransfer(t: SyncTransfer): boolean {
  return (
    t.status === 'packing' ||
    t.status === 'preparing' ||
    t.status === 'transferring'
  )
}

const [syncState, setSyncState] = createSignal<SyncSessionState>('idle')
const [syncRoomId, setSyncRoomId] = createSignal<string | null>(null)
const [syncError, setSyncError] = createSignal<string | null>(null)
/** The far device's self-given name, once its channel is open. */
const [syncPeerLabel, setSyncPeerLabel] = createSignal<string | null>(null)
/** What the far device says it can still hold, once it has said. */
const [syncPeerRoom, setSyncPeerRoom] = createSignal<{
  freeBytes: number
  quota: number
} | null>(null)
/**
 * The far device's library, by content hash — null until (unless) its
 * hello says. Null and empty mean different things: an older build that
 * announces nothing must not make every song look missing over there.
 */
const [syncPeerSongs, setSyncPeerSongs] =
  createSignal<ReadonlySet<string> | null>(null)
/**
 * A code that arrived by deep link, waiting for the modal to consume it.
 *
 * Set by the router when somebody scans the QR a receiving device is
 * showing. One-shot: read and cleared, so a later reload of the same URL
 * does not silently reopen a session that has been closed.
 */
const [syncCodeToJoin, setSyncCodeToJoin] = createSignal<string | null>(null)
/**
 * Which side this device chose, held while the session lives. Reopening
 * the dialog over a live session lands on the same screen it was closed
 * on, instead of a chooser that would offer to start over.
 */
const [syncRole, setSyncRole] = createSignal<'send' | 'receive' | null>(null)

/** What THIS device can still hold, for the modal to show plainly. */
const [syncOwnRoom, setSyncOwnRoom] = createSignal<{
  freeBytes: number
  quota: number
} | null>(null)
const [syncTransfers, setSyncTransfers] = createSignal<SyncTransfer[]>([])
/**
 * Songs waiting their turn, in order.
 *
 * A QUEUE of bundles rather than one archive of several songs, and that
 * is the whole design decision. The bundle format already gives partial
 * success (a link that dies at song four leaves three playable over
 * there), a per-song "I already have that one" before a byte moves, and
 * flat memory because one part is ever in flight. A zip takes all three
 * away and doubles peak disk on both sides to do it.
 *
 * See docs/plans/device-sync-followups.md (§B).
 */
const [syncQueue, setSyncQueue] = createSignal<string[]>([])
/** True while a song is packing or moving in either direction. */
const [syncBusy, setSyncBusy] = createSignal(false)

export function takeSyncCodeToJoin(): string | null {
  const code = syncCodeToJoin()
  if (code !== null) setSyncCodeToJoin(null)
  return code
}

export { setSyncCodeToJoin, syncCodeToJoin }

export {
  syncBusy,
  syncError,
  syncQueue,
  syncOwnRoom,
  syncPeerLabel,
  syncPeerRoom,
  syncPeerSongs,
  syncRole,
  syncRoomId,
  syncState,
  syncTransfers,
}

/**
 * How much of a device's allowance sync refuses to spend.
 *
 * Proportional, not the flat 50 MB `hasRoomFor` keeps: a TV measured in
 * testing allows 16 MB in TOTAL, and a fixed margin larger than the whole
 * quota turns every answer into "no" without ever explaining why. 10%
 * leaves an equivalent cushion on a device that has room to spare and
 * still lets a small device accept something.
 */
const ROOM_MARGIN_RATIO = 0.1
const ROOM_MARGIN_CAP = 50 * 1024 * 1024

/** What this device can still take, or null when the browser will not say. */
export async function ownRoom(): Promise<{
  freeBytes: number
  quota: number
} | null> {
  const estimate = await storageEstimate()
  if (estimate === null || estimate.quota <= 0) return null
  const margin = Math.min(ROOM_MARGIN_CAP, estimate.quota * ROOM_MARGIN_RATIO)
  return {
    freeBytes: Math.max(0, estimate.quota - estimate.usage - margin),
    quota: estimate.quota,
  }
}

/**
 * Whether `bytes` will fit, and what to say when it will not.
 *
 * An unknown quota is NOT a refusal: plenty of browsers will not answer,
 * and blocking every transfer on a missing number would break sync on
 * them entirely. Only a known shortage says no.
 */
export async function roomFor(
  bytes: number,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const room = await ownRoom()
  if (room === null || room.freeBytes >= bytes) return { ok: true }
  return {
    ok: false,
    message: `This device has about ${formatBytes(room.freeBytes)} free for the app (out of ${formatBytes(room.quota)}), and the song needs ${formatBytes(bytes)}.`,
  }
}

/**
 * Roughly how big this song will be once packed, before packing it.
 *
 * Only an estimate, and it is used only to refuse early -- the exact
 * figure arrives with the manifest. Duration times the portable bitrate
 * is close enough to catch the case that matters: a 100 MB song offered
 * to a device with 8 MB free, where the alternative is finding out after
 * minutes of encoding.
 */
export function estimatePackedBytes(session: UvrSession): number {
  const meta = session.stemMeta ?? {}
  // stemMeta is persisted; outputs is minted lazily on first play and is
  // undefined after a reload. Gating on outputs alone made every
  // cold-loaded row estimate 0 bytes — "Send 3 songs — 0 MB" — and
  // switched the too-big refusal off entirely.
  const stems = (['vocal', 'instrumental'] as const).filter(
    (stem) => meta[stem] !== undefined || session.outputs?.[stem] !== undefined,
  )
  if (stems.length === 0) return 0
  const seconds = Math.max(0, ...stems.map((stem) => meta[stem]?.duration ?? 0))
  // A stem already stored as AAC travels as-is, so its stored size IS the
  // answer and beats any estimate.
  const known = stems
    .map((stem) => meta[stem]?.size ?? 0)
    .filter((size) => size > 0)
  if (seconds <= 0) {
    return known.reduce((n, size) => n + size, 0)
  }
  return Math.round(stems.length * seconds * (PORTABLE_BITRATE / 8))
}

/** The default portable tier's bitrate, for the estimate above. */
const PORTABLE_BITRATE = 192_000

/**
 * Remember that the far device holds this song.
 *
 * The hello is a snapshot taken once, at connect. Without this the two
 * ways a song arrives over there mid-session are both invisible: clearing
 * finished rows drops the only other evidence, so "Select missing"
 * re-picks and re-packs everything just delivered; and a song the far
 * device sent US is in neither the snapshot nor any outgoing row, so the
 * same button offers it straight back to the device it came from.
 *
 * Null stays null: a peer that announced nothing must keep meaning
 * "unknown", never "has exactly this one".
 */
function notePeerHasSong(fileHash: string): void {
  if (fileHash === '') return
  setSyncPeerSongs((prev) => {
    if (prev === null) return null
    if (prev.has(fileHash)) return prev
    const next = new Set(prev)
    next.add(fileHash)
    return next
  })
}

/** Tell the far device who we are, our room, and our library's hashes. */
async function announceSelf(peerId: string): Promise<void> {
  const room = await ownRoom()
  setSyncOwnRoom(room)
  // Who we are and what we can hold goes FIRST, on its own. The far
  // device's pre-pack capacity check reads `freeBytes` and silently
  // passes when it is null, so a hello delayed behind a cold Dexie open
  // (minutes, on a big library) means the other phone spends that time
  // packing a song we could never hold — the exact failure that check
  // exists to prevent.
  peer?.sendControl(peerId, {
    type: 'sync-hello',
    label: syncDeviceLabel(),
    ...(room === null ? {} : { freeBytes: room.freeBytes, quota: room.quota }),
  })
  // The library must actually be loaded before its hashes are read: a
  // receiver opened straight from a QR scan can get here before any tab
  // has initialised the session store, and announcing an empty library
  // would mark nothing as already-there. Idempotent, cheap when warm.
  await initSessionStore()
  // Completed songs only — an in-flight separation has no stems to be
  // "already there". Capped so a giant library cannot bloat the hello;
  // past the cap the per-song already-here check still catches dupes.
  const songHashes = [
    ...new Set(
      getAllUvrSessions()
        .filter((s) => s.status === 'completed')
        .map((s) => s.fileHash)
        .filter((h): h is string => h !== undefined && h !== ''),
    ),
  ].slice(0, 2000)
  // Second hello, carrying only the library. Re-sending label and room is
  // harmless (the far side just re-applies them) and keeps the frame one
  // self-contained shape.
  peer?.sendControl(peerId, {
    type: 'sync-hello',
    label: syncDeviceLabel(),
    ...(room === null ? {} : { freeBytes: room.freeBytes, quota: room.quota }),
    songHashes,
  })
}

let peer: SyncPeer | null = null
let activePeerId: string | null = null
let activeSender: BundleSender | null = null
let activeReceiver: BundleReceiver | null = null
/**
 * Bumped every time the session is torn down.
 *
 * Packing a song takes tens of seconds, and the person can close the
 * modal and start a whole new session inside that window. Without a
 * generation stamp the FIRST job's cleanup then runs against the SECOND
 * session -- clearing `activeSender` and `syncBusy` out from under a
 * live transfer, which orphans it: its control frames go nowhere and it
 * hangs at 0% while the UI cheerfully offers to start another.
 */
let generation = 0
/** Flipped by a teardown so a long pack stops instead of finishing. */
let packAbort: { aborted: boolean } = { aborted: false }
/** True while tearing down, so the user's own Close is not "an error". */
let closing = false
/** A peer dropped and the session stayed — the next arrival is a comeback. */
let peerDropped = false

function upsertTransfer(
  fileHash: string,
  patch: Partial<SyncTransfer> & Pick<SyncTransfer, never>,
): void {
  setSyncTransfers((list) => {
    const at = list.findIndex((t) => t.fileHash === fileHash)
    if (at === -1) return list
    const next = [...list]
    next[at] = { ...next[at]!, ...patch }
    return next
  })
}

/**
 * End every "the other device is packing this" row with a reason.
 *
 * These rows are the one kind with nothing behind them — no sender, no
 * receiver, no promise to reject — so whatever kills the conversation has
 * to close them by hand or they wait for ever.
 */
function failPreparingRows(message: string): void {
  setSyncTransfers((list) =>
    list.map((t) =>
      t.status === 'preparing'
        ? { ...t, status: 'failed' as const, message }
        : t,
    ),
  )
}

function addTransfer(entry: SyncTransfer): void {
  setSyncTransfers((list) => [
    ...list.filter((t) => t.fileHash !== entry.fileHash),
    entry,
  ])
}

function ensurePeer(): SyncPeer {
  peer ??= createSyncPeer({
    onChannelReady: (peerId, displayName) => {
      // First device in wins; sync is one-to-one. A third device joining
      // the same code is left connected but never spoken to.
      if (activePeerId === null) {
        activePeerId = peerId
        setSyncPeerLabel(displayName)
        setSyncState('connected')
        // The arrival deadline may have already fired and left "nobody
        // joined with that code" on screen. A device just joined with
        // that code, so the warning is now a lie sitting directly above
        // a green Connected chip.
        clearWaitingError()
        console.info(`[sync] connected to "${displayName}"`)
        // The other half of the peer-left toast: behind a hidden dialog
        // a comeback (REQ-SYNC-035) is otherwise a silent text change on
        // the corner chip.
        if (peerDropped && !syncModalOpen()) {
          showNotification(`Reconnected to ${displayName}.`, 'success')
        }
        peerDropped = false
        void announceSelf(peerId)
      }
    },
    onPeerLeft: (peerId) => {
      if (peerId !== activePeerId) return
      activePeerId = null
      peerDropped = true
      setSyncPeerLabel(null)
      setSyncPeerRoom(null)
      // The library announcement dies with the device that made it; the
      // next hello (same device back, or a different one) speaks anew.
      setSyncPeerSongs(null)
      const gone = 'The other device left.'
      activeSender?.abort(gone)
      activeReceiver?.abort(gone)
      // A song announced but never offered has no transfer object to
      // abort — only a row saying it is being packed. The device doing
      // the packing has gone, so that row would sit there for ever.
      failPreparingRows(gone)
      console.info('[sync] the other device left')
      // Behind a closed dialog the only sign would be the corner chip
      // quietly changing its text; say it where notifications land.
      if (!closing && !syncModalOpen()) {
        showNotification('The other device left the sync session.', 'warning')
      }
      // The room is still open; the same code still works for a retry.
      if (syncState() === 'connected') {
        setSyncState('waiting')
        // Back to waiting means back on the clock. Without re-arming, a
        // device that connects, drops, and never returns leaves the modal
        // saying "Waiting for a device" with no deadline behind it.
        armPeerArrivalDeadline('left')
      }
    },
    onControl: (peerId, raw) => {
      if (peerId !== activePeerId || !isSyncWireMessage(raw)) return
      const msg = raw as SyncWireMessage
      if (msg.type === 'sync-hello') {
        setSyncPeerLabel(msg.label)
        setSyncPeerRoom(
          msg.freeBytes === undefined
            ? null
            : { freeBytes: msg.freeBytes, quota: msg.quota ?? 0 },
        )
        // `isSyncWireMessage` vouches for `type` and nothing else, and
        // this is the first field that reaches a constructor: `new
        // Set(42)` throws mid-hello, leaving it half-applied, and the
        // throw lands in the data channel's catch written for JSON parse
        // failures — silent. A string is worse than a throw: it builds a
        // Set of single characters that quietly marks songs as already
        // over there. Null keeps "said nothing" distinct from "said none".
        setSyncPeerSongs(
          Array.isArray(msg.songHashes)
            ? new Set(
                msg.songHashes.filter(
                  (h): h is string => typeof h === 'string' && h !== '',
                ),
              )
            : null,
        )
        return
      }
      if (msg.type === 'sync-active') {
        // Somebody is looking at the far device. That is activity, even
        // though nothing is moving and our own dialog is hidden.
        if (!syncModalOpen() && syncState() !== 'idle') armIdleStop()
        return
      }
      if (msg.type === 'sync-preparing') {
        // No `syncBusy` here, deliberately: this device is not busy, it is
        // waiting. Setting it would make `handleIncomingOffer` refuse the
        // very offer this frame is announcing, as "still busy with the
        // previous song".
        addTransfer({
          fileHash: msg.fileHash,
          title: msg.title,
          direction: 'in',
          status: 'preparing',
          ratio: 0,
          bytes: msg.estimatedBytes ?? 0,
        })
        console.info(`[sync] the other device is packing "${msg.title}"`)
        return
      }
      if (msg.type === 'sync-cancelled') {
        // Only ever retracts a promise that has not been kept. Once the
        // offer has landed the transfer owns its own ending, and a late
        // cancellation must not overwrite "in your library".
        const pending = syncTransfers().find(
          (t) => t.fileHash === msg.fileHash && t.status === 'preparing',
        )
        if (pending !== undefined) {
          upsertTransfer(msg.fileHash, {
            status: 'failed',
            message:
              msg.message ?? 'The other device stopped preparing that song.',
          })
        }
        return
      }
      if (msg.type === 'sync-offer') {
        handleIncomingOffer(msg.manifest)
        return
      }
      // Anything else belongs to whichever transfer is in flight; each
      // checks the fileHash itself.
      activeSender?.handleControl(msg)
      activeReceiver?.handleControl(msg)
    },
    onChunk: (peerId, bytes) => {
      if (peerId !== activePeerId) return
      activeReceiver?.handleChunk(bytes)
    },
    onError: (message) => {
      setSyncError(message)
    },
    onRoomClosed: () => {
      // Same courtesy as a leaving peer: with the dialog closed, the
      // chip vanishing is the only other sign the session is gone.
      if (!closing && !syncModalOpen()) {
        showNotification('The sync session ended.', 'warning')
      }
      resetSync('The sync session ended.')
    },
  })
  return peer
}

/**
 * How long a joiner waits for the far device before saying the code is
 * probably wrong.
 *
 * A wrong code does NOT fail: the room server adopts any well-formed
 * name, so a mistyped code quietly opens a new, empty room and the two
 * devices wait for each other in different places. Nothing but a
 * deadline can tell that apart from a slow connection, so this is the
 * only thing standing between the user and "Connecting…" for ever.
 *
 * Thirty seconds because the cost of the two mistakes is not symmetric.
 * Late is a few more seconds of a spinner somebody is already watching;
 * early is an accusation that the code was mistyped, aimed at somebody
 * who is still walking across the room with the other device.
 */
const PEER_ARRIVAL_MS = 30_000

/** The exact text the deadline leaves behind, so it can be taken back. */
const NOBODY_JOINED =
  'No device joined with that code. Check the code on the other device — and that both are on the same Wi-Fi — then try again.'

/** After a device has already been here, the code is not the suspect. */
const PEER_NOT_BACK =
  'The other device has not come back. It is still welcome on the same code.'

/**
 * Retract the waiting warning, and nothing else.
 *
 * Scoped to those two messages on purpose: a transfer that failed for its
 * own reasons is still worth reading after a device reconnects, and
 * clearing the whole error slot would swallow it.
 */
function clearWaitingError(): void {
  const current = syncError()
  if (current === NOBODY_JOINED || current === PEER_NOT_BACK) {
    setSyncError(null)
  }
}

/** Poll until signaling has answered with an id, or give up. */
async function waitFor(
  read: () => string | null,
  timeoutMs = 12_000,
): Promise<string | null> {
  const end = Date.now() + timeoutMs
  for (;;) {
    const value = read()
    if (value !== null && value !== '') return value
    if (Date.now() >= end) return null
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
}

/**
 * Watch for the far device, and say something if it never arrives.
 *
 * `since` is not decoration. "No device joined with that code" is a
 * reasonable guess the first time and plainly wrong the second: a device
 * that connected and dropped proved the code was right, and telling
 * somebody to go and re-check it sends them to look at the one thing
 * that is definitely fine.
 */
function armPeerArrivalDeadline(since: 'never-joined' | 'left'): void {
  const mine = generation
  setTimeout(() => {
    if (mine !== generation) return
    if (activePeerId !== null) return
    if (syncState() !== 'waiting') return
    console.info(
      `[sync] no peer in room ${syncRoomId() ?? '(none)'} after ${PEER_ARRIVAL_MS / 1000}s (${since})`,
    )
    setSyncError(since === 'left' ? PEER_NOT_BACK : NOBODY_JOINED)
  }, PEER_ARRIVAL_MS)
}

/**
 * Open this device to receive songs. Resolves to the room code the other
 * device needs, or null (with syncError set) when the room never opened.
 */
export async function startSyncReceive(): Promise<string | null> {
  const p = ensurePeer()
  setSyncError(null)
  setSyncState('starting')
  // Ask before anything arrives, not after. Persistence is what stops the
  // browser reclaiming a library it just accepted, and on some platforms
  // it is also what lifts the origin out of the small best-effort bucket
  // -- which is the difference between a device that can receive a song
  // and one that cannot.
  void requestPersistentStorage().then(() => refreshOwnRoom())
  void refreshOwnRoom()
  await p.createRoom(syncDeviceLabel())
  const roomId = await waitFor(() => p.getRoomId())
  if (roomId === null) {
    // Torn down rather than left half-open: the room may yet arrive on a
    // slow link, and a code the UI never showed is a room nobody can
    // join. Ending it cleanly is what makes "Try again" work.
    const message =
      syncError() ??
      'Could not open a sync session — check your connection and try again.'
    resetSync(message)
    return null
  }
  setSyncRoomId(roomId)
  setSyncRole('receive')
  setSyncState('waiting')
  armPeerArrivalDeadline('never-joined')
  return roomId
}

/** Re-read this device's own allowance, for the modal to show. */
export async function refreshOwnRoom(): Promise<void> {
  setSyncOwnRoom(await ownRoom())
}

/** Join the other device's code, ready to send. */
export async function startSyncSend(roomId: string): Promise<boolean> {
  const p = ensurePeer()
  // Normalized here too, not only in the input: the room id is a
  // case-sensitive Durable Object name, and a lowercase code opens a
  // different empty room rather than failing.
  const code = normalizeRoomCode(roomId)
  if (code === '') {
    setSyncError('That does not look like a sync code.')
    setSyncState('idle')
    return false
  }
  setSyncError(null)
  setSyncState('starting')
  await p.joinRoom(code, syncDeviceLabel())
  const peerId = await waitFor(() => p.getPeerId())
  if (peerId === null) {
    if (syncError() === null) {
      setSyncError(
        'No answer for that code — check it on the other device, then try again.',
      )
    }
    setSyncState('idle')
    return false
  }
  setSyncRoomId(code)
  setSyncRole('send')
  // 'waiting' until the DataChannel to the receiver actually opens.
  if (syncState() === 'starting') setSyncState('waiting')
  armPeerArrivalDeadline('never-joined')
  return true
}

/**
 * How a send ended, for the queue to act on.
 *
 * The queue steps over a `song-failed` — one unreadable stem must not
 * cost somebody the other five songs — but stops on `link-failed`,
 * because a link that refused this song (no connection, relayed route,
 * dead channel) will refuse every song after it the same way, one
 * identical error at a time.
 */
export type SendResult = 'sent' | 'already' | 'song-failed' | 'link-failed'

/**
 * Pack one song and push it to the connected device.
 *
 * Sequential by design — `syncBusy` guards the UI — because two songs
 * interleaving on one channel helps neither of them (same reasoning as
 * the jam room's one-peer-at-a-time share).
 */
export async function sendSongToPeer(sessionId: string): Promise<SendResult> {
  const p = peer
  const target = activePeerId
  if (p === null || target === null) return 'link-failed'
  if (syncBusy()) return 'song-failed'
  const session = getUvrSession(sessionId)
  if (session === undefined) {
    // Deleted between opening the modal and pressing Send. Saying so
    // beats a Send button that does nothing and explains nothing.
    setSyncError('That song is no longer on this device.')
    return 'song-failed'
  }
  const fileHash = session.fileHash ?? sessionId
  const title = session.originalFile?.name ?? 'Untitled song'
  const mine = generation
  const signal = packAbort
  /**
   * Retract a `sync-preparing` that will not become an offer.
   *
   * Safe to call on a path that never sent one: the far side only acts on
   * a cancellation for a row it is still showing as preparing, so a stray
   * one is a no-op rather than a way to kill a live transfer.
   */
  const cancel = (message: string): void => {
    p.sendControl(target, { type: 'sync-cancelled', fileHash, message })
  }

  setSyncBusy(true)
  addTransfer({
    fileHash,
    title,
    direction: 'out',
    status: 'packing',
    ratio: 0,
    bytes: 0,
  })

  try {
    // The route is checked BEFORE packing, not after. Packing a song is
    // tens of seconds of decode and encode on a phone; discovering only
    // then that the route is relayed -- and refusing -- spends all of it
    // to say no.
    const connection = p.connectionTo(target)
    if (connection === null) {
      const message = 'The connection to the other device is no longer open.'
      console.warn('[sync] refusing to send: no peer connection')
      upsertTransfer(fileHash, { status: 'failed', message })
      showNotification(message, 'warning')
      return 'link-failed'
    }
    // Waits for ICE to settle rather than reading one sample. Pressing
    // Send the instant the green Connected chip appears used to land in
    // the window where no candidate pair has been nominated yet, and that
    // was reported as a relay -- so the answer was "put both devices on
    // the same Wi-Fi" to somebody whose devices were already on it.
    const route = await awaitDirectRoute(connection)
    console.info(`[sync] route to peer: ${route}`)
    if (route !== 'direct') {
      const message =
        route === 'relayed' ? RELAY_REFUSAL : ROUTE_UNKNOWN_REFUSAL
      upsertTransfer(fileHash, { status: 'failed', message })
      showNotification(message, 'warning')
      return 'link-failed'
    }

    // And so is the far device's room, for the same reason: a TV that
    // allows 16 MB in total cannot take a song however long we spend
    // preparing one for it. The estimate is rough on purpose -- the exact
    // check happens below once the manifest exists -- but it is what
    // stops minutes of encoding that could never have landed.
    const far = syncPeerRoom()
    const estimate = estimatePackedBytes(session)
    if (far !== null && estimate > 0 && far.freeBytes < estimate) {
      const message = `${syncPeerLabel() ?? 'That device'} has about ${formatBytes(far.freeBytes)} free and this song needs roughly ${formatBytes(estimate)}. Free some space over there and try again.`
      upsertTransfer(fileHash, { status: 'failed', message })
      showNotification(message, 'warning')
      return 'song-failed'
    }

    // Everything that could refuse before a promise is made has now had
    // its say, so this is the earliest honest moment to tell the far
    // device something is coming. Before this point a refusal costs it
    // nothing; after it, the receiver is showing "preparing" and every
    // remaining exit has to retract that with `sync-cancelled`.
    p.sendControl(target, {
      type: 'sync-preparing',
      fileHash,
      title,
      ...(estimate > 0 ? { estimatedBytes: estimate } : {}),
    })

    // Per-stem encode progress folded into one bar: two stems, half each.
    const packRatio: Record<string, number> = {}
    const bundle = await buildPortableBundle(sessionId, {
      signal,
      onProgress: (prog) => {
        packRatio[prog.part] = prog.ratio
        const vocal = packRatio['stem:vocal'] ?? 0
        const inst = packRatio['stem:instrumental'] ?? 0
        upsertTransfer(fileHash, { ratio: (vocal + inst) / 2 })
      },
    })
    // The session this job belongs to may have been closed and replaced
    // while it packed; its bytes are not wanted by anybody now.
    if (mine !== generation) {
      // The peer is usually gone with the session, in which case this
      // goes nowhere and the far side's own peer-left handler closes the
      // row. It costs one frame to also cover the case where it is not.
      cancel('The other device stopped before the song was ready.')
      return 'link-failed'
    }
    const bytes = bundle.manifest.parts.reduce((n, part) => n + part.bytes, 0)
    upsertTransfer(fileHash, { bytes })

    // Now the real number is known, check it against the real number over
    // there. The receiver checks too -- it is the one that knows for
    // certain -- but refusing here means nothing moves at all.
    const room = syncPeerRoom()
    if (room !== null && room.freeBytes < bytes) {
      const message = `${syncPeerLabel() ?? 'That device'} has about ${formatBytes(room.freeBytes)} free and this song needs ${formatBytes(bytes)}.`
      upsertTransfer(fileHash, { status: 'failed', message })
      // The one refusal after the promise that the far side can still
      // hear: its channel is fine, we simply packed something too big for
      // it. Telling it why beats leaving "preparing" on screen for ever.
      cancel(message)
      showNotification(message, 'warning')
      return 'song-failed'
    }

    const channel = p.channelTo(target)
    // A channel that exists but is not open is a pair that died while we
    // packed -- writing to it silently drops every frame.
    if (channel !== null && channel.readyState !== 'open') {
      upsertTransfer(fileHash, {
        status: 'failed',
        message:
          'The connection to the other device dropped while the song was being packed.',
      })
      return 'link-failed'
    }
    if (channel === null) {
      upsertTransfer(fileHash, {
        status: 'failed',
        message: 'The connection closed before the song could be sent.',
      })
      return 'link-failed'
    }

    upsertTransfer(fileHash, { status: 'transferring', ratio: 0 })
    const startedAt = Date.now()
    const sender = sendBundleOverWire(
      bundle,
      {
        sendControl: (msg) => p.sendControl(target, msg),
        channel,
      },
      {
        onProgress: (prog) => upsertTransfer(fileHash, { ratio: prog.overall }),
      },
    )
    activeSender = sender
    const outcome = await sender.result
    const elapsedMs = Date.now() - startedAt

    if (outcome.outcome === 'sent') {
      notePeerHasSong(fileHash)
      const mbps =
        elapsedMs > 0 ? bytes / (1024 * 1024) / (elapsedMs / 1000) : 0
      upsertTransfer(fileHash, {
        status: 'done',
        ratio: 1,
        elapsedMs,
        mbps,
      })
      // The numbers the plan asked every phase to report (device-sync.md,
      // Phase 0): real bytes, real elapsed, real throughput.
      console.info(
        `[sync] sent "${title}": ${(bytes / (1024 * 1024)).toFixed(1)} MB in ${(elapsedMs / 1000).toFixed(1)}s (${mbps.toFixed(1)} MB/s) at ${bundle.manifest.song.quality}`,
      )
      showNotification(`“${title}” is now on the other device.`, 'success')
      return 'sent'
    } else if (outcome.outcome === 'already-there') {
      notePeerHasSong(fileHash)
      upsertTransfer(fileHash, { status: 'already', ratio: 1 })
      return 'already'
    } else {
      upsertTransfer(fileHash, { status: 'failed', message: outcome.message })
      if (!closing) {
        showNotification(
          `“${title}” did not make it across: ${outcome.message}`,
          'error',
        )
      }
      // A wire failure can be the receiver refusing THIS song (no room,
      // busy) as easily as a dying link, so it does not stop the queue.
      return 'song-failed'
    }
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'The song could not be packed.'
    upsertTransfer(fileHash, { status: 'failed', message })
    // Packing threw. Whatever the far side is showing, it is no longer
    // true — and it is the one thing it cannot work out for itself.
    cancel(message)
    if (!closing) showNotification(message, 'error')
    return 'song-failed'
  } finally {
    // Only if this job still owns the session — see `generation`.
    if (mine === generation) {
      activeSender = null
      setSyncBusy(false)
    }
  }
}

/** A device that has gone will not take song five. */
const QUEUE_PEER_GONE =
  'The other device left, so the songs still waiting were not sent.'

/** A link that refused this song refuses the next one identically. */
const QUEUE_LINK_DEAD =
  'The connection to the other device is not working, so the songs still waiting were not sent.'

/** Only one drain runs; a second `enqueueSongs` joins the one in flight. */
let draining = false

async function nap(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Send the queue, one song at a time.
 *
 * Sequential for the same reason a single send was: two songs
 * interleaving on one channel helps neither, and the receiver's pull loop
 * assumes one bundle at a time. `syncBusy` stays the interlock; this just
 * refills it.
 *
 * A song that fails does NOT stop the rest. Its reason stays on screen in
 * its own row, which is the honest outcome — one unreadable stem should
 * not cost somebody the other five songs. A peer that LEAVES does stop it,
 * because nothing after that could succeed.
 */
async function drainQueue(): Promise<void> {
  if (draining) return
  draining = true
  const mine = generation
  try {
    while (mine === generation) {
      const queue = syncQueue()
      const next = queue[0]
      if (next === undefined) break
      if (activePeerId === null) {
        setSyncQueue([])
        setSyncError(QUEUE_PEER_GONE)
        break
      }
      // A song arriving from the other direction owns the channel. Wait
      // for it rather than dropping the queue on the floor — but not for
      // ever, because a stuck receive must not hang the send queue too.
      let waited = 0
      while (syncBusy() && waited < 60_000 && mine === generation) {
        await nap(250)
        waited += 250
      }
      if (mine !== generation) break
      if (syncBusy()) {
        setSyncQueue([])
        setSyncError(
          'The other device is still busy with an earlier song, so the rest were not sent.',
        )
        break
      }
      // Popped BEFORE the attempt, so the loop always advances. Filtering
      // afterwards is how a refusal that returns instantly turns into a
      // loop that never ends. Functional on purpose: the busy nap above
      // can last a while, and a song enqueued during it lives only in
      // the CURRENT queue — writing back a stale capture would drop it.
      setSyncQueue((q) => q.slice(1))
      const result = await sendSongToPeer(next)
      // A dead link fails every remaining song the same way — four VPN
      // refusals in a row taught us nobody needs the last three of them.
      if (result === 'link-failed' && mine === generation) {
        if (syncQueue().length > 0) setSyncError(QUEUE_LINK_DEAD)
        setSyncQueue([])
        break
      }
    }
  } finally {
    draining = false
  }
}

/**
 * Queue songs to send. Already-queued ids are ignored, so pressing Send
 * twice on the same selection does not send anything twice.
 */
export function enqueueSongs(sessionIds: string[]): void {
  const queued = new Set(syncQueue())
  const fresh = sessionIds.filter((id) => !queued.has(id))
  if (fresh.length === 0) return
  setSyncQueue((current) => [...current, ...fresh])
  console.info(`[sync] queued ${fresh.length} song(s)`)
  void drainQueue()
}

/** Stop after the song in flight — it is already half sent. */
export function stopQueue(): void {
  setSyncQueue([])
}

/**
 * Sweep finished rows (done, already, failed) out of the transfer list.
 *
 * Live rows stay — clearing a song mid-flight would hide real work — and
 * this exists so a long session's history can be dismissed without
 * closing the modal, which would end the sync session with it.
 */
export function clearFinishedTransfers(): void {
  setSyncTransfers((prev) =>
    prev.filter(
      (t) =>
        t.status === 'packing' ||
        t.status === 'preparing' ||
        t.status === 'transferring',
    ),
  )
}

function handleIncomingOffer(manifest: unknown): void {
  const p = peer
  const from = activePeerId
  if (p === null || from === null) return
  if (!isReadableManifest(manifest)) {
    // A manifest this build cannot read — newer app on the other side.
    p.sendControl(from, {
      type: 'sync-failed',
      fileHash:
        typeof manifest === 'object' && manifest !== null
          ? String((manifest as PortableBundleManifest).song?.fileHash ?? '')
          : '',
      message:
        'This device could not read the song — it may need an app update.',
    })
    return
  }
  if (activeReceiver !== null || syncBusy()) {
    p.sendControl(from, {
      type: 'sync-failed',
      fileHash: manifest.song.fileHash,
      message: 'The other device is still busy with the previous song.',
    })
    return
  }

  const { fileHash, title } = manifest.song
  const bytes = manifest.parts.reduce((n, part) => n + part.bytes, 0)
  const mine = generation
  setSyncBusy(true)
  addTransfer({
    fileHash,
    title,
    direction: 'in',
    status: 'transferring',
    ratio: 0,
    bytes,
  })
  const startedAt = Date.now()

  const receiver = receiveBundleOverWire(
    manifest,
    { sendControl: (msg) => p.sendControl(from, msg) },
    importPortableBundle,
    {
      onProgress: (prog) => upsertTransfer(fileHash, { ratio: prog.overall }),
      // Asked before a byte moves. The alternative is what a real TV did:
      // took the whole vocal stem, then refused the instrumental because
      // the origin allows 16 MB in total, and rolled the lot back.
      checkRoom: roomFor,
    },
  )
  activeReceiver = receiver

  void receiver.result
    .then((outcome) => {
      const elapsedMs = Date.now() - startedAt
      if (outcome.outcome === 'imported') {
        // They sent it, so they have it — and now so do we.
        notePeerHasSong(fileHash)
        const mbps =
          elapsedMs > 0 ? bytes / (1024 * 1024) / (elapsedMs / 1000) : 0
        upsertTransfer(fileHash, { status: 'done', ratio: 1, elapsedMs, mbps })
        console.info(
          `[sync] received "${title}": ${(bytes / (1024 * 1024)).toFixed(1)} MB in ${(elapsedMs / 1000).toFixed(1)}s (${mbps.toFixed(1)} MB/s) at ${manifest.song.quality}`,
        )
        showNotification(
          `“${title}” arrived — it is in your library.`,
          'success',
        )
      } else if (outcome.outcome === 'already-here') {
        upsertTransfer(fileHash, { status: 'already', ratio: 1 })
      } else {
        upsertTransfer(fileHash, { status: 'failed', message: outcome.message })
        if (!closing) {
          showNotification(
            `“${title}” did not arrive intact: ${outcome.message}`,
            'error',
          )
        }
      }
    })
    .finally(() => {
      if (mine === generation) {
        activeReceiver = null
        setSyncBusy(false)
      }
    })
}

function resetSync(notice: string | null): void {
  const stopped = 'The sync session was closed.'
  generation += 1
  closing = true
  cancelIdleStop()
  // Stops a pack mid-slice. Without it a phone keeps decoding and
  // encoding a whole song for a screen that is already gone.
  packAbort.aborted = true
  packAbort = { aborted: false }
  activeSender?.abort(stopped)
  activeReceiver?.abort(stopped)
  activeSender = null
  activeReceiver = null
  activePeerId = null
  peer?.leaveRoom()
  peer?.dispose()
  peer = null
  setSyncState('idle')
  setSyncRoomId(null)
  setSyncRole(null)
  setSyncPeerLabel(null)
  // Both readings describe a pairing that no longer exists. `onPeerLeft`
  // already clears them; ending the whole session did not, so the numbers
  // from the LAST device survived into the next one and were believed
  // until its `sync-hello` arrived. That window is not cosmetic: a TV
  // measured at 14 MB free would mark every song "too big for that
  // device" after the TV was gone and a laptop had taken its place, and
  // `sendSongToPeer` would refuse against the same stale figure.
  setSyncPeerRoom(null)
  setSyncPeerSongs(null)
  cancelOrphanGrace()
  setSyncOwnRoom(null)
  setSyncQueue([])
  setSyncTransfers([])
  setSyncBusy(false)
  peerDropped = false
  if (notice !== null) {
    setSyncError(notice)
  }
  // The aborted transfers resolve a microtask later; by then their
  // "it failed" notifications would be about a thing the user chose.
  queueMicrotask(() => {
    closing = false
  })
}

/** Close the session and forget everything about it. */
export function stopSync(): void {
  resetSync(null)
  setSyncError(null)
}

/**
 * True while anything is packing, being prepared, or on the wire.
 *
 * A memo, not a plain call: `syncTransfers` is republished on every 16KB
 * chunk, and every subscriber below (wake lock, idle countdown, chip)
 * would otherwise re-run thousands of times per song. The boolean's
 * default equality gates all of that down to real transitions.
 */
export const transferMoving = createMemo(
  () =>
    syncBusy() ||
    syncQueue().length > 0 ||
    syncTransfers().some(isLiveTransfer),
)

/**
 * How long a hidden-but-connected session may sit with nothing moving
 * before it closes itself. Long enough to walk to the other device,
 * pick more songs and come back; short enough that a forgotten pairing
 * does not hold a room and a peer connection open all evening.
 */
const SYNC_IDLE_STOP_MS = 10 * 60 * 1000

// One string, two audiences: the toast that says it happened, and the
// error slot of the reopened dialog — so no "open sync" tail, which
// would read absurdly inside the very dialog it points at.
const IDLE_STOPPED =
  'The sync session closed after 10 minutes with nothing moving.'

let idleStopTimer: ReturnType<typeof setTimeout> | null = null

function cancelIdleStop(): void {
  if (idleStopTimer !== null) {
    clearTimeout(idleStopTimer)
    idleStopTimer = null
  }
}

/** (Re)start the countdown; every call is a fresh ten minutes. */
function armIdleStop(): void {
  cancelIdleStop()
  idleStopTimer = setTimeout(() => {
    idleStopTimer = null
    // Never cuts a moving transfer — its own completion re-arms this.
    if (syncModalOpen() || syncState() === 'idle' || transferMoving()) return
    resetSync(IDLE_STOPPED)
    showNotification(IDLE_STOPPED, 'info')
  }, SYNC_IDLE_STOP_MS)
}

/**
 * How long a peerless session may stay open behind a hidden dialog.
 *
 * Two failures meet at this number. Stop instantly and pressing X during
 * a two-second Wi-Fi wobble destroys the pairing the reconnect
 * (REQ-SYNC-035) is two seconds from rebuilding. Keep it for the full
 * idle ten minutes and a room whose code left the screen long ago is
 * still joinable — and the first stranger to join is auto-accepted and
 * told our device name, our free space and up to 2000 library hashes.
 * 45s clears the 2s/8s reconnect attempts with room to spare and closes
 * the exposure the rest of the way.
 */
const SYNC_ORPHAN_GRACE_MS = 45_000

/**
 * How often an open dialog tells the far device somebody is here.
 * Comfortably inside the ten-minute idle stop it refreshes, so a single
 * dropped frame cannot end a session that is genuinely in use.
 */
const SYNC_ACTIVE_PING_MS = 30_000

let orphanGraceTimer: ReturnType<typeof setTimeout> | null = null

function cancelOrphanGrace(): void {
  if (orphanGraceTimer !== null) {
    clearTimeout(orphanGraceTimer)
    orphanGraceTimer = null
  }
}

// ── The dialog is a view; the session is not ─────────────────────────
// Closing the dialog keeps a connected session — and anything it is
// moving — alive behind the corner chip (REQ-SYNC-030). A session with
// nobody on the other end gets a short grace instead: long enough for a
// dropped pair to rebuild itself, short enough that a room whose code is
// on screen nowhere cannot quietly wait for a stranger.
registerSyncUiLifecycle({
  onForeground: () => {
    cancelIdleStop()
    cancelOrphanGrace()
  },
  onBackground: () => {
    if (syncState() === 'idle') return
    if (syncState() === 'connected' || transferMoving()) {
      armIdleStop()
      return
    }
    cancelOrphanGrace()
    orphanGraceTimer = setTimeout(() => {
      orphanGraceTimer = null
      // Re-checked, not assumed: the reconnect may have landed, the user
      // may have reopened the dialog, or a send may have started.
      if (
        syncModalOpen() ||
        syncState() === 'idle' ||
        syncState() === 'connected' ||
        transferMoving()
      ) {
        return
      }
      stopSync()
    }, SYNC_ORPHAN_GRACE_MS)
  },
})

// Module-scope reactivity needs an owner or Solid warns about leaks;
// this root lives as long as the page, which is exactly the intent.
createRoot(() => {
  // The corner chip's one question — is there a session? — answered
  // without making its always-mounted host import this (WebRTC-heavy)
  // module at first paint.
  createEffect(() => setSyncSessionLive(syncState() !== 'idle'))

  // A phone that sleeps mid-pack stalls the job where it stood — the
  // same death the Drive backup guards against (REQ-DRV-017). Strictly
  // paired enable/disable: keepAwake counts holders, and an unpaired
  // disable here would release a running Drive job's lock (REQ-SYNC-033).
  let holdingWake = false
  createEffect(() => {
    const moving = transferMoving()
    if (moving && !holdingWake) {
      holdingWake = true
      void platform.keepAwake.enable()
    } else if (!moving && holdingWake) {
      holdingWake = false
      void platform.keepAwake.disable()
    }
    // The idle countdown only ever runs behind a hidden dialog with
    // nothing moving; any transition here rewinds it (REQ-SYNC-032).
    if (moving) {
      cancelIdleStop()
    } else if (!syncModalOpen() && syncState() !== 'idle') {
      armIdleStop()
    }
  })

  // The other half of the idle rule. Our countdown can only see OUR
  // dialog, so a peer reading its open send dialog — freeing space,
  // because our refusal told it to — used to look abandoned and get cut
  // off at ten minutes. While our dialog is open we say so, and the far
  // device counts it as activity (`sync-active`).
  createEffect(() => {
    if (!syncModalOpen() || syncState() !== 'connected') return
    const announce = (): void => {
      const target = activePeerId
      if (target !== null) peer?.sendControl(target, { type: 'sync-active' })
    }
    announce()
    const beat = setInterval(announce, SYNC_ACTIVE_PING_MS)
    onCleanup(() => clearInterval(beat))
  })
})
