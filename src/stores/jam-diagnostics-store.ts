// ── Jam diagnostics store ────────────────────────────────────────────
// The numbers behind the Jam network panel, and the loop that collects
// them.
//
// Its own store rather than more of jam-store.ts, which is already one of
// the oversized files in the tree (see docs/agent/REFACTOR-PLAN.md), and
// because this is genuinely separate state: nothing in the room reads it,
// and the room works identically with the sampler never started.
//
// COST. The sampler is OFF by default and only runs while somebody is
// looking. `getStats()` is not free -- it walks every stats object on
// every peer connection, which on a mesh of 12 is 11 connections a tick --
// and a diagnostics surface that slows down the thing it measures is
// worse than no diagnostics surface. The enable flag is persisted so a
// phone under test keeps it across the reloads a test session involves.
//
// Tests: src/tests/jam-diagnostics-store.test.ts.

import { createSignal } from 'solid-js'
import type { JamNetReading, JamNetSample } from '@/lib/jam/jam-net-stats'
import type { JamRollingStats } from '@/lib/jam/jam-net-stats'
import { createRingBuffer, deriveReading, readNetSample, } from '@/lib/jam/jam-net-stats'
import { createPersistedSignal } from '@/lib/storage'

/** How often a sample is taken while the panel is open. */
export const SAMPLE_INTERVAL_MS = 1000

/**
 * How long a DataChannel ping stays worth believing.
 *
 * A ping goes out every round, so an answer older than a few rounds means
 * the channel stopped answering -- closed, or its pongs dropped. Reporting
 * the last successful value forever is the worst shape of wrong for a
 * diagnostics panel: the budget prefers the ping over the ICE round trip,
 * so a pair whose path degraded from 20 ms to 300 ms would keep showing
 * the old number and a green verdict, with the truth visible in the RTT
 * row directly below it.
 */
export const PING_STALE_MS = 5 * SAMPLE_INTERVAL_MS

/**
 * ~10 minutes of history at one sample a second.
 *
 * Long enough that a p99 means something and that a test run fits inside
 * it whole; short enough that the export is a paste, not a download.
 */
export const HISTORY_CAPACITY = 600

export interface JamPeerDiagnostics {
  peerId: string
  reading: JamNetReading
  /** Application-level round trip, from the DataChannel ping. */
  channelPingMs: number | null
  /** Distribution of the ICE round trip over the window. */
  rttStats: JamRollingStats | null
  /** Distribution of the live jitter-buffer depth over the window. */
  bufferStats: JamRollingStats | null
  /** Distribution of the DataChannel ping over the window. */
  pingStats: JamRollingStats | null
  /** Every sample kept, for the export. */
  samples: readonly JamNetSample[]
}

/**
 * Whether the panel collects at all.
 *
 * Persisted: a two-device latency test involves reloads, and turning the
 * panel back on by hand on a phone each time is how a test run ends up
 * with a gap in the middle of it.
 */
export const [jamDiagnosticsEnabled, setJamDiagnosticsEnabled] =
  createPersistedSignal<boolean>('mp_jam_diagnostics', false, {
    validator: (v): v is boolean => typeof v === 'boolean',
  })

export const [jamDiagnostics, setJamDiagnostics] = createSignal<
  readonly JamPeerDiagnostics[]
>([])

/**
 * A free-text label for the run in progress, e.g. "Zagreb-Vienna, 5 GHz".
 *
 * Carried into the export. A log of six runs with no labels is six
 * columns of numbers that cannot be told apart an hour later, which is
 * exactly what a latency test produces if nobody thinks about it first.
 */
export const [jamDiagnosticsLabel, setJamDiagnosticsLabel] =
  createPersistedSignal<string>('mp_jam_diagnostics_label', '', {
    validator: (v): v is string => typeof v === 'string',
  })

interface PeerWindow {
  previous: JamNetSample | null
  samples: JamNetSample[]
  rtt: ReturnType<typeof createRingBuffer>
  buffer: ReturnType<typeof createRingBuffer>
  ping: ReturnType<typeof createRingBuffer>
  lastPingMs: number | null
  /** When that ping came back, so a dead channel stops reporting it. */
  lastPingAt: number
}

const windows = new Map<string, PeerWindow>()
let sampler: ReturnType<typeof setInterval> | null = null

function windowFor(peerId: string): PeerWindow {
  let w = windows.get(peerId)
  if (w === undefined) {
    w = {
      previous: null,
      samples: [],
      rtt: createRingBuffer(HISTORY_CAPACITY),
      buffer: createRingBuffer(HISTORY_CAPACITY),
      ping: createRingBuffer(HISTORY_CAPACITY),
      lastPingMs: null,
      lastPingAt: 0,
    }
    windows.set(peerId, w)
  }
  return w
}

