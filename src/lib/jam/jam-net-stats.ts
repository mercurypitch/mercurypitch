// ── Jam network stats ────────────────────────────────────────────────
// One RTCStatsReport, reduced to the numbers that decide whether two
// people can play together.
//
// Pure on purpose. `getStats()` needs a live browser and a real peer, so
// nothing here touches an RTCPeerConnection: a caller hands in the report
// it already has, and everything below is arithmetic over plain objects.
// That is what makes the jitter-buffer maths testable at all -- it is the
// part most likely to be wrong, and the part nobody can eyeball on a
// phone in another country.
//
// THE ONE THING TO UNDERSTAND. Most of WebRTC's audio stats are
// CUMULATIVE counters over the life of the connection, not instantaneous
// readings. `jitterBufferDelay` is a running sum of seconds, and it is
// only meaningful when divided by `jitterBufferEmittedCount`, the running
// count of samples that came out of that buffer. Divide the totals and
// you get the session AVERAGE, which stops moving after a few minutes and
// will happily report 40 ms while the room is currently sitting at 200.
// Divide the DELTAS between two samples and you get what the buffer is
// doing right now. Both are here; the panel shows the second one, because
// the first is what makes people think the problem went away.
//
// Tests: src/tests/jam-net-stats.test.ts.

/** How a pair's media is actually reaching the other side. */
export type JamIcePath = 'direct' | 'reflexive' | 'relay' | 'unknown'

/**
 * One reading, already reduced from a full report.
 *
 * Every field is nullable because every field is optional in some browser:
 * Safari has historically omitted most of the inbound-rtp audio block, and
 * a stat that is missing must read as "not measured" rather than as zero.
 * Zero is a claim; null is the truth.
 */
export interface JamNetSample {
  /** `Date.now()` at the moment the report was taken. */
  at: number
  /** ICE round trip in ms, from the candidate pair actually in use. */
  rttMs: number | null
  path: JamIcePath
  /** Raw candidate types, for when `path` is not specific enough. */
  localCandidateType: string | null
  remoteCandidateType: string | null
  /** Interarrival jitter on the inbound audio, in ms (RFC 3550 J). */
  jitterMs: number | null
  packetsReceived: number | null
  packetsLost: number | null
  /** Cumulative seconds; only meaningful over `jitterBufferEmittedCount`. */
  jitterBufferDelaySec: number | null
  jitterBufferEmittedCount: number | null
  /**
   * What the receiver is AIMING for. Cumulative seconds, exactly like
   * `jitterBufferDelaySec` -- NOT an instantaneous target.
   *
   * This one cost a bug: read as a plain seconds value it renders as
   * "12806400 ms", which is 12,806 s of accumulated target over ~320,000
   * emitted samples, i.e. the 40 ms the buffer was actually holding. Every
   * `jitterBuffer*Delay` stat in the spec is a running sum over emitted
   * samples and none of them mean anything on their own.
   */
  jitterBufferTargetSec: number | null
  /** Samples invented by packet-loss concealment. Cumulative. */
  concealedSamples: number | null
  /** Distinct concealment runs. Cumulative. Audible as a glitch each. */
  concealmentEvents: number | null
  /** Samples removed to shrink the buffer -- the sound of catching up. */
  removedSamplesForAcceleration: number | null
  /** Samples added to grow it -- the sound of the buffer opening up. */
  insertedSamplesForDeceleration: number | null
  bytesReceived: number | null
  bytesSent: number | null
  /** e.g. 'opus'. Names the codec actually negotiated, not the one asked for. */
  codec: string | null
  /** Negotiated clock rate, which is not always 48000. */
  codecClockRate: number | null
  /** Opus channel count as negotiated -- 1 or 2 changes the bitrate maths. */
  codecChannels: number | null
  /** `a=ptime` in effect, where the browser reports it. */
  packetizationMs: number | null
}

