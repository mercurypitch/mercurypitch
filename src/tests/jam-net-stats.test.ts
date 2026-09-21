// ── Jam network stats tests ──────────────────────────────────────────
// The arithmetic here decides what a latency test on two real phones
// actually reports, so it is worth more than presence checks. Every case
// below is one the browser really produces: a stat that is missing, a
// counter that reset under an ICE restart, a session average that has
// stopped moving while the live figure climbs.

import { describe, expect, it } from 'vitest'
import type { JamNetSample } from '@/lib/jam/jam-net-stats'
import { classifyIcePath, createRingBuffer, deriveReading, readNetSample, rollingStats, } from '@/lib/jam/jam-net-stats'

/** A getStats()-shaped object over a plain array of reports. */
const report = (rows: Array<Record<string, unknown>>) => ({
  forEach(cb: (r: Record<string, unknown>) => void) {
    rows.forEach(cb)
  },
})

const pair = (over: Record<string, unknown> = {}) => ({
  type: 'candidate-pair',
  id: 'cp1',
  state: 'succeeded',
  nominated: true,
  currentRoundTripTime: 0.024,
  localCandidateId: 'lc1',
  remoteCandidateId: 'rc1',
  ...over,
})

const inbound = (over: Record<string, unknown> = {}) => ({
  type: 'inbound-rtp',
  kind: 'audio',
  codecId: 'codec1',
  jitter: 0.004,
  packetsReceived: 1000,
  packetsLost: 10,
  jitterBufferDelay: 38_400,
  jitterBufferEmittedCount: 480_000,
  jitterBufferTargetDelay: 38_400,
  concealedSamples: 4800,
  concealmentEvents: 3,
  removedSamplesForAcceleration: 480,
  insertedSamplesForDeceleration: 960,
  bytesReceived: 100_000,
  ...over,
})

describe('classifyIcePath', () => {
  it('calls a pair relayed when EITHER end is a relay candidate', () => {
    // Reading only the local end is how a room quietly running on TURN
    // reports itself as a direct connection -- and TURN is the case where
    // the extra hop is worth knowing about.
    expect(classifyIcePath('host', 'relay')).toBe('relay')
    expect(classifyIcePath('relay', 'srflx')).toBe('relay')
  })

  it('only calls it direct when both ends are host candidates', () => {
    expect(classifyIcePath('host', 'host')).toBe('direct')
    expect(classifyIcePath('srflx', 'host')).toBe('reflexive')
  })

  it('reports unknown rather than guessing when a type is missing', () => {
    expect(classifyIcePath(null, null)).toBe('unknown')
    expect(classifyIcePath('host', null)).toBe('unknown')
  })
})

