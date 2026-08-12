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
import { buildPortableBundle, importPortableBundle, } from '@/db/services/portable-bundle-service'
import { isRelayedConnection } from '@/lib/jam/jam-song-transfer'
import type { PortableBundleManifest } from '@/lib/portable/portable-bundle'
import { isReadableManifest } from '@/lib/portable/portable-bundle'
import { syncDeviceLabel } from '@/lib/sync/device-label'
import type { SyncPeer } from '@/lib/sync/sync-peer'
import { createSyncPeer } from '@/lib/sync/sync-peer'
import type { BundleReceiver, BundleSender, SyncWireMessage, } from '@/lib/sync/sync-protocol'
import { isSyncWireMessage, receiveBundleOverWire, sendBundleOverWire, } from '@/lib/sync/sync-protocol'
import { showNotification } from '@/stores/notifications-store'
import { getUvrSession } from '@/stores/uvr-store'

/**
 * Song audio must never cross a TURN relay — it is the same bandwidth
 * rule the jam room enforces, for the same reason: the relay is a shared,
 * metered resource and a library is gigabytes.
 */
const RELAY_REFUSAL =
  'These devices could only reach each other through a relay, and songs are too big to send that way. Put both on the same Wi-Fi and try again.'

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
const [syncTransfers, setSyncTransfers] = createSignal<SyncTransfer[]>([])
/** True while a song is packing or moving in either direction. */
const [syncBusy, setSyncBusy] = createSignal(false)

export {
  syncBusy,
  syncError,
  syncPeerLabel,
  syncRoomId,
  syncState,
  syncTransfers,
}

let peer: SyncPeer | null = null
let activePeerId: string | null = null
let activeSender: BundleSender | null = null
let activeReceiver: BundleReceiver | null = null

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
      }
    },
    onPeerLeft: (peerId) => {
      if (peerId !== activePeerId) return
      activePeerId = null
      setSyncPeerLabel(null)
      const gone = 'The other device left.'
      activeSender?.abort(gone)
      activeReceiver?.abort(gone)
      // The room is still open; the same code still works for a retry.
      if (syncState() === 'connected') setSyncState('waiting')
    },
    onControl: (peerId, raw) => {
      if (peerId !== activePeerId || !isSyncWireMessage(raw)) return
      const msg = raw as SyncWireMessage
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

/** Poll until signaling has answered with an id, or give up. */
async function waitFor(
  read: () => string | null,
  timeoutMs = 7000,
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
 * Open this device to receive songs. Resolves to the room code the other
 * device needs, or null (with syncError set) when the room never opened.
 */
export async function startSyncReceive(): Promise<string | null> {
  const p = ensurePeer()
  setSyncError(null)
  setSyncState('starting')
  await p.createRoom(syncDeviceLabel())
  const roomId = await waitFor(() => p.getRoomId())
  if (roomId === null) {
    if (syncError() === null) {
      setSyncError('Could not open a sync session — check your connection.')
    }
    setSyncState('idle')
    return null
  }
  setSyncRoomId(roomId)
  setSyncState('waiting')
  return roomId
}

/** Join the other device's code, ready to send. */
export async function startSyncSend(roomId: string): Promise<boolean> {
  const p = ensurePeer()
  setSyncError(null)
  setSyncState('starting')
  await p.joinRoom(roomId.trim(), syncDeviceLabel())
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
  setSyncRoomId(roomId.trim())
  // 'waiting' until the DataChannel to the receiver actually opens.
  if (syncState() === 'starting') setSyncState('waiting')
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
  if (session === undefined) return
  const fileHash = session.fileHash ?? sessionId
  const title = session.originalFile?.name ?? 'Untitled song'

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
    // Per-stem encode progress folded into one bar: two stems, half each.
    const packRatio: Record<string, number> = {}
    const bundle = await buildPortableBundle(sessionId, {
      onProgress: (prog) => {
        packRatio[prog.part] = prog.ratio
        const vocal = packRatio['stem:vocal'] ?? 0
        const inst = packRatio['stem:instrumental'] ?? 0
        upsertTransfer(fileHash, { ratio: (vocal + inst) / 2 })
      },
    })
    const bytes = bundle.manifest.parts.reduce((n, part) => n + part.bytes, 0)
    upsertTransfer(fileHash, { bytes })

    const connection = p.connectionTo(target)
    if (connection === null || (await isRelayedConnection(connection))) {
      upsertTransfer(fileHash, { status: 'failed', message: RELAY_REFUSAL })
      showNotification(RELAY_REFUSAL, 'warning')
      return
    }
    const channel = p.channelTo(target)
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
      showNotification(
        `“${title}” did not make it across: ${outcome.message}`,
        'error',
      )
    }
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'The song could not be packed.'
    upsertTransfer(fileHash, { status: 'failed', message })
    showNotification(message, 'error')
  } finally {
    activeSender = null
    setSyncBusy(false)
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
        showNotification(
          `“${title}” did not arrive intact: ${outcome.message}`,
          'error',
        )
      }
    })
    .finally(() => {
      activeReceiver = null
      setSyncBusy(false)
    })
}

function resetSync(notice: string | null): void {
  const stopped = 'The sync session was closed.'
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
  setSyncTransfers([])
  setSyncBusy(false)
  if (notice !== null) {
    setSyncError(notice)
  }
}

/** Close the session and forget everything about it. */
export function stopSync(): void {
  resetSync(null)
  setSyncError(null)
}
