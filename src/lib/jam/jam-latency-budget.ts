// ── Jam latency budget ───────────────────────────────────────────────
// Mouth to ear, broken into the parts you can do something about.
//
// The number a musician feels is not the ping. It is the whole chain from
// a string being plucked to that sound leaving the other person's
// speakers, and the network is usually NOT the largest term in it -- two
// people in the same city can sit at 12 ms of network and still play at
// 70 ms mouth-to-ear, because everything on either end of the wire is
// buffered. Showing the ping alone is how a latency problem gets blamed
// on the wrong thing for a year.
//
// The budget is an ESTIMATE and says so. Three of its terms are measured
// (the network, the receiver's jitter buffer, the local device round
// trip); the rest are known constants of the WebRTC audio path that no
// browser exposes. A term we cannot measure carries its source, so a
// reading is never mistaken for a measurement.
//
// Reference points, for reading the total:
//   < 10 ms   indistinguishable from being in the room
//   10-25 ms  comfortable; the ensemble-performance-threshold literature
//             clusters here, and most players stop noticing
//   25-35 ms  playable, tempo drags slightly, drummers notice first
//   35-50 ms  hard work; rhythm parts fall apart, sustained parts survive
//   > 50 ms   not playing together, whatever the UI says
//
// Tests: src/tests/jam-latency-budget.test.ts.

/** Where a term's number came from. Shown, because it changes how to read it. */
export type JamBudgetSource =
  /** Read from getStats or a device calibration this session. */
  | 'measured'
  /** A constant of the platform we cannot query. */
  | 'platform'
  /** Nothing to go on; the term is excluded from the total. */
  | 'unknown'

export interface JamBudgetTerm {
  id: string
  label: string
  ms: number | null
  source: JamBudgetSource
  /** One line on what this is and what moves it. */
  note: string
}

export interface JamLatencyBudget {
  terms: readonly JamBudgetTerm[]
  /** Sum of the terms that have a number. */
  totalMs: number
  /** True when a term read 'unknown', so the total is a floor, not a figure. */
  partial: boolean
  verdict: JamPlayabilityVerdict
}

export type JamPlayabilityVerdict =
  | 'transparent'
  | 'comfortable'
  | 'playable'
  | 'hard'
  | 'not-together'

export function verdictFor(totalMs: number): JamPlayabilityVerdict {
  if (totalMs < 10) return 'transparent'
  if (totalMs < 25) return 'comfortable'
  if (totalMs < 35) return 'playable'
  if (totalMs <= 50) return 'hard'
  return 'not-together'
}

export const VERDICT_COPY: Record<JamPlayabilityVerdict, string> = {
  transparent: 'Same-room feel',
  comfortable: 'Comfortable — most players stop noticing here',
  playable: 'Playable, tempo will drag a little',
  hard: 'Hard work — rhythm parts suffer first',
  'not-together': 'Not playing together, whatever else the room says',
}

/**
 * Opus in a browser peer connection, as the browser configures it.
 *
 * 20 ms frames is what Chrome, Safari and Firefox all negotiate by default
 * and what they keep unless the SDP asks otherwise. The 2.5 ms is the
 * codec's own lookahead, which is a property of Opus and not of the frame
 * size. Both are platform constants because there is no stat that reports
 * them -- `packetizationMs` on an inbound report is the nearest thing and
 * is widely absent.
 */
export const OPUS_DEFAULT_FRAME_MS = 20
export const OPUS_LOOKAHEAD_MS = 2.5

/**
 * What getUserMedia costs before a sample reaches the encoder.
 *
 * Chrome's capture path runs a 10 ms block, and the audio processing
 * module adds its own. This is the conservative end of what has been
 * measured on desktop Chrome and is optimistic for a phone -- Android's
 * capture path is routinely 20-40 ms on its own, which is why a phone
 * always feels worse than a laptop on the same network.
 */
export const BROWSER_CAPTURE_MS = 10

/**
 * Playback out of an <audio> element fed by a peer connection.
 *
 * Not measurable from script: `AudioContext.outputLatency` describes a Web
 * Audio graph, and the room deliberately does not use one for peer audio
 * (see the note in jam-store.ts -- Chrome's echo canceller only cancels a
 * peer connection's own output). So this is a platform constant with a
 * wide true range: ~10 ms on a wired desktop output, 30-40 ms through
 * Bluetooth, and Bluetooth is the single largest thing most people can fix
 * for free.
 */
export const BROWSER_PLAYOUT_MS = 10

/** Bluetooth's own air-interface delay, on top of everything else. */
export const BLUETOOTH_PLAYOUT_MS = 120

