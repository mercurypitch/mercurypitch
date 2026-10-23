// ============================================================
// mic-latency-route — the round trip on a route with a delay of its own
// ============================================================
//
// Measures the round trip on a TV over AirPlay or HDMI, or on a Bluetooth
// speaker. Those play a click well behind the phone's own speaker, and three
// things in the phone's measurement (@/lib/mic-latency) fail there, each seen
// in the 0.8.41 device test or reproduced on synthetic recordings
// (REQ-TV-096):
//
//  - It holds every click to one threshold, a quarter of the loudest. A TV
//    that plays the first click loud and the rest quieter (its automatic
//    volume) leaves most of them under it.
//  - It looks for no reply later than 375 ms and keeps none over 500 ms, while
//    mirroring alone can take most of that.
//  - Its clicks are evenly spaced, so a round trip longer than the spacing
//    lines up with an earlier click and reads as a short one: 1.6 s read as
//    100 ms, from six clicks that agreed.
//
// So this one spaces its clicks unevenly, finds the lag that the most clicks
// have a reply at (looking up to 2.5 s, where no two gaps between clicks are
// alike, so a wrong lag gathers two clicks at most), and times each reply
// against a threshold of its own. Replies are found and timed in a narrow
// band around the click's pitch, and only sounds that are mostly that pitch
// count, so a voice, a knock or a clap in the room neither passes for a reply
// nor moves one. A round trip over a second is reported, not kept: it is too
// late to sing along with.
//
// Pure, like @/lib/mic-latency. The wizard (MicLatencyWizard.tsx) uses this
// on such a route and the phone's measurement everywhere else.
//
// Tests: src/lib/mic-latency-route.test.ts.

import { median, spreadMs } from './calibration-stats'
import type { LatencyFailure } from './mic-latency'
import { LATENCY_CLICK_HZ, MAX_ROUTE_LATENCY_MS, MIN_LATENCY_HITS, } from './mic-latency'

/**
 * Seconds from one click to the next, no two alike. Every gap between two
 * clicks up to 2.6 s apart differs from every other by 0.1 s or more, so a
 * wrong lag lines up with two clicks at most (`AGREE_SEC`).
 */
export const ROUTE_CLICK_GAPS_SEC: readonly number[] = [
  0.8, 1.1, 0.9, 0.7, 1.0, 1.3, 1.2,
]

/** The longest round trip looked for. */
export const MAX_ROUTE_REPLY_SEC = 2.5

/** Recording kept past the last click, so the longest reply is inside it. */
export const ROUTE_TAIL_SEC = MAX_ROUTE_REPLY_SEC + 0.25

/**
 * Replies within this of a lag agree on it. Two gaps between clicks fit in a
 * window this wide at most, so a wrong lag gathers two clicks at most.
 */
const AGREE_SEC = 0.05
/** The lags tried, this far apart. */
const LAG_STEP_SEC = 0.005
/**
 * A click's reply this near the agreed lag is its own, however it wandered:
 * another click's reply is 0.7 s away at least, the shortest gap.
 */
const OWN_REPLY_SEC = 0.25
/** Envelope window in samples: ~1.3 ms at 48 kHz, as in @/lib/mic-latency. */
const HOP_SAMPLES = 64
/** A reply starts where the envelope stands this many times over its last 20 ms... */
const RISE_RATIO = 4
const RISE_LOOKBACK_SEC = 0.02
/** ...and this many times over the room's floor. */
const NOISE_FACTOR = 4
/** Below this peak-to-floor ratio, nothing was heard at all. */
const MIN_PEAK_RATIO = 3
/**
 * Replies are found in a band around the click's pitch, about 100 Hz wide at
 * 1 kHz, where a voice or a fan in the room is far quieter than everywhere.
 */
const BAND_Q = 10
/**
 * ...and a start counts only where that band holds at least this share of the
 * level over its first 30 ms: the click's reply is a pure tone and holds
 * nearly all of it, while a voice, a knock or a clap holds little.
 */
