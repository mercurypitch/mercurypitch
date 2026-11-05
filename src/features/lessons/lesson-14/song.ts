// ============================================================
// Lesson 14 song — the verse, Merc's two takes, and every play, as numbers
// ============================================================
//
// Pure, so every timing, level and pitch the page plays or draws is tested
// (song.test.ts). The tune is the kit's verse (kit/twinkle.ts) at 80 beats
// a minute, a crotchet 0.75 s, a line 6.0 s and the verse 36.0 s, from do:
// D3 for the lower voice, D4 for the higher, moved by Move do within four
// semitones either way (FACTS 17 to 20, 70). Its notes are spelled as
// Lesson 4 spells the key (kit/major-scale.ts), which from D agrees with
// the app's sharps: D, E, F♯, G, A, B (FACTS 18).
//
// A sung line is one voice from breath to breath (FACTS 83 to 87): each note
// holds its pitch and moves to the next in 0.05 s, and a repeated note dips
// to 0.6 of its level for about 0.06 s, never to silence, so two notes are
// heard as two within one voice. A breath is a 0.3 s gap taken from the
// note before it, so no beat moves (FACTS 26, 31).
//
// Merc's two takes of the first line (FACTS 31, 83): take 1 breathes inside
// the phrase, from 4.2 to 4.5 s, between "lit-tle" and "star", every note at
// level 1; take 2 sings through to "star", which swells from level 0.5 at
// 4.5 s to 1 at 5.1 s and back to 0.5 at 5.7 s (6 dB down, up and down
// again, never above the line's own level), then breathes from 5.7 to 6.0 s.

import type { LevelPoint } from '@/features/lessons/kit/band-chart-hold'
import { MAJOR_DEGREES, majorScale } from '@/features/lessons/kit/major-scale'
import type { Spelled } from '@/features/lessons/kit/notes'
import { hz } from '@/features/lessons/kit/notes'
import { takeContour } from '@/features/lessons/kit/push-take'
import type { RunLine, RunNote } from '@/features/lessons/kit/run'
import type { ContourPoint } from '@/features/lessons/kit/sound'
import type { Numeral, VerseNote } from '@/features/lessons/kit/twinkle'
import { BEAT_SEC, BREATH_SEC, CHORD_STEPS, LINE_SEC, lineBeats, VERSE, VERSE_BREATHS, VERSE_CHORDS, VERSE_SEC, } from '@/features/lessons/kit/twinkle'
import type { Voice } from '@/features/lessons/kit/voice-choice'

/** Do for each voice before Move do: D3 or D4 (FACTS 65, 71). */
export const HOME_DO: Readonly<Record<Voice, number>> = {
  lower: 50,
  higher: 62,
}

/** Do for a voice, moved by Move do's `shift` semitones. */
export const doOf = (v: Voice, shift = 0): number => HOME_DO[v] + shift

/** La above `doMidi`: the phrase's top note. */
export const laOf = (doMidi: number): number => doMidi + MAJOR_DEGREES[5]

/** The do-re-mi name of each degree the tune uses (Lesson 4's names). */
export const SOLFEGE: readonly string[] = ['do', 're', 'mi', 'fa', 'so', 'la']

/** Each degree's note spelled from `doMidi`, as Lesson 4 spells the key (FACTS 18). */
export const spelledDegree = (doMidi: number, degree: number): Spelled =>
  majorScale(doMidi)[degree]

/** A note of a phrase on the page: its pitch, its time, its words and its level. */
export interface SongNote {
  readonly midi: number
  readonly degree: number
  /** Seconds from the play's start: where it starts and where its sound ends. */
  readonly from: number
  readonly to: number
  readonly syllable: string
  readonly printed: string
  /** Its level along its length (1 for Merc's steady notes): seconds and 0 to 1. */
  readonly light: readonly LevelPoint[]
}

/** Seconds of a note's own sound in the score: its beats at 80 a minute. */
const steady = (from: number, to: number): LevelPoint[] => [
  { t: from, level: 1 },
  { t: to, level: 1 },
]

/** Line `k` (0 to 5) of the verse from `doMidi`, starting `at` seconds in, each note its whole length. */
export function lineNotes(k: number, doMidi: number, at = 0): SongNote[] {
  const line: readonly VerseNote[] = VERSE[k]
  const beats = lineBeats(line)
  return line.map((n, i) => {
    const from = at + beats[i].from * BEAT_SEC
    const to = at + beats[i].to * BEAT_SEC
    return {
      midi: doMidi + MAJOR_DEGREES[n.degree],
      degree: n.degree,
      from,
      to,
      syllable: n.syllable,
      printed: n.printed,
      light: steady(from, to),
    }
  })
}