export interface JamBudgetInput {
  /** ICE round trip in ms. One way is half of it. */
  rttMs: number | null
  /** Receiver-side jitter buffer depth, from jam-net-stats. */
  jitterBufferMs: number | null
  /**
   * The device's own speaker-to-mic round trip, if the wizard has run.
   *
   * This is the ONE local term that is really measured. It covers the
   * hardware and OS on both ends of this device, so it replaces the
   * capture and playout constants rather than adding to them -- counting
   * both would double-charge the same buffers.
   */
  deviceRoundTripMs: number | null
  /** Set when the listener is on Bluetooth, which no API reliably reports. */
  bluetoothOutput?: boolean
}

/**
 * Build the budget.
 *
 * Deliberately conservative about what it claims: where the device round
 * trip has been measured it is used and the platform constants are
 * dropped; where it has not, the constants stand in and are labelled
 * 'platform' so the total reads as the estimate it is.
 */
export function buildLatencyBudget(input: JamBudgetInput): JamLatencyBudget {
  const terms: JamBudgetTerm[] = []

  if (input.deviceRoundTripMs !== null && input.deviceRoundTripMs > 0) {
    terms.push({
      id: 'device',
      label: 'Your device, in and out',
      ms: input.deviceRoundTripMs,
      source: 'measured',
      note: 'Measured speaker-to-mic round trip. Covers the sound card, the OS audio stack and the browser buffers at both ends of this machine.',
    })
  } else {
    terms.push({
      id: 'capture',
      label: 'Mic capture',
      ms: BROWSER_CAPTURE_MS,
      source: 'platform',
      note: 'Typical desktop Chrome. A phone is usually 2-4x worse. Run the mic latency wizard to replace this guess with a measurement.',
    })
    terms.push({
      id: 'playout',
      label: 'Speaker playout',
      ms: BROWSER_PLAYOUT_MS,
      source: 'platform',
      note: 'Wired output. Not queryable for a peer audio element.',
    })
  }

  terms.push({
    id: 'encode',
    label: 'Opus frame + lookahead',
    ms: OPUS_DEFAULT_FRAME_MS + OPUS_LOOKAHEAD_MS,
    source: 'platform',
    note: 'A 20 ms frame cannot be sent until 20 ms of audio exists. This is the single biggest term the app itself controls, and today it does not control it.',
  })

  terms.push({
    id: 'network',
    label: 'Network, one way',
    ms: input.rttMs === null ? null : input.rttMs / 2,
    source: input.rttMs === null ? 'unknown' : 'measured',
    note: 'Half the measured ICE round trip. Assumes a symmetric path, which is usually close enough and occasionally very wrong.',
  })

  terms.push({
    id: 'jitter-buffer',
    label: 'Their jitter buffer',
    ms: input.jitterBufferMs,
    source: input.jitterBufferMs === null ? 'unknown' : 'measured',
    note: 'How long the receiver holds audio before playing it, so that late packets still arrive in time. Grows with network jitter, not with distance.',
  })

  if (input.bluetoothOutput === true) {
    terms.push({
      id: 'bluetooth',
      label: 'Bluetooth output',
      ms: BLUETOOTH_PLAYOUT_MS,
      source: 'platform',
      note: 'Typical A2DP. Wired headphones remove this entirely and it is the largest free win available.',
    })
  }

  const totalMs = terms.reduce((acc, t) => acc + (t.ms ?? 0), 0)
  return {
    terms,
    totalMs,
    partial: terms.some((t) => t.source === 'unknown'),
    verdict: verdictFor(totalMs),
  }
}

// ── Physics ──────────────────────────────────────────────────────────

/** Light in fibre: roughly two thirds of c, so ~200,000 km/s. */
export const FIBRE_KM_PER_MS = 200

/**
 * Real routed paths are longer than the great circle between two points.
 *
 * Cables follow coastlines and land at specific stations, and traffic
 * detours through exchange points. 1.6x is the usual rule of thumb; a
 * badly peered pair can be far worse, which is exactly the case where
 * putting a relay on a good backbone beats going direct.
 */
export const ROUTING_STRETCH = 1.6

/** The floor a pair that distance apart cannot get under, round trip. */
export function theoreticalRttMs(
  greatCircleKm: number,
  stretch: number = ROUTING_STRETCH,
): number {
  return (2 * greatCircleKm * stretch) / FIBRE_KM_PER_MS
}

/**
 * How much of a measured RTT is not explained by distance.
 *
 * The interesting number on a test log. Zagreb to Vienna is ~270 km, which
 * is 4.3 ms of physics; a measured 28 ms means 24 ms of access network,
 * queueing and Wi-Fi -- and that part is addressable, where the 4.3 is not.
 */
export function overheadMs(
  measuredRttMs: number,
  greatCircleKm: number,
): number {
  return measuredRttMs - theoreticalRttMs(greatCircleKm)
}