const MIN_TONALITY = 0.5
const TONALITY_SEC = 0.03
/** One start per reply: ignore further rises for this long. */
const REFRACTORY_SEC = 0.2
/** A reply is timed where it reaches this fraction of its own peak... */
const REPLY_PEAK_FRACTION = 0.25
/** ...looked for over this long from its start. */
const REPLY_PEAK_SEC = 0.06

export type RouteLatencyFailure =
  | LatencyFailure
  /** Heard and agreed on, but later than a singer can follow. */
  | 'too-late'

export interface RouteLatencyResult {
  /** Round trip in whole ms, or null when the run failed. */
  latencyMs: number | null
  /** Interquartile spread in ms, null below two hits. */
  spreadMs: number | null
  /** How many clicks agreed on the round trip. */
  hits: number
  /** Set when `latencyMs` is null. */
  failure: RouteLatencyFailure | null
  /** For 'too-late': the round trip heard, in whole ms, which is not kept. */
  heardMs?: number
}

/** One click and a reply that could be its own. */
interface Pair {
  click: number
  /** Envelope window the reply starts in. */
  window: number
  /** Seconds from the click to the reply. */
  delta: number
}

/** The click times for one run, the first at `firstClickSec`. */
export function routeClickSchedule(firstClickSec: number): number[] {
  const times = [firstClickSec]
  for (const gap of ROUTE_CLICK_GAPS_SEC) {
    times.push(times[times.length - 1] + gap)
  }
  return times
}

/**
 * `samples` through a band-pass around the click's pitch (a biquad, the
 * Audio EQ Cookbook's, 0 dB at the centre). It rings up over a few
 * milliseconds, which `bandDelaySec` measures and the timing takes off.
 */
function bandPassed(samples: Float32Array, sampleRate: number): Float32Array {
  const w0 = (2 * Math.PI * LATENCY_CLICK_HZ) / sampleRate
  const alpha = Math.sin(w0) / (2 * BAND_Q)
  const a0 = 1 + alpha
  const b0 = alpha / a0
  const a1 = (-2 * Math.cos(w0)) / a0
  const a2 = (1 - alpha) / a0
  const out = new Float32Array(samples.length)
  let x1 = 0
  let x2 = 0
  let y1 = 0
  let y2 = 0
  for (let i = 0; i < samples.length; i++) {
    const x0 = samples[i]
    const y0 = b0 * (x0 - x2) - a1 * y1 - a2 * y2
    out[i] = y0
    x2 = x1
    x1 = x0
    y2 = y1
    y1 = y0
  }
  return out
}

/** Root-mean-square level of each window of `HOP_SAMPLES`. */
function envelopeOf(samples: Float32Array): Float32Array {
  const envelope = new Float32Array(Math.ceil(samples.length / HOP_SAMPLES))
  for (let w = 0; w < envelope.length; w++) {
    const start = w * HOP_SAMPLES
    const end = Math.min(start + HOP_SAMPLES, samples.length)
    let sum = 0
    for (let i = start; i < end; i++) sum += samples[i] * samples[i]
    envelope[w] = Math.sqrt(sum / (end - start))
  }
  return envelope
}

function lowestOf(envelope: Float32Array, from: number, to: number): number {
  let lowest = Number.POSITIVE_INFINITY
  for (let w = from; w < to; w++) lowest = Math.min(lowest, envelope[w])
  return lowest
}

function highestOf(envelope: Float32Array, from: number, to: number): number {
  let highest = 0
  for (let w = from; w < to; w++) highest = Math.max(highest, envelope[w])
  return highest
}

/**
 * Windows where something sharp starts: a rise over the last 20 ms, however
 * loud, so a quiet reply counts as much as a loud one, and a room's decaying
 * echo, which never rises, does not count at all.
 */
function riseStarts(
  envelope: Float32Array,
  floor: number,
  windowSec: number,
): number[] {
  const lookback = Math.max(2, Math.round(RISE_LOOKBACK_SEC / windowSec))
  const refractory = Math.max(1, Math.round(REFRACTORY_SEC / windowSec))
  const starts: number[] = []
  let blockedUntil = -1
  for (let w = lookback; w < envelope.length; w++) {
    const level = envelope[w]
    if (w <= blockedUntil || level <= 0 || level < floor * NOISE_FACTOR) {
      continue
    }
    if (level < RISE_RATIO * lowestOf(envelope, w - lookback, w)) continue
    starts.push(w)
    blockedUntil = w + refractory
  }
  return starts
}

