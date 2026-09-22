// ── Jam latency budget tests ─────────────────────────────────────────
// The budget exists to stop the ping being mistaken for the latency, so
// the cases that matter are the ones where the total and the ping
// disagree, and the ones where a term is unmeasured and the total must
// not quietly pretend otherwise.

import { describe, expect, it } from 'vitest'
import { BLUETOOTH_PLAYOUT_MS, buildLatencyBudget, FIBRE_KM_PER_MS, overheadMs, theoreticalRttMs, verdictFor, } from '@/lib/jam/jam-latency-budget'

const termFor = (budget: ReturnType<typeof buildLatencyBudget>, id: string) =>
  budget.terms.find((t) => t.id === id)

describe('buildLatencyBudget', () => {
  it('puts the total far above the ping for a same-city pair', () => {
    // The point of the whole module. 12 ms of round trip is 6 ms one way,
    // and the pair still cannot play together comfortably because Opus
    // framing, capture and playout add three times that before the
    // network is involved at all.
    const b = buildLatencyBudget({
      rttMs: 12,
      jitterBufferMs: 40,
      deviceRoundTripMs: null,
    })
    expect(termFor(b, 'network')!.ms).toBe(6)
    expect(b.totalMs).toBeGreaterThan(60)
    expect(b.verdict).toBe('not-together')
  })

  it('uses a measured device round trip INSTEAD of the capture and playout guesses', () => {
    // Counting both would charge the same OS buffers twice, which is how
    // a budget starts reading worse than reality and gets ignored.
    const measured = buildLatencyBudget({
      rttMs: 20,
      jitterBufferMs: 30,
      deviceRoundTripMs: 18,
    })
    expect(termFor(measured, 'device')!.source).toBe('measured')
    expect(termFor(measured, 'capture')).toBeUndefined()
    expect(termFor(measured, 'playout')).toBeUndefined()
  })

  it('falls back to platform constants when the device was never calibrated', () => {
    const guessed = buildLatencyBudget({
      rttMs: 20,
      jitterBufferMs: 30,
      deviceRoundTripMs: null,
    })
    expect(termFor(guessed, 'device')).toBeUndefined()
    expect(termFor(guessed, 'capture')!.source).toBe('platform')
    expect(termFor(guessed, 'playout')!.source).toBe('platform')
  })

  it('marks the budget partial and excludes the term when the network is unmeasured', () => {
    // A room that has not connected yet must not read as 0 ms of network
    // and therefore as the best connection anyone ever had.
    const b = buildLatencyBudget({
      rttMs: null,
      jitterBufferMs: null,
      deviceRoundTripMs: null,
    })
    expect(b.partial).toBe(true)
    expect(termFor(b, 'network')!.ms).toBeNull()
    expect(termFor(b, 'network')!.source).toBe('unknown')
    // The total is a floor over the terms that do have numbers.
    expect(b.totalMs).toBe(42.5)
  })

  it('adds Bluetooth only when told to, and it dominates when it is there', () => {
    const wired = buildLatencyBudget({
      rttMs: 20,
      jitterBufferMs: 30,
      deviceRoundTripMs: null,
    })
    const bt = buildLatencyBudget({
      rttMs: 20,
      jitterBufferMs: 30,
      deviceRoundTripMs: null,
      bluetoothOutput: true,
    })
    expect(termFor(wired, 'bluetooth')).toBeUndefined()
    expect(bt.totalMs - wired.totalMs).toBe(BLUETOOTH_PLAYOUT_MS)
    // Larger than every other term put together, which is the advice.
    expect(BLUETOOTH_PLAYOUT_MS).toBeGreaterThan(wired.totalMs)
  })

  it('charges the jitter buffer in full, because the listener waits all of it', () => {
    const small = buildLatencyBudget({
      rttMs: 20,
      jitterBufferMs: 20,
      deviceRoundTripMs: 10,
    })
    const large = buildLatencyBudget({
      rttMs: 20,
      jitterBufferMs: 120,
      deviceRoundTripMs: 10,
    })
    expect(large.totalMs - small.totalMs).toBe(100)
  })
})

describe('the Opus term', () => {
  it('charges the measured frame size when the packet rate gave one', () => {
    // A constant here cannot show whether asking for 10 ms frames worked,
    // which is the one thing this term most needs to show.
    const at20 = buildLatencyBudget({
      rttMs: 20,
      jitterBufferMs: 30,
      deviceRoundTripMs: 10,
      frameMs: 20,
    })
    const at10 = buildLatencyBudget({
      rttMs: 20,
      jitterBufferMs: 30,
      deviceRoundTripMs: 10,
      frameMs: 10,
    })
    expect(termFor(at20, 'encode')!.ms).toBe(22.5)
    expect(termFor(at10, 'encode')!.ms).toBe(12.5)
    expect(termFor(at10, 'encode')!.source).toBe('measured')
    expect(at20.totalMs - at10.totalMs).toBe(10)
  })

  it('falls back to the 20 ms default and says it is a platform guess', () => {
    const b = buildLatencyBudget({
      rttMs: 20,
      jitterBufferMs: 30,
      deviceRoundTripMs: 10,
    })
    expect(termFor(b, 'encode')!.ms).toBe(22.5)
    expect(termFor(b, 'encode')!.source).toBe('platform')
  })
})

describe('verdictFor', () => {
  it('draws the line where players actually stop noticing', () => {
    expect(verdictFor(8)).toBe('transparent')
    expect(verdictFor(20)).toBe('comfortable')
    expect(verdictFor(30)).toBe('playable')
    expect(verdictFor(45)).toBe('hard')
    expect(verdictFor(80)).toBe('not-together')
  })

  it('is exclusive at each boundary so no total lands in two bands', () => {
    expect(verdictFor(10)).toBe('comfortable')
    expect(verdictFor(25)).toBe('playable')
    expect(verdictFor(35)).toBe('hard')
    expect(verdictFor(50)).toBe('hard')
    expect(verdictFor(50.1)).toBe('not-together')
  })
})

describe('physics', () => {
  it('agrees with light in fibre', () => {
    // 200 km of fibre is 1 ms one way before any stretch factor.
    expect(theoreticalRttMs(FIBRE_KM_PER_MS, 1)).toBeCloseTo(2, 5)
  })

  it('puts a transatlantic pair at the floor everyone measures', () => {
    // London to New York is ~5,570 km great circle. With the usual 1.6x
    // routing stretch that is ~89 ms, and measured London-NY RTT sits in
    // the 70-80 ms range on good paths -- so the model is the right
    // order and slightly pessimistic, which is the safe direction.
    expect(theoreticalRttMs(5570)).toBeCloseTo(89.1, 1)
  })

  it('separates the part of a measurement that is addressable from the part that is not', () => {
    // Zagreb to Vienna is ~270 km: 4.3 ms of physics. A measured 28 ms
    // means 24 ms of access network, queueing and Wi-Fi -- and that is
    // the part worth working on.
    expect(theoreticalRttMs(270)).toBeCloseTo(4.32, 2)
    expect(overheadMs(28, 270)).toBeCloseTo(23.68, 2)
  })

  it('reports a negative overhead rather than clamping it', () => {
    // A measurement under the model means the stretch factor was too
    // pessimistic for that pair, which is worth seeing, not hiding.
    expect(overheadMs(2, 270)).toBeLessThan(0)
  })
})