/** A note shortened to end at `to`: a breath taken from its end. */
const endAt = (n: SongNote, to: number): SongNote => ({
  ...n,
  to,
  light: steady(n.from, to),
})

/** The swell on take 2's "star": level 0.5 at 4.5 s, 1 at 5.1 s, 0.5 at 5.7 s (FACTS 83). */
export const SWELL_STAR: readonly LevelPoint[] = [
  { t: 4.5, level: 0.5 },
  { t: 5.1, level: 1 },
  { t: 5.7, level: 0.5 },
]

/** Merc's two takes of the first line. */
export type TakeId = 1 | 2

/** Where each of Merc's takes breathes: from this moment for 0.3 s (FACTS 31). */
export const TAKE_BREATH: Readonly<Record<TakeId, number>> = { 1: 4.2, 2: 5.7 }

/** Merc's take `id` of the first line from `doMidi`, 6.0 s on the beat. */
export function takeNotes(id: TakeId, doMidi: number): SongNote[] {
  const notes = lineNotes(0, doMidi)
  if (id === 1)
    return notes.map((n, i) => (i === 5 ? endAt(n, TAKE_BREATH[1]) : n))
  return notes.map((n, i) =>
    i === 6 ? { ...n, to: TAKE_BREATH[2], light: SWELL_STAR } : n,
  )
}

/** The whole verse from `doMidi`: each line but the last breathing 0.3 s before the next (FACTS 85). */
export function verseNotes(doMidi: number): SongNote[] {
  return VERSE.flatMap((_, k) => {
    const notes = lineNotes(k, doMidi, k * LINE_SEC)
    if (k === VERSE.length - 1) return notes
    const last = notes.length - 1
    return notes.map((n, i) =>
      i === last ? endAt(n, (k + 1) * LINE_SEC - BREATH_SEC) : n,
    )
  })
}

/** The verse's breaths, seconds from its start (FACTS 85). */
export { VERSE_BREATHS, VERSE_SEC }

/** The level of a note `t` seconds in, from its light. */
function levelOf(n: SongNote, t: number): number {
  const pts = n.light
  if (t <= pts[0].t) return pts[0].level
  for (let i = 1; i < pts.length; i++)
    if (t <= pts[i].t) {
      const a = pts[i - 1]
      const b = pts[i]
      return a.level + ((b.level - a.level) * (t - a.t)) / (b.t - a.t)
    }
  return pts[pts.length - 1].level
}

/** Seconds a note takes to move to the next pitch, and a repeated note's dip, its depth and length (FACTS 83). */
export const GLIDE_SEC = 0.05
export const DIP_LEVEL = 0.6
export const DIP_SEC = 0.06

/**
 * Notes as one voice's contour, from the first note's start: each holds its
 * pitch and glides to the next in 0.05 s; a repeated note dips to 0.6 of
 * its level for 0.06 s; a swell's level points ride along its note.
 */
export function contourOfNotes(notes: readonly SongNote[]): ContourPoint[] {
  const t0 = notes[0]?.from ?? 0
  const pt = (t: number, midi: number, level: number): ContourPoint => ({
    t: Math.round((t - t0) * 1e6) / 1e6,
    hz: hz(midi),
    level,
  })
  const points: ContourPoint[] = []
  notes.forEach((n, i) => {
    if (i === 0) points.push(pt(n.from, n.midi, levelOf(n, n.from)))
    // a swell's own points, inside the note
    for (const p of n.light.slice(1, -1))
      if (p.t > n.from && p.t < n.to) points.push(pt(p.t, n.midi, p.level))
    const next = notes[i + 1]
    if (next === undefined) {
      points.push(pt(n.to, n.midi, levelOf(n, n.to)))
      return
    }
    const end = levelOf(n, n.to)
    if (next.midi === n.midi) {
      points.push(pt(n.to - DIP_SEC / 2, n.midi, end))
      points.push(pt(n.to, n.midi, DIP_LEVEL * end))
      points.push(pt(n.to + DIP_SEC / 2, next.midi, levelOf(next, next.from)))
    } else {
      points.push(pt(n.to, n.midi, end))
      points.push(pt(n.to + GLIDE_SEC, next.midi, levelOf(next, n.to)))
    }
  })
  return points
}

/** Notes split at their breaths: each run of notes with no gap between them, one voice. */
export function breathGroups(notes: readonly SongNote[]): SongNote[][] {
  const groups: SongNote[][] = []
  for (const n of notes) {
    const last = groups[groups.length - 1]
    const prev = last?.[last.length - 1]
    if (prev !== undefined && n.from - prev.to < 1e-6) last.push(n)
    else groups.push([n])
  }
  return groups
}

