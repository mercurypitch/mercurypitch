// ── Receiving a song ─────────────────────────────────────────────────
// The other half of jam-song-transfer: control frames and binary chunks
// arriving from a peer, reassembled into playable audio.
//
// One transfer at a time per peer, which is what lets a bare binary frame
// be matched to its transfer without a header on every chunk. That is not
// a shortcut -- the sender is sequential by design (see jam-song-share),
// so a second concurrent transfer from the same peer would be a bug on
// the sending side, and treating it as one here is honest.
//
// Everything the peer says is untrusted. The header's byte count bounds
// the buffer, the hash decides whether the result is handed on at all,
// and a chunk with no offer in front of it is dropped rather than
// accumulated.

import type { TransferHeader, TransferProgress, } from '@/lib/jam/jam-song-transfer'
import { TransferReceiver } from '@/lib/jam/jam-song-transfer'

export interface ReceivedStem {
  peerId: string
  stem: 'instrumental' | 'vocal'
  blob: Blob
}

export interface InboxHandlers {
  onProgress?: (peerId: string, p: TransferProgress) => void
  onStem?: (received: ReceivedStem) => void
  /** Damaged, refused, or abandoned -- always with something to show. */
  onFailed?: (peerId: string, reason: string) => void
}

export class SongFileInbox {
  private readonly open = new Map<string, TransferReceiver>()
  private readonly handlers: InboxHandlers

  constructor(handlers: InboxHandlers = {}) {
    this.handlers = handlers
  }

  /** Whether a transfer from this peer is in flight. */
  has(peerId: string): boolean {
    return this.open.has(peerId)
  }

  offer(peerId: string, header: TransferHeader): void {
    // A second offer replaces the first. The alternative is holding a
    // transfer nobody will ever finish, which is a slow memory leak in a
    // room somebody left open.
    this.open.set(peerId, new TransferReceiver(header))
  }

  chunk(peerId: string, buffer: ArrayBuffer): void {
    const rx = this.open.get(peerId)
    // Bytes with no offer in front of them. Dropping is right: without a
    // header there is no length to bound them by and no hash to check
    // them against, so accumulating would be accumulating anything.
    if (rx === undefined) return
    try {
      this.handlers.onProgress?.(peerId, rx.accept(buffer))
    } catch (err) {
      this.open.delete(peerId)
      this.handlers.onFailed?.(
        peerId,
        err instanceof Error ? err.message : 'The transfer went wrong.',
      )
    }
  }

  async done(peerId: string): Promise<void> {
    const rx = this.open.get(peerId)
    if (rx === undefined) return
    this.open.delete(peerId)
    try {
      const blob = await rx.finish()
      this.handlers.onStem?.({ peerId, stem: rx.header.stem, blob })
    } catch (err) {
      this.handlers.onFailed?.(
        peerId,
        err instanceof Error
          ? err.message
          : 'The song arrived damaged, so it was thrown away.',
      )
    }
  }

  /** The sender gave up, or refused before starting. */
  abort(peerId: string, reason: string): void {
    this.open.delete(peerId)
    this.handlers.onFailed?.(peerId, reason)
  }

  /** They left; nothing is coming. */
  forget(peerId: string): void {
    this.open.delete(peerId)
  }

  clear(): void {
    this.open.clear()
  }
}