/** Everything the panel shows for one peer, derived from two samples. */
export interface JamNetReading {
  latest: JamNetSample
  /**
   * Jitter buffer depth RIGHT NOW, in ms: the delta of accumulated delay
   * over the delta of emitted samples. Null until there are two samples
   * with movement between them.
   */
  jitterBufferMs: number | null
  /** Session-average buffer depth, for contrast with the instantaneous one. */
  jitterBufferAvgMs: number | null
  /**
   * The target NetEq is steering towards right now, in ms.
   *
   * Derived from the deltas for the same reason the depth is: the raw stat
   * is a running sum. Reading this next to `jitterBufferMs` is how you tell
   * a buffer that has settled from one still climbing.
   */
  jitterBufferTargetMs: number | null
  /** Loss over the interval, as a fraction of what was expected. */
  lossFraction: number | null
  /** Inbound audio payload rate over the interval. */
  inboundKbps: number | null
  outboundKbps: number | null
  /**
   * Concealment over the interval, as a fraction of samples emitted.
   *
   * The honest dropout number. `concealmentEvents` counts runs, which
   * flatters a connection glitching constantly in short bursts; this is
   * the share of the audio that was invented rather than received.
   */
  concealedFraction: number | null
  /** Buffer growth over the interval, in samples. Negative means shrinking. */
  netBufferAdjustmentSamples: number | null
  /** Inbound audio packets per second over the interval. */
  packetsPerSecond: number | null
  /**
   * The frame size actually in use, in ms, derived from the packet rate.
   *
   * The only honest way to see this. `packetizationMs` is absent in every
   * browser that matters and the codec stat's `ptime` is usually absent
   * too, so a panel that wants to show whether an SDP request for 10 ms
   * frames was HONOURED has to count packets: 50/s is 20 ms, 100/s is
   * 10 ms. Rounded to the frame sizes Opus actually has, because a rate
   * measured over one second is never exactly 100.
   */
  frameMs: number | null
}

interface StatsLike {
  forEach(cb: (report: Record<string, unknown>) => void): void
}

const num = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? v : null

const str = (v: unknown): string | null =>
  typeof v === 'string' && v !== '' ? v : null

/**
 * Which candidate type wins when the two ends disagree.
 *
 * A pair is relayed if EITHER end is a relay candidate -- TURN on one side
 * is enough to put the packets through the relay, and reading only the
 * local end is how a room quietly on TURN reports itself as direct.
 */
export function classifyIcePath(
  local: string | null,
  remote: string | null,
): JamIcePath {
  if (local === null && remote === null) return 'unknown'
  if (local === 'relay' || remote === 'relay') return 'relay'
  if (local === 'host' && remote === 'host') return 'direct'
  if (local === null || remote === null) return 'unknown'
  return 'reflexive'
}

/**
 * The best guess at the live pair when the transport did not name one.
 *
 * Scored nominated > succeeded > "has a round trip at all", and ties
 * broken on the most recently received packet. The tie-break is the point:
 * a strict `>` over the first match keeps whichever pair the browser
 * happened to enumerate first, and after a re-nomination that is typically
 * the superseded one.
 */
function bestCandidatePair(
  pairs: ReadonlyMap<string, Record<string, unknown>>,
): Record<string, unknown> | null {
  let best: Record<string, unknown> | null = null
  let bestScore = 0
  let bestSeen = -Infinity
  for (const report of pairs.values()) {
    const score =
      report.nominated === true || report.selected === true
        ? 3
        : report.state === 'succeeded'
          ? 2
          : num(report.currentRoundTripTime) !== null
            ? 1
            : 0
    if (score === 0) continue
    const seen = num(report.lastPacketReceivedTimestamp) ?? -Infinity
    if (score > bestScore || (score === bestScore && seen > bestSeen)) {
      best = report
      bestScore = score
      bestSeen = seen
    }
  }
  return best
}