/** A sung line as the kit's runs take it: one voice for each breath's worth (kit/run.ts `playLines`). */
export function sungLines(notes: readonly SongNote[]): RunLine[] {
  return breathGroups(notes).map((g) => ({
    t: g[0].from,
    points: contourOfNotes(g),
  }))
}

/** A chord's level: each of its three notes in the soft tone, under Merc's 0.2 (FACTS 87). */
export const CHORD_GAIN = 0.05

/** Line `k`'s chords from `doMidi`, one a minim, as soft notes from `at` seconds in (FACTS 43, 87). */
export function lineChords(k: number, doMidi: number, at = 0): RunNote[] {
  return VERSE_CHORDS[k].flatMap((c, i) =>
    CHORD_STEPS[c].map((s) => ({
      t: at + i * 2 * BEAT_SEC,
      midi: doMidi + s,
      dur: 2 * BEAT_SEC,
      kind: 'soft' as const,
      gain: CHORD_GAIN,
    })),
  )
}

/** Line `k`'s numerals, each centred under its minim: for the chord strip. */
export function chordMarks(
  k: number,
  at = 0,
): { readonly t: number; readonly text: Numeral }[] {
  return VERSE_CHORDS[k].map((c, i) => ({
    t: at + (i + 0.5) * 2 * BEAT_SEC,
    text: c,
  }))
}

// -------------------------------------------------------------- Step 3

/** Seconds of the swell, the gap after it, and Lesson 5's push (FACTS 86). */
export const SWELL_SEC = 4
export const SWELL_GAP = 0.6
/** Where the push's window starts on Step 3's plot, and the plot's length. */
export const PUSH_AT = SWELL_SEC + SWELL_GAP
export const SWELL_WINDOW = PUSH_AT + SWELL_SEC

/** The swell's level as a share of the strip: 0.5 for a second, 1 at 2.5 s, 0.5 at 4.0 s (FACTS 86). */
export const SWELL_LEVEL: readonly LevelPoint[] = [
  { t: 0, level: 0.5 },
  { t: 1, level: 0.5 },
  { t: 2.5, level: 1 },
  { t: SWELL_SEC, level: 0.5 },
]

/** The swell's cents from so `t` seconds in: in from 40 low by 0.5 s, then the band's centre. */
export const swellCents = (t: number): number =>
  t < 0.5 ? -40 * (1 - Math.max(0, t) / 0.5) : 0

/** The swell as Merc's voice sings it, on so above `doMidi`. */
export function swellContour(doMidi: number): ContourPoint[] {
  const so = doMidi + MAJOR_DEGREES[4]
  const f = (cents: number): number => hz(so) * 2 ** (cents / 1200)
  return [
    { t: 0, hz: f(-40), level: 0.5 },
    { t: 0.5, hz: f(0), level: 0.5 },
    ...SWELL_LEVEL.slice(1).map((p) => ({ t: p.t, hz: f(0), level: p.level })),
  ]
}

/** Lesson 5's pushed take on so above `doMidi`, as Lesson 5 plays it (FACTS 39). */
export const pushContour = (doMidi: number): ContourPoint[] =>
  takeContour('pushed', doMidi + MAJOR_DEGREES[4])

// -------------------------------------------------------------- the four words

/** The break before every note of Legato's second play, and the pause between its two plays, seconds (FACTS 88). */
export const BREAK_SEC = 0.3
export const LEGATO_PAUSE = BEAT_SEC

/** Legato's notes: the first line whole, then again, a beat later, with a 0.3 s break before every note but the first. */
export function legatoNotes(doMidi: number): SongNote[] {
  const smooth = lineNotes(0, doMidi)
  const again = lineNotes(0, doMidi, LINE_SEC + LEGATO_PAUSE)
  const broken = again.map((n, i) =>
    i === again.length - 1 ? n : endAt(n, n.to - BREAK_SEC),
  )
  return [...smooth, ...broken]
}

/** Legato as the kit's runs sing it: one voice, then a voice a note. */
export const legatoLines = (doMidi: number): RunLine[] =>
  sungLines(legatoNotes(doMidi))

/** Cadence: "what you are", the end of line 2, over its last two chords, V to I (FACTS 88). */
export function cadenceNotes(doMidi: number): {
  readonly sung: SongNote[]
  readonly chords: RunNote[]
} {
  const start = 4 * BEAT_SEC
  const sung = lineNotes(1, doMidi)
    .slice(4)
    .map((n) => ({
      ...n,
      from: n.from - start,
      to: n.to - start,
      light: steady(n.from - start, n.to - start),
    }))
  const chords = lineChords(1, doMidi)
    .filter((c) => c.t >= start)
    .map((c) => ({ ...c, t: c.t - start }))
  return { sung, chords }
}