describe('readNetSample', () => {
  it('reads the nominated pair, not whichever pair came last', () => {
    // ICE leaves every pair it ever tried in the report, most of them
    // dead. Taking the last one is what the old one-shot measurement did.
    const s = readNetSample(
      report([
        pair({
          id: 'dead',
          nominated: false,
          state: 'failed',
          currentRoundTripTime: 0.9,
        }),
        pair({ id: 'live', nominated: true, currentRoundTripTime: 0.018 }),
        pair({
          id: 'dead2',
          nominated: false,
          state: 'failed',
          currentRoundTripTime: 1.2,
        }),
      ]),
    )
    expect(s.rttMs).toBeCloseTo(18, 5)
  })

  it('converts every second-valued stat to milliseconds', () => {
    const s = readNetSample(report([pair(), inbound()]))
    expect(s.rttMs).toBeCloseTo(24, 5)
    expect(s.jitterMs).toBeCloseTo(4, 5)
  })

  it('keeps the target delay as the cumulative sum it actually is', () => {
    // Read as a plain seconds value this renders as "12806400 ms" -- which
    // is what a real Chrome reported on a loopback connection holding a
    // 40 ms buffer. Every jitterBuffer*Delay stat in the spec is a running
    // sum over emitted samples; none of them mean anything on their own.
    const s = readNetSample(
      report([pair(), inbound({ jitterBufferTargetDelay: 38_400 })]),
    )
    expect(s.jitterBufferTargetSec).toBe(38_400)
  })

  it('resolves candidate types through the pair, not by position', () => {
    const s = readNetSample(
      report([
        pair(),
        { type: 'local-candidate', id: 'lc1', candidateType: 'srflx' },
        { type: 'remote-candidate', id: 'rc1', candidateType: 'relay' },
      ]),
    )
    expect(s.localCandidateType).toBe('srflx')
    expect(s.remoteCandidateType).toBe('relay')
    expect(s.path).toBe('relay')
  })

  it('names the codec from the mime type it was negotiated under', () => {
    const s = readNetSample(
      report([
        inbound(),
        {
          type: 'codec',
          id: 'codec1',
          mimeType: 'audio/opus',
          clockRate: 48000,
          channels: 1,
        },
      ]),
    )
    expect(s.codec).toBe('opus')
    expect(s.codecClockRate).toBe(48000)
    expect(s.codecChannels).toBe(1)
  })

  it('reads a missing stat as null, never as zero', () => {
    // Safari has historically omitted most of the inbound audio block.
    // Zero is a claim about the connection; null is the truth about the
    // measurement, and the panel renders the two very differently.
    const s = readNetSample(
      report([pair(), { type: 'inbound-rtp', kind: 'audio' }]),
    )
    expect(s.jitterMs).toBeNull()
    expect(s.jitterBufferDelaySec).toBeNull()
    expect(s.concealedSamples).toBeNull()
    expect(s.rttMs).toBeCloseTo(24, 5)
  })

  it('ignores video rtp entirely', () => {
    const s = readNetSample(
      report([inbound({ kind: 'video', jitter: 0.5 }), pair()]),
    )
    expect(s.jitterMs).toBeNull()
  })

  it('survives a report with nothing usable in it', () => {
    const s = readNetSample(report([{ type: 'transport' }]))
    expect(s.rttMs).toBeNull()
    expect(s.path).toBe('unknown')
  })
})

describe('deriveReading', () => {
  const base = readNetSample(report([pair(), inbound()]), 1000)

  it('computes the LIVE buffer depth from the deltas, not the totals', () => {
    // This is the whole reason the module exists. `jitterBufferDelay` is
    // a sum over emitted SAMPLES of how long each waited, so dividing the
    // totals gives the session average -- here 91 ms, and it barely moves
    // once a session is minutes old. Dividing the deltas says the buffer
    // is at 200 ms right now, which is the number a musician is feeling.
    const later = readNetSample(
      report([
        pair(),
        inbound({
          jitterBufferDelay: 48_000,
          jitterBufferEmittedCount: 528_000,
        }),
      ]),
      2000,
    )
    const r = deriveReading(later, base)
    expect(r.jitterBufferAvgMs).toBeCloseTo(90.9, 1)
    expect(r.jitterBufferMs).toBeCloseTo(200, 1)
  })

  it('derives the target the same way as the depth, so the two compare', () => {
    // Reading a settled buffer next to a climbing one is the whole use of
    // the target, and it only works if both come off the deltas.
    const later = readNetSample(
      report([
        pair(),
        inbound({
          jitterBufferEmittedCount: 528_000,
          // 48,000 more samples emitted, each targeting 120 ms.
          jitterBufferTargetDelay: 38_400 + 48_000 * 0.12,
        }),
      ]),
      2000,
    )
    expect(deriveReading(later, base).jitterBufferTargetMs).toBeCloseTo(120, 1)
  })

  it('reports no target on the first sample rather than the running sum', () => {
    expect(deriveReading(base, null).jitterBufferTargetMs).toBeNull()
  })

  it('reports every delta-derived figure as null on the first sample', () => {
    const r = deriveReading(base, null)
    expect(r.jitterBufferMs).toBeNull()
    expect(r.lossFraction).toBeNull()
    expect(r.inboundKbps).toBeNull()
    expect(r.concealedFraction).toBeNull()
    // The cumulative one is available immediately and is fine to show.
    expect(r.jitterBufferAvgMs).toBeCloseTo(80, 1)
  })

  it('refuses a negative delta rather than rendering a plausible rate', () => {
    // An ICE restart re-seeds every cumulative counter. Without this the
    // panel shows a large negative bitrate, or worse, a small positive
    // one after the counters pass their old values again.
    const afterRestart = readNetSample(
      report([
        pair(),
        inbound({ bytesReceived: 500, packetsReceived: 5, packetsLost: 0 }),
      ]),
      2000,
    )
    const r = deriveReading(afterRestart, base)
    expect(r.inboundKbps).toBeNull()
    expect(r.lossFraction).toBeNull()
  })

  it('computes loss as a share of what was expected over the interval', () => {
    const later = readNetSample(
      report([pair(), inbound({ packetsReceived: 1090, packetsLost: 20 })]),
      2000,
    )
    const r = deriveReading(later, base)
    // 10 lost, 90 received: 10% of the 100 expected in that second.
    expect(r.lossFraction).toBeCloseTo(0.1, 5)
  })

  it('computes inbound rate over the interval, in kbps', () => {
    const later = readNetSample(
      report([pair(), inbound({ bytesReceived: 108_000 })]),
      2000,
    )
    // 8000 bytes in one second = 64 kbps.
    expect(deriveReading(later, base).inboundKbps).toBeCloseTo(64, 5)
  })

  it('reports concealment as a share of emitted samples, not as an event count', () => {
    // Event count flatters a connection glitching constantly in short
    // runs. The share of audio that was invented is the honest number.
    const later = readNetSample(
      report([
        pair(),
        inbound({ concealedSamples: 7200, jitterBufferEmittedCount: 528_000 }),
      ]),
      2000,
    )
    const r = deriveReading(later, base)
    expect(r.concealedFraction).toBeCloseTo(2400 / 48_000, 5)
  })

  it('nets buffer growth against buffer shrink', () => {
    const later = readNetSample(
      report([
        pair(),
        inbound({
          insertedSamplesForDeceleration: 1440,
          removedSamplesForAcceleration: 600,
        }),
      ]),
      2000,
    )
    // +480 inserted, -120 removed: the buffer opened up by 360 samples.
    expect(deriveReading(later, base).netBufferAdjustmentSamples).toBe(360)
  })
})

