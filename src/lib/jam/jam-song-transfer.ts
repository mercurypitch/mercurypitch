// ── Sending a song to the room ───────────────────────────────────────
// Moving a few megabytes of encoded stem across the DataChannel that
// already carries the manifest.
//
// The channel is fine for chat and pitch frames, which are small and
// frequent. Audio is neither, and needs three things those never did:
// backpressure, so a phone does not hold the whole file in a send buffer;
// an integrity check, because a truncated MP4 plays as silence rather
// than as an error; and a refusal up front when the connection is
// relayed, since song audio must never travel over TURN.
//
// See docs/plans/jam-song-p2p-transfer.md.

/**
 * Bytes per chunk.
 *
 * 16 KiB because that is the size every SCTP implementation handles
 * without fragmenting: the spec allows more and several browsers accept
 * more, but the interop floor is what matters when the other end might be
 * any device somebody owns.
 */
export const TRANSFER_CHUNK_BYTES = 16 * 1024

/**
 * How much may sit unsent before the sender pauses.
 *
 * Without this the loop hands the entire file to the channel as fast as
 * it can copy it, and the buffer -- which is memory -- grows to the size
 * of the song. A phone notices.
 */
export const SEND_HIGH_WATER = 1024 * 1024
export const SEND_LOW_WATER = 256 * 1024

/** What the receiver is told before the bytes arrive. */
export interface TransferHeader {
  transferId: string
  /** Which stem this is, so the receiver can rebuild the manifest. */
  stem: 'instrumental' | 'vocal'
  bytes: number
  /** SHA-256 of the payload, hex. */
  sha256: string
  mime: string
}

export interface TransferProgress {
  received: number
  total: number
  /** 0-1. */
  ratio: number
}

export function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  // globalThis.crypto, not the bare global: the repo bans the latter so a
  // page-level `crypto` variable can never shadow the real one.
  return globalThis.crypto.subtle.digest('SHA-256', bytes).then((digest) =>
    Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join(''),
  )
}

/** How many chunks a payload becomes. Zero bytes is zero chunks. */
export function chunkCount(
  totalBytes: number,
  chunkSize = TRANSFER_CHUNK_BYTES,
): number {
  if (totalBytes <= 0 || chunkSize <= 0) return 0
  return Math.ceil(totalBytes / chunkSize)
}

/** The slice boundaries for chunk `i`, clamped to the payload. */
export function chunkRange(
  index: number,
  totalBytes: number,
  chunkSize = TRANSFER_CHUNK_BYTES,
): { start: number; end: number } {
  const start = Math.min(index * chunkSize, totalBytes)
  return { start, end: Math.min(start + chunkSize, totalBytes) }
}

export class TransferIntegrityError extends Error {
  constructor() {
    super('The song arrived damaged, so it was thrown away.')
    this.name = 'TransferIntegrityError'
  }
}

export class TransferOverflowError extends Error {
  constructor() {
    super('The sender sent more than it promised.')
    this.name = 'TransferOverflowError'
  }
}

/**
 * Collects an inbound transfer.
 *
 * Deliberately a small state machine rather than "push into an array and
 * hope": a peer is untrusted, so more bytes than the header promised is
 * refused rather than allowed to grow unbounded, and the hash is checked
 * before anything is handed to a player. A silently truncated MP4 does
 * not throw when you play it -- it just goes quiet partway through, which
 * is indistinguishable from the feature being broken.
 */
export class TransferReceiver {
  readonly header: TransferHeader
  private readonly parts: Uint8Array[] = []
  private got = 0

  constructor(header: TransferHeader) {
    this.header = header
  }

  get received(): number {
    return this.got
  }

  get progress(): TransferProgress {
    const total = this.header.bytes
    return {
      received: this.got,
      total,
      ratio: total <= 0 ? 1 : Math.min(1, this.got / total),
    }
  }

  get complete(): boolean {
    return this.got >= this.header.bytes
  }

  accept(chunk: ArrayBuffer): TransferProgress {
    if (this.got + chunk.byteLength > this.header.bytes) {
      throw new TransferOverflowError()
    }
    this.parts.push(new Uint8Array(chunk))
    this.got += chunk.byteLength
    return this.progress
  }

