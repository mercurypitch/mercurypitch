// ── Sharing a song, end to end ───────────────────────────────────────
// Encode once, then send to each peer in turn.
//
// The sequencing is the decision worth knowing about: one peer at a time,
// not all at once. Five peers means the host uploads the file five times
// either way, but doing them in parallel splits one uplink five ways, so
// everybody waits for the slowest instead of the first person getting it
// quickly. On a phone that difference is the feature working or not.
//
// The encode is cached against the song, because sharing the same song to
// a second room should not pay for it twice.
//
// See docs/plans/jam-song-p2p-transfer.md.

import type { SendChannel, StatsSource } from '@/lib/jam/jam-song-transfer'
import { isRelayedConnection, sendInChunks, sha256Hex, } from '@/lib/jam/jam-song-transfer'
import { encodeStemToAac } from '@/lib/jam/stem-encoder'

export type ShareStem = 'instrumental' | 'vocal'

/** One stem, encoded and ready to send. */
export interface EncodedStem {
  stem: ShareStem
  bytes: ArrayBuffer
  sha256: string
  mime: string
}

export interface ShareProgress {
  peerId: string
  stem: ShareStem
  /** 0-1 across THIS stem to THIS peer. */
  ratio: number
  /**
   * 0-1 across the whole job: every stem, to everybody.
   *
   * What a progress bar should read. Per-stem it ran 0-100 twice and then
   * again for the next person, so a send to two peers filled the bar four
   * times and meant nothing.
   */
  overall: number
}

/**
 * What a peer is told when it cannot be sent the audio.
 *
 * Kept as a reason rather than a silent skip: the difference between "we
 * are not sending this" and "this is broken" is the whole of whether the
 * room trusts what it is looking at.
 */
export interface ShareSkip {
  peerId: string
  reason: string
}

const RELAY_REFUSAL =
  'You are connected through a relay, so the backing track cannot be sent to you — it would use the room’s shared bandwidth. You will still see the words, the notes and everyone’s pitch.'

/**
 * Encode both stems once.
 *
 * Both, because the guide vocal is how somebody learns a song they do not
 * know, and it is the remote peer -- the one who cannot hear your device
 * -- who needs it most. Two stems at 128 kbps is about 7.6 MB for a
 * four-minute song, which is the same order as one, so this is close to
 * free.
 */
export async function encodeStemsForShare(
  stems: { instrumental: ArrayBuffer; vocal?: ArrayBuffer },
  onProgress?: (p: { stem: ShareStem; ratio: number }) => void,
): Promise<EncodedStem[]> {
  const out: EncodedStem[] = []
  const jobs: Array<[ShareStem, ArrayBuffer]> = [
    ['instrumental', stems.instrumental],
  ]
  if (stems.vocal !== undefined) jobs.push(['vocal', stems.vocal])

  for (const [stem, wav] of jobs) {
    const bytes = (
      await encodeStemToAac(wav, (p) => onProgress?.({ stem, ratio: p.ratio }))
    ).buffer as ArrayBuffer
    out.push({
      stem,
      bytes,
      sha256: await sha256Hex(bytes),
      mime: 'audio/mp4',
    })
  }
  return out
}

export interface ShareTarget {
  peerId: string
  channel: SendChannel | null
  connection: StatsSource | null
}

export interface ShareTransport {
  /** Send a control frame (offer / done / abort) to one peer. */
  sendMessage: (peerId: string, msg: object) => void
  /** Stable ids, so both ends agree which transfer a frame belongs to. */
  nextTransferId: () => string
}

/**
 * Send the encoded stems to each peer, one peer at a time.
 *
 * Returns who was skipped and why. A peer behind a relay is refused
 * before a single byte moves -- checked up front rather than discovered
 * seven megabytes in, which would waste exactly the bandwidth the rule
 * exists to protect.
 *
 * One peer failing does not stop the others: a dropped connection is that
 * person's problem, and cancelling everyone else's copy because of it
 * would turn one bad link into a broken room.
 */
export async function shareStemsWithPeers(
  stems: readonly EncodedStem[],
  targets: readonly ShareTarget[],
  transport: ShareTransport,
  opts: {
    onProgress?: (p: ShareProgress) => void
    signal?: { aborted: boolean }
  } = {},
): Promise<{ sent: string[]; skipped: ShareSkip[] }> {
  const sent: string[] = []
  const skipped: ShareSkip[] = []

  // One bar for the whole job. Every peer gets every stem, so the work is
  // known up front, and a peer who is skipped still counts as its share
  // done -- otherwise a room where one person is behind a relay leaves the
  // bar permanently short of the end.
  const bytesPerPeer = stems.reduce((n, s) => n + s.bytes.byteLength, 0)
  const totalBytes = bytesPerPeer * targets.length
  let doneBytes = 0
  const overallAt = (extra: number) =>
    totalBytes <= 0 ? 1 : Math.min(1, (doneBytes + extra) / totalBytes)

  for (const target of targets) {
    if (opts.signal?.aborted === true) break
    const { peerId, channel, connection } = target

    if (channel === null || channel.readyState !== 'open') {
      skipped.push({ peerId, reason: 'They are not connected right now.' })
      doneBytes += bytesPerPeer
      continue
    }
    if (connection === null || (await isRelayedConnection(connection))) {
      transport.sendMessage(peerId, {
        type: 'song-file',
        action: 'abort',
        transferId: '',
        reason: RELAY_REFUSAL,
      })
      skipped.push({ peerId, reason: RELAY_REFUSAL })
      doneBytes += bytesPerPeer
      continue
    }

    try {
      for (const stem of stems) {
        const transferId = transport.nextTransferId()
        transport.sendMessage(peerId, {
          type: 'song-file',
          action: 'offer',
          transferId,
          header: {
            stem: stem.stem,
            bytes: stem.bytes.byteLength,
            sha256: stem.sha256,
            mime: stem.mime,
          },
        })
        await sendInChunks(channel, stem.bytes, {
          ...(opts.signal === undefined ? {} : { signal: opts.signal }),
          onProgress: (p) =>
            opts.onProgress?.({
              peerId,
              stem: stem.stem,
              ratio: p.ratio,
              overall: overallAt(p.received),
            }),
        })
        doneBytes += stem.bytes.byteLength
        transport.sendMessage(peerId, {
          type: 'song-file',
          action: 'done',
          transferId,
        })
      }
      sent.push(peerId)
    } catch (err) {
      const reason =
        err instanceof Error ? err.message : 'The transfer did not finish.'
      transport.sendMessage(peerId, {
        type: 'song-file',
        action: 'abort',
        transferId: '',
        reason,
      })
      skipped.push({ peerId, reason })
      // Whatever was left of this peer's share is not going to happen.
      doneBytes = Math.min(totalBytes, doneBytes + bytesPerPeer)
    }
  }

  return { sent, skipped }
}
