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

import { createSignal } from 'solid-js'
import { storageEstimate } from '@/db/durable-write'
import { requestPersistentStorage } from '@/db/persistent-storage'
import { buildPortableBundle, importPortableBundle, } from '@/db/services/portable-bundle-service'
import { formatBytes } from '@/lib/fetch-progress'
import { awaitDirectRoute } from '@/lib/jam/jam-song-transfer'
import type { PortableBundleManifest } from '@/lib/portable/portable-bundle'
import { isReadableManifest } from '@/lib/portable/portable-bundle'
import { normalizeRoomCode } from '@/lib/room-code'
import { syncDeviceLabel } from '@/lib/sync/device-label'
import type { SyncPeer } from '@/lib/sync/sync-peer'
import { createSyncPeer } from '@/lib/sync/sync-peer'
import type { BundleReceiver, BundleSender, SyncWireMessage, } from '@/lib/sync/sync-protocol'
import { isSyncWireMessage, receiveBundleOverWire, sendBundleOverWire, } from '@/lib/sync/sync-protocol'
import { showNotification } from '@/stores/notifications-store'
import type { UvrSession } from '@/stores/uvr-store'
import { getUvrSession } from '@/stores/uvr-store'

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
  status: 'packing' | 'transferring' | 'done' | 'already' | 'failed'
  /** 0-1 of the current activity. */
  ratio: number
  /** Total part bytes, once known. */
  bytes: number
  elapsedMs?: number
  mbps?: number
  message?: string
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
 * A code that arrived by deep link, waiting for the modal to consume it.
 *
 * Set by the router when somebody scans the QR a receiving device is
 * showing. One-shot: read and cleared, so a later reload of the same URL
 * does not silently reopen a session that has been closed.
 */
const [syncCodeToJoin, setSyncCodeToJoin] = createSignal<string | null>(null)

/** What THIS device can still hold, for the modal to show plainly. */
const [syncOwnRoom, setSyncOwnRoom] = createSignal<{
  freeBytes: number
  quota: number
} | null>(null)
const [syncTransfers, setSyncTransfers] = createSignal<SyncTransfer[]>([])
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
  syncOwnRoom,
  syncPeerLabel,
  syncPeerRoom,
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
  const stems = (['vocal', 'instrumental'] as const).filter(
    (stem) => session.outputs?.[stem] !== undefined,
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

/** Tell the far device who we are and how much we can still hold. */
async function announceSelf(peerId: string): Promise<void> {
  const room = await ownRoom()
  setSyncOwnRoom(room)
  peer?.sendControl(peerId, {
    type: 'sync-hello',
    label: syncDeviceLabel(),
    ...(room === null ? {} : { freeBytes: room.freeBytes, quota: room.quota }),
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
        void announceSelf(peerId)
      }
    },
    onPeerLeft: (peerId) => {
      if (peerId !== activePeerId) return
      activePeerId = null
      setSyncPeerLabel(null)
      setSyncPeerRoom(null)
      const gone = 'The other device left.'
      activeSender?.abort(gone)
      activeReceiver?.abort(gone)
      console.info('[sync] the other device left')
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
  // 'waiting' until the DataChannel to the receiver actually opens.
  if (syncState() === 'starting') setSyncState('waiting')
  armPeerArrivalDeadline('never-joined')
  return true
}

/**
 * Pack one song and push it to the connected device.
 *
 * Sequential by design — `syncBusy` guards the UI — because two songs
 * interleaving on one channel helps neither of them (same reasoning as
 * the jam room's one-peer-at-a-time share).
 */
export async function sendSongToPeer(sessionId: string): Promise<void> {
  const p = peer
  const target = activePeerId
  if (p === null || target === null || syncBusy()) return
  const session = getUvrSession(sessionId)
  if (session === undefined) {
    // Deleted between opening the modal and pressing Send. Saying so
    // beats a Send button that does nothing and explains nothing.
    setSyncError('That song is no longer on this device.')
    return
  }
  const fileHash = session.fileHash ?? sessionId
  const title = session.originalFile?.name ?? 'Untitled song'
  const mine = generation
  const signal = packAbort

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
      return
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
      return
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
      return
    }

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
    if (mine !== generation) return
    const bytes = bundle.manifest.parts.reduce((n, part) => n + part.bytes, 0)
    upsertTransfer(fileHash, { bytes })

    // Now the real number is known, check it against the real number over
    // there. The receiver checks too -- it is the one that knows for
    // certain -- but refusing here means nothing moves at all.
    const room = syncPeerRoom()
    if (room !== null && room.freeBytes < bytes) {
      const message = `${syncPeerLabel() ?? 'That device'} has about ${formatBytes(room.freeBytes)} free and this song needs ${formatBytes(bytes)}.`
      upsertTransfer(fileHash, { status: 'failed', message })
      showNotification(message, 'warning')
      return
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
      return
    }
    if (channel === null) {
      upsertTransfer(fileHash, {
        status: 'failed',
        message: 'The connection closed before the song could be sent.',
      })
      return
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
    } else if (outcome.outcome === 'already-there') {
      upsertTransfer(fileHash, { status: 'already', ratio: 1 })
    } else {
      upsertTransfer(fileHash, { status: 'failed', message: outcome.message })
      if (!closing) {
        showNotification(
          `“${title}” did not make it across: ${outcome.message}`,
          'error',
        )
      }
    }
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'The song could not be packed.'
    upsertTransfer(fileHash, { status: 'failed', message })
    if (!closing) showNotification(message, 'error')
  } finally {
    // Only if this job still owns the session — see `generation`.
    if (mine === generation) {
      activeSender = null
      setSyncBusy(false)
    }
  }
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
  setSyncPeerLabel(null)
  // Both readings describe a pairing that no longer exists. `onPeerLeft`
  // already clears them; ending the whole session did not, so the numbers
  // from the LAST device survived into the next one and were believed
  // until its `sync-hello` arrived. That window is not cosmetic: a TV
  // measured at 14 MB free would mark every song "too big for that
  // device" after the TV was gone and a laptop had taken its place, and
  // `sendSongToPeer` would refuse against the same stale figure.
  setSyncPeerRoom(null)
  setSyncOwnRoom(null)
  setSyncTransfers([])
  setSyncBusy(false)
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