/**
 * Reduce a live report to one sample.
 *
 * Picking the pair is the whole job. Taking the last one in iteration
 * order -- which is what the old one-shot measurement did -- picks an
 * arbitrary member of a set that includes every pair ICE ever tried, most
 * of them dead.
 *
 * `transport.selectedCandidatePairId` is the browser naming the pair in
 * use, and it is the only unambiguous answer available. `nominated` is
 * not: after an ICE restart the superseded pair can still carry the flag
 * alongside the new one, so a room that just failed over to TURN would go
 * on reporting the old pair's round trip and a "direct" path for the rest
 * of the session -- and jam-store halves that number to place every
 * peer's playhead. Where the transport does not say, the scoring below
 * falls back to freshness rather than to iteration order.
 */
export function readNetSample(
  stats: StatsLike,
  now: number = Date.now(),
): JamNetSample {
  const candidates = new Map<string, Record<string, unknown>>()
  const codecs = new Map<string, Record<string, unknown>>()
  const pairs = new Map<string, Record<string, unknown>>()
  let selectedPairId: string | null = null
  let pair: Record<string, unknown> | null = null
  let inbound: Record<string, unknown> | null = null
  let outbound: Record<string, unknown> | null = null

  stats.forEach((report) => {
    switch (report.type) {
      case 'local-candidate':
      case 'remote-candidate': {
        const id = str(report.id)
        if (id !== null) candidates.set(id, report)
        return
      }
      case 'codec': {
        const id = str(report.id)
        if (id !== null) codecs.set(id, report)
        return
      }
      case 'transport': {
        // Chrome and Firefox both publish this; Safari sometimes does not.
        // Kept for the resolution after the walk, because report order is
        // not specified and the transport can arrive after its pairs.
        const sel = str(report.selectedCandidatePairId)
        if (sel !== null && sel !== '') selectedPairId = sel
        return
      }
      case 'candidate-pair': {
        const id = str(report.id)
        if (id !== null) pairs.set(id, report)
        // Some browsers mark the live pair on the pair itself instead.
        if (report.selected === true) selectedPairId ??= id
        return
      }
      case 'inbound-rtp': {
        if (report.kind === 'audio' || report.mediaType === 'audio') {
          inbound = report
        }
        return
      }
      case 'outbound-rtp': {
        if (report.kind === 'audio' || report.mediaType === 'audio') {
          outbound = report
        }
        return
      }
      default:
    }
  })

  pair =
    (selectedPairId === null ? null : (pairs.get(selectedPairId) ?? null)) ??
    bestCandidatePair(pairs)

  // TypeScript narrows these to `never` through the forEach closure; the
  // assignments above are real, so re-widen rather than restructure.
  const p = pair as Record<string, unknown> | null
  const inb = inbound as Record<string, unknown> | null
  const outb = outbound as Record<string, unknown> | null

  const localType =
    p === null
      ? null
      : str(candidates.get(str(p.localCandidateId) ?? '')?.candidateType)
  const remoteType =
    p === null
      ? null
      : str(candidates.get(str(p.remoteCandidateId) ?? '')?.candidateType)

  const codec =
    inb === null ? null : (codecs.get(str(inb.codecId) ?? '') ?? null)
  const mime = str(codec?.mimeType)

  return {
    at: now,
    rttMs: p === null ? null : msFromSeconds(num(p.currentRoundTripTime)),
    path: classifyIcePath(localType, remoteType),
    localCandidateType: localType,
    remoteCandidateType: remoteType,
    jitterMs: inb === null ? null : msFromSeconds(num(inb.jitter)),
    packetsReceived: inb === null ? null : num(inb.packetsReceived),
    packetsLost: inb === null ? null : num(inb.packetsLost),
    jitterBufferDelaySec: inb === null ? null : num(inb.jitterBufferDelay),
    jitterBufferEmittedCount:
      inb === null ? null : num(inb.jitterBufferEmittedCount),
    jitterBufferTargetSec:
      inb === null ? null : num(inb.jitterBufferTargetDelay),
    concealedSamples: inb === null ? null : num(inb.concealedSamples),
    concealmentEvents: inb === null ? null : num(inb.concealmentEvents),
    removedSamplesForAcceleration:
      inb === null ? null : num(inb.removedSamplesForAcceleration),
    insertedSamplesForDeceleration:
      inb === null ? null : num(inb.insertedSamplesForDeceleration),
    bytesReceived: inb === null ? null : num(inb.bytesReceived),
    bytesSent: outb === null ? null : num(outb.bytesSent),
    codec: mime === null ? null : (mime.split('/')[1] ?? mime),
    codecClockRate: num(codec?.clockRate),
    codecChannels: num(codec?.channels),
    packetizationMs: num(inb?.packetizationMs ?? codec?.ptime),
  }
}

