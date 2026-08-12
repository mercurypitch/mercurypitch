// ── Sync wire protocol ───────────────────────────────────────────────
// How a portable bundle crosses a DataChannel: the receiver pulls.
//
// The sender offers a manifest; the receiver either declines (it already
// has the song) or requests each part in turn, verifying every one before
// asking for the next. One part is ever in flight, which is what keeps a
// phone's memory flat, makes a corrupt part retryable in isolation, and
// means the import's own pull loop IS the wire loop — not a copy of it.
//
// The jam room's song delivery is fire-and-forget and sometimes a late
// joiner never receives (dev testing, 2026-08-03). This protocol is the
// fix built where it matters most: every part is hashed, a bad part is
// re-requested a bounded number of times, and the transfer ends with an
// explicit `sync-kept` — the sender KNOWS the song is playable over
// there, rather than hoping.
//
// Pure protocol, no database and no WebRTC: the caller supplies the
// channel, the control-frame sender, and the import function, so both
// halves are testable over an in-memory pipe.
//
// See docs/plans/device-sync.md (Phase 5).

import type { SendChannel } from '@/lib/jam/jam-song-transfer'
import { sendInChunks } from '@/lib/jam/jam-song-transfer'
import type { PortableBundleManifest, PortablePartId, PortablePartInfo, } from '@/lib/portable/portable-bundle'
import { PortablePartCorruptError, verifyPart, } from '@/lib/portable/portable-bundle'

/** How many times a corrupt part is asked for again before giving up. */
export const PART_RETRY_LIMIT = 2

/** A pull with no bytes arriving for this long is a dead sender. */
export const PART_STALL_MS = 20_000

/**
 * How long the sender waits for the receiver to say anything at all.
 *
 * Re-armed on every frame from the far side, so it only fires when the
 * conversation has genuinely stopped -- the receiver's tab was closed,
 * its phone slept, the pair died without the channel noticing. Without
 * it the send promise waits for a frame that is never coming, and the
 * UI stays "Sending 0%" with every control disabled for ever.
 */
export const SENDER_SILENCE_MS = 45_000

export type SyncWireMessage =
  /**
   * What each device tells the other about itself the moment the channel
   * opens, before any song is chosen.
   *
   * `freeBytes` is why this exists: a TV measured in testing allowed 16 MB
   * in TOTAL, so the sender needs to know the far side is nearly full
   * BEFORE it spends minutes packing a song that cannot land. Omitted when
   * the browser will not say, which means "unknown", never "unlimited".
   */
  | { type: 'sync-hello'; label: string; freeBytes?: number; quota?: number }
  | { type: 'sync-offer'; manifest: PortableBundleManifest }
  | { type: 'sync-accept'; fileHash: string }
  | { type: 'part-request'; fileHash: string; part: PortablePartId }
  | { type: 'sync-kept'; fileHash: string }
  | {
      type: 'sync-declined'
      fileHash: string
      reason: 'already-here' | 'no-room'
      /** Shown to the sender as-is when the reason is not already-here. */
      message?: string
    }
  | { type: 'sync-failed'; fileHash: string; message: string }
  | { type: 'sync-abort'; fileHash: string; message: string }

export interface SyncProgress {
  /** The part currently moving. */
  part: PortablePartId
  /** 0-1 within that part. */
  ratio: number
  /** 0-1 across the whole bundle, weighted by part size. */
  overall: number
}

export type SendOutcome =
  | { outcome: 'sent' }
  | { outcome: 'already-there' }
  | { outcome: 'failed'; message: string }

export type ReceiveOutcome =
  | { outcome: 'imported'; sessionId: string }
  | { outcome: 'already-here'; sessionId: string }
  | { outcome: 'failed'; message: string }

function totalPartBytes(manifest: PortableBundleManifest): number {
  return manifest.parts.reduce((n, p) => n + p.bytes, 0)
}

/** Bytes of every part before this one, for the overall ratio. */
function bytesBefore(
  manifest: PortableBundleManifest,
  part: PortablePartId,
): number {
  let n = 0
  for (const p of manifest.parts) {
    if (p.id === part) return n
    n += p.bytes
  }
  return n
}

// ── Sender ───────────────────────────────────────────────────────────

export interface BundleSendPort {
  /** Send a control frame. Returns false when the channel is gone. */
  sendControl: (msg: SyncWireMessage) => boolean
  /** The channel part bytes go down, driven with backpressure. */
  channel: SendChannel
}

