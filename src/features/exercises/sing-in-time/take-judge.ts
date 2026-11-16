// ============================================================
// Sing It in Time: one tune's take, judged note by note
// ============================================================
//
// Each written note is judged in its own beats, counted from the singer's
// first note, as Lesson 18's in-time reader counts them
// (kit/read-in-time.ts) and The Chart anchors a tapped bar on its first
// tap: the take's first run of voice at least 0.15 s long, starting between
// a quarter of a beat before bar 1's first beat and two beats after it,
// moves every note's beats by its distance from that beat. A steady delay,
// the device's or the singer's, cancels out, and a late entry is never read
// as a wrong pitch (SEASON-2 § 5.2 item 11; Lesson 18 FACTS 52).
//
// The reader's rules, with what the drill adds to them:
//
// - Pitch, by pitch class. In its window, a quarter of a beat either side
//   of its beats, a note is in tune once the voice has sat within 60 cents
//   of it, folded into one octave, for long enough: 0.45 s for a quarter
//   at 60 BPM, as the reader hears it, and that share of a shorter note
//   (an eighth, a faster tempo), never more. A frame off the note, or a
//   stretch with no voice, takes back half its time.
// - Not heard. A note not held in its window is read only from the voice
//   in its own beats: too little of it, or voice that sits on a written
//   note up to two places either side (that note sung early or late), or
//   any such note in a take with no anchor, where late cannot be told from
//   wrong, is "not heard". Otherwise its own voice says how far off it sat,
//   in tune within 60 cents and off beyond. No gap is ever measured from
//   another note (Lesson 18 FACTS 54).
// - Timing, which the reader never reads and this drill shows: when the
//   voice arrived on a note in tune, from the start of the hold that heard
//   it, against its own beat, anchored. Within a fifth of a beat (and never
//   less than 0.12 s) it is on time; before that early, after it late. The
//   first note is the anchor, so it is on time unless the voice slid up to
//   it slowly. A note read from its own beats has no arrival to time.
//
// The reader takes a frame every sixtieth of a second, and voice frames
// more than a twentieth apart as a gap with no voice (`MAX_HOP`). The
// drill's frames are the app's, drawn beside Merc and the staff, and a busy
// phone draws them less often and less evenly, or stops for a moment. So
// the page says where it looked and heard no voice, and a gap it never
// looked into is split between what it heard on either side: filled at a
// sixtieth of a second, the first half as the look before it and the
// second as the look after, half a second at most (`filled`). A slow
// device's steady note is still one stretch, and a note that began while
// the page was busy began, as near as can be told, halfway through.
//
// Pure: frames in, verdicts out. `now` judges a take as it runs: a note is
// judged once its window has closed, and none before the anchor is settled.

import type { F0Frame, VoicedFrame } from '@/lib/mirror/metrics'
import { foldCents, median, preprocess } from '@/lib/mirror/metrics'
import type { InTimeOptions, WrittenNote } from './in-time-kit'
import { ANCHOR_LATE_BEATS, ANCHOR_RUN_SEC, anchorOf, firstRunAt, HEARD_SEC, MAX_HOP, NEIGHBOURS, ON_NOTE_CENTS, OWN_ATTACK_SEC, OWN_VOICE_SEC, WINDOW_BEATS, } from './in-time-kit'

/** The reader's values are set for a quarter note lasting this long: 1 s at 60 BPM. */
const READER_NOTE_SEC = 1
/** A note on time arrives within this share of a beat of it, and never less than the floor, s. */
export const ON_TIME_BEATS = 0.2
export const ON_TIME_MIN_SEC = 0.12

export type Pitch = 'in-tune' | 'off' | 'not-heard'
export type Timing = 'early' | 'on-time' | 'late'

/** One note's verdict. */
export interface NoteVerdict {
  readonly pitch: Pitch
  /** Cents from its own note, folded into one octave, flat below 0; null when not heard. */
  readonly cents: number | null
  /** When the voice arrived on it, in beats from its own first beat, anchored; null when not timed. */
  readonly offset: number | null
  readonly timing: Timing | null
}

export interface TakeVerdict {
  /** Whether any note's window held a voiced frame. */
  readonly voice: boolean
  /** Seconds the beats moved to the singer's first note, late above 0; null with no anchor. */
  readonly shift: number | null
  /** Whether the anchor is known: a first note found, or its span gone by. */
  readonly settled: boolean
  /** Each note's verdict, or null while its window is still open. */
  readonly notes: readonly (NoteVerdict | null)[]
}