function msFromSeconds(v: number | null): number | null {
  return v === null ? null : v * 1000
}

/**
 * Turn two consecutive samples into what the panel shows.
 *
 * `previous` may be null on the first reading; everything derived from a
 * delta then reads null rather than borrowing the cumulative figure, which
 * would silently show a session average labelled as a live one.
 */
export function deriveReading(
  latest: JamNetSample,
  previous: JamNetSample | null,
): JamNetReading {
  const dt = previous === null ? 0 : (latest.at - previous.at) / 1000

  const pps = rateOver(
    delta(latest.packetsReceived, previous?.packetsReceived),
    dt,
  )

  const emittedDelta = delta(
    latest.jitterBufferEmittedCount,
    previous?.jitterBufferEmittedCount,
  )
  const delayDelta = delta(
    latest.jitterBufferDelaySec,
    previous?.jitterBufferDelaySec,
  )

  return {
    latest,
    jitterBufferMs:
      emittedDelta !== null && delayDelta !== null && emittedDelta > 0
        ? (delayDelta / emittedDelta) * 1000
        : null,
    jitterBufferAvgMs:
      latest.jitterBufferDelaySec !== null &&
      latest.jitterBufferEmittedCount !== null &&
      latest.jitterBufferEmittedCount > 0
        ? (latest.jitterBufferDelaySec / latest.jitterBufferEmittedCount) * 1000
        : null,
    jitterBufferTargetMs:
      emittedDelta !== null && emittedDelta > 0
        ? nullableDiv(
            delta(
              latest.jitterBufferTargetSec,
              previous?.jitterBufferTargetSec,
            ),
            emittedDelta / 1000,
          )
        : null,
    lossFraction: lossOver(latest, previous),
    inboundKbps: rateKbps(
      delta(latest.bytesReceived, previous?.bytesReceived),
      dt,
    ),
    outboundKbps: rateKbps(delta(latest.bytesSent, previous?.bytesSent), dt),
    concealedFraction:
      emittedDelta !== null && emittedDelta > 0
        ? nullableDiv(
            delta(latest.concealedSamples, previous?.concealedSamples),
            emittedDelta,
          )
        : null,
    packetsPerSecond: pps,
    frameMs: nearestOpusFrameMs(pps),
    netBufferAdjustmentSamples: sumOrNull(
      delta(
        latest.insertedSamplesForDeceleration,
        previous?.insertedSamplesForDeceleration,
      ),
      negate(
        delta(
          latest.removedSamplesForAcceleration,
          previous?.removedSamplesForAcceleration,
        ),
      ),
    ),
  }
}

function delta(
  now: number | null,
  before: number | null | undefined,
): number | null {
  if (now === null || before === null || before === undefined) return null
  const d = now - before
  // A counter that went backwards means the connection was rebuilt (an ICE
  // restart re-seeds every cumulative stat). Report "no reading" rather
  // than a negative rate, which would render as a plausible-looking number.
  return d < 0 ? null : d
}

function negate(v: number | null): number | null {
  return v === null ? null : -v
}

function sumOrNull(a: number | null, b: number | null): number | null {
  return a === null || b === null ? null : a + b
}

function nullableDiv(a: number | null, b: number): number | null {
  return a === null ? null : a / b
}

function rateOver(count: number | null, seconds: number): number | null {
  if (count === null || seconds <= 0) return null
  return count / seconds
}

/**
 * Snap a measured packet rate to the frame size that produced it.
 *
 * Opus has 2.5, 5, 10, 20, 40 and 60 ms frames and nothing between, so the
 * nearest of those to 1000/pps is the answer. Null below a floor: a stream
 * that has just started, or one being throttled, produces a rate that means
 * nothing and would render as a confident wrong number.
 */
