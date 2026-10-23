// ============================================================
// mic-latency-route tests
// ============================================================
//
// Synthetic recordings, as in mic-latency.test.ts: low noise with a 40 ms
// reply planted after each click of a run, at a level and a lag of the test's
// choosing. The cases are the ones the 0.8.41 device test and REQ-TV-096
// name: replies that fade after the first, round trips the phone's
// measurement refuses, and round trips longer than a click spacing.

import { describe, expect, it } from 'vitest'
import { LATENCY_CLICK_COUNT, LATENCY_LEAD_IN_SEC, MAX_ROUTE_LATENCY_MS, } from './mic-latency'
import { MAX_ROUTE_REPLY_SEC, measureRouteLatency, ROUTE_CLICK_GAPS_SEC, ROUTE_TAIL_SEC, routeClickSchedule, } from './mic-latency-route'

const SAMPLE_RATE = 48_000
const LOUD = 0.4

/** Deterministic low-level noise, so a run is reproducible. */
function noiseAt(index: number): number {
  const x = Math.sin(index * 12.9898) * 43758.5453
  return (x - Math.floor(x) - 0.5) * 0.002
}

interface Reply {
  at: number
  level: number
}

interface RunOptions {
  /** Each reply's level, click by click; 0 leaves a click unanswered. */
  levels?: readonly number[]
  /** Seconds added to each reply's lag, click by click. */
  jitter?: readonly number[]
  /** A room's decaying echo after every reply. */
  echo?: boolean
  /** Sounds that answer no click, seconds from the start. */
  stray?: readonly number[]
  /**
   * A sound that is not a click, planted just where each reply would be:
   * a voice (150 Hz and its harmonics) or a clap (a burst of noise).
   */
  impostor?: 'voice' | 'clap'
  rate?: number
}

/** A voice-like sound at `at`: 150 Hz and eleven harmonics, for 200 ms. */
function plantVoice(samples: Float32Array, rate: number, at: number) {
  const start = Math.round(at * rate)
  for (let n = 0; n < 0.2 * rate && start + n < samples.length; n++) {
    let value = 0
    for (let h = 1; h <= 12; h++) {
      value += Math.sin((2 * Math.PI * 150 * h * n) / rate) / h
    }
    samples[start + n] += LOUD * Math.min(1, n / (0.01 * rate)) * value * 0.5
  }
}

/** A clap at `at`: 30 ms of noise. */
function plantClap(samples: Float32Array, rate: number, at: number) {
  const start = Math.round(at * rate)
  for (let n = 0; n < 0.03 * rate && start + n < samples.length; n++) {
    samples[start + n] += LOUD * (noiseAt(n * 31 + 7) / 0.001)
  }
}

/** A 40 ms 1 kHz burst at `at`, and with `echo` 400 ms of decaying noise after it. */
function plant(
  samples: Float32Array,
  rate: number,
  reply: Reply,
  echo: boolean,
) {
  const start = Math.round(reply.at * rate)
  const burst = Math.round(0.04 * rate)
  for (let i = 0; i < burst && start + i < samples.length; i++) {
    samples[start + i] +=
      reply.level * Math.sin((2 * Math.PI * 1000 * i) / rate)
  }
  if (!echo) return
  const tail = Math.round(0.4 * rate)
  for (let i = 0; i < tail && start + burst + i < samples.length; i++) {
    const decay = Math.exp(-i / (0.08 * rate))
    samples[start + burst + i] +=
      reply.level * 0.25 * decay * (noiseAt(i * 7 + 13) / 0.001)
  }
}

const SCHEDULE = routeClickSchedule(LATENCY_LEAD_IN_SEC)
const LENGTH_SEC = SCHEDULE[SCHEDULE.length - 1] + ROUTE_TAIL_SEC