/** Record one DataChannel ping result. Called from the service callback. */
export function recordChannelPing(
  peerId: string,
  rttMs: number,
  now: number = Date.now(),
): void {
  const w = windowFor(peerId)
  w.lastPingMs = rttMs
  w.lastPingAt = now
  w.ping.push(rttMs)
}

export interface JamDiagnosticsSources {
  /** Peer ids currently worth sampling — connected pairs only. */
  peerIds(): readonly string[]
  /** The live connection for a peer, or null. */
  statsFor(peerId: string): Promise<unknown | null>
  /** Fire a DataChannel ping. Its reply lands in recordChannelPing. */
  ping(peerId: string): void
}

/**
 * Take one round of samples across every connected peer.
 *
 * Exported so a test can step the loop without a timer, and so the panel
 * can force a reading on open rather than showing an empty table for a
 * second.
 */
export async function sampleOnce(
  sources: JamDiagnosticsSources,
  now: number = Date.now(),
): Promise<void> {
  const ids = sources.peerIds()
  // Drop windows for peers who left, or a long evening of people coming
  // and going accumulates history for a room that no longer exists.
  for (const id of [...windows.keys()]) {
    if (!ids.includes(id)) windows.delete(id)
  }

  // Concurrently, and the ping outside the try that covers getStats but
  // inside one that covers itself: `RTCDataChannel.send` throws once the
  // buffer is full, and a throw here used to escape the loop -- costing
  // every peer after this one their sample and freezing the panel on the
  // previous tick with nothing said.
  const rounds = await Promise.all(
    ids.map(async (peerId) => {
      try {
        sources.ping(peerId)
      } catch {
        // A gap in one row, not a lost round.
      }
      try {
        return { peerId, stats: await sources.statsFor(peerId) }
      } catch {
        // A connection closing mid-sample. Not an error worth surfacing:
        // the peer will be gone from peerIds() on the next tick.
        return { peerId, stats: null }
      }
    }),
  )

  const next: JamPeerDiagnostics[] = []
  for (const { peerId, stats } of rounds) {
    if (stats === null || stats === undefined) continue

    const w = windowFor(peerId)
    const sample = readNetSample(
      stats as Parameters<typeof readNetSample>[0],
      now,
    )
    const reading = deriveReading(sample, w.previous)
    w.previous = sample
    w.samples.push(sample)
    if (w.samples.length > HISTORY_CAPACITY) {
      w.samples.splice(0, w.samples.length - HISTORY_CAPACITY)
    }
    if (sample.rttMs !== null) w.rtt.push(sample.rttMs)
    if (reading.jitterBufferMs !== null) w.buffer.push(reading.jitterBufferMs)

    next.push({
      peerId,
      reading,
      // Null rather than stale. See PING_STALE_MS: the budget prefers this
      // over the ICE round trip, so a value that outlives the channel it
      // came from would hold a green verdict over a dead path.
      channelPingMs:
        w.lastPingMs !== null && now - w.lastPingAt <= PING_STALE_MS
          ? w.lastPingMs
          : null,
      rttStats: w.rtt.stats(),
      bufferStats: w.buffer.stats(),
      pingStats: w.ping.stats(),
      samples: w.samples,
    })
  }
  setJamDiagnostics(next)
}

/**
 * Guards against a round that outlives its interval.
 *
 * On a phone, or a large mesh, a round can take longer than a tick. Two
 * rounds in flight both write `w.previous` for the same peer, and one of
 * them then derives its deltas against a sample taken milliseconds
 * earlier -- which is a jitter-buffer depth of some absurd number, pushed
 * into the rolling window and the exported CSV as though it were real.
 */
let sampleInFlight = false

export function startJamDiagnostics(sources: JamDiagnosticsSources): void {
  if (sampler !== null) return
  void runSample(sources)
  sampler = setInterval(() => {
    void runSample(sources)
  }, SAMPLE_INTERVAL_MS)
}

async function runSample(sources: JamDiagnosticsSources): Promise<void> {
  if (sampleInFlight) return
  sampleInFlight = true
  try {
    await sampleOnce(sources)
  } finally {
    sampleInFlight = false
  }
}

export function stopJamDiagnostics(): void {
  if (sampler !== null) {
    clearInterval(sampler)
    sampler = null
  }
}

/** Throw away the window without stopping the sampler — "start this run now". */
export function resetJamDiagnostics(): void {
  windows.clear()
  setJamDiagnostics([])
}

// ── Export ───────────────────────────────────────────────────────────
// The point of the whole panel: numbers that leave the phone.
//
// Two shapes, because they answer different questions. The summary is
// what goes in a planning doc's table -- one line per peer, percentiles,
// no time series. The CSV is every sample, for when the summary says
// something surprising and the shape over time is the explanation.

export interface JamDiagnosticsExportMeta {
  label: string
  roomId: string | null
  /** Whatever the local device knows about itself. */
  userAgent: string
  /** Measured device round trip, if the mic wizard has run. */
  deviceRoundTripMs: number | null
}