  /** Reassemble and verify. Throws rather than returning a bad file. */
  async finish(): Promise<Blob> {
    if (this.got !== this.header.bytes) throw new TransferIntegrityError()
    const joined = new Uint8Array(this.got)
    let at = 0
    for (const part of this.parts) {
      joined.set(part, at)
      at += part.byteLength
    }
    const buffer = joined.buffer as ArrayBuffer
    if ((await sha256Hex(buffer)) !== this.header.sha256) {
      throw new TransferIntegrityError()
    }
    return new Blob([joined], { type: this.header.mime })
  }
}

/** Just enough of a DataChannel to send over, so this stays testable. */
export interface SendChannel {
  readonly bufferedAmount: number
  bufferedAmountLowThreshold: number
  readyState: string
  send: (data: ArrayBuffer) => void
  addEventListener: (type: 'bufferedamountlow', fn: () => void) => void
  removeEventListener: (type: 'bufferedamountlow', fn: () => void) => void
}

export class TransferAbortedError extends Error {
  constructor(why: string) {
    super(why)
    this.name = 'TransferAbortedError'
  }
}

/**
 * Push a payload down the channel, respecting backpressure.
 *
 * Waits on `bufferedamountlow` rather than a timer. A timer would either
 * be too slow (a fast LAN spends its time asleep) or too fast (a phone
 * fills its buffer anyway and we are back to holding the file twice).
 */
export async function sendInChunks(
  channel: SendChannel,
  bytes: ArrayBuffer,
  opts: {
    onProgress?: (p: TransferProgress) => void
    signal?: { aborted: boolean }
    chunkSize?: number
  } = {},
): Promise<void> {
  const size = opts.chunkSize ?? TRANSFER_CHUNK_BYTES
  const total = bytes.byteLength
  const count = chunkCount(total, size)
  channel.bufferedAmountLowThreshold = SEND_LOW_WATER

  for (let i = 0; i < count; i++) {
    if (opts.signal?.aborted === true) {
      throw new TransferAbortedError('The transfer was cancelled.')
    }
    if (channel.readyState !== 'open') {
      throw new TransferAbortedError('The connection closed mid-transfer.')
    }
    if (channel.bufferedAmount > SEND_HIGH_WATER) {
      await new Promise<void>((resolve) => {
        const onLow = () => {
          channel.removeEventListener('bufferedamountlow', onLow)
          resolve()
        }
        channel.addEventListener('bufferedamountlow', onLow)
      })
    }
    const { start, end } = chunkRange(i, total, size)
    channel.send(bytes.slice(start, end))
    opts.onProgress?.({
      received: end,
      total,
      ratio: total <= 0 ? 1 : end / total,
    })
  }
}

/** Just enough of a peer connection to ask about its route. */
export interface StatsSource {
  getStats: () => Promise<
    Map<string, Record<string, unknown>> | Iterable<[string, unknown]>
  >
}

/**
 * Is this connection going through a TURN relay?
 *
 * Asked BEFORE a transfer rather than discovered partway through. Song
 * audio never travels over TURN -- it would eat the free 1,000 GB -- so a
 * relayed peer is told plainly that they will not get the backing track,
 * while keeping the lyrics, the target notes and the pitch lanes.
 *
 * Unknown counts as relayed. If the route cannot be established the safe
 * answer is the one that does not spend somebody's bandwidth allowance.
 */
export async function isRelayedConnection(pc: StatsSource): Promise<boolean> {
  try {
    const raw = await pc.getStats()
    const stats = new Map<string, Record<string, unknown>>()
    for (const [id, value] of raw as Iterable<[string, unknown]>) {
      stats.set(id, value as Record<string, unknown>)
    }
    let pair: Record<string, unknown> | null = null
    for (const value of stats.values()) {
      if (
        value['type'] === 'candidate-pair' &&
        (value['state'] === 'succeeded' || value['nominated'] === true)
      ) {
        pair = value
        // A nominated succeeded pair is the one in use; keep looking only
        // while we have merely a succeeded one.
        if (value['nominated'] === true) break
      }
    }
    if (pair === null) return true
    for (const key of ['localCandidateId', 'remoteCandidateId']) {
      const id = pair[key]
      if (typeof id !== 'string') continue
      if (stats.get(id)?.['candidateType'] === 'relay') return true
    }
    return false
  } catch {
    return true
  }
}