/** Whether the band holds `MIN_TONALITY` of the level over a start's first 30 ms. */
function isTonal(
  band: Float32Array,
  full: Float32Array,
  start: number,
  windowSec: number,
): boolean {
  const end = Math.min(
    band.length,
    start + Math.max(1, Math.round(TONALITY_SEC / windowSec)),
  )
  let inBand = 0
  let all = 0
  for (let w = start; w < end; w++) {
    inBand += band[w] * band[w]
    all += full[w] * full[w]
  }
  return all > 0 && Math.sqrt(inBand / all) >= MIN_TONALITY
}

/** Every click paired with every start after it, up to the longest reply. */
function pairsOf(
  scheduledSec: readonly number[],
  starts: readonly number[],
  windowSec: number,
): Pair[] {
  const pairs: Pair[] = []
  scheduledSec.forEach((at, click) => {
    for (const window of starts) {
      const delta = window * windowSec - at
      if (delta > 0 && delta <= MAX_ROUTE_REPLY_SEC) {
        pairs.push({ click, window, delta })
      }
    }
  })
  return pairs.sort((a, b) => a.delta - b.delta)
}

/** Each click's reply nearest `lag`, within `within` of it; one per click. */
function repliesNear(
  pairs: readonly Pair[],
  lag: number,
  within: number,
): Pair[] {
  const nearest = new Map<number, Pair>()
  for (const pair of pairs) {
    const off = Math.abs(pair.delta - lag)
    const held = nearest.get(pair.click)
    if (off > within) continue
    if (held === undefined || off < Math.abs(held.delta - lag)) {
      nearest.set(pair.click, pair)
    }
  }
  return [...nearest.values()]
}

/**
 * The lag tried that the most clicks agree on, and how many do; with `away`,
 * only lags further than `OWN_REPLY_SEC` from it. The first of equals wins,
 * so a plateau is entered at its low edge, which the caller re-centres.
 */
function busiestLag(
  pairs: readonly Pair[],
  away: number | null,
): { lag: number; clicks: number } {
  let busiest = { lag: 0, clicks: 0 }
  for (let step = 0; step * LAG_STEP_SEC <= MAX_ROUTE_REPLY_SEC; step++) {
    const lag = step * LAG_STEP_SEC
    if (away !== null && Math.abs(lag - away) <= OWN_REPLY_SEC) continue
    const clicks = repliesNear(pairs, lag, AGREE_SEC).length
    if (clicks > busiest.clicks) busiest = { lag, clicks }
  }
  return busiest
}

/**
 * The round trip the most clicks agree on: each click's own reply near it,
 * how many agreed, and the most that any lag well away from it gathers. A
 * wrong lag gathers two at most from the replies alone, so a rival close to
 * the agreed count means the replies were too few, or too buried in noise,
 * to tell one lag from another.
 */
function agreedLag(pairs: readonly Pair[]): {
  replies: Pair[]
  agreed: number
  rival: number
} {
  const busiest = busiestLag(pairs, null)
  const centre = median(
    repliesNear(pairs, busiest.lag, AGREE_SEC).map((pair) => pair.delta),
  )
  if (centre === null) return { replies: [], agreed: 0, rival: 0 }
  return {
    replies: repliesNear(pairs, centre, OWN_REPLY_SEC),
    agreed: busiest.clicks,
    rival: busiestLag(pairs, centre).clicks,
  }
}

/**
 * Where a reply starts in the band, in envelope windows: where it first
 * reaches a quarter of its own peak. Each click is held to a threshold of its
 * own, so a quiet one is timed at the same point of its rise as a loud one,
 * and a voice in the room, mostly outside the band, does not move it.
 */
function replyStart(
  envelope: Float32Array,
  from: number,
  floor: number,
  windowSec: number,
): number {
  const end = Math.min(
    envelope.length,
    from + Math.max(1, Math.round(REPLY_PEAK_SEC / windowSec)),
  )
  const peak = highestOf(envelope, from, end)
  const threshold = Math.max(floor * NOISE_FACTOR, peak * REPLY_PEAK_FRACTION)
  let start = from
  while (start < end - 1 && envelope[start] < threshold) start++
  return start
}