const NOT_HEARD: NoteVerdict = {
  pitch: 'not-heard',
  cents: null,
  offset: null,
  timing: null,
}

/** The voiced frames from `from` to `to`, by time. */
const between = (
  voiced: readonly VoicedFrame[],
  from: number,
  to: number,
): VoicedFrame[] => voiced.filter((f) => f.t >= from - 1e-9 && f.t <= to + 1e-9)

/** The longest gap between two looks that is filled, s: a longer one stays a gap. */
export const FILL_MAX_SEC = 0.5
/** The filled frames' spacing, s: a frame every sixtieth of a second, as the reader takes them. */
const FILL_STEP_SEC = 1 / 60
/** A frame this sure of its pitch is voice (the reader's floor, `preprocess`). */
const VOICE_CONF = 0.5

/** A take's options: the reader's, and where the page looked and heard no voice. */
export interface TakeOptions extends InTimeOptions {
  /** The page's frames that heard no voice, s on the frames' clock, in order; without them no gap is filled. */
  readonly silent?: readonly number[]
}

const isVoice = (f: F0Frame): boolean => f.f0 > 0 && f.conf >= VOICE_CONF

/**
 * `frames` with each gap between two of the page's looks (its frames and
 * the `silent` ones) over `MAX_HOP` and up to `FILL_MAX_SEC` filled at a
 * sixtieth of a second: the first half as the look before it, the second
 * as the look after, where that look heard voice. Without `silent`, the
 * frames as they came.
 */
export function filled(
  frames: readonly F0Frame[],
  silent: readonly number[] | undefined,
): F0Frame[] {
  if (silent === undefined) return [...frames]
  const looks = [
    ...frames,
    ...silent.map((t): F0Frame => ({ t, f0: 0, conf: 0 })),
  ].sort((a, b) => a.t - b.t)
  const out: F0Frame[] = []
  looks.forEach((b, i) => {
    if (i > 0) out.push(...fillBetween(looks[i - 1], b))
    if (b.f0 > 0 || b.conf > 0) out.push(b)
  })
  return out
}

/** The frames that fill the gap from look `a` to look `b`, each half as its own side heard it; none for a gap too short or too long. */
function fillBetween(a: F0Frame, b: F0Frame): F0Frame[] {
  const gap = b.t - a.t
  if (gap <= MAX_HOP + 1e-9 || gap > FILL_MAX_SEC + 1e-9) return []
  const steps = Math.ceil(gap / FILL_STEP_SEC - 1e-9)
  const fill: F0Frame[] = []
  for (let k = 1; k < steps; k++) {
    const t = a.t + (gap * k) / steps
    const from = t - a.t < b.t - t ? a : b
    if (isVoice(from)) fill.push({ t, f0: from.f0, conf: from.conf })
  }
  return fill
}

/** The time a frame stands for, from the one before it: at most a hop, none for the first. */
const stands = (frames: readonly VoicedFrame[], i: number): number =>
  i === 0 ? 0 : Math.min(Math.max(frames[i].t - frames[i - 1].t, 0), MAX_HOP)

const voicedSec = (frames: readonly VoicedFrame[]): number =>
  frames.reduce((sum, _, i) => sum + stands(frames, i), 0)

/**
 * The frames that heard a note in its window, by the reader's rule, and
 * when the hold that heard it began; null when it was not heard.
 */
function heldIn(
  frames: readonly VoicedFrame[],
  midi: number,
  need: number,
): { readonly diffs: number[]; readonly since: number } | null {
  const diffs: number[] = []
  let hold = 0
  let since: number | null = null
  const lose = (sec: number): void => {
    hold = Math.max(0, hold - sec / 2)
    if (hold === 0) since = null
  }
  for (let i = 0; i < frames.length; i++) {
    const gap = i === 0 ? 0 : frames[i].t - frames[i - 1].t
    if (gap > MAX_HOP) lose(gap - MAX_HOP)
    const d = frames[i].cents - midi * 100
    if (Math.abs(foldCents(d)) <= ON_NOTE_CENTS) {
      since ??= frames[i].t
      hold += stands(frames, i)
      diffs.push(d)
    } else lose(stands(frames, i))
    if (hold >= need - 1e-9 && since !== null) return { diffs, since }
  }
  return null
}

