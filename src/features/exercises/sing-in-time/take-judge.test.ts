import { describe, expect, it } from 'vitest'
import type { F0Frame } from '@/lib/mirror/metrics'
import type { Sung, Written } from './take-frames.fixture'
import { framesOf, pageOf, singAll } from './take-frames.fixture'
import type { TakeOptions } from './take-judge'
import { closesAt, FILL_MAX_SEC, filled, judgeTake, ON_TIME_MIN_SEC, timingOf, } from './take-judge'

/** Do re mi, a half, then fa re do: mi to fa a half step, so fa's neighbour is close. */
const NOTES: readonly Written[] = [
  { midi: 60, beat: 0, beats: 1 },
  { midi: 62, beat: 1, beats: 1 },
  { midi: 64, beat: 2, beats: 2 },
  { midi: 65, beat: 4, beats: 1 },
  { midi: 62, beat: 5, beats: 1 },
  { midi: 60, beat: 6, beats: 2 },
]
const BAR1 = 3
const OPTIONS: TakeOptions = {
  notes: NOTES,
  bpm: 60,
  bar1: BAR1,
  opened: BAR1 - 0.5,
}

/** Every note sung on its beat, each stretch then changed by `change`. */
function sung(change: (s: Sung[]) => Sung[] = (s) => s, late = 0): Sung[] {
  return change(singAll(NOTES, { bpm: 60, bar1: BAR1, late }))
}

const judge = (s: readonly Sung[], o: TakeOptions = OPTIONS, now?: number) =>
  judgeTake(framesOf(s), o, now)

const pitches = (v: ReturnType<typeof judgeTake>) =>
  v.notes.map((n) => n?.pitch ?? null)
const timings = (v: ReturnType<typeof judgeTake>) =>
  v.notes.map((n) => n?.timing ?? null)

describe('a take sung on the beat', () => {
  it('is every note in tune and on time, anchored on its first note', () => {
    const v = judge(sung())
    expect(v.voice).toBe(true)
    expect(v.settled).toBe(true)
    expect(v.shift).toBeCloseTo(0, 6)
    expect(pitches(v)).toEqual(Array(6).fill('in-tune'))
    expect(timings(v)).toEqual(Array(6).fill('on-time'))
    for (const n of v.notes) expect(n?.cents).toBe(0)
  })

  it('reads a steady late start as on time: the beats are counted from the first note', () => {
    const v = judge(sung(undefined, 0.6))
    expect(v.shift).toBeCloseTo(0.6, 6)
    expect(pitches(v)).toEqual(Array(6).fill('in-tune'))
    expect(timings(v)).toEqual(Array(6).fill('on-time'))
  })

  it('reads a late start of more than two beats as no anchor, and names no wrong note', () => {
    const v = judge(sung(undefined, 2.4))
    expect(v.shift).toBeNull()
    expect(pitches(v)).not.toContain('off')
  })

  it('reads a voice already going as the take opened as no anchor', () => {
    // humming do from the count-in into the first note
    const v = judge(
      sung(([first, ...rest]) => [{ ...first, from: BAR1 - 1 }, ...rest]),
    )
    expect(v.shift).toBeNull()
    expect(v.notes[0]?.pitch).toBe('in-tune')
    expect(v.notes[0]?.timing).toBe('early')
  })
})

