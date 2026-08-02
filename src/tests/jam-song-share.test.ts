// Fan-out: one peer at a time, relay peers refused before a byte moves,
// and one bad link never costs the rest of the room its copy.

import { describe, expect, it, vi } from 'vitest'
import type { EncodedStem, ShareTarget } from '@/lib/jam/jam-song-share'
import { shareStemsWithPeers } from '@/lib/jam/jam-song-share'

vi.mock('@/lib/jam/stem-encoder', () => ({
  encodeStemToAac: vi.fn(async () => new Uint8Array(8)),
}))

const stem = (name: 'instrumental' | 'vocal', n = 64): EncodedStem => ({
  stem: name,
  bytes: new Uint8Array(n).buffer,
  sha256: `hash-${name}`,
  mime: 'audio/mp4',
})

function target(
  peerId: string,
  opts: { relayed?: boolean; open?: boolean; failAt?: number } = {},
): ShareTarget & { sentBytes: number[] } {
  const sentBytes: number[] = []
  const channel = {
    bufferedAmount: 0,
    bufferedAmountLowThreshold: 0,
    readyState: opts.open === false ? 'closed' : 'open',
    send: (d: ArrayBuffer) => {
      if (opts.failAt !== undefined && sentBytes.length >= opts.failAt) {
        throw new Error('link died')
      }
      sentBytes.push(d.byteLength)
    },
    addEventListener: () => {},
    removeEventListener: () => {},
  }
  const connection = {
    getStats: async () =>
      new Map<string, Record<string, unknown>>([
        [
          'p',
          {
            type: 'candidate-pair',
            state: 'succeeded',
            nominated: true,
            localCandidateId: 'l',
            remoteCandidateId: 'r',
          },
        ],
        ['l', { type: 'local-candidate', candidateType: 'host' }],
        [
          'r',
          {
            type: 'remote-candidate',
            candidateType: opts.relayed === true ? 'relay' : 'host',
          },
        ],
      ]),
  }
  return { peerId, channel, connection, sentBytes }
}

function transport() {
  const msgs: Array<{ peerId: string; msg: Record<string, unknown> }> = []
  let n = 0
  return {
    msgs,
    sendMessage: (peerId: string, msg: object) =>
      msgs.push({ peerId, msg: msg as Record<string, unknown> }),
    nextTransferId: () => `t${++n}`,
  }
}

describe('shareStemsWithPeers', () => {
  it('sends every stem to every connected peer', async () => {
    const a = target('a')
    const b = target('b')
    const tr = transport()
    const out = await shareStemsWithPeers(
      [stem('instrumental'), stem('vocal')],
      [a, b],
      tr,
    )
    expect(out.sent).toEqual(['a', 'b'])
    expect(out.skipped).toEqual([])
    // 64 bytes per stem, two stems, in 16 KiB chunks = one chunk each.
    expect(a.sentBytes).toEqual([64, 64])
    expect(b.sentBytes).toEqual([64, 64])
  })

  it('brackets each stem with an offer and a done', async () => {
    const tr = transport()
    await shareStemsWithPeers([stem('instrumental')], [target('a')], tr)
    expect(tr.msgs.map((m) => m.msg['action'])).toEqual(['offer', 'done'])
    const offer = tr.msgs[0]?.msg
    expect(offer?.['header']).toMatchObject({
      stem: 'instrumental',
      bytes: 64,
      mime: 'audio/mp4',
    })
  })

  it('refuses a relayed peer before a single byte moves', async () => {
    // The rule this exists for: song audio never goes over TURN. Checking
    // afterwards would waste exactly the bandwidth being protected.
    const relayed = target('r', { relayed: true })
    const tr = transport()
    const out = await shareStemsWithPeers([stem('instrumental')], [relayed], tr)
    expect(relayed.sentBytes).toEqual([])
    expect(out.sent).toEqual([])
    expect(out.skipped[0]?.reason).toMatch(/relay/i)
  })

  it('tells the relayed peer why, rather than going quiet', async () => {
    const tr = transport()
    await shareStemsWithPeers(
      [stem('instrumental')],
      [target('r', { relayed: true })],
      tr,
    )
    expect(tr.msgs[0]?.msg['action']).toBe('abort')
    expect(String(tr.msgs[0]?.msg['reason'])).toMatch(/still see the words/i)
  })

  it('skips a peer whose channel is not open', async () => {
    const out = await shareStemsWithPeers(
      [stem('instrumental')],
      [target('gone', { open: false })],
      transport(),
    )
    expect(out.sent).toEqual([])
    expect(out.skipped[0]?.reason).toMatch(/not connected/i)
  })

  it('keeps going for everyone else when one link dies', async () => {
    // One bad connection is that person's problem; cancelling the room's
    // copies over it would turn one dropout into a broken room.
    const bad = target('bad', { failAt: 0 })
    const good = target('good')
    const out = await shareStemsWithPeers(
      [stem('instrumental')],
      [bad, good],
      transport(),
    )
    expect(out.skipped.map((s) => s.peerId)).toEqual(['bad'])
    expect(out.sent).toEqual(['good'])
    expect(good.sentBytes).toEqual([64])
  })

  it('stops when cancelled part-way through the room', async () => {
    const a = target('a')
    const b = target('b')
    const signal = { aborted: false }
    const tr = {
      ...transport(),
      sendMessage: () => {
        // Cancel as soon as the first peer's transfer is announced.
        signal.aborted = true
      },
    }
    const out = await shareStemsWithPeers([stem('instrumental')], [a, b], tr, {
      signal,
    })
    expect(out.sent.length + out.skipped.length).toBeLessThan(2)
    expect(b.sentBytes).toEqual([])
  })
})