/** One run whose replies come `latencySec` after their clicks, measured. */
function run(latencySec: number, options: RunOptions = {}) {
  const rate = options.rate ?? SAMPLE_RATE
  const samples = new Float32Array(Math.round(LENGTH_SEC * rate))
  for (let i = 0; i < samples.length; i++) samples[i] = noiseAt(i)
  SCHEDULE.forEach((click, i) => {
    const level = options.levels?.[i] ?? LOUD
    const at = click + latencySec + (options.jitter?.[i] ?? 0)
    if (options.impostor === 'voice') plantVoice(samples, rate, at)
    if (options.impostor === 'clap') plantClap(samples, rate, at)
    if (level <= 0) return
    plant(samples, rate, { at, level }, options.echo === true)
  })
  for (const at of options.stray ?? []) {
    plant(samples, rate, { at, level: LOUD }, false)
  }
  return measureRouteLatency(samples, rate, SCHEDULE)
}

describe('the click schedule', () => {
  it('plays as many clicks as the phone’s run, from the first one on', () => {
    expect(SCHEDULE).toHaveLength(LATENCY_CLICK_COUNT)
    expect(SCHEDULE[0]).toBe(LATENCY_LEAD_IN_SEC)
    expect(ROUTE_TAIL_SEC).toBeGreaterThan(MAX_ROUTE_REPLY_SEC)
  })

  it('spaces them so no two gaps up to the longest reply are alike', () => {
    // A wrong lag lines up click i with click j's reply when their gap is the
    // difference between the lags; with every gap 0.1 s from every other, a
    // wrong lag can line up one click at most.
    const gaps: number[] = []
    SCHEDULE.forEach((a, i) => {
      for (const b of SCHEDULE.slice(i + 1)) {
        if (b - a <= MAX_ROUTE_REPLY_SEC + 0.1) gaps.push(b - a)
      }
    })
    gaps.sort((a, b) => a - b)
    for (let i = 1; i < gaps.length; i++) {
      expect(gaps[i] - gaps[i - 1]).toBeGreaterThanOrEqual(0.1 - 1e-9)
    }
    expect(new Set(ROUTE_CLICK_GAPS_SEC).size).toBe(ROUTE_CLICK_GAPS_SEC.length)
  })
})

