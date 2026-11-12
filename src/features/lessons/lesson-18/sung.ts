// ============================================================
// Lesson 18 Sing it's runs — do, the count-in, then the bars, on the beat clock
// ============================================================
//
// Every sound Sing it makes is one run on the beat clock from one start,
// so the drawing and the sound share it (WEB-SPEC, Toys 5; FACTS 49, 58,
// 59): do in the chosen voice, Merc's "ooh" for 1.0 s, the house's note
// lit, then 0.4 s of quiet; the count-in, four woodblock clicks, beat 1
// higher, a dot of the count-in strip lit a click; then the tune's two
// bars, the cursor crossing them at 60 BPM and the beat grid lighting each
// beat. In a take and in Play the start nothing sounds in the bars, the
// click included, since the microphone hears the raw signal: the start is
// 5.4 s and the bars 8.0 s more. In Merc's tunes each note is sung as
// written and lights amber as it sounds, the note before the breath mark
// shortened to 0.6 s, and after 1.0 s the second tune is shown, counted in
// and sung: 26.4 s. When a part's bars end the cursor stops at the final
// bar line. The caller claims the page's sound for the run.

import type { Bar as ClockBar, Hit, Run, Spot, } from '@/features/lessons/kit/beat-clock'
import { bars, BeatClock } from '@/features/lessons/kit/beat-clock'
import { Motion } from '@/features/lessons/kit/motion-switch'
import { hz } from '@/features/lessons/kit/notes'
import type { ReadMarks } from '@/features/lessons/kit/read-marks'
import type { RhythmBar } from '@/features/lessons/kit/rhythm-bar'
import { WOOD_LEVEL } from '@/features/lessons/kit/rhythm-bar'
import { heldSeconds } from '@/features/lessons/kit/rhythm-model'
import { bookNote } from '@/features/lessons/kit/sound-ahead'
import type { Clef } from '@/features/lessons/kit/staff-places'
import { midiOf } from '@/features/lessons/kit/staff-places'
import { bookWood } from '@/features/lessons/kit/woodblock'
import { COUNT_IN, cursorAt, DO_BEATS, DO_LEAD, QUIET_BEATS } from './reads'
import type { Tune } from './tunes'
import { beatsOf, BPM, DO, notesOf, tuneShape } from './tunes'

/** What a run does on its beats: do before the first count-in, a click, or a note of a part's tune. */
export type SungHit =
  | { readonly k: 'do' }
  | { readonly k: 'click'; readonly high: boolean }
  | { readonly k: 'note'; readonly part: number; readonly i: number }

/** A run's part: a tune, its notes sung (Merc's tunes) or its bars crossed in silence (a take, Play the start). */
export interface SungPart {
  readonly tune: Tune
  readonly sing: boolean
}

/** The quiet between Merc's two tunes, in beats at 60 BPM: 1.0 s (FACTS 59). */
export const BETWEEN_BEATS = 1

/** Each bar of a run: which part, and whether it is the part's count-in, a bar of its tune (from which beat of it), or the pause before it. */
export interface SungBar {
  readonly part: number
  readonly kind: 'count' | 'tune' | 'pause'
  /** The tune's beat this bar starts on; -COUNT_IN for a count-in, and the pause's before it. */
  readonly from: number
}

const clicks = (): Hit<SungHit>[] =>
  Array.from({ length: COUNT_IN }, (_, beat) => ({
    beat,
    data: { k: 'click', high: beat === 0 } as const,
  }))

/**
 * A run's bars on the beat clock and what each is: do and its quiet
 * before the first count-in, then each part's count-in and two bars, a
 * second part after a 1.0 s pause.
 */
export function sungBars(parts: readonly SungPart[]): {
  readonly bars: ClockBar<SungHit>[]
  readonly plan: SungBar[]
} {
  const out: ClockBar<SungHit>[] = []
  const plan: SungBar[] = []
  parts.forEach((p, part) => {
    if (part > 0) {
      out.push({ beats: BETWEEN_BEATS, hits: [] })
      plan.push({ part, kind: 'pause', from: -COUNT_IN - BETWEEN_BEATS })
    }
    out.push({
      beats: COUNT_IN,
      hits: [
        ...(part === 0
          ? [{ beat: -(DO_BEATS + QUIET_BEATS), data: { k: 'do' } as const }]
          : []),
        ...clicks(),
      ],
    })
    plan.push({ part, kind: 'count', from: -COUNT_IN })
    const sounds = beatsOf(p.tune)
    let from = 0
    for (const bar of p.tune.bars) {
      const beats = bar.reduce((n, w) => n + w.value, 0)
      out.push({
        beats,
        hits: p.sing
          ? sounds.flatMap((s, i): Hit<SungHit>[] =>
              s.beat >= from && s.beat < from + beats
                ? [{ beat: s.beat - from, data: { k: 'note', part, i } }]
                : [],
            )
          : [],
      })
      plan.push({ part, kind: 'tune', from })
      from += beats
    }
  })
  return { bars: out, plan }
}