/**
 * How much later than its true start the band times a click: the band-pass
 * rings up over a few milliseconds. Measured on the wizard's own click (a
 * 3 ms rise, then down to nothing at 40 ms), at each of eight places within
 * an envelope window, since a reply can start anywhere in one.
 */
function bandDelaySec(sampleRate: number): number {
  const lead = Math.round(0.02 * sampleRate)
  const rise = 0.003 * sampleRate
  const length = Math.round(0.04 * sampleRate)
  const windowSec = HOP_SAMPLES / sampleRate
  let total = 0
  const places = 8
  for (let place = 0; place < places; place++) {
    const at = lead + Math.round((place * HOP_SAMPLES) / places)
    const click = new Float32Array(at + length + lead)
    for (let i = 0; i < length; i++) {
      const gain = i < rise ? i / rise : 1 - (i - rise) / (length - rise)
      click[at + i] =
        gain * Math.sin((2 * Math.PI * LATENCY_CLICK_HZ * i) / sampleRate)
    }
    const band = envelopeOf(bandPassed(click, sampleRate))
    const first = Math.max(0, Math.floor(at / HOP_SAMPLES) - 1)
    total += replyStart(band, first, 0, windowSec) * windowSec - at / sampleRate
  }
  return total / places
}

/** The run's answer from the agreeing clicks' gaps. */
function summarise(deltasSec: number[]): RouteLatencyResult {
  const hits = deltasSec.length
  const spread = spreadMs(deltasSec)
  if (hits < MIN_LATENCY_HITS) {
    return { latencyMs: null, spreadMs: spread, hits, failure: 'too-few-hits' }
  }
  const mid = median(deltasSec)
  const ms = mid === null ? 0 : Math.round(mid * 1000)
  if (ms <= 0) {
    return { latencyMs: null, spreadMs: spread, hits, failure: 'out-of-range' }
  }
  if (ms > MAX_ROUTE_LATENCY_MS) {
    return {
      latencyMs: null,
      spreadMs: spread,
      hits,
      failure: 'too-late',
      heardMs: ms,
    }
  }
  return { latencyMs: ms, spreadMs: spread, hits, failure: null }
}

/**
 * One run's round trip on a route with a delay of its own, from the recording
 * and the click times on its own timeline (seconds from its first sample).
 */
export function measureRouteLatency(
  samples: Float32Array,
  sampleRate: number,
  scheduledSec: readonly number[],
): RouteLatencyResult {
  const unheard: RouteLatencyResult = {
    latencyMs: null,
    spreadMs: null,
    hits: 0,
    failure: 'not-heard',
  }
  if (samples.length === 0 || sampleRate <= 0) return unheard

  const band = envelopeOf(bandPassed(samples, sampleRate))
  const full = envelopeOf(samples)
  const windowSec = HOP_SAMPLES / sampleRate
  // The recording is mostly silence between clicks, so its median is the floor.
  const floor = median(Array.from(band)) ?? 0
  const peak = highestOf(band, 0, band.length)
  if (peak <= 0 || (floor > 0 && peak < floor * MIN_PEAK_RATIO)) {
    return unheard
  }
  const starts = riseStarts(band, floor, windowSec).filter((start) =>
    isTonal(band, full, start, windowSec),
  )
  if (starts.length === 0) return unheard

  const { replies, agreed, rival } = agreedLag(
    pairsOf(scheduledSec, starts, windowSec),
  )
  if (rival >= agreed - 1) {
    // Too few replies to tell the lag from another, however many agree.
    return {
      latencyMs: null,
      spreadMs: null,
      hits: agreed,
      failure: 'too-few-hits',
    }
  }
  const delaySec = bandDelaySec(sampleRate)
  return summarise(
    replies.map(
      (pair) =>
        replyStart(band, pair.window, floor, windowSec) * windowSec -
        delaySec -
        scheduledSec[pair.click],
    ),
  )
}
