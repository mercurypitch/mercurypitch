// ── Jam diagnostics store tests ──────────────────────────────────────
// The sampler is the part that runs for an hour on somebody's phone in
// another country, so the cases that matter are the ones about what it
// does over time: peers leaving, counters resetting, and the export
// being readable by a human an hour after the run.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { JamDiagnosticsSources } from '@/stores/jam-diagnostics-store'
import { exportCsv, HISTORY_CAPACITY, jamDiagnostics, PING_STALE_MS, recordChannelPing, resetJamDiagnostics, sampleOnce, summariseRun, } from '@/stores/jam-diagnostics-store'

/** A getStats()-shaped report for one peer at a given buffer depth. */
const statsAt = (opts: {
  rttSec?: number
  delaySec?: number
  emitted?: number
  bytes?: number
  /** Cumulative inbound packets; the frame size is derived from its rate. */
  packets?: number
  /** Cumulative bytes sent. Omitted means no outbound audio stats at all. */
  sent?: number
}) => {
  const rows: Array<Record<string, unknown>> = [
    {
      type: 'candidate-pair',
      id: 'cp',
      nominated: true,
      state: 'succeeded',
      currentRoundTripTime: opts.rttSec ?? 0.02,
      localCandidateId: 'lc',
      remoteCandidateId: 'rc',
    },
    { type: 'local-candidate', id: 'lc', candidateType: 'host' },
    { type: 'remote-candidate', id: 'rc', candidateType: 'host' },
    {
      type: 'inbound-rtp',
      kind: 'audio',
      codecId: 'c',
      jitter: 0.003,
      packetsReceived: opts.packets ?? 100,
      packetsLost: 0,
      jitterBufferDelay: opts.delaySec ?? 3840,
      jitterBufferEmittedCount: opts.emitted ?? 48_000,
      bytesReceived: opts.bytes ?? 10_000,
    },
    {
      type: 'codec',
      id: 'c',
      mimeType: 'audio/opus',
      clockRate: 48000,
      channels: 1,
    },
  ]
  // No outbound-rtp at all unless asked for: that is what a connection
  // with nothing being sent on it actually looks like, and it is the
  // case the "not sending" warning exists for.
  if (opts.sent !== undefined) {
    rows.push({ type: 'outbound-rtp', kind: 'audio', bytesSent: opts.sent })
  }
  return {
    forEach(cb: (r: Record<string, unknown>) => void) {
      rows.forEach(cb)
    },
  }
}

function sourcesFor(
  ids: string[],
  stats: (peerId: string) => unknown | null,
): JamDiagnosticsSources & { pings: string[] } {
  const pings: string[] = []
  return {
    pings,
    peerIds: () => ids,
    statsFor: async (peerId) => stats(peerId),
    ping: (peerId) => {
      pings.push(peerId)
    },
  }
}