describe('a note', () => {
  it('that came in late is late, and the notes around it on time', () => {
    const v = judge(
      sung((s) =>
        s.map((x, i) =>
          i === 2
            ? { ...x, to: x.to + 0.35 }
            : i === 3
              ? { ...x, from: x.from + 0.35 }
              : x,
        ),
      ),
    )
    expect(timings(v)).toEqual([
      'on-time',
      'on-time',
      'on-time',
      'late',
      'on-time',
      'on-time',
    ])
    expect(v.notes[3]?.offset).toBeCloseTo(0.35, 2)
  })

  it('that came in early is early', () => {
    const v = judge(
      sung((s) =>
        s.map((x, i) =>
          i === 3
            ? { ...x, to: x.to - 0.23 }
            : i === 4
              ? { ...x, from: x.from - 0.23 }
              : x,
        ),
      ),
    )
    expect(v.notes[4]?.timing).toBe('early')
    expect(v.notes[4]?.offset).toBeCloseTo(-0.23, 2)
    expect(v.notes[3]?.pitch).toBe('in-tune')
  })

  it('sung 80 cents sharp, on no note near it, is off by its own cents', () => {
    const v = judge(
      sung((s) => s.map((x, i) => (i === 3 ? { ...x, cents: 80 } : x))),
    )
    expect(v.notes[3]).toEqual({
      pitch: 'off',
      cents: 80,
      offset: null,
      timing: null,
    })
    expect(pitches(v).filter((p) => p === 'in-tune')).toHaveLength(5)
  })

  it('sung 40 cents flat is still in tune, its cents kept', () => {
    const v = judge(
      sung((s) => s.map((x, i) => (i === 1 ? { ...x, cents: -40 } : x))),
    )
    expect(v.notes[1]?.pitch).toBe('in-tune')
    expect(v.notes[1]?.cents).toBe(-40)
  })

  it('left out is not heard, and never a gap measured from another note', () => {
    const v = judge(sung((s) => s.filter((_, i) => i !== 3)))
    expect(v.notes[3]).toEqual({
      pitch: 'not-heard',
      cents: null,
      offset: null,
      timing: null,
    })
    expect(pitches(v)).toEqual([
      'in-tune',
      'in-tune',
      'in-tune',
      'not-heard',
      'in-tune',
      'in-tune',
    ])
  })

  it('sung on the note before it, held on too long, is not heard rather than off', () => {
    const v = judge(
      sung((s) =>
        s
          .filter((_, i) => i !== 3)
          .map((x, i) => (i === 2 ? { ...x, to: BAR1 + 5 - 0.02 } : x)),
      ),
    )
    expect(v.notes[3]?.pitch).toBe('not-heard')
  })

  it("of an eighth pair at a faster tempo is heard on its share of the reader's hold", () => {
    const notes: Written[] = [
      { midi: 60, beat: 0, beats: 0.5 },
      { midi: 62, beat: 0.5, beats: 0.5 },
      { midi: 64, beat: 1, beats: 1 },
      { midi: 62, beat: 2, beats: 1 },
      { midi: 60, beat: 3, beats: 1 },
    ]
    const o: TakeOptions = {
      notes,
      bpm: 72,
      bar1: 2,
      opened: 2 - 0.5 * (60 / 72),
    }
    const v = judgeTake(framesOf(singAll(notes, { bpm: 72, bar1: 2 })), o)
    expect(pitches(v)).toEqual(Array(5).fill('in-tune'))
    expect(timings(v)).toEqual(Array(5).fill('on-time'))
  })
})

describe('a take with no voice', () => {
  it('hears nothing, and every note is not heard', () => {
    const v = judgeTake([], OPTIONS)
    expect(v.voice).toBe(false)
    expect(v.shift).toBeNull()
    expect(pitches(v)).toEqual(Array(6).fill('not-heard'))
  })

  it("ignores Merc's do and the count-in: voice before the take opened is no note", () => {
    const before: Sung[] = [{ midi: 60, from: 0.5, to: BAR1 - 0.6 }]
    const v = judgeTake(framesOf(before), OPTIONS)
    expect(v.voice).toBe(false)
  })
})

describe('a take judged as it runs', () => {
  /** The take's frames as far as `now`, judged then. */
  const liveAt = (now: number) =>
    judgeTake(
      framesOf(sung()).filter((f) => f.t <= now),
      OPTIONS,
      now,
    )

  it('waits for the first note before any verdict', () => {
    const v = liveAt(BAR1 + 0.05)
    expect(v.settled).toBe(false)
    expect(v.notes).toEqual(Array(6).fill(null))
  })

  it('settles with no first note once two beats and its 0.15 s have gone by', () => {
    expect(judgeTake([], OPTIONS, BAR1 + 2.1).settled).toBe(false)
    expect(judgeTake([], OPTIONS, BAR1 + 2.15).settled).toBe(true)
  })

  it('judges a note once its window has closed, a quarter beat past its end', () => {
    const early = liveAt(BAR1 + 1.2)
    expect(early.settled).toBe(true)
    expect(early.notes[0]).toBeNull()
    const closed = liveAt(BAR1 + 1.25)
    expect(closed.notes[0]?.pitch).toBe('in-tune')
    expect(closed.notes[1]).toBeNull()
  })

  it('closes its last window a quarter beat past its last note, moved by the anchor', () => {
    expect(closesAt(OPTIONS, null)).toBeCloseTo(BAR1 + 8.25, 9)
    expect(closesAt(OPTIONS, 0.4)).toBeCloseTo(BAR1 + 8.65, 9)
  })
})