/** Whether `frames` sit, by their median, within 60 cents of the written note up to two places either side of `i`. */
const onANeighbour = (
  frames: readonly VoicedFrame[],
  notes: readonly WrittenNote[],
  i: number,
): boolean =>
  notes.some(
    (m, j) =>
      j !== i &&
      Math.abs(j - i) <= NEIGHBOURS &&
      Math.abs(median(frames.map((f) => foldCents(f.cents - m.midi * 100)))) <=
        ON_NOTE_CENTS,
  )

/** Early, on time or late, for an arrival `seconds` after its beat at `bpm`. */
export function timingOf(seconds: number, bpm: number): Timing {
  const within = Math.max(ON_TIME_MIN_SEC, (ON_TIME_BEATS * 60) / bpm)
  if (seconds < -within - 1e-9) return 'early'
  if (seconds > within + 1e-9) return 'late'
  return 'on-time'
}

/** One note's verdict, its beats anchored by `at`. */
function judgeNote(
  voiced: readonly VoicedFrame[],
  o: InTimeOptions,
  i: number,
  at: (beat: number) => number,
  anchored: boolean,
): NoteVerdict {
  const n = o.notes[i]
  const spb = 60 / o.bpm
  // the reader's values, for a quarter at 60; a shorter note's share of them
  const scale = Math.min(1, (n.beats * spb) / READER_NOTE_SEC)
  const window = between(
    voiced,
    at(n.beat - WINDOW_BEATS),
    at(n.beat + n.beats + WINDOW_BEATS),
  )
  const held = heldIn(window, n.midi, HEARD_SEC * scale)
  if (held !== null) {
    const late = held.since - at(n.beat)
    return {
      pitch: 'in-tune',
      cents: Math.round(median(held.diffs.map(foldCents))),
      offset: late / spb,
      timing: timingOf(late, o.bpm),
    }
  }
  if (!anchored) return NOT_HEARD
  // its own beats end where the next beat starts, so the next note's first
  // frame is never this one's
  const own = voiced.filter(
    (f) =>
      f.t >= at(n.beat) + OWN_ATTACK_SEC * scale - 1e-9 &&
      f.t < at(n.beat + n.beats) - 1e-9,
  )
  if (voicedSec(own) < OWN_VOICE_SEC * scale - 1e-9) return NOT_HEARD
  const cents = median(own.map((f) => foldCents(f.cents - n.midi * 100)))
  if (Math.abs(cents) <= ON_NOTE_CENTS)
    return {
      pitch: 'in-tune',
      cents: Math.round(cents),
      offset: null,
      timing: null,
    }
  if (onANeighbour(own, o.notes, i)) return NOT_HEARD
  return { pitch: 'off', cents: Math.round(cents), offset: null, timing: null }
}

/** When the take's last window closes, on the frames' clock, moved by the anchor so far. */
export function closesAt(o: InTimeOptions, shift: number | null): number {
  const end = Math.max(...o.notes.map((n) => n.beat + n.beats))
  return o.bar1 + (shift ?? 0) + ((end + WINDOW_BEATS) * 60) / o.bpm
}

/**
 * A tune's take judged note by note, anchored on the singer's first note.
 * With `now`, as it runs: a note's verdict waits for its window to close,
 * and every note waits for the anchor, which is known once a first note
 * has been found or two beats and its 0.15 s have passed without one.
 */
export function judgeTake(
  frames: readonly F0Frame[],
  o: TakeOptions,
  now = Infinity,
): TakeVerdict {
  const voiced = preprocess(
    filled(
      frames.filter((f) => f.t >= o.opened - 1e-9),
      o.silent,
    ),
  )
  const spb = 60 / o.bpm
  const settled =
    firstRunAt(voiced) !== null ||
    now >= o.bar1 + ANCHOR_LATE_BEATS * spb + ANCHOR_RUN_SEC - 1e-9
  if (!settled)
    return {
      voice: false,
      shift: null,
      settled,
      notes: o.notes.map(() => null),
    }
  const shift = anchorOf(voiced, o)
  const at = (beat: number): number => o.bar1 + (shift ?? 0) + beat * spb
  const notes = o.notes.map((n, i) =>
    now >= at(n.beat + n.beats + WINDOW_BEATS) - 1e-9
      ? judgeNote(voiced, o, i, at, shift !== null)
      : null,
  )
  const voice = o.notes.some(
    (n, i) =>
      notes[i] !== null &&
      between(
        voiced,
        at(n.beat - WINDOW_BEATS),
        at(n.beat + n.beats + WINDOW_BEATS),
      ).length > 0,
  )
  return { voice, shift, settled, notes }
}