describe('sampleOnce', () => {
  beforeEach(() => resetJamDiagnostics())

  it('pings every connected peer each round', () => {
    // The channel ping is the only reading that works on a relayed path,
    // where ICE measures the leg to TURN rather than the route.
    const s = sourcesFor(['a', 'b'], () => statsAt({}))
    return sampleOnce(s).then(() => {
      expect(s.pings).toEqual(['a', 'b'])
    })
  })

  it('reports no live buffer depth until it has two samples', async () => {
    let emitted = 48_000
    let delay = 3840
    const s = sourcesFor(['a'], () => statsAt({ emitted, delaySec: delay }))
    await sampleOnce(s, 1000)
    expect(jamDiagnostics()[0]!.reading.jitterBufferMs).toBeNull()

    // A second later, 48k more samples emitted having waited 80 ms each.
    emitted += 48_000
    delay += 48_000 * 0.08
    await sampleOnce(s, 2000)
    expect(jamDiagnostics()[0]!.reading.jitterBufferMs).toBeCloseTo(80, 5)
  })

  it('reports no live buffer depth when the peer emitted nothing at all', async () => {
    // A silent or stalled stream advances no counter. Dividing a zero
    // delta by a zero delta is how a panel invents a buffer depth for a
    // peer that has not played a sample since the room opened.
    const s = sourcesFor(['a'], () => statsAt({}))
    await sampleOnce(s, 1000)
    await sampleOnce(s, 2000)
    expect(jamDiagnostics()[0]!.reading.jitterBufferMs).toBeNull()
  })

  it('accumulates a distribution across rounds', async () => {
    // One sample is an anecdote. The p95 is the number that decides
    // whether a pair is playable, and it needs a window.
    let rtt = 0.02
    const s = sourcesFor(['a'], () => statsAt({ rttSec: rtt }))
    for (const v of [0.02, 0.02, 0.02, 0.09]) {
      rtt = v
      await sampleOnce(s)
    }
    const stats = jamDiagnostics()[0]!.rttStats!
    expect(stats.count).toBe(4)
    expect(stats.p50).toBeCloseTo(20, 5)
    expect(stats.max).toBeCloseTo(90, 5)
  })

  it('forgets a peer who left, rather than holding their history all evening', async () => {
    const both = sourcesFor(['a', 'b'], () => statsAt({}))
    await sampleOnce(both)
    expect(jamDiagnostics()).toHaveLength(2)

    const alone = sourcesFor(['a'], () => statsAt({}))
    await sampleOnce(alone)
    expect(jamDiagnostics()).toHaveLength(1)
    expect(jamDiagnostics()[0]!.peerId).toBe('a')
  })

  it('restarts a returning peer clean rather than resuming their old window', async () => {
    const both = sourcesFor(['a', 'b'], () => statsAt({}))
    await sampleOnce(both)
    await sampleOnce(both)

    const alone = sourcesFor(['a'], () => statsAt({}))
    await sampleOnce(alone)

    const back = sourcesFor(['a', 'b'], () => statsAt({}))
    await sampleOnce(back)
    const b = jamDiagnostics().find((p) => p.peerId === 'b')!
    // A fresh window: the cumulative counters on a rebuilt connection
    // start over, and carrying the old ones forward would produce a
    // large negative delta on the first sample after the rejoin.
    expect(b.rttStats!.count).toBe(1)
    expect(b.reading.jitterBufferMs).toBeNull()
  })

  it('skips a peer whose connection has gone rather than failing the round', async () => {
    const s = sourcesFor(['a', 'b'], (id) => (id === 'a' ? statsAt({}) : null))
    await sampleOnce(s)
    expect(jamDiagnostics()).toHaveLength(1)
    expect(jamDiagnostics()[0]!.peerId).toBe('a')
  })

  it('survives a rejected getStats mid-round', async () => {
    // A connection closing while the round is in flight. Not worth an
    // error: the peer is gone from peerIds() on the next tick anyway.
    const s: JamDiagnosticsSources = {
      peerIds: () => ['a'],
      statsFor: () => Promise.reject(new Error('closed')),
      ping: () => {},
    }
    await expect(sampleOnce(s)).resolves.toBeUndefined()
    expect(jamDiagnostics()).toHaveLength(0)
  })

  it('bounds the sample history over a long session', async () => {
    const s = sourcesFor(['a'], () => statsAt({}))
    for (let i = 0; i < HISTORY_CAPACITY + 50; i++) await sampleOnce(s)
    expect(jamDiagnostics()[0]!.samples).toHaveLength(HISTORY_CAPACITY)
  })
})

describe('recordChannelPing', () => {
  beforeEach(() => resetJamDiagnostics())

  it('carries the ping distribution into the peer row', async () => {
    recordChannelPing('a', 22, 1000)
    recordChannelPing('a', 26, 1000)
    await sampleOnce(
      sourcesFor(['a'], () => statsAt({})),
      1000,
    )
    const row = jamDiagnostics()[0]!
    expect(row.channelPingMs).toBe(26)
    expect(row.pingStats!.count).toBe(2)
  })

  it('stops reporting a ping the channel has stopped answering', async () => {
    // The budget prefers this over the ICE round trip, so a value that
    // outlives the channel it came from holds a green verdict over a path
    // that has degraded -- with the truth visible one row below it.
    recordChannelPing('a', 26, 1000)
    const s = sourcesFor(['a'], () => statsAt({}))

    await sampleOnce(s, 1000 + PING_STALE_MS)
    expect(jamDiagnostics()[0]!.channelPingMs).toBe(26)

    await sampleOnce(s, 1000 + PING_STALE_MS + 1)
    expect(jamDiagnostics()[0]!.channelPingMs).toBeNull()
    // The history it contributed to is not a lie and stays.
    expect(jamDiagnostics()[0]!.pingStats!.count).toBe(1)
  })

  it('reports it again the moment the channel answers', async () => {
    recordChannelPing('a', 26, 1000)
    const s = sourcesFor(['a'], () => statsAt({}))
    await sampleOnce(s, 99_000)
    expect(jamDiagnostics()[0]!.channelPingMs).toBeNull()

    recordChannelPing('a', 31, 99_500)
    await sampleOnce(s, 99_600)
    expect(jamDiagnostics()[0]!.channelPingMs).toBe(31)
  })
})