export function nearestOpusFrameMs(pps: number | null): number | null {
  if (pps === null || pps < 5) return null
  const measured = 1000 / pps
  const sizes = [2.5, 5, 10, 20, 40, 60]
  let best = sizes[0]!
  for (const size of sizes) {
    if (Math.abs(size - measured) < Math.abs(best - measured)) best = size
  }
  // Beyond Opus's own range the rate is not a frame size at all.
  return measured > 90 ? null : best
}

function rateKbps(bytes: number | null, seconds: number): number | null {
  if (bytes === null || seconds <= 0) return null
  return (bytes * 8) / seconds / 1000
}

function lossOver(
  latest: JamNetSample,
  previous: JamNetSample | null,
): number | null {
  const lost = delta(latest.packetsLost, previous?.packetsLost)
  const got = delta(latest.packetsReceived, previous?.packetsReceived)
  if (lost === null || got === null) return null
  const expected = lost + got
  return expected > 0 ? lost / expected : 0
}

// ── Rolling window ───────────────────────────────────────────────────
// A mean hides exactly the thing that matters. The jitter buffer is sized
// by the TAIL of the delay distribution, so a pair whose RTT is 18 ms
// nine times out of ten and 90 ms the tenth time plays like 90, not like
// 25. Percentiles are the whole point of keeping a window at all.

export interface JamRollingStats {
  count: number
  min: number
  p50: number
  p95: number
  p99: number
  max: number
  mean: number
  /** Population standard deviation -- a one-number read on how ragged it is. */
  stdDev: number
}

/**
 * Percentiles by nearest-rank over a sorted copy.
 *
 * Nearest-rank rather than interpolated: with a window of a few hundred
 * samples the difference is noise, and an interpolated p99 can report a
 * value that never actually occurred, which is a bad property for a number
 * someone is about to paste into a test log.
 */
export function rollingStats(
  values: readonly number[],
): JamRollingStats | null {
  const clean = values.filter((v) => Number.isFinite(v))
  if (clean.length === 0) return null
  const sorted = [...clean].sort((a, b) => a - b)
  const mean = clean.reduce((a, b) => a + b, 0) / clean.length
  const variance =
    clean.reduce((acc, v) => acc + (v - mean) * (v - mean), 0) / clean.length
  return {
    count: clean.length,
    min: sorted[0]!,
    p50: nearestRank(sorted, 0.5),
    p95: nearestRank(sorted, 0.95),
    p99: nearestRank(sorted, 0.99),
    max: sorted[sorted.length - 1]!,
    mean,
    stdDev: Math.sqrt(variance),
  }
}

function nearestRank(sorted: readonly number[], q: number): number {
  const rank = Math.ceil(q * sorted.length)
  const idx = Math.min(Math.max(rank - 1, 0), sorted.length - 1)
  return sorted[idx]!
}

/**
 * A bounded ring of recent values.
 *
 * Bounded because this runs for as long as a jam does and nobody is going
 * to close the panel; an unbounded array is a leak with a graph on it.
 */
export function createRingBuffer(capacity: number) {
  const values: number[] = []
  // `stats()` sorts the whole window and walks it three more times, and
  // the sampler asks three buffers per peer per second. At a 600-sample
  // window on a mesh that is tens of sorts a second on the same main
  // thread as the pitch detector -- on the phone under test, which is the
  // device the panel exists to measure. The window only changes on push,
  // so the answer only has to be computed then.
  let cached: JamRollingStats | null = null
  let fresh = false
  return {
    push(v: number): void {
      if (!Number.isFinite(v)) return
      values.push(v)
      if (values.length > capacity) values.splice(0, values.length - capacity)
      fresh = false
    },
    values(): readonly number[] {
      return values
    },
    stats(): JamRollingStats | null {
      if (!fresh) {
        cached = rollingStats(values)
        fresh = true
      }
      return cached
    },
    clear(): void {
      values.length = 0
      fresh = false
    },
  }
}