describe('rollingStats', () => {
  it('reports the tail, which is what sizes a jitter buffer', () => {
    // A pair at 18 ms nine times out of ten and 90 ms the tenth plays
    // like 90. A mean of 25 would say it is fine.
    const values = [...Array(90).fill(18), ...Array(10).fill(90)]
    const s = rollingStats(values)!
    expect(s.p50).toBe(18)
    expect(s.p95).toBe(90)
    expect(s.max).toBe(90)
    expect(s.mean).toBeCloseTo(25.2, 1)
  })

  it('returns a value that actually occurred', () => {
    // Nearest-rank, not interpolated: an interpolated p99 can report a
    // number nobody measured, which is bad in a field someone is about
    // to paste into a test log.
    const s = rollingStats([10, 20, 30, 40])!
    expect([10, 20, 30, 40]).toContain(s.p99)
    expect([10, 20, 30, 40]).toContain(s.p95)
  })

  it('drops non-finite values instead of poisoning the whole window', () => {
    const s = rollingStats([10, Number.NaN, 20, Number.POSITIVE_INFINITY])!
    expect(s.count).toBe(2)
    expect(s.mean).toBe(15)
  })

  it('returns null for an empty window rather than zeroes', () => {
    expect(rollingStats([])).toBeNull()
    expect(rollingStats([Number.NaN])).toBeNull()
  })
})

describe('createRingBuffer', () => {
  it('stays bounded across a long session', () => {
    // This runs for as long as a jam does and nobody closes the panel.
    const ring = createRingBuffer(100)
    for (let i = 0; i < 10_000; i++) ring.push(i)
    expect(ring.values()).toHaveLength(100)
    expect(ring.values()[0]).toBe(9900)
  })

  it('rejects a non-finite push', () => {
    const ring = createRingBuffer(10)
    ring.push(Number.NaN)
    expect(ring.values()).toHaveLength(0)
  })
})

describe('sample shape', () => {
  it('keeps every field optional-safe for a serialised log', () => {
    // The panel's export writes these straight to JSON for a test log.
    const s: JamNetSample = readNetSample(report([]))
    expect(JSON.parse(JSON.stringify(s))).toMatchObject({ path: 'unknown' })
  })
})