export interface BundleSender {
  /** A control frame from the receiving peer. */
  handleControl: (msg: SyncWireMessage) => void
  /** Stop now — tells the other side why, then resolves as failed. */
  abort: (message: string) => void
  result: Promise<SendOutcome>
}

/**
 * Offer a built bundle and serve the parts the receiver asks for.
 *
 * Resolves only on one of the protocol's explicit endings — kept,
 * declined, failed or aborted. The receiver drives the pacing: a
 * re-request of the same part is simply served again, which is the whole
 * retry mechanism from this side.
 */
export function sendBundleOverWire(
  bundle: {
    manifest: PortableBundleManifest
    parts: ReadonlyMap<PortablePartId, Uint8Array>
  },
  port: BundleSendPort,
  opts: {
    onProgress?: (p: SyncProgress) => void
    signal?: { aborted: boolean }
  } = {},
): BundleSender {
  const { manifest } = bundle
  const total = totalPartBytes(manifest)
  let settled = false
  let resolveResult: (o: SendOutcome) => void
  const result = new Promise<SendOutcome>((resolve) => {
    resolveResult = resolve
  })
  // Part sends are chained, not raced: the receiver asks for one part at
  // a time, but a retry request can arrive while the tail of the previous
  // send is still draining, and two writers on one channel would
  // interleave their chunks.
  let sendQueue: Promise<void> = Promise.resolve()

  let silenceTimer: ReturnType<typeof setTimeout> | null = null

  function settle(outcome: SendOutcome): void {
    if (settled) return
    settled = true
    if (silenceTimer !== null) clearTimeout(silenceTimer)
    silenceTimer = null
    resolveResult(outcome)
  }

  /** Restart the deadline; the far side is still talking. */
  function heardFromReceiver(): void {
    if (settled) return
    if (silenceTimer !== null) clearTimeout(silenceTimer)
    silenceTimer = setTimeout(() => {
      settle({
        outcome: 'failed',
        message:
          'The other device stopped answering. Check it is awake and still on the same Wi-Fi, then try again.',
      })
    }, SENDER_SILENCE_MS)
  }

  /**
   * Send a control frame, or end the transfer.
   *
   * A frame that cannot be sent is the channel being gone, and there is
   * no answer coming to a question that was never asked -- without this
   * the promise waits for ever and the UI keeps a "Sending" row and a
   * disabled Send button with no way back.
   */
  function sendOrFail(msg: SyncWireMessage, why: string): boolean {
    if (port.sendControl(msg)) return true
    settle({ outcome: 'failed', message: why })
    return false
  }

  function servePart(part: PortablePartId): void {
    const bytes = bundle.parts.get(part)
    const info = manifest.parts.find((p) => p.id === part)
    if (bytes === undefined || info === undefined) {
      port.sendControl({
        type: 'sync-abort',
        fileHash: manifest.song.fileHash,
        message: 'That part is not in this bundle.',
      })
      settle({
        outcome: 'failed',
        message: 'The receiver asked for a part this bundle does not have.',
      })
      return
    }
    const before = bytesBefore(manifest, part)
    sendQueue = sendQueue.then(async () => {
      if (settled) return
      try {
        // Copied so the exact bytes go out even if the source view sits
        // inside a larger (or shared) buffer.
        const exact = new Uint8Array(bytes).slice()
        await sendInChunks(port.channel, exact.buffer as ArrayBuffer, {
          ...(opts.signal === undefined ? {} : { signal: opts.signal }),
          onProgress: (p) => {
            // Bytes leaving the send buffer means the far side is
            // accepting them (SCTP will not drain otherwise), so this is
            // as good a liveness signal as a control frame -- and a big
            // part on a slow link takes longer than the silence window.
            heardFromReceiver()
            opts.onProgress?.({
              part,
              ratio: p.ratio,
              overall: total <= 0 ? 1 : (before + p.received) / total,
            })
          },
        })
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'The transfer did not finish.'
        port.sendControl({
          type: 'sync-abort',
          fileHash: manifest.song.fileHash,
          message,
        })
        settle({ outcome: 'failed', message })
      }
    })
  }

  function handleControl(msg: SyncWireMessage): void {
    if (settled) return
    if (!('fileHash' in msg) || msg.fileHash !== manifest.song.fileHash) return
    heardFromReceiver()
    switch (msg.type) {
      case 'sync-accept':
        // Nothing to do — the receiver will start requesting parts.
        break
      case 'part-request':
        servePart(msg.part)
        break
      case 'sync-kept':
        settle({ outcome: 'sent' })
        break
      case 'sync-declined':
        // Only ONE decline means the song is already over there. Reporting
        // a refusal for want of space as "already there" would tell
        // somebody their song had arrived when it had not.
        if (msg.reason === 'already-here') {
          settle({ outcome: 'already-there' })
        } else {
          settle({
            outcome: 'failed',
            message:
              msg.message ?? 'The other device would not accept the song.',
          })
        }
        break
      case 'sync-failed':
        settle({ outcome: 'failed', message: msg.message })
        break
      default:
        break
    }
  }

  function abort(message: string): void {
    port.sendControl({
      type: 'sync-abort',
      fileHash: manifest.song.fileHash,
      message,
    })
    settle({ outcome: 'failed', message })
  }

  if (
    sendOrFail(
      { type: 'sync-offer', manifest },
      'The connection to the other device closed before the song could be offered.',
    )
  ) {
    heardFromReceiver()
  }

  return { handleControl, abort, result }
}