describe('timing', () => {
  it('is on time within a fifth of a beat, early or late beyond', () => {
    expect(timingOf(0.19, 60)).toBe('on-time')
    expect(timingOf(-0.19, 60)).toBe('on-time')
    expect(timingOf(0.21, 60)).toBe('late')
    expect(timingOf(-0.21, 60)).toBe('early')
  })

  it('allows never less than its floor at a fast tempo', () => {
    expect(timingOf(ON_TIME_MIN_SEC - 0.01, 120)).toBe('on-time')
    expect(timingOf(ON_TIME_MIN_SEC + 0.01, 120)).toBe('late')
  })
})

describe('a slower page', () => {
  const f = (t: number, conf = 0.9): F0Frame => ({ t, f0: 261.63, conf })

  it('fills a gap it never looked into, half from each side, a sixtieth apart', () => {
    const a = { t: 1, f0: 200, conf: 0.9 }
    const b = { t: 1.11, f0: 300, conf: 0.9 }
    const out = filled([a, b], [])
    expect(out.map((x) => Math.round(x.t * 1000))).toEqual([
      1000, 1016, 1031, 1047, 1063, 1079, 1094, 1110,
    ])
    expect(out.map((x) => x.f0)).toEqual([
      200, 200, 200, 200, 300, 300, 300, 300,
    ])
  })

  it('leaves a gap it looked into, a gap too long, or a gap no wider than a hop', () => {
    expect(filled([f(1), f(1.1)], [1.05])).toHaveLength(2)
    expect(filled([f(1), f(1 + FILL_MAX_SEC + 0.01)], [])).toHaveLength(2)
    expect(filled([f(1), f(1.04)], [])).toHaveLength(2)
  })

  it('fills only the voice’s half of a gap beside a look that heard none', () => {
    // the page last heard nothing at 1.0, then stopped; the voice was there at 1.3
    const out = filled([f(1.3)], [1.0])
    // from halfway, at the sixtieth on or after it
    expect(out[0].t).toBeGreaterThanOrEqual(1.15 - 1e-9)
    expect(out[0].t).toBeLessThan(1.15 + 1 / 60 + 1e-9)
    expect(out.at(-1)?.t).toBe(1.3)
    expect(out.every((x) => x.f0 > 0)).toBe(true)
    // an unsure frame is a look that heard no voice, and is kept as it was
    const unsure = filled([f(1, 0.3), f(1.1)], [])
    expect(unsure[0]).toEqual(f(1, 0.3))
    expect(
      unsure.slice(1).every((x) => x.t >= 1.05 - 1e-9 && x.conf === 0.9),
    ).toBe(true)
  })

  it('fills nothing without the looks that heard no voice', () => {
    const frames = [f(1), f(1.2)]
    expect(filled(frames, undefined)).toEqual(frames)
  })

  it("still counts a late start from the singer's first note at fifteen frames a second", () => {
    const take = sung(undefined, 0.5)
    const page = pageOf(take, {
      from: OPTIONS.opened,
      to: BAR1 + 9.5,
      hop: 1 / 15,
    })
    const v = judgeTake(page.frames, { ...OPTIONS, silent: page.silent })
    expect(v.shift).toBeCloseTo(0.5, 1)
    expect(pitches(v)).toEqual(Array(6).fill('in-tune'))
    expect(timings(v)).toEqual(Array(6).fill('on-time'))
    // the reader's own rule, with no looks to go on, finds no first note there
    expect(judgeTake(page.frames, OPTIONS).shift).toBeNull()
  })

  it('places a first note sung while the page stalled halfway through the stall', () => {
    const page = pageOf(sung(), {
      from: OPTIONS.opened,
      to: BAR1 + 9.5,
      hop: 1 / 60,
    })
    // no look at all from a tenth of a second before bar 1 to 0.3 s after it
    const away = (t: number) => t > BAR1 - 0.1 && t < BAR1 + 0.3
    const frames = page.frames.filter((x) => !away(x.t))
    const silent = page.silent.filter((t) => !away(t))
    const v = judgeTake(frames, { ...OPTIONS, silent })
    expect(v.shift).toBeCloseTo(0.1, 1)
    expect(timings(v)).toEqual(Array(6).fill('on-time'))
    // read from the first frame after the stall, every note would come early
    expect(timings(judgeTake(frames, OPTIONS)).slice(1)).toContain('early')
  })
})