describe('a round that goes wrong', () => {
  beforeEach(() => resetJamDiagnostics())

  it('keeps sampling the other peers when one ping throws', async () => {
    // `RTCDataChannel.send` throws once its buffer is full -- reachable
    // while a stem transfer saturates the same channel, which is exactly
    // when somebody has the panel open. This used to abort the round:
    // every peer after the throwing one lost their sample and the panel
    // froze on the previous tick with nothing said.
    const s = sourcesFor(['a', 'b'], () => statsAt({}))
    const base = s.ping
    s.ping = (peerId) => {
      if (peerId === 'a') throw new Error('send queue full')
      base(peerId)
    }

    await sampleOnce(s)
    expect(jamDiagnostics().map((r) => r.peerId)).toEqual(['a', 'b'])
  })
})

describe('summariseRun', () => {
  beforeEach(() => resetJamDiagnostics())

  it('labels the run and states whether the device was calibrated', async () => {
    // Six unlabelled runs are six columns of numbers nobody can tell
    // apart an hour later, which is what a latency test produces if
    // nobody thinks about it first.
    await sampleOnce(sourcesFor(['peer-abcdef123'], () => statsAt({})))
    const out = summariseRun(jamDiagnostics(), {
      label: 'Zagreb - Vienna, 5 GHz',
      roomId: 'ROOM42',
      userAgent: 'test-ua',
      deviceRoundTripMs: 18,
    })
    expect(out).toContain('Zagreb - Vienna, 5 GHz')
    expect(out).toContain('ROOM42')
    expect(out).toContain('device round trip: 18 ms')
    expect(out).toContain('| peer-abc |')
  })

  it('says a term was not measured rather than writing a zero', async () => {
    await sampleOnce(sourcesFor(['a'], () => statsAt({})))
    const out = summariseRun(jamDiagnostics(), {
      label: '',
      roomId: null,
      userAgent: 'ua',
      deviceRoundTripMs: null,
    })
    expect(out).toContain('device round trip: not measured')
    expect(out).toContain('(unlabelled)')
    // The first sample has no delta-derived figures yet; they must show
    // as a dash, not as 0.0.
    expect(out).toContain('—')
  })
})