describe('measureRouteLatency', () => {
  it('recovers a planted round trip from every click', () => {
    const result = run(0.3)

    expect(result.failure).toBeNull()
    expect(result.hits).toBe(LATENCY_CLICK_COUNT)
    expect(result.latencyMs).toBeGreaterThanOrEqual(298)
    expect(result.latencyMs).toBeLessThanOrEqual(303)
    expect(result.spreadMs).toBeLessThanOrEqual(2)
  })

  it('hears replies that come back quieter than the first, as the LG C2 played them', () => {
    // The phone's measurement matched 1 click of 8 here: everything after
    // the first sat under a quarter of the loudest.
    const fading = [LOUD, ...Array<number>(7).fill(LOUD / 5)]
    const fainter = [LOUD, ...Array<number>(7).fill(LOUD / 20)]

    for (const levels of [fading, fainter]) {
      const result = run(0.3, { levels })
      expect(result.failure).toBeNull()
      expect(result.hits).toBe(LATENCY_CLICK_COUNT)
      expect(result.latencyMs).toBeGreaterThanOrEqual(298)
      expect(result.latencyMs).toBeLessThanOrEqual(303)
    }
  })

  it('times a quiet reply where it times a loud one', () => {
    const mixed = SCHEDULE.map((_, i) => (i % 2 === 0 ? LOUD : LOUD / 10))

    expect(run(0.25, { levels: mixed }).spreadMs).toBeLessThanOrEqual(2)
  })

  it('keeps round trips the phone’s measurement refuses, up to a second', () => {
    // The phone looks no further than 375 ms and keeps nothing over 500.
    for (const latencySec of [0.45, 0.6, 0.95]) {
      const result = run(latencySec)
      expect(result.failure).toBeNull()
      expect(result.latencyMs).toBeGreaterThanOrEqual(latencySec * 1000 - 2)
      expect(result.latencyMs).toBeLessThanOrEqual(latencySec * 1000 + 3)
    }
  })

  it('names a round trip longer than a second rather than keeping it', () => {
    // With evenly spaced clicks, 1.6 s lined up with the click before last
    // and read as 100 ms from six clicks that agreed.
    for (const latencySec of [1.6, 2.0, 2.4]) {
      const result = run(latencySec)
      expect(result.failure).toBe('too-late')
      expect(result.latencyMs).toBeNull()
      expect(result.heardMs).toBeGreaterThanOrEqual(latencySec * 1000 - 2)
      expect(result.heardMs).toBeLessThanOrEqual(latencySec * 1000 + 3)
    }
    expect(MAX_ROUTE_LATENCY_MS).toBe(1000)
  })

  it('does not read a reply later than the longest looked for as a short one', () => {
    const result = run(2.8)

    expect(result.latencyMs).toBeNull()
    expect(result.failure).toBe('too-few-hits')
  })

  it('keeps its answer through a room’s echo after every reply', () => {
    const result = run(0.3, { echo: true })

    expect(result.failure).toBeNull()
    expect(result.latencyMs).toBeGreaterThanOrEqual(298)
    expect(result.latencyMs).toBeLessThanOrEqual(303)
  })

  it('takes the median of replies that wander a little', () => {
    const jitter = [0.012, -0.01, 0.004, -0.015, 0.008, 0, -0.006, 0.014]
    const result = run(0.32, { jitter })

    expect(result.failure).toBeNull()
    expect(result.hits).toBe(LATENCY_CLICK_COUNT)
    expect(result.latencyMs).toBeGreaterThanOrEqual(318)
    expect(result.latencyMs).toBeLessThanOrEqual(328)
  })

  it('ignores sounds that answer no click', () => {
    const stray = [0.4, 2.15, 3.62, 5.05, 6.9, 8.3]

    const answered = run(0.3, { stray })
    expect(answered.failure).toBeNull()
    expect(answered.latencyMs).toBeGreaterThanOrEqual(298)
    expect(answered.latencyMs).toBeLessThanOrEqual(303)

    const unanswered = run(0.3, { levels: Array<number>(8).fill(0), stray })
    expect(unanswered.latencyMs).toBeNull()
    expect(unanswered.failure).toBe('too-few-hits')
  })

  it('does not take a voice or a clap for the replies, even at just the right moments', () => {
    // Without the pitch test, eight sounds 300 ms after eight clicks would
    // agree on 300 ms. Only a sound mostly at the click's pitch is a reply.
    const silent = Array<number>(8).fill(0)
    for (const impostor of ['voice', 'clap'] as const) {
      expect(run(0.3, { levels: silent, impostor }).latencyMs).toBeNull()
    }
    // ...while a click's reply heard over the same voice still counts.
    const overVoice = run(0.3, { impostor: 'voice' })
    expect(overVoice.failure).toBeNull()
    expect(overVoice.latencyMs).toBeGreaterThanOrEqual(298)
    expect(overVoice.latencyMs).toBeLessThanOrEqual(303)
  })

  it('refuses a round trip only three clicks agree on', () => {
    const levels = [LOUD, 0, 0, LOUD, 0, 0, LOUD, 0]
    const result = run(0.3, { levels })

    expect(result.latencyMs).toBeNull()
    expect(result.failure).toBe('too-few-hits')
    expect(result.hits).toBe(3)
  })

  it('says nothing was heard in a recording of the room alone', () => {
    const result = run(0.3, { levels: Array<number>(8).fill(0) })

    expect(result).toEqual({
      latencyMs: null,
      spreadMs: null,
      hits: 0,
      failure: 'not-heard',
    })
    expect(
      measureRouteLatency(new Float32Array(0), SAMPLE_RATE, SCHEDULE).failure,
    ).toBe('not-heard')
  })

  it('measures the same at 44.1 kHz', () => {
    const result = run(0.3, { rate: 44_100 })

    expect(result.failure).toBeNull()
    expect(result.latencyMs).toBeGreaterThanOrEqual(298)
    expect(result.latencyMs).toBeLessThanOrEqual(303)
  })
})
