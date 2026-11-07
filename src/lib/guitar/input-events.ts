// One shape for everything the room hears a player do.
// ============================================================
//
// A microphone, a plugged-in interface and a MIDI guitar all answer the same
// question — the player did something, here is when and what — and everything
// downstream (Jam Doctor, take history, scoring) should never have to care
// which one it came from. So they all arrive as this.
//
// Two clocks are named separately on purpose, and mixing them up is the
// classic way timing feedback ends up quietly wrong:
//
//   `capturedAt`  when the sample carrying the strike reached us
//   `at`          when the player's hand actually moved
//
// They differ by the route's latency, and `at` is the only one that can be
// compared against a beat. That number is the app-wide measured round trip
// (@/stores/mic-latency-store), which is zero until somebody measures it — and
// zero must stay a no-op, because a correction nobody measured is a claim
// about the player's timing that nothing supports.

export type GuitarInputSource = 'microphone' | 'midi' | 'interface'

/**
 * A strike and a note change are not the same event, and Jam Doctor must never
 * treat them as one. A hammer-on, a pull-off and a slide all change the note
 * without anything being picked; counting them as attacks would inflate every
 * timing and spacing reading a player is shown.
 */
export type GuitarInputEventKind = 'attack' | 'pitch-change' | 'release'

/** The primary attack clock selected for a take. */
export type GuitarInputTimingSource =
  | 'audio-clock'
  | 'frame-loop'
  | 'midi-clock'

/** Pitch, once the slower analysis path has identified it. */
export interface GuitarInputPitch {
  midi: number
  noteName: string
  cents: number
  clarity: number
}

/**
 * Raw evidence for where an event's time came from. Worklet attacks keep the
 * exact audio frame and rate. The fallback names both the main-thread
 * observation and the analyser window it describes, so coarse evidence can
 * never be mistaken for a sample-exact strike.
 */
export type GuitarInputClockProvenance =
  | {
      kind: 'audio-worklet'
      atFrame: number
      sampleRate: number
    }
  | {
      kind: 'frame-loop'
      observedAt: number
      windowStartAt: number
      sampleRate: number
      windowFrames: number
    }
  | {
      kind: 'web-midi'
      /** DOMHighResTimeStamp supplied with the MIDI message. */
      eventTimestampMs: number
      /** performance.now() observed when the message reached this adapter. */
      observedPerformanceMs: number
      /** The event timestamp mapped onto this room's AudioContext clock. */
      mappedAudioTime: number
      inputId: string
      channel: number
    }

/** Event-shaped input before a take assigns identity and compensated time. */
export interface GuitarInputCapture {
  kind: GuitarInputEventKind
  source: GuitarInputSource
  /** Stable voice identity where a source can supply one; MIDI note releases do. */
  voiceId: string | null
  level: number
  pitch: GuitarInputPitch | null
  clock: GuitarInputClockProvenance
}

export interface GuitarInputEvent {
  /** Stable for this event throughout provisional and enriched updates. */
  id: string
  kind: GuitarInputEventKind
  source: GuitarInputSource
  /** Stable across an attack and its release when the input supplies identity. */
  voiceId: string | null
  /** Audio-clock seconds, latency removed: when the string was struck. */
  at: number
  /** Audio-clock seconds, raw: when the sample carrying it arrived. */
  capturedAt: number
  /** Signal level at the strike, roughly 0..1. */
  level: number
  /** The untouched clock evidence used to derive both time fields. */
  clock: GuitarInputClockProvenance
  /**
   * What note it turned out to be. Null while unknown — an attack is timed
   * before it is identified, and pretending otherwise would mean either
   * delaying the timestamp or inventing the pitch.
   */
  pitch: GuitarInputPitch | null
}

/**
 * How far either side of a strike a pitch reading can land and still be that
 * strike's. Beyond it the note being heard is a sustain, or a legato move the
 * attack path never saw, and stapling it on would misattribute it.
 *
 * Either side, not just after: pitch is read from an analysis window tens of
 * milliseconds wide, so the moment it names is necessarily fuzzier than the
 * sample-exact moment the strike was found at.
 */
export const PITCH_ATTACH_WINDOW_MS = 90

/** Attack messages from the worklet, timed in absolute audio frames. */
export type GuitarInputWorkletMessage =
  | { type: 'attack'; atFrame: number; level: number }
  | { type: 'level'; atFrame: number; peak: number; noiseFloor: number }

/** Absolute frame count to audio-clock seconds. */
export function frameToSeconds(frame: number, sampleRate: number): number {
  if (!(sampleRate > 0)) return 0
  return frame / sampleRate
}

/**
 * When the player actually struck the string, given when the sample carrying
 * it arrived and the measured round trip of the route it came through.
 */
export function playedAt(capturedAt: number, latencySeconds: number): number {
  if (!Number.isFinite(latencySeconds)) return capturedAt
  return capturedAt - latencySeconds
}

/**
 * Attach a pitch to the attack it belongs to, if any does. Returns the list
 * unchanged when the reading arrived too late to be that strike's, or when the
 * strike already has a clearer reading of the same note. A different note may
 * be the detector settling after a previously ringing string, so it corrects
 * the provisional reading even at lower clarity.
 */
export function attachPitchToLatestAttack(
  events: readonly GuitarInputEvent[],
  pitch: GuitarInputPitch,
  atSeconds: number,
): readonly GuitarInputEvent[] {
  let index = events.length - 1
  while (index >= 0 && events[index]?.kind !== 'attack') index -= 1
  const latest = events[index]
  if (latest === undefined) return events
  if (Math.abs(atSeconds - latest.at) * 1000 > PITCH_ATTACH_WINDOW_MS) {
    return events
  }
  if (
    latest.pitch !== null &&
    latest.pitch.midi === pitch.midi &&
    latest.pitch.clarity >= pitch.clarity
  ) {
    return events
  }
  const updated = [...events]
  updated[index] = { ...latest, pitch }
  return updated
}