/** A run's length, s, from do's start: 13.4 for a take or Play the start, 26.4 for Merc's tunes. */
export function sungSeconds(parts: readonly SungPart[]): number {
  const beats = sungBars(parts).bars.reduce((n, b) => n + b.beats, 0)
  return ((DO_BEATS + QUIET_BEATS + beats) * 60) / BPM
}

/** A staff a run draws on: its figure, and the marks over it. */
export interface SungStaff {
  readonly bar: RhythmBar
  readonly marks: ReadMarks
}

export interface SungOptions {
  readonly clef: Clef
  readonly parts: readonly SungPart[]
  /** The staff each part draws on: one staff, its tune changed by `show`, or a staff a tune. */
  readonly staffOf: (part: number) => SungStaff
  /** Shows a part's tune, as its pause or its count-in starts. */
  readonly show?: (part: number) => void
  readonly audible: boolean
  /** The count-in starts: its first click, do's quiet over. */
  readonly onCount?: () => void
  /** Each frame: the part, and the beats into its bars, below 0 in its count-in. */
  readonly onBeats?: (part: number, beats: number) => void
}

/** Starts a run; its `done` says whether it was heard to its end. */
export function startSung(o: SungOptions): Run {
  const { bars: list, plan } = sungBars(o.parts)
  const doMidi = midiOf(DO[o.clef])
  const notes = o.parts.map((p) => notesOf(p.tune, o.clef))
  const sounds = o.parts.map((p) => beatsOf(p.tune))
  const shapes = o.parts.map((p) => tuneShape(p.tune))
  const jumps = Motion.paused || Motion.locked
  let part = 0
  let staff = o.staffOf(0)
  let pad: number | null = null
  let sounding: number | null = null
  const light = (next: {
    pad: number | null
    sounding: number | null
  }): void => {
    if (next.pad === pad && next.sounding === sounding) return
    pad = next.pad
    sounding = next.sounding
    staff.bar.light({ pad, sounding })
  }
  /** The next part's staff: the one before put out, its tune shown. */
  const turn = (next: number): void => {
    light({ pad: null, sounding: null })
    staff.marks.set({ cursor: null, countIn: null })
    part = next
    staff = o.staffOf(next)
    o.show?.(next)
  }
  const r = BeatClock.start<SungHit>({
    bar: bars(list),
    bpm: () => BPM,
    audible: o.audible,
    lead: DO_LEAD,
    book: (h, when, bus) => {
      if (h.k === 'click') bookWood(bus, when, h.high, WOOD_LEVEL)
      else if (h.k === 'do')
        bookNote(hz(doMidi), {
          when,
          dur: (DO_BEATS * 60) / BPM,
          kind: 'merc',
          to: bus.node,
        })
      else
        bookNote(hz(midiOf(notes[h.part][h.i])), {
          when,
          // each note its length less the gap, the one before the breath 0.6 s
          dur:
            shapes[h.part](h.i)?.seconds ??
            heldSeconds(sounds[h.part][h.i].beats, BPM),
          kind: 'merc',
          to: bus.node,
        })
    },
    onBeat: (s: Spot) => {
      const b = plan[s.bar] as SungBar | undefined
      if (b === undefined) return
      if (b.part !== part) turn(b.part)
      if (b.kind === 'pause') return
      if (b.kind === 'count') {
        // a dot of the strip a click
        if (s.beat === 0 && b.part === 0) o.onCount?.()
        staff.marks.set({ countIn: { dots: COUNT_IN, lit: s.beat } })
        return
      }
      if (b.from === 0 && s.beat === 0)
        staff.marks.set({ countIn: { dots: COUNT_IN, lit: null } })
      light({ pad: b.from + s.beat, sounding })
    },
    onHit: (h) => {
      // the house's note lit while do sounds; it goes out with the first click
      if (h.k === 'do') light({ pad: null, sounding: 0 })
      else if (h.k === 'click' && h.high) light({ pad: null, sounding: null })
    },
    onFrame: (s: Spot) => {
      const b = plan[s.bar] as SungBar | undefined
      if (b === undefined || b.part !== part) return
      // the beats into the part's bars: its bar's first, the beat in it, and how far into that
      const into = b.from + s.beat + (s.beats % 1)
      o.onBeats?.(b.part, into)
      if (b.kind !== 'tune') return
      staff.marks.set({ cursor: cursorAt(into, 8, jumps) })
      // a sung note lights amber as it sounds
      if (o.parts[b.part].sing) {
        const now = sounds[b.part].findIndex(
          (x) => into >= x.beat && into < x.beat + x.beats,
        )
        light({ pad, sounding: now === -1 ? null : now })
      }
    },
  })
  void r.done.then((heard) => {
    light({ pad: null, sounding: null })
    // the cursor stops at the final bar line; nothing else stays lit
    staff.marks.set({ countIn: null, cursor: heard ? 8 : null })
  })
  return r
}
