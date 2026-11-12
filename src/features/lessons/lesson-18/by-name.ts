// ============================================================
// Lesson 18 note-by-note read — each note named on one beat, sung on the next
// ============================================================
//
// The read the cold open's predict asks about and Step 1 plays again (FACTS
// 35, 38), on the beat clock: in the hero, do for 1.0 s in the soft tone
// with the house's note lit, then 0.4 s of quiet; the count-in, four
// woodblock clicks, beat 1 higher, a dot of the strip lit a click; then the
// two bars over the click, the cursor moving from bar 1's first beat and
// each pad lighting on its beat. On beats 1, 3, 5 and 7 a note's syllable
// appears over it as it is named; on beats 2, 4, 6 and 8 it is sung and
// lights, and in Step 1 a tag under it says how late it came. When bar 2
// ends the cursor stops at the final bar line, and do, mi and so are
// unlit and unnamed. The caller claims the page's sound for it and says
// its line once it has been heard.

import type { Run, Spot } from '@/features/lessons/kit/beat-clock'
import { bars, BeatClock } from '@/features/lessons/kit/beat-clock'
import { Motion } from '@/features/lessons/kit/motion-switch'
import type { Spelled } from '@/features/lessons/kit/notes'
import { hz } from '@/features/lessons/kit/notes'
import type { ReadMarks } from '@/features/lessons/kit/read-marks'
import type { RhythmBar } from '@/features/lessons/kit/rhythm-bar'
import { WOOD_LEVEL } from '@/features/lessons/kit/rhythm-bar'
import { heldSeconds } from '@/features/lessons/kit/rhythm-model'
import { Sound } from '@/features/lessons/kit/sound'
import { bookNote } from '@/features/lessons/kit/sound-ahead'
import { midiOf } from '@/features/lessons/kit/staff-places'
import { bookWood } from '@/features/lessons/kit/woodblock'
import type { ByNameHit } from './reads'
import { byNameBars, COUNT_IN, cursorAt, DO_BEATS, DO_LEAD, lateTag, nameOf, } from './reads'
import { BPM } from './tunes'

export interface ByNameOptions {
  readonly bar: RhythmBar
  readonly marks: ReadMarks
  /** The tune's notes as written, do first. */
  readonly notes: readonly Spelled[]
  /** The hero's start: do and its quiet before the count-in. */
  readonly withDo: boolean
  /** Merc's "ooh" in the hero, the soft tone in the steps. */
  readonly kind: 'soft' | 'merc'
  /** Step 1's lag tags under the sung notes. */
  readonly tags: boolean
  /** Each sung note as it starts, by index; null once the read ends. */
  readonly onSing?: (i: number | null) => void
  /** Each frame, the beats into the bars (below 0 in the count-in). */
  readonly onBeats?: (beats: number | null) => void
}

/** Starts the read; its `done` says whether it was heard to its end. */
export function startByName(o: ByNameOptions): Run {
  const names: (string | null)[] = []
  const tags: (string | null)[] = []
  let sounding: number | null = null
  let pad: number | null = null
  const jumps = Motion.paused || Motion.locked
  const r = BeatClock.start<ByNameHit>({
    bar: bars(byNameBars(o.withDo)),
    bpm: () => BPM,
    audible: Sound.canPlay(),
    ...(o.withDo ? { lead: DO_LEAD } : {}),
    book: (h, when, bus) => {
      if (h.k === 'click') bookWood(bus, when, h.high, WOOD_LEVEL)
      else if (h.k === 'do')
        bookNote(hz(midiOf(o.notes[0])), {
          when,
          dur: (DO_BEATS * 60) / BPM,
          kind: 'soft',
          to: bus.node,
        })
      else if (h.k === 'sing')
        bookNote(hz(midiOf(o.notes[h.i])), {
          when,
          dur: heldSeconds(1, BPM),
          kind: o.kind,
          to: bus.node,
        })
    },
    onBeat: (s: Spot) => {
      if (s.bar === 0) {
        // the count-in: do goes out with its first click, a dot a click
        if (s.beat === 0) o.bar.light({ pad: null, sounding: null })
        o.marks.set({ countIn: { dots: COUNT_IN, lit: s.beat } })
        return
      }
      pad = (s.bar - 1) * 4 + s.beat
      // a note named on this beat: the one sung before it goes out
      if (s.beat % 2 === 0) sounding = null
      if (s.bar === 1 && s.beat === 0)
        o.marks.set({ countIn: { dots: COUNT_IN, lit: null } })
      o.bar.light({ pad, sounding })
    },
    onHit: (h) => {
      if (h.k === 'do') o.bar.light({ pad: null, sounding: 0 })
      else if (h.k === 'name') {
        names[h.i] = nameOf(h.i)
        o.marks.set({ names: [...names] })
      } else if (h.k === 'sing') {
        sounding = h.i
        if (o.tags) {
          tags[h.i] = lateTag(h.i)
          o.marks.set({ tags: [...tags] })
        }
        o.bar.light({ pad, sounding })
        o.onSing?.(h.i)
      }
    },
    onFrame: (s: Spot) => {
      const beats = s.beats - COUNT_IN
      o.onBeats?.(beats)
      o.marks.set({ cursor: cursorAt(beats, 8, jumps) })
    },
  })
  void r.done.then((heard) => {
    o.bar.light({ pad: null, sounding: null })
    o.onSing?.(null)
    o.onBeats?.(null)
    // the cursor stops at the final bar line; the names and tags stay
    o.marks.set({ countIn: null, cursor: heard ? 8 : null })
  })
  return r
}