export function summariseRun(
  peers: readonly JamPeerDiagnostics[],
  meta: JamDiagnosticsExportMeta,
): string {
  const lines: string[] = [
    `# Jam latency run — ${meta.label === '' ? '(unlabelled)' : meta.label}`,
    `room: ${meta.roomId ?? 'n/a'}`,
    `at: ${new Date().toISOString()}`,
    `device round trip: ${meta.deviceRoundTripMs === null ? 'not measured' : `${meta.deviceRoundTripMs} ms`}`,
    `ua: ${meta.userAgent}`,
    '',
    '| peer | path | codec | frame | RTT p50 | RTT p95 | RTT p99 | ping p50 | buffer p50 | buffer p95 | jitter | loss | concealed | kbps in | kbps out |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
  ]
  const silent: string[] = []
  for (const p of peers) {
    const s = p.reading.latest
    const frame =
      p.reading.frameMs === null
        ? '?'
        : `${p.reading.frameMs} ms @ ${Math.round(p.reading.packetsPerSecond ?? 0)}/s`
    if (notSending(p.reading)) silent.push(p.peerId.slice(0, 8))
    lines.push(
      `| ${p.peerId.slice(0, 8)} | ${s.path} | ${s.codec ?? '?'} | ${frame} | ${ms(p.rttStats?.p50)} | ${ms(p.rttStats?.p95)} | ${ms(p.rttStats?.p99)} | ${ms(p.pingStats?.p50)} | ${ms(p.bufferStats?.p50)} | ${ms(p.bufferStats?.p95)} | ${ms(s.jitterMs)} | ${pct(p.reading.lossFraction)} | ${pct(p.reading.concealedFraction)} | ${ms(p.reading.inboundKbps)} | ${ms(p.reading.outboundKbps)} |`,
    )
  }

  // Said in words, not left as an empty cell. A run where audio is
  // arriving and none is leaving is the one failure that looks like a
  // latency problem and is not one -- the far end simply cannot hear you,
  // and every other number on the row is about the direction that works.
  if (silent.length > 0) {
    lines.push(
      '',
      `NOT SENDING to ${silent.join(', ')}: audio is arriving but none is leaving this device, so the far end hears nothing. Check that the microphone is unmuted and that "Your sound" reports a capture.`,
    )
  }
  return lines.join('\n')
}

/**
 * Receiving but not transmitting.
 *
 * `outboundKbps` is null when the connection has no outbound audio stats
 * at all, which means no sender is producing packets -- not a quiet one.
 * Paired with inbound audio actually arriving, that is unambiguous: the
 * link is up and this end is mute to it.
 */
function notSending(reading: JamNetReading): boolean {
  const inbound = reading.inboundKbps
  if (inbound === null || inbound <= 0) return false
  const outbound = reading.outboundKbps
  return outbound === null || outbound <= 0
}

const CSV_COLUMNS = [
  'at',
  'peerId',
  'rttMs',
  'path',
  'jitterMs',
  'jitterBufferMs',
  'jitterBufferTargetMs',
  'lossFraction',
  'concealedFraction',
  'inboundKbps',
  'outboundKbps',
  // The frame size is the whole point of asking for 10 ms packets, and it
  // was on screen but in neither export -- so a run pasted to somebody
  // else could not answer the question the run was taken to answer. The
  // packet rate rides along because it is the evidence the frame size is
  // derived from: 50/s is 20 ms, 100/s is 10 ms.
  'packetsPerSecond',
  'frameMs',
  'codec',
] as const

export function exportCsv(peers: readonly JamPeerDiagnostics[]): string {
  const rows: string[] = [CSV_COLUMNS.join(',')]
  for (const p of peers) {
    let previous: JamNetSample | null = null
    for (const s of p.samples) {
      const r = deriveReading(s, previous)
      previous = s
      rows.push(
        [
          new Date(s.at).toISOString(),
          p.peerId,
          fixed(s.rttMs),
          s.path,
          fixed(s.jitterMs),
          fixed(r.jitterBufferMs),
          fixed(r.jitterBufferTargetMs),
          fixed(r.lossFraction, 5),
          fixed(r.concealedFraction, 5),
          fixed(r.inboundKbps),
          fixed(r.outboundKbps),
          fixed(r.packetsPerSecond),
          fixed(r.frameMs),
          s.codec ?? '',
        ].join(','),
      )
    }
  }
  return rows.join('\n')
}

function ms(v: number | null | undefined): string {
  return v === null || v === undefined ? '—' : v.toFixed(1)
}

function pct(v: number | null | undefined): string {
  return v === null || v === undefined ? '—' : `${(v * 100).toFixed(2)}%`
}

function fixed(v: number | null, digits = 2): string {
  return v === null ? '' : v.toFixed(digits)
}