// ── Receiver ─────────────────────────────────────────────────────────

export interface BundleReceivePort {
  sendControl: (msg: SyncWireMessage) => boolean
}

export interface BundleReceiver {
  /** Raw part bytes from the sending peer. */
  handleChunk: (bytes: ArrayBuffer) => void
  /** A control frame from the sending peer. */
  handleControl: (msg: SyncWireMessage) => void
  /** Stop now — fails the pull in flight, which rolls the import back. */
  abort: (message: string) => void
  result: Promise<ReceiveOutcome>
}

class SyncAbortError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SyncAbortError'
  }
}

/**
 * Pull an offered bundle down the wire and keep it.
 *
 * `importBundle` is the database half, passed in rather than imported so
 * this module stays free of storage concerns — production hands it
 * `importPortableBundle`, tests hand it the same function against a fake
 * database. Its pull loop calls `getPart` once per part in manifest
 * order; each call here becomes a `part-request`, a byte count, a hash
 * check, and up to PART_RETRY_LIMIT fresh requests when the bytes lie.
 */
export function receiveBundleOverWire(
  manifest: PortableBundleManifest,
  port: BundleReceivePort,
  importBundle: (
    manifest: PortableBundleManifest,
    getPart: (info: PortablePartInfo) => Promise<Uint8Array>,
  ) => Promise<{ outcome: 'imported' | 'already-here'; sessionId: string }>,
  opts: {
    onProgress?: (p: SyncProgress) => void
    stallMs?: number
    /**
     * Whether this device can hold the bundle, asked BEFORE accepting.
     *
     * The failure this exists for was measured: a TV took a whole vocal
     * stem, then refused the instrumental because the origin allows 16 MB
     * in total -- minutes of transfer spent to arrive at a rollback. The
     * manifest names every part's size up front, so the answer is knowable
     * before a single byte moves. Absent means "no opinion"; an unknown
     * quota must never read as a refusal.
     */
    checkRoom?: (
      bytes: number,
    ) => Promise<{ ok: true } | { ok: false; message: string }>
  } = {},
): BundleReceiver {
  const stallMs = opts.stallMs ?? PART_STALL_MS
  const total = totalPartBytes(manifest)
  let aborted: string | null = null
  // True when the abort arrived over the wire — the sender already knows
  // and telling it back would be noise. A LOCAL abort (user closed the
  // modal) still owes the sender a sync-failed.
  let abortedFromWire = false

  interface Pull {
    info: PortablePartInfo
    chunks: Uint8Array[]
    received: number
    resolve: (bytes: Uint8Array) => void
    reject: (err: Error) => void
    stallTimer: ReturnType<typeof setTimeout>
  }
  let pull: Pull | null = null

  function failPull(err: Error): void {
    const p = pull
    pull = null
    if (p !== null) {
      clearTimeout(p.stallTimer)
      p.reject(err)
    }
  }

  function armStall(p: Pull): void {
    clearTimeout(p.stallTimer)
    p.stallTimer = setTimeout(() => {
      if (pull === p) {
        failPull(
          new Error(
            'The other device stopped sending. Check it is still awake and on the same network.',
          ),
        )
      }
    }, stallMs)
  }

  function pullOnce(info: PortablePartInfo): Promise<Uint8Array> {
    return new Promise<Uint8Array>((resolve, reject) => {
      const p: Pull = {
        info,
        chunks: [],
        received: 0,
        resolve,
        reject,
        stallTimer: setTimeout(() => {}, 0),
      }
      pull = p
      armStall(p)
      const asked = port.sendControl({
        type: 'part-request',
        fileHash: manifest.song.fileHash,
        part: info.id,
      })
      if (!asked) {
        failPull(new Error('The connection to the other device closed.'))
      }
    })
  }

  async function getPart(info: PortablePartInfo): Promise<Uint8Array> {
    let corrupt = 0
    for (;;) {
      if (aborted !== null) throw new SyncAbortError(aborted)
      const bytes = await pullOnce(info)
      try {
        // Also verified inside the import — this early check is what makes
        // a corrupt part a re-request instead of a torn-down import.
        await verifyPart(info, bytes)
        return bytes
      } catch (err) {
        if (!(err instanceof PortablePartCorruptError)) throw err
        corrupt += 1
        if (corrupt > PART_RETRY_LIMIT) throw err
        console.warn(
          `[sync] the ${info.id} part arrived corrupt, asking again (${corrupt}/${PART_RETRY_LIMIT})`,
        )
      }
    }
  }

  function handleChunk(bytes: ArrayBuffer): void {
    const p = pull
    if (p === null) return
    if (p.received + bytes.byteLength > p.info.bytes) {
      // More than promised means the framing itself broke; there is no
      // way back to a known boundary, so the transfer ends here.
      failPull(new Error('The other device sent more than it announced.'))
      return
    }
    p.chunks.push(new Uint8Array(bytes))
    p.received += bytes.byteLength
    armStall(p)
    opts.onProgress?.({
      part: p.info.id,
      ratio: p.info.bytes <= 0 ? 1 : p.received / p.info.bytes,
      overall:
        total <= 0
          ? 1
          : (bytesBefore(manifest, p.info.id) + p.received) / total,
    })
    if (p.received === p.info.bytes) {
      const joined = new Uint8Array(p.received)
      let at = 0
      for (const chunk of p.chunks) {
        joined.set(chunk, at)
        at += chunk.byteLength
      }
      pull = null
      clearTimeout(p.stallTimer)
      p.resolve(joined)
    }
  }

  function handleControl(msg: SyncWireMessage): void {
    if (msg.type === 'sync-abort' && msg.fileHash === manifest.song.fileHash) {
      abortedFromWire = true
      abort(msg.message)
    }
  }

  function abort(message: string): void {
    if (aborted !== null) return
    aborted = message
    failPull(new SyncAbortError(message))
  }

  const result = (async (): Promise<ReceiveOutcome> => {
    try {
      // Room first, and only then accept: a refusal here costs the offer
      // frame, where the same refusal discovered mid-import costs the
      // whole transfer and leaves the sender believing it worked.
      const room = await opts.checkRoom?.(total)
      if (room !== undefined && !room.ok) {
        port.sendControl({
          type: 'sync-declined',
          fileHash: manifest.song.fileHash,
          reason: 'no-room',
          message: room.message,
        })
        return { outcome: 'failed', message: room.message }
      }
      if (aborted !== null) throw new SyncAbortError(aborted)

      // Accepted before the import starts pulling, so the sender hears
      // "accepted" before the first part-request.
      port.sendControl({
        type: 'sync-accept',
        fileHash: manifest.song.fileHash,
      })

      const kept = await importBundle(manifest, getPart)
      if (kept.outcome === 'already-here') {
        port.sendControl({
          type: 'sync-declined',
          fileHash: manifest.song.fileHash,
          reason: 'already-here',
        })
        return kept
      }
      port.sendControl({
        type: 'sync-kept',
        fileHash: manifest.song.fileHash,
      })
      return kept
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'The import did not finish.'
      if (!abortedFromWire) {
        port.sendControl({
          type: 'sync-failed',
          fileHash: manifest.song.fileHash,
          message,
        })
      }
      return { outcome: 'failed', message }
    }
  })()

  return { handleChunk, handleControl, abort, result }
}

/** Is this frame one of ours? The channel is shared with nothing today,
 *  but a cheap type gate keeps a foreign frame a no-op forever. */
export function isSyncWireMessage(
  value: Record<string, unknown>,
): value is SyncWireMessage & Record<string, unknown> {
  return (
    typeof value['type'] === 'string' &&
    [
      'sync-hello',
      'sync-offer',
      'sync-accept',
      'part-request',
      'sync-kept',
      'sync-declined',
      'sync-failed',
      'sync-abort',
    ].includes(value['type'])
  )
}