describe('the run is only as good as what it exports', () => {
  beforeEach(() => resetJamDiagnostics())

  const meta = () => ({
    label: 'test run',
    roomId: 'ROOM1',
    userAgent: 'ua',
    deviceRoundTripMs: null,
  })

  it('carries the frame size, which is the question the run is taken to answer', async () => {
    // This was on screen and in neither export, so a run pasted to
    // somebody else could not say whether the 10 ms request landed.
    let received = 1000
    const s = sourcesFor(['a'], () => statsAt({ packets: received }))
    await sampleOnce(s, 1000)
    received += 100
    await sampleOnce(s, 2000)

    const csv = exportCsv(jamDiagnostics())
    const header = csv.split('\n')[0]!
    expect(header).toContain('frameMs')
    expect(header).toContain('packetsPerSecond')

    const summary = summariseRun(jamDiagnostics(), meta())
    // 100 packets in a second is 10 ms frames.
    expect(summary).toContain('10 ms')
  })

  it('says out loud that nothing is being sent', async () => {
    // The failure that looks like a healthy connection: audio arriving,
    // none leaving, every other number describing the direction that
    // works. An empty cell is not enough -- it was missed on a real run.
    let bytes = 10_000
    const s = sourcesFor(['a'], () => statsAt({ bytes }))
    await sampleOnce(s, 1000)
    bytes += 4300 // ~34 kbps arriving, as the real run measured
    await sampleOnce(s, 2000)

    const summary = summariseRun(jamDiagnostics(), meta())
    expect(summary).toContain('NOT SENDING')
  })

  it('stays quiet when audio is flowing both ways', async () => {
    let bytes = 10_000
    let sent = 10_000
    const s = sourcesFor(['a'], () => statsAt({ bytes, sent }))
    await sampleOnce(s, 1000)
    bytes += 4300
    sent += 4300
    await sampleOnce(s, 2000)
    expect(summariseRun(jamDiagnostics(), meta())).not.toContain('NOT SENDING')
  })

  it('does not cry wolf before any audio has arrived', async () => {
    // A room that has only just connected is not a room that is failing:
    // nothing in either direction is silence, not a fault.
    const s = sourcesFor(['a'], () => statsAt({ bytes: 0 }))
    await sampleOnce(s, 1000)
    await sampleOnce(s, 2000)
    expect(summariseRun(jamDiagnostics(), meta())).not.toContain('NOT SENDING')
  })

  it('flags a sender that stopped, not just one that never started', async () => {
    // outboundKbps 0 with a live outbound-rtp is the same outcome for the
    // person on the other end as no sender at all.
    let bytes = 10_000
    const s = sourcesFor(['a'], () => statsAt({ bytes, sent: 5_000 }))
    await sampleOnce(s, 1000)
    bytes += 4300
    await sampleOnce(s, 2000)
    expect(summariseRun(jamDiagnostics(), meta())).toContain('NOT SENDING')
  })
})

describe('exportCsv', () => {
  beforeEach(() => resetJamDiagnostics())

  it('emits a header and one row per sample', async () => {
    const s = sourcesFor(['a'], () => statsAt({}))
    await sampleOnce(s, 1000)
    await sampleOnce(s, 2000)
    const lines = exportCsv(jamDiagnostics()).split('\n')
    expect(lines[0]).toContain('rttMs')
    expect(lines).toHaveLength(3)
  })

  it('leaves an unmeasured cell empty rather than filling it with zero', async () => {
    await sampleOnce(
      sourcesFor(['a'], () => statsAt({})),
      1000,
    )
    const [, first] = exportCsv(jamDiagnostics()).split('\n')
    // jitterBufferMs is column index 5 and has no delta on sample one.
    expect(first!.split(',')[5]).toBe('')
  })

  it('recomputes deltas down the file so the time series is usable', async () => {
    const s = sourcesFor(['a'], () =>
      statsAt({ delaySec: 3840, emitted: 48_000 }),
    )
    await sampleOnce(s, 1000)
    const grown = sourcesFor(['a'], () =>
      statsAt({ delaySec: 3840 + 9600, emitted: 96_000 }),
    )
    await sampleOnce(grown, 2000)
    const rows = exportCsv(jamDiagnostics()).split('\n')
    // 9600 s of accumulated delay over 48000 emitted samples = 200 ms.
    expect(rows[2]!.split(',')[5]).toBe('200.00')
  })

  it('produces an empty-but-valid file for a run with no peers', () => {
    expect(exportCsv([])).toContain('rttMs')
  })
})

describe('resetJamDiagnostics', () => {
  it('starts the window over without needing the sampler stopped', async () => {
    const s = sourcesFor(['a'], () => statsAt({}))
    await sampleOnce(s)
    await sampleOnce(s)
    resetJamDiagnostics()
    expect(jamDiagnostics()).toHaveLength(0)
    await sampleOnce(s)
    expect(jamDiagnostics()[0]!.rttStats!.count).toBe(1)
  })
})

describe('sampler wiring', () => {
  it('reads stats once per peer per round, not once per render', async () => {
    // getStats walks every stats object on the connection. On a mesh of
    // 12 that is 11 walks a tick, and this is the guard against the
    // panel becoming the reason the room is slow.
    const statsFor = vi.fn().mockResolvedValue(statsAt({}))
    await sampleOnce({ peerIds: () => ['a', 'b'], statsFor, ping: () => {} })
    expect(statsFor).toHaveBeenCalledTimes(2)
  })
})
